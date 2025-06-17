import { parentPort, workerData } from 'worker_threads';
import { storeImageDataHashed, generateImageDataJsonHashed } from './process-source';
import { detectObjects } from './object-detection';
import { extractFaces } from './compreface';
import { SmartAlbumEngine } from './smart-album-engine';
import { ImageRepository, db } from '../models/database';
import { configManager } from './config-manager';

interface WorkerMessage {
    type: 'process' | 'cancel';
    jobId: string;
    jobType?: 'image_processing' | 'face_detection' | 'object_detection' | 'smart_albums';
    data?: any;
}

interface WorkerResponse {
    type: 'progress' | 'completed' | 'error';
    jobId: string;
    progress?: number;
    processedItems?: number;
    result?: any;
    error?: string;
}

class BatchWorker {
    private workerId: string;
    private activeJobs: Map<string, boolean> = new Map();

    constructor() {
        this.workerId = workerData.workerId;
        this.setupMessageHandler();
    }

    private setupMessageHandler(): void {
        if (!parentPort) {
            throw new Error('Worker must be run in worker thread');
        }

        parentPort.on('message', async (message: WorkerMessage) => {
            try {
                switch (message.type) {
                    case 'process':
                        await this.processJob(message);
                        break;
                    case 'cancel':
                        this.cancelJob(message.jobId);
                        break;
                }
            } catch (error) {
                this.sendResponse({
                    type: 'error',
                    jobId: message.jobId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }

    private async processJob(message: WorkerMessage): Promise<void> {
        const { jobId, jobType, data } = message;
        
        if (!jobType || !data) {
            throw new Error('Invalid job message');
        }

        this.activeJobs.set(jobId, true);

        try {
            let result: any;

            switch (jobType) {
                case 'image_processing':
                    result = await this.processImages(jobId, data);
                    break;
                case 'face_detection':
                    result = await this.processFaceDetection(jobId, data);
                    break;
                case 'object_detection':
                    result = await this.processObjectDetection(jobId, data);
                    break;
                case 'smart_albums':
                    result = await this.processSmartAlbums(jobId, data);
                    break;
                default:
                    throw new Error(`Unknown job type: ${jobType}`);
            }

            if (this.activeJobs.get(jobId)) {
                this.sendResponse({
                    type: 'completed',
                    jobId,
                    result
                });
            }
        } finally {
            this.activeJobs.delete(jobId);
        }
    }

    private async processImages(jobId: string, data: any): Promise<any> {
        const { filePaths, batchSize = 1 } = data;
        const files = Array.isArray(filePaths) ? filePaths : [filePaths];
        
        const results = {
            processed: 0,
            successful: [] as Array<{ filePath: string; imageId: number }>,
            failed: [] as Array<{ filePath: string; error: string }>,
            errors: [] as string[]
        };

        // Process files in batches
        for (let i = 0; i < files.length; i += batchSize) {
            if (!this.activeJobs.get(jobId)) {
                break; // Job was cancelled
            }

            const batch = files.slice(i, i + batchSize);
            const batchPromises = batch.map(async (filePath: string) => {
                try {
                    // Generate processing results
                    const { fileInfo, processingResults } = await generateImageDataJsonHashed(filePath);
                    // Store in database
                    const imageId = await storeImageDataHashed(filePath, fileInfo, processingResults);
                    results.successful.push({ filePath, imageId });
                    return true;
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    results.failed.push({ filePath, error: errorMsg });
                    results.errors.push(`${filePath}: ${errorMsg}`);
                    return false;
                }
            });

            // Wait for current batch to complete
            const batchResults = await Promise.allSettled(batchPromises);
            results.processed += batchResults.length;

            // Send progress update
            const progress = Math.round((results.processed / files.length) * 100);
            this.sendResponse({
                type: 'progress',
                jobId,
                progress,
                processedItems: results.processed
            });

            // Small delay to prevent overwhelming the system
            if (i + batchSize < files.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return results;
    }

    private async processFaceDetection(jobId: string, data: any): Promise<any> {
        const { imageIds } = data;
        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (let i = 0; i < imageIds.length; i++) {
            if (!this.activeJobs.get(jobId)) {
                break;
            }

            const imageId = imageIds[i];

            try {
                const image = await ImageRepository.findById(imageId);
                if (!image || !image.original_path) {
                    throw new Error(`Image ${imageId} not found or missing original path`);
                }

                // Extract faces using CompreFace
                const facesDir = configManager.getStorage()?.processedDir + '/faces' || '/tmp/faces';
                const faces = await extractFaces(image.original_path, facesDir);
                
                // Store faces in database (this would need to be implemented)
                // await FaceRepository.createFacesForImage(imageId, faces);
                
                results.successful++;
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                results.errors.push(`Image ${imageId}: ${errorMsg}`);
                results.failed++;
            }

            results.processed++;

            // Send progress update
            const progress = Math.round((results.processed / imageIds.length) * 100);
            this.sendResponse({
                type: 'progress',
                jobId,
                progress,
                processedItems: results.processed
            });
        }

        return results;
    }

    private async processObjectDetection(jobId: string, data: any): Promise<any> {
        const { imageIds, batchSize = 4 } = data;
        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            totalObjects: 0,
            errors: [] as string[]
        };

        // Process in parallel batches
        for (let i = 0; i < imageIds.length; i += batchSize) {
            if (!this.activeJobs.get(jobId)) {
                break;
            }

            const batch = imageIds.slice(i, i + batchSize);
            const batchPromises = batch.map(async (imageId: number) => {
                try {
                    const image = await ImageRepository.findById(imageId);
                    if (!image || !image.original_path) {
                        throw new Error(`Image ${imageId} not found`);
                    }

                    const objects = await detectObjects(image.original_path);
                    
                    // Filter by confidence and store in database
                    const minConfidence = configManager.getMinConfidence();
                    const validObjects = objects.filter(obj => obj.confidence >= minConfidence);
                    
                    // Store objects (would need ObjectRepository batch method)
                    // await ObjectRepository.createObjectsForImage(imageId, validObjects);
                    
                    results.successful++;
                    results.totalObjects += validObjects.length;
                    return { success: true, objectCount: validObjects.length };
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    results.errors.push(`Image ${imageId}: ${errorMsg}`);
                    results.failed++;
                    return { success: false, error: errorMsg };
                }
            });

            await Promise.allSettled(batchPromises);
            results.processed += batch.length;

            // Send progress update
            const progress = Math.round((results.processed / imageIds.length) * 100);
            this.sendResponse({
                type: 'progress',
                jobId,
                progress,
                processedItems: results.processed
            });
        }

        return results;
    }

    private async processSmartAlbums(jobId: string, data: any): Promise<any> {
        const { imageIds, batchSize = 8 } = data;
        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            albumAssignments: 0,
            errors: [] as string[]
        };

        // Process in batches to avoid overwhelming the system
        for (let i = 0; i < imageIds.length; i += batchSize) {
            if (!this.activeJobs.get(jobId)) {
                break;
            }

            const batch = imageIds.slice(i, i + batchSize);
            const batchPromises = batch.map(async (imageId: number) => {
                try {
                    await SmartAlbumEngine.processImageForAlbums(imageId);
                    results.successful++;
                    
                    // Count how many albums this image was added to
                    const albumCount = await this.getImageAlbumCount(imageId);
                    results.albumAssignments += albumCount;
                    
                    return { success: true, albumCount };
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    results.errors.push(`Image ${imageId}: ${errorMsg}`);
                    results.failed++;
                    return { success: false, error: errorMsg };
                }
            });

            await Promise.allSettled(batchPromises);
            results.processed += batch.length;

            // Send progress update
            const progress = Math.round((results.processed / imageIds.length) * 100);
            this.sendResponse({
                type: 'progress',
                jobId,
                progress,
                processedItems: results.processed
            });

            // Small delay between batches
            if (i + batchSize < imageIds.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        return results;
    }

    private async getImageAlbumCount(imageId: number): Promise<number> {
        const result = await db('smart_album_images')
            .where({ image_id: imageId })
            .count('* as count')
            .first();
        
        return Number(result?.count) || 0;
    }

    private cancelJob(jobId: string): void {
        this.activeJobs.set(jobId, false);
    }

    private sendResponse(response: WorkerResponse): void {
        if (parentPort) {
            parentPort.postMessage(response);
        }
    }
}

// Initialize the worker
if (require.main === module) {
    new BatchWorker();
}

export { BatchWorker };