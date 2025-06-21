import { Logger } from '../logger';
import { PersonRepository, db } from '../models/database';
import { configManager } from './config-manager';
import { deleteFaceFromSubject } from './compreface';
import * as path from 'path';

const logger = Logger.getInstance();

interface AutoFaceCleanupResult {
    totalAutoFaces: number;
    autoFacesSyncedToCompreface: number;
    personsAffected: number;
    facesRemovedFromCompreface: number;
    facesFailedToRemove: number;
    errors: Array<{ faceId: number; personName: string; error: string }>;
}

/**
 * Clean up auto-assigned faces from CompreFace
 * 
 * This script:
 * 1. Finds all auto-assigned faces that have been synced to CompreFace
 * 2. Removes them from CompreFace (but keeps them in our database)
 * 3. Marks them as not synced so they won't be used for training
 * 
 * Manual assignments are left untouched in CompreFace.
 */
export class AutoFaceCleanup {
    
    static async cleanupAutoFacesFromCompreFace(): Promise<AutoFaceCleanupResult> {
        logger.info('Starting cleanup of auto-assigned faces from CompreFace...');
        
        const result: AutoFaceCleanupResult = {
            totalAutoFaces: 0,
            autoFacesSyncedToCompreface: 0,
            personsAffected: 0,
            facesRemovedFromCompreface: 0,
            facesFailedToRemove: 0,
            errors: []
        };
        
        try {
            // Step 1: Get manual face counts for each person
            const manualFaceCounts = await db('detected_faces')
                .join('persons', 'detected_faces.person_id', 'persons.id')
                .where('detected_faces.assigned_by', 'user')
                .orWhere('detected_faces.assigned_by', 'manual')
                .whereNotNull('detected_faces.person_id')
                .groupBy('persons.id', 'persons.name')
                .select(
                    'persons.id as person_id',
                    'persons.name as person_name',
                    db.raw('COUNT(*) as manual_face_count')
                );
            
            const manualCountMap = new Map<number, number>();
            for (const row of manualFaceCounts) {
                manualCountMap.set(row.person_id, parseInt(row.manual_face_count));
            }
            
            logger.info(`Found manual face counts for ${manualCountMap.size} persons`);
            
            // Step 2: Find all auto-assigned faces
            const autoAssignedFaces = await db('detected_faces')
                .join('persons', 'detected_faces.person_id', 'persons.id')
                .where(function() {
                    this.where('detected_faces.assigned_by', 'auto_recognition')
                        .orWhere('detected_faces.assigned_by', 'auto_compreface') 
                        .orWhere('detected_faces.recognition_method', 'auto_compreface');
                })
                .whereNotNull('detected_faces.person_id')
                .select(
                    'detected_faces.id as face_id',
                    'detected_faces.face_image_path',
                    'detected_faces.relative_face_path', 
                    'detected_faces.compreface_synced',
                    'detected_faces.detection_confidence',
                    'detected_faces.assigned_by',
                    'detected_faces.recognition_method',
                    'persons.id as person_id',
                    'persons.name as person_name',
                    'persons.compreface_subject_id'
                );
            
            result.totalAutoFaces = autoAssignedFaces.length;
            logger.info(`Found ${result.totalAutoFaces} auto-assigned faces total`);
            
            // Step 3: Filter to only those synced to CompreFace and apply cleanup rules
            const facesToCleanup = autoAssignedFaces.filter(face => {
                if (!face.compreface_synced) return false;
                
                const manualFaceCount = manualCountMap.get(face.person_id) || 0;
                const detectionConfidence = parseFloat(face.detection_confidence);
                
                // If person has 50+ manual faces, only remove auto faces with confidence < 0.9
                if (manualFaceCount >= 50) {
                    return detectionConfidence < 0.9;
                }
                
                // Otherwise, remove all auto-assigned faces regardless of confidence
                return true;
            });
            
            result.autoFacesSyncedToCompreface = autoAssignedFaces.filter(face => face.compreface_synced).length;
            logger.info(`Found ${result.autoFacesSyncedToCompreface} auto-assigned faces synced to CompreFace`);
            logger.info(`${facesToCleanup.length} faces will be cleaned up after applying rules`);
            
            if (facesToCleanup.length === 0) {
                logger.info('No auto-assigned faces need cleanup. Process complete.');
                return result;
            }
            
            // Step 4: Group by person to process efficiently
            const facesByPerson = new Map<string, Array<typeof facesToCleanup[0]>>();
            
            for (const face of facesToCleanup) {
                if (!face.compreface_subject_id) {
                    logger.warn(`Face ${face.face_id} belongs to person ${face.person_name} who has no CompreFace subject ID`);
                    continue;
                }
                
                if (!facesByPerson.has(face.compreface_subject_id)) {
                    facesByPerson.set(face.compreface_subject_id, []);
                }
                facesByPerson.get(face.compreface_subject_id)!.push(face);
            }
            
            result.personsAffected = facesByPerson.size;
            logger.info(`Processing ${result.personsAffected} persons with auto-assigned faces to cleanup`);
            
            // Step 5: Remove faces from CompreFace for each person
            for (const [subjectId, personFaces] of facesByPerson) {
                const personName = personFaces[0].person_name;
                logger.info(`Processing ${personFaces.length} auto-assigned faces for ${personName}`);
                
                for (const face of personFaces) {
                    try {
                        // Get the face image path for CompreFace deletion
                        let faceImagePath = face.relative_face_path || face.face_image_path;
                        
                        if (!faceImagePath) {
                            logger.warn(`Face ${face.face_id} has no image path, skipping`);
                            continue;
                        }
                        
                        // Ensure we have the full path
                        if (!faceImagePath.startsWith('/')) {
                            faceImagePath = `${configManager.getStorage().processedDir}/faces/${faceImagePath}`;
                        }
                        
                        logger.info(`Removing auto-assigned face ${face.face_id} (confidence: ${face.detection_confidence}) from CompreFace for ${personName}`);
                        
                        // Remove from CompreFace
                        const deleteResult = await deleteFaceFromSubject(faceImagePath);
                        
                        if (deleteResult.success || deleteResult.note === 'No matching faces found in CompreFace') {
                            // Mark as not synced in our database
                            await db('detected_faces')
                                .where('id', face.face_id)
                                .update({ 
                                    compreface_synced: false,
                                    updated_at: new Date()
                                });
                            
                            result.facesRemovedFromCompreface++;
                            logger.info(`Successfully removed face ${face.face_id} from CompreFace and marked as not synced`);
                        } else {
                            throw new Error(deleteResult.error || 'Unknown deletion error');
                        }
                        
                        // Small delay to avoid overwhelming CompreFace
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        logger.error(`Failed to remove face ${face.face_id} for ${personName}: ${errorMsg}`);
                        
                        result.facesFailedToRemove++;
                        result.errors.push({
                            faceId: face.face_id,
                            personName: personName,
                            error: errorMsg
                        });
                    }
                }
                
                logger.info(`Completed processing ${personName}: ${personFaces.length} faces processed`);
            }
            
            logger.info('Auto-face cleanup completed', {
                totalAutoFaces: result.totalAutoFaces,
                autoFacesSyncedToCompreface: result.autoFacesSyncedToCompreface,
                personsAffected: result.personsAffected,
                facesRemovedFromCompreface: result.facesRemovedFromCompreface,
                facesFailedToRemove: result.facesFailedToRemove,
                errorCount: result.errors.length
            });
            
        } catch (error) {
            logger.error('Error during auto-face cleanup:', error);
            throw error;
        }
        
        return result;
    }
    
    /**
     * Preview what faces would be cleaned up without actually removing them
     */
    static async previewCleanup(): Promise<{
        autoFacesToRemove: Array<{
            faceId: number;
            personName: string;
            detectionConfidence: number;
            assignedBy: string;
            facePath: string;
            manualFaceCount: number;
            shouldRemove: boolean;
            reason: string;
        }>;
        summary: {
            totalCount: number;
            willRemoveCount: number;
            willKeepCount: number;
            personsAffected: string[];
            personsWithManyManualFaces: string[];
            averageConfidence: number;
        };
    }> {
        logger.info('Previewing auto-face cleanup...');
        
        // Get manual face counts for each person
        const manualFaceCounts = await db('detected_faces')
            .join('persons', 'detected_faces.person_id', 'persons.id')
            .where('detected_faces.assigned_by', 'user')
            .orWhere('detected_faces.assigned_by', 'manual')
            .whereNotNull('detected_faces.person_id')
            .groupBy('persons.id', 'persons.name')
            .select(
                'persons.id as person_id',
                'persons.name as person_name',
                db.raw('COUNT(*) as manual_face_count')
            );
        
        const manualCountMap = new Map<number, number>();
        for (const row of manualFaceCounts) {
            manualCountMap.set(row.person_id, parseInt(row.manual_face_count));
        }
        
        const autoAssignedFaces = await db('detected_faces')
            .join('persons', 'detected_faces.person_id', 'persons.id')
            .where(function() {
                this.where('detected_faces.assigned_by', 'auto_recognition')
                    .orWhere('detected_faces.assigned_by', 'auto_compreface') 
                    .orWhere('detected_faces.recognition_method', 'auto_compreface');
            })
            .where('detected_faces.compreface_synced', true)
            .whereNotNull('detected_faces.person_id')
            .select(
                'detected_faces.id as face_id',
                'detected_faces.face_image_path',
                'detected_faces.relative_face_path', 
                'detected_faces.detection_confidence',
                'detected_faces.assigned_by',
                'persons.id as person_id',
                'persons.name as person_name'
            );
        
        const preview = autoAssignedFaces.map(face => {
            const manualFaceCount = manualCountMap.get(face.person_id) || 0;
            const detectionConfidence = parseFloat(face.detection_confidence);
            
            let shouldRemove = false;
            let reason = '';
            
            if (manualFaceCount >= 50) {
                shouldRemove = detectionConfidence < 0.9;
                reason = shouldRemove 
                    ? `Low confidence (${detectionConfidence.toFixed(3)}) - person has ${manualFaceCount} manual faces`
                    : `Keeping high confidence (${detectionConfidence.toFixed(3)}) - person has ${manualFaceCount} manual faces`;
            } else {
                shouldRemove = true;
                reason = `Removing all auto faces - person has only ${manualFaceCount} manual faces`;
            }
            
            return {
                faceId: face.face_id,
                personName: face.person_name,
                detectionConfidence: detectionConfidence,
                assignedBy: face.assigned_by,
                facePath: face.relative_face_path || face.face_image_path,
                manualFaceCount,
                shouldRemove,
                reason
            };
        });
        
        const personsAffected = [...new Set(preview.map(f => f.personName))];
        const personsWithManyManualFaces = [...new Set(
            preview
                .filter(f => f.manualFaceCount >= 50)
                .map(f => f.personName)
        )];
        const willRemoveCount = preview.filter(f => f.shouldRemove).length;
        const willKeepCount = preview.filter(f => !f.shouldRemove).length;
        const averageConfidence = preview.reduce((sum, f) => sum + f.detectionConfidence, 0) / preview.length;
        
        const summary = {
            totalCount: preview.length,
            willRemoveCount,
            willKeepCount,
            personsAffected,
            personsWithManyManualFaces,
            averageConfidence: Math.round(averageConfidence * 1000) / 1000
        };
        
        logger.info('Preview completed', summary);
        
        return {
            autoFacesToRemove: preview,
            summary
        };
    }
}