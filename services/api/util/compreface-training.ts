import { PersonRepository, FaceRepository, db } from '../models/database';
import { addFacesToSubjectBatch, createComprefaceSubject } from './compreface';
import { Logger } from '../logger';
import { configManager } from './config-manager';

const logger = Logger.getInstance();

export interface TrainingJob {
    id?: number;
    person_id: number;
    person_name: string;
    faces_trained_count: number;
    training_type: 'full' | 'incremental' | 'validation';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    started_at: Date;
    completed_at?: Date;
    error_message?: string;
    success_rate?: number; // Percentage of faces successfully trained
    faces_added?: number;
    faces_failed?: number;
}

export interface TrainingQueue {
    pendingJobs: TrainingJob[];
    runningJobs: TrainingJob[];
    completedJobs: TrainingJob[];
    totalPeople: number;
    trainedPeople: number;
    untrainedPeople: number;
}

export interface TrainingStats {
    totalPeople: number;
    trainedPeople: number;
    untrainedPeople: number;
    trainingJobs: number;
    averageTrainingTime: number;
    successRate: number;
    lastTrainingDate?: Date;
}

export interface AutoTrainingConfig {
    enabled: boolean;
    minFacesThreshold: number;
    maxFacesPerBatch: number;
    trainingInterval: number; // hours
    autoRetryFailures: boolean;
    maxRetries: number;
}

export class CompreFaceTrainingManager {
    private isProcessing = false;
    private config: AutoTrainingConfig;

    constructor(config: Partial<AutoTrainingConfig> = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            minFacesThreshold: config.minFacesThreshold ?? 3,
            maxFacesPerBatch: config.maxFacesPerBatch ?? 50,
            trainingInterval: config.trainingInterval ?? 6,
            autoRetryFailures: config.autoRetryFailures ?? true,
            maxRetries: config.maxRetries ?? 3
        };
    }

    /**
     * Queue person for training
     */
    async queuePersonForTraining(
        personId: number, 
        trainingType: 'full' | 'incremental' | 'validation' = 'incremental'
    ): Promise<number> {
        const person = await PersonRepository.getPersonWithFaceCount(personId);
        if (!person) {
            throw new Error('Person not found');
        }

        const faces = await FaceRepository.getFacesByPerson(personId);
        if (faces.length < this.config.minFacesThreshold) {
            throw new Error(`Person needs at least ${this.config.minFacesThreshold} faces for training (has ${faces.length})`);
        }

        // Check if already queued or training
        const existingJob = await db('recognition_training_history')
            .where('person_id', personId)
            .whereIn('status', ['pending', 'running'])
            .first();

        if (existingJob) {
            return existingJob.id;
        }

        const [trainingId] = await db('recognition_training_history').insert({
            person_id: personId,
            person_name: person.name,
            faces_trained_count: faces.length,
            training_type: trainingType,
            status: 'pending',
            started_at: new Date()
        });

        logger.info('Queued person for training', {
            personId,
            personName: person.name,
            facesCount: faces.length,
            trainingType,
            trainingId
        });

        return trainingId;
    }

    /**
     * Process training queue
     */
    async processTrainingQueue(): Promise<TrainingJob[]> {
        if (this.isProcessing) {
            logger.debug('Training queue already being processed');
            return [];
        }

        this.isProcessing = true;
        logger.info('Processing training queue');

        try {
            const pendingJobs = await db('recognition_training_history')
                .where('status', 'pending')
                .orderBy('started_at', 'asc')
                .limit(5); // Process up to 5 at a time

            const results = [];
            for (const job of pendingJobs) {
                try {
                    const result = await this.executeTrainingJob(job);
                    results.push(result);
                } catch (error) {
                    logger.error(`Training job ${job.id} failed`, error);
                    await this.markJobFailed(job.id, error instanceof Error ? error.message : 'Unknown error');
                    results.push({ ...job, status: 'failed' as const });
                }
            }

            return results;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Execute a single training job
     */
    private async executeTrainingJob(job: TrainingJob): Promise<TrainingJob> {
        logger.info(`Starting training job ${job.id} for ${job.person_name}`);

        // Mark as running
        await db('recognition_training_history')
            .where('id', job.id)
            .update({ status: 'running' });

        // Update person status
        await PersonRepository.updatePerson(job.person_id, {
            recognition_status: 'training'
        });

        const startTime = Date.now();

        try {
            // Get person and faces
            const person = await PersonRepository.getPersonWithFaceCount(job.person_id);
            if (!person) {
                throw new Error('Person not found');
            }

            const faces = await FaceRepository.getFacesByPerson(job.person_id);
            if (faces.length === 0) {
                throw new Error('No faces found for training');
            }

            // Ensure CompreFace subject exists
            if (!person.compreface_subject_id) {
                const subjectId = await createComprefaceSubject(person.name);
                await PersonRepository.updatePerson(job.person_id, {
                    compreface_subject_id: subjectId
                });
                person.compreface_subject_id = subjectId;
            }

            // Prepare face paths for training
            const processedDir = configManager.getStorage().processedDir;
            const facePaths = faces
                .filter(face => face.relative_face_path || face.face_image_path)
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
                .filter((path): path is string => path !== null) // Filter out nulls and assert type
                .slice(0, this.config.maxFacesPerBatch); // Limit batch size

            logger.info(`Training ${facePaths.length} faces for ${person.name}`);

            // Upload faces to CompreFace
            const uploadResults = await addFacesToSubjectBatch(person.compreface_subject_id!, facePaths);
            
            const facesAdded = uploadResults.successful.length;
            const facesFailed = uploadResults.failed.length;
            const successRate = facePaths.length > 0 ? (facesAdded / facePaths.length) * 100 : 0;

            const completedAt = new Date();
            const trainingTime = Date.now() - startTime;

            // Update job as completed
            await db('recognition_training_history')
                .where('id', job.id)
                .update({
                    status: 'completed',
                    completed_at: completedAt,
                    success_rate: successRate,
                    faces_added: facesAdded,
                    faces_failed: facesFailed
                });

            // Update person training status
            await PersonRepository.updatePerson(job.person_id, {
                recognition_status: 'trained',
                training_face_count: facesAdded,
                last_trained_at: completedAt
            });

            logger.info(`Training completed for ${person.name}`, {
                personId: job.person_id,
                facesAdded,
                facesFailed,
                successRate: Math.round(successRate),
                trainingTimeMs: trainingTime
            });

            return {
                ...job,
                status: 'completed',
                completed_at: completedAt,
                success_rate: successRate,
                faces_added: facesAdded,
                faces_failed: facesFailed
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.markJobFailed(job.id!, errorMessage);
            
            // Update person status to failed
            await PersonRepository.updatePerson(job.person_id, {
                recognition_status: 'failed'
            });

            throw error;
        }
    }

    /**
     * Mark job as failed
     */
    private async markJobFailed(jobId: number, errorMessage: string): Promise<void> {
        await db('recognition_training_history')
            .where('id', jobId)
            .update({
                status: 'failed',
                completed_at: new Date(),
                error_message: errorMessage
            });
    }

    /**
     * Auto-train people who meet criteria
     */
    async autoTrainEligiblePeople(): Promise<TrainingJob[]> {
        if (!this.config.enabled) {
            logger.debug('Auto-training disabled');
            return [];
        }

        logger.info('Checking for people eligible for auto-training');

        const minFaces = this.config.minFacesThreshold;
        const intervalHours = this.config.trainingInterval;

        // Find people with enough faces but not trained recently
        const eligiblePeople = await db('persons as p')
            .leftJoin('recognition_training_history as rth', function() {
                this.on('p.id', 'rth.person_id')
                    .andOn('rth.status', db.raw("'completed'"));
            })
            .where('p.face_count', '>=', minFaces)
            .where(function() {
                this.where('p.recognition_status', 'untrained')
                    .orWhere('p.recognition_status', 'failed')
                    .orWhere(function() {
                        this.where('p.recognition_status', 'trained')
                            .andWhere('p.last_trained_at', '<', 
                                db.raw(`DATE_SUB(NOW(), INTERVAL ? HOUR)`, [intervalHours]));
                    });
            })
            .whereNotExists(function() {
                this.select('*')
                    .from('recognition_training_history as pending')
                    .whereRaw('pending.person_id = p.id')
                    .whereIn('pending.status', ['pending', 'running']);
            })
            .groupBy('p.id')
            .select('p.*')
            .limit(10); // Limit to 10 people at once

        const queuedJobs: TrainingJob[] = [];
        for (const person of eligiblePeople) {
            try {
                const trainingType = person.recognition_status === 'trained' ? 'incremental' : 'full';
                const jobId = await this.queuePersonForTraining(person.id!, trainingType);
                
                // Get the full training job record
                const trainingJob = await db('recognition_training_history').where('id', jobId).first();
                if (trainingJob) {
                    queuedJobs.push(trainingJob);
                }
            } catch (error) {
                logger.warn(`Failed to queue person ${person.id} for training`, error);
            }
        }

        if (queuedJobs.length > 0) {
            logger.info(`Auto-queued ${queuedJobs.length} people for training`);
        }

        return queuedJobs;
    }

    /**
     * Get training queue status
     */
    async getTrainingQueue(): Promise<TrainingQueue> {
        const [
            pendingJobs,
            runningJobs,
            completedJobs
        ] = await Promise.all([
            db('recognition_training_history').where('status', 'pending').orderBy('started_at', 'asc'),
            db('recognition_training_history').where('status', 'running').orderBy('started_at', 'asc'),
            db('recognition_training_history').where('status', 'completed').orderBy('completed_at', 'desc').limit(20)
        ]);

        const [
            totalPeople,
            trainedPeople,
            untrainedPeople
        ] = await Promise.all([
            db('persons').count('* as count').first().then(r => Number(r?.count || 0)),
            db('persons').where('recognition_status', 'trained').count('* as count').first().then(r => Number(r?.count || 0)),
            db('persons').whereIn('recognition_status', ['untrained', 'failed']).count('* as count').first().then(r => Number(r?.count || 0))
        ]);

        return {
            pendingJobs,
            runningJobs,
            completedJobs,
            totalPeople,
            trainedPeople,
            untrainedPeople
        };
    }

    /**
     * Get training statistics
     */
    async getTrainingStats(): Promise<TrainingStats> {
        const [
            totalPeople,
            trainedPeople,
            untrainedPeople,
            trainingJobs,
            avgTrainingTime,
            successfulJobs,
            lastTraining
        ] = await Promise.all([
            db('persons').count('* as count').first().then(r => Number(r?.count || 0)),
            db('persons').where('recognition_status', 'trained').count('* as count').first().then(r => Number(r?.count || 0)),
            db('persons').whereIn('recognition_status', ['untrained', 'failed']).count('* as count').first().then(r => Number(r?.count || 0)),
            db('recognition_training_history').count('* as count').first().then(r => Number(r?.count || 0)),
            db('recognition_training_history')
                .whereNotNull('completed_at')
                .select(db.raw('AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) as avg_duration'))
                .first()
                .then((r: any) => Number(r?.avg_duration || 0)),
            db('recognition_training_history').where('status', 'completed').count('* as count').first().then(r => Number(r?.count || 0)),
            db('recognition_training_history').where('status', 'completed').max('completed_at as last_date').first()
        ]);

        const totalTrainingJobs = await db('recognition_training_history').count('* as count').first().then(r => Number(r?.count || 0));
        const successRate = totalTrainingJobs > 0 ? (successfulJobs / totalTrainingJobs) * 100 : 0;

        return {
            totalPeople,
            trainedPeople,
            untrainedPeople,
            trainingJobs: totalTrainingJobs,
            averageTrainingTime: avgTrainingTime,
            successRate,
            lastTrainingDate: lastTraining?.last_date ? new Date(lastTraining.last_date) : undefined
        };
    }

    /**
     * Cancel training job
     */
    async cancelTrainingJob(jobId: number): Promise<boolean> {
        const job = await db('recognition_training_history').where('id', jobId).first();
        if (!job) {
            return false;
        }

        if (job.status === 'running') {
            // For running jobs, mark as cancelled (actual cancellation would require more complex logic)
            await db('recognition_training_history')
                .where('id', jobId)
                .update({
                    status: 'cancelled',
                    completed_at: new Date(),
                    error_message: 'Training cancelled by user'
                });

            // Reset person status
            await PersonRepository.updatePerson(job.person_id, {
                recognition_status: 'untrained'
            });

            logger.info(`Training job ${jobId} cancelled`);
            return true;
        } else if (job.status === 'pending') {
            // For pending jobs, just remove from queue
            await db('recognition_training_history')
                .where('id', jobId)
                .update({
                    status: 'cancelled',
                    error_message: 'Training cancelled by user'
                });

            logger.info(`Training job ${jobId} removed from queue`);
            return true;
        }

        return false;
    }

    /**
     * Retry failed training job
     */
    async retryTrainingJob(jobId: number): Promise<number> {
        const failedJob = await db('recognition_training_history').where('id', jobId).first();
        if (!failedJob || failedJob.status !== 'failed') {
            throw new Error('Job not found or not in failed state');
        }

        // Create new training job
        const newJobId = await this.queuePersonForTraining(failedJob.person_id, failedJob.training_type);
        
        logger.info(`Retrying failed training job ${jobId} as new job ${newJobId}`);
        return newJobId;
    }

    /**
     * Clean up old training history
     */
    async cleanupTrainingHistory(daysToKeep: number = 30): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const deleted = await db('recognition_training_history')
            .where('completed_at', '<', cutoffDate)
            .whereIn('status', ['completed', 'failed', 'cancelled'])
            .del();

        if (deleted > 0) {
            logger.info(`Cleaned up ${deleted} old training history records`);
        }

        return deleted;
    }
}