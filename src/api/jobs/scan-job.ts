import { Job, JobHandler, jobQueue } from '../util/job-queue';
import { Start as startScan } from '../scanner/scan';
import { Logger } from '../logger';
import { invalidateGalleryCache } from '../util/cache';
import { DataMigrator } from '../util/migrate-to-db';

const logger = Logger.getInstance();

export interface ScanJobData {
    sourceDir?: string;
    destDir?: string;
    limit?: number;
    recursive?: boolean;
}

export const scanJobHandler: JobHandler<ScanJobData> = async (
    job: Job<ScanJobData>,
    updateProgress
) => {
    const { sourceDir, destDir, limit, recursive = true } = job.data;
    
    logger.info(`Starting scan job ${job.id} with limit: ${limit || 'unlimited'}`);
    updateProgress(5, 'Initializing scan...');

    try {
        // Track progress by wrapping the scan function
        let processed = 0;
        let total = 0;
        
        // For now, we'll estimate progress based on processed files
        // In a future enhancement, we could modify the scan function to accept progress callbacks
        
        updateProgress(10, 'Starting photo processing...');
        
        const result = await startScan(
            sourceDir || process.env.media_source_dir!,
            destDir || process.env.media_dest_dir!,
            limit || undefined
        );
        
        // Count total items processed across all batches
        const totalItemsProcessed = result.reduce((sum: number, batch: any) => {
            return sum + batch.filter((item: any) => item.status === 'fulfilled').length;
        }, 0);
        
        if (totalItemsProcessed > 0) {
            updateProgress(80, `Scan completed (${totalItemsProcessed} new images), starting database migration...`);
            
            // Migrate processed data to database
            try {
                await DataMigrator.migrateProcessedData(
                    sourceDir || process.env.media_source_dir!,
                    destDir || process.env.media_dest_dir!,
                    (progress, message) => {
                        // Progress during migration: 80% + (progress * 15%)
                        const migrationProgress = 80 + Math.round(progress * 0.15);
                        updateProgress(migrationProgress, message || 'Migrating to database...');
                    }
                );
                updateProgress(90, 'Database migration completed, starting thumbnail generation...');
                logger.info(`Database migration completed for scan job ${job.id}`);
                
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
            } catch (migrationError) {
                logger.error(`Database migration failed for scan job ${job.id}: ${migrationError}`);
                // Don't fail the whole job, just log the error
                updateProgress(95, 'Database migration failed, but scan succeeded');
            }
        } else {
            updateProgress(95, 'Scan completed - no new images to migrate');
            logger.info(`Scan job ${job.id} completed with no new images`);
        }
        
        // Invalidate cache since new images were processed
        invalidateGalleryCache();
        
        updateProgress(100, 'Scan and migration completed successfully');
        
        logger.info(`Scan job ${job.id} completed. Processed ${result.length} batches.`);
        
        return {
            processed: result.length,
            migrationStatus: 'completed',
            duration: Date.now() - job.createdAt.getTime()
        };
        
    } catch (error) {
        logger.error(`Scan job ${job.id} failed: ${error}`);
        throw error;
    }
};