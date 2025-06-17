import { Job, JobHandler } from '../util/job-queue';
import { Logger } from '../logger';
import { ImageRepository } from '../models/database';
import { Image } from '../util/image';
import fs from 'fs';
import path from 'path';
import config from '../config';

const logger = Logger.getInstance();

export interface ThumbnailJobData {
    imageIds?: number[];
    limit?: number;
    overwrite?: boolean;
}

export const thumbnailJobHandler: JobHandler<ThumbnailJobData> = async (
    job: Job<ThumbnailJobData>, 
    updateProgress: (progress: number, message?: string) => void
) => {
    try {
        const { imageIds, limit, overwrite = false } = job.data;
        
        logger.info(`Starting thumbnail generation job ${job.id}`);
        updateProgress(0, 'Fetching images to process...');
        
        // Get images that need thumbnails
        let images;
        if (imageIds && imageIds.length > 0) {
            // Process specific images
            images = await Promise.all(
                imageIds.map(id => ImageRepository.findById(id))
            );
            images = images.filter(img => img !== null) as any[];
        } else {
            // Process images without thumbnails (or all if overwrite is true)
            if (overwrite) {
                images = await ImageRepository.findMany({}, limit || 100);
            } else {
                // Get images where thumbnail_path is null or undefined
                images = await ImageRepository.findMany({}, limit || 100);
                images = images.filter(img => !img.thumbnail_path);
            }
        }
        
        if (images.length === 0) {
            updateProgress(100, 'No images need thumbnail generation');
            return { processed: 0, skipped: 0 };
        }
        
        logger.info(`Processing thumbnails for ${images.length} images`);
        
        let processed = 0;
        let skipped = 0;
        let errors = 0;
        
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            if (!image || !image.id) {
                errors++;
                continue;
            }
            
            const progress = Math.round((i / images.length) * 100);
            
            try {
                updateProgress(progress, `Processing ${image.filename}...`);
                
                // Skip if thumbnail already exists and not overwriting
                if (!overwrite && image.thumbnail_path && fs.existsSync(image.thumbnail_path)) {
                    skipped++;
                    continue;
                }
                
                // Generate thumbnail
                const result = await generateThumbnail(image);
                
                if (result.success && result.thumbnailPath) {
                    // Update database with thumbnail path
                    await ImageRepository.update(image.id, {
                        thumbnail_path: result.thumbnailPath
                    });
                    processed++;
                    logger.info(`Generated thumbnail for ${image.filename}`);
                } else {
                    logger.warn(`Failed to generate thumbnail for ${image.filename}: ${result.error}`);
                    errors++;
                }
                
            } catch (error) {
                logger.error(`Error processing thumbnail for ${image.filename}: ${error}`);
                errors++;
            }
        }
        
        const message = `Thumbnail generation completed: ${processed} processed, ${skipped} skipped, ${errors} errors`;
        updateProgress(100, message);
        logger.info(message);
        
        return {
            processed,
            skipped,
            errors,
            total: images.length
        };
        
    } catch (error) {
        const errorMessage = `Thumbnail generation job failed: ${error}`;
        logger.error(errorMessage);
        updateProgress(100, errorMessage);
        throw error;
    }
};

interface ThumbnailResult {
    success: boolean;
    thumbnailPath?: string;
    error?: string;
}

async function generateThumbnail(image: any): Promise<ThumbnailResult> {
    try {
        // Ensure source file exists
        if (!fs.existsSync(image.original_path)) {
            return { success: false, error: 'Source file not found' };
        }
        
        // Create thumbnail directory structure
        const pathsConfig = config.getPathsConfig();
        const imageConfig = config.getImageProcessingConfig();
        
        const thumbnailDir = path.join(pathsConfig.destDir, 'thumbnails');
        const relativePath = path.relative(pathsConfig.sourceDir, image.original_path);
        const thumbnailPath = path.join(thumbnailDir, relativePath);
        const thumbnailDirForFile = path.dirname(thumbnailPath);
        
        // Ensure thumbnail directory exists
        fs.mkdirSync(thumbnailDirForFile, { recursive: true });
        
        // Generate thumbnail using Sharp
        const thumbnailSize = imageConfig.thumbnailSize;
        const jpegQuality = imageConfig.jpegQuality;
        
        await Image(image.original_path)
            .resize(thumbnailSize, thumbnailSize, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: jpegQuality })
            .toFile(thumbnailPath);
        
        return { 
            success: true, 
            thumbnailPath 
        };
        
    } catch (error) {
        return { 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
        };
    }
}