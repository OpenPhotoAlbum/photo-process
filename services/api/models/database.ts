import knex from 'knex';
import path from 'path';
import { configManager } from '../util/config-manager';

// Load knex configuration from API service
const knexfilePath = path.join(__dirname, '../knexfile.platform.js');
const knexConfig = require(knexfilePath);

// Use development environment by default
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

export const db = knex(config);

// Database Models
export interface Image {
    id?: number;
    filename: string;
    original_path: string;
    processed_path?: string;
    thumbnail_path?: string;
    file_hash?: string;
    file_size?: number;
    mime_type?: string;
    width?: number;
    height?: number;
    dominant_color?: string;
    processing_status: 'pending' | 'processing' | 'completed' | 'failed';
    processing_error?: string;
    date_taken?: Date;
    date_processed?: Date;
    created_at?: Date;
    updated_at?: Date;
    is_screenshot?: boolean;
    screenshot_confidence?: number;
    screenshot_reasons?: string;
    junk_status?: 'unreviewed' | 'confirmed_junk' | 'confirmed_important';
    junk_reviewed_at?: Date;
    
    // New hash-based file organization fields
    relative_media_path?: string;     // Relative path to media file in processed/media/
    relative_meta_path?: string;      // Relative path to metadata JSON in processed/meta/
    source_filename?: string;         // Original filename without hash or path
    date_imported?: Date;             // When file was copied to processed directory
    migration_status?: 'pending' | 'copied' | 'verified' | 'failed'; // Migration status
    
    // Astrophotography detection fields
    is_astrophotography?: boolean;
    astro_confidence?: number;
    astro_details?: any;              // JSON object with detection details
    astro_classification?: string;    // e.g., 'stars', 'nebula', 'galaxy', 'moon', 'planets'
    astro_detected_at?: Date;
}

export interface ImageMetadata {
    id?: number;
    image_id: number;
    camera_make?: string;
    camera_model?: string;
    software?: string;
    lens_model?: string;
    focal_length?: number;
    aperture?: string;
    shutter_speed?: string;
    iso?: number;
    flash?: string;
    white_balance?: string;
    exposure_mode?: string;
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
    country?: string;
    altitude?: number;
    orientation?: number;
    color_space?: string;
    raw_exif?: any;
    created_at?: Date;
    updated_at?: Date;
}

export interface DetectedFace {
    id?: number;
    image_id: number;
    face_image_path?: string;
    relative_face_path?: string;      // New: relative path to face image in processed/faces/
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
    detection_confidence: number;
    predicted_gender?: string;
    gender_confidence?: number;
    age_min?: number;
    age_max?: number;
    age_confidence?: number;
    pitch?: number;
    roll?: number;
    yaw?: number;
    landmarks?: any;
    face_embedding?: any;
    person_id?: number;
    person_confidence?: number;
    recognition_method?: 'manual' | 'auto' | 'compreface' | 'clustering' | 'manual_review' | 'auto_compreface' | 'manual_invalid' | 'manual_unknown';
    needs_review?: boolean;
    assigned_at?: Date;
    assigned_by?: string;
    is_training_image?: boolean;
    similarity_score?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface Person {
    id?: number;
    name: string;
    notes?: string;
    compreface_subject_id?: string;
    primary_face_path?: string;
    average_embedding?: any;
    face_count: number;
    auto_recognize?: boolean;
    recognition_status?: 'untrained' | 'training' | 'trained' | 'failed';
    training_face_count?: number;
    last_trained_at?: Date;
    avg_recognition_confidence?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface ImageTag {
    id?: number;
    image_id: number;
    tag: string;
    tag_type: 'manual' | 'auto' | 'ai';
    confidence?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface DetectedObject {
    id?: number;
    image_id: number;
    class: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface ProcessingJob {
    id?: number;
    image_id: number;
    job_type: 'extract_metadata' | 'detect_faces' | 'generate_thumbnail' | 'analyze_content' | 'detect_objects';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error_message?: string;
    started_at?: Date;
    completed_at?: Date;
    created_at?: Date;
    updated_at?: Date;
}

export interface FaceSimilarity {
    id?: number;
    face_a_id: number;
    face_b_id: number;
    similarity_score: number;
    comparison_method?: 'embedding_distance' | 'compreface_api' | 'manual' | 'bbox_intersection';
    calculated_at?: Date;
}

export interface FaceCluster {
    id?: number;
    cluster_name: string;
    average_embedding: any; // JSON blob
    face_count?: number;
    avg_similarity?: number;
    assigned_person_id?: number;
    is_reviewed?: boolean;
    notes?: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface FaceClusterMember {
    id?: number;
    cluster_id: number;
    face_id: number;
    similarity_to_cluster: number;
    is_representative?: boolean;
    created_at?: Date;
    updated_at?: Date;
}

// Database Access Layer
export class ImageRepository {
    
    static async create(image: Omit<Image, 'id'>): Promise<number> {
        const [id] = await db('images').insert(image);
        return id;
    }
    
    static async findById(id: number): Promise<Image | undefined> {
        return db('images').where({ id }).first();
    }
    
    static async findByHash(file_hash: string): Promise<Image | undefined> {
        return db('images').where({ file_hash }).first();
    }
    
    static async findByPath(original_path: string): Promise<Image | undefined> {
        return db('images').where({ original_path }).first();
    }
    
    static async updateProcessingStatus(id: number, status: Image['processing_status'], error?: string): Promise<void> {
        const updateData: any = { processing_status: status };
        if (status === 'completed') {
            updateData.date_processed = new Date();
        }
        if (error) {
            updateData.processing_error = error;
        }
        await db('images').where({ id }).update(updateData);
    }
    
    static async getProcessedImages(limit = 100, offset = 0): Promise<Image[]> {
        return db('images')
            .where({ processing_status: 'completed' })
            .orderBy('date_taken', 'desc')
            .limit(limit)
            .offset(offset);
    }
    
    static async getImagesWithObjects(): Promise<Image[]> {
        const images = await db('images')
            .join('detected_objects', 'images.id', 'detected_objects.image_id')
            .select('images.*')
            .distinct('images.id');
        return images;
    }

    static async searchImages(filters: {
        dateFrom?: Date;
        dateTo?: Date;
        camera?: string;
        location?: string;
        hasFaces?: boolean;
        tags?: string[];
        isAstrophotography?: boolean;
    }): Promise<Image[]> {
        let query = db('images')
            .leftJoin('image_metadata', 'images.id', 'image_metadata.image_id')
            .leftJoin('detected_faces', 'images.id', 'detected_faces.image_id')
            .where('images.processing_status', 'completed')
            .where(function() {
                this.where('images.is_screenshot', false)
                    .orWhereNull('images.is_screenshot');
            })
            .where(function() {
                this.whereNot('images.junk_status', 'confirmed_junk')
                    .orWhereNull('images.junk_status');
            })
            .select('images.*');
            
        if (filters.dateFrom) {
            query = query.where('images.date_taken', '>=', filters.dateFrom);
        }
        if (filters.dateTo) {
            query = query.where('images.date_taken', '<=', filters.dateTo);
        }
        if (filters.camera) {
            query = query.where('image_metadata.camera_make', 'like', `%${filters.camera}%`)
                          .orWhere('image_metadata.camera_model', 'like', `%${filters.camera}%`);
        }
        if (filters.location) {
            query = query.where('image_metadata.city', 'like', `%${filters.location}%`)
                          .orWhere('image_metadata.state', 'like', `%${filters.location}%`)
                          .orWhere('image_metadata.country', 'like', `%${filters.location}%`);
        }
        if (filters.hasFaces !== undefined) {
            if (filters.hasFaces) {
                query = query.whereNotNull('detected_faces.id');
            } else {
                query = query.whereNull('detected_faces.id');
            }
        }
        if (filters.isAstrophotography !== undefined) {
            query = query.where('images.is_astrophotography', filters.isAstrophotography);
        }
        
        return query.groupBy('images.id').orderBy('images.date_taken', 'desc');
    }
    
    static async updateScreenshotDetection(id: number, isScreenshot: boolean, confidence: number, reasons: string[]): Promise<void> {
        await db('images').where({ id }).update({
            is_screenshot: isScreenshot,
            screenshot_confidence: confidence,
            screenshot_reasons: JSON.stringify(reasons),
            updated_at: new Date()
        });
    }
    
    static async updateJunkStatus(id: number, status: 'confirmed_junk' | 'confirmed_important'): Promise<void> {
        await db('images').where({ id }).update({
            junk_status: status,
            junk_reviewed_at: new Date(),
            updated_at: new Date()
        });
    }
    
    static async getScreenshotCandidates(limit = 50): Promise<Image[]> {
        return db('images')
            .where('processing_status', 'completed')
            .where('is_screenshot', true)
            .where('junk_status', 'unreviewed')
            .orderBy('screenshot_confidence', 'desc')
            .limit(limit);
    }
    
    static async getJunkReviewStats(): Promise<{ total: number; reviewed: number; confirmed_junk: number; confirmed_important: number }> {
        const [totalResult, reviewedResult, junkResult, importantResult] = await Promise.all([
            db('images').where('is_screenshot', true).count('* as count').first(),
            db('images').where('is_screenshot', true).whereNot('junk_status', 'unreviewed').count('* as count').first(),
            db('images').where('junk_status', 'confirmed_junk').count('* as count').first(),
            db('images').where('junk_status', 'confirmed_important').count('* as count').first()
        ]);
        
        return {
            total: Number(totalResult?.count) || 0,
            reviewed: Number(reviewedResult?.count) || 0,
            confirmed_junk: Number(junkResult?.count) || 0,
            confirmed_important: Number(importantResult?.count) || 0
        };
    }
    
    static async update(id: number, updates: Partial<Image>): Promise<void> {
        await db('images').where({ id }).update({
            ...updates,
            updated_at: new Date()
        });
    }
    
    static async findMany(whereCondition: Partial<Image> = {}, limit?: number): Promise<Image[]> {
        let query = db('images').where(whereCondition);
        if (limit) {
            query = query.limit(limit);
        }
        return query;
    }
    
    // Hash-based file management methods
    static async findByRelativePath(relative_media_path: string): Promise<Image | undefined> {
        return db('images').where({ relative_media_path }).first();
    }
    
    static async updateMigrationStatus(id: number, status: Image['migration_status']): Promise<void> {
        await db('images').where({ id }).update({ 
            migration_status: status,
            updated_at: new Date()
        });
    }
    
    static async updateHashInfo(id: number, hashInfo: {
        file_hash: string;
        relative_media_path: string;
        relative_meta_path?: string;
        source_filename: string;
        file_size: number;
        date_imported: Date;
        migration_status: Image['migration_status'];
    }): Promise<void> {
        await db('images').where({ id }).update({
            ...hashInfo,
            updated_at: new Date()
        });
    }
    
    static async getMigrationStats(): Promise<{
        total: number;
        pending: number;
        copied: number;
        verified: number;
        failed: number;
    }> {
        const stats = await db('images')
            .select('migration_status')
            .count('* as count')
            .groupBy('migration_status');
            
        const result = {
            total: 0,
            pending: 0,
            copied: 0,
            verified: 0,
            failed: 0
        };
        
        stats.forEach(stat => {
            const status = stat.migration_status as string;
            const count = Number(stat.count);
            result.total += count;
            if (status in result) {
                (result as any)[status] = count;
            }
        });
        
        return result;
    }
    
    static async getImageByHashOrPath(identifier: string): Promise<Image | undefined> {
        // Try hash first, then relative path, then original path
        return await db('images')
            .where('file_hash', identifier)
            .orWhere('relative_media_path', identifier)
            .orWhere('original_path', identifier)
            .first();
    }
}

export class FaceRepository {
    
    static async createFace(face: Omit<DetectedFace, 'id'>): Promise<number> {
        const [id] = await db('detected_faces').insert(face);
        return id;
    }
    
    static async getFacesByImage(image_id: number): Promise<DetectedFace[]> {
        return db('detected_faces').where({ image_id });
    }
    
    static async getFacesByPerson(person_id: number): Promise<DetectedFace[]> {
        return db('detected_faces').where({ person_id });
    }
    
    static async getUnidentifiedFaces(
        limit = 50, 
        random = false, 
        filters: {
            gender?: string;
            ageMin?: number;
            ageMax?: number;
            minConfidence?: number;
            maxConfidence?: number;
            minGenderConfidence?: number;
            minAgeConfidence?: number;
        } = {}
    ): Promise<DetectedFace[]> {
        // Get faces that are truly unidentified (NULL) and exclude invalid/rejected faces
        const query = db('detected_faces')
            .whereNull('person_id')  // Only NULL person_id (truly unidentified)
            .whereNotNull('face_image_path');  // Must have face image
            
        // Apply filters
        if (filters.gender) {
            query.where('predicted_gender', filters.gender);
        }
        
        if (filters.ageMin !== undefined) {
            query.where('age_max', '>=', filters.ageMin);
        }
        
        if (filters.ageMax !== undefined) {
            query.where('age_min', '<=', filters.ageMax);
        }
        
        if (filters.minConfidence !== undefined) {
            query.where('detection_confidence', '>=', filters.minConfidence);
        }
        
        if (filters.maxConfidence !== undefined) {
            query.where('detection_confidence', '<=', filters.maxConfidence);
        }
        
        if (filters.minGenderConfidence !== undefined) {
            query.where('gender_confidence', '>=', filters.minGenderConfidence);
        }
        
        if (filters.minAgeConfidence !== undefined) {
            query.where('age_confidence', '>=', filters.minAgeConfidence);
        }
        
        query.limit(limit);
            
        if (random) {
            // Use database-specific random ordering
            query.orderByRaw('RAND()');  // MySQL syntax
        } else {
            query.orderBy('detection_confidence', 'desc');
        }
        
        console.log('getUnidentifiedFaces repository called with limit:', limit, 'random:', random, 'filters:', filters);
        console.log('getUnidentifiedFaces query SQL:', query.toSQL());
        
        const result = await query;
        console.log('getUnidentifiedFaces result:', {
            count: result.length,
            firstFew: result.slice(0, 3).map(f => ({ id: f.id, person_id: f.person_id, confidence: f.detection_confidence }))
        });
        
        return result;
    }
    
    static async getUnidentifiedFacesCount(
        filters: {
            gender?: string;
            ageMin?: number;
            ageMax?: number;
            minConfidence?: number;
            maxConfidence?: number;
            minGenderConfidence?: number;
            minAgeConfidence?: number;
        } = {}
    ): Promise<number> {
        try {
            // Get count of faces that are truly unidentified (NULL) and exclude invalid/rejected faces
            const query = db('detected_faces')
                .whereNull('person_id')  // Only NULL person_id (truly unidentified)
                .whereNotNull('face_image_path')  // Must have face image
                .count('* as count');
                
            // Apply same filters as getUnidentifiedFaces
            if (filters.gender) {
                query.where('predicted_gender', filters.gender);
            }
            
            if (filters.ageMin !== undefined) {
                query.where('age_max', '>=', filters.ageMin);
            }
            
            if (filters.ageMax !== undefined) {
                query.where('age_min', '<=', filters.ageMax);
            }
            
            if (filters.minConfidence !== undefined) {
                query.where('detection_confidence', '>=', filters.minConfidence);
            }
            
            if (filters.maxConfidence !== undefined) {
                query.where('detection_confidence', '<=', filters.maxConfidence);
            }
            
            if (filters.minGenderConfidence !== undefined) {
                query.where('gender_confidence', '>=', filters.minGenderConfidence);
            }
            
            if (filters.minAgeConfidence !== undefined) {
                query.where('age_confidence', '>=', filters.minAgeConfidence);
            }
            
            const result = await query.first();
            return result ? Number(result.count) : 0;
        } catch (error) {
            console.error('Error in getUnidentifiedFacesCount:', error);
            return 0;
        }
    }
    
    static async getFaceById(face_id: number): Promise<DetectedFace | undefined> {
        return db('detected_faces').where({ id: face_id }).first();
    }
    
    static async getFaceFilterOptions(): Promise<{
        genders: { value: string; count: number }[];
        ageRanges: { min: number; max: number; count: number }[];
        confidenceStats: { min: number; max: number; avg: number };
    }> {
        // Get available genders with counts (only unidentified faces)
        const genders = await db('detected_faces')
            .select('predicted_gender as value')
            .count('* as count')
            .whereNull('person_id')
            .whereNotNull('face_image_path')
            .whereNotNull('predicted_gender')
            .groupBy('predicted_gender')
            .orderBy('count', 'desc') as any;
            
        // Get age range distribution (only unidentified faces)
        const ageRanges = await db('detected_faces')
            .select(['age_min', 'age_max'])
            .count('* as count')
            .whereNull('person_id')
            .whereNotNull('face_image_path')
            .whereNotNull('age_min')
            .whereNotNull('age_max')
            .groupBy(['age_min', 'age_max'])
            .orderBy('age_min')
            .orderBy('age_max') as any;
            
        // Get confidence statistics (only unidentified faces)
        const confidenceStats = await db('detected_faces')
            .whereNull('person_id')
            .whereNotNull('face_image_path')
            .min('detection_confidence as min')
            .max('detection_confidence as max')
            .avg('detection_confidence as avg')
            .first() as any;
            
        return {
            genders: genders || [],
            ageRanges: ageRanges || [],
            confidenceStats: {
                min: parseFloat(confidenceStats?.min || '0'),
                max: parseFloat(confidenceStats?.max || '1'),
                avg: parseFloat(confidenceStats?.avg || '0.5')
            }
        };
    }
    
    static async assignFaceToPerson(face_id: number, person_id: number, confidence: number, method: string): Promise<void> {
        await db('detected_faces')
            .where({ id: face_id })
            .update({
                person_id,
                person_confidence: confidence,
                recognition_method: method
            });
    }
    
    static async clearPersonFromFace(face_id: number): Promise<void> {
        await db('detected_faces')
            .where({ id: face_id })
            .update({
                person_id: null,
                person_confidence: null,
                recognition_method: 'manual'
            });
    }
    
    static async clearPersonFromFaces(person_id: number): Promise<void> {
        await db('detected_faces')
            .where({ person_id })
            .update({
                person_id: null,
                person_confidence: null,
                recognition_method: 'manual'
            });
    }
    
    static async getAllFaces(): Promise<DetectedFace[]> {
        return db('detected_faces').select('*');
    }
}

export class PersonRepository {
    
    static async createPerson(person: Omit<Person, 'id'>): Promise<number> {
        const [id] = await db('persons').insert(person);
        return id;
    }
    
    static async getAllPersons(): Promise<Person[]> {
        return db('persons').orderBy('name');
    }
    
    static async getPersonWithFaceCount(person_id: number): Promise<Person & { face_count: number } | undefined> {
        return db('persons')
            .leftJoin('detected_faces', 'persons.id', 'detected_faces.person_id')
            .where('persons.id', person_id)
            .groupBy('persons.id')
            .select('persons.*')
            .count('detected_faces.id as face_count')
            .first() as any;
    }
    
    static async getPersonByComprefaceId(comprefaceSubjectId: string): Promise<Person | undefined> {
        return db('persons').where({ compreface_subject_id: comprefaceSubjectId }).first();
    }
    
    static async updatePerson(person_id: number, updates: Partial<Person>): Promise<void> {
        await db('persons').where({ id: person_id }).update(updates);
    }
    
    static async deletePerson(person_id: number): Promise<void> {
        await db('persons').where({ id: person_id }).del();
    }
    
    static async updateFaceCount(person_id: number): Promise<void> {
        const faceCount = await db('detected_faces')
            .where({ person_id })
            .count('* as count')
            .first();
        
        await db('persons')
            .where({ id: person_id })
            .update({ face_count: faceCount?.count || 0 });
    }
    
    static async getAllTrainedPersons(): Promise<Person[]> {
        return db('persons')
            .whereNotNull('compreface_subject_id')
            .where('auto_recognize', true)
            .orderBy('name');
    }
}

export class ObjectRepository {
    
    static async createObject(object: Omit<DetectedObject, 'id'>): Promise<number> {
        const [id] = await db('detected_objects').insert(object);
        return id;
    }
    
    static async createObjects(objects: Omit<DetectedObject, 'id'>[]): Promise<number[]> {
        if (objects.length === 0) return [];
        return await db('detected_objects').insert(objects);
    }
    
    static async getObjectsByImage(image_id: number): Promise<DetectedObject[]> {
        return db('detected_objects').where({ image_id }).orderBy('confidence', 'desc');
    }
    
    static async getObjectsByClass(className: string, limit = 100): Promise<DetectedObject[]> {
        return db('detected_objects')
            .where('class', className)
            .orderBy('confidence', 'desc')
            .limit(limit);
    }
    
    static async getObjectStats(): Promise<Array<{class: string, count: number}>> {
        return db('detected_objects')
            .select('class')
            .count('* as count')
            .groupBy('class')
            .orderBy('count', 'desc') as any;
    }
    
    static async searchImagesByObjects(classes: string[], minConfidence = configManager.getProcessing()?.objectDetection?.confidence?.search || 0.5): Promise<number[]> {
        const query = db('detected_objects')
            .where('confidence', '>=', minConfidence);
        
        // Build OR conditions for partial matching
        query.where(function() {
            classes.forEach((searchTerm, index) => {
                if (index === 0) {
                    this.where('class', 'like', `%${searchTerm}%`);
                } else {
                    this.orWhere('class', 'like', `%${searchTerm}%`);
                }
            });
        });
        
        const imageIds = await query
            .distinct('image_id')
            .pluck('image_id');
        return imageIds;
    }
}

export class MetadataRepository {
    
    static async createMetadata(metadata: Omit<ImageMetadata, 'id'>): Promise<number> {
        const [id] = await db('image_metadata').insert(metadata);
        return id;
    }
    
    static async getMetadataByImage(image_id: number): Promise<ImageMetadata | undefined> {
        return db('image_metadata').where({ image_id }).first();
    }
    
    static async getLocationStats(): Promise<Array<{location: string, count: number}>> {
        return db('image_metadata')
            .select('city as location')
            .count('* as count')
            .whereNotNull('city')
            .groupBy('city')
            .orderBy('count', 'desc') as any;
    }
    
    static async getCameraStats(): Promise<Array<{camera: string, count: number}>> {
        return db('image_metadata')
            .select(db.raw('CONCAT(camera_make, " ", camera_model) as camera'))
            .count('* as count')
            .whereNotNull('camera_make')
            .groupBy('camera_make', 'camera_model')
            .orderBy('count', 'desc') as any;
    }
}

// Utility functions for database operations
export const DatabaseUtils = {
    
    async getImageWithAllData(image_id: number) {
        const image = await ImageRepository.findById(image_id);
        if (!image) return null;
        
        // Get geolocation data
        const locationQuery = db('image_geolocations as il')
            .leftJoin('geo_cities as gc', 'il.city_id', 'gc.id')
            .leftJoin('geo_states as gs', 'gc.state_code', 'gs.code')
            .leftJoin('geo_countries as gco', 'gs.country_code', 'gco.country_code')
            .select([
                'gc.city as location_city',
                'gs.name as location_state',
                'gco.country_name as location_country',
                'il.confidence_score as location_confidence',
                'il.distance_miles as location_distance'
            ])
            .where('il.image_id', image_id)
            .first();
        
        const [metadata, faces, tags, objects, locationData] = await Promise.all([
            MetadataRepository.getMetadataByImage(image_id),
            FaceRepository.getFacesByImage(image_id),
            db('image_tags').where({ image_id }),
            ObjectRepository.getObjectsByImage(image_id),
            locationQuery
        ]);
        
        // Format location data
        const location = locationData?.location_city ? {
            city: locationData.location_city,
            state: locationData.location_state,
            country: locationData.location_country,
            confidence: parseFloat(locationData.location_confidence) || null,
            distance_miles: parseFloat(locationData.location_distance) || null,
            coordinates: (metadata?.latitude && metadata?.longitude) ? {
                latitude: parseFloat(metadata.latitude.toString()),
                longitude: parseFloat(metadata.longitude.toString())
            } : null
        } : null;
        
        return {
            ...image,
            metadata,
            faces,
            tags,
            objects,
            location
        };
    },
    
    async getDashboardStats() {
        const [
            totalImages,
            processedImages,
            totalFaces,
            identifiedFaces,
            totalObjects,
            locationStats,
            cameraStats,
            objectStats
        ] = await Promise.all([
            db('images').count('* as count').first(),
            db('images').where('processing_status', 'completed').count('* as count').first(),
            db('detected_faces').count('* as count').first(),
            db('detected_faces').whereNotNull('person_id').count('* as count').first(),
            db('detected_objects').count('* as count').first(),
            MetadataRepository.getLocationStats(),
            MetadataRepository.getCameraStats(),
            ObjectRepository.getObjectStats()
        ]);
        
        return {
            totalImages: totalImages?.count || 0,
            processedImages: processedImages?.count || 0,
            totalFaces: totalFaces?.count || 0,
            identifiedFaces: identifiedFaces?.count || 0,
            totalObjects: totalObjects?.count || 0,
            locationStats: locationStats.slice(0, 10),
            cameraStats: cameraStats.slice(0, 10),
            objectStats: objectStats.slice(0, 15) // Top 15 detected object types
        };
    }
};

export class FaceSimilarityRepository {
    static async create(similarity: Omit<FaceSimilarity, 'id'>): Promise<number> {
        const [id] = await db('face_similarities').insert(similarity);
        return id;
    }

    static async findByFaces(faceAId: number, faceBId: number, method?: string): Promise<FaceSimilarity | undefined> {
        let query = db('face_similarities')
            .where(function() {
                this.where({ face_a_id: faceAId, face_b_id: faceBId })
                    .orWhere({ face_a_id: faceBId, face_b_id: faceAId });
            });
        
        if (method) {
            query = query.where('comparison_method', method);
        }
        
        return query.first();
    }

    static async getSimilarFaces(faceId: number, threshold: number = 0.8, limit: number = 20): Promise<any[]> {
        return db('face_similarities as fs')
            .join('detected_faces as df', function() {
                this.on('df.id', '=', 'fs.face_b_id')
                    .orOn('df.id', '=', 'fs.face_a_id');
            })
            .where(function() {
                this.where('fs.face_a_id', faceId)
                    .orWhere('fs.face_b_id', faceId);
            })
            .where('fs.similarity_score', '>=', threshold)
            .where('df.id', '!=', faceId)
            .whereNull('df.person_id') // Only unassigned faces
            .orderBy('fs.similarity_score', 'desc')
            .limit(limit)
            .select('df.*', 'fs.similarity_score');
    }

    static async batchCreate(similarities: Omit<FaceSimilarity, 'id'>[]): Promise<void> {
        if (similarities.length === 0) return;
        await db('face_similarities').insert(similarities);
    }

    static async deleteByFace(faceId: number): Promise<void> {
        await db('face_similarities')
            .where('face_a_id', faceId)
            .orWhere('face_b_id', faceId)
            .del();
    }
}

export class FaceClusterRepository {
    static async create(cluster: Omit<FaceCluster, 'id'>): Promise<number> {
        const [id] = await db('face_clusters').insert(cluster);
        return id;
    }

    static async findById(id: number): Promise<FaceCluster | undefined> {
        return db('face_clusters').where({ id }).first();
    }

    static async findByName(clusterName: string): Promise<FaceCluster | undefined> {
        return db('face_clusters').where({ cluster_name: clusterName }).first();
    }

    static async getAllClusters(includeReviewed: boolean = false): Promise<FaceCluster[]> {
        let query = db('face_clusters').orderBy('face_count', 'desc');
        
        if (!includeReviewed) {
            query = query.where('is_reviewed', false);
        }
        
        return query;
    }

    static async getClusterWithMembers(clusterId: number): Promise<any> {
        const cluster = await db('face_clusters').where({ id: clusterId }).first();
        if (!cluster) return null;

        const members = await db('face_cluster_members as fcm')
            .join('detected_faces as df', 'fcm.face_id', 'df.id')
            .join('images as i', 'df.image_id', 'i.id')
            .where('fcm.cluster_id', clusterId)
            .orderBy('fcm.similarity_to_cluster', 'desc')
            .select('df.*', 'fcm.similarity_to_cluster', 'fcm.is_representative', 'i.filename');

        return {
            ...cluster,
            members
        };
    }

    static async updateFaceCount(clusterId: number): Promise<void> {
        const count = await db('face_cluster_members')
            .where('cluster_id', clusterId)
            .count('* as count')
            .first();

        await db('face_clusters')
            .where({ id: clusterId })
            .update({ 
                face_count: count?.count || 0,
                updated_at: new Date()
            });
    }

    static async assignToPerson(clusterId: number, personId: number): Promise<void> {
        await db('face_clusters')
            .where({ id: clusterId })
            .update({ 
                assigned_person_id: personId,
                is_reviewed: true,
                updated_at: new Date()
            });
    }

    static async markAsReviewed(clusterId: number, notes?: string): Promise<void> {
        const updateData: any = { 
            is_reviewed: true,
            updated_at: new Date()
        };
        
        if (notes) {
            updateData.notes = notes;
        }

        await db('face_clusters')
            .where({ id: clusterId })
            .update(updateData);
    }

    static async delete(clusterId: number): Promise<void> {
        // Members will be deleted automatically due to foreign key constraints
        await db('face_clusters').where({ id: clusterId }).del();
    }
}

export class FaceClusterMemberRepository {
    static async create(member: Omit<FaceClusterMember, 'id'>): Promise<number> {
        const [id] = await db('face_cluster_members').insert(member);
        return id;
    }

    static async batchCreate(members: Omit<FaceClusterMember, 'id'>[]): Promise<void> {
        if (members.length === 0) return;
        await db('face_cluster_members').insert(members);
    }

    static async findByFace(faceId: number): Promise<FaceClusterMember[]> {
        return db('face_cluster_members').where({ face_id: faceId });
    }

    static async findByCluster(clusterId: number): Promise<FaceClusterMember[]> {
        return db('face_cluster_members').where({ cluster_id: clusterId });
    }

    static async setRepresentative(clusterId: number, faceId: number): Promise<void> {
        await db.transaction(async (trx) => {
            // Clear existing representative
            await trx('face_cluster_members')
                .where({ cluster_id: clusterId })
                .update({ is_representative: false });

            // Set new representative
            await trx('face_cluster_members')
                .where({ cluster_id: clusterId, face_id: faceId })
                .update({ is_representative: true });
        });
    }

    static async removeFromCluster(clusterId: number, faceId: number): Promise<void> {
        await db('face_cluster_members')
            .where({ cluster_id: clusterId, face_id: faceId })
            .del();
    }

    static async removeAllByFace(faceId: number): Promise<void> {
        await db('face_cluster_members').where({ face_id: faceId }).del();
    }
};

// Smart Albums Interfaces
export interface SmartAlbum {
    id: number;
    name: string;
    slug: string;
    description?: string;
    type: 'object_based' | 'person_based' | 'time_based' | 'location_based' | 'technical_based' | 'characteristic' | 'custom_rule';
    rules: any; // JSON rules
    is_active: boolean;
    is_system: boolean;
    priority: number;
    cover_image_hash?: string;
    image_count: number;
    last_updated: Date;
    created_at: Date;
    updated_at: Date;
}

export interface SmartAlbumImage {
    id: number;
    album_id: number;
    image_id: number;
    confidence: number;
    match_reasons?: any; // JSON
    added_at: Date;
}

export interface SmartAlbumRule {
    id: number;
    album_id: number;
    rule_type: 'object_detection' | 'face_detection' | 'date_range' | 'time_of_day' | 'day_of_week' | 'location_radius' | 'camera_model' | 'photo_type' | 'color_dominant' | 'min_faces' | 'min_objects';
    parameters: any; // JSON
    operator: 'AND' | 'OR' | 'NOT';
    priority: number;
    is_active: boolean;
}

// Smart Album Repository
export class SmartAlbumRepository {
    static async createAlbum(album: Partial<SmartAlbum>): Promise<number> {
        const [id] = await db('smart_albums').insert(album);
        return id;
    }

    static async findAlbumById(id: number): Promise<SmartAlbum | null> {
        return db('smart_albums').where({ id }).first();
    }

    static async findAlbumBySlug(slug: string): Promise<SmartAlbum | null> {
        return db('smart_albums').where({ slug }).first();
    }

    static async findActiveAlbums(limit?: number): Promise<SmartAlbum[]> {
        let query = db('smart_albums')
            .where({ is_active: true })
            .orderBy('priority', 'desc')
            .orderBy('name', 'asc');
        
        if (limit) {
            query = query.limit(limit);
        }
        
        return query;
    }

    static async updateAlbum(id: number, updates: Partial<SmartAlbum>): Promise<void> {
        await db('smart_albums').where({ id }).update({
            ...updates,
            last_updated: db.fn.now()
        });
    }

    static async addImageToAlbum(albumId: number, imageId: number, confidence: number = 1.0, matchReasons?: any): Promise<void> {
        await db('smart_album_images').insert({
            album_id: albumId,
            image_id: imageId,
            confidence,
            match_reasons: matchReasons ? JSON.stringify(matchReasons) : null
        }).onConflict(['album_id', 'image_id']).merge();
        
        // Update album image count
        await this.updateAlbumImageCount(albumId);
    }

    static async removeImageFromAlbum(albumId: number, imageId: number): Promise<void> {
        await db('smart_album_images')
            .where({ album_id: albumId, image_id: imageId })
            .delete();
        
        // Update album image count
        await this.updateAlbumImageCount(albumId);
    }

    static async updateAlbumImageCount(albumId: number): Promise<void> {
        const result = await db('smart_album_images')
            .where({ album_id: albumId })
            .count('* as count')
            .first();
        
        await db('smart_albums')
            .where({ id: albumId })
            .update({ image_count: result?.count || 0 });
    }

    static async getAlbumImages(albumId: number, offset: number = 0, limit: number = 100): Promise<Image[]> {
        return db('images')
            .join('smart_album_images', 'images.id', 'smart_album_images.image_id')
            .where('smart_album_images.album_id', albumId)
            .orderBy('smart_album_images.added_at', 'desc')
            .offset(offset)
            .limit(limit)
            .select('images.*');
    }

    static async createAlbumRule(rule: Partial<SmartAlbumRule>): Promise<number> {
        const [id] = await db('smart_album_rules').insert(rule);
        return id;
    }

    static async getAlbumRules(albumId: number): Promise<SmartAlbumRule[]> {
        return db('smart_album_rules')
            .where({ album_id: albumId, is_active: true })
            .orderBy('priority', 'desc');
    }
};