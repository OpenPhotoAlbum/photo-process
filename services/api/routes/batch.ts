import { Request, Response } from 'express';
import { batchProcessor, JobPriority } from '../util/batch-processor';
import { parallelScanner } from '../util/parallel-scanner';
import { logger as structuredLogger } from '../util/structured-logger';
import { configManager } from '../util/config-manager';
import fs from 'fs';

/**
 * Get batch processing queue statistics
 */
export const getQueueStats = async (req: Request, res: Response) => {
    try {
        const stats = batchProcessor.getQueueStats();
        const scannerStats = parallelScanner.getProcessingStats();
        
        res.json({
            success: true,
            queue: stats,
            processing: scannerStats,
            config: {
                maxWorkers: 4, // Default workers for batch processing
                maxConcurrentFiles: 4, // Default concurrent file limit
                defaultBatchSize: configManager.getServer()?.scanBatchSize || 2
            }
        });
    } catch (error) {
        structuredLogger.error('Failed to get queue stats', {
            type: 'api',
            action: 'get_queue_stats_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to get queue statistics'
        });
    }
};

/**
 * Get information about a specific batch job
 */
export const getJob = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const job = batchProcessor.getJob(jobId);
        
        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }
        
        res.json({
            success: true,
            job: {
                id: job.id,
                type: job.type,
                status: job.status,
                priority: job.priority,
                progress: job.progress,
                totalItems: job.totalItems,
                processedItems: job.processedItems,
                failedItems: job.failedItems,
                estimatedTimeRemaining: job.estimatedTimeRemaining,
                createdAt: job.createdAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                errors: job.errors
            }
        });
    } catch (error) {
        structuredLogger.error('Failed to get job', {
            type: 'api',
            action: 'get_job_error',
            jobId: req.params.jobId,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to get job information'
        });
    }
};

/**
 * Get list of batch jobs with optional filtering
 */
export const listJobs = async (req: Request, res: Response) => {
    try {
        const status = req.query.status as string;
        const type = req.query.type as string;
        const limit = parseInt(req.query.limit as string) || 50;
        
        const jobs = batchProcessor.getJobs({
            status: status as any,
            type: type as any,
            limit
        });
        
        res.json({
            success: true,
            jobs: jobs.map(job => ({
                id: job.id,
                type: job.type,
                status: job.status,
                priority: job.priority,
                progress: job.progress,
                totalItems: job.totalItems,
                processedItems: job.processedItems,
                failedItems: job.failedItems,
                createdAt: job.createdAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                errorCount: job.errors.length
            })),
            count: jobs.length
        });
    } catch (error) {
        structuredLogger.error('Failed to list jobs', {
            type: 'api',
            action: 'list_jobs_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to list jobs'
        });
    }
};

/**
 * Cancel a batch job
 */
export const cancelJob = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const cancelled = batchProcessor.cancelJob(jobId);
        
        if (!cancelled) {
            return res.status(404).json({
                success: false,
                error: 'Job not found or cannot be cancelled'
            });
        }
        
        structuredLogger.info('Batch job cancelled', {
            type: 'batch_processor',
            action: 'job_cancelled',
            jobId
        });
        
        res.json({
            success: true,
            message: 'Job cancelled successfully'
        });
    } catch (error) {
        structuredLogger.error('Failed to cancel job', {
            type: 'api',
            action: 'cancel_job_error',
            jobId: req.params.jobId,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to cancel job'
        });
    }
};

/**
 * Start a parallel directory scan
 */
export const startDirectoryScan = async (req: Request, res: Response) => {
    try {
        const { 
            directory, 
            batchSize, 
            maxConcurrentFiles, 
            priority, 
            skipExisting 
        } = req.body;
        
        if (!directory) {
            return res.status(400).json({
                success: false,
                error: 'Directory path is required'
            });
        }
        
        // Validate directory exists
        if (!fs.existsSync(directory)) {
            return res.status(400).json({
                success: false,
                error: 'Directory does not exist'
            });
        }
        
        const options = {
            batchSize: batchSize || 8,
            maxConcurrentFiles: maxConcurrentFiles || 4,
            priority: priority || JobPriority.NORMAL,
            skipExisting: skipExisting !== false
        };
        
        structuredLogger.info('Starting parallel directory scan', {
            type: 'batch_processor',
            action: 'directory_scan_start',
            directory,
            options
        });
        
        // Start the scan (don't await - return immediately with job info)
        const scanPromise = parallelScanner.scanDirectory(directory, options);
        
        res.json({
            success: true,
            message: 'Directory scan started',
            directory,
            options,
            // Note: In a real implementation, you'd return a job ID to track progress
            status: 'Scan started - check logs for progress'
        });
        
        // Handle the scan result asynchronously
        scanPromise
            .then(result => {
                structuredLogger.info('Directory scan completed', {
                    type: 'batch_processor',
                    action: 'directory_scan_complete',
                    directory,
                    ...result
                });
            })
            .catch(error => {
                structuredLogger.error('Directory scan failed', {
                    type: 'batch_processor',
                    action: 'directory_scan_error',
                    directory,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            });
            
    } catch (error) {
        structuredLogger.error('Failed to start directory scan', {
            type: 'api',
            action: 'start_directory_scan_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to start directory scan'
        });
    }
};

/**
 * Process a batch of specific files
 */
export const processBatchFiles = async (req: Request, res: Response) => {
    try {
        const { 
            filePaths, 
            batchSize, 
            maxConcurrentFiles, 
            priority 
        } = req.body;
        
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'File paths array is required'
            });
        }
        
        const options = {
            batchSize: batchSize || 8,
            maxConcurrentFiles: maxConcurrentFiles || 4,
            priority: priority || JobPriority.NORMAL,
            skipExisting: true
        };
        
        const result = await parallelScanner.processFiles(filePaths, options);
        
        res.json({
            success: true,
            result,
            message: `Processed ${result.processedFiles} files in ${result.processingTime}ms`
        });
        
    } catch (error) {
        structuredLogger.error('Failed to process batch files', {
            type: 'api',
            action: 'process_batch_files_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to process batch files'
        });
    }
};

/**
 * Process smart albums for multiple images
 */
export const processBatchSmartAlbums = async (req: Request, res: Response) => {
    try {
        const { imageIds, batchSize } = req.body;
        
        if (!Array.isArray(imageIds) || imageIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Image IDs array is required'
            });
        }
        
        const jobId = batchProcessor.addJob(
            'smart_albums',
            { 
                imageIds,
                batchSize: batchSize || 8
            },
            JobPriority.NORMAL,
            imageIds.length
        );
        
        res.json({
            success: true,
            jobId,
            message: `Started smart album processing for ${imageIds.length} images`,
            imageCount: imageIds.length
        });
        
    } catch (error) {
        structuredLogger.error('Failed to process batch smart albums', {
            type: 'api',
            action: 'process_batch_smart_albums_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to process batch smart albums'
        });
    }
};

/**
 * Clean up old completed jobs
 */
export const cleanupJobs = async (req: Request, res: Response) => {
    try {
        const olderThanHours = parseInt(req.query.hours as string) || 24;
        const cleaned = batchProcessor.cleanupJobs(olderThanHours);
        
        res.json({
            success: true,
            cleanedJobs: cleaned,
            message: `Cleaned up ${cleaned} jobs older than ${olderThanHours} hours`
        });
        
    } catch (error) {
        structuredLogger.error('Failed to cleanup jobs', {
            type: 'api',
            action: 'cleanup_jobs_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup jobs'
        });
    }
};

/**
 * Get real-time processing metrics
 */
export const getProcessingMetrics = async (req: Request, res: Response) => {
    try {
        const stats = parallelScanner.getProcessingStats();
        
        res.json({
            success: true,
            metrics: {
                ...stats,
                timestamp: new Date().toISOString(),
                systemLoad: process.cpuUsage(),
                memoryUsage: process.memoryUsage()
            }
        });
        
    } catch (error) {
        structuredLogger.error('Failed to get processing metrics', {
            type: 'api',
            action: 'get_processing_metrics_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to get processing metrics'
        });
    }
};