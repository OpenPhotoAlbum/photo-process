import { Job, JobHandler } from '../util/job-queue';
import { FaceRepository } from '../models/database';
import { Logger } from '../logger';
import { configManager } from '../util/config-manager';

const logger = Logger.getInstance();

export interface FaceRecognitionJobData {
    limit?: number;
    confidenceThreshold?: number;
    imageIds?: number[]; // Specific images to process
}

export const faceRecognitionJobHandler: JobHandler<FaceRecognitionJobData> = async (
    job: Job<FaceRecognitionJobData>,
    updateProgress
) => {
    const faceRecognitionConfig = configManager.getFaceRecognitionConfig();
    const { 
        limit = 50, 
        confidenceThreshold = faceRecognitionConfig.confidence.review,
        imageIds 
    } = job.data;
    
    logger.info(`Starting face recognition job ${job.id} with limit: ${limit}`);
    updateProgress(5, 'Getting unidentified faces...');

    try {
        // Get faces to process
        let faces: any[] = [];
        if (imageIds) {
            // Get faces from specific images
            for (const imageId of imageIds) {
                const imageFaces = await FaceRepository.getFacesByImage(imageId);
                faces.push(...imageFaces);
            }
        } else {
            faces = await FaceRepository.getUnidentifiedFaces(limit);
        }
        
        if (faces.length === 0) {
            updateProgress(100, 'No faces to process');
            return { processed: 0, recognized: 0, needsConfirmation: 0 };
        }

        updateProgress(10, `Processing ${faces.length} faces...`);
        
        let processed = 0;
        let recognized = 0;
        let needsConfirmation = 0;
        
        // Process faces in batches to avoid overwhelming CompreFace
        const batchSize = 10;
        const totalBatches = Math.ceil(faces.length / batchSize);
        
        for (let i = 0; i < totalBatches; i++) {
            const batchStart = i * batchSize;
            const batchEnd = Math.min(batchStart + batchSize, faces.length);
            const batch = faces.slice(batchStart, batchEnd);
            
            updateProgress(
                10 + (i / totalBatches) * 80, 
                `Processing batch ${i + 1}/${totalBatches}...`
            );
            
            // Process each face in the batch
            for (const face of batch) {
                try {
                    if (!face.face_image_path) {
                        logger.warn(`Skipping face ${face.id} - no image path`);
                        continue;
                    }

                    // Use CompreFace to recognize the face
                    const { recognizeFacesFromImage } = await import('../util/compreface');
                    const recognitionResult = await recognizeFacesFromImage(face.face_image_path);
                    
                    processed++;
                    
                    // Check if we got recognition results
                    if (recognitionResult?.result && recognitionResult.result.length > 0) {
                        const bestMatch = recognitionResult.result[0];
                        
                        if (bestMatch.subjects && bestMatch.subjects.length > 0) {
                            const topSubject = bestMatch.subjects[0];
                            const confidence = topSubject.similarity;
                            
                            if (confidence >= faceRecognitionConfig.confidence.autoAssign) {
                                // High confidence - automatically assign
                                const { FaceRepository, PersonRepository } = await import('../models/database');
                                const person = await PersonRepository.getPersonByComprefaceId(topSubject.subject);
                                if (person && person.id) {
                                    await FaceRepository.assignFaceToPerson(face.id, person.id, confidence, 'auto-background');
                                    recognized++;
                                    logger.info(`Auto-assigned face ${face.id} to person ${person.name} with confidence ${confidence}`);
                                }
                            } else if (confidence >= confidenceThreshold) {
                                // Medium confidence - needs manual confirmation
                                needsConfirmation++;
                                logger.info(`Face ${face.id} needs confirmation for person ${topSubject.subject} with confidence ${confidence}`);
                            }
                        }
                    }
                    
                } catch (error) {
                    logger.error(`Error processing face ${face.id}: ${error}`);
                }
            }
        }
        
        updateProgress(95, 'Finalizing results...');
        
        const result = {
            processed,
            recognized,
            needsConfirmation,
            duration: Date.now() - job.createdAt.getTime()
        };
        
        updateProgress(100, `Completed: ${recognized} recognized, ${needsConfirmation} need confirmation`);
        
        logger.info(`Face recognition job ${job.id} completed: ${JSON.stringify(result)}`);
        return result;
        
    } catch (error) {
        logger.error(`Face recognition job ${job.id} failed: ${error}`);
        throw error;
    }
};