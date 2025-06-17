import { Request, Response } from 'express';
import { jobQueue } from '../util/job-queue';
import { scanJobHandler, ScanJobData } from '../jobs/scan-job';
import { faceRecognitionJobHandler, FaceRecognitionJobData } from '../jobs/face-recognition-job';
import { thumbnailJobHandler, ThumbnailJobData } from '../jobs/thumbnail-job';
import { Logger } from '../logger';

const logger = Logger.getInstance();

// Register job handlers
jobQueue.registerHandler('scan', scanJobHandler);
jobQueue.registerHandler('face-recognition', faceRecognitionJobHandler);
jobQueue.registerHandler('thumbnail', thumbnailJobHandler);

/**
 * Start a scan job
 */
export const startScanJob = async (req: Request, res: Response) => {
    try {
        const { 
            sourceDir, 
            limit,
            recursive = true 
        } = req.body as ScanJobData;

        const jobId = jobQueue.addJob('scan', {
            sourceDir,
            limit,
            recursive
        }, {
            priority: 5, // High priority for scan jobs
            maxRetries: 1 // Don't retry scan jobs
        });

        logger.info(`Started scan job ${jobId}`);

        res.json({
            success: true,
            jobId,
            message: 'Scan job started'
        });

    } catch (error) {
        logger.error(`Error starting scan job: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to start scan job'
        });
    }
};

/**
 * Start a face recognition job
 */
export const startFaceRecognitionJob = async (req: Request, res: Response) => {
    try {
        const { 
            limit = 50,
            confidenceThreshold = 0.75,
            imageIds 
        } = req.body as FaceRecognitionJobData;

        const jobId = jobQueue.addJob('face-recognition', {
            limit,
            confidenceThreshold,
            imageIds
        }, {
            priority: 3, // Medium priority
            maxRetries: 2
        });

        logger.info(`Started face recognition job ${jobId}`);

        res.json({
            success: true,
            jobId,
            message: 'Face recognition job started'
        });

    } catch (error) {
        logger.error(`Error starting face recognition job: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to start face recognition job'
        });
    }
};

/**
 * Start a thumbnail generation job
 */
export const startThumbnailJob = async (req: Request, res: Response) => {
    try {
        const { 
            imageIds,
            limit = 100,
            overwrite = false
        } = req.body as ThumbnailJobData;

        const jobId = jobQueue.addJob('thumbnail', {
            imageIds,
            limit,
            overwrite
        }, {
            priority: 2, // Lower priority than scans and face recognition
            maxRetries: 1 // Don't retry thumbnail jobs much
        });

        logger.info(`Started thumbnail generation job ${jobId}`);

        res.json({
            success: true,
            jobId,
            message: 'Thumbnail generation job started'
        });

    } catch (error) {
        logger.error(`Error starting thumbnail job: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to start thumbnail job'
        });
    }
};

/**
 * Get job status
 */
export const getJobStatus = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const job = jobQueue.getJob(jobId);

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
                progress: job.progress,
                result: job.result,
                error: job.error,
                createdAt: job.createdAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                retries: job.retries,
                maxRetries: job.maxRetries
            }
        });

    } catch (error) {
        logger.error(`Error getting job status: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to get job status'
        });
    }
};

/**
 * Get all jobs (optionally filtered by status)
 */
export const getAllJobs = async (req: Request, res: Response) => {
    try {
        const { status, limit = 50 } = req.query;
        
        let jobs = jobQueue.getJobs(status as any);
        
        // Sort by creation time (newest first) and limit
        jobs = jobs
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, Number(limit));

        res.json({
            success: true,
            jobs: jobs.map(job => ({
                id: job.id,
                type: job.type,
                status: job.status,
                progress: job.progress,
                createdAt: job.createdAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                retries: job.retries,
                error: job.error ? job.error.substring(0, 200) : undefined // Truncate long errors
            }))
        });

    } catch (error) {
        logger.error(`Error getting jobs: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to get jobs'
        });
    }
};

/**
 * Cancel a pending job
 */
export const cancelJob = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const success = jobQueue.cancelJob(jobId);

        if (!success) {
            return res.status(400).json({
                success: false,
                error: 'Job not found or cannot be cancelled'
            });
        }

        logger.info(`Cancelled job ${jobId}`);

        res.json({
            success: true,
            message: 'Job cancelled successfully'
        });

    } catch (error) {
        logger.error(`Error cancelling job: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel job'
        });
    }
};

/**
 * Get queue statistics
 */
export const getQueueStats = async (req: Request, res: Response) => {
    try {
        const stats = jobQueue.getStats();

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        logger.error(`Error getting queue stats: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to get queue stats'
        });
    }
};

/**
 * Clean up old jobs
 */
export const cleanupJobs = async (req: Request, res: Response) => {
    try {
        const { olderThanHours = 24 } = req.body;
        const cleaned = jobQueue.cleanup(Number(olderThanHours));

        logger.info(`Cleaned up ${cleaned} old jobs`);

        res.json({
            success: true,
            cleaned,
            message: `Cleaned up ${cleaned} old jobs`
        });

    } catch (error) {
        logger.error(`Error cleaning up jobs: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Failed to clean up jobs'
        });
    }
};