import { Request, Response } from 'express';
import * as jobsResolvers from '../resolvers/jobs';

/**
 * Start a scan job
 */
export const startScanJob = async (req: Request, res: Response) => {
    try {
        const result = await jobsResolvers.startScanJob(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start scan job'
        });
    }
};

/**
 * Start a face recognition job
 */
export const startFaceRecognitionJob = async (req: Request, res: Response) => {
    try {
        const result = await jobsResolvers.startFaceRecognitionJob(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start face recognition job'
        });
    }
};

/**
 * Start a thumbnail generation job
 */
export const startThumbnailJob = async (req: Request, res: Response) => {
    try {
        const result = await jobsResolvers.startThumbnailJob(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start thumbnail job'
        });
    }
};

/**
 * Get status of a specific job
 */
export const getJobStatus = async (req: Request, res: Response) => {
    try {
        const result = await jobsResolvers.getJobStatus(req.params.jobId);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get job status'
        });
    }
};

/**
 * Get all jobs with optional filtering
 */
export const getAllJobs = async (req: Request, res: Response) => {
    try {
        const result = await jobsResolvers.getAllJobs(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get jobs'
        });
    }
};

/**
 * Cancel a specific job
 */
export const cancelJob = async (req: Request, res: Response) => {
    try {
        const result = await jobsResolvers.cancelJob(req.params.jobId);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to cancel job'
        });
    }
};

/**
 * Get queue statistics
 */
export const getQueueStats = async (req: Request, res: Response) => {
    try {
        const result = await jobsResolvers.getQueueStats();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get queue stats'
        });
    }
};

/**
 * Clean up completed/failed jobs
 */
export const cleanupJobs = async (req: Request, res: Response) => {
    try {
        const result = await jobsResolvers.cleanupJobs(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to cleanup jobs'
        });
    }
};