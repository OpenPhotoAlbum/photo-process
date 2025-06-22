import { db } from '../models/database';
import { createComprefaceSubject, addFaceToSubject } from './compreface';
import { configManager } from './config-manager';
import { StructuredLogger } from './structured-logger';

const logger = new StructuredLogger().get('system');

export interface SelectiveTrainingOptions {
    onlyManuallyAssigned: boolean;
    maxFacesPerPerson?: number;
    allowDuplicateUploads?: boolean;
}

export interface TrainingResult {
    personId: number;
    personName: string;
    facesUploaded: number;
    facesSkipped: number;
    comprefaceSubjectId?: string;
    errors: string[];
    success: boolean;
}

export interface FaceTrainingLog {
    faceId: number;
    personId: number;
    uploadSuccess: boolean;
    errorMessage?: string;
    comprefaceResponse?: string;
}

/**
 * Selective Face Training Service
 * 
 * This service implements a controlled approach to CompreFace training:
 * - Only uploads manually verified faces (assigned_by = 'user')
 * - Tracks every upload attempt in face_training_log
 * - Prevents duplicate uploads using compreface_synced flag
 * - Provides detailed logging and error handling
 */
export class SelectiveTrainingService {
    
    /**
     * Train a specific person with only manually assigned faces
     */
    static async trainPersonSelective(
        personId: number, 
        options: SelectiveTrainingOptions = { onlyManuallyAssigned: true }
    ): Promise<TrainingResult> {
        const result: TrainingResult = {
            personId,
            personName: '',
            facesUploaded: 0,
            facesSkipped: 0,
            errors: [],
            success: false
        };

        try {
            // Get person details
            const person = await db('persons').where('id', personId).first();
            if (!person) {
                result.errors.push('Person not found');
                return result;
            }
            
            result.personName = person.name;
            logger.info(`Starting selective training for person: ${person.name} (ID: ${personId})`);

            // Create CompreFace subject if needed
            if (!person.compreface_subject_id) {
                try {
                    const subjectId = await createComprefaceSubject(person.name);
                    await db('persons').where('id', personId).update({ 
                        compreface_subject_id: subjectId,
                        recognition_status: 'training'
                    });
                    result.comprefaceSubjectId = subjectId;
                    logger.info(`Created CompreFace subject: ${subjectId} for ${person.name}`);
                } catch (error) {
                    const errorMsg = `Failed to create CompreFace subject: ${error}`;
                    result.errors.push(errorMsg);
                    logger.error(errorMsg);
                    return result;
                }
            } else {
                result.comprefaceSubjectId = person.compreface_subject_id;
            }

            // Get faces eligible for training
            let facesQuery = db('detected_faces')
                .where('person_id', personId)
                .whereNotNull('face_image_path');

            if (options.onlyManuallyAssigned) {
                facesQuery = facesQuery.where('assigned_by', 'user');
            }

            if (!options.allowDuplicateUploads) {
                facesQuery = facesQuery.where('compreface_synced', false);
            }

            const eligibleFaces = await facesQuery.select('*');
            
            if (eligibleFaces.length === 0) {
                result.errors.push('No eligible faces found for training');
                logger.warn(`No eligible faces found for ${person.name}`);
                return result;
            }

            logger.info(`Found ${eligibleFaces.length} eligible faces for ${person.name}`);

            // Limit faces if specified
            const facesToUpload = options.maxFacesPerPerson 
                ? eligibleFaces.slice(0, options.maxFacesPerPerson)
                : eligibleFaces;

            // Upload each face individually with detailed logging
            for (const face of facesToUpload) {
                const uploadResult = await this.uploadSingleFace(
                    face, 
                    result.comprefaceSubjectId!, 
                    personId
                );

                if (uploadResult.success) {
                    result.facesUploaded++;
                } else {
                    result.facesSkipped++;
                    result.errors.push(uploadResult.errorMessage || 'Unknown upload error');
                }
            }

            // Update person training status
            await db('persons').where('id', personId).update({
                recognition_status: result.facesUploaded > 0 ? 'trained' : 'failed',
                last_trained_at: new Date(),
                training_face_count: result.facesUploaded
            });

            result.success = result.facesUploaded > 0;
            
            logger.info(`Selective training completed for ${person.name}: ${result.facesUploaded} uploaded, ${result.facesSkipped} skipped`);
            
            return result;

        } catch (error) {
            const errorMsg = `Selective training failed for person ${personId}: ${error}`;
            result.errors.push(errorMsg);
            logger.error(errorMsg);
            return result;
        }
    }

    /**
     * Upload a single face to CompreFace with detailed logging
     */
    private static async uploadSingleFace(
        face: any, 
        comprefaceSubjectId: string, 
        personId: number
    ): Promise<{ success: boolean; errorMessage?: string; comprefaceResponse?: string }> {
        
        const logEntry: FaceTrainingLog = {
            faceId: face.id,
            personId,
            uploadSuccess: false
        };

        try {
            // Construct face image path
            let fullFacePath = face.face_image_path;
            
            if (face.relative_face_path) {
                fullFacePath = `${configManager.getStorage().processedDir}/faces/${face.relative_face_path}`;
            } else if (!fullFacePath.startsWith('/')) {
                fullFacePath = `${configManager.getStorage().processedDir}/${fullFacePath}`;
            }

            logger.info(`Uploading face ${face.id} to CompreFace subject ${comprefaceSubjectId}`);

            // Upload to CompreFace
            const comprefaceResponse = await addFaceToSubject(comprefaceSubjectId, fullFacePath);
            
            // Mark as successfully uploaded
            await db('detected_faces').where('id', face.id).update({
                compreface_synced: true,
                compreface_uploaded_at: new Date()
            });

            logEntry.uploadSuccess = true;
            logEntry.comprefaceResponse = JSON.stringify(comprefaceResponse);

            // Log successful upload
            await this.logTrainingAttempt(logEntry);

            logger.info(`Successfully uploaded face ${face.id} to CompreFace`);
            
            return { 
                success: true, 
                comprefaceResponse: JSON.stringify(comprefaceResponse) 
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            logEntry.uploadSuccess = false;
            logEntry.errorMessage = errorMessage;

            // Log failed upload
            await this.logTrainingAttempt(logEntry);

            logger.error(`Failed to upload face ${face.id}: ${errorMessage}`);
            
            return { 
                success: false, 
                errorMessage 
            };
        }
    }

    /**
     * Log training attempt to face_training_log table
     */
    private static async logTrainingAttempt(logEntry: FaceTrainingLog): Promise<void> {
        try {
            await db('face_training_log').insert({
                face_id: logEntry.faceId,
                person_id: logEntry.personId,
                upload_success: logEntry.uploadSuccess,
                compreface_response: logEntry.comprefaceResponse,
                error_message: logEntry.errorMessage,
                upload_attempt_at: new Date()
            });
        } catch (error) {
            logger.error(`Failed to log training attempt: ${error}`);
        }
    }

    /**
     * Get training statistics for a person
     */
    static async getPersonTrainingStats(personId: number): Promise<{
        totalFaces: number;
        manuallyAssigned: number;
        uploaded: number;
        pending: number;
        failed: number;
    }> {
        const [totalFaces, manuallyAssigned, uploaded, pending] = await Promise.all([
            db('detected_faces').where('person_id', personId).count('* as count').first(),
            db('detected_faces').where('person_id', personId).where('assigned_by', 'user').count('* as count').first(),
            db('detected_faces').where('person_id', personId).where('compreface_synced', true).count('* as count').first(),
            db('detected_faces').where('person_id', personId).where('compreface_synced', false).where('assigned_by', 'user').count('* as count').first()
        ]);

        const failedLogs = await db('face_training_log')
            .where('person_id', personId)
            .where('upload_success', false)
            .count('* as count')
            .first();

        return {
            totalFaces: Number(totalFaces?.count) || 0,
            manuallyAssigned: Number(manuallyAssigned?.count) || 0,
            uploaded: Number(uploaded?.count) || 0,
            pending: Number(pending?.count) || 0,
            failed: Number(failedLogs?.count) || 0
        };
    }

    /**
     * Reset person's CompreFace training state
     */
    static async resetPersonTraining(personId: number): Promise<void> {
        const person = await db('persons').where('id', personId).first();
        if (!person) {
            throw new Error('Person not found');
        }

        logger.info(`Resetting training state for person: ${person.name}`);

        // Delete CompreFace subject if exists
        if (person.compreface_subject_id) {
            try {
                // TODO: Implement deleteSubject function in compreface.ts
                logger.warn(`CompreFace subject ${person.compreface_subject_id} still exists - manual cleanup needed`);
            } catch (error) {
                logger.warn(`Failed to delete CompreFace subject ${person.compreface_subject_id}: ${error}`);
            }
        }

        // Reset database state
        await db('detected_faces')
            .where('person_id', personId)
            .update({
                compreface_synced: false,
                compreface_uploaded_at: null
            });

        await db('persons').where('id', personId).update({
            compreface_subject_id: null,
            recognition_status: 'untrained',
            training_face_count: 0,
            last_trained_at: null
        });

        logger.info(`Training state reset for person: ${person.name}`);
    }
}

export default SelectiveTrainingService;