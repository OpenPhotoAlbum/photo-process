import { generateImageDataJsonHashed, storeImageDataHashed } from '../util/process-source';
import { DatabaseUtils } from '../models/database';
import { configManager } from '../util/config-manager';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create uploads directory in temp folder
        const uploadDir = path.join(configManager.getStorage().processedDir, 'temp', 'uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with original extension
        const ext = path.extname(file.originalname) || '.jpg';
        const timestamp = Date.now();
        const filename = `upload_${timestamp}${ext}`;
        cb(null, filename);
    }
});

// File filter to only allow images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: ${allowedMimes.join(', ')}`));
    }
};

// Configure multer with size limits and file filtering
export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 1 // Only allow single file upload for now
    }
});

interface ProcessImageRequest {
    url?: string;
    path?: string;
    filename?: string;
    dateTaken?: string;
    logger?: any;
}

/**
 * Process a single image by URL or file path
 */
export const processImage = async (data: ProcessImageRequest) => {
    const { url, path: imagePath, filename, dateTaken, logger } = data;
    
    // Validate input - must provide either URL or path
    if (!url && !imagePath) {
        throw new Error('Either url or path must be provided');
    }
    
    if (url && imagePath) {
        throw new Error('Provide either url or path, not both');
    }
    
    let tempFilePath: string | null = null;
    let finalImagePath: string;
    
    try {
        if (url) {
            // Download image from URL
            logger?.info('Processing image from URL', { url });
            
            // Validate URL
            try {
                new URL(url);
            } catch {
                throw new Error('Invalid URL format');
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
                throw new Error(`Failed to download image: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await fs.promises.writeFile(tempFilePath, buffer);
            
            finalImagePath = tempFilePath;
            logger?.info('Image downloaded successfully', { tempPath: tempFilePath, size: buffer.length });
            
        } else {
            // Use provided file path
            logger?.info('Processing image from file path', { path: imagePath });
            
            // Validate path exists
            if (!fs.existsSync(imagePath!)) {
                throw new Error('File does not exist at provided path');
            }
            
            finalImagePath = imagePath!;
        }
        
        // Parse dateTaken if provided
        let parsedDateTaken: Date | undefined;
        if (dateTaken) {
            parsedDateTaken = new Date(dateTaken);
            if (isNaN(parsedDateTaken.getTime())) {
                throw new Error('Invalid dateTaken format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)');
            }
        }
        
        // Process the image using hash-based processing
        logger?.info('Starting image processing', { imagePath: finalImagePath });
        const { fileInfo, processingResults } = await generateImageDataJsonHashed(finalImagePath, parsedDateTaken);
        
        // Store in database
        const imageId = await storeImageDataHashed(finalImagePath, fileInfo, processingResults);
        logger?.info('Image stored in database', { imageId });
        
        // Face, object, and metadata storage is now handled in storeImageDataHashed
        const faceCount = processingResults.people ? Object.keys(processingResults.people).length : 0;
        const objectCount = processingResults.objects ? processingResults.objects.length : 0;
        
        logger?.info('Image processing completed successfully', {
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
                logger?.debug('Temp file cleaned up', { tempPath: tempFilePath });
            } catch (cleanupError) {
                logger?.warn('Failed to cleanup temp file', { tempPath: tempFilePath, error: cleanupError });
            }
        }
        
        // Return processing results
        return {
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
        };
        
    } catch (error) {
        // Clean up temp file on error
        if (tempFilePath && url) {
            try {
                await fs.promises.unlink(tempFilePath);
            } catch (cleanupError) {
                logger?.warn('Failed to cleanup temp file after error', { tempPath: tempFilePath });
            }
        }
        
        // Handle duplicate file detection as success
        if (error instanceof Error && error.message.includes('Duplicate file detected')) {
            const hashMatch = error.message.match(/Hash: ([a-f0-9]+), existing ID: (\d+)/);
            if (hashMatch) {
                const [, hash, existingId] = hashMatch;
                logger?.info('Duplicate file detected', { hash, existingId });
                
                return {
                    success: true,
                    duplicate: true,
                    existingImageId: parseInt(existingId),
                    message: `File already processed (ID: ${existingId})`,
                    hash
                };
            }
        }
        
        logger?.error('Image processing failed', { error, url, path: imagePath });
        throw error;
    }
};

/**
 * Upload and process a photo from mobile device
 */
export const uploadPhoto = async (uploadedFile: Express.Multer.File, formData: any, logger?: any) => {
    if (!uploadedFile) {
        throw new Error('No photo file provided. Expected form field: photo');
    }
    
    logger?.info('Photo uploaded for processing', {
        originalName: uploadedFile.originalname,
        filename: uploadedFile.filename,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype,
        tempPath: uploadedFile.path
    });
    
    try {
        // Extract any additional metadata from form data
        const dateTaken = formData.dateTaken;
        
        // Parse dateTaken if provided
        let parsedDateTaken: Date | undefined;
        if (dateTaken) {
            parsedDateTaken = new Date(dateTaken);
            if (isNaN(parsedDateTaken.getTime())) {
                throw new Error('Invalid dateTaken format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)');
            }
        }
        
        // Process the uploaded image
        logger?.info('Starting processing of uploaded photo', { tempPath: uploadedFile.path });
        const { fileInfo, processingResults } = await generateImageDataJsonHashed(uploadedFile.path, parsedDateTaken);
        
        // Store in database
        const imageId = await storeImageDataHashed(uploadedFile.path, fileInfo, processingResults);
        logger?.info('Uploaded photo stored in database', { imageId, originalName: uploadedFile.originalname });
        
        // Face, object, and metadata storage is handled in storeImageDataHashed
        const faceCount = processingResults.people ? Object.keys(processingResults.people).length : 0;
        const objectCount = processingResults.objects ? processingResults.objects.length : 0;
        
        logger?.info('Photo upload and processing completed successfully', {
            imageId,
            originalName: uploadedFile.originalname,
            faceCount,
            objectCount,
            fileHash: fileInfo.hash,
            relativePath: fileInfo.relativePath
        });
        
        // Clean up temp file
        try {
            await fs.promises.unlink(uploadedFile.path);
            logger?.debug('Temp upload file cleaned up', { tempPath: uploadedFile.path });
        } catch (cleanupError) {
            logger?.warn('Failed to cleanup temp upload file', { tempPath: uploadedFile.path, error: cleanupError });
        }
        
        // Return processing results
        return {
            success: true,
            imageId,
            upload: {
                originalFilename: uploadedFile.originalname,
                fileSize: uploadedFile.size,
                uploadedAt: new Date().toISOString()
            },
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
        };
        
    } catch (error) {
        // Clean up temp file on error
        try {
            await fs.promises.unlink(uploadedFile.path);
        } catch (cleanupError) {
            logger?.warn('Failed to cleanup temp upload file after error', { tempPath: uploadedFile.path });
        }
        
        // Handle duplicate file detection as success
        if (error instanceof Error && error.message.includes('Duplicate file detected')) {
            const hashMatch = error.message.match(/Hash: ([a-f0-9]+), existing ID: (\d+)/);
            if (hashMatch) {
                const [, hash, existingId] = hashMatch;
                logger?.info('Duplicate photo detected in upload', { 
                    hash, 
                    existingId, 
                    originalName: uploadedFile.originalname 
                });
                
                return {
                    success: true,
                    duplicate: true,
                    existingImageId: parseInt(existingId),
                    message: `Photo already exists in your library (ID: ${existingId})`,
                    hash,
                    upload: {
                        originalFilename: uploadedFile.originalname,
                        fileSize: uploadedFile.size,
                        uploadedAt: new Date().toISOString()
                    }
                };
            }
        }
        
        logger?.error('Photo upload processing failed', { 
            error, 
            originalName: uploadedFile.originalname,
            tempPath: uploadedFile.path 
        });
        throw error;
    }
};

/**
 * Get processing status and information for an image by ID
 */
export const getProcessingStatus = async (imageId: number) => {
    if (isNaN(imageId)) {
        throw new Error('Invalid image ID');
    }
    
    // Get image with processing information
    const image = await DatabaseUtils.getImageWithAllData(imageId);
    
    if (!image) {
        const error = new Error('Image not found');
        (error as any).status = 404;
        throw error;
    }
    
    return {
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
    };
};