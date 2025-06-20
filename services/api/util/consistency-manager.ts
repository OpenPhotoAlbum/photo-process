import { Logger } from '../logger';
import { PersonRepository, FaceRepository, db } from '../models/database';
import { addFaceToSubject, getComprefaceSubjects, createComprefaceSubject } from './compreface';
import { config } from '../config';
import { configManager } from './config-manager';
import fetch from 'node-fetch';
import fs from 'fs';

const logger = Logger.getInstance();

export class ConsistencyManager {
    
    /**
     * Synchronizes all persons from database to CompreFace subjects
     * Creates missing subjects and ensures all persons have CompreFace IDs
     */
    static async syncPersonsToCompreFace(): Promise<{
        created: number;
        updated: number;
        errors: Array<{ personId: number; name: string; error: string }>;
    }> {
        logger.info('Starting person-to-CompreFace synchronization...');
        
        const result = {
            created: 0,
            updated: 0,
            errors: [] as Array<{ personId: number; name: string; error: string }>
        };
        
        try {
            // Get all persons from database
            const allPersons = await PersonRepository.getAllPersons();
            logger.info(`Found ${allPersons.length} persons in database`);
            
            // Get existing CompreFace subjects
            const comprefaceData = await getComprefaceSubjects();
            const existingSubjects = new Set(comprefaceData.subjects || []);
            logger.info(`Found ${existingSubjects.size} existing CompreFace subjects`);
            
            for (const person of allPersons) {
                try {
                    let needsUpdate = false;
                    let comprefaceSubjectId = person.compreface_subject_id;
                    
                    // If person doesn't have a CompreFace subject ID, create one
                    if (!comprefaceSubjectId) {
                        logger.info(`Creating CompreFace subject for person: ${person.name}`);
                        comprefaceSubjectId = await createComprefaceSubject(person.name);
                        needsUpdate = true;
                        result.created++;
                    }
                    // If person has a subject ID but it doesn't exist in CompreFace, recreate it
                    else if (!existingSubjects.has(comprefaceSubjectId)) {
                        logger.warn(`CompreFace subject ${comprefaceSubjectId} for ${person.name} doesn't exist, recreating...`);
                        comprefaceSubjectId = await createComprefaceSubject(person.name);
                        needsUpdate = true;
                        result.created++;
                    }
                    
                    // Update database if needed
                    if (needsUpdate && person.id) {
                        await PersonRepository.updatePerson(person.id, {
                            compreface_subject_id: comprefaceSubjectId
                        });
                        result.updated++;
                        logger.info(`Updated person ${person.name} with CompreFace subject ID: ${comprefaceSubjectId}`);
                    }
                    
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error(`Failed to sync person ${person.name}: ${errorMessage}`);
                    result.errors.push({
                        personId: person.id!,
                        name: person.name,
                        error: errorMessage
                    });
                }
            }
            
            logger.info(`Person sync completed: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors`);
            
        } catch (error) {
            logger.error('Person sync failed:', error);
            throw error;
        }
        
        return result;
    }
    
    /**
     * Sync all existing face assignments to CompreFace
     * Uploads all assigned faces to their respective CompreFace subjects
     */
    static async syncExistingFacesToCompreFace(): Promise<{
        personsProcessed: number;
        facesUploaded: number;
        facesSkipped: number;
        errors: Array<{ personName: string; faceId: number; error: string }>;
    }> {
        logger.info('Starting sync of existing face assignments to CompreFace...');
        
        const result = {
            personsProcessed: 0,
            facesUploaded: 0,
            facesSkipped: 0,
            errors: [] as Array<{ personName: string; faceId: number; error: string }>
        };
        
        try {
            // Get all persons with assigned faces
            const personsWithFaces = await PersonRepository.getAllPersons();
            const personsToProcess = personsWithFaces.filter(p => p.face_count > 0);
            
            logger.info(`Found ${personsToProcess.length} persons with assigned faces`);
            
            for (const person of personsToProcess) {
                try {
                    result.personsProcessed++;
                    logger.info(`Processing person: ${person.name} (${person.face_count} faces)`);
                    
                    // Ensure person has CompreFace subject
                    let comprefaceSubjectId = person.compreface_subject_id;
                    if (!comprefaceSubjectId) {
                        logger.info(`Creating missing CompreFace subject for person: ${person.name}`);
                        comprefaceSubjectId = await createComprefaceSubject(person.name);
                        
                        if (person.id) {
                            await PersonRepository.updatePerson(person.id, {
                                compreface_subject_id: comprefaceSubjectId
                            });
                        }
                    }
                    
                    // Get all assigned faces for this person that haven't been synced yet
                    const assignedFaces = await db('detected_faces')
                        .where('person_id', person.id!)
                        .where('compreface_synced', false)
                        .whereNotNull('face_image_path');
                    
                    const allFaces = await FaceRepository.getFacesByPerson(person.id!);
                    logger.info(`Found ${assignedFaces.length} unsynced faces for ${person.name} (${allFaces.length} total)`);
                    
                    // Upload each face to CompreFace
                    for (const face of assignedFaces) {
                        try {
                            if (!face.face_image_path) {
                                logger.warn(`Face ${face.id} for ${person.name} has no image path, skipping`);
                                result.facesSkipped++;
                                continue;
                            }
                            
                            // Handle both absolute and relative paths
                            let fullFacePath = face.face_image_path;
                            if (!fullFacePath.startsWith('/')) {
                                // If relative path, prepend processed directory
                                fullFacePath = `${configManager.getStorage().processedDir}/${face.face_image_path}`;
                            }
                            
                            // Check if file exists
                            if (!fs.existsSync(fullFacePath)) {
                                logger.warn(`Face image not found: ${fullFacePath}, skipping`);
                                result.facesSkipped++;
                                continue;
                            }
                            
                            logger.info(`Uploading face ${face.id} to CompreFace subject ${comprefaceSubjectId}`);
                            await addFaceToSubject(comprefaceSubjectId, fullFacePath);
                            
                            // Mark face as synced in database
                            await db('detected_faces')
                                .where('id', face.id)
                                .update({ compreface_synced: true });
                            
                            result.facesUploaded++;
                            logger.info(`Successfully synced face ${face.id} to CompreFace`);
                            
                            // Small delay to avoid overwhelming CompreFace
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                        } catch (faceError) {
                            const errorMessage = faceError instanceof Error ? faceError.message : String(faceError);
                            logger.error(`Failed to upload face ${face.id} for ${person.name}: ${errorMessage}`);
                            result.errors.push({
                                personName: person.name,
                                faceId: face.id!,
                                error: errorMessage
                            });
                        }
                    }
                    
                    logger.info(`Completed processing ${person.name}: ${assignedFaces.length} faces processed`);
                    
                } catch (personError) {
                    const errorMessage = personError instanceof Error ? personError.message : String(personError);
                    logger.error(`Failed to process person ${person.name}: ${errorMessage}`);
                    result.errors.push({
                        personName: person.name,
                        faceId: -1,
                        error: errorMessage
                    });
                }
            }
            
            logger.info(`Face sync completed: ${result.personsProcessed} persons, ${result.facesUploaded} faces uploaded, ${result.facesSkipped} skipped, ${result.errors.length} errors`);
            
        } catch (error) {
            logger.error('Face sync failed:', error);
            throw error;
        }
        
        return result;
    }
    
    /**
     * Ensures database and CompreFace are in sync after any face operation
     */
    static async ensureConsistency(options: {
        checkFaces?: boolean;
        checkPersons?: boolean;
        autoRepair?: boolean;
    } = {}): Promise<{ 
        dbFaces: number; 
        comprefaceFaces: number; 
        inconsistencies: any[]; 
        repaired: number; 
    }> {
        const { checkFaces = true, checkPersons = true, autoRepair = false } = options;
        
        logger.info('Starting consistency check...');
        
        const inconsistencies: any[] = [];
        let repairedCount = 0;
        
        // Get database state
        const dbPersons = await PersonRepository.getAllPersons();
        const dbFaces = await FaceRepository.getAllFaces();
        
        // Get CompreFace state
        let comprefaceSubjects: string[] = [];
        let comprefaceFaces: any[] = [];
        
        try {
            const subjectsResponse = await getComprefaceSubjects();
            comprefaceSubjects = subjectsResponse.subjects || [];
            
            const comprefaceConfig = configManager.getCompreFace();
            const facesResponse = await fetch(`${comprefaceConfig.baseUrl}/api/v1/recognition/faces`, {
                headers: { 'x-api-key': comprefaceConfig.recognizeApiKey }
            });
            
            if (facesResponse.ok) {
                const facesData = await facesResponse.json();
                comprefaceFaces = facesData.faces || [];
            }
        } catch (error) {
            logger.error('Failed to get CompreFace data: ' + error);
        }
        
        logger.info(`Database: ${dbPersons.length} persons, ${dbFaces.length} faces`);
        logger.info(`CompreFace: ${comprefaceSubjects.length} subjects, ${comprefaceFaces.length} faces`);
        
        if (checkPersons) {
            // Check for persons without CompreFace subjects
            for (const person of dbPersons) {
                if (person.compreface_subject_id && !comprefaceSubjects.includes(person.compreface_subject_id)) {
                    inconsistencies.push({
                        type: 'missing_compreface_subject',
                        person: person.name,
                        personId: person.id,
                        comprefaceSubjectId: person.compreface_subject_id
                    });
                }
            }
        }
        
        if (checkFaces) {
            // Check for assigned faces not in CompreFace
            const assignedFaces = dbFaces.filter((f: any) => f.person_id);
            const orphanedFaces: any[] = [];
            
            for (const face of assignedFaces) {
                const person = dbPersons.find(p => p.id === face.person_id);
                if (person?.compreface_subject_id) {
                    const comprefaceFacesForSubject = comprefaceFaces.filter(cf => 
                        cf.subject === person.compreface_subject_id
                    );
                    
                    // If person has very few faces in CompreFace compared to database, it's likely inconsistent
                    const dbFacesForPerson = assignedFaces.filter((f: any) => f.person_id === person.id);
                    if (comprefaceFacesForSubject.length < dbFacesForPerson.length * 0.5) {
                        // Check if face file exists
                        const faceFilePath = `${config.getStorage().processedDir}/${face.face_image_path}`;
                        if (fs.existsSync(faceFilePath)) {
                            orphanedFaces.push({
                                faceId: face.id,
                                personName: person.name,
                                personId: person.id,
                                comprefaceSubjectId: person.compreface_subject_id,
                                facePath: faceFilePath
                            });
                        }
                    }
                }
            }
            
            if (orphanedFaces.length > 0) {
                inconsistencies.push({
                    type: 'orphaned_faces',
                    count: orphanedFaces.length,
                    faces: orphanedFaces
                });
                
                // Auto-repair: upload missing faces to CompreFace
                if (autoRepair) {
                    logger.info(`Auto-repairing ${orphanedFaces.length} orphaned faces...`);
                    for (const orphan of orphanedFaces) {
                        try {
                            await addFaceToSubject(orphan.comprefaceSubjectId, orphan.facePath);
                            repairedCount++;
                            logger.info(`Repaired face ${orphan.faceId} for ${orphan.personName}`);
                        } catch (error) {
                            logger.error(`Failed to repair face ${orphan.faceId}: ` + error);
                        }
                    }
                }
            }
        }
        
        const result = {
            dbFaces: dbFaces.length,
            comprefaceFaces: comprefaceFaces.length,
            inconsistencies,
            repaired: repairedCount
        };
        
        if (inconsistencies.length > 0) {
            logger.warn(`Found ${inconsistencies.length} consistency issues`);
        } else {
            logger.info('System is consistent');
        }
        
        return result;
    }
    
    /**
     * Quick consistency check after face operations
     */
    static async quickConsistencyCheck(personId?: number): Promise<void> {
        try {
            if (personId) {
                // Check specific person
                const person = await PersonRepository.getPersonWithFaceCount(personId);
                if (person?.compreface_subject_id) {
                    const comprefaceConfig = configManager.getCompreFace();
                    const facesResponse = await fetch(`${comprefaceConfig.baseUrl}/api/v1/recognition/faces?subject=${encodeURIComponent(person.compreface_subject_id)}`, {
                        headers: { 'x-api-key': comprefaceConfig.recognizeApiKey }
                    });
                    
                    if (facesResponse.ok) {
                        const facesData = await facesResponse.json();
                        const comprefaceFaceCount = facesData.faces?.length || 0;
                        
                        if (Math.abs(person.face_count - comprefaceFaceCount) > 2) {
                            logger.warn(`Consistency warning: ${person.name} has ${person.face_count} faces in DB but ${comprefaceFaceCount} in CompreFace`);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('Quick consistency check failed: ' + error);
        }
    }
}