import { Request, Response } from 'express';
import { ImageRepository, MetadataRepository, ObjectRepository } from '../models/database';
import { ScreenshotDetector } from '../util/screenshot-detector';
import { AppError, asyncHandler, validateRequired } from '../middleware/error-handler';

// Get screenshot candidates for review
export const getScreenshotCandidates = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    
    const candidates = await ImageRepository.getScreenshotCandidates(limit);
    
    // Enrich with metadata for display
    const enrichedCandidates = await Promise.all(
        candidates.map(async (image) => {
            const metadata = await MetadataRepository.getMetadataByImage(image.id!);
            const objects = await ObjectRepository.getObjectsByImage(image.id!);
            const reasons = image.screenshot_reasons ? JSON.parse(image.screenshot_reasons) : [];
            
            return {
                ...image,
                metadata,
                objects,
                screenshot_reasons: reasons
            };
        })
    );
    
    res.json({
        candidates: enrichedCandidates,
        count: enrichedCandidates.length
    });
});

// Mark image as confirmed junk or important
export const updateJunkStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    
    validateRequired(status, 'Status');
    
    if (!['confirmed_junk', 'confirmed_important'].includes(status)) {
        throw new AppError('Invalid status. Must be "confirmed_junk" or "confirmed_important"', 400);
    }
    
    const imageId = parseInt(id);
    if (isNaN(imageId)) {
        throw new AppError('Invalid image ID', 400);
    }
    
    const image = await ImageRepository.findById(imageId);
    if (!image) {
        throw new AppError('Image not found', 404);
    }
    
    await ImageRepository.updateJunkStatus(imageId, status);
    
    res.json({
        message: `Image marked as ${status.replace('confirmed_', '')}`,
        image: { ...image, junk_status: status }
    });
});

// Get junk review statistics
export const getJunkStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await ImageRepository.getJunkReviewStats();
    
    res.json({
        stats: {
            ...stats,
            unreviewed: stats.total - stats.reviewed,
            review_progress: stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0
        }
    });
});

// Run screenshot detection on existing images
export const runScreenshotDetection = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const force = req.query.force === 'true';
    
    // Get images to analyze
    let query = ImageRepository.getProcessedImages(limit, 0);
    
    // If not forcing, only analyze images that haven't been checked
    if (!force) {
        // This would need to be implemented in the repository
        // For now, we'll analyze all processed images
    }
    
    const images = await query;
    
    let analyzed = 0;
    let screenshotsFound = 0;
    const results: any[] = [];
    
    for (const image of images) {
        try {
            // Get metadata and objects for this image
            const [metadata, objects] = await Promise.all([
                MetadataRepository.getMetadataByImage(image.id!),
                ObjectRepository.getObjectsByImage(image.id!)
            ]);
            
            // Run screenshot detection
            const detection = ScreenshotDetector.detectScreenshot(
                image.filename,
                metadata || undefined,
                objects,
                image.width || undefined,
                image.height || undefined,
                image.mime_type || undefined
            );
            
            // Update database
            await ImageRepository.updateScreenshotDetection(
                image.id!,
                detection.isScreenshot,
                detection.confidence,
                detection.reasons
            );
            
            analyzed++;
            
            if (detection.isScreenshot) {
                screenshotsFound++;
                results.push({
                    imageId: image.id,
                    filename: image.filename,
                    confidence: detection.confidence,
                    reasons: detection.reasons
                });
            }
            
        } catch (error) {
            console.error(`Error analyzing image ${image.id}:`, error);
            // Continue with next image
        }
    }
    
    res.json({
        message: `Screenshot detection completed`,
        analyzed,
        screenshotsFound,
        results: results.slice(0, 20) // Return first 20 for reference
    });
});

// Batch update junk status for multiple images
export const batchUpdateJunkStatus = asyncHandler(async (req: Request, res: Response) => {
    const { imageIds, status } = req.body;
    
    validateRequired(imageIds, 'Image IDs');
    validateRequired(status, 'Status');
    
    if (!Array.isArray(imageIds)) {
        throw new AppError('Image IDs must be an array', 400);
    }
    
    if (!['confirmed_junk', 'confirmed_important'].includes(status)) {
        throw new AppError('Invalid status', 400);
    }
    
    let updated = 0;
    let errors = 0;
    
    for (const imageId of imageIds) {
        try {
            await ImageRepository.updateJunkStatus(parseInt(imageId), status);
            updated++;
        } catch (error) {
            console.error(`Error updating image ${imageId}:`, error);
            errors++;
        }
    }
    
    res.json({
        message: `Batch update completed`,
        updated,
        errors,
        status
    });
});