import { Logger } from '../logger';
import { Start, Status } from '../scanner/scan';
import { Request, Response } from 'express';
import { DataMigrator } from '../util/migrate-to-db';
import { jobQueue } from '../util/job-queue';

import dotenv from 'dotenv';

dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const logger = Logger.getInstance();
const MEDIA_SOURCE_DIR = process.env.media_source_dir || '';
const MEDIA_DEST_DIR = process.env.media_dest_dir || '';

export const ScanStartResolver = async (request: Request, response: Response) => {
    try {
        const limit = request.query.limit ? parseInt(request.query.limit as string) : undefined;
        const async = request.query.async === 'true'; // Check if async mode is requested
        
        if (async) {
            // Use background job system
            logger.info(`Starting async scan job with limit: ${limit || 'unlimited'}`);
            
            const jobId = jobQueue.addJob('scan', {
                sourceDir: MEDIA_SOURCE_DIR,
                destDir: MEDIA_DEST_DIR,
                limit,
                recursive: true
            }, {
                priority: 5, // High priority for scan jobs
                maxRetries: 1 // Don't retry scan jobs
            });

            response.send({
                success: true,
                jobId,
                message: 'Scan job started in background',
                statusUrl: `/api/jobs/${jobId}`
            });
            
        } else {
            // Original synchronous behavior
            logger.info(`Starting synchronous scan with limit: ${limit || 'unlimited'}`);
            
            // Step 1: Run the scan to process images and extract faces
            const scanResults = await Start(MEDIA_SOURCE_DIR, MEDIA_DEST_DIR, limit);
            
            logger.info('Scan completed, starting automatic database migration...');
            
            // Step 2: Automatically migrate processed data to database
            try {
                await DataMigrator.migrateProcessedData(MEDIA_SOURCE_DIR, MEDIA_DEST_DIR);
                logger.info('Database migration completed successfully');
            } catch (migrationError: any) {
                logger.error('Database migration failed: ' + migrationError);
                // Don't fail the whole operation, just log the error
            }
            
            // Step 3: Auto-recognize faces is DISABLED per user request
            // Automatic face recognition has been disabled to prevent mismatches
            // All face assignments must be done manually through the UI
            let autoRecognitionResults = null;
            logger.info('Automatic face recognition is disabled - all faces must be manually reviewed');
            
            // Step 4: Return scan results with migration and auto-recognition status
            response.send({
                scanResults,
                message: 'Scan, database import, and auto-recognition completed',
                migrationStatus: 'completed',
                autoRecognitionResults: autoRecognitionResults || { message: 'No auto-recognition performed' }
            });
        }
        
    } catch (error: any) {
        logger.error('Scan process failed: ' + error);
        response.status(500).send({
            error: 'Scan failed',
            message: error.message
        });
    }
};

export const ScanStatusResolver = async (request: Request, response: Response) => {
    const res = await Status();
    response.send(res);
};
