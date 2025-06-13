import { Request, Response } from 'express';
import { ImageRepository, FaceRepository, MetadataRepository, DatabaseUtils, db } from '../models/database';
import { cache, getCacheKey } from '../util/cache';

// Main gallery list resolver - optimized database version with cursor-based pagination
export const GalleryListResolver = async (req: Request, res: Response) => {
    try {
        // Support both cursor-based and traditional pagination
        const limit = parseInt(req.query.limit as string) || 50;
        const cursor = req.query.cursor as string; // ISO date string for cursor
        const page = parseInt(req.query.page as string); // Optional fallback to offset pagination
        
        // Create cache key for this request
        const cacheKey = getCacheKey('gallery', { limit, cursor, page });
        
        // Check cache first (60 second TTL for fast-changing data)
        const cachedResult = cache.get(cacheKey);
        if (cachedResult) {
            res.json(cachedResult);
            return;
        }
        
        let query = db('images')
            .leftJoin('detected_faces', 'images.id', 'detected_faces.image_id')
            .select([
                'images.id',
                'images.filename',
                'images.original_path',
                'images.thumbnail_path',
                'images.dominant_color',
                'images.date_taken',
                'images.date_processed',
                'images.processing_status'
            ])
            .count('detected_faces.id as face_count')
            .where('images.processing_status', 'completed')
            .groupBy('images.id')
            .orderBy('images.date_processed', 'desc')  // Most recently processed first
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
        
        // Get face image paths for each image in a separate optimized query
        const imageIds = imagesWithFaces.map(img => img.id);
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
                facesByImage[face.image_id].push(face.face_image_path);
            });
        }
        
        // Check if there are more results (for cursor pagination)
        const hasMore = imagesWithFaces.length > limit;
        const results = hasMore ? imagesWithFaces.slice(0, limit) : imagesWithFaces;
        
        // Combine results
        const finalResults = results.map(image => ({
            ...image,
            face_count: parseInt(image.face_count as string),
            faces: facesByImage[image.id as number] || []
        }));
        
        // Generate next cursor from the last item (always use ID for consistency)
        let nextCursor = null;
        if (finalResults.length > 0) {
            const lastItem = finalResults[finalResults.length - 1] as any;
            nextCursor = lastItem.id.toString();
        }
        
        const response: any = {
            limit,
            count: finalResults.length,
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
            
            res.json(imageData);
            
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
                    facesByImage[face.image_id].push(face.face_image_path);
                    faceCounts[face.image_id]++;
                });
            }
            
            const imagesWithFaces = images.map(image => ({
                ...image,
                face_count: faceCounts[image.id!] || 0,
                faces: facesByImage[image.id!] || []
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
                    'detected_faces.detection_confidence',
                    'detected_faces.person_id',
                    'persons.name as person_name'
                ])
                .where('detected_faces.image_id', imageId)
                .whereNotNull('detected_faces.face_image_path');

            res.json({ faces });
            
        } catch (error) {
            console.error('Error fetching image faces:', error);
            res.status(500).json({ error: 'Failed to fetch image faces' });
        }
    }
};