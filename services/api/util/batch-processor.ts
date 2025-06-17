import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import path from 'path';
import { logger as structuredLogger } from './structured-logger';
import { configManager } from './config-manager';

export enum JobPriority {
    LOW = 1,
    NORMAL = 2,
    HIGH = 3,
    URGENT = 4
}

export enum JobStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

export interface BatchJob {
    id: string;
    type: 'image_processing' | 'face_detection' | 'object_detection' | 'smart_albums';
    priority: JobPriority;
    status: JobStatus;
    data: any;
    progress: number;
    totalItems: number;
    processedItems: number;
    failedItems: number;
    errors: string[];
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    estimatedTimeRemaining?: number;
}

export interface ProcessingResult {
    success: boolean;
    data?: any;
    error?: string;
    processingTime: number;
}

export interface WorkerPoolConfig {
    maxWorkers: number;
    maxConcurrentJobs: number;
    jobTimeout: number;
    retryAttempts: number;
}

export class BatchProcessor extends EventEmitter {
    private static instance: BatchProcessor;
    private workers: Map<string, Worker> = new Map();
    private jobs: Map<string, BatchJob> = new Map();
    private jobQueue: BatchJob[] = [];
    private activeJobs: Set<string> = new Set();
    private config: WorkerPoolConfig;
    private isShuttingDown = false;
    private jobIdCounter = 0;

    private constructor() {
        super();
        const serverConfig = configManager.getServer?.() || { scanBatchSize: 4 };
        this.config = {
            maxWorkers: serverConfig.scanBatchSize || 4,
            maxConcurrentJobs: (serverConfig.scanBatchSize || 4) * 2,
            jobTimeout: 300000, // 5 minutes
            retryAttempts: 3
        };
        
        this.startWorkerPool();
        this.startJobProcessor();
    }

    public static getInstance(): BatchProcessor {
        if (!BatchProcessor.instance) {
            BatchProcessor.instance = new BatchProcessor();
        }
        return BatchProcessor.instance;
    }

    /**
     * Add a new batch job to the queue
     */
    public addJob(
        type: BatchJob['type'],
        data: any,
        priority: JobPriority = JobPriority.NORMAL,
        totalItems: number = 1
    ): string {
        const jobId = this.generateJobId();
        const job: BatchJob = {
            id: jobId,
            type,
            priority,
            status: JobStatus.PENDING,
            data,
            progress: 0,
            totalItems,
            processedItems: 0,
            failedItems: 0,
            errors: [],
            createdAt: new Date()
        };

        this.jobs.set(jobId, job);
        this.insertJobInQueue(job);

        structuredLogger.info('Batch job added to queue', {
            type: 'batch_processor',
            action: 'job_added',
            jobId,
            jobType: type,
            priority,
            totalItems,
            queueSize: this.jobQueue.length
        });

        this.emit('jobAdded', job);
        this.processNextJob();

        return jobId;
    }

    /**
     * Get job status and progress
     */
    public getJob(jobId: string): BatchJob | undefined {
        return this.jobs.get(jobId);
    }

    /**
     * Cancel a job
     */
    public cancelJob(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job) return false;

        if (job.status === JobStatus.PENDING) {
            // Remove from queue
            this.jobQueue = this.jobQueue.filter(j => j.id !== jobId);
            job.status = JobStatus.CANCELLED;
            this.emit('jobCancelled', job);
            return true;
        }

        if (job.status === JobStatus.RUNNING) {
            // Signal worker to stop
            const worker = this.getWorkerForJob(jobId);
            if (worker) {
                worker.postMessage({ type: 'cancel', jobId });
                job.status = JobStatus.CANCELLED;
                this.activeJobs.delete(jobId);
                this.emit('jobCancelled', job);
                return true;
            }
        }

        return false;
    }

    /**
     * Get all jobs with optional filtering
     */
    public getJobs(filter?: {
        status?: JobStatus;
        type?: BatchJob['type'];
        limit?: number;
    }): BatchJob[] {
        let jobs = Array.from(this.jobs.values());

        if (filter?.status) {
            jobs = jobs.filter(job => job.status === filter.status);
        }

        if (filter?.type) {
            jobs = jobs.filter(job => job.type === filter.type);
        }

        // Sort by creation time (newest first)
        jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        if (filter?.limit) {
            jobs = jobs.slice(0, filter.limit);
        }

        return jobs;
    }

    /**
     * Get queue statistics
     */
    public getQueueStats() {
        const stats = {
            totalJobs: this.jobs.size,
            pendingJobs: this.jobQueue.length,
            activeJobs: this.activeJobs.size,
            completedJobs: 0,
            failedJobs: 0,
            cancelledJobs: 0,
            activeWorkers: this.workers.size,
            maxWorkers: this.config.maxWorkers
        };

        for (const job of this.jobs.values()) {
            switch (job.status) {
                case JobStatus.COMPLETED:
                    stats.completedJobs++;
                    break;
                case JobStatus.FAILED:
                    stats.failedJobs++;
                    break;
                case JobStatus.CANCELLED:
                    stats.cancelledJobs++;
                    break;
            }
        }

        return stats;
    }

    /**
     * Clean up old completed jobs
     */
    public cleanupJobs(olderThanHours: number = 24): number {
        const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
        let cleaned = 0;

        for (const [jobId, job] of this.jobs.entries()) {
            if ((job.status === JobStatus.COMPLETED || 
                 job.status === JobStatus.FAILED || 
                 job.status === JobStatus.CANCELLED) &&
                job.createdAt < cutoff) {
                this.jobs.delete(jobId);
                cleaned++;
            }
        }

        structuredLogger.info('Cleaned up old batch jobs', {
            type: 'batch_processor',
            action: 'cleanup',
            cleanedJobs: cleaned,
            cutoffHours: olderThanHours
        });

        return cleaned;
    }

    /**
     * Process a specific file immediately (high priority)
     */
    public async processFileImmediate(filePath: string): Promise<ProcessingResult> {
        const jobId = this.addJob(
            'image_processing',
            { filePath, immediate: true },
            JobPriority.URGENT,
            1
        );

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.cancelJob(jobId);
                reject(new Error('Processing timeout'));
            }, this.config.jobTimeout);

            const onJobComplete = (job: BatchJob) => {
                if (job.id === jobId) {
                    clearTimeout(timeout);
                    this.off('jobCompleted', onJobComplete);
                    this.off('jobFailed', onJobFailed);

                    if (job.status === JobStatus.COMPLETED) {
                        resolve({
                            success: true,
                            data: job.data.result,
                            processingTime: job.completedAt!.getTime() - job.startedAt!.getTime()
                        });
                    } else {
                        reject(new Error(job.errors.join(', ')));
                    }
                }
            };

            const onJobFailed = (job: BatchJob) => {
                if (job.id === jobId) {
                    clearTimeout(timeout);
                    this.off('jobCompleted', onJobComplete);
                    this.off('jobFailed', onJobFailed);
                    reject(new Error(job.errors.join(', ')));
                }
            };

            this.on('jobCompleted', onJobComplete);
            this.on('jobFailed', onJobFailed);
        });
    }

    /**
     * Shutdown the batch processor gracefully
     */
    public async shutdown(): Promise<void> {
        this.isShuttingDown = true;
        
        structuredLogger.info('Shutting down batch processor', {
            type: 'batch_processor',
            action: 'shutdown',
            activeJobs: this.activeJobs.size,
            pendingJobs: this.jobQueue.length
        });

        // Wait for active jobs to complete or timeout
        const shutdownTimeout = 30000; // 30 seconds
        const startTime = Date.now();

        while (this.activeJobs.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Terminate all workers
        for (const worker of this.workers.values()) {
            await worker.terminate();
        }

        this.workers.clear();
        this.activeJobs.clear();
    }

    private generateJobId(): string {
        return `job_${Date.now()}_${++this.jobIdCounter}`;
    }

    private insertJobInQueue(job: BatchJob): void {
        // Insert job in priority order (higher priority first)
        let insertIndex = this.jobQueue.length;
        
        for (let i = 0; i < this.jobQueue.length; i++) {
            if (this.jobQueue[i].priority < job.priority) {
                insertIndex = i;
                break;
            }
        }

        this.jobQueue.splice(insertIndex, 0, job);
    }

    private async processNextJob(): Promise<void> {
        if (this.isShuttingDown || 
            this.activeJobs.size >= this.config.maxConcurrentJobs ||
            this.jobQueue.length === 0) {
            return;
        }

        const job = this.jobQueue.shift();
        if (!job) return;

        job.status = JobStatus.RUNNING;
        job.startedAt = new Date();
        this.activeJobs.add(job.id);

        this.emit('jobStarted', job);

        try {
            await this.executeJob(job);
        } catch (error) {
            this.handleJobError(job, error instanceof Error ? error.message : 'Unknown error');
        }

        // Process next job if available
        setImmediate(() => this.processNextJob());
    }

    private async executeJob(job: BatchJob): Promise<void> {
        const worker = await this.getAvailableWorker();
        if (!worker) {
            throw new Error('No available workers');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Job timeout'));
            }, this.config.jobTimeout);

            const messageHandler = (message: any) => {
                if (message.jobId !== job.id) return;

                clearTimeout(timeout);
                worker.off('message', messageHandler);

                if (message.type === 'progress') {
                    this.updateJobProgress(job, message.progress, message.processedItems);
                    return;
                }

                if (message.type === 'completed') {
                    job.status = JobStatus.COMPLETED;
                    job.completedAt = new Date();
                    job.progress = 100;
                    job.data.result = message.result;
                    this.activeJobs.delete(job.id);
                    this.emit('jobCompleted', job);
                    resolve();
                } else if (message.type === 'error') {
                    job.errors.push(message.error);
                    this.activeJobs.delete(job.id);
                    reject(new Error(message.error));
                }
            };

            worker.on('message', messageHandler);
            worker.postMessage({
                type: 'process',
                jobId: job.id,
                jobType: job.type,
                data: job.data
            });
        });
    }

    private updateJobProgress(job: BatchJob, progress: number, processedItems: number): void {
        job.progress = Math.min(100, Math.max(0, progress));
        job.processedItems = processedItems;

        // Estimate remaining time
        if (job.startedAt && processedItems > 0) {
            const elapsed = Date.now() - job.startedAt.getTime();
            const itemsPerMs = processedItems / elapsed;
            const remainingItems = job.totalItems - processedItems;
            job.estimatedTimeRemaining = remainingItems / itemsPerMs;
        }

        this.emit('jobProgress', job);
    }

    private handleJobError(job: BatchJob, error: string): void {
        job.status = JobStatus.FAILED;
        job.completedAt = new Date();
        job.errors.push(error);
        this.activeJobs.delete(job.id);

        structuredLogger.error('Batch job failed', {
            type: 'batch_processor',
            action: 'job_failed',
            jobId: job.id,
            jobType: job.type,
            error
        });

        this.emit('jobFailed', job);
    }

    private async getAvailableWorker(): Promise<Worker | null> {
        // Try to find an idle worker
        for (const worker of this.workers.values()) {
            // This is simplified - in practice, you'd track worker state
            return worker;
        }

        // Create new worker if under limit
        if (this.workers.size < this.config.maxWorkers) {
            return this.createWorker();
        }

        return null;
    }

    private getWorkerForJob(jobId: string): Worker | null {
        // In a real implementation, you'd track which worker is handling which job
        return this.workers.values().next().value || null;
    }

    private startWorkerPool(): void {
        for (let i = 0; i < Math.min(2, this.config.maxWorkers); i++) {
            this.createWorker();
        }
    }

    private createWorker(): Worker {
        const workerId = `worker_${this.workers.size + 1}`;
        const workerPath = path.join(__dirname, 'batch-worker.js');
        
        const worker = new Worker(workerPath, {
            workerData: { workerId }
        });

        worker.on('error', (error) => {
            structuredLogger.error('Worker error', {
                type: 'batch_processor',
                action: 'worker_error',
                workerId,
                error: error.message
            });
            this.workers.delete(workerId);
            
            // Restart worker if not shutting down
            if (!this.isShuttingDown && this.workers.size < this.config.maxWorkers) {
                setTimeout(() => this.createWorker(), 1000);
            }
        });

        worker.on('exit', (code) => {
            structuredLogger.info('Worker exited', {
                type: 'batch_processor',
                action: 'worker_exit',
                workerId,
                exitCode: code
            });
            this.workers.delete(workerId);
        });

        this.workers.set(workerId, worker);

        structuredLogger.info('Worker created', {
            type: 'batch_processor',
            action: 'worker_created',
            workerId,
            totalWorkers: this.workers.size
        });

        return worker;
    }

    private startJobProcessor(): void {
        // Process jobs every 100ms
        setInterval(() => {
            if (!this.isShuttingDown) {
                this.processNextJob();
            }
        }, 100);
    }
}

// Export singleton instance
export const batchProcessor = BatchProcessor.getInstance();