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
export const startScanJob = async (data: ScanJobData) => {
    try {
        const { 
            sourceDir, 
            limit,
            recursive = true 
        } = data;

        const jobId = jobQueue.addJob('scan', {
            sourceDir,
            limit,
            recursive
        }, {
            priority: 5, // High priority for scan jobs
            maxRetries: 1 // Don't retry scan jobs
        });

        logger.info(`Started scan job ${jobId}`);

        return {
            success: true,
            jobId,
            message: 'Scan job started'
        };

    } catch (error) {
        logger.error(`Error starting scan job: ${error}`);
        throw new Error('Failed to start scan job');
    }
};

/**
 * Start a face recognition job
 */
export const startFaceRecognitionJob = async (data: FaceRecognitionJobData) => {
    try {
        const { 
            limit = 50,
            confidenceThreshold = 0.75,
            imageIds 
        } = data;

        const jobId = jobQueue.addJob('face-recognition', {
            limit,
            confidenceThreshold,
            imageIds
        }, {
            priority: 3, // Medium priority
            maxRetries: 2
        });

        logger.info(`Started face recognition job ${jobId}`);

        return {
            success: true,
            jobId,
            message: 'Face recognition job started'
        };

    } catch (error) {
        logger.error(`Error starting face recognition job: ${error}`);
        throw new Error('Failed to start face recognition job');
    }
};

/**
 * Start a thumbnail generation job
 */
export const startThumbnailJob = async (data: ThumbnailJobData) => {
    try {
        const { 
            imageIds,
            limit = 100,
            overwrite = false
        } = data;

        const jobId = jobQueue.addJob('thumbnail', {
            imageIds,
            limit,
            overwrite
        }, {
            priority: 2, // Lower priority than scans and face recognition
            maxRetries: 1 // Don't retry thumbnail jobs much
        });

        logger.info(`Started thumbnail generation job ${jobId}`);

        return {
            success: true,
            jobId,
            message: 'Thumbnail generation job started'
        };

    } catch (error) {
        logger.error(`Error starting thumbnail job: ${error}`);
        throw new Error('Failed to start thumbnail job');
    }
};

/**
 * Get job status
 */
export const getJobStatus = async (jobId: string) => {
    try {
        const job = jobQueue.getJob(jobId);

        if (!job) {
            throw new Error('Job not found');
        }

        return {
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
        };

    } catch (error) {
        logger.error(`Error getting job status: ${error}`);
        if (error instanceof Error && error.message === 'Job not found') {
            throw error;
        }
        throw new Error('Failed to get job status');
    }
};

/**
 * Get all jobs (optionally filtered by status)
 */
export const getAllJobs = async (filters: { status?: any; limit?: number } = {}) => {
    try {
        const { status, limit = 50 } = filters;
        
        let jobs = jobQueue.getJobs(status);
        
        // Sort by creation time (newest first) and limit
        jobs = jobs
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, Number(limit));

        return {
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
        };

    } catch (error) {
        logger.error(`Error getting jobs: ${error}`);
        throw new Error('Failed to get jobs');
    }
};

/**
 * Cancel a pending job
 */
export const cancelJob = async (jobId: string) => {
    try {
        const success = jobQueue.cancelJob(jobId);

        if (!success) {
            throw new Error('Job not found or cannot be cancelled');
        }

        logger.info(`Cancelled job ${jobId}`);

        return {
            success: true,
            message: 'Job cancelled successfully'
        };

    } catch (error) {
        logger.error(`Error cancelling job: ${error}`);
        if (error instanceof Error && error.message === 'Job not found or cannot be cancelled') {
            throw error;
        }
        throw new Error('Failed to cancel job');
    }
};

/**
 * Get queue statistics
 */
export const getQueueStats = async () => {
    try {
        const stats = jobQueue.getStats();

        return {
            success: true,
            stats
        };

    } catch (error) {
        logger.error(`Error getting queue stats: ${error}`);
        throw new Error('Failed to get queue stats');
    }
};

/**
 * Clean up old jobs
 */
export const cleanupJobs = async (options: { olderThanHours?: number } = {}) => {
    try {
        const { olderThanHours = 24 } = options;
        const cleaned = jobQueue.cleanup(Number(olderThanHours));

        logger.info(`Cleaned up ${cleaned} old jobs`);

        return {
            success: true,
            cleaned,
            message: `Cleaned up ${cleaned} old jobs`
        };

    } catch (error) {
        logger.error(`Error cleaning up jobs: ${error}`);
        throw new Error('Failed to clean up jobs');
    }
};