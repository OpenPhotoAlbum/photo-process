import { SmartAlbumRepository, ImageRepository, db } from '../models/database';
import { SmartAlbumEngine } from '../util/smart-album-engine';
import { logger as structuredLogger } from '../util/structured-logger';

/**
 * Get all smart albums
 */
export const listAlbums = async (query: any) => {
    const includeInactive = query.includeInactive === 'true';
    const albums = includeInactive 
        ? await SmartAlbumRepository.findActiveAlbums()
        : await SmartAlbumRepository.findActiveAlbums();
    
    return {
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
    };
};

/**
 * Get a specific album by slug or ID
 */
export const getAlbum = async (identifier: string) => {
    // Check if identifier is a number (ID) or string (slug)
    const album = isNaN(Number(identifier))
        ? await SmartAlbumRepository.findAlbumBySlug(identifier)
        : await SmartAlbumRepository.findAlbumById(Number(identifier));
    
    if (!album) {
        const error = new Error('Album not found');
        (error as any).status = 404;
        throw error;
    }
    
    // Get album rules if it's a custom rule album
    const rules = album.type === 'custom_rule' 
        ? await SmartAlbumRepository.getAlbumRules(album.id)
        : null;
    
    return {
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
    };
};

/**
 * Get images in an album
 */
export const getAlbumImages = async (identifier: string, query: any) => {
    const offset = parseInt(query.offset as string) || 0;
    const limit = Math.min(parseInt(query.limit as string) || 100, 500);
    
    // Get album
    const album = isNaN(Number(identifier))
        ? await SmartAlbumRepository.findAlbumBySlug(identifier)
        : await SmartAlbumRepository.findAlbumById(Number(identifier));
    
    if (!album) {
        const error = new Error('Album not found');
        (error as any).status = 404;
        throw error;
    }
    
    // Get images
    const images = await SmartAlbumRepository.getAlbumImages(album.id, offset, limit);
    
    return {
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
    };
};

/**
 * Create a new smart album
 */
export const createAlbum = async (data: any) => {
    const { name, description, type, rules, priority, customRules } = data;
    
    // Validate required fields
    if (!name || !type || !rules) {
        throw new Error('Missing required fields: name, type, rules');
    }
    
    // Generate slug from name
    const slug = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    
    // Check if slug already exists
    const existing = await SmartAlbumRepository.findAlbumBySlug(slug);
    if (existing) {
        const error = new Error('Album with this name already exists');
        (error as any).status = 409;
        throw error;
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
    if (type === 'custom_rule' && Array.isArray(customRules)) {
        for (const rule of customRules) {
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
    
    return {
        success: true,
        albumId,
        slug,
        message: 'Album created successfully'
    };
};

/**
 * Update a smart album
 */
export const updateAlbum = async (identifier: string, data: any) => {
    const { name, description, rules, priority, isActive } = data;
    
    // Get album
    const album = isNaN(Number(identifier))
        ? await SmartAlbumRepository.findAlbumBySlug(identifier)
        : await SmartAlbumRepository.findAlbumById(Number(identifier));
    
    if (!album) {
        const error = new Error('Album not found');
        (error as any).status = 404;
        throw error;
    }
    
    // Don't allow updating system albums
    if (album.is_system) {
        const error = new Error('Cannot modify system albums');
        (error as any).status = 403;
        throw error;
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
    
    return {
        success: true,
        message: 'Album updated successfully'
    };
};

/**
 * Delete a smart album
 */
export const deleteAlbum = async (identifier: string) => {
    // Get album
    const album = isNaN(Number(identifier))
        ? await SmartAlbumRepository.findAlbumBySlug(identifier)
        : await SmartAlbumRepository.findAlbumById(Number(identifier));
    
    if (!album) {
        const error = new Error('Album not found');
        (error as any).status = 404;
        throw error;
    }
    
    // Don't allow deleting system albums
    if (album.is_system) {
        const error = new Error('Cannot delete system albums');
        (error as any).status = 403;
        throw error;
    }
    
    // Delete album (cascade will remove memberships and rules)
    await SmartAlbumRepository.updateAlbum(album.id, { is_active: false });
    
    structuredLogger.info('Smart album deleted', {
        type: 'smart_album',
        action: 'album_deleted',
        albumId: album.id,
        albumName: album.name
    });
    
    return {
        success: true,
        message: 'Album deleted successfully'
    };
};

/**
 * Process images for smart albums
 */
export const processImages = async (query: any) => {
    const limit = Math.min(parseInt(query.limit as string) || 100, 1000);
    const imageId = query.imageId ? parseInt(query.imageId as string) : null;
    
    if (imageId) {
        // Process specific image
        await SmartAlbumEngine.processImageForAlbums(imageId);
        
        return {
            success: true,
            message: `Image ${imageId} processed for smart albums`
        };
    } else {
        // Process batch of unprocessed images
        const processed = await SmartAlbumEngine.processUnprocessedImages(limit);
        
        return {
            success: true,
            processed,
            message: `Processed ${processed} images for smart albums`
        };
    }
};

/**
 * Initialize default albums
 */
export const initializeDefaults = async () => {
    await SmartAlbumEngine.createDefaultAlbums();
    
    return {
        success: true,
        message: 'Default albums initialized successfully'
    };
};

/**
 * Get album statistics
 */
export const getAlbumStats = async (identifier: string) => {
    // Get album
    const album = isNaN(Number(identifier))
        ? await SmartAlbumRepository.findAlbumBySlug(identifier)
        : await SmartAlbumRepository.findAlbumById(Number(identifier));
    
    if (!album) {
        const error = new Error('Album not found');
        (error as any).status = 404;
        throw error;
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
    
    return {
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
    };
};