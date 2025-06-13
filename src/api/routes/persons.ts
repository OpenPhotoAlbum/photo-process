import { Request, Response } from 'express';
import { PersonRepository, FaceRepository, ImageRepository, db } from '../models/database';
import { createComprefaceSubject, addFaceToSubject, recognizeFacesFromImage, deleteFaceFromSubject, recognizeFacesFromImagesBatch, addFacesToSubjectBatch } from '../util/compreface';
import { ConsistencyManager } from '../util/consistency-manager';
import { AppError, asyncHandler, validatePersonId, validateFaceId, validateImageId, validateRequired, validateArray } from '../middleware/error-handler';
import fetch from 'node-fetch';

// Get all persons with face thumbnails
export const getAllPersons = async (req: Request, res: Response) => {
    try {
        console.log('TEST: getAllPersons called - console.log is working');
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
        console.error('Error getting persons:', error);
        res.status(500).json({ error: 'Failed to get persons' });
    }
};

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
        console.warn('CompreFace subject creation failed, continuing without:', comprefaceError?.message || comprefaceError);
        // Continue without CompreFace integration
    }
    
    const personData = {
        name: name.trim(),
        notes: notes || '',
        compreface_subject_id: comprefaceSubjectId,
        face_count: 0,
        auto_recognize: true
    };

    const personId = await PersonRepository.createPerson(personData);
    const person = await PersonRepository.getPersonWithFaceCount(personId);

    res.status(201).json({ person });
});

// Update person
export const updatePerson = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, notes, auto_recognize } = req.body;
    
    const personId = validatePersonId(id);
    
    const existingPerson = await PersonRepository.getPersonWithFaceCount(personId);
    if (!existingPerson) {
        throw new AppError('Person not found', 404);
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (notes !== undefined) updateData.notes = notes;
    if (auto_recognize !== undefined) updateData.auto_recognize = auto_recognize;

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
    
    // Update person face count
    await PersonRepository.updateFaceCount(personId);

    // Add face to CompreFace for training (async, non-blocking)
    if (person.compreface_subject_id && face.face_image_path) {
        // Don't await this - run in background
        const fullFacePath = `/mnt/hdd/photo-process/processed/${face.face_image_path}`;
        console.log(`Adding face to CompreFace: ${person.compreface_subject_id}, path: ${fullFacePath}`);
        addFaceToSubject(person.compreface_subject_id, fullFacePath)
            .then(() => {
                console.log('Successfully added face to CompreFace');
            })
            .catch((comprefaceError) => {
                console.warn('CompreFace integration failed:', comprefaceError);
            });
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
        
        // Remove from CompreFace if applicable
        if (face.face_image_path) {
            try {
                await deleteFaceFromSubject(face.face_image_path);
            } catch (comprefaceError) {
                console.warn('CompreFace removal failed:', comprefaceError);
            }
        }

        // Remove association from database
        await FaceRepository.clearPersonFromFace(parseInt(faceId));
        
        // Update person face count if person was assigned
        if (personId) {
            await PersonRepository.updateFaceCount(personId);
        }

        res.json({ message: 'Face removed from person successfully' });
    } catch (error) {
        console.error('Error removing face from person:', error);
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
            
            // Collect face path for batch upload to CompreFace
            if (person.compreface_subject_id && face.face_image_path) {
                const fullFacePath = `/mnt/hdd/photo-process/processed/${face.face_image_path}`;
                facePaths.push(fullFacePath);
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
                const comprefaceFaces = await fetch(`http://localhost:8000/api/v1/recognition/faces`, {
                    method: 'GET',
                    headers: {
                        'x-api-key': 'b6dd9990-6905-40b8-80d3-4655196ab139'
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
        
        // Enrich with image information
        const enrichedFaces = await Promise.all(
            faces.map(async (face) => {
                const image = await ImageRepository.findById(face.image_id);
                return {
                    ...face,
                    image: image ? {
                        id: image.id,
                        filename: image.filename,
                        date_taken: image.date_taken,
                        original_path: image.original_path
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
    
    const HIGH_CONFIDENCE_THRESHOLD = 0.99;  // Auto-assign if ≥99%
    const MIN_CONFIRMATION_THRESHOLD = 0.75; // Show for confirmation if ≥75%
    
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
                            
                            // Collect faces for batch upload to CompreFace
                            if (person.compreface_subject_id && face.face_image_path) {
                                const fullFacePath = `/mnt/hdd/photo-process/processed/${face.face_image_path}`;
                                
                                if (!faceAssignmentsByPerson.has(person.compreface_subject_id)) {
                                    faceAssignmentsByPerson.set(person.compreface_subject_id, {
                                        person,
                                        facePaths: []
                                    });
                                }
                                
                                faceAssignmentsByPerson.get(person.compreface_subject_id)!.facePaths.push(fullFacePath);
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
                            
                            console.log(`Auto-recognized face ${face.id} as ${person.name} (confidence: ${bestMatch.similarity})`);
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
                
                if (person && bestMatch.similarity > 0.9) { // High confidence threshold
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

// Helper function to calculate bounding box similarity
function calculateBoxSimilarity(box1: any, box2: any): number {
    const intersection = Math.max(0, Math.min(box1.x_max, box2.x_max) - Math.max(box1.x_min, box2.x_min)) *
                        Math.max(0, Math.min(box1.y_max, box2.y_max) - Math.max(box1.y_min, box2.y_min));
    
    const area1 = (box1.x_max - box1.x_min) * (box1.y_max - box1.y_min);
    const area2 = (box2.x_max - box2.x_min) * (box2.y_max - box2.y_min);
    const union = area1 + area2 - intersection;
    
    return union > 0 ? intersection / union : 0;
}