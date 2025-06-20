import { Request, Response } from 'express';
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

// Main gallery list resolver - optimized database version with cursor-based pagination
export const GalleryListResolver = async (req: Request, res: Response) => {
    try {
        // Support both cursor-based and traditional pagination
        const limit = parseInt(req.query.limit as string) || 50;
        const cursor = req.query.cursor as string; // ISO date string for cursor
        const page = parseInt(req.query.page as string); // Optional fallback to offset pagination
        const astroOnly = req.query.astro === 'true'; // Filter for astrophotography
        
        // New filter parameters for mobile app
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const hasGPS = req.query.hasGPS;
        const cities = req.query.cities as string;
        const users = req.query.users as string;
        const sortBy = req.query.sortBy as string || 'date_taken';
        const sortOrder = req.query.sortOrder as string || 'desc';
        
        // Create cache key for this request
        const cacheKey = getCacheKey('gallery', { 
            limit, cursor, page, astroOnly, startDate, endDate, hasGPS, cities, users, sortBy, sortOrder 
        });
        
        // Check cache first (60 second TTL for fast-changing data)
        const cachedResult = cache.get(cacheKey);
        if (cachedResult) {
            res.json(cachedResult);
            return;
        }
        
        let query = db('images')
            .leftJoin('detected_faces', 'images.id', 'detected_faces.image_id')
            .leftJoin('image_geolocations as il', 'images.id', 'il.image_id')
            .leftJoin('geo_cities as gc', 'il.city_id', 'gc.id')
            .leftJoin('geo_states as gs', 'gc.state_code', 'gs.code')
            .leftJoin('geo_countries as gco', 'gs.country_code', 'gco.country_code')
            .leftJoin('image_metadata as im', 'images.id', 'im.image_id')
            .select([
                'images.id',
                'images.filename',
                'images.original_path',
                'images.relative_media_path', // Hash-based processed image path
                'images.thumbnail_path',
                'images.dominant_color',
                'images.date_taken',
                'images.date_processed',
                'images.processing_status',
                // GPS coordinates with fallback to metadata table
                db.raw('COALESCE(images.gps_latitude, im.latitude) as gps_latitude'),
                db.raw('COALESCE(images.gps_longitude, im.longitude) as gps_longitude'),
                // Geolocation data
                'gc.city as location_city',
                'gs.name as location_state',
                'gco.country_name as location_country',
                'il.confidence_score as location_confidence',
                'il.distance_miles as location_distance'
                // 'images.is_astrophotography', // TODO: Enable after migrations
                // 'images.astro_confidence', // TODO: Enable after migrations
                // 'images.astro_classification' // TODO: Enable after migrations
            ])
            .count('detected_faces.id as face_count')
            .where('images.processing_status', 'completed')
            .whereNull('images.deleted_at') // Exclude soft-deleted images
            // TODO: Enable after migrations
            // .where(function() {
            //     this.where('images.is_screenshot', false)
            //         .orWhereNull('images.is_screenshot');
            // })
            // .where(function() {
            //     this.whereNot('images.junk_status', 'confirmed_junk')
            //         .orWhereNull('images.junk_status');
            // })
            .modify(function(queryBuilder) {
                // Apply astrophotography filter if requested
                // TODO: Enable after migrations
                // if (astroOnly) {
                //     queryBuilder.where('images.is_astrophotography', true);
                // }
                
                // Apply date range filters
                if (startDate) {
                    queryBuilder.where('images.date_taken', '>=', startDate);
                }
                if (endDate) {
                    queryBuilder.where('images.date_taken', '<=', endDate);
                }
                
                // Apply GPS filter
                if (hasGPS === 'true') {
                    queryBuilder.whereNotNull('images.gps_latitude')
                               .whereNotNull('images.gps_longitude');
                } else if (hasGPS === 'false') {
                    queryBuilder.where(function() {
                        this.whereNull('images.gps_latitude')
                            .orWhereNull('images.gps_longitude');
                    });
                }
                
                // Apply city filter
                if (cities) {
                    const cityList = cities.split(',').map(c => c.trim());
                    queryBuilder.whereIn('gc.city', cityList);
                }
                
                // Apply user filter based on upload path
                if (users) {
                    const userList = users.split(',').map(u => u.trim());
                    console.log(`[GALLERY] Filtering by users: ${userList.join(', ')}`);
                    
                    queryBuilder.where(function() {
                        // Build OR conditions for each user's upload path
                        userList.forEach((user, index) => {
                            const pathPattern = `/mnt/sg1/uploads/${user}/%`;
                            console.log(`[GALLERY] Adding filter for user "${user}" with pattern: ${pathPattern}`);
                            if (index === 0) {
                                this.where('images.original_path', 'like', pathPattern);
                            } else {
                                this.orWhere('images.original_path', 'like', pathPattern);
                            }
                        });
                    });
                }
            })
            .groupBy([
                'images.id', 
                'images.filename', 
                'images.original_path', 
                'images.relative_media_path', 
                'images.thumbnail_path', 
                'images.dominant_color', 
                'images.date_taken', 
                'images.date_processed', 
                'images.processing_status',
                'images.gps_latitude',
                'images.gps_longitude',
                'im.latitude',
                'im.longitude',
                'gc.city',
                'gs.name',
                'gco.country_name',
                'il.confidence_score',
                'il.distance_miles'
            ])
            // Use proper orderBy syntax
            .orderByRaw(
                sortBy === 'date_taken' 
                    ? `COALESCE(images.date_taken, images.date_processed) ${sortOrder}`
                    : `images.${sortBy} ${sortOrder}`
            )
            .orderBy('images.id', 'desc') // Secondary sort by ID for consistent pagination
            .limit(limit + 1); // +1 to check if there are more results
        
        // Apply cursor-based pagination if cursor is provided
        if (cursor) {
            // Use ID-based pagination for reliable cursors
            const cursorId = parseInt(cursor);
            if (!isNaN(cursorId)) {
                query = query.where('images.id', '<', cursorId);
            }
        } 
        // Fallback to offset-based pagination if page is provided
        else if (page) {
            const offset = (page - 1) * limit;
            query = query.offset(offset);
        }
        
        const imagesWithFaces = await query;
        
        // Log filter results
        if (users) {
            console.log(`[GALLERY] User filter returned ${imagesWithFaces.length} images (before pagination limit)`);
        }
        
        // Get total count for the header (without limit)
        const totalCountQuery = db('images')
            .count('images.id as total')
            .where('images.processing_status', 'completed');
            
        // Apply same filters as main query for consistent count
        if (astroOnly) {
            totalCountQuery.where('images.is_astrophotography', true);
        }
        
        const totalResult = await totalCountQuery.first();
        const totalCount = totalResult ? parseInt(totalResult.total as string) : 0;
        
        // Get face image paths for each image in a separate optimized query
        const imageIds = imagesWithFaces.map((img: any) => img.id);
        const facesByImage: Record<number, string[]> = {};
        
        if (imageIds.length > 0) {
            const faces = await db('detected_faces')
                .select(['image_id', 'face_image_path'])
                .whereIn('image_id', imageIds)
                .whereNotNull('face_image_path');
            
            faces.forEach(face => {
                if (!facesByImage[face.image_id]) {
                    facesByImage[face.image_id] = [];
                }
                // Use getFaceUrl helper to generate proper face URL
                const faceUrl = getFaceUrl(face);
                if (faceUrl) {
                    facesByImage[face.image_id].push(faceUrl);
                }
            });
        }
        
        // Check if there are more results (for cursor pagination)
        const hasMore = imagesWithFaces.length > limit;
        const results = hasMore ? imagesWithFaces.slice(0, limit) : imagesWithFaces;
        
        // Combine results and add media URLs and location data
        const finalResults = results.map((image: any) => {
            const location = image.location_city ? {
                city: image.location_city,
                state: image.location_state,
                country: image.location_country,
                confidence: parseFloat(image.location_confidence) || null,
                distance_miles: parseFloat(image.location_distance) || null,
                coordinates: (image.gps_latitude && image.gps_longitude) ? {
                    latitude: parseFloat(image.gps_latitude),
                    longitude: parseFloat(image.gps_longitude)
                } : null
            } : null;

            return {
                ...image,
                face_count: parseInt(image.face_count as string),
                faces: facesByImage[image.id as number] || [],
                media_url: getMediaUrl(image),
                thumbnail_url: getMediaUrl(image) + '?thumb=1',
                location,
                // Clean up the raw location fields
                location_city: undefined,
                location_state: undefined,
                location_country: undefined,
                location_confidence: undefined,
                location_distance: undefined
            };
        });
        
        // Generate next cursor from the last item (always use ID for consistency)
        let nextCursor = null;
        if (finalResults.length > 0) {
            const lastItem = finalResults[finalResults.length - 1] as any;
            nextCursor = lastItem.id.toString();
        }
        
        const response: any = {
            limit,
            count: finalResults.length,
            totalCount,
            images: finalResults,
            hasMore
        };
        
        // Include cursor information if using cursor pagination
        if (cursor || !page) {
            response.nextCursor = nextCursor;
        }
        
        // Include page information if using offset pagination
        if (page) {
            response.page = page;
        }
        
        // Cache the response for 60 seconds
        cache.set(cacheKey, response, 60);
        
        res.json(response);
        
    } catch (error) {
        console.error('Error fetching images from database:', error);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
};

// Additional gallery utilities
export const GalleryRoutes = {
    
    // Get detailed image data with metadata and faces
    async getImageDetails(req: Request, res: Response) {
        try {
            const imageId = parseInt(req.params.id);
            
            if (isNaN(imageId)) {
                return res.status(400).json({ error: 'Invalid image ID' });
            }
            
            const imageData = await DatabaseUtils.getImageWithAllData(imageId);
            
            if (!imageData) {
                return res.status(404).json({ error: 'Image not found' });
            }
            
            // Add media URLs to the image data
            const enrichedImageData = {
                ...imageData,
                media_url: getMediaUrl(imageData),
                thumbnail_url: getMediaUrl(imageData) + '?thumb=1'
            };
            
            res.json(enrichedImageData);
            
        } catch (error) {
            console.error('Error fetching image details:', error);
            res.status(500).json({ error: 'Failed to fetch image details' });
        }
    },
    
    // Search images with filters
    async searchImages(req: Request, res: Response) {
        try {
            const filters: any = {};
            
            if (req.query.dateFrom) {
                filters.dateFrom = new Date(req.query.dateFrom as string);
            }
            if (req.query.dateTo) {
                filters.dateTo = new Date(req.query.dateTo as string);
            }
            if (req.query.camera) {
                filters.camera = req.query.camera as string;
            }
            if (req.query.location) {
                filters.location = req.query.location as string;
            }
            if (req.query.hasFaces !== undefined) {
                filters.hasFaces = req.query.hasFaces === 'true';
            }
            if (req.query.tags) {
                filters.tags = (req.query.tags as string).split(',');
            }
            
            const images = await ImageRepository.searchImages(filters);
            
            // Get face counts for results (optimized)
            const imageIds = images.map(img => img.id!);
            const facesByImage: Record<number, string[]> = {};
            const faceCounts: Record<number, number> = {};
            
            if (imageIds.length > 0) {
                const faces = await db('detected_faces')
                    .select(['image_id', 'face_image_path'])
                    .whereIn('image_id', imageIds)
                    .whereNotNull('face_image_path');
                
                faces.forEach(face => {
                    if (!facesByImage[face.image_id]) {
                        facesByImage[face.image_id] = [];
                        faceCounts[face.image_id] = 0;
                    }
                    const faceUrl = getFaceUrl(face);
                    if (faceUrl) {
                        facesByImage[face.image_id].push(faceUrl);
                        faceCounts[face.image_id]++;
                    }
                });
            }
            
            const imagesWithFaces = images.map(image => ({
                ...image,
                face_count: faceCounts[image.id!] || 0,
                faces: facesByImage[image.id!] || [],
                media_url: getMediaUrl(image),
                thumbnail_url: getMediaUrl(image) + '?thumb=1',
                // Note: location data would need to be added to searchImages query if needed
                location: null // TODO: Add location joins to ImageRepository.searchImages
            }));
            
            res.json({
                count: imagesWithFaces.length,
                filters,
                images: imagesWithFaces
            });
            
        } catch (error) {
            console.error('Error searching images:', error);
            res.status(500).json({ error: 'Failed to search images' });
        }
    },
    
    // Get dashboard statistics
    async getDashboardStats(req: Request, res: Response) {
        try {
            const stats = await DatabaseUtils.getDashboardStats();
            res.json(stats);
            
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            res.status(500).json({ error: 'Failed to fetch statistics' });
        }
    },
    
    // Get all persons for face identification
    async getPersons(req: Request, res: Response) {
        try {
            const persons = await db('persons')
                .leftJoin('detected_faces', 'persons.id', 'detected_faces.person_id')
                .select('persons.*')
                .count('detected_faces.id as face_count')
                .groupBy('persons.id')
                .orderBy('persons.name');
                
            res.json({ persons });
            
        } catch (error) {
            console.error('Error fetching persons:', error);
            res.status(500).json({ error: 'Failed to fetch persons' });
        }
    },
    
    // Get unidentified faces for manual identification
    async getUnidentifiedFaces(req: Request, res: Response) {
        try {
            const limit = parseInt(req.query.limit as string) || 50;
            const faces = await FaceRepository.getUnidentifiedFaces(limit);
            
            res.json({ faces });
            
        } catch (error) {
            console.error('Error fetching unidentified faces:', error);
            res.status(500).json({ error: 'Failed to fetch unidentified faces' });
        }
    },
    
    // Assign person to a face
    async assignPersonToFace(req: Request, res: Response) {
        try {
            const faceId = parseInt(req.params.faceId);
            const { person_id, confidence } = req.body;
            
            if (isNaN(faceId) || !person_id) {
                return res.status(400).json({ error: 'Invalid face ID or person ID' });
            }
            
            await db('detected_faces')
                .where({ id: faceId })
                .update({
                    person_id,
                    person_confidence: confidence || 1.0,
                    updated_at: new Date()
                });
                
            res.json({ success: true });
            
        } catch (error) {
            console.error('Error assigning person to face:', error);
            res.status(500).json({ error: 'Failed to assign person' });
        }
    },

    // Get faces for a specific image with person assignments
    async getImageFaces(req: Request, res: Response) {
        try {
            const imageId = parseInt(req.params.id);
            
            if (isNaN(imageId)) {
                return res.status(400).json({ error: 'Invalid image ID' });
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

            res.json({ faces: enrichedFaces });
            
        } catch (error) {
            console.error('Error fetching image faces:', error);
            res.status(500).json({ error: 'Failed to fetch image faces' });
        }
    },

    // Get available cities for filtering
    async getAvailableCities(req: Request, res: Response) {
        try {
            const search = req.query.search as string;

            let query = db('geo_cities as gc')
                .join('image_geolocations as il', 'gc.id', 'il.city_id')
                .join('images', 'il.image_id', 'images.id')
                .select('gc.city')
                .where('images.processing_status', 'completed')
                .groupBy('gc.city')
                .orderBy('gc.city');

            // Add search filter if provided
            if (search && search.trim()) {
                query = query.where('gc.city', 'like', `%${search.trim()}%`);
                console.log(`[CITIES] Searching for cities matching: "${search.trim()}"`);
            } else {
                console.log(`[CITIES] Loading all available cities`);
            }

            const cities = await query;
            const cityNames = cities.map(c => c.city);
            
            console.log(`[CITIES] Returning ${cityNames.length} cities`);
            res.json(cityNames);
            
        } catch (error) {
            console.error('Error fetching available cities:', error);
            res.status(500).json({ error: 'Failed to fetch available cities' });
        }
    },

    // Soft delete an image (move to trash)
    async deleteImage(req: Request, res: Response) {
        try {
            const imageId = parseInt(req.params.id);
            const reason = (req.body && req.body.reason) || 'User deleted via mobile app';
            const deletedBy = (req.body && req.body.deletedBy) || 'mobile-user';
            
            if (isNaN(imageId)) {
                return res.status(400).json({ error: 'Invalid image ID' });
            }
            
            // Get image details first
            const image = await db('images')
                .where('id', imageId)
                .whereNull('deleted_at') // Make sure it's not already deleted
                .first();
                
            if (!image) {
                return res.status(404).json({ error: 'Image not found or already deleted' });
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
            
            res.json({ 
                success: true, 
                message: `Image ${image.filename} moved to trash`,
                deletedId: imageId,
                canRestore: true
            });
            
        } catch (error: any) {
            console.error('Error deleting image:', {
                error: error?.message,
                stack: error?.stack,
                code: error?.code,
                imageId: req.params.id
            });
            res.status(500).json({ error: 'Failed to delete image', details: error?.message });
        }
    },
    
    // Get trash (soft-deleted images)
    async getTrash(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
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
            
            res.json({
                images: trashedImages,
                pagination: {
                    page,
                    limit,
                    total: parseInt(totalCount?.count as string) || 0,
                    hasNext: (page * limit) < (parseInt(totalCount?.count as string) || 0)
                }
            });
            
        } catch (error) {
            console.error('Error fetching trash:', error);
            res.status(500).json({ error: 'Failed to fetch trash' });
        }
    },
    
    // Restore image from trash
    async restoreImage(req: Request, res: Response) {
        try {
            const imageId = parseInt(req.params.id);
            
            if (isNaN(imageId)) {
                return res.status(400).json({ error: 'Invalid image ID' });
            }
            
            // Get deleted image
            const image = await db('images')
                .where('id', imageId)
                .whereNotNull('deleted_at')
                .first();
                
            if (!image) {
                return res.status(404).json({ error: 'Deleted image not found' });
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
            
            res.json({ 
                success: true, 
                message: `Image ${image.filename} restored from trash`,
                restoredId: imageId
            });
            
        } catch (error) {
            console.error('Error restoring image:', error);
            res.status(500).json({ error: 'Failed to restore image' });
        }
    },
    
    // Permanently delete image from trash (hard delete)
    async permanentlyDeleteImage(req: Request, res: Response) {
        try {
            const imageId = parseInt(req.params.id);
            
            if (isNaN(imageId)) {
                return res.status(400).json({ error: 'Invalid image ID' });
            }
            
            // Get deleted image
            const image = await db('images')
                .where('id', imageId)
                .whereNotNull('deleted_at')
                .first();
                
            if (!image) {
                return res.status(404).json({ error: 'Deleted image not found in trash' });
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
            
            res.json({ 
                success: true, 
                message: `Image ${image.filename} permanently deleted`,
                deletedId: imageId
            });
            
        } catch (error) {
            console.error('Error permanently deleting image:', error);
            res.status(500).json({ error: 'Failed to permanently delete image' });
        }
    }
};