import { Request, Response } from 'express';
import { generateImageDataJsonHashed, storeImageDataHashed } from '../util/process-source';
import { FaceRepository, ObjectRepository, MetadataRepository, DatabaseUtils } from '../models/database';
import { Logger } from '../logger';
import { AppError, asyncHandler, validateRequired } from '../middleware/error-handler';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { configManager } from '../util/config-manager';

const logger = Logger.getInstance();

interface ProcessImageRequest {
    url?: string;
    path?: string;
    filename?: string;
    dateTaken?: string;
}

/**
 * Process a single image by URL or file path
 */
export const processImage = asyncHandler(async (req: Request, res: Response) => {
    const { url, path: imagePath, filename, dateTaken }: ProcessImageRequest = req.body;
    
    // Validate input - must provide either URL or path
    if (!url && !imagePath) {
        throw new AppError('Either url or path must be provided', 400);
    }
    
    if (url && imagePath) {
        throw new AppError('Provide either url or path, not both', 400);
    }
    
    let tempFilePath: string | null = null;
    let finalImagePath: string;
    
    try {
        if (url) {
            // Download image from URL
            req.logger.info('Processing image from URL', { url });
            
            // Validate URL
            try {
                new URL(url);
            } catch {
                throw new AppError('Invalid URL format', 400);
            }
            
            // Create temp directory
            const tempDir = path.join(configManager.getStorage().processedDir, 'temp');
            await fs.promises.mkdir(tempDir, { recursive: true });
            
            // Generate temp filename
            const urlPath = new URL(url).pathname;
            const extension = path.extname(urlPath) || '.jpg';
            const tempFilename = filename || `temp_${Date.now()}${extension}`;
            tempFilePath = path.join(tempDir, tempFilename);
            
            // Download the image
            const response = await fetch(url);
            if (!response.ok) {
                throw new AppError(`Failed to download image: ${response.statusText}`, 400);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await fs.promises.writeFile(tempFilePath, buffer);
            
            finalImagePath = tempFilePath;
            req.logger.info('Image downloaded successfully', { tempPath: tempFilePath, size: buffer.length });
            
        } else {
            // Use provided file path
            req.logger.info('Processing image from file path', { path: imagePath });
            
            // Validate path exists
            if (!fs.existsSync(imagePath!)) {
                throw new AppError('File does not exist at provided path', 404);
            }
            
            finalImagePath = imagePath!;
        }
        
        // Parse dateTaken if provided
        let parsedDateTaken: Date | undefined;
        if (dateTaken) {
            parsedDateTaken = new Date(dateTaken);
            if (isNaN(parsedDateTaken.getTime())) {
                throw new AppError('Invalid dateTaken format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)', 400);
            }
        }
        
        // Process the image using hash-based processing
        req.logger.info('Starting image processing', { imagePath: finalImagePath });
        const { fileInfo, processingResults } = await generateImageDataJsonHashed(finalImagePath, parsedDateTaken);
        
        // Store in database
        const imageId = await storeImageDataHashed(finalImagePath, fileInfo, processingResults);
        req.logger.info('Image stored in database', { imageId });
        
        // Face, object, and metadata storage is now handled in storeImageDataHashed
        const faceCount = processingResults.people ? Object.keys(processingResults.people).length : 0;
        const objectCount = processingResults.objects ? processingResults.objects.length : 0;
        
        req.logger.info('Image processing completed successfully', {
            imageId,
            faceCount,
            objectCount,
            fileHash: fileInfo.hash,
            relativePath: fileInfo.relativePath
        });
        
        // Clean up temp file if it was downloaded
        if (tempFilePath && url) {
            try {
                await fs.promises.unlink(tempFilePath);
                req.logger.debug('Temp file cleaned up', { tempPath: tempFilePath });
            } catch (cleanupError) {
                req.logger.warn('Failed to cleanup temp file', { tempPath: tempFilePath, error: cleanupError });
            }
        }
        
        // Return processing results
        res.json({
            success: true,
            imageId,
            processing: {
                mode: 'hash-based',
                fileHash: fileInfo.hash,
                relativePath: fileInfo.relativePath,
                faceCount,
                objectCount,
                screenshotDetected: processingResults.screenshotDetection?.isScreenshot || false,
                dominantColor: processingResults.dominantColor
            },
            media: {
                url: `/media/${fileInfo.relativePath}`,
                thumbnailUrl: `/media/${fileInfo.relativePath}?thumb=1`
            },
            metadata: {
                width: processingResults.exif?.ImageWidth || processingResults.exif?.ExifImageWidth,
                height: processingResults.exif?.ImageHeight || processingResults.exif?.ExifImageHeight,
                camera: processingResults.exif?.Make && processingResults.exif?.Model ? 
                    `${processingResults.exif.Make} ${processingResults.exif.Model}` : null,
                dateTaken: parsedDateTaken || null
            }
        });
        
    } catch (error) {
        // Clean up temp file on error
        if (tempFilePath && url) {
            try {
                await fs.promises.unlink(tempFilePath);
            } catch (cleanupError) {
                req.logger.warn('Failed to cleanup temp file after error', { tempPath: tempFilePath });
            }
        }
        
        // Handle duplicate file detection as success
        if (error instanceof Error && error.message.includes('Duplicate file detected')) {
            const hashMatch = error.message.match(/Hash: ([a-f0-9]+), existing ID: (\d+)/);
            if (hashMatch) {
                const [, hash, existingId] = hashMatch;
                req.logger.info('Duplicate file detected', { hash, existingId });
                
                return res.json({
                    success: true,
                    duplicate: true,
                    existingImageId: parseInt(existingId),
                    message: `File already processed (ID: ${existingId})`,
                    hash
                });
            }
        }
        
        req.logger.error('Image processing failed', { error, url, path: imagePath });
        throw error;
    }
});

/**
 * Get processing status and information for an image by ID
 */
export const getProcessingStatus = asyncHandler(async (req: Request, res: Response) => {
    const imageId = parseInt(req.params.id);
    
    if (isNaN(imageId)) {
        throw new AppError('Invalid image ID', 400);
    }
    
    // Get image with processing information
    const image = await DatabaseUtils.getImageWithAllData(imageId);
    
    if (!image) {
        throw new AppError('Image not found', 404);
    }
    
    res.json({
        imageId,
        status: image.processing_status,
        processing: {
            mode: 'hash-based',
            dateProcessed: image.date_processed,
            fileHash: image.file_hash,
            relativePath: image.relative_media_path,
            screenshotDetected: image.is_screenshot || false
        },
        media: {
            url: `/media/${image.relative_media_path}`,
            thumbnailUrl: `/media/${image.relative_media_path}?thumb=1`
        },
        counts: {
            faces: image.faces?.length || 0,
            objects: image.objects?.length || 0
        }
    });
});

// Helper function
function parseNumeric(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}