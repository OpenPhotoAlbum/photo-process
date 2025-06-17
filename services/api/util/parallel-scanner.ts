import fs from 'fs';
import path from 'path';
import { batchProcessor, JobPriority } from './batch-processor';
import { logger as structuredLogger } from './structured-logger';
import { configManager } from './config-manager';
import { ImageRepository } from '../models/database';

export interface ScanOptions {
    maxConcurrentFiles: number;
    batchSize: number;
    priority: JobPriority;
    skipExisting: boolean;
    fileTypes: string[];
    progressCallback?: (progress: ScanProgress) => void;
}

export interface ScanProgress {
    totalFiles: number;
    processedFiles: number;
    successfulFiles: number;
    failedFiles: number;
    currentBatch: number;
    totalBatches: number;
    processingRate: number; // files per second
    estimatedTimeRemaining: number; // milliseconds
    errors: string[];
}

export interface ScanResult {
    totalFiles: number;
    processedFiles: number;
    successfulFiles: number;
    skippedFiles: number;
    failedFiles: number;
    processingTime: number;
    jobIds: string[];
    errors: string[];
}

export class ParallelScanner {
    private defaultOptions: ScanOptions = {
        maxConcurrentFiles: 4, // Default concurrent file processing limit
        batchSize: configManager.getServer()?.scanBatchSize || 2,
        priority: JobPriority.NORMAL,
        skipExisting: true,
        fileTypes: ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp', '.heic'],
        progressCallback: undefined
    };

    /**
     * Scan and process a directory with parallel processing
     */
    async scanDirectory(
        sourceDir: string, 
        options: Partial<ScanOptions> = {}
    ): Promise<ScanResult> {
        const opts = { ...this.defaultOptions, ...options };
        const startTime = Date.now();

        structuredLogger.info('Starting parallel directory scan', {
            type: 'parallel_scanner',
            action: 'scan_start',
            sourceDir,
            options: opts
        });

        try {
            // 1. Discover all image files
            const allFiles = await this.discoverFiles(sourceDir, opts.fileTypes);
            
            if (allFiles.length === 0) {
                return {
                    totalFiles: 0,
                    processedFiles: 0,
                    successfulFiles: 0,
                    skippedFiles: 0,
                    failedFiles: 0,
                    processingTime: Date.now() - startTime,
                    jobIds: [],
                    errors: []
                };
            }

            // 2. Filter out already processed files if skipExisting is true
            const filesToProcess = opts.skipExisting 
                ? await this.filterUnprocessedFiles(allFiles)
                : allFiles;

            if (filesToProcess.length === 0) {
                structuredLogger.info('All files already processed', {
                    type: 'parallel_scanner',
                    action: 'scan_complete',
                    totalFiles: allFiles.length,
                    skippedFiles: allFiles.length
                });

                return {
                    totalFiles: allFiles.length,
                    processedFiles: 0,
                    successfulFiles: 0,
                    skippedFiles: allFiles.length,
                    failedFiles: 0,
                    processingTime: Date.now() - startTime,
                    jobIds: [],
                    errors: []
                };
            }

            // 3. Create batches for parallel processing
            const batches = this.createBatches(filesToProcess, opts.batchSize);
            
            // 4. Submit batch jobs
            const jobIds = await this.submitBatchJobs(batches, opts);

            // 5. Monitor progress and collect results
            const result = await this.monitorJobs(jobIds, allFiles.length, opts);
            
            result.processingTime = Date.now() - startTime;
            result.jobIds = jobIds;

            structuredLogger.info('Parallel scan completed', {
                type: 'parallel_scanner',
                action: 'scan_complete',
                ...result
            });

            return result;

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            
            structuredLogger.error('Parallel scan failed', {
                type: 'parallel_scanner',
                action: 'scan_error',
                sourceDir,
                error: errorMsg
            });

            throw error;
        }
    }

    /**
     * Process a specific list of files with parallel processing
     */
    async processFiles(
        filePaths: string[],
        options: Partial<ScanOptions> = {}
    ): Promise<ScanResult> {
        const opts = { ...this.defaultOptions, ...options };
        const startTime = Date.now();

        // Filter out already processed files if requested
        const filesToProcess = opts.skipExisting 
            ? await this.filterUnprocessedFiles(filePaths)
            : filePaths;

        if (filesToProcess.length === 0) {
            return {
                totalFiles: filePaths.length,
                processedFiles: 0,
                successfulFiles: 0,
                skippedFiles: filePaths.length,
                failedFiles: 0,
                processingTime: Date.now() - startTime,
                jobIds: [],
                errors: []
            };
        }

        // Create batches and submit jobs
        const batches = this.createBatches(filesToProcess, opts.batchSize);
        const jobIds = await this.submitBatchJobs(batches, opts);

        // Monitor and return results
        const result = await this.monitorJobs(jobIds, filePaths.length, opts);
        result.processingTime = Date.now() - startTime;
        result.jobIds = jobIds;

        return result;
    }

    /**
     * Get real-time processing statistics
     */
    getProcessingStats() {
        const stats = batchProcessor.getQueueStats();
        
        return {
            ...stats,
            processingRate: this.calculateProcessingRate(),
            avgJobDuration: this.calculateAverageJobDuration()
        };
    }

    private async discoverFiles(
        directory: string, 
        fileTypes: string[]
    ): Promise<string[]> {
        const files: string[] = [];
        
        const processDirectory = async (dir: string) => {
            try {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        await processDirectory(fullPath);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (fileTypes.includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                // Log but don't fail the entire scan for permission errors
                structuredLogger.warn('Failed to read directory', {
                    type: 'parallel_scanner',
                    action: 'directory_error',
                    directory: dir,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        };

        await processDirectory(directory);
        
        return files.sort(); // Sort for consistent processing order
    }

    private async filterUnprocessedFiles(filePaths: string[]): Promise<string[]> {
        const unprocessedFiles: string[] = [];
        
        // Check in batches to avoid overwhelming the database
        const checkBatchSize = 100;
        
        for (let i = 0; i < filePaths.length; i += checkBatchSize) {
            const batch = filePaths.slice(i, i + checkBatchSize);
            const batchResults = await Promise.all(
                batch.map(async (filePath) => {
                    try {
                        const existing = await ImageRepository.findByPath(filePath);
                        return existing ? null : filePath;
                    } catch (error) {
                        // If we can't check, assume it needs processing
                        return filePath;
                    }
                })
            );
            
            unprocessedFiles.push(...batchResults.filter(Boolean) as string[]);
        }
        
        return unprocessedFiles;
    }

    private createBatches(files: string[], batchSize: number): string[][] {
        const batches: string[][] = [];
        
        for (let i = 0; i < files.length; i += batchSize) {
            batches.push(files.slice(i, i + batchSize));
        }
        
        return batches;
    }

    private async submitBatchJobs(
        batches: string[][],
        options: ScanOptions
    ): Promise<string[]> {
        const jobIds: string[] = [];
        
        for (const batch of batches) {
            const jobId = batchProcessor.addJob(
                'image_processing',
                {
                    filePaths: batch,
                    batchSize: Math.min(batch.length, options.maxConcurrentFiles)
                },
                options.priority,
                batch.length
            );
            
            jobIds.push(jobId);
        }
        
        return jobIds;
    }

    private async monitorJobs(
        jobIds: string[],
        totalFiles: number,
        options: ScanOptions
    ): Promise<ScanResult> {
        const result: ScanResult = {
            totalFiles,
            processedFiles: 0,
            successfulFiles: 0,
            skippedFiles: 0,
            failedFiles: 0,
            processingTime: 0,
            jobIds: [],
            errors: []
        };

        const startTime = Date.now();
        let lastProgressTime = startTime;
        let lastProcessedCount = 0;

        return new Promise((resolve, reject) => {
            const checkProgress = () => {
                const jobs = jobIds.map(id => batchProcessor.getJob(id)).filter(Boolean);
                const allCompleted = jobs.every(job => 
                    job!.status === 'completed' || 
                    job!.status === 'failed' || 
                    job!.status === 'cancelled'
                );

                // Aggregate results from all jobs
                let totalProcessed = 0;
                let totalSuccessful = 0;
                let totalFailed = 0;
                const allErrors: string[] = [];

                for (const job of jobs) {
                    if (job) {
                        totalProcessed += job.processedItems;
                        
                        if (job.status === 'completed' && job.data.result) {
                            totalSuccessful += job.data.result.successful?.length || 0;
                            totalFailed += job.data.result.failed?.length || 0;
                            allErrors.push(...(job.data.result.errors || []));
                        } else if (job.status === 'failed') {
                            totalFailed += job.totalItems;
                            allErrors.push(...job.errors);
                        }
                    }
                }

                result.processedFiles = totalProcessed;
                result.successfulFiles = totalSuccessful;
                result.failedFiles = totalFailed;
                result.errors = allErrors;

                // Calculate processing rate
                const currentTime = Date.now();
                const timeDelta = currentTime - lastProgressTime;
                const processedDelta = totalProcessed - lastProcessedCount;
                
                if (timeDelta > 0) {
                    const processingRate = (processedDelta / timeDelta) * 1000; // files per second
                    const estimatedTimeRemaining = (totalFiles - totalProcessed) / Math.max(processingRate, 0.1);
                    
                    // Send progress update if callback provided
                    if (options.progressCallback) {
                        const progress: ScanProgress = {
                            totalFiles,
                            processedFiles: totalProcessed,
                            successfulFiles: totalSuccessful,
                            failedFiles: totalFailed,
                            currentBatch: Math.ceil(totalProcessed / (options.batchSize || 8)),
                            totalBatches: jobIds.length,
                            processingRate,
                            estimatedTimeRemaining,
                            errors: allErrors
                        };
                        
                        options.progressCallback(progress);
                    }

                    lastProgressTime = currentTime;
                    lastProcessedCount = totalProcessed;
                }

                if (allCompleted) {
                    resolve(result);
                } else {
                    // Check again in 500ms
                    setTimeout(checkProgress, 500);
                }
            };

            // Start monitoring
            checkProgress();

            // Set overall timeout (30 minutes)
            setTimeout(() => {
                reject(new Error('Batch processing timeout after 30 minutes'));
            }, 30 * 60 * 1000);
        });
    }

    private calculateProcessingRate(): number {
        // This would track recent job completion times
        // For now, return a placeholder
        return 0;
    }

    private calculateAverageJobDuration(): number {
        // This would track job durations
        // For now, return a placeholder
        return 0;
    }
}

// Export singleton instance
export const parallelScanner = new ParallelScanner();