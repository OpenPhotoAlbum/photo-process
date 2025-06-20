import express, { Request, Response } from 'express';
import { db } from '../models/database';

const router = express.Router();

/**
 * GET /api/albums
 * Get all albums with basic info and image counts
 */
router.get('/', async (req, res) => {
    try {
        const { source, limit = 50, offset = 0 } = req.query;
        
        let query = db('albums')
            .select([
                'albums.*',
                db.raw('COUNT(album_images.image_id) as actual_image_count')
            ])
            .leftJoin('album_images', 'albums.id', 'album_images.album_id')
            .where('albums.is_active', true)
            .groupBy('albums.id')
            .orderBy('albums.album_date', 'desc')
            .limit(Number(limit))
            .offset(Number(offset));
            
        if (source) {
            query = query.where('albums.source', source);
        }
        
        const albums = await query;
        
        // Get total count for pagination
        const totalResult = await db('albums')
            .where('is_active', true)
            .modify(query => {
                if (source) {
                    query.where('source', source);
                }
            })
            .count('* as count')
            .first();
            
        res.json({
            albums,
            pagination: {
                total: Number(totalResult?.count) || 0,
                limit: Number(limit),
                offset: Number(offset),
                hasMore: Number(offset) + albums.length < Number(totalResult?.count)
            }
        });
        
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
        const people = await db('google_people_tags')
            .select([
                'person_name',
                'person_id',
                db.raw('COUNT(*) as tag_count'),
                db.raw('COUNT(DISTINCT google_people_tags.image_id) as image_count')
            ])
            .leftJoin('persons', 'google_people_tags.person_id', 'persons.id')
            .groupBy('person_name', 'person_id')
            .orderBy('tag_count', 'desc');
            
        res.json({ people });
        
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
        const { personName } = req.params;
        const { limit = 50, offset = 0, includeMetadata = true } = req.query;
        
        // Build base query to get images tagged with this person
        let query = db('images')
            .select([
                'images.*',
                'google_people_tags.person_name',
                'google_people_tags.is_verified',
                'google_people_tags.tagged_at'
            ])
            .join('google_people_tags', 'images.id', 'google_people_tags.image_id')
            .where('google_people_tags.person_name', personName)
            .orderBy('images.date_taken', 'desc')
            .limit(Number(limit))
            .offset(Number(offset));
            
        // Add Google metadata if requested
        if (includeMetadata === 'true') {
            query = query
                .leftJoin('google_metadata', 'images.id', 'google_metadata.image_id')
                .select([
                    'images.*',
                    'google_people_tags.person_name',
                    'google_people_tags.is_verified', 
                    'google_people_tags.tagged_at',
                    'google_metadata.google_view_count',
                    'google_metadata.device_type',
                    'google_metadata.google_title',
                    'google_metadata.google_description'
                ]);
        }
        
        const images = await query;
        
        // Get total count for pagination
        const totalResult = await db('google_people_tags')
            .join('images', 'google_people_tags.image_id', 'images.id')
            .where('google_people_tags.person_name', personName)
            .count('* as count')
            .first();
            
        // Get person tag statistics
        const personStats = await db('google_people_tags')
            .select([
                'person_name',
                'person_id',
                'source',
                db.raw('COUNT(*) as total_tags'),
                db.raw('COUNT(DISTINCT image_id) as unique_images'),
                db.raw('SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END) as verified_tags')
            ])
            .where('person_name', personName)
            .groupBy('person_name', 'person_id', 'source')
            .first();
            
        res.json({
            images,
            personStats,
            pagination: {
                total: Number(totalResult?.count) || 0,
                limit: Number(limit),
                offset: Number(offset),
                hasMore: Number(offset) + images.length < Number(totalResult?.count)
            }
        });
        
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
        const { personId } = req.params;
        const { limit = 50, offset = 0, includeMetadata = true } = req.query;
        
        // Verify person exists
        const person = await db('persons').where('id', personId).first();
        if (!person) {
            return res.status(404).json({ error: 'Person not found' });
        }
        
        // Build base query to get images tagged with this person via Google tags
        let query = db('images')
            .select([
                'images.*',
                'google_people_tags.person_name as google_name',
                'google_people_tags.is_verified',
                'google_people_tags.tagged_at'
            ])
            .join('google_people_tags', 'images.id', 'google_people_tags.image_id')
            .where('google_people_tags.person_id', personId)
            .orderBy('images.date_taken', 'desc')
            .limit(Number(limit))
            .offset(Number(offset));
            
        // Add Google metadata if requested
        if (includeMetadata === 'true') {
            query = query
                .leftJoin('google_metadata', 'images.id', 'google_metadata.image_id')
                .select([
                    'images.*',
                    'google_people_tags.person_name as google_name',
                    'google_people_tags.is_verified',
                    'google_people_tags.tagged_at',
                    'google_metadata.google_view_count',
                    'google_metadata.device_type',
                    'google_metadata.google_title',
                    'google_metadata.google_description'
                ]);
        }
        
        const images = await query;
        
        // Get total count for pagination
        const totalResult = await db('google_people_tags')
            .join('images', 'google_people_tags.image_id', 'images.id')
            .where('google_people_tags.person_id', personId)
            .count('* as count')
            .first();
            
        // Get combined statistics (Google tags + face detection)
        const [googleStats, faceStats] = await Promise.all([
            db('google_people_tags')
                .select([
                    db.raw('COUNT(*) as google_tags'),
                    db.raw('COUNT(DISTINCT image_id) as google_images'),
                    db.raw('SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END) as verified_tags')
                ])
                .where('person_id', personId)
                .first(),
            db('detected_faces')
                .select([
                    db.raw('COUNT(*) as detected_faces'),
                    db.raw('COUNT(DISTINCT image_id) as face_images')
                ])
                .where('person_id', personId)
                .first()
        ]);
            
        res.json({
            person,
            images,
            statistics: {
                google: googleStats,
                faces: faceStats
            },
            pagination: {
                total: Number(totalResult?.count) || 0,
                limit: Number(limit),
                offset: Number(offset),
                hasMore: Number(offset) + images.length < Number(totalResult?.count)
            }
        });
        
    } catch (error) {
        console.error('Error fetching Google images for person:', error);
        res.status(500).json({ error: 'Failed to fetch Google images for person' });
    }
});

/**
 * GET /api/albums/stats
 * Get album system statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const [
            totalAlbums,
            googleAlbums,
            totalImages,
            imagesInAlbums,
            totalPeopleTags,
            totalLocationEnrichments
        ] = await Promise.all([
            db('albums').where('is_active', true).count('* as count').first(),
            db('albums').where('is_active', true).where('source', 'google_takeout').count('* as count').first(),
            db('images').count('* as count').first(),
            db('album_images').countDistinct('image_id as count').first(),
            db('google_people_tags').count('* as count').first(),
            db('google_location_enrichments').count('* as count').first()
        ]);
        
        res.json({
            albums: {
                total: Number(totalAlbums?.count) || 0,
                google: Number(googleAlbums?.count) || 0
            },
            images: {
                total: Number(totalImages?.count) || 0,
                inAlbums: Number(imagesInAlbums?.count) || 0
            },
            metadata: {
                peopleTags: Number(totalPeopleTags?.count) || 0,
                locationEnrichments: Number(totalLocationEnrichments?.count) || 0
            }
        });
        
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
        const { id } = req.params;
        const { limit = 100, offset = 0 } = req.query;
        
        // Get album details
        const album = await db('albums').where('id', id).first();
        
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }
        
        // Get album images with metadata
        const images = await db('images')
            .select([
                'images.*',
                'google_metadata.google_view_count',
                'google_metadata.device_type'
            ])
            .join('album_images', 'images.id', 'album_images.image_id')
            .leftJoin('google_metadata', 'images.id', 'google_metadata.image_id')
            .where('album_images.album_id', id)
            .orderBy('album_images.sort_order')
            .limit(Number(limit))
            .offset(Number(offset));
        
        // Get people tags for this album
        const peopleTags = await db('google_people_tags')
            .select(['person_name', db.raw('COUNT(*) as count')])
            .join('album_images', 'google_people_tags.image_id', 'album_images.image_id')
            .where('album_images.album_id', id)
            .groupBy('person_name')
            .orderBy('count', 'desc');
            
        // Get location enrichments for this album
        const locations = await db('google_location_enrichments')
            .where('album_id', id)
            .orWhere(function() {
                this.whereIn('image_id', 
                    db('album_images')
                        .select('image_id')
                        .where('album_id', id)
                );
            });
        
        res.json({
            album,
            images,
            peopleTags,
            locations,
            pagination: {
                limit: Number(limit),
                offset: Number(offset),
                count: images.length
            }
        });
        
    } catch (error) {
        console.error('Error fetching album details:', error);
        res.status(500).json({ error: 'Failed to fetch album details' });
    }
});

/**
 * POST /api/albums/:id/link-person
 * Link a Google person tag to an existing person in our system
 */
router.post('/:id/link-person', async (req: any, res: any) => {
    try {
        const { googlePersonName, personId } = req.body;
        
        if (!googlePersonName || !personId) {
            return res.status(400).json({ error: 'googlePersonName and personId are required' });
        }
        
        // Update all Google people tags for this person
        const updated = await db('google_people_tags')
            .where('person_name', googlePersonName)
            .update({
                person_id: personId,
                is_verified: true
            });
            
        // Update person's Google information
        await db('persons').where('id', personId).update({
            google_person_name: googlePersonName,
            google_tag_count: updated,
            is_from_google: true
        });
        
        res.json({ 
            message: 'Person linked successfully',
            updated_tags: updated
        });
        
    } catch (error) {
        console.error('Error linking person:', error);
        res.status(500).json({ error: 'Failed to link person' });
    }
});

export default router;