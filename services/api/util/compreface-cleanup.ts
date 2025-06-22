import { configManager } from './config-manager';
import { Logger } from '../logger';
import fetch from 'node-fetch';
import { PersonRepository, FaceRepository, db } from '../models/database';

const logger = Logger.getInstance();

export interface ComprefaceCleanupResult {
    success: boolean;
    summary: {
        subjectsDeleted: number;
        facesDeleted: number;
        personsReset: number;
        databaseSyncReset: number;
    };
    errors: string[];
    warnings: string[];
}

export class ComprefaceCleanupService {
    private comprefaceConfig: any;

    constructor() {
        this.comprefaceConfig = configManager.getCompreFace();
    }

    /**
     * Comprehensive cleanup: Delete all subjects from CompreFace and reset database sync
     */
    async performComprehensiveCleanup(options: {
        dryRun?: boolean;
        resetDatabaseSync?: boolean;
        preservePersons?: boolean;
    } = {}): Promise<ComprefaceCleanupResult> {
        const { dryRun = false, resetDatabaseSync = true, preservePersons = true } = options;
        
        logger.info('Starting comprehensive CompreFace cleanup', { dryRun, resetDatabaseSync, preservePersons });

        const result: ComprefaceCleanupResult = {
            success: true,
            summary: {
                subjectsDeleted: 0,
                facesDeleted: 0,
                personsReset: 0,
                databaseSyncReset: 0
            },
            errors: [],
            warnings: []
        };

        try {
            // Step 1: Get all subjects from CompreFace
            const subjects = await this.getAllComprefaceSubjects();
            logger.info(`Found ${subjects.length} subjects in CompreFace`);

            if (!dryRun) {
                // Step 2: Delete all subjects from CompreFace
                for (const subject of subjects) {
                    try {
                        await this.deleteComprefaceSubject(subject.subject);
                        result.summary.subjectsDeleted++;
                        logger.info(`Deleted CompreFace subject: ${subject.subject}`);
                    } catch (error) {
                        const errorMsg = `Failed to delete subject ${subject.subject}: ${error}`;
                        result.errors.push(errorMsg);
                        logger.error(errorMsg);
                    }
                }
            } else {
                result.summary.subjectsDeleted = subjects.length;
                logger.info(`[DRY RUN] Would delete ${subjects.length} CompreFace subjects`);
            }

            // Step 3: Reset database sync status if requested
            if (resetDatabaseSync) {
                const syncResetCount = await this.resetAllDatabaseSync(dryRun);
                result.summary.databaseSyncReset = syncResetCount;
            }

            // Step 4: Reset person CompreFace references if not preserving
            if (!preservePersons && !dryRun) {
                const personsResetCount = await this.resetPersonComprefaceReferences();
                result.summary.personsReset = personsResetCount;
            } else if (!preservePersons) {
                const personsCount = await db('persons')
                    .whereNotNull('compreface_subject_id')
                    .count('id as count')
                    .first();
                result.summary.personsReset = personsCount ? Number(personsCount.count) : 0;
                logger.info(`[DRY RUN] Would reset ${result.summary.personsReset} person CompreFace references`);
            }

            logger.info('CompreFace cleanup completed successfully', result.summary);

        } catch (error) {
            result.success = false;
            const errorMsg = `CompreFace cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMsg);
            logger.error(errorMsg, error);
        }

        return result;
    }

    /**
     * Clean up specific person's CompreFace data
     */
    async cleanupPersonComprefaceData(personId: number, options: {
        dryRun?: boolean;
        resetDatabaseSync?: boolean;
    } = {}): Promise<ComprefaceCleanupResult> {
        const { dryRun = false, resetDatabaseSync = true } = options;
        
        logger.info(`Starting CompreFace cleanup for person ${personId}`, { dryRun });

        const result: ComprefaceCleanupResult = {
            success: true,
            summary: {
                subjectsDeleted: 0,
                facesDeleted: 0,
                personsReset: 0,
                databaseSyncReset: 0
            },
            errors: [],
            warnings: []
        };

        try {
            // Get person details
            const person = await PersonRepository.getPersonWithFaceCount(personId);
            if (!person) {
                throw new Error(`Person ${personId} not found`);
            }

            // Delete CompreFace subject if exists
            if (person.compreface_subject_id) {
                if (!dryRun) {
                    try {
                        await this.deleteComprefaceSubject(person.compreface_subject_id);
                        result.summary.subjectsDeleted = 1;
                        logger.info(`Deleted CompreFace subject: ${person.compreface_subject_id}`);
                    } catch (error) {
                        result.warnings.push(`Subject ${person.compreface_subject_id} may not exist in CompreFace: ${error}`);
                    }

                    // Reset person's CompreFace reference
                    await db('persons')
                        .where('id', personId)
                        .update({
                            compreface_subject_id: null,
                            last_trained: null
                        });
                    result.summary.personsReset = 1;
                } else {
                    result.summary.subjectsDeleted = 1;
                    result.summary.personsReset = 1;
                    logger.info(`[DRY RUN] Would delete subject ${person.compreface_subject_id} and reset person`);
                }
            }

            // Reset face sync status if requested
            if (resetDatabaseSync) {
                const syncResetCount = await this.resetPersonFaceSync(personId, dryRun);
                result.summary.databaseSyncReset = syncResetCount;
            }

            logger.info(`Person ${personId} CompreFace cleanup completed`, result.summary);

        } catch (error) {
            result.success = false;
            const errorMsg = `Person cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMsg);
            logger.error(errorMsg, error);
        }

        return result;
    }

    /**
     * Get all subjects from CompreFace
     */
    private async getAllComprefaceSubjects(): Promise<any[]> {
        const response = await fetch(
            `${this.comprefaceConfig.baseUrl}/api/v1/recognition/subjects`,
            {
                headers: {
                    'x-api-key': this.comprefaceConfig.apiKey
                }
            }
        );

        if (!response.ok) {
            throw new Error(`CompreFace API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        return data.subjects || [];
    }

    /**
     * Delete a specific subject from CompreFace
     */
    private async deleteComprefaceSubject(subjectId: string): Promise<void> {
        const response = await fetch(
            `${this.comprefaceConfig.baseUrl}/api/v1/recognition/subjects/${subjectId}`,
            {
                method: 'DELETE',
                headers: {
                    'x-api-key': this.comprefaceConfig.apiKey
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to delete subject ${subjectId}: ${response.status} ${response.statusText}`);
        }
    }

    /**
     * Reset database sync status for all faces
     */
    private async resetAllDatabaseSync(dryRun: boolean = false): Promise<number> {
        if (dryRun) {
            const count = await db('detected_faces')
                .where(function() {
                    this.where('compreface_synced', true)
                        .orWhereNotNull('compreface_uploaded_at');
                })
                .count('id as count')
                .first();
            return count ? Number(count.count) : 0;
        }

        const updated = await db('detected_faces')
            .where(function() {
                this.where('compreface_synced', true)
                    .orWhereNotNull('compreface_uploaded_at');
            })
            .update({
                compreface_synced: false,
                compreface_uploaded_at: null
            });

        logger.info(`Reset sync status for ${updated} faces`);
        return updated;
    }

    /**
     * Reset CompreFace references for all persons
     */
    private async resetPersonComprefaceReferences(): Promise<number> {
        const updated = await db('persons')
            .whereNotNull('compreface_subject_id')
            .update({
                compreface_subject_id: null,
                last_trained: null
            });

        logger.info(`Reset CompreFace references for ${updated} persons`);
        return updated;
    }

    /**
     * Reset face sync status for specific person
     */
    private async resetPersonFaceSync(personId: number, dryRun: boolean = false): Promise<number> {
        if (dryRun) {
            const count = await db('detected_faces')
                .where('person_id', personId)
                .where(function() {
                    this.where('compreface_synced', true)
                        .orWhereNotNull('compreface_uploaded_at');
                })
                .count('id as count')
                .first();
            return count ? Number(count.count) : 0;
        }

        const updated = await db('detected_faces')
            .where('person_id', personId)
            .where(function() {
                this.where('compreface_synced', true)
                    .orWhereNotNull('compreface_uploaded_at');
            })
            .update({
                compreface_synced: false,
                compreface_uploaded_at: null
            });

        logger.info(`Reset sync status for ${updated} faces belonging to person ${personId}`);
        return updated;
    }

    /**
     * Get comprehensive cleanup statistics
     */
    async getCleanupStats(): Promise<{
        comprefaceSubjects: number;
        databasePersons: number;
        syncedFaces: number;
        trainedPersons: number;
    }> {
        try {
            // Get CompreFace subjects
            const subjects = await this.getAllComprefaceSubjects();
            
            // Get database stats
            const [personsCount, syncedFacesCount, trainedPersonsCount] = await Promise.all([
                db('persons').count('id as count').first(),
                db('detected_faces')
                    .where(function() {
                        this.where('compreface_synced', true)
                            .orWhereNotNull('compreface_uploaded_at');
                    })
                    .count('id as count')
                    .first(),
                db('persons')
                    .whereNotNull('compreface_subject_id')
                    .count('id as count')
                    .first()
            ]);

            return {
                comprefaceSubjects: subjects.length,
                databasePersons: personsCount ? Number(personsCount.count) : 0,
                syncedFaces: syncedFacesCount ? Number(syncedFacesCount.count) : 0,
                trainedPersons: trainedPersonsCount ? Number(trainedPersonsCount.count) : 0
            };

        } catch (error) {
            logger.error('Error getting cleanup stats', error);
            throw error;
        }
    }
}