import { Logger } from '../logger';
import { StartHashed, Status } from '../scanner/scan';
import { Request, Response } from 'express';
import { jobQueue } from '../util/job-queue';
import { configManager } from '../util/config-manager';
import { workerScanner } from '../scanner/scan-worker';

const logger = Logger.getInstance();

export const ScanStartResolver = async (request: Request, response: Response) => {
    try {
        const limit = request.query.limit ? parseInt(request.query.limit as string) : undefined;
        const async = request.query.async === 'true'; // Check if async mode is requested
        const useWorkers = request.query.workers !== 'false'; // Use workers by default
        
        if (useWorkers) {
            // Use worker-based scanning (recommended - truly non-blocking)
            logger.info(`Starting worker-based scan with limit: ${limit || 'unlimited'}`);
            
            // Start scan in background
            workerScanner.startScan(configManager.getStorage().sourceDir, limit)
                .then(result => {
                    logger.info(`Worker scan completed: ${result.successful} successful, ${result.failed} failed`);
                })
                .catch(error => {
                    logger.error('Worker scan failed:', error);
                });
            
            // Return immediately
            response.send({
                success: true,
                message: 'Worker-based scan started in background',
                mode: 'worker-based',
                statusUrl: '/scan/status'
            });
            
        } else if (async) {
            // Use background job system (legacy)
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
            // Direct hash-based processing (synchronous - not recommended)
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
    // Get status from original scanner
    const scanStatus = await Status();
    
    // Add worker scanner progress if available
    const workerProgress = workerScanner.getProgress();
    
    // Get auto scanner status if available
    let autoScannerStatus = null;
    if (process.env.AUTO_SCAN_ENABLED === 'true') {
        try {
            const { autoScanner } = await import('../util/auto-scanner');
            autoScannerStatus = autoScanner.getStatus();
        } catch (error) {
            // Auto scanner not available
        }
    }
    
    const fullStatus: any = {
        ...scanStatus,
        auto_scanner: autoScannerStatus
    };
    
    if (workerProgress.total > 0) {
        fullStatus.worker = {
            processed: workerProgress.processed,
            total: workerProgress.total,
            successful: workerProgress.successful,
            failed: workerProgress.failed,
            percentage: Math.round((workerProgress.processed / workerProgress.total) * 100),
            currentFile: workerProgress.currentFile
        };
    }
    
    response.send(fullStatus);
};
