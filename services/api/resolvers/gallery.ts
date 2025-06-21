import { ImageRepository, FaceRepository, MetadataRepository, DatabaseUtils, db } from '../models/database';
import { cache, getCacheKey } from '../util/cache';
import { configManager } from '../util/config-manager';
import * as path from 'path';
import * as fs from 'fs';

// Helper function to convert path to media URL (supports both legacy and hash-based)
function getMediaUrl(image: any): string {
    // If image has relative_media_path (hash-based), use that
    if (image.relative_media_path) {
        return `/media/${image.relative_media_path}`;
    }
    
    // Fallback to legacy path conversion
    const sourceDir = configManager.getStorage().sourceDir;
    const relativePath = image.original_path.replace(sourceDir, '').replace(/^\/+/, '');
    return `/media/${relativePath}`;
}

// Helper function for face URLs (supports both legacy and hash-based)
function getFaceUrl(face: any): string {
    // TODO: Use relative_face_path after migrations
    // if (face.relative_face_path) {
    //     return `/media/${face.relative_face_path}`;
    // }
    
    // Fallback to legacy face path
    return face.face_image_path ? `/processed/${face.face_image_path}` : '';
}

/**
 * Main gallery list resolver - optimized database version with cursor-based pagination
 */
export const getGalleryList = async (query: any) => {
    // Support both cursor-based and traditional pagination
    const limit = parseInt(query.limit as string) || 50;
    const cursor = query.cursor as string; // ISO date string for cursor
    const page = parseInt(query.page as string); // Optional fallback to offset pagination
    const astroOnly = query.astro === 'true'; // Filter for astrophotography
    
    // New filter parameters for mobile app
    const startDate = query.startDate as string;
    const endDate = query.endDate as string;
    const hasGPS = query.hasGPS;
    const cities = query.cities as string;
    const users = query.users as string;
    const sortBy = query.sortBy as string || 'date_taken';
    const sortOrder = query.sortOrder as string || 'desc';
    
    // Create cache key for this request
    const cacheParams = {
        limit, cursor, page, astroOnly,
        startDate, endDate, hasGPS, cities, users,
        sortBy, sortOrder
    };
    const cacheKey = getCacheKey('gallery-list', cacheParams);
    
    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
        console.log('[GALLERY] Returning cached results');
        return cached;
    }
    
    console.log('[GALLERY] Fetching from database with filters:', cacheParams);
    
    try {
        // Build base query
        let imagesQuery = db('images')
            .leftJoin('detected_faces', 'images.id', 'detected_faces.image_id')
            .select([
                'images.id',
                'images.filename',
                'images.original_path',
                'images.file_hash',
                'images.relative_media_path',
                'images.date_taken',
                'images.date_processed',
                'images.width',
                'images.height',
                'images.size',
                'images.mime_type',
                'images.thumbnail_path',
                'images.dominant_color',
                'images.is_screenshot',
                'images.screenshot_confidence',
                'images.is_astrophotography',
                'images.astrophotography_confidence',
                'images.uploaded_by',
                db.raw('COUNT(DISTINCT detected_faces.id) as face_count'),
                db.raw('COUNT(DISTINCT detected_faces.person_id) as person_count')
            ])
            .where('images.processing_status', 'completed')
            .whereNull('images.deleted_at') // Exclude soft-deleted images
            .groupBy('images.id');
        
        // Apply filters
        if (astroOnly) {
            imagesQuery = imagesQuery.where('images.is_astrophotography', true);
        }
        
        // Date range filter
        if (startDate) {
            imagesQuery = imagesQuery.where('images.date_taken', '>=', new Date(startDate));
        }
        if (endDate) {
            // Add 1 day to include the end date fully
            const endDateTime = new Date(endDate);
            endDateTime.setDate(endDateTime.getDate() + 1);
            imagesQuery = imagesQuery.where('images.date_taken', '<', endDateTime);
        }
        
        // GPS filter
        if (hasGPS === 'true') {
            imagesQuery = imagesQuery
                .join('image_geolocations', 'images.id', 'image_geolocations.image_id');
        } else if (hasGPS === 'false') {
            imagesQuery = imagesQuery
                .leftJoin('image_geolocations as geo_check', 'images.id', 'geo_check.image_id')
                .whereNull('geo_check.id');
        }
        
        // City filter
        if (cities) {
            const cityList = cities.split(',').map(c => c.trim()).filter(c => c);
            if (cityList.length > 0) {
                imagesQuery = imagesQuery
                    .join('image_geolocations as city_geo', 'images.id', 'city_geo.image_id')
                    .join('geo_cities', 'city_geo.city_id', 'geo_cities.id')
                    .whereIn('geo_cities.city', cityList);
            }
        }
        
        // User filter
        if (users) {
            const userList = users.split(',').map(u => u.trim()).filter(u => u);
            if (userList.length > 0) {
                imagesQuery = imagesQuery.whereIn('images.uploaded_by', userList);
            }
        }
        
        // Apply sorting
        const validSortFields = ['date_taken', 'date_processed', 'filename', 'size'];
        const sortField = validSortFields.includes(sortBy) ? `images.${sortBy}` : 'images.date_taken';
        const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc';
        
        imagesQuery = imagesQuery.orderBy(sortField, sortDirection);
        
        // Apply pagination
        if (cursor) {
            // Cursor-based pagination using date_taken
            const cursorDate = new Date(cursor);
            if (sortDirection === 'desc') {
                imagesQuery = imagesQuery.where('images.date_taken', '<', cursorDate);
            } else {
                imagesQuery = imagesQuery.where('images.date_taken', '>', cursorDate);
            }
        } else if (page && page > 1) {
            // Traditional offset pagination as fallback
            const offset = (page - 1) * limit;
            imagesQuery = imagesQuery.offset(offset);
        }
        
        // Apply limit
        imagesQuery = imagesQuery.limit(limit + 1); // Fetch one extra to determine hasMore
        
        // Execute query
        const images = await imagesQuery;
        
        // Determine if there are more results
        const hasMore = images.length > limit;
        if (hasMore) {
            images.pop(); // Remove the extra item
        }
        
        // Get additional data for each image
        const enrichedImages = await Promise.all(images.map(async (image) => {
            // Get GPS info if available
            let location = null;
            if (hasGPS !== 'false') {
                const geoData = await db('image_geolocations')
                    .join('geo_cities', 'image_geolocations.city_id', 'geo_cities.id')
                    .leftJoin('geo_states', 'geo_cities.state_code', 'geo_states.code')
                    .leftJoin('geo_countries', 'geo_states.country_code', 'geo_countries.country_code')
                    .select([
                        'geo_cities.city',
                        'geo_states.name as state',
                        'geo_countries.country_name as country'
                    ])
                    .where('image_geolocations.image_id', image.id)
                    .first();
                
                if (geoData) {
                    location = `${geoData.city}, ${geoData.state || geoData.country}`;
                }
            }
            
            return {
                ...image,
                media_url: getMediaUrl(image),
                thumbnail_url: getMediaUrl(image) + '?thumb=1',
                location
            };
        }));
        
        // Get total count for UI
        let totalQuery = db('images')
            .where('images.processing_status', 'completed')
            .whereNull('images.deleted_at');
        
        // Apply same filters for total count
        if (astroOnly) {
            totalQuery = totalQuery.where('images.is_astrophotography', true);
        }
        if (startDate) {
            totalQuery = totalQuery.where('images.date_taken', '>=', new Date(startDate));
        }
        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setDate(endDateTime.getDate() + 1);
            totalQuery = totalQuery.where('images.date_taken', '<', endDateTime);
        }
        if (hasGPS === 'true') {
            totalQuery = totalQuery
                .join('image_geolocations', 'images.id', 'image_geolocations.image_id');
        } else if (hasGPS === 'false') {
            totalQuery = totalQuery
                .leftJoin('image_geolocations as geo_check', 'images.id', 'geo_check.image_id')
                .whereNull('geo_check.id');
        }
        if (cities) {
            const cityList = cities.split(',').map(c => c.trim()).filter(c => c);
            if (cityList.length > 0) {
                totalQuery = totalQuery
                    .join('image_geolocations as city_geo', 'images.id', 'city_geo.image_id')
                    .join('geo_cities', 'city_geo.city_id', 'geo_cities.id')
                    .whereIn('geo_cities.city', cityList);
            }
        }
        if (users) {
            const userList = users.split(',').map(u => u.trim()).filter(u => u);
            if (userList.length > 0) {
                totalQuery = totalQuery.whereIn('images.uploaded_by', userList);
            }
        }
        
        const totalCount = await totalQuery.count('images.id as count').first();
        
        const result = {
            count: enrichedImages.length,
            total: parseInt(totalCount?.count as string) || 0,
            images: enrichedImages,
            pagination: {
                limit,
                hasMore,
                nextCursor: hasMore && enrichedImages.length > 0 
                    ? enrichedImages[enrichedImages.length - 1].date_taken.toISOString()
                    : null,
                currentPage: page || 1
            },
            filters: {
                astroOnly,
                startDate,
                endDate,
                hasGPS,
                cities: cities ? cities.split(',').map(c => c.trim()).filter(c => c) : [],
                users: users ? users.split(',').map(u => u.trim()).filter(u => u) : [],
                sortBy,
                sortOrder
            }
        };
        
        // Cache the result for 5 minutes
        await cache.set(cacheKey, result, 300);
        
        return result;
        
    } catch (error) {
        console.error('[GALLERY] Database error:', error);
        throw error;
    }
};

/**
 * Get detailed image data with metadata and faces
 */
export const getImageDetails = async (imageId: number) => {
    if (isNaN(imageId)) {
        throw new Error('Invalid image ID');
    }
    
    const imageData = await DatabaseUtils.getImageWithAllData(imageId);
    
    if (!imageData) {
        const error = new Error('Image not found');
        (error as any).status = 404;
        throw error;
    }
    
    // Add media URLs to the image data
    const enrichedImageData = {
        ...imageData,
        media_url: getMediaUrl(imageData),
        thumbnail_url: getMediaUrl(imageData) + '?thumb=1'
    };
    
    return enrichedImageData;
};

/**
 * Search images with filters
 */
export const searchImages = async (query: any) => {
    const filters: any = {};
    
    if (query.dateFrom) {
        filters.dateFrom = new Date(query.dateFrom as string);
    }
    if (query.dateTo) {
        filters.dateTo = new Date(query.dateTo as string);
    }
    if (query.camera) {
        filters.camera = query.camera as string;
    }
    if (query.location) {
        filters.location = query.location as string;
    }
    if (query.hasFaces !== undefined) {
        filters.hasFaces = query.hasFaces === 'true';
    }
    
    const limit = parseInt(query.limit as string) || 100;
    const offset = parseInt(query.offset as string) || 0;
    
    const images = await ImageRepository.searchImages(filters);
    
    // Enrich with faces
    const imagesWithFaces = images.map(image => ({
        ...image,
        media_url: getMediaUrl(image),
        thumbnail_url: getMediaUrl(image) + '?thumb=1',
        face_count: 0, // TODO: Add face count joins to ImageRepository.searchImages
        location: null // TODO: Add location joins to ImageRepository.searchImages
    }));
    
    return {
        count: imagesWithFaces.length,
        filters,
        images: imagesWithFaces
    };
};

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async () => {
    return await DatabaseUtils.getDashboardStats();
};

/**
 * Get all persons for face identification
 */
export const getPersons = async () => {
    const persons = await db('persons')
        .leftJoin('detected_faces', 'persons.id', 'detected_faces.person_id')
        .select('persons.*')
        .count('detected_faces.id as face_count')
        .groupBy('persons.id')
        .orderBy('persons.name');
        
    return { persons };
};

/**
 * Get unidentified faces for manual identification
 */
export const getUnidentifiedFaces = async (query: any) => {
    const limit = parseInt(query.limit as string) || 50;
    const faces = await FaceRepository.getUnidentifiedFaces(limit);
    
    return { faces };
};

/**
 * Assign person to a face
 */
export const assignPersonToFace = async (faceId: number, data: any) => {
    const { person_id, confidence } = data;
    
    if (isNaN(faceId) || !person_id) {
        throw new Error('Invalid face ID or person ID');
    }
    
    await db('detected_faces')
        .where({ id: faceId })
        .update({
            person_id,
            person_confidence: confidence || 1.0,
            updated_at: new Date()
        });
        
    return { success: true };
};

/**
 * Get faces for a specific image with person assignments
 */
export const getImageFaces = async (imageId: number) => {
    if (isNaN(imageId)) {
        throw new Error('Invalid image ID');
    }

    const faces = await db('detected_faces')
        .leftJoin('persons', 'detected_faces.person_id', 'persons.id')
        .select([
            'detected_faces.id',
            'detected_faces.face_image_path',
            'detected_faces.relative_face_path',
            'detected_faces.x_min',
            'detected_faces.y_min',
            'detected_faces.x_max',
            'detected_faces.y_max',
            'detected_faces.detection_confidence',
            'detected_faces.person_id',
            'persons.name as person_name'
        ])
        .where('detected_faces.image_id', imageId)
        .whereNotNull('detected_faces.face_image_path');

    // Add face URLs to each face
    const enrichedFaces = faces.map(face => ({
        ...face,
        face_url: getFaceUrl(face)
    }));

    return { faces: enrichedFaces };
};

/**
 * Get available cities for filtering
 */
export const getAvailableCities = async (query: any) => {
    const search = query.search as string;

    let citiesQuery = db('geo_cities as gc')
        .join('image_geolocations as il', 'gc.id', 'il.city_id')
        .join('images', 'il.image_id', 'images.id')
        .select('gc.city')
        .where('images.processing_status', 'completed')
        .groupBy('gc.city')
        .orderBy('gc.city');

    // Add search filter if provided
    if (search && search.trim()) {
        citiesQuery = citiesQuery.where('gc.city', 'like', `%${search.trim()}%`);
        console.log(`[CITIES] Searching for cities matching: "${search.trim()}"`);
    } else {
        console.log(`[CITIES] Loading all available cities`);
    }

    const cities = await citiesQuery;
    const cityNames = cities.map(c => c.city);
    
    console.log(`[CITIES] Returning ${cityNames.length} cities`);
    return cityNames;
};

/**
 * Soft delete an image (move to trash)
 */
export const deleteImage = async (imageId: number, data: any = {}) => {
    const reason = data.reason || 'User deleted via mobile app';
    const deletedBy = data.deletedBy || 'mobile-user';
    
    if (isNaN(imageId)) {
        throw new Error('Invalid image ID');
    }
    
    // Get image details first
    const image = await db('images')
        .where('id', imageId)
        .whereNull('deleted_at') // Make sure it's not already deleted
        .first();
        
    if (!image) {
        const error = new Error('Image not found or already deleted');
        (error as any).status = 404;
        throw error;
    }
    
    // Soft delete the image
    await db('images')
        .where('id', imageId)
        .update({
            deleted_at: new Date(),
            deleted_by: deletedBy,
            deletion_reason: reason,
            updated_at: new Date()
        });
    
    console.log(`[GALLERY] Soft deleted image ${imageId}: ${image.filename} (reason: ${reason})`);
    
    return { 
        success: true, 
        message: `Image ${image.filename} moved to trash`,
        deletedId: imageId,
        canRestore: true
    };
};

/**
 * Get trash (soft-deleted images)
 */
export const getTrash = async (query: any) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 50;
    const offset = (page - 1) * limit;
    
    const trashedImages = await db('images')
        .leftJoin('detected_faces', 'images.id', 'detected_faces.image_id')
        .select([
            'images.id',
            'images.filename',
            'images.date_taken',
            'images.date_processed',
            'images.deleted_at',
            'images.deleted_by',
            'images.deletion_reason',
            'images.thumbnail_path',
            'images.dominant_color'
        ])
        .count('detected_faces.id as face_count')
        .whereNotNull('images.deleted_at')
        .groupBy('images.id')
        .orderBy('images.deleted_at', 'desc')
        .limit(limit)
        .offset(offset);
    
    const totalCount = await db('images')
        .whereNotNull('deleted_at')
        .count('id as count')
        .first();
    
    return {
        images: trashedImages,
        pagination: {
            page,
            limit,
            total: parseInt(totalCount?.count as string) || 0,
            hasNext: (page * limit) < (parseInt(totalCount?.count as string) || 0)
        }
    };
};

/**
 * Restore image from trash
 */
export const restoreImage = async (imageId: number) => {
    if (isNaN(imageId)) {
        throw new Error('Invalid image ID');
    }
    
    // Get deleted image
    const image = await db('images')
        .where('id', imageId)
        .whereNotNull('deleted_at')
        .first();
        
    if (!image) {
        const error = new Error('Deleted image not found');
        (error as any).status = 404;
        throw error;
    }
    
    // Restore the image
    await db('images')
        .where('id', imageId)
        .update({
            deleted_at: null,
            deleted_by: null,
            deletion_reason: null,
            updated_at: new Date()
        });
    
    console.log(`[GALLERY] Restored image ${imageId}: ${image.filename}`);
    
    return { 
        success: true, 
        message: `Image ${image.filename} restored from trash`,
        restoredId: imageId
    };
};

/**
 * Permanently delete image from trash (hard delete)
 */
export const permanentlyDeleteImage = async (imageId: number) => {
    if (isNaN(imageId)) {
        throw new Error('Invalid image ID');
    }
    
    // Get deleted image
    const image = await db('images')
        .where('id', imageId)
        .whereNotNull('deleted_at')
        .first();
        
    if (!image) {
        const error = new Error('Deleted image not found in trash');
        (error as any).status = 404;
        throw error;
    }
    
    // Start transaction for data cleanup
    await db.transaction(async (trx) => {
        // Delete related data in order (foreign key constraints)
        await trx('detected_faces').where({ image_id: imageId }).delete();
        await trx('detected_objects').where({ image_id: imageId }).delete();
        await trx('image_metadata').where({ image_id: imageId }).delete();
        await trx('image_geolocations').where({ image_id: imageId }).delete();
        await trx('smart_album_images').where({ image_id: imageId }).delete();
        
        // Delete the image record
        await trx('images').where({ id: imageId }).delete();
    });
    
    // Clean up physical files (processed image and thumbnail)
    const processedDir = configManager.getStorage().processedDir;
    
    if (image.relative_media_path) {
        const processedPath = path.join(processedDir, image.relative_media_path);
        try {
            await fs.promises.unlink(processedPath);
            console.log(`Deleted processed image: ${processedPath}`);
        } catch (err) {
            console.warn(`Failed to delete processed image: ${processedPath}`, err);
        }
    }
    
    if (image.thumbnail_path) {
        const thumbnailPath = path.join(processedDir, image.thumbnail_path);
        try {
            await fs.promises.unlink(thumbnailPath);
            console.log(`Deleted thumbnail: ${thumbnailPath}`);
        } catch (err) {
            console.warn(`Failed to delete thumbnail: ${thumbnailPath}`, err);
        }
    }
    
    console.log(`[GALLERY] Permanently deleted image ${imageId}: ${image.filename}`);
    
    return { 
        success: true, 
        message: `Image ${image.filename} permanently deleted`,
        deletedId: imageId
    };
};