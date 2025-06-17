import { Job, JobHandler, jobQueue } from '../util/job-queue';
import { StartHashed as startScanHashed } from '../scanner/scan';
import { Logger } from '../logger';
import { invalidateGalleryCache } from '../util/cache';
import { DataMigrator } from '../util/migrate-to-db';
import { configManager } from '../util/config-manager';

const logger = Logger.getInstance();

export interface ScanJobData {
    sourceDir?: string;
    limit?: number;
    recursive?: boolean;
}

export const scanJobHandler: JobHandler<ScanJobData> = async (
    job: Job<ScanJobData>,
    updateProgress
) => {
    const { sourceDir, limit, recursive = true } = job.data;
    
    logger.info(`Starting hash-based scan job ${job.id} with limit: ${limit || 'unlimited'}`);
    updateProgress(5, 'Initializing hash-based scan...');

    try {
        updateProgress(10, 'Starting photo processing...');
        
        // Hash-based processing with direct database integration
        const result = await startScanHashed(
            sourceDir || configManager.getStorage().sourceDir,
            limit || undefined
        );
        
        updateProgress(90, `Hash-based scan completed (${result.processed} new images), starting thumbnail generation...`);
        
        if (result.processed > 0) {
            // Start thumbnail generation in background for newly processed images
            try {
                const thumbnailJobId = jobQueue.addJob('thumbnail', {
                    limit: 100, // Process up to 100 thumbnails
                    overwrite: false // Only generate for images without thumbnails
                }, {
                    priority: 1, // Low priority - thumbnails can wait
                    maxRetries: 1
                });
                
                updateProgress(95, `Thumbnail generation job queued (${thumbnailJobId})`);
                logger.info(`Queued thumbnail generation job ${thumbnailJobId} for scan job ${job.id}`);
            } catch (thumbnailError) {
                logger.error(`Failed to queue thumbnail generation for scan job ${job.id}: ${thumbnailError}`);
                updateProgress(95, 'Thumbnail generation failed to queue, but scan succeeded');
            }
        } else {
            updateProgress(95, 'Hash-based scan completed - no new images to process');
        }
        
        // Invalidate cache since new images were processed
        invalidateGalleryCache();
        
        updateProgress(100, 'Hash-based scan completed successfully');
        
        logger.info(`Hash-based scan job ${job.id} completed. Processed ${result.processed} images with ${result.errors} errors.`);
        
        return {
            processed: result.processed,
            errors: result.errors,
            migrationStatus: 'not_needed', // Data is already in database
            duration: Date.now() - job.createdAt.getTime(),
            processingMode: 'hash-based'
        };
        
    } catch (error) {
        logger.error(`Scan job ${job.id} failed: ${error}`);
        throw error;
    }
};