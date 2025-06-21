import { Request, Response } from 'express';
import * as galleryResolvers from '../resolvers/gallery';

// Main gallery list resolver - optimized database version with cursor-based pagination
export const GalleryListResolver = async (req: Request, res: Response) => {
    try {
        const result = await galleryResolvers.getGalleryList(req.query);
        res.json(result);
    } catch (error) {
        console.error('[GALLERY] Database error:', error);
        res.status(500).json({ error: 'Failed to fetch gallery' });
    }
};

export const GalleryRoutes = {
    
    // Get detailed image data with metadata and faces
    async getImageDetails(req: Request, res: Response) {
        try {
            const imageId = parseInt(req.params.id);
            const result = await galleryResolvers.getImageDetails(imageId);
            res.json(result);
        } catch (error) {
            console.error('Error fetching image details:', error);
            const status = (error as any).status || 500;
            res.status(status).json({ 
                error: status === 404 ? 'Image not found' : 'Failed to fetch image details' 
            });
        }
    },
    
    // Search images with filters
    async searchImages(req: Request, res: Response) {
        try {
            const result = await galleryResolvers.searchImages(req.query);
            res.json(result);
        } catch (error) {
            console.error('Error searching images:', error);
            res.status(500).json({ error: 'Failed to search images' });
        }
    },
    
    // Get dashboard statistics
    async getDashboardStats(req: Request, res: Response) {
        try {
            const stats = await galleryResolvers.getDashboardStats();
            res.json(stats);
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            res.status(500).json({ error: 'Failed to fetch statistics' });
        }
    },
    
    // Get all persons for face identification
    async getPersons(req: Request, res: Response) {
        try {
            const result = await galleryResolvers.getPersons();
            res.json(result);
        } catch (error) {
            console.error('Error fetching persons:', error);
            res.status(500).json({ error: 'Failed to fetch persons' });
        }
    },
    
    // Get unidentified faces for manual identification
    async getUnidentifiedFaces(req: Request, res: Response) {
        try {
            const result = await galleryResolvers.getUnidentifiedFaces(req.query);
            res.json(result);
        } catch (error) {
            console.error('Error fetching unidentified faces:', error);
            res.status(500).json({ error: 'Failed to fetch unidentified faces' });
        }
    },
    
    // Assign person to a face
    async assignPersonToFace(req: Request, res: Response) {
        try {
            const faceId = parseInt(req.params.faceId);
            const result = await galleryResolvers.assignPersonToFace(faceId, req.body);
            res.json(result);
        } catch (error) {
            console.error('Error assigning person to face:', error);
            res.status(400).json({ 
                error: error instanceof Error ? error.message : 'Failed to assign person' 
            });
        }
    },

    // Get faces for a specific image with person assignments
    async getImageFaces(req: Request, res: Response) {
        try {
            const imageId = parseInt(req.params.id);
            const result = await galleryResolvers.getImageFaces(imageId);
            res.json(result);
        } catch (error) {
            console.error('Error fetching image faces:', error);
            res.status(400).json({ 
                error: error instanceof Error ? error.message : 'Failed to fetch image faces' 
            });
        }
    },

    // Get available cities for filtering
    async getAvailableCities(req: Request, res: Response) {
        try {
            const cities = await galleryResolvers.getAvailableCities(req.query);
            res.json(cities);
        } catch (error) {
            console.error('Error fetching available cities:', error);
            res.status(500).json({ error: 'Failed to fetch available cities' });
        }
    },

    // Soft delete an image (move to trash)
    async deleteImage(req: Request, res: Response) {
        try {
            const imageId = parseInt(req.params.id);
            const result = await galleryResolvers.deleteImage(imageId, req.body);
            res.json(result);
        } catch (error: any) {
            console.error('Error deleting image:', {
                error: error?.message,
                stack: error?.stack,
                code: error?.code,
                imageId: req.params.id
            });
            const status = (error as any).status || 500;
            res.status(status).json({ 
                error: status === 404 ? 'Image not found or already deleted' : 'Failed to delete image',
                details: error?.message 
            });
        }
    },
    
    // Get trash (soft-deleted images)
    async getTrash(req: Request, res: Response) {
        try {
            const result = await galleryResolvers.getTrash(req.query);
            res.json(result);
        } catch (error) {
            console.error('Error fetching trash:', error);
            res.status(500).json({ error: 'Failed to fetch trash' });
        }
    },
    
    // Restore image from trash
    async restoreImage(req: Request, res: Response) {
        try {
            const imageId = parseInt(req.params.id);
            const result = await galleryResolvers.restoreImage(imageId);
            res.json(result);
        } catch (error) {
            console.error('Error restoring image:', error);
            const status = (error as any).status || 500;
            res.status(status).json({ 
                error: status === 404 ? 'Deleted image not found' : 'Failed to restore image' 
            });
        }
    },
    
    // Permanently delete image from trash (hard delete)
    async permanentlyDeleteImage(req: Request, res: Response) {
        try {
            const imageId = parseInt(req.params.id);
            const result = await galleryResolvers.permanentlyDeleteImage(imageId);
            res.json(result);
        } catch (error) {
            console.error('Error permanently deleting image:', error);
            const status = (error as any).status || 500;
            res.status(status).json({ 
                error: status === 404 ? 'Deleted image not found in trash' : 'Failed to permanently delete image' 
            });
        }
    }
};