import { EventEmitter } from 'events';
import { Logger } from '../logger';

const logger = Logger.getInstance();

export interface JobOptions {
    priority?: number; // Higher = more priority
    maxRetries?: number;
    retryDelay?: number; // milliseconds
}

export interface Job<T = any> {
    id: string;
    type: string;
    data: T;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number; // 0-100
    result?: any;
    error?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    retries: number;
    maxRetries: number;
    retryDelay: number;
    priority: number;
}

export type JobHandler<T = any> = (
    job: Job<T>, 
    updateProgress: (progress: number, message?: string) => void
) => Promise<any>;

class JobQueue extends EventEmitter {
    private jobs = new Map<string, Job>();
    private handlers = new Map<string, JobHandler>();
    private running = new Set<string>();
    private maxConcurrent = 3;
    private processingInterval?: NodeJS.Timeout;

    constructor() {
        super();
        this.startProcessing();
    }

    /**
     * Register a job handler for a specific job type
     */
    registerHandler<T>(type: string, handler: JobHandler<T>): void {
        this.handlers.set(type, handler);
        logger.info(`Registered job handler for type: ${type}`);
    }

    /**
     * Add a job to the queue
     */
    addJob<T>(
        type: string, 
        data: T, 
        options: JobOptions = {}
    ): string {
        const job: Job<T> = {
            id: this.generateJobId(),
            type,
            data,
            status: 'pending',
            progress: 0,
            createdAt: new Date(),
            retries: 0,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 5000,
            priority: options.priority || 0
        };

        this.jobs.set(job.id, job);
        logger.info(`Added job ${job.id} of type ${type} to queue`);
        
        this.emit('jobAdded', job);
        return job.id;
    }

    /**
     * Get job status and progress
     */
    getJob(jobId: string): Job | undefined {
        return this.jobs.get(jobId);
    }

    /**
     * Get all jobs, optionally filtered by status
     */
    getJobs(status?: Job['status']): Job[] {
        const jobs = Array.from(this.jobs.values());
        return status ? jobs.filter(job => job.status === status) : jobs;
    }

    /**
     * Cancel a pending job
     */
    cancelJob(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'pending') {
            return false;
        }

        job.status = 'failed';
        job.error = 'Cancelled by user';
        job.completedAt = new Date();
        
        this.emit('jobCancelled', job);
        logger.info(`Cancelled job ${jobId}`);
        return true;
    }

    /**
     * Get queue statistics
     */
    getStats() {
        const jobs = Array.from(this.jobs.values());
        return {
            total: jobs.length,
            pending: jobs.filter(j => j.status === 'pending').length,
            running: jobs.filter(j => j.status === 'running').length,
            completed: jobs.filter(j => j.status === 'completed').length,
            failed: jobs.filter(j => j.status === 'failed').length,
            maxConcurrent: this.maxConcurrent
        };
    }

    /**
     * Clean up old completed/failed jobs
     */
    cleanup(olderThanHours = 24): number {
        const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
        let cleaned = 0;

        for (const [id, job] of this.jobs.entries()) {
            if (
                (job.status === 'completed' || job.status === 'failed') &&
                job.completedAt &&
                job.completedAt < cutoff
            ) {
                this.jobs.delete(id);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info(`Cleaned up ${cleaned} old jobs`);
        }

        return cleaned;
    }

    private startProcessing(): void {
        this.processingInterval = setInterval(() => {
            this.processQueue();
        }, 1000);
    }

    private async processQueue(): Promise<void> {
        if (this.running.size >= this.maxConcurrent) {
            return;
        }

        // Get pending jobs sorted by priority (higher first) then by creation time
        const pendingJobs = Array.from(this.jobs.values())
            .filter(job => job.status === 'pending')
            .sort((a, b) => {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority; // Higher priority first
                }
                return a.createdAt.getTime() - b.createdAt.getTime(); // Older first
            });

        const availableSlots = this.maxConcurrent - this.running.size;
        const jobsToProcess = pendingJobs.slice(0, availableSlots);

        for (const job of jobsToProcess) {
            this.processJob(job);
        }
    }

    private async processJob(job: Job): Promise<void> {
        const handler = this.handlers.get(job.type);
        if (!handler) {
            job.status = 'failed';
            job.error = `No handler registered for job type: ${job.type}`;
            job.completedAt = new Date();
            this.emit('jobFailed', job);
            return;
        }

        this.running.add(job.id);
        job.status = 'running';
        job.startedAt = new Date();
        job.progress = 0;

        logger.info(`Starting job ${job.id} of type ${job.type}`);
        this.emit('jobStarted', job);

        const updateProgress = (progress: number, message?: string) => {
            job.progress = Math.max(0, Math.min(100, progress));
            if (message) {
                logger.debug(`Job ${job.id}: ${message} (${progress}%)`);
            }
            this.emit('jobProgress', job, message);
        };

        try {
            const result = await handler(job, updateProgress);
            
            job.status = 'completed';
            job.result = result;
            job.progress = 100;
            job.completedAt = new Date();
            
            logger.info(`Completed job ${job.id} in ${this.getJobDuration(job)}ms`);
            this.emit('jobCompleted', job);

        } catch (error) {
            logger.error(`Job ${job.id} failed: ${error}`);
            
            job.retries++;
            if (job.retries < job.maxRetries) {
                // Retry after delay
                job.status = 'pending';
                job.progress = 0;
                logger.info(`Retrying job ${job.id} (attempt ${job.retries + 1}/${job.maxRetries})`);
                
                setTimeout(() => {
                    // Job will be picked up by next processing cycle
                }, job.retryDelay);
            } else {
                // Max retries exceeded
                job.status = 'failed';
                job.error = error instanceof Error ? error.message : String(error);
                job.completedAt = new Date();
                this.emit('jobFailed', job);
            }
        } finally {
            this.running.delete(job.id);
        }
    }

    private generateJobId(): string {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private getJobDuration(job: Job): number {
        if (!job.startedAt || !job.completedAt) return 0;
        return job.completedAt.getTime() - job.startedAt.getTime();
    }

    /**
     * Shutdown the job queue gracefully
     */
    async shutdown(): Promise<void> {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }

        // Wait for running jobs to complete (with timeout)
        const timeout = 30000; // 30 seconds
        const start = Date.now();
        
        while (this.running.size > 0 && Date.now() - start < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        logger.info(`Job queue shutdown. ${this.running.size} jobs may have been interrupted.`);
    }
}

// Export singleton instance
export const jobQueue = new JobQueue();

// Cleanup old jobs every hour
setInterval(() => {
    jobQueue.cleanup();
}, 60 * 60 * 1000);