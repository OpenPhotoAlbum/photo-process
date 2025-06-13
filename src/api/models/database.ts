import knex from 'knex';
import appConfig from '../../config';
const config = require('../../../knexfile');

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
    recognition_method?: string;
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
    }): Promise<Image[]> {
        let query = db('images')
            .leftJoin('image_metadata', 'images.id', 'image_metadata.image_id')
            .leftJoin('detected_faces', 'images.id', 'detected_faces.image_id')
            .where('images.processing_status', 'completed')
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
    
    static async searchImagesByObjects(classes: string[], minConfidence = appConfig.getMinConfidence()): Promise<number[]> {
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
        
        const [metadata, faces, tags, objects] = await Promise.all([
            MetadataRepository.getMetadataByImage(image_id),
            FaceRepository.getFacesByImage(image_id),
            db('image_tags').where({ image_id }),
            ObjectRepository.getObjectsByImage(image_id)
        ]);
        
        return {
            ...image,
            metadata,
            faces,
            tags,
            objects
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