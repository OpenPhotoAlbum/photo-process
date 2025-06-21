import { Request, Response } from 'express';
import { AppError, asyncHandler } from '../middleware/error-handler';
import * as processResolvers from '../resolvers/process';

// Export multer configuration from resolver
export const upload = processResolvers.upload;

/**
 * Process a single image by URL or file path
 */
export const processImage = asyncHandler(async (req: Request, res: Response) => {
    try {
        const result = await processResolvers.processImage({
            ...req.body,
            logger: req.logger
        });
        res.json(result);
    } catch (error) {
        if (error instanceof Error && error.message.includes('Either url or path must be provided')) {
            throw new AppError(error.message, 400);
        }
        if (error instanceof Error && error.message.includes('Provide either url or path, not both')) {
            throw new AppError(error.message, 400);
        }
        if (error instanceof Error && error.message.includes('Invalid URL format')) {
            throw new AppError(error.message, 400);
        }
        if (error instanceof Error && error.message.includes('File does not exist')) {
            throw new AppError(error.message, 404);
        }
        if (error instanceof Error && error.message.includes('Invalid dateTaken format')) {
            throw new AppError(error.message, 400);
        }
        if (error instanceof Error && error.message.includes('Failed to download image')) {
            throw new AppError(error.message, 400);
        }
        throw error;
    }
});

/**
 * Upload and process a photo from mobile device
 * Expects multipart/form-data with 'photo' field
 */
export const uploadPhoto = asyncHandler(async (req: Request, res: Response) => {
    try {
        const result = await processResolvers.uploadPhoto(req.file!, req.body, req.logger);
        res.json(result);
    } catch (error) {
        if (error instanceof Error && error.message.includes('No photo file provided')) {
            throw new AppError(error.message, 400);
        }
        if (error instanceof Error && error.message.includes('Invalid dateTaken format')) {
            throw new AppError(error.message, 400);
        }
        throw error;
    }
});

/**
 * Get processing status and information for an image by ID
 */
export const getProcessingStatus = asyncHandler(async (req: Request, res: Response) => {
    try {
        const imageId = parseInt(req.params.id);
        const result = await processResolvers.getProcessingStatus(imageId);
        res.json(result);
    } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid image ID')) {
            throw new AppError(error.message, 400);
        }
        const status = (error as any).status || 500;
        if (status === 404) {
            throw new AppError(error instanceof Error ? error.message : 'Image not found', 404);
        }
        throw error;
    }
});