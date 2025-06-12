import { Request, Response } from 'express';
import { ImageRepository, FaceRepository, MetadataRepository, DatabaseUtils, db } from '../models/database';

export const GalleryDBRoutes = {
    
    // Get paginated list of processed images from database
    async getImages(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const offset = (page - 1) * limit;
            
            const images = await ImageRepository.getProcessedImages(limit, offset);
            
            // Get face counts for each image
            const imagesWithFaces = await Promise.all(
                images.map(async (image) => {
                    const faces = await FaceRepository.getFacesByImage(image.id!);
                    return {
                        id: image.id,
                        filename: image.filename,
                        original_path: image.original_path,
                        thumbnail_path: image.thumbnail_path,
                        dominant_color: image.dominant_color,
                        date_taken: image.date_taken,
                        face_count: faces.length,
                        faces: faces.map(f => f.face_image_path).filter(Boolean)
                    };
                })
            );
            
            res.json({
                page,
                limit,
                count: imagesWithFaces.length,
                images: imagesWithFaces
            });
            
        } catch (error) {
            console.error('Error fetching images from database:', error);
            res.status(500).json({ error: 'Failed to fetch images' });
        }
    },
    
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
            
            // Get face counts for results
            const imagesWithFaces = await Promise.all(
                images.map(async (image) => {
                    const faces = await FaceRepository.getFacesByImage(image.id!);
                    return {
                        ...image,
                        face_count: faces.length,
                        faces: faces.map(f => f.face_image_path).filter(Boolean)
                    };
                })
            );
            
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
    }
};