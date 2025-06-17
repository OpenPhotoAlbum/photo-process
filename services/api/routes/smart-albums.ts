import { Request, Response } from 'express';
import { SmartAlbumRepository, ImageRepository, db } from '../models/database';
import { SmartAlbumEngine } from '../util/smart-album-engine';
import { logger as structuredLogger } from '../util/structured-logger';

/**
 * Get all smart albums
 */
export const listAlbums = async (req: Request, res: Response) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const albums = includeInactive 
            ? await SmartAlbumRepository.findActiveAlbums()
            : await SmartAlbumRepository.findActiveAlbums();
        
        res.json({
            success: true,
            count: albums.length,
            albums: albums.map(album => ({
                id: album.id,
                name: album.name,
                slug: album.slug,
                description: album.description,
                type: album.type,
                imageCount: album.image_count,
                isSystem: album.is_system,
                coverImageUrl: album.cover_image_hash ? `/media/${album.cover_image_hash.substring(0, 4)}/${album.cover_image_hash.substring(4, 6)}/*_${album.cover_image_hash}.jpg` : null,
                lastUpdated: album.last_updated
            }))
        });
    } catch (error) {
        structuredLogger.error('Failed to list albums', {
            type: 'api',
            action: 'list_albums_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to list albums'
        });
    }
};

/**
 * Get a specific album by slug or ID
 */
export const getAlbum = async (req: Request, res: Response) => {
    try {
        const { identifier } = req.params;
        
        // Check if identifier is a number (ID) or string (slug)
        const album = isNaN(Number(identifier))
            ? await SmartAlbumRepository.findAlbumBySlug(identifier)
            : await SmartAlbumRepository.findAlbumById(Number(identifier));
        
        if (!album) {
            return res.status(404).json({
                success: false,
                error: 'Album not found'
            });
        }
        
        // Get album rules if it's a custom rule album
        const rules = album.type === 'custom_rule' 
            ? await SmartAlbumRepository.getAlbumRules(album.id)
            : null;
        
        res.json({
            success: true,
            album: {
                id: album.id,
                name: album.name,
                slug: album.slug,
                description: album.description,
                type: album.type,
                rules: album.rules,
                customRules: rules,
                imageCount: album.image_count,
                isActive: album.is_active,
                isSystem: album.is_system,
                priority: album.priority,
                coverImageUrl: album.cover_image_hash ? `/media/${album.cover_image_hash.substring(0, 4)}/${album.cover_image_hash.substring(4, 6)}/*_${album.cover_image_hash}.jpg` : null,
                createdAt: album.created_at,
                updatedAt: album.updated_at,
                lastUpdated: album.last_updated
            }
        });
    } catch (error) {
        structuredLogger.error('Failed to get album', {
            type: 'api',
            action: 'get_album_error',
            identifier: req.params.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to get album'
        });
    }
};

/**
 * Get images in an album
 */
export const getAlbumImages = async (req: Request, res: Response) => {
    try {
        const { identifier } = req.params;
        const offset = parseInt(req.query.offset as string) || 0;
        const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
        
        // Get album
        const album = isNaN(Number(identifier))
            ? await SmartAlbumRepository.findAlbumBySlug(identifier)
            : await SmartAlbumRepository.findAlbumById(Number(identifier));
        
        if (!album) {
            return res.status(404).json({
                success: false,
                error: 'Album not found'
            });
        }
        
        // Get images
        const images = await SmartAlbumRepository.getAlbumImages(album.id, offset, limit);
        
        res.json({
            success: true,
            album: {
                id: album.id,
                name: album.name,
                slug: album.slug,
                imageCount: album.image_count
            },
            images: images.map(image => ({
                id: image.id,
                filename: image.filename,
                mediaUrl: image.relative_media_path ? `/media/${image.relative_media_path}` : `/media/legacy/${image.filename}`,
                thumbnailUrl: image.relative_media_path ? `/media/${image.relative_media_path}?thumb=1` : `/media/legacy/${image.filename}?thumb=1`,
                dateTaken: image.date_taken,
                width: image.width,
                height: image.height,
                dominantColor: image.dominant_color,
                isScreenshot: image.is_screenshot,
                isAstrophotography: image.is_astrophotography
            })),
            pagination: {
                offset,
                limit,
                total: album.image_count,
                hasMore: offset + limit < album.image_count
            }
        });
    } catch (error) {
        structuredLogger.error('Failed to get album images', {
            type: 'api',
            action: 'get_album_images_error',
            identifier: req.params.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to get album images'
        });
    }
};

/**
 * Create a new smart album
 */
export const createAlbum = async (req: Request, res: Response) => {
    try {
        const { name, description, type, rules, priority } = req.body;
        
        // Validate required fields
        if (!name || !type || !rules) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, type, rules'
            });
        }
        
        // Generate slug from name
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        
        // Check if slug already exists
        const existing = await SmartAlbumRepository.findAlbumBySlug(slug);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Album with this name already exists'
            });
        }
        
        // Create album
        const albumId = await SmartAlbumRepository.createAlbum({
            name,
            slug,
            description,
            type,
            rules: JSON.stringify(rules),
            priority: priority || 50,
            is_system: false,
            is_active: true
        });
        
        // If it's a custom rule album, create the individual rules
        if (type === 'custom_rule' && Array.isArray(req.body.customRules)) {
            for (const rule of req.body.customRules) {
                await SmartAlbumRepository.createAlbumRule({
                    album_id: albumId,
                    rule_type: rule.ruleType,
                    parameters: JSON.stringify(rule.parameters),
                    operator: rule.operator || 'AND',
                    priority: rule.priority || 100,
                    is_active: true
                });
            }
        }
        
        structuredLogger.info('Smart album created', {
            type: 'smart_album',
            action: 'album_created',
            albumId,
            albumName: name,
            albumType: type
        });
        
        res.status(201).json({
            success: true,
            albumId,
            slug,
            message: 'Album created successfully'
        });
    } catch (error) {
        structuredLogger.error('Failed to create album', {
            type: 'api',
            action: 'create_album_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to create album'
        });
    }
};

/**
 * Update a smart album
 */
export const updateAlbum = async (req: Request, res: Response) => {
    try {
        const { identifier } = req.params;
        const { name, description, rules, priority, isActive } = req.body;
        
        // Get album
        const album = isNaN(Number(identifier))
            ? await SmartAlbumRepository.findAlbumBySlug(identifier)
            : await SmartAlbumRepository.findAlbumById(Number(identifier));
        
        if (!album) {
            return res.status(404).json({
                success: false,
                error: 'Album not found'
            });
        }
        
        // Don't allow updating system albums
        if (album.is_system) {
            return res.status(403).json({
                success: false,
                error: 'Cannot modify system albums'
            });
        }
        
        // Prepare updates
        const updates: any = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (rules !== undefined) updates.rules = JSON.stringify(rules);
        if (priority !== undefined) updates.priority = priority;
        if (isActive !== undefined) updates.is_active = isActive;
        
        // Update album
        await SmartAlbumRepository.updateAlbum(album.id, updates);
        
        structuredLogger.info('Smart album updated', {
            type: 'smart_album',
            action: 'album_updated',
            albumId: album.id,
            updates: Object.keys(updates)
        });
        
        res.json({
            success: true,
            message: 'Album updated successfully'
        });
    } catch (error) {
        structuredLogger.error('Failed to update album', {
            type: 'api',
            action: 'update_album_error',
            identifier: req.params.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to update album'
        });
    }
};

/**
 * Delete a smart album
 */
export const deleteAlbum = async (req: Request, res: Response) => {
    try {
        const { identifier } = req.params;
        
        // Get album
        const album = isNaN(Number(identifier))
            ? await SmartAlbumRepository.findAlbumBySlug(identifier)
            : await SmartAlbumRepository.findAlbumById(Number(identifier));
        
        if (!album) {
            return res.status(404).json({
                success: false,
                error: 'Album not found'
            });
        }
        
        // Don't allow deleting system albums
        if (album.is_system) {
            return res.status(403).json({
                success: false,
                error: 'Cannot delete system albums'
            });
        }
        
        // Delete album (cascade will remove memberships and rules)
        await SmartAlbumRepository.updateAlbum(album.id, { is_active: false });
        
        structuredLogger.info('Smart album deleted', {
            type: 'smart_album',
            action: 'album_deleted',
            albumId: album.id,
            albumName: album.name
        });
        
        res.json({
            success: true,
            message: 'Album deleted successfully'
        });
    } catch (error) {
        structuredLogger.error('Failed to delete album', {
            type: 'api',
            action: 'delete_album_error',
            identifier: req.params.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to delete album'
        });
    }
};

/**
 * Process images for smart albums
 */
export const processImages = async (req: Request, res: Response) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
        const imageId = req.query.imageId ? parseInt(req.query.imageId as string) : null;
        
        if (imageId) {
            // Process specific image
            await SmartAlbumEngine.processImageForAlbums(imageId);
            
            res.json({
                success: true,
                message: `Image ${imageId} processed for smart albums`
            });
        } else {
            // Process batch of unprocessed images
            const processed = await SmartAlbumEngine.processUnprocessedImages(limit);
            
            res.json({
                success: true,
                processed,
                message: `Processed ${processed} images for smart albums`
            });
        }
    } catch (error) {
        structuredLogger.error('Failed to process images', {
            type: 'api',
            action: 'process_images_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to process images'
        });
    }
};

/**
 * Initialize default albums
 */
export const initializeDefaults = async (req: Request, res: Response) => {
    try {
        await SmartAlbumEngine.createDefaultAlbums();
        
        res.json({
            success: true,
            message: 'Default albums initialized successfully'
        });
    } catch (error) {
        structuredLogger.error('Failed to initialize default albums', {
            type: 'api',
            action: 'initialize_defaults_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to initialize default albums'
        });
    }
};

/**
 * Get album statistics
 */
export const getAlbumStats = async (req: Request, res: Response) => {
    try {
        const { identifier } = req.params;
        
        // Get album
        const album = isNaN(Number(identifier))
            ? await SmartAlbumRepository.findAlbumBySlug(identifier)
            : await SmartAlbumRepository.findAlbumById(Number(identifier));
        
        if (!album) {
            return res.status(404).json({
                success: false,
                error: 'Album not found'
            });
        }
        
        // Get basic stats
        const totalImages = album.image_count;
        
        // Get recent additions
        const recentAdditions = await db('smart_album_images')
            .where({ album_id: album.id })
            .orderBy('added_at', 'desc')
            .limit(10)
            .select('image_id', 'added_at', 'confidence');
        
        // Get confidence distribution
        const confidenceStats = await db('smart_album_images')
            .where({ album_id: album.id })
            .select(db.raw('AVG(confidence) as avg_confidence'))
            .select(db.raw('MIN(confidence) as min_confidence'))
            .select(db.raw('MAX(confidence) as max_confidence'))
            .first();
        
        res.json({
            success: true,
            stats: {
                albumId: album.id,
                albumName: album.name,
                totalImages,
                recentAdditions: recentAdditions.length,
                lastAddition: recentAdditions[0]?.added_at || null,
                confidence: {
                    average: confidenceStats?.avg_confidence || 0,
                    min: confidenceStats?.min_confidence || 0,
                    max: confidenceStats?.max_confidence || 0
                }
            }
        });
    } catch (error) {
        structuredLogger.error('Failed to get album statistics', {
            type: 'api',
            action: 'get_album_stats_error',
            identifier: req.params.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to get album statistics'
        });
    }
};