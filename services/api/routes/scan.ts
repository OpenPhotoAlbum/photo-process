import { Logger } from '../logger';
import { StartHashed, Status } from '../scanner/scan';
import { Request, Response } from 'express';
import { jobQueue } from '../util/job-queue';
import { configManager } from '../util/config-manager';

const logger = Logger.getInstance();

export const ScanStartResolver = async (request: Request, response: Response) => {
    try {
        const limit = request.query.limit ? parseInt(request.query.limit as string) : undefined;
        const async = request.query.async === 'true'; // Check if async mode is requested
        
        if (async) {
            // Use background job system (recommended)
            logger.info(`Starting async hash-based scan job with limit: ${limit || 'unlimited'}`);
            
            const jobId = jobQueue.addJob('scan', {
                sourceDir: configManager.getStorage().sourceDir,
                limit,
                recursive: true
            }, {
                priority: 5, // High priority for scan jobs
                maxRetries: 1 // Don't retry scan jobs
            });

            response.send({
                success: true,
                jobId,
                message: 'Hash-based scan job started in background',
                statusUrl: `/api/jobs/${jobId}`,
                mode: 'hash-based'
            });
            
        } else {
            // Direct hash-based processing (synchronous)
            logger.info(`Starting synchronous hash-based scan with limit: ${limit || 'unlimited'}`);
            
            const scanResults = await StartHashed(configManager.getStorage().sourceDir, limit);
            
            logger.info(`Hash-based scan completed. Processed ${scanResults.processed} images with ${scanResults.errors} errors`);
            
            response.send({
                success: true,
                processed: scanResults.processed,
                errors: scanResults.errors,
                message: 'Hash-based scan completed - data stored directly in database',
                mode: 'hash-based'
            });
        }
        
    } catch (error: any) {
        logger.error('Hash-based scan process failed: ' + error);
        response.status(500).send({
            error: 'Hash-based scan failed',
            message: error.message
        });
    }
};

export const ScanStatusResolver = async (request: Request, response: Response) => {
    const res = await Status();
    response.send(res);
};
