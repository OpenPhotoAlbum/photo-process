import { Request, Response } from 'express';
import { PersonRepository, FaceRepository, ImageRepository, db } from '../models/database';
import { createComprefaceSubject, addFaceToSubject, recognizeFacesFromImage, deleteFaceFromSubject, recognizeFacesFromImagesBatch, addFacesToSubjectBatch } from '../util/compreface';
import { ConsistencyManager } from '../util/consistency-manager';
import { AppError, asyncHandler, validatePersonId, validateFaceId, validateImageId, validateRequired, validateArray } from '../middleware/error-handler';
import { configManager } from '../util/config-manager';
import { Logger } from '../logger';
import { CompreFaceTrainingManager, AutoTrainingConfig } from '../util/compreface-training';
import { FaceClusteringService } from '../util/face-clustering';
import { AutoFaceCleanup } from '../util/cleanup-auto-faces';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const logger = Logger.getInstance();

// Helper function for face URLs (supports both legacy and hash-based)
function getFaceUrl(face: any): string {
    // If face has relative_face_path (hash-based), use that
    if (face && face.relative_face_path) {
        return `/media/${face.relative_face_path}`;
    }
    
    // Fallback to legacy face path
    const faceImagePath = typeof face === 'string' ? face : face?.face_image_path;
    return faceImagePath ? `/processed/${faceImagePath}` : '';
}

// Helper function to convert path to media URL (supports both legacy and hash-based)
function getMediaUrl(image: any): string {
    // If image has relative_media_path (hash-based), use that
    if (image && typeof image === 'object' && image.relative_media_path) {
        return `/media/${image.relative_media_path}`;
    }
    
    // Fallback to legacy path conversion
    const originalPath = typeof image === 'string' ? image : image?.original_path;
    if (!originalPath) return '';
    
    const sourceDir = configManager.getStorage().sourceDir;
    const relativePath = originalPath.replace(sourceDir, '').replace(/^\/+/, '');
    return `/media/${relativePath}`;
}

// Get all persons with face thumbnails
export const getAllPersons = async (req: Request, res: Response) => {
    try {
        req.logger.debug('Getting all persons with face thumbnails');
        const persons = await PersonRepository.getAllPersons();
        
        // Enrich each person with a sample face image
        const enrichedPersons = await Promise.all(
            persons.map(async (person) => {
                // Get one face for this person as thumbnail
                const faces = await FaceRepository.getFacesByPerson(person.id!);
                const sampleFace = faces.length > 0 ? faces[0] : null;
                
                return {
                    ...person,
                    face_count: faces.length,
                    sample_face_image: sampleFace ? sampleFace.face_image_path : null
                };
            })
        );
        
        res.json({ persons: enrichedPersons });
    } catch (error) {
        req.logger.error('Failed to get persons', error);
        res.status(500).json({ error: 'Failed to get persons' });
    }
};

// Get all images for a person (combining face detection and Google tags)
export const getPersonImages = asyncHandler(async (req: Request, res: Response) => {
    console.log('BANG');
    const { id } = req.params;
    const { limit = 50, offset = 0, source = 'all', includeMetadata = true } = req.query;
    
    const personId = validatePersonId(id);
    
    const person = await PersonRepository.getPersonWithFaceCount(personId);
    
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    let images: any[] = [];
    let totalCount = 0;
    
    const limitNum = Number(limit);
    const offsetNum = Number(offset);

    if (source === 'all' || source === 'faces') {
        // Get images through face detection
        const faceQuery = db('images')
            .select([
                'images.*',
                'detected_faces.id as face_id',
                'detected_faces.person_confidence',
                'detected_faces.recognition_method',
                'detected_faces.assigned_at',
                db.raw("'face_detection' as source_type")
            ])
            .join('detected_faces', 'images.id', 'detected_faces.image_id')
            .where('detected_faces.person_id', personId)
            .where('detected_faces.person_id', '>', 0) // Exclude invalid/unknown faces
            .orderBy('images.date_taken', 'desc');

        if (includeMetadata === 'true') {
            faceQuery
                .leftJoin('google_metadata', 'images.id', 'google_metadata.image_id')
                .select([
                    'images.*',
                    'detected_faces.id as face_id',
                    'detected_faces.person_confidence',
                    'detected_faces.recognition_method',
                    'detected_faces.assigned_at',
                    'google_metadata.google_view_count',
                    'google_metadata.device_type',
                    'google_metadata.google_title',
                    db.raw("'face_detection' as source_type")
                ]);
        }

        if (source === 'faces') {
            images = await faceQuery.limit(limitNum).offset(offsetNum);
            totalCount = await db('detected_faces')
                .join('images', 'detected_faces.image_id', 'images.id')
                .where('detected_faces.person_id', personId)
                .where('detected_faces.person_id', '>', 0)
                .count('* as count')
                .first()
                .then(r => Number(r?.count) || 0);
        }
    }

    if (source === 'all' || source === 'google') {
        // Get images through Google Photos tags
        const googleQuery = db('images')
            .select([
                'images.*',
                'google_people_tags.person_name as google_name',
                'google_people_tags.is_verified',
                'google_people_tags.tagged_at',
                db.raw("'google_photos' as source_type")
            ])
            .join('google_people_tags', 'images.id', 'google_people_tags.image_id')
            .where('google_people_tags.person_id', personId)
            .orderBy('images.date_taken', 'desc');

        if (includeMetadata === 'true') {
            googleQuery
                .leftJoin('google_metadata', 'images.id', 'google_metadata.image_id')
                .select([
                    'images.*',
                    'google_people_tags.person_name as google_name',
                    'google_people_tags.is_verified',
                    'google_people_tags.tagged_at',
                    'google_metadata.google_view_count',
                    'google_metadata.device_type',
                    'google_metadata.google_title',
                    db.raw("'google_photos' as source_type")
                ]);
        }

        if (source === 'google') {
            images = await googleQuery.limit(limitNum).offset(offsetNum);
            totalCount = await db('google_people_tags')
                .join('images', 'google_people_tags.image_id', 'images.id')
                .where('google_people_tags.person_id', personId)
                .count('* as count')
                .first()
                .then(r => Number(r?.count) || 0);
        }
    }

    if (source === 'all') {
        // Combine both sources, remove duplicates, and apply pagination
        const [faceImages, googleImages] = await Promise.all([
            db('images')
                .select([
                    'images.*',
                    'detected_faces.id as face_id',
                    'detected_faces.person_confidence',
                    'detected_faces.recognition_method',
                    'detected_faces.assigned_at',
                    db.raw("'face_detection' as source_type")
                ])
                .join('detected_faces', 'images.id', 'detected_faces.image_id')
                .where('detected_faces.person_id', personId)
                .where('detected_faces.person_id', '>', 0),
            
            db('images')
                .select([
                    'images.*',
                    'google_people_tags.person_name as google_name',
                    'google_people_tags.is_verified',
                    'google_people_tags.tagged_at',
                    db.raw("'google_photos' as source_type")
                ])
                .join('google_people_tags', 'images.id', 'google_people_tags.image_id')
                .where('google_people_tags.person_id', personId)
        ]);

        // Combine and deduplicate by image ID
        const imageMap = new Map();
        
        faceImages.forEach(img => {
            if (!imageMap.has(img.id)) {
                imageMap.set(img.id, { ...img, sources: [img.source_type] });
            } else {
                imageMap.get(img.id).sources.push(img.source_type);
            }
        });

        googleImages.forEach(img => {
            if (!imageMap.has(img.id)) {
                imageMap.set(img.id, { ...img, sources: [img.source_type] });
            } else {
                const existing = imageMap.get(img.id);
                existing.sources.push(img.source_type);
                // Merge Google metadata
                existing.google_name = img.google_name;
                existing.is_verified = img.is_verified;
                existing.tagged_at = img.tagged_at;
            }
        });

        // Sort by date and apply pagination
        const allImages = Array.from(imageMap.values())
            .sort((a, b) => new Date(b.date_taken).getTime() - new Date(a.date_taken).getTime());
        
        totalCount = allImages.length;
        images = allImages.slice(offsetNum, offsetNum + limitNum);
    }

    // Get statistics
    const [faceStats, googleStats] = await Promise.all([
        db('detected_faces')
            .select([
                db.raw('COUNT(*) as face_count'),
                db.raw('COUNT(DISTINCT image_id) as face_image_count')
            ])
            .where('person_id', personId)
            .where('person_id', '>', 0)
            .first(),
        
        db('google_people_tags')
            .select([
                db.raw('COUNT(*) as google_tag_count'),
                db.raw('COUNT(DISTINCT image_id) as google_image_count')
            ])
            .where('person_id', personId)
            .first()
    ]);

    res.json({ 
        person,
        images,
        statistics: {
            faces: faceStats,
            google: googleStats,
            total: {
                unique_images: totalCount
            }
        },
        pagination: {
            total: totalCount,
            limit: limitNum,
            offset: offsetNum,
            hasMore: offsetNum + images.length < totalCount
        },
        filters: {
            source: source,
            includeMetadata: includeMetadata === 'true'
        }
    });
});

// Get person by ID with face count
export const getPersonById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const personId = validatePersonId(id);
    
    const person = await PersonRepository.getPersonWithFaceCount(personId);
    
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    // Get faces for this person
    const faces = await FaceRepository.getFacesByPerson(personId);
    
    res.json({ 
        person: {
            ...person,
            faces
        }
    });
});

// Create new person
export const createPerson = asyncHandler(async (req: Request, res: Response) => {
    const { name, notes } = req.body;
    
    validateRequired(name, 'Person name');

    // Create CompreFace subject (with fallback)
    let comprefaceSubjectId: string | undefined = undefined;
    try {
        comprefaceSubjectId = await createComprefaceSubject(name);
    } catch (comprefaceError: any) {
        req.logger.warn('CompreFace subject creation failed, continuing without', comprefaceError);
        // Continue without CompreFace integration
    }
    
    const personData = {
        name: name.trim(),
        notes: notes || '',
        compreface_subject_id: comprefaceSubjectId,
        face_count: 0,
        auto_recognize: true,
        recognition_status: 'untrained' as const,
        training_face_count: 0
    };

    const personId = await PersonRepository.createPerson(personData);
    const person = await PersonRepository.getPersonWithFaceCount(personId);

    res.status(201).json({ person });
});

// Update person
export const updatePerson = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, notes, auto_recognize, recognition_status } = req.body;
    
    const personId = validatePersonId(id);
    
    const existingPerson = await PersonRepository.getPersonWithFaceCount(personId);
    if (!existingPerson) {
        throw new AppError('Person not found', 404);
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (notes !== undefined) updateData.notes = notes;
    if (auto_recognize !== undefined) updateData.auto_recognize = auto_recognize;
    if (recognition_status !== undefined && ['untrained', 'training', 'trained', 'failed'].includes(recognition_status)) {
        updateData.recognition_status = recognition_status;
    }

    await PersonRepository.updatePerson(personId, updateData);
    const updatedPerson = await PersonRepository.getPersonWithFaceCount(personId);

    res.json({ person: updatedPerson });
});

// Delete person
export const deletePerson = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const personId = validatePersonId(id);
    
    const person = await PersonRepository.getPersonWithFaceCount(personId);
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    // Remove all face associations (set person_id to NULL)
    await FaceRepository.clearPersonFromFaces(personId);

    // Delete from database
    await PersonRepository.deletePerson(personId);

    res.json({ message: 'Person deleted successfully' });
});

// Assign face to person
export const assignFaceToPerson = asyncHandler(async (req: Request, res: Response) => {
    const { personId, faceId } = req.body;
    
    validateRequired(personId, 'Person ID');
    validateRequired(faceId, 'Face ID');

    // Get person and face
    const person = await PersonRepository.getPersonWithFaceCount(personId);
    const face = await FaceRepository.getFaceById(faceId);
    
    if (!person) {
        throw new AppError('Person not found', 404);
    }
    
    if (!face) {
        throw new AppError('Face not found', 404);
    }

    // Update face in database first (don't wait for CompreFace)
    await FaceRepository.assignFaceToPerson(faceId, personId, 1.0, 'manual');
    
    // Update assignment metadata
    await db('detected_faces')
        .where({ id: faceId })
        .update({
            assigned_at: new Date(),
            assigned_by: 'user', // TODO: Add actual user tracking
            needs_review: false
        });
    
    // Update person face count
    await PersonRepository.updateFaceCount(personId);

    // Ensure person has CompreFace subject and add face for training (async, non-blocking)
    if (face.face_image_path) {
        // Run CompreFace operations in background
        (async () => {
            try {
                let comprefaceSubjectId = person.compreface_subject_id;
                
                // Create CompreFace subject if missing
                if (!comprefaceSubjectId) {
                    req.logger.info(`Creating missing CompreFace subject for person: ${person.name}`);
                    comprefaceSubjectId = await createComprefaceSubject(person.name);
                    
                    // Update person in database with new subject ID
                    await PersonRepository.updatePerson(personId, {
                        compreface_subject_id: comprefaceSubjectId
                    });
                    req.logger.info(`Updated person ${person.name} with CompreFace subject ID: ${comprefaceSubjectId}`);
                }
                
                // Add face to CompreFace for training (only high-confidence faces)
                if (!face.face_image_path) {
                    req.logger.warn('Face has no image path, skipping CompreFace sync');
                    return;
                }
                
                // Only add high-confidence faces to CompreFace (0.98 or higher)
                if (face.detection_confidence < 0.98) {
                    req.logger.info(`Face confidence ${face.detection_confidence} below 0.98 threshold, skipping CompreFace sync`);
                    return;
                }
                
                // Handle both absolute and relative paths
                let fullFacePath = face.face_image_path;
                if (!fullFacePath.startsWith('/')) {
                    fullFacePath = `${configManager.getStorage().processedDir}/${face.face_image_path}`;
                }
                req.logger.info(`Adding high-confidence face (${face.detection_confidence}) to CompreFace: ${comprefaceSubjectId}, path: ${fullFacePath}`);
                await addFaceToSubject(comprefaceSubjectId, fullFacePath);
                
                // Mark face as synced to CompreFace
                await db('detected_faces')
                    .where('id', faceId)
                    .update({ compreface_synced: true });
                
                req.logger.info('Successfully added face to CompreFace and marked as synced');
                
            } catch (comprefaceError) {
                req.logger.warn('CompreFace integration failed:', comprefaceError);
            }
        })();
    }

    const updatedPerson = await PersonRepository.getPersonWithFaceCount(personId);
    
    // Quick consistency check for this person
    await ConsistencyManager.quickConsistencyCheck(personId);
    
    res.json({ 
        person: updatedPerson,
        message: 'Face assigned to person successfully'
    });
});

// Remove face from person
export const removeFaceFromPerson = async (req: Request, res: Response) => {
    try {
        const { faceId } = req.params;
        
        const face = await FaceRepository.getFaceById(parseInt(faceId));
        if (!face) {
            return res.status(404).json({ error: 'Face not found' });
        }

        const personId = face.person_id;
        let person = null;
        
        if (personId) {
            person = await PersonRepository.getPersonWithFaceCount(personId);
        }
        
        req.logger.info(`Removing face ${faceId} from person ${person?.name || 'unknown'}`);

        // Remove from CompreFace if applicable
        if (face.face_image_path && person?.compreface_subject_id) {
            try {
                const deletionResult = await deleteFaceFromSubject(face.face_image_path);
                req.logger.info(`CompreFace face deletion result:`, deletionResult);
            } catch (comprefaceError) {
                req.logger.warn('CompreFace removal failed:', comprefaceError);
                // Continue with database removal even if CompreFace fails
            }
        }

        // Remove association from database
        await FaceRepository.clearPersonFromFace(parseInt(faceId));
        
        // Update person face count if person was assigned
        if (personId) {
            await PersonRepository.updateFaceCount(personId);
        }

        // If person still has faces, retrain their model in the background
        if (person && person.compreface_subject_id && personId) {
            const capturedPersonId = personId;
            const capturedSubjectId = person.compreface_subject_id;
            const capturedPersonName = person.name;
            
            (async () => {
                try {
                    const updatedPerson = await PersonRepository.getPersonWithFaceCount(capturedPersonId);
                    if (updatedPerson && updatedPerson.face_count > 0) {
                        req.logger.info(`Retraining ${capturedPersonName} after face removal (${updatedPerson.face_count} faces remaining)`);
                        
                        // Get remaining faces for this person
                        const remainingFaces = await FaceRepository.getFacesByPerson(capturedPersonId);
                        const processedDir = configManager.getStorage().processedDir;
                        const facePaths = remainingFaces
                            .filter(f => f.relative_face_path || f.face_image_path)
                            .filter(f => f.detection_confidence >= 0.98) // Only high-confidence faces
                            .map(f => {
                                const facePath = f.relative_face_path || f.face_image_path;
                                if (!facePath) return null;
                                if (facePath.startsWith('/')) {
                                    return facePath;
                                } else {
                                    return `${processedDir}/faces/${facePath}`;
                                }
                            })
                            .filter((path): path is string => path !== null);
                        
                        if (facePaths.length > 0) {
                            // Re-upload remaining faces to CompreFace for training
                            await addFacesToSubjectBatch(capturedSubjectId, facePaths, 2);
                            req.logger.info(`Retraining completed for ${capturedPersonName} with ${facePaths.length} faces`);
                            
                            // Update person status
                            await PersonRepository.updatePerson(capturedPersonId, {
                                recognition_status: 'trained',
                                last_trained_at: new Date()
                            });
                        } else {
                            // No faces left, mark as untrained
                            await PersonRepository.updatePerson(capturedPersonId, {
                                recognition_status: 'untrained'
                            });
                        }
                    }
                } catch (retrainError) {
                    req.logger.error(`Failed to retrain person ${capturedPersonName} after face removal:`, retrainError);
                }
            })();
        }

        const result = {
            message: 'Face removed from person successfully',
            personName: person?.name,
            remainingFaceCount: person ? await db('detected_faces').where('person_id', personId).count('* as count').first().then(r => r?.count || 0) : 0
        };

        res.json(result);
    } catch (error) {
        req.logger.error('Error removing face from person:', error);
        res.status(500).json({ error: 'Failed to remove face from person' });
    }
};

// Mark face as invalid (not actually a face)
export const markFaceAsInvalid = async (req: Request, res: Response) => {
    try {
        const { faceId } = req.params;
        
        const face = await FaceRepository.getFaceById(parseInt(faceId));
        if (!face) {
            return res.status(404).json({ error: 'Face not found' });
        }

        const personId = face.person_id;
        
        // Remove from CompreFace if it was assigned to someone
        if (face.face_image_path && personId) {
            try {
                await deleteFaceFromSubject(face.face_image_path);
            } catch (comprefaceError) {
                console.warn('CompreFace removal failed:', comprefaceError);
            }
        }

        // Mark as invalid in database (we'll use a special person_id = -1 to indicate invalid)
        await db('detected_faces')
            .where({ id: parseInt(faceId) })
            .update({
                person_id: -1, // Special value to indicate "not a face"
                person_confidence: null,
                recognition_method: 'manual_invalid',
                updated_at: new Date()
            });
        
        // Update person face count if person was previously assigned
        if (personId && personId > 0) {
            await PersonRepository.updateFaceCount(personId);
        }

        res.json({ message: 'Face marked as invalid successfully' });
    } catch (error) {
        console.error('Error marking face as invalid:', error);
        res.status(500).json({ error: 'Failed to mark face as invalid' });
    }
};

// Mark face as unknown (background person, not main subject)
export const markFaceAsUnknown = async (req: Request, res: Response) => {
    try {
        const { faceId } = req.params;
        
        const face = await FaceRepository.getFaceById(parseInt(faceId));
        if (!face) {
            return res.status(404).json({ error: 'Face not found' });
        }

        const personId = face.person_id;
        
        // Remove from CompreFace if it was assigned to someone
        if (face.face_image_path && personId) {
            try {
                await deleteFaceFromSubject(face.face_image_path);
            } catch (comprefaceError) {
                console.warn('CompreFace removal failed:', comprefaceError);
            }
        }

        // Mark as unknown in database (we'll use a special person_id = -2 to indicate unknown)
        await db('detected_faces')
            .where({ id: parseInt(faceId) })
            .update({
                person_id: -2, // Special value to indicate "unknown person"
                person_confidence: null,
                recognition_method: 'manual_unknown',
                updated_at: new Date()
            });
        
        // Update person face count if person was previously assigned
        if (personId && personId > 0) {
            await PersonRepository.updateFaceCount(personId);
        }

        res.json({ message: 'Face marked as unknown successfully' });
    } catch (error) {
        console.error('Error marking face as unknown:', error);
        res.status(500).json({ error: 'Failed to mark face as unknown' });
    }
};

// Batch assign multiple faces to a person
export const batchAssignFacesToPerson = asyncHandler(async (req: Request, res: Response) => {
    const { personId, faceIds } = req.body;
    
    validateRequired(personId, 'Person ID');
    validateArray(faceIds, 'Face IDs');

    // Get person
    const person = await PersonRepository.getPersonWithFaceCount(personId);
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const facePaths: string[] = [];

    // Process each face and collect face paths for batch upload
    for (const faceId of faceIds) {
        try {
            // Get face
            const face = await FaceRepository.getFaceById(faceId);
            if (!face) {
                errors.push(`Face ${faceId} not found`);
                errorCount++;
                continue;
            }

            // Update face in database
            await FaceRepository.assignFaceToPerson(faceId, personId, 1.0, 'manual');
            
            // Collect face path for batch upload to CompreFace (only high-confidence faces)
            if (person.compreface_subject_id && face.detection_confidence >= 0.98) {
                const facePath = face.relative_face_path || face.face_image_path;
                if (facePath) {
                    let fullFacePath: string;
                    if (facePath.startsWith('/')) {
                        fullFacePath = facePath;
                    } else {
                        fullFacePath = `${configManager.getStorage().processedDir}/faces/${facePath}`;
                    }
                    facePaths.push(fullFacePath);
                }
            }

            successCount++;
        } catch (error) {
            console.error(`Error processing face ${faceId}:`, error);
            errors.push(`Face ${faceId}: ${error}`);
            errorCount++;
        }
    }
    
    // Batch upload all faces to CompreFace for training (async, non-blocking)
    if (person.compreface_subject_id && facePaths.length > 0) {
        console.log(`Batch: Adding ${facePaths.length} faces to CompreFace for ${person.name} using batch processing`);
        
        // Don't await this - run in background
        addFacesToSubjectBatch(person.compreface_subject_id, facePaths, 3)
            .then((result) => {
                console.log(`Batch: Upload completed for ${person.name}: ${result.successful.length} successful, ${result.failed.length} failed`);
                if (result.failed.length > 0) {
                    console.warn(`Batch: Failed uploads for ${person.name}:`, result.failed);
                }
            })
            .catch((batchError) => {
                console.warn(`Batch: CompreFace batch upload failed for ${person.name}:`, batchError);
            });
    }
    
    // Update person face count
    await PersonRepository.updateFaceCount(personId);

    const updatedPerson = await PersonRepository.getPersonWithFaceCount(personId);
    res.json({ 
        person: updatedPerson,
        message: `Batch assignment completed: ${successCount} successful, ${errorCount} failed`,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined
    });
});

// Clean up faces that were auto-assigned but not uploaded to CompreFace
export const cleanupOrphanedFaces = async (req: Request, res: Response) => {
    try {
        console.log('Starting cleanup of orphaned faces (assigned locally but not in CompreFace)...');
        
        // Get all faces that were auto-recognized but method is 'auto_compreface'
        // These are faces that were assigned during auto-recognition but before we fixed the CompreFace upload
        const autoRecognizedFaces = await db('detected_faces')
            .whereNotNull('person_id')
            .where('recognition_method', 'auto_compreface')
            .select('*');
        
        console.log(`Found ${autoRecognizedFaces.length} auto-recognized faces to check`);
        
        if (autoRecognizedFaces.length === 0) {
            return res.json({
                message: 'No auto-recognized faces found to clean up.',
                removedCount: 0,
                checkedCount: 0
            });
        }
        
        let removedCount = 0;
        let checkedCount = 0;
        const removedFaces = [];
        
        // Check each auto-recognized face
        for (const face of autoRecognizedFaces) {
            checkedCount++;
            
            try {
                const person = await PersonRepository.getPersonWithFaceCount(face.person_id);
                if (!person || !person.compreface_subject_id) {
                    console.log(`Face ${face.id}: Person not found or no CompreFace subject ID`);
                    continue;
                }
                
                // Check if this face exists in CompreFace by getting all faces for the subject
                const comprefaceConfig = configManager.getCompreFace();
                const comprefaceFaces = await fetch(`${comprefaceConfig.baseUrl}/api/v1/recognition/faces`, {
                    method: 'GET',
                    headers: {
                        'x-api-key': comprefaceConfig.recognizeApiKey
                    }
                });
                
                if (!comprefaceFaces.ok) {
                    console.warn(`Failed to fetch CompreFace faces: ${comprefaceFaces.status}`);
                    continue;
                }
                
                const comprefaceData = await comprefaceFaces.json();
                const facesForSubject = comprefaceData.faces?.filter((cf: any) => cf.subject === person.compreface_subject_id) || [];
                
                // If this person has no faces in CompreFace, or very few compared to database count
                // then the auto-recognized faces were likely not uploaded
                if (facesForSubject.length === 0) {
                    console.log(`Face ${face.id}: No faces found in CompreFace for subject ${person.compreface_subject_id}, removing assignment`);
                    
                    // Remove the person assignment from this face
                    await FaceRepository.clearPersonFromFace(face.id);
                    
                    removedCount++;
                    removedFaces.push({
                        faceId: face.id,
                        personName: person.name,
                        confidence: face.person_confidence
                    });
                }
                
            } catch (error) {
                console.error(`Error processing face ${face.id}:`, error);
                // Continue with next face
            }
        }
        
        // Update face counts for all affected persons
        const affectedPersons = [...new Set(autoRecognizedFaces.map(f => f.person_id))];
        for (const personId of affectedPersons) {
            await PersonRepository.updateFaceCount(personId);
        }
        
        console.log(`Cleanup completed: Removed ${removedCount} orphaned face assignments out of ${checkedCount} checked`);
        
        res.json({
            message: `Cleanup completed: Removed ${removedCount} orphaned face assignments out of ${checkedCount} auto-recognized faces checked`,
            removedCount,
            checkedCount,
            removedFaces: removedFaces.slice(0, 10) // Show first 10 for reference
        });
        
    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({ error: 'Failed to cleanup orphaned faces' });
    }
};

// Get unidentified faces
export const getUnidentifiedFaces = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const random = req.query.random === 'true' || req.query.random === '1';
        
        // Parse filter parameters
        const filters: any = {};
        
        if (req.query.gender) {
            filters.gender = req.query.gender as string;
        }
        
        if (req.query.ageMin) {
            filters.ageMin = parseInt(req.query.ageMin as string);
        }
        
        if (req.query.ageMax) {
            filters.ageMax = parseInt(req.query.ageMax as string);
        }
        
        if (req.query.minConfidence) {
            filters.minConfidence = parseFloat(req.query.minConfidence as string);
        }
        
        if (req.query.maxConfidence) {
            filters.maxConfidence = parseFloat(req.query.maxConfidence as string);
        }
        
        if (req.query.minGenderConfidence) {
            filters.minGenderConfidence = parseFloat(req.query.minGenderConfidence as string);
        }
        
        if (req.query.minAgeConfidence) {
            filters.minAgeConfidence = parseFloat(req.query.minAgeConfidence as string);
        }
        
        // Get both the faces and the total count (total count ignores filters to show all unidentified faces)
        let faces: any[] = [];
        let totalCount = 0;
        
        try {
            [faces, totalCount] = await Promise.all([
                FaceRepository.getUnidentifiedFaces(limit, random, filters),
                FaceRepository.getUnidentifiedFacesCount({}) // No filters for total count
            ]);
        } catch (error) {
            console.error('Error getting faces or count:', error);
            // Fallback: get faces only if count fails
            faces = await FaceRepository.getUnidentifiedFaces(limit, random, filters);
            totalCount = faces.length; // Fallback to current page count
        }
        
        // Enrich with image information and URLs
        const enrichedFaces = await Promise.all(
            faces.map(async (face) => {
                const image = await ImageRepository.findById(face.image_id);
                return {
                    ...face,
                    face_url: getFaceUrl(face),
                    image: image ? {
                        id: image.id,
                        filename: image.filename,
                        date_taken: image.date_taken,
                        original_path: image.original_path,
                        media_url: getMediaUrl(image),
                        thumbnail_url: getMediaUrl(image) + '?thumb=1'
                    } : null
                };
            })
        );

        res.json({ 
            faces: enrichedFaces,
            count: enrichedFaces.length,
            totalCount: totalCount,
            random: random,
            filters: filters
        });
    } catch (error) {
        console.error('Error getting unidentified faces:', error);
        res.status(500).json({ error: 'Failed to get unidentified faces' });
    }
};

// Internal batch auto-recognize function (no HTTP request/response)
export const batchAutoRecognizeInternal = async (options: {
    limit?: number;
    minConfidence?: number;
}): Promise<{
    recognized: number;
    processed: number;
    needsConfirmation: number;
    trainedPeople: number;
    results: any[];
    confirmationNeeded: any[];
    message: string;
}> => {
    const { limit = 50, minConfidence = 0.9 } = options;
    
    console.log(`Starting batch auto-recognition for up to ${limit} faces with confidence >= ${minConfidence}`);
    
    // Get all persons with CompreFace subjects (trained people)
    const trainedPersons = await PersonRepository.getAllTrainedPersons();
    if (trainedPersons.length === 0) {
        return {
            recognized: 0,
            processed: 0,
            needsConfirmation: 0,
            trainedPeople: 0,
            results: [],
            confirmationNeeded: [],
            message: 'No trained people found. Please manually tag some faces first.'
        };
    }
    
    // Get unidentified faces (no random for batch processing)
    const unidentifiedFaces = await FaceRepository.getUnidentifiedFaces(limit, false, {});
    if (unidentifiedFaces.length === 0) {
        return {
            recognized: 0,
            processed: 0,
            needsConfirmation: 0,
            trainedPeople: trainedPersons.length,
            results: [],
            confirmationNeeded: [],
            message: 'No unidentified faces found.'
        };
    }
    
    let processed = 0;
    let recognized = 0;
    let needsConfirmation = 0;
    const results: any[] = [];
    const confirmationNeeded: any[] = [];
    
    const faceRecognitionConfig = configManager.getFaceRecognitionConfig();
    const HIGH_CONFIDENCE_THRESHOLD = faceRecognitionConfig.confidence.autoAssign;  // Auto-assign threshold from config
    const MIN_CONFIRMATION_THRESHOLD = faceRecognitionConfig.confidence.review; // Review threshold from config
    
    // Group faces by image to enable batch processing
    const facesByImage = new Map<number, any[]>();
    const imagePathsMap = new Map<number, string>();
    
    // Collect all unique image paths and group faces by image
    for (const face of unidentifiedFaces) {
        const image = await ImageRepository.findById(face.image_id);
        if (!image) {
            console.warn(`Image not found for face ${face.id}`);
            continue;
        }
        
        if (!facesByImage.has(face.image_id)) {
            facesByImage.set(face.image_id, []);
            imagePathsMap.set(face.image_id, image.original_path);
        }
        
        facesByImage.get(face.image_id)!.push({
            ...face,
            imageFilename: image.filename
        });
    }
    
    const uniqueImagePaths = Array.from(imagePathsMap.values());
    console.log(`Processing ${uniqueImagePaths.length} unique images containing ${unidentifiedFaces.length} faces using batch recognition`);
    
    // Run batch recognition on all unique images
    const batchResults = await recognizeFacesFromImagesBatch(uniqueImagePaths, 3); // Process max 3 images concurrently
    
    // Group face assignments by person for batch upload to CompreFace
    const faceAssignmentsByPerson = new Map<string, { person: any, facePaths: string[] }>();
    
    // Process recognition results for each image
    for (const [imageId, facesInImage] of facesByImage) {
        const imagePath = imagePathsMap.get(imageId)!;
        const recognitionResults = batchResults.get(imagePath);
        
        if (!recognitionResults || recognitionResults.error) {
            console.warn(`Recognition failed for image ${imagePath}: ${recognitionResults?.error || 'Unknown error'}`);
            processed += facesInImage.length;
            continue;
        }
        
        // Process each face in this image
        for (const face of facesInImage) {
            try {
                processed++;
                
                // Find matching recognition result for this face
                const matchedResult = findMatchingRecognitionResult(face, recognitionResults);
                
                if (matchedResult && matchedResult.subjects && matchedResult.subjects.length > 0) {
                    const bestMatch = matchedResult.subjects[0];
                    
                    // Find person by CompreFace subject ID
                    const person = await PersonRepository.getPersonByComprefaceId(bestMatch.subject);
                    
                    if (person && bestMatch.similarity >= MIN_CONFIRMATION_THRESHOLD) {
                        if (bestMatch.similarity >= HIGH_CONFIDENCE_THRESHOLD) {
                            // High confidence - auto-assign
                            await FaceRepository.assignFaceToPerson(face.id!, person.id!, bestMatch.similarity, 'auto_compreface');
                            await PersonRepository.updateFaceCount(person.id!);
                            
                            // Collect faces for batch upload to CompreFace (only high-confidence faces)
                            if (person.compreface_subject_id && face.detection_confidence >= 0.98) {
                                const facePath = face.relative_face_path || face.face_image_path;
                                if (facePath) {
                                    let fullFacePath: string;
                                    if (facePath.startsWith('/')) {
                                        fullFacePath = facePath;
                                    } else {
                                        fullFacePath = `${configManager.getStorage().processedDir}/faces/${facePath}`;
                                    }
                                    
                                    if (!faceAssignmentsByPerson.has(person.compreface_subject_id)) {
                                        faceAssignmentsByPerson.set(person.compreface_subject_id, {
                                            person,
                                            facePaths: []
                                        });
                                    }
                                    
                                    faceAssignmentsByPerson.get(person.compreface_subject_id)!.facePaths.push(fullFacePath);
                                }
                            }
                            
                            recognized++;
                            results.push({
                                faceId: face.id,
                                personId: person.id,
                                personName: person.name,
                                confidence: bestMatch.similarity,
                                imageFilename: face.imageFilename,
                                action: 'auto_assigned'
                            });
                            
                            // Log face recognition success
        logger.logFaceRecognition({
            imageId: face.image_id,
            faceId: face.id,
            personId: person.id!,
            personName: person.name,
            confidence: bestMatch.similarity,
            method: 'auto_compreface'
        });
                        } else {
                            // Medium confidence - needs user confirmation
                            needsConfirmation++;
                            confirmationNeeded.push({
                                faceId: face.id,
                                personId: person.id,
                                personName: person.name,
                                confidence: bestMatch.similarity,
                                imageFilename: face.imageFilename,
                                faceImagePath: face.face_image_path,
                                action: 'needs_confirmation'
                            });
                            
                            console.log(`Face ${face.id} needs confirmation: ${person.name} (confidence: ${bestMatch.similarity})`);
                        }
                    } else if (bestMatch.similarity < MIN_CONFIRMATION_THRESHOLD) {
                        console.log(`Face ${face.id} confidence too low: ${bestMatch.similarity} < ${MIN_CONFIRMATION_THRESHOLD}`);
                    }
                }
            } catch (error) {
                console.error(`Error processing face ${face.id}:`, error);
                // Continue with next face
            }
        }
    }
    
    // Batch upload faces to CompreFace for training (async, non-blocking)
    if (faceAssignmentsByPerson.size > 0) {
        console.log(`Uploading faces to CompreFace for ${faceAssignmentsByPerson.size} people using batch processing`);
        
        // Don't await this - run in background
        Promise.all(
            Array.from(faceAssignmentsByPerson.entries()).map(async ([subjectId, { person, facePaths }]) => {
                try {
                    console.log(`Batch uploading ${facePaths.length} faces for ${person.name}`);
                    const result = await addFacesToSubjectBatch(subjectId, facePaths, 2); // Max 2 concurrent uploads per person
                    console.log(`Batch upload completed for ${person.name}: ${result.successful.length} successful, ${result.failed.length} failed`);
                } catch (error) {
                    console.warn(`Batch upload failed for ${person.name}:`, error);
                }
            })
        ).then(() => {
            console.log('All batch face uploads completed');
        }).catch((error) => {
            console.warn('Some batch face uploads failed:', error);
        });
    }
    
    return {
        recognized,
        processed,
        needsConfirmation,
        trainedPeople: trainedPersons.length,
        results,
        confirmationNeeded,
        message: `Auto-recognition completed: ${recognized} auto-assigned, ${needsConfirmation} need confirmation from ${processed} processed`
    };
};

// Batch auto-recognize all unidentified faces (HTTP endpoint)
export const batchAutoRecognize = async (req: Request, res: Response) => {
    try {
        const { limit = 50, minConfidence = 0.9 } = req.query;
        
        // Use the internal function for actual processing
        const result = await batchAutoRecognizeInternal({
            limit: parseInt(limit as string),
            minConfidence: parseFloat(minConfidence as string)
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('Error in batch auto-recognition:', error);
        res.status(500).json({ error: 'Failed to run auto-recognition' });
    }
};

// Recognize faces in an image using CompreFace
export const recognizeFacesInImage = async (req: Request, res: Response) => {
    try {
        const { imageId } = req.params;
        
        const image = await ImageRepository.findById(parseInt(imageId));
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Run CompreFace recognition
        const recognitionResults = await recognizeFacesFromImage(image.original_path);
        
        // Update faces in database with recognition results
        const faces = await FaceRepository.getFacesByImage(parseInt(imageId));
        const updates = [];
        
        for (const face of faces) {
            // Match face with recognition results based on bounding box similarity
            const matchedResult = findMatchingRecognitionResult(face, recognitionResults);
            
            if (matchedResult && matchedResult.subjects && matchedResult.subjects.length > 0) {
                const bestMatch = matchedResult.subjects[0];
                
                // Find person by CompreFace subject ID
                const person = await PersonRepository.getPersonByComprefaceId(bestMatch.subject);
                
                const faceRecognitionConfig = configManager.getFaceRecognitionConfig();
                if (person && bestMatch.similarity >= faceRecognitionConfig.confidence.autoAssign) { // High confidence threshold from config
                    await FaceRepository.assignFaceToPerson(
                        face.id!, 
                        person.id!, 
                        bestMatch.similarity,
                        'compreface'
                    );
                    updates.push({
                        faceId: face.id,
                        personId: person.id,
                        personName: person.name,
                        confidence: bestMatch.similarity
                    });
                }
            }
        }

        res.json({ 
            recognitionResults: updates,
            message: `Updated ${updates.length} face recognitions`
        });
    } catch (error) {
        console.error('Error recognizing faces:', error);
        res.status(500).json({ error: 'Failed to recognize faces' });
    }
};

// Helper function to match faces with recognition results
function findMatchingRecognitionResult(face: any, recognitionResults: any): any {
    if (!recognitionResults.result || !Array.isArray(recognitionResults.result)) {
        return null;
    }

    // Find result with most similar bounding box
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const result of recognitionResults.result) {
        if (!result.box) continue;
        
        const boxSimilarity = calculateBoxSimilarity(
            { x_min: face.x_min, y_min: face.y_min, x_max: face.x_max, y_max: face.y_max },
            result.box
        );
        
        if (boxSimilarity > bestSimilarity) {
            bestSimilarity = boxSimilarity;
            bestMatch = result;
        }
    }

    return bestSimilarity > 0.8 ? bestMatch : null; // 80% box overlap threshold
}

// Check system consistency between database and CompreFace
export const checkConsistency = async (req: Request, res: Response) => {
    try {
        const autoRepair = req.query.autoRepair === 'true';
        
        const result = await ConsistencyManager.ensureConsistency({
            checkFaces: true,
            checkPersons: true,
            autoRepair
        });
        
        res.json({
            message: 'Consistency check completed',
            ...result
        });
    } catch (error) {
        console.error('Error checking consistency:', error);
        res.status(500).json({ error: 'Failed to check system consistency' });
    }
};

// Get face filter options
export const getFaceFilterOptions = async (req: Request, res: Response) => {
    try {
        const options = await FaceRepository.getFaceFilterOptions();
        res.json(options);
    } catch (error) {
        console.error('Error getting face filter options:', error);
        res.status(500).json({ error: 'Failed to get filter options' });
    }
};

// Get training history for a person
export const getPersonTrainingHistory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const personId = validatePersonId(id);
    
    const person = await PersonRepository.getPersonWithFaceCount(personId);
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    const history = await db('recognition_training_history')
        .where({ person_id: personId })
        .orderBy('created_at', 'desc')
        .limit(20);

    res.json({ 
        person: person,
        trainingHistory: history 
    });
});

// Start training for a person
export const startPersonTraining = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { trainingType = 'incremental' } = req.body;
    
    const personId = validatePersonId(id);
    
    const person = await PersonRepository.getPersonWithFaceCount(personId);
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    if (!person.compreface_subject_id) {
        throw new AppError('Person has no CompreFace subject ID. Cannot train.', 400);
    }

    // Get faces assigned to this person for training
    const faces = await FaceRepository.getFacesByPerson(personId);
    if (faces.length === 0) {
        throw new AppError('Person has no assigned faces for training', 400);
    }

    // Create training history entry
    const [trainingId] = await db('recognition_training_history').insert({
        person_id: personId,
        faces_trained_count: faces.length,
        training_type: trainingType,
        status: 'pending',
        started_at: new Date()
    });

    // Update person status
    await PersonRepository.updatePerson(personId, {
        recognition_status: 'training'
    });

    // Start training process (async)
    trainPersonAsync(personId, person, faces, trainingId)
        .catch(error => {
            req.logger.error(`Training failed for person ${personId}`, error);
        });

    res.json({
        message: 'Training started',
        person: await PersonRepository.getPersonWithFaceCount(personId),
        trainingId
    });
});

// Get faces needing review
export const getFacesNeedingReview = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    
    const faces = await db('detected_faces')
        .where({ needs_review: true })
        .whereNotNull('person_id')
        .where('person_id', '>', 0)
        .limit(limit)
        .select('*');

    // Enrich with person and image data
    const enrichedFaces = await Promise.all(
        faces.map(async (face) => {
            const [person, image] = await Promise.all([
                face.person_id ? PersonRepository.getPersonWithFaceCount(face.person_id) : null,
                ImageRepository.findById(face.image_id)
            ]);
            
            return {
                ...face,
                person: person ? { id: person.id, name: person.name } : null,
                image: image ? {
                    id: image.id,
                    filename: image.filename,
                    date_taken: image.date_taken
                } : null
            };
        })
    );

    res.json({
        faces: enrichedFaces,
        count: enrichedFaces.length
    });
});

// Approve or reject faces needing review
export const reviewFaceAssignment = asyncHandler(async (req: Request, res: Response) => {
    const { faceId } = req.params;
    const { approved, personId } = req.body;
    
    validateRequired(approved, 'Approval decision');
    const faceIdNum = validateFaceId(faceId);
    
    const face = await FaceRepository.getFaceById(faceIdNum);
    if (!face) {
        throw new AppError('Face not found', 404);
    }

    if (approved) {
        // Approve the assignment
        await db('detected_faces')
            .where({ id: faceIdNum })
            .update({
                needs_review: false,
                assigned_at: new Date(),
                assigned_by: 'user_review'
            });

        // If person was changed, update assignment
        if (personId && personId !== face.person_id) {
            await FaceRepository.assignFaceToPerson(faceIdNum, personId, face.person_confidence || 1.0, 'manual_review');
            await PersonRepository.updateFaceCount(personId);
            
            // Update old person's count if there was one
            if (face.person_id) {
                await PersonRepository.updateFaceCount(face.person_id);
            }
        }
    } else {
        // Reject the assignment
        await FaceRepository.clearPersonFromFace(faceIdNum);
        await db('detected_faces')
            .where({ id: faceIdNum })
            .update({
                needs_review: false,
                assigned_at: null,
                assigned_by: null
            });
            
        // Update person's face count
        if (face.person_id) {
            await PersonRepository.updateFaceCount(face.person_id);
        }
    }

    res.json({
        message: approved ? 'Face assignment approved' : 'Face assignment rejected',
        face: await FaceRepository.getFaceById(faceIdNum)
    });
});

// Get similar faces for clustering
export const getSimilarFaces = asyncHandler(async (req: Request, res: Response) => {
    const { faceId } = req.params;
    const { threshold = 0.8, limit = 20 } = req.query;
    
    const faceIdNum = validateFaceId(faceId);
    const thresholdNum = parseFloat(threshold as string);
    const limitNum = parseInt(limit as string);
    
    const baseFace = await FaceRepository.getFaceById(faceIdNum);
    if (!baseFace) {
        throw new AppError('Face not found', 404);
    }

    // Get similar faces from similarity matrix
    const similarFaces = await db('face_similarities as fs')
        .join('detected_faces as df', function() {
            this.on('df.id', '=', 'fs.face_b_id')
                .orOn('df.id', '=', 'fs.face_a_id');
        })
        .where(function() {
            this.where('fs.face_a_id', faceIdNum)
                .orWhere('fs.face_b_id', faceIdNum);
        })
        .where('fs.similarity_score', '>=', thresholdNum)
        .where('df.id', '!=', faceIdNum)
        .whereNull('df.person_id') // Only unassigned faces
        .orderBy('fs.similarity_score', 'desc')
        .limit(limitNum)
        .select('df.*', 'fs.similarity_score');

    // Enrich with image data
    const enrichedFaces = await Promise.all(
        similarFaces.map(async (face) => {
            const image = await ImageRepository.findById(face.image_id);
            return {
                ...face,
                image: image ? {
                    id: image.id,
                    filename: image.filename,
                    date_taken: image.date_taken
                } : null
            };
        })
    );

    res.json({
        baseFace: baseFace,
        similarFaces: enrichedFaces,
        threshold: thresholdNum
    });
});

// Helper function for async training
async function trainPersonAsync(personId: number, person: any, faces: any[], trainingId: number) {
    try {
        // Mark training as in progress
        await db('recognition_training_history')
            .where({ id: trainingId })
            .update({ 
                status: 'in_progress',
                started_at: new Date()
            });

        // Collect face paths for CompreFace training (only high-confidence faces)
        const processedDir = configManager.getStorage().processedDir;
        const facePaths = faces
            .filter(face => face.relative_face_path || face.face_image_path)
            .filter(face => face.detection_confidence >= 0.98) // Only high-confidence faces
            .map(face => {
                // Use relative_face_path (preferred) or fall back to face_image_path
                const facePath = face.relative_face_path || face.face_image_path;
                
                if (!facePath) {
                    return null; // Will be filtered out
                }
                
                if (facePath.startsWith('/')) {
                    // Already absolute path, use as-is
                    return facePath;
                } else {
                    // Relative path, construct full path
                    return `${processedDir}/faces/${facePath}`;
                }
            })
            .filter((path): path is string => path !== null); // Filter out nulls

        if (facePaths.length === 0) {
            throw new Error('No valid face images found for training');
        }

        // Train using batch upload
        const result = await addFacesToSubjectBatch(person.compreface_subject_id, facePaths, 3);
        
        const successCount = result.successful.length;
        const failCount = result.failed.length;

        // Mark training faces
        await db('detected_faces')
            .whereIn('id', faces.map(f => f.id))
            .update({ is_training_image: true });

        // Update training history
        await db('recognition_training_history')
            .where({ id: trainingId })
            .update({
                status: successCount > 0 ? 'completed' : 'failed',
                completed_at: new Date(),
                error_message: failCount > 0 ? `${failCount} faces failed to upload` : null
            });

        // Update person status
        await PersonRepository.updatePerson(personId, {
            recognition_status: successCount > 0 ? 'trained' : 'failed',
            training_face_count: successCount,
            last_trained_at: new Date()
        });

        console.log(`Training completed for ${person.name}: ${successCount} successful, ${failCount} failed`);

    } catch (error) {
        console.error(`Training failed for person ${personId}:`, error);
        
        // Mark training as failed
        await db('recognition_training_history')
            .where({ id: trainingId })
            .update({
                status: 'failed',
                completed_at: new Date(),
                error_message: error instanceof Error ? error.message : 'Unknown error'
            });

        await PersonRepository.updatePerson(personId, {
            recognition_status: 'failed'
        });
    }
}

// Helper function to calculate bounding box similarity
function calculateBoxSimilarity(box1: any, box2: any): number {
    const intersection = Math.max(0, Math.min(box1.x_max, box2.x_max) - Math.max(box1.x_min, box2.x_min)) *
                        Math.max(0, Math.min(box1.y_max, box2.y_max) - Math.max(box1.y_min, box2.y_min));
    
    const area1 = (box1.x_max - box1.x_min) * (box1.y_max - box1.y_min);
    const area2 = (box2.x_max - box2.x_min) * (box2.y_max - box2.y_min);
    const union = area1 + area2 - intersection;
    
    return union > 0 ? intersection / union : 0;
}

// Face Clustering API Endpoints

// Start face clustering process
export const startFaceClustering = asyncHandler(async (req: Request, res: Response) => {
    const { 
        similarityThreshold = 0.75, 
        minClusterSize = 2, 
        maxClusterSize = 50,
        algorithm = 'bbox_intersection',
        rebuild = false
    } = req.body;

    console.log('CLUSTER ENDPOINT: Starting face clustering endpoint');
    req.logger.info('Starting face clustering', { 
        similarityThreshold, 
        minClusterSize, 
        maxClusterSize, 
        algorithm,
        rebuild
    });

    console.log('CLUSTER ENDPOINT: About to create FaceClusteringService');
    try {
        console.log('CLUSTER ENDPOINT: Creating FaceClusteringService instance');
        
        const clusteringService = new FaceClusteringService({
            similarityThreshold,
            minClusterSize,
            maxClusterSize,
            algorithm
        });

        const result = rebuild 
            ? await clusteringService.rebuildAllClusters()
            : await clusteringService.clusterUnassignedFaces();

        logger.logPerformance('face_clustering', {
            duration: result.timeElapsed,
            clustersCreated: result.clustersCreated,
            facesProcessed: result.facesProcessed,
            similaritiesCalculated: result.similaritiesCalculated
        });

        res.json({
            success: true,
            result,
            message: `Created ${result.clustersCreated} clusters from ${result.facesProcessed} faces`
        });

    } catch (error) {
        req.logger.error('Face clustering failed', error);
        throw new AppError('Face clustering failed', 500);
    }
});

// Get all face clusters
export const getFaceClusters = asyncHandler(async (req: Request, res: Response) => {
    const { includeReviewed = false, limit = 50, offset = 0 } = req.query;
    
    const { FaceClusterRepository } = await import('../models/database');
    
    const clusters = await FaceClusterRepository.getAllClusters(
        includeReviewed === 'true'
    );

    // Apply pagination
    const limitNum = parseInt(limit as string) || 50;
    const offsetNum = parseInt(offset as string) || 0;
    const paginatedClusters = clusters.slice(offsetNum, offsetNum + limitNum);

    // Enrich each cluster with face preview images
    const enrichedClusters = await Promise.all(
        paginatedClusters.map(async (cluster) => {
            const faces = await db('face_cluster_members')
                .join('detected_faces', 'face_cluster_members.face_id', 'detected_faces.id')
                .where('face_cluster_members.cluster_id', cluster.id)
                .orderBy('face_cluster_members.is_representative', 'desc')
                .orderBy('face_cluster_members.similarity_to_cluster', 'desc')
                .limit(5) // Only get first 5 faces for preview
                .select(
                    'detected_faces.id',
                    'detected_faces.face_image_path',
                    'face_cluster_members.similarity_to_cluster',
                    'face_cluster_members.is_representative'
                );
            
            return {
                ...cluster,
                faces
            };
        })
    );

    res.json({
        clusters: enrichedClusters,
        total: clusters.length,
        limit: limitNum,
        offset: offsetNum
    });
});

// Get specific cluster with all its members
export const getFaceCluster = asyncHandler(async (req: Request, res: Response) => {
    const { clusterId } = req.params;
    const clusterIdNum = parseInt(clusterId);
    
    if (isNaN(clusterIdNum)) {
        throw new AppError('Invalid cluster ID', 400);
    }

    const { FaceClusterRepository } = await import('../models/database');
    
    const cluster = await FaceClusterRepository.getClusterWithMembers(clusterIdNum);
    
    if (!cluster) {
        throw new AppError('Cluster not found', 404);
    }

    res.json({ cluster });
});

// Assign entire cluster to a person
export const assignClusterToPerson = asyncHandler(async (req: Request, res: Response) => {
    const { clusterId } = req.params;
    const { personId } = req.body;
    
    const clusterIdNum = parseInt(clusterId);
    const personIdNum = validatePersonId(personId);

    const { FaceClusterRepository, FaceClusterMemberRepository, FaceRepository, PersonRepository } = await import('../models/database');
    
    // Verify cluster exists
    const cluster = await FaceClusterRepository.findById(clusterIdNum);
    if (!cluster) {
        throw new AppError('Cluster not found', 404);
    }

    // Verify person exists
    const person = await PersonRepository.getPersonWithFaceCount(personIdNum);
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    // Get all faces in the cluster
    const members = await FaceClusterMemberRepository.findByCluster(clusterIdNum);
    
    // Assign all faces to the person
    for (const member of members) {
        await FaceRepository.assignFaceToPerson(
            member.face_id,
            personIdNum,
            member.similarity_to_cluster,
            'clustering'
        );
    }

    // Mark cluster as reviewed and assigned
    await FaceClusterRepository.assignToPerson(clusterIdNum, personIdNum);
    
    // Update person face count
    await PersonRepository.updateFaceCount(personIdNum);

    req.logger.info('Cluster assigned to person', {
        clusterId: clusterIdNum,
        personId: personIdNum,
        faceCount: members.length
    });

    res.json({
        success: true,
        message: `Assigned ${members.length} faces from cluster to ${person.name}`,
        facesAssigned: members.length
    });
});

// Mark cluster as reviewed without assignment
export const reviewCluster = asyncHandler(async (req: Request, res: Response) => {
    const { clusterId } = req.params;
    const { action, notes } = req.body; // action: 'approve', 'reject', 'split'
    
    const clusterIdNum = parseInt(clusterId);
    
    if (isNaN(clusterIdNum)) {
        throw new AppError('Invalid cluster ID', 400);
    }

    const { FaceClusterRepository } = await import('../models/database');
    
    const cluster = await FaceClusterRepository.findById(clusterIdNum);
    if (!cluster) {
        throw new AppError('Cluster not found', 404);
    }

    switch (action) {
        case 'approve':
            await FaceClusterRepository.markAsReviewed(clusterIdNum, notes);
            break;
        case 'reject':
            // Delete cluster and remove face memberships
            await FaceClusterRepository.delete(clusterIdNum);
            break;
        case 'split':
            // TODO: Implement cluster splitting logic
            throw new AppError('Cluster splitting not yet implemented', 501);
        default:
            throw new AppError('Invalid action. Use: approve, reject, split', 400);
    }

    res.json({
        success: true,
        message: `Cluster ${action}ed successfully`
    });
});

// Get clustering statistics
export const getClusteringStats = asyncHandler(async (req: Request, res: Response) => {
    const { FaceClusteringService } = await import('../util/face-clustering');
    
    const clusteringService = new FaceClusteringService();
    const stats = await clusteringService.getClusteringStats();

    res.json({ stats });
});

// Clean up orphaned similarities
export const cleanupOrphanedSimilarities = asyncHandler(async (req: Request, res: Response) => {
    const { FaceClusteringService } = await import('../util/face-clustering');
    
    const clusteringService = new FaceClusteringService();
    const deleted = await clusteringService.cleanupOrphanedSimilarities();

    res.json({
        success: true,
        message: `Cleaned up ${deleted} orphaned similarities`,
        deleted
    });
});

// Enhanced Face-to-Person Assignment APIs

// Bulk assign multiple faces to a person with validation
export const bulkAssignFaces = asyncHandler(async (req: Request, res: Response) => {
    const { faceIds, personId, confidence = 0.95, method = 'manual_bulk' } = req.body;
    
    validateRequired(faceIds, 'Face IDs array');
    validateRequired(personId, 'Person ID');
    validateArray(faceIds, 'Face IDs');
    
    const personIdNum = validatePersonId(personId);
    
    // Verify person exists
    const person = await PersonRepository.getPersonWithFaceCount(personIdNum);
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    // Validate all faces exist and are unassigned
    const invalidFaces: number[] = [];
    const alreadyAssigned: number[] = [];
    const validFaces: any[] = [];

    for (const faceId of faceIds) {
        const faceIdNum = validateFaceId(faceId);
        const face = await FaceRepository.getFaceById(faceIdNum);
        
        if (!face) {
            invalidFaces.push(faceIdNum);
            continue;
        }
        
        if (face.person_id) {
            alreadyAssigned.push(faceIdNum);
            continue;
        }
        
        validFaces.push(face);
    }

    // Report validation issues
    if (invalidFaces.length > 0 || alreadyAssigned.length > 0) {
        return res.status(400).json({
            error: 'Some faces cannot be assigned',
            invalidFaces,
            alreadyAssigned,
            validFaceCount: validFaces.length
        });
    }

    // Perform bulk assignment
    const results = [];
    for (const face of validFaces) {
        await FaceRepository.assignFaceToPerson(
            face.id!,
            personIdNum,
            confidence,
            method
        );
        
        results.push({
            faceId: face.id,
            success: true
        });
    }

    // Update person face count
    await PersonRepository.updateFaceCount(personIdNum);

    req.logger.info('Bulk face assignment completed', {
        personId: personIdNum,
        personName: person.name,
        facesAssigned: validFaces.length,
        method
    });

    res.json({
        success: true,
        message: `Assigned ${validFaces.length} faces to ${person.name}`,
        results,
        person: await PersonRepository.getPersonWithFaceCount(personIdNum)
    });
});

// Smart assignment: suggest persons for unassigned faces based on existing similarities
export const suggestPersonsForFaces = asyncHandler(async (req: Request, res: Response) => {
    const { faceIds, maxSuggestions = 3, minConfidence = 0.7 } = req.body;
    
    validateRequired(faceIds, 'Face IDs array');
    validateArray(faceIds, 'Face IDs');

    const suggestions = [];

    for (const faceId of faceIds) {
        const faceIdNum = validateFaceId(faceId);
        const face = await FaceRepository.getFaceById(faceIdNum);
        
        if (!face || face.person_id) {
            suggestions.push({
                faceId: faceIdNum,
                suggestions: [],
                reason: face ? 'Already assigned' : 'Face not found'
            });
            continue;
        }

        // Get similar faces that are already assigned
        const { FaceSimilarityRepository } = await import('../models/database');
        const similarAssignedFaces = await db('face_similarities as fs')
            .join('detected_faces as df', function() {
                this.on('df.id', '=', 'fs.face_b_id')
                    .orOn('df.id', '=', 'fs.face_a_id');
            })
            .join('persons as p', 'df.person_id', 'p.id')
            .where(function() {
                this.where('fs.face_a_id', faceIdNum)
                    .orWhere('fs.face_b_id', faceIdNum);
            })
            .where('fs.similarity_score', '>=', minConfidence)
            .where('df.id', '!=', faceIdNum)
            .whereNotNull('df.person_id') // Only assigned faces
            .orderBy('fs.similarity_score', 'desc')
            .limit(maxSuggestions)
            .select('p.id as person_id', 'p.name as person_name', 'fs.similarity_score', 'df.id as similar_face_id');

        // Group by person and get best similarity score
        const personSuggestions = new Map();
        for (const result of similarAssignedFaces) {
            if (!personSuggestions.has(result.person_id)) {
                personSuggestions.set(result.person_id, {
                    personId: result.person_id,
                    personName: result.person_name,
                    confidence: result.similarity_score,
                    similarFaceId: result.similar_face_id
                });
            } else {
                // Update if this similarity is higher
                const existing = personSuggestions.get(result.person_id);
                if (result.similarity_score > existing.confidence) {
                    existing.confidence = result.similarity_score;
                    existing.similarFaceId = result.similar_face_id;
                }
            }
        }

        suggestions.push({
            faceId: faceIdNum,
            suggestions: Array.from(personSuggestions.values()),
            reason: personSuggestions.size > 0 ? 'Based on similar faces' : 'No similar assigned faces found'
        });
    }

    res.json({
        success: true,
        suggestions,
        parameters: {
            maxSuggestions,
            minConfidence
        }
    });
});

// Find similar unassigned faces after manual assignment (for batch suggestion workflow)
export const findSimilarUnassignedFaces = asyncHandler(async (req: Request, res: Response) => {
    const { personId, recentlyAssignedFaceId, maxSuggestions = 5, minConfidence = 0.75 } = req.body;
    
    validateRequired(personId, 'Person ID');
    validateRequired(recentlyAssignedFaceId, 'Recently assigned face ID');
    
    const personIdNum = validatePersonId(personId);
    const faceIdNum = validateFaceId(recentlyAssignedFaceId);
    
    req.logger.info('Finding similar unassigned faces for batch suggestion', {
        personId: personIdNum,
        recentlyAssignedFaceId: faceIdNum,
        maxSuggestions,
        minConfidence
    });
    
    // Get the person details
    const person = await PersonRepository.getPersonWithFaceCount(personIdNum);
    if (!person) {
        throw new AppError('Person not found', 404);
    }
    
    // Get the recently assigned face details
    const recentlyAssignedFace = await FaceRepository.getFaceById(faceIdNum);
    if (!recentlyAssignedFace) {
        throw new AppError('Recently assigned face not found', 404);
    }
    
    try {
        // Use CompreFace to find similar faces
        const { recognizeFacesFromImage } = await import('../util/compreface');
        
        // Get unassigned faces from recent images (last 50 processed images)
        const recentUnassignedFaces = await db('detected_faces as df')
            .join('images as i', 'df.image_id', 'i.id')
            .whereNull('df.person_id')
            .whereNotNull('df.face_image_path')
            .where('df.detection_confidence', '>=', 0.8)
            .orderBy('i.date_processed', 'desc')
            .limit(100) // Check last 100 unassigned faces
            .select('df.*', 'i.relative_media_path', 'i.filename');
        
        if (recentUnassignedFaces.length === 0) {
            return res.json({
                success: true,
                suggestions: [],
                message: 'No recent unassigned faces found',
                person: person,
                recentlyAssignedFace: {
                    id: recentlyAssignedFace.id,
                    faceUrl: getFaceUrl(recentlyAssignedFace),
                    confidence: recentlyAssignedFace.detection_confidence
                }
            });
        }
        
        // Process faces in batches to find similarities using CompreFace
        const suggestions = [];
        const batchSize = 10;
        
        for (let i = 0; i < recentUnassignedFaces.length && suggestions.length < maxSuggestions; i += batchSize) {
            const batch = recentUnassignedFaces.slice(i, i + batchSize);
            
            for (const face of batch) {
                if (suggestions.length >= maxSuggestions) break;
                
                try {
                    // Get the full face image path
                    const processedDir = configManager.getStorage().processedDir;
                    const fullFacePath = path.join(processedDir, 'faces', face.relative_face_path || path.basename(face.face_image_path));
                    
                    if (!fs.existsSync(fullFacePath)) {
                        continue;
                    }
                    
                    // Use CompreFace to recognize this face
                    const recognitionResult = await recognizeFacesFromImage(fullFacePath);
                    
                    if (recognitionResult?.result && recognitionResult.result.length > 0) {
                        const result = recognitionResult.result[0];
                        if (result.subjects && result.subjects.length > 0) {
                            const bestMatch = result.subjects[0];
                            
                            // Check if the best match is our target person
                            if (bestMatch.subject === person.compreface_subject_id && 
                                bestMatch.similarity >= minConfidence) {
                                
                                suggestions.push({
                                    faceId: face.id,
                                    imageId: face.image_id,
                                    faceUrl: getFaceUrl(face),
                                    confidence: bestMatch.similarity,
                                    detectionConfidence: face.detection_confidence,
                                    image: {
                                        filename: face.filename || 'Unknown',
                                        mediaUrl: face.relative_media_path ? `/media/${face.relative_media_path}` : ''
                                    },
                                    coordinates: {
                                        x_min: face.x_min,
                                        y_min: face.y_min,
                                        x_max: face.x_max,
                                        y_max: face.y_max
                                    }
                                });
                            }
                        }
                    }
                } catch (faceError) {
                    req.logger.warn('Error processing face for similarity', {
                        faceId: face.id,
                        error: faceError
                    });
                    // Continue with next face
                }
            }
        }
        
        // Sort suggestions by confidence
        suggestions.sort((a, b) => b.confidence - a.confidence);
        
        req.logger.info('Found similar unassigned faces', {
            personId: personIdNum,
            personName: person.name,
            suggestionsFound: suggestions.length,
            averageConfidence: suggestions.length > 0 ? 
                (suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length).toFixed(3) : 0
        });
        
        res.json({
            success: true,
            suggestions: suggestions.slice(0, maxSuggestions),
            person: person,
            recentlyAssignedFace: {
                id: recentlyAssignedFace.id,
                faceUrl: getFaceUrl(recentlyAssignedFace),
                confidence: recentlyAssignedFace.detection_confidence,
                image: {
                    filename: 'Face Image',
                    mediaUrl: ''
                }
            },
            parameters: {
                maxSuggestions,
                minConfidence,
                facesChecked: recentUnassignedFaces.length
            }
        });
        
    } catch (error) {
        req.logger.error('Error finding similar unassigned faces', { error, personId: personIdNum });
        throw new AppError('Failed to find similar faces', 500);
    }
});

// Reassign face from one person to another
export const reassignFace = asyncHandler(async (req: Request, res: Response) => {
    const { faceId } = req.params;
    const { fromPersonId, toPersonId, confidence = 0.95, reason } = req.body;
    
    const faceIdNum = validateFaceId(faceId);
    const fromPersonIdNum = validatePersonId(fromPersonId);
    const toPersonIdNum = validatePersonId(toPersonId);

    // Verify face exists and is assigned to fromPerson
    const face = await FaceRepository.getFaceById(faceIdNum);
    if (!face) {
        throw new AppError('Face not found', 404);
    }
    
    if (face.person_id !== fromPersonIdNum) {
        throw new AppError('Face is not assigned to the specified person', 400);
    }

    // Verify both persons exist
    const [fromPerson, toPerson] = await Promise.all([
        PersonRepository.getPersonWithFaceCount(fromPersonIdNum),
        PersonRepository.getPersonWithFaceCount(toPersonIdNum)
    ]);

    if (!fromPerson || !toPerson) {
        throw new AppError('One or both persons not found', 404);
    }

    // Perform reassignment
    await FaceRepository.assignFaceToPerson(
        faceIdNum,
        toPersonIdNum,
        confidence,
        'manual_reassignment'
    );

    // Update face counts for both persons
    await Promise.all([
        PersonRepository.updateFaceCount(fromPersonIdNum),
        PersonRepository.updateFaceCount(toPersonIdNum)
    ]);

    req.logger.info('Face reassigned between persons', {
        faceId: faceIdNum,
        fromPersonId: fromPersonIdNum,
        fromPersonName: fromPerson.name,
        toPersonId: toPersonIdNum,
        toPersonName: toPerson.name,
        reason: reason || 'No reason provided'
    });

    res.json({
        success: true,
        message: `Face reassigned from ${fromPerson.name} to ${toPerson.name}`,
        fromPerson: await PersonRepository.getPersonWithFaceCount(fromPersonIdNum),
        toPerson: await PersonRepository.getPersonWithFaceCount(toPersonIdNum)
    });
});

// Get assignment workflow suggestions (faces that need attention)
export const getAssignmentWorkflow = asyncHandler(async (req: Request, res: Response) => {
    const { limit = 50, includeClusteredFaces = true, includeSimilarityMatches = true } = req.query;
    
    const workflow: {
        pendingClusters: any[];
        similarityMatches: any[];
        unclusteredFaces: any[];
        statistics: any;
    } = {
        pendingClusters: [],
        similarityMatches: [],
        unclusteredFaces: [],
        statistics: {}
    };

    const limitNum = parseInt(limit as string) || 50;

    // Get pending clusters (highest face count first)
    if (includeClusteredFaces === 'true') {
        const { FaceClusterRepository } = await import('../models/database');
        workflow.pendingClusters = await FaceClusterRepository.getAllClusters(false);
    }

    // Get faces with high similarity to assigned faces
    if (includeSimilarityMatches === 'true') {
        const highSimilarityFaces = await db('face_similarities as fs')
            .join('detected_faces as df_unassigned', function() {
                this.on('df_unassigned.id', '=', 'fs.face_a_id')
                    .orOn('df_unassigned.id', '=', 'fs.face_b_id');
            })
            .join('detected_faces as df_assigned', function() {
                this.on('df_assigned.id', '=', 'fs.face_b_id')
                    .orOn('df_assigned.id', '=', 'fs.face_a_id');
            })
            .join('persons as p', 'df_assigned.person_id', 'p.id')
            .where('fs.similarity_score', '>=', 0.8)
            .whereNull('df_unassigned.person_id') // Unassigned face
            .whereNotNull('df_assigned.person_id') // Assigned face
            .where('df_unassigned.id', '!=', db.raw('df_assigned.id'))
            .orderBy('fs.similarity_score', 'desc')
            .limit(limitNum)
            .select(
                'df_unassigned.id as unassigned_face_id',
                'df_unassigned.face_image_path as unassigned_face_path',
                'df_assigned.id as assigned_face_id', 
                'p.id as suggested_person_id',
                'p.name as suggested_person_name',
                'fs.similarity_score'
            );

        workflow.similarityMatches = highSimilarityFaces;
    }

    // Get some unclustered faces for manual review
    const unclusteredFaces = await db('detected_faces as df')
        .leftJoin('face_cluster_members as fcm', 'df.id', 'fcm.face_id')
        .whereNull('df.person_id')
        .whereNull('fcm.face_id') // Not in any cluster
        .whereNotNull('df.face_image_path')
        .orderBy('df.detection_confidence', 'desc')
        .limit(Math.floor(limitNum / 2))
        .select('df.*');

    workflow.unclusteredFaces = unclusteredFaces;

    // Get workflow statistics
    workflow.statistics = {
        pendingClusters: workflow.pendingClusters.length,
        similarityMatches: workflow.similarityMatches.length,
        unclusteredFaces: workflow.unclusteredFaces.length,
        totalUnassignedFaces: await db('detected_faces').whereNull('person_id').count('* as count').first().then(r => r?.count || 0)
    };

    res.json({
        success: true,
        workflow,
        recommendations: {
            nextAction: workflow.pendingClusters.length > 0 ? 'Review face clusters' :
                       workflow.similarityMatches.length > 0 ? 'Review similarity matches' :
                       'Manual face assignment',
            priority: workflow.pendingClusters.length > 5 ? 'high' : 
                     workflow.similarityMatches.length > 10 ? 'medium' : 'low'
        }
    });
});

// CompreFace Training Management API Endpoints

// Queue person for training
export const queuePersonTraining = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { trainingType = 'incremental', config = {} } = req.body;
    
    const personId = validatePersonId(id);
    
    const trainingManager = new CompreFaceTrainingManager(config);
    const trainingId = await trainingManager.queuePersonForTraining(personId, trainingType);
    
    res.json({
        success: true,
        message: 'Person queued for training',
        trainingId
    });
});

// Process training queue
export const processTrainingQueue = asyncHandler(async (req: Request, res: Response) => {
    const { config = {} } = req.body;
    
    const trainingManager = new CompreFaceTrainingManager(config);
    const results = await trainingManager.processTrainingQueue();
    
    res.json({
        success: true,
        message: `Processed ${results.length} training jobs`,
        results
    });
});

// Auto-train eligible people
export const autoTrainEligiblePeople = asyncHandler(async (req: Request, res: Response) => {
    const { config = {} } = req.body;
    
    const trainingManager = new CompreFaceTrainingManager(config);
    const queuedJobs = await trainingManager.autoTrainEligiblePeople();
    
    res.json({
        success: true,
        message: `Auto-queued ${queuedJobs.length} people for training`,
        queuedJobs
    });
});

// Get training queue status
export const getTrainingQueue = asyncHandler(async (req: Request, res: Response) => {
    const trainingManager = new CompreFaceTrainingManager();
    const queue = await trainingManager.getTrainingQueue();
    
    res.json({
        success: true,
        queue
    });
});

// Get training statistics
export const getTrainingStats = asyncHandler(async (req: Request, res: Response) => {
    const trainingManager = new CompreFaceTrainingManager();
    const stats = await trainingManager.getTrainingStats();
    
    res.json({
        success: true,
        stats
    });
});

// Cancel training job
export const cancelTrainingJob = asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    
    const jobIdNum = parseInt(jobId);
    if (isNaN(jobIdNum)) {
        throw new AppError('Invalid job ID', 400);
    }
    
    const trainingManager = new CompreFaceTrainingManager();
    const success = await trainingManager.cancelTrainingJob(jobIdNum);
    
    if (!success) {
        throw new AppError('Training job not found or cannot be cancelled', 404);
    }
    
    res.json({
        success: true,
        message: 'Training job cancelled'
    });
});

// Retry failed training job
export const retryTrainingJob = asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    
    const jobIdNum = parseInt(jobId);
    if (isNaN(jobIdNum)) {
        throw new AppError('Invalid job ID', 400);
    }
    
    const trainingManager = new CompreFaceTrainingManager();
    const newJobId = await trainingManager.retryTrainingJob(jobIdNum);
    
    res.json({
        success: true,
        message: 'Training job retried',
        newJobId
    });
});

// Clean up old training history
export const cleanupTrainingHistory = asyncHandler(async (req: Request, res: Response) => {
    const { daysToKeep = 30 } = req.body;
    
    const trainingManager = new CompreFaceTrainingManager();
    const deleted = await trainingManager.cleanupTrainingHistory(daysToKeep);
    
    res.json({
        success: true,
        message: `Cleaned up ${deleted} old training history records`,
        deleted
    });
});

// Get faces in a specific cluster (this was missing from existing functions)
export const getClusterFaces = asyncHandler(async (req: Request, res: Response) => {
    const { clusterId } = req.params;
    const clusterIdNum = parseInt(clusterId);
    
    if (!clusterIdNum) {
        throw new AppError('Invalid cluster ID', 400);
    }
    
    const cluster = await db('face_clusters').where('id', clusterIdNum).first();
    if (!cluster) {
        throw new AppError('Cluster not found', 404);
    }
    
    const faces = await db('face_cluster_members')
        .join('detected_faces', 'face_cluster_members.face_id', 'detected_faces.id')
        .join('images', 'detected_faces.image_id', 'images.id')
        .where('face_cluster_members.cluster_id', clusterIdNum)
        .orderBy('face_cluster_members.is_representative', 'desc')
        .orderBy('face_cluster_members.similarity_to_cluster', 'desc')
        .select(
            'detected_faces.id',
            'detected_faces.face_image_path',
            'detected_faces.x_min',
            'detected_faces.y_min', 
            'detected_faces.x_max',
            'detected_faces.y_max',
            'detected_faces.detection_confidence',
            'face_cluster_members.similarity_to_cluster',
            'face_cluster_members.is_representative',
            'images.filename',
            'images.original_path'
        );
    
    res.json({
        success: true,
        cluster,
        faces
    });
});

// Rebuild all clusters (this was missing from existing functions)
export const rebuildClusters = asyncHandler(async (req: Request, res: Response) => {
    const clusteringService = new FaceClusteringService();
    
    req.logger.info('Starting cluster rebuild');
    const result = await clusteringService.rebuildAllClusters();
    
    res.json({
        success: true,
        message: 'Clusters rebuilt successfully',
        result
    });
});

// Sync all persons to CompreFace subjects
export const syncPersonsToCompreFace = asyncHandler(async (req: Request, res: Response) => {
    req.logger.info('Starting person-to-CompreFace synchronization');
    
    const result = await ConsistencyManager.syncPersonsToCompreFace();
    
    res.json({
        success: true,
        message: 'Person synchronization completed',
        ...result
    });
});

// Sync all existing face assignments to CompreFace
export const syncExistingFacesToCompreFace = asyncHandler(async (req: Request, res: Response) => {
    req.logger.info('Starting sync of existing face assignments to CompreFace');
    
    const result = await ConsistencyManager.syncExistingFacesToCompreFace();
    
    res.json({
        success: true,
        message: 'Existing faces synchronization completed',
        ...result
    });
});

// Simple CompreFace training for a person
export const trainPersonModel = asyncHandler(async (req: Request, res: Response) => {
    // Support both URL param (for API) and body param (for mobile app)
    const id = req.params.id || req.body.personId;
    const personId = validatePersonId(id);
    
    const person = await PersonRepository.getPersonWithFaceCount(personId);
    if (!person) {
        throw new AppError('Person not found', 404);
    }
    
    if (!person.compreface_subject_id) {
        throw new AppError('Person has no CompreFace subject ID', 400);
    }
    
    if (person.face_count < 2) {
        throw new AppError(`Person needs at least 2 faces to train. Currently has ${person.face_count} faces.`, 400);
    }
    
    req.logger.info(`Starting training for person: ${person.name} (${person.face_count} faces)`);
    
    try {
        // Update person status to training
        await PersonRepository.updatePerson(personId, {
            recognition_status: 'training',
            last_trained_at: new Date()
        });
        
        // CompreFace trains automatically when faces are added to subjects
        // The model is ready immediately after adding faces
        // We just need to mark the person as trained
        await PersonRepository.updatePerson(personId, {
            recognition_status: 'trained',
            training_face_count: person.face_count
        });
        
        req.logger.info(`Training completed for person: ${person.name}`);
        
        const updatedPerson = await PersonRepository.getPersonWithFaceCount(personId);
        
        res.json({
            success: true,
            message: `Training completed for ${person.name}`,
            person: updatedPerson
        });
        
    } catch (error) {
        req.logger.error(`Training failed for person ${person.name}:`, error);
        
        await PersonRepository.updatePerson(personId, {
            recognition_status: 'failed'
        });
        
        throw new AppError('Training failed', 500);
    }
});

// Auto-recognize faces in new images using trained models
export const autoRecognizeFaces = asyncHandler(async (req: Request, res: Response) => {
    const { imageId } = req.body;
    
    if (!imageId) {
        throw new AppError('Image ID is required', 400);
    }
    
    req.logger.info(`Starting auto-recognition for image: ${imageId}`);
    
    try {
        // Get image details
        const image = await db('images').where('id', imageId).first();
        if (!image) {
            throw new AppError('Image not found', 404);
        }
        
        // Get unassigned faces for this image
        const unassignedFaces = await db('detected_faces')
            .where('image_id', imageId)
            .whereNull('person_id')
            .where('detection_confidence', '>=', 0.8); // Only high-confidence faces
            
        if (unassignedFaces.length === 0) {
            req.logger.info(`No unassigned faces found for image ${imageId}`);
            return res.json({
                success: true,
                message: 'No unassigned faces to recognize',
                assignedFaces: 0
            });
        }
        
        req.logger.info(`Found ${unassignedFaces.length} unassigned faces for recognition`);
        
        // Use CompreFace recognition on the full image
        let imagePath = image.original_path;
        if (image.relative_media_path) {
            // Use processed image path if available
            imagePath = `${configManager.getStorage().processedDir}/media/${image.relative_media_path}`;
        }
        
        const recognitionResult = await recognizeFacesFromImage(imagePath);
        
        let assignedCount = 0;
        
        if (recognitionResult && recognitionResult.result) {
            for (const [index, result] of recognitionResult.result.entries()) {
                if (result.subjects && result.subjects.length > 0) {
                    const bestMatch = result.subjects[0];
                    const confidence = bestMatch.similarity;
                    
                    if (confidence >= 0.7) { // 70% confidence threshold
                        // Find the corresponding face in our database by matching coordinates
                        const box = result.box;
                        const matchingFace = unassignedFaces.find(face => {
                            const tolerance = 50; // pixel tolerance
                            return Math.abs(face.x_min - box.x_min) < tolerance &&
                                   Math.abs(face.y_min - box.y_min) < tolerance &&
                                   Math.abs(face.x_max - box.x_max) < tolerance &&
                                   Math.abs(face.y_max - box.y_max) < tolerance;
                        });
                        
                        if (matchingFace) {
                            // Find the person by CompreFace subject ID
                            const person = await db('persons')
                                .where('compreface_subject_id', bestMatch.subject)
                                .first();
                                
                            if (person) {
                                // Assign face to person
                                await FaceRepository.assignFaceToPerson(
                                    matchingFace.id, 
                                    person.id, 
                                    confidence, 
                                    'auto_recognition'
                                );
                                
                                // Mark face as synced since it came from CompreFace
                                await db('detected_faces')
                                    .where('id', matchingFace.id)
                                    .update({ 
                                        compreface_synced: true,
                                        assigned_at: new Date(),
                                        assigned_by: 'auto_recognition'
                                    });
                                
                                assignedCount++;
                                req.logger.info(`Auto-assigned face ${matchingFace.id} to ${person.name} (${(confidence * 100).toFixed(1)}% confidence)`);
                            }
                        }
                    }
                }
            }
        }
        
        // Update face counts for affected persons
        if (assignedCount > 0) {
            const affectedPersonIds = await db('detected_faces')
                .distinct('person_id')
                .where('image_id', imageId)
                .whereNotNull('person_id')
                .pluck('person_id');
                
            for (const personId of affectedPersonIds) {
                await PersonRepository.updateFaceCount(personId);
            }
        }
        
        req.logger.info(`Auto-recognition completed: ${assignedCount} faces assigned`);
        
        res.json({
            success: true,
            message: `Auto-recognition completed: ${assignedCount} faces assigned`,
            assignedFaces: assignedCount,
            totalFaces: unassignedFaces.length
        });
        
    } catch (error) {
        req.logger.error(`Auto-recognition failed for image ${imageId}:`, error);
        throw new AppError('Auto-recognition failed', 500);
    }
});

// Get all face crops for a specific person
export const getPersonFaces = asyncHandler(async (req: Request, res: Response) => {
    const personId = validatePersonId(req.params.id);
    
    req.logger.info(`Getting face crops for person ${personId}`);
    
    try {
        // Get all faces assigned to this person with additional metadata
        const faces = await db('detected_faces')
            .join('images', 'detected_faces.image_id', 'images.id')
            .where('detected_faces.person_id', personId)
            .select(
                'detected_faces.id',
                'detected_faces.face_image_path',
                'detected_faces.relative_face_path',
                'detected_faces.x_min',
                'detected_faces.y_min',
                'detected_faces.x_max',
                'detected_faces.y_max',
                'detected_faces.detection_confidence',
                'detected_faces.person_confidence as recognition_confidence',
                'detected_faces.assigned_by',
                'detected_faces.assigned_at',
                'images.id as image_id',
                'images.filename as image_filename',
                'images.relative_media_path',
                'images.date_taken'
            )
            .orderBy('detected_faces.assigned_at', 'desc'); // Most recently assigned first
        
        // Enrich faces with proper URLs and image data
        const enrichedFaces = faces.map(face => ({
            id: face.id,
            relative_face_path: face.relative_face_path || face.face_image_path,
            x_min: face.x_min,
            y_min: face.y_min,
            x_max: face.x_max,
            y_max: face.y_max,
            detection_confidence: face.detection_confidence,
            recognition_confidence: face.recognition_confidence,
            assigned_by: face.assigned_by,
            assigned_at: face.assigned_at,
            image: {
                id: face.image_id,
                filename: face.image_filename,
                relative_media_path: face.relative_media_path,
                media_url: getMediaUrl({ relative_media_path: face.relative_media_path }),
                date_taken: face.date_taken
            }
        }));
        
        req.logger.info(`Found ${enrichedFaces.length} face crops for person ${personId}`);
        
        res.json({
            faces: enrichedFaces,
            count: enrichedFaces.length
        });
        
    } catch (error) {
        req.logger.error(`Error getting face crops for person ${personId}:`, error);
        throw new AppError('Failed to get person faces', 500);
    }
});

// Complete face deletion - removes face record and physical file
export const deleteFace = asyncHandler(async (req: Request, res: Response) => {
    const faceId = validateFaceId(req.params.faceId);
    
    req.logger.info(`Starting complete deletion for face ${faceId}`);
    
    try {
        // Get the face record first
        const face = await FaceRepository.getFaceById(faceId);
        if (!face) {
            throw new AppError('Face not found', 404);
        }
        
        const personId = face.person_id;
        let person = null;
        
        if (personId && personId > 0) {
            person = await PersonRepository.getPersonWithFaceCount(personId);
        }
        
        req.logger.info(`Deleting face ${faceId} from person ${person?.name || 'unassigned'}`);
        
        // Remove from CompreFace if it was assigned to someone
        if (face.face_image_path && person?.compreface_subject_id) {
            try {
                const deletionResult = await deleteFaceFromSubject(face.face_image_path);
                req.logger.info(`CompreFace face deletion result:`, deletionResult);
            } catch (comprefaceError) {
                req.logger.warn('CompreFace removal failed (continuing with database deletion):', comprefaceError);
            }
        }
        
        // Delete physical face crop file if it exists
        const faceImagePath = face.relative_face_path || face.face_image_path;
        if (faceImagePath) {
            let fullFacePath: string;
            
            if (face.relative_face_path) {
                // Hash-based path
                fullFacePath = path.join(configManager.getStorage().processedDir, 'media', face.relative_face_path);
            } else {
                // Legacy path
                fullFacePath = path.join(configManager.getStorage().processedDir, faceImagePath);
            }
            
            try {
                if (fs.existsSync(fullFacePath)) {
                    fs.unlinkSync(fullFacePath);
                    req.logger.info(`Deleted face crop file: ${fullFacePath}`);
                } else {
                    req.logger.warn(`Face crop file not found (may have been already deleted): ${fullFacePath}`);
                }
            } catch (fileError) {
                req.logger.warn(`Failed to delete face crop file: ${fullFacePath}`, fileError);
                // Continue with database deletion even if file deletion fails
            }
        }
        
        // Remove from face clustering if applicable
        try {
            await db('face_cluster_members').where('face_id', faceId).del();
            req.logger.debug(`Removed face ${faceId} from clustering data`);
        } catch (clusterError) {
            req.logger.warn(`Failed to remove face from clustering data:`, clusterError);
        }
        
        // Delete the face record from database
        const deletedRows = await db('detected_faces').where('id', faceId).del();
        
        if (deletedRows === 0) {
            throw new AppError('Face record not found in database', 404);
        }
        
        req.logger.info(`Successfully deleted face record ${faceId} from database`);
        
        // Update person face count if person was assigned
        if (personId && personId > 0) {
            await PersonRepository.updateFaceCount(personId);
            req.logger.info(`Updated face count for person ${personId}`);
            
            // If person now has no faces, mark as untrained
            const updatedPerson = await PersonRepository.getPersonWithFaceCount(personId);
            if (updatedPerson && updatedPerson.face_count === 0) {
                await PersonRepository.updatePerson(personId, {
                    recognition_status: 'untrained'
                });
                req.logger.info(`Marked person ${personId} as untrained (no remaining faces)`);
            }
        }
        
        res.json({ 
            success: true,
            message: 'Face deleted successfully',
            deletedFaceId: faceId
        });
        
    } catch (error) {
        req.logger.error(`Failed to delete face ${faceId}:`, error);
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError('Failed to delete face', 500);
    }
});

// Preview cleanup of auto-assigned faces from CompreFace
export const previewAutoFaceCleanup = asyncHandler(async (req: Request, res: Response) => {
    req.logger.info('Previewing auto-face cleanup from CompreFace');
    
    const preview = await AutoFaceCleanup.previewCleanup();
    
    res.json({
        success: true,
        message: 'Auto-face cleanup preview completed',
        preview
    });
});

// Clean up auto-assigned faces from CompreFace
export const cleanupAutoFacesFromCompreFace = asyncHandler(async (req: Request, res: Response) => {
    req.logger.info('Starting cleanup of auto-assigned faces from CompreFace');
    
    const { dryRun = false } = req.body;
    
    if (dryRun) {
        const preview = await AutoFaceCleanup.previewCleanup();
        return res.json({
            success: true,
            message: 'Dry run completed - no changes made',
            preview
        });
    }
    
    const result = await AutoFaceCleanup.cleanupAutoFacesFromCompreFace();
    
    res.json({
        success: true,
        message: 'Auto-face cleanup completed',
        result
    });
});

