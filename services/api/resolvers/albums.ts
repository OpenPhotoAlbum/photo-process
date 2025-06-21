import { db } from '../models/database';

/**
 * Get all albums with basic info and image counts
 */
export const getAlbums = async (query: any) => {
    const { source, limit = 50, offset = 0 } = query;
    
    let albumQuery = db('albums')
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
        albumQuery = albumQuery.where('albums.source', source);
    }
    
    const albums = await albumQuery;
    
    // Get total count for pagination
    const totalResult = await db('albums')
        .where('is_active', true)
        .modify(queryBuilder => {
            if (source) {
                queryBuilder.where('source', source);
            }
        })
        .count('* as count')
        .first();
        
    return {
        albums,
        pagination: {
            total: Number(totalResult?.count) || 0,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + albums.length < Number(totalResult?.count)
        }
    };
};

/**
 * Get all people from Google tags with counts
 */
export const getGooglePeople = async () => {
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
        
    return { people };
};

/**
 * Get all images tagged with a specific Google person
 */
export const getGooglePersonImages = async (personName: string, query: any) => {
    const { limit = 50, offset = 0, includeMetadata = true } = query;
    
    // Build base query to get images tagged with this person
    let imageQuery = db('images')
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
        imageQuery = imageQuery
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
    
    const images = await imageQuery;
    
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
        
    return {
        images,
        personStats,
        pagination: {
            total: Number(totalResult?.count) || 0,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + images.length < Number(totalResult?.count)
        }
    };
};

/**
 * Get all images tagged with a specific person ID (linked Google person)
 */
export const getPersonGoogleImages = async (personId: number, query: any) => {
    const { limit = 50, offset = 0, includeMetadata = true } = query;
    
    // Verify person exists
    const person = await db('persons').where('id', personId).first();
    if (!person) {
        const error = new Error('Person not found');
        (error as any).status = 404;
        throw error;
    }
    
    // Build base query to get images tagged with this person via Google tags
    let imageQuery = db('images')
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
        imageQuery = imageQuery
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
    
    const images = await imageQuery;
    
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
        
    return {
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
    };
};

/**
 * Get album system statistics
 */
export const getAlbumStats = async () => {
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
    
    return {
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
    };
};

/**
 * Get detailed album information with images
 */
export const getAlbumDetail = async (albumId: number, query: any) => {
    const { limit = 100, offset = 0 } = query;
    
    // Get album details
    const album = await db('albums').where('id', albumId).first();
    
    if (!album) {
        const error = new Error('Album not found');
        (error as any).status = 404;
        throw error;
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
        .where('album_images.album_id', albumId)
        .orderBy('album_images.sort_order')
        .limit(Number(limit))
        .offset(Number(offset));
    
    // Get people tags for this album
    const peopleTags = await db('google_people_tags')
        .select(['person_name', db.raw('COUNT(*) as count')])
        .join('album_images', 'google_people_tags.image_id', 'album_images.image_id')
        .where('album_images.album_id', albumId)
        .groupBy('person_name')
        .orderBy('count', 'desc');
        
    // Get location enrichments for this album
    const locations = await db('google_location_enrichments')
        .where('album_id', albumId)
        .orWhere(function() {
            this.whereIn('image_id', 
                db('album_images')
                    .select('image_id')
                    .where('album_id', albumId)
            );
        });
    
    return {
        album,
        images,
        peopleTags,
        locations,
        pagination: {
            limit: Number(limit),
            offset: Number(offset),
            count: images.length
        }
    };
};

/**
 * Link a Google person tag to an existing person in our system
 */
export const linkGooglePerson = async (data: { googlePersonName: string; personId: number }) => {
    const { googlePersonName, personId } = data;
    
    if (!googlePersonName || !personId) {
        throw new Error('googlePersonName and personId are required');
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
    
    return { 
        message: 'Person linked successfully',
        updated_tags: updated
    };
};