import express, { Request, Response } from 'express';
import * as albumsResolvers from '../resolvers/albums';

const router = express.Router();

/**
 * GET /api/albums
 * Get all albums with basic info and image counts
 */
router.get('/', async (req, res) => {
    try {
        const result = await albumsResolvers.getAlbums(req.query);
        res.json(result);
    } catch (error) {
        console.error('Error fetching albums:', error);
        res.status(500).json({ error: 'Failed to fetch albums' });
    }
});

/**
 * GET /api/albums/google-people
 * Get all people from Google tags with counts
 */
router.get('/google-people', async (req: Request, res: Response) => {
    try {
        const result = await albumsResolvers.getGooglePeople();
        res.json(result);
    } catch (error) {
        console.error('Error fetching Google people:', error);
        res.status(500).json({ error: 'Failed to fetch Google people' });
    }
});

/**
 * GET /api/albums/google-people/:personName/images
 * Get all images tagged with a specific Google person
 */
router.get('/google-people/:personName/images', async (req: Request, res: Response) => {
    try {
        const result = await albumsResolvers.getGooglePersonImages(req.params.personName, req.query);
        res.json(result);
    } catch (error) {
        console.error('Error fetching images for Google person:', error);
        res.status(500).json({ error: 'Failed to fetch images for person' });
    }
});

/**
 * GET /api/albums/persons/:personId/google-images
 * Get all images tagged with a specific person ID (linked Google person)
 */
router.get('/persons/:personId/google-images', async (req: any, res: any) => {
    try {
        const personId = parseInt(req.params.personId);
        const result = await albumsResolvers.getPersonGoogleImages(personId, req.query);
        res.json(result);
    } catch (error) {
        console.error('Error fetching Google images for person:', error);
        const status = (error as any).status || 500;
        res.status(status).json({ 
            error: status === 404 ? 'Person not found' : 'Failed to fetch Google images for person' 
        });
    }
});

/**
 * GET /api/albums/stats
 * Get album system statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const result = await albumsResolvers.getAlbumStats();
        res.json(result);
    } catch (error) {
        console.error('Error fetching album stats:', error);
        res.status(500).json({ error: 'Failed to fetch album stats' });
    }
});

/**
 * GET /api/albums/:id
 * Get detailed album information with images
 */
router.get('/:id', async (req: any, res: any) => {
    try {
        const albumId = parseInt(req.params.id);
        const result = await albumsResolvers.getAlbumDetail(albumId, req.query);
        res.json(result);
    } catch (error) {
        console.error('Error fetching album details:', error);
        const status = (error as any).status || 500;
        res.status(status).json({ 
            error: status === 404 ? 'Album not found' : 'Failed to fetch album details' 
        });
    }
});

/**
 * POST /api/albums/:id/link-person
 * Link a Google person tag to an existing person in our system
 */
router.post('/:id/link-person', async (req: any, res: any) => {
    try {
        const result = await albumsResolvers.linkGooglePerson(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error linking person:', error);
        res.status(400).json({ 
            error: error instanceof Error ? error.message : 'Failed to link person' 
        });
    }
});

export default router;