import { Logger } from '../logger';
import { PersonRepository, FaceRepository } from '../models/database';
import { addFaceToSubject, getComprefaceSubjects } from './compreface';
import { config } from '../../config';
import fetch from 'node-fetch';
import fs from 'fs';

const logger = Logger.getInstance();

export class ConsistencyManager {
    
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
            
            const facesResponse = await fetch('http://localhost:8000/api/v1/recognition/faces', {
                headers: { 'x-api-key': 'b6dd9990-6905-40b8-80d3-4655196ab139' }
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
                    const facesResponse = await fetch(`http://localhost:8000/api/v1/recognition/faces?subject=${encodeURIComponent(person.compreface_subject_id)}`, {
                        headers: { 'x-api-key': 'b6dd9990-6905-40b8-80d3-4655196ab139' }
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