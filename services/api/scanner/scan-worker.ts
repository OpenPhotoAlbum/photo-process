import fs from 'fs';
import { Logger } from '../logger';
import { fileTracker, FileIndexRecord } from '../util/file-tracker';
import { getImageProcessorPool } from '../util/worker-pool';
import { HashManager } from '../util/hash-manager';
import winston from 'winston';
import mime from 'mime-types';

const logger = Logger.getInstance();
const colorizer = winston.format.colorize();

const supportedMIMEtypeInput = [
    "image/jpeg",
    "image/jpg",
    "image/png"
];

const blacklist = (file: string): boolean => {
    // Add any blacklist logic here
    return true;
};

export interface ScanProgress {
    processed: number;
    total: number;
    successful: number;
    failed: number;
    currentFile?: string;
}

export class WorkerBasedScanner {
    private workerPool = getImageProcessorPool();
    private isInitialized = false;
    private progress: ScanProgress = {
        processed: 0,
        total: 0,
        successful: 0,
        failed: 0
    };

    /**
     * Initialize the scanner with worker pool
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        
        logger.info('[WorkerScanner] Initializing worker pool...');
        await this.workerPool.initialize();
        this.isInitialized = true;
        logger.info('[WorkerScanner] Worker pool initialized');
    }

    /**
     * Start a worker-based scan
     */
    async startScan(sourceDir: string, limit?: number): Promise<ScanProgress> {
        const logPrefix = colorizer.colorize('info', '[WORKER-SCAN]');
        
        // Reset progress
        this.progress = {
            processed: 0,
            total: 0,
            successful: 0,
            failed: 0
        };

        try {
            // Ensure worker pool is initialized
            await this.initialize();

            logger.info(`${logPrefix} Starting worker-based scan with limit: ${limit || 'unlimited'}`);
            
            // Initialize FileTracker if needed
            await fileTracker.initialize();
            
            // Get pending files from FileTracker
            const pendingFiles = await fileTracker.getPendingFiles(limit || 1000);
            logger.info(`${logPrefix} FileTracker found ${pendingFiles.length} pending files`);
            
            // Filter to supported image types
            const files = pendingFiles
                .filter(record => {
                    const mt = mime.lookup(record.file_path);
                    return mt && supportedMIMEtypeInput.includes(mt as string) && blacklist(record.file_path);
                })
                .slice(0, limit || pendingFiles.length);

            logger.info(`${logPrefix} Filtered to ${files.length} supported image files`);
            
            if (files.length === 0) {
                logger.info(`${logPrefix} No files to process`);
                return this.progress;
            }

            // Update total count
            this.progress.total = files.length;

            // Process files using worker pool
            const processingPromises = files.map(async (fileRecord) => {
                try {
                    this.progress.currentFile = fileRecord.file_path;
                    
                    // Mark as processing in FileTracker
                    await fileTracker.markFileAsProcessing(fileRecord.file_path);
                    
                    // Extract date from file for organization
                    let dateTaken: Date | undefined;
                    try {
                        const stats = fs.statSync(fileRecord.file_path);
                        dateTaken = stats.mtime;
                    } catch (error) {
                        dateTaken = new Date();
                    }
                    
                    // Process in worker thread
                    const result = await this.workerPool.execute({
                        filePath: fileRecord.file_path,
                        dateTaken
                    });
                    
                    // Update FileTracker based on result
                    if (result.success) {
                        const hash = await HashManager.calculateFileHash(fileRecord.file_path);
                        await fileTracker.markFileAsCompleted(fileRecord.file_path, hash);
                        this.progress.successful++;
                    } else if (result.duplicate) {
                        // Extract hash if available
                        const hash = result.error?.match(/Hash: ([a-f0-9]+)/)?.[1];
                        await fileTracker.markFileAsCompleted(fileRecord.file_path, hash);
                        this.progress.successful++;
                    } else {
                        await fileTracker.markFileAsFailed(fileRecord.file_path, result.error || 'Unknown error');
                        this.progress.failed++;
                    }
                    
                    this.progress.processed++;
                    
                    // Log progress every 10 files
                    if (this.progress.processed % 10 === 0) {
                        logger.info(`${logPrefix} Progress: ${this.progress.processed}/${this.progress.total} (${Math.round(this.progress.processed / this.progress.total * 100)}%)`);
                    }
                    
                    return result;
                } catch (error) {
                    logger.error(`${logPrefix} Failed to process ${fileRecord.file_path}:`, error);
                    this.progress.failed++;
                    this.progress.processed++;
                    
                    await fileTracker.markFileAsFailed(
                        fileRecord.file_path, 
                        error instanceof Error ? error.message : String(error)
                    );
                    
                    throw error;
                }
            });

            // Wait for all files to be processed
            const results = await Promise.allSettled(processingPromises);
            
            logger.info(`${logPrefix} Scan completed: ${this.progress.successful} successful, ${this.progress.failed} failed`);
            
            // Log worker pool stats
            const poolStats = this.workerPool.getStats();
            logger.info(`${logPrefix} Worker pool stats:`, poolStats);
            
            return this.progress;
        } catch (error) {
            logger.error(`${logPrefix} Scan failed:`, error);
            throw error;
        }
    }

    /**
     * Get current scan progress
     */
    getProgress(): ScanProgress {
        return { ...this.progress };
    }

    /**
     * Shutdown the scanner
     */
    async shutdown(): Promise<void> {
        if (this.isInitialized) {
            logger.info('[WorkerScanner] Shutting down worker pool...');
            await this.workerPool.shutdown();
            this.isInitialized = false;
        }
    }
}

// Singleton instance
export const workerScanner = new WorkerBasedScanner();