import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import os from 'os';
import { Logger } from '../logger';

const logger = Logger.getInstance();

interface WorkerTask {
    id: string;
    data: any;
    resolve: (result: any) => void;
    reject: (error: Error) => void;
}

interface WorkerInstance {
    worker: Worker;
    busy: boolean;
    currentTask?: WorkerTask;
}

export class WorkerPool extends EventEmitter {
    private workers: WorkerInstance[] = [];
    private taskQueue: WorkerTask[] = [];
    private workerScript: string;
    private maxWorkers: number;
    private taskCounter = 0;
    private isShuttingDown = false;

    constructor(workerScript: string, maxWorkers?: number) {
        super();
        this.workerScript = workerScript;
        // Default to CPU count - 1, minimum 1
        this.maxWorkers = maxWorkers || Math.max(1, os.cpus().length - 1);
        logger.info(`[WorkerPool] Initializing with ${this.maxWorkers} workers`);
    }

    /**
     * Initialize the worker pool
     */
    async initialize(): Promise<void> {
        for (let i = 0; i < this.maxWorkers; i++) {
            await this.createWorker();
        }
        logger.info(`[WorkerPool] All ${this.workers.length} workers initialized`);
    }

    /**
     * Create a new worker
     */
    private async createWorker(): Promise<void> {
        // For TypeScript workers, we need to use the compiled JS file
        const workerPath = this.workerScript.replace('.ts', '.js');
        // The worker is already in the build directory, so just use the relative path
        const actualPath = workerPath;

        const worker = new Worker(actualPath);
        const workerInstance: WorkerInstance = {
            worker,
            busy: false
        };

        // Handle worker messages
        worker.on('message', (message: any) => {
            if (message.type === 'ready') {
                logger.info(`[WorkerPool] Worker ${worker.threadId} ready`);
                return;
            }

            // Handle task results
            if (workerInstance.currentTask) {
                const task = workerInstance.currentTask;
                
                if (message.success) {
                    task.resolve(message);
                } else {
                    task.reject(new Error(message.error || 'Worker task failed'));
                }

                // Mark worker as available and process next task
                workerInstance.busy = false;
                workerInstance.currentTask = undefined;
                this.processNextTask();
            }
        });

        // Handle worker errors
        worker.on('error', (error) => {
            logger.error(`[WorkerPool] Worker ${worker.threadId} error:`, error);
            
            // Reject current task if any
            if (workerInstance.currentTask) {
                workerInstance.currentTask.reject(error);
            }

            // Remove failed worker and create replacement
            const index = this.workers.indexOf(workerInstance);
            if (index !== -1) {
                this.workers.splice(index, 1);
            }

            if (!this.isShuttingDown) {
                this.createWorker().catch(err => 
                    logger.error('[WorkerPool] Failed to create replacement worker:', err)
                );
            }
        });

        // Handle worker exit
        worker.on('exit', (code) => {
            if (code !== 0 && !this.isShuttingDown) {
                logger.warn(`[WorkerPool] Worker ${worker.threadId} exited with code ${code}`);
            }
        });

        this.workers.push(workerInstance);
    }

    /**
     * Execute a task in the worker pool
     */
    async execute<T = any>(data: any): Promise<T> {
        if (this.isShuttingDown) {
            throw new Error('Worker pool is shutting down');
        }

        return new Promise((resolve, reject) => {
            const task: WorkerTask = {
                id: `task_${++this.taskCounter}`,
                data,
                resolve,
                reject
            };

            this.taskQueue.push(task);
            this.processNextTask();
        });
    }

    /**
     * Process the next task in queue
     */
    private processNextTask(): void {
        if (this.taskQueue.length === 0) return;

        // Find available worker
        const availableWorker = this.workers.find(w => !w.busy);
        if (!availableWorker) return;

        // Get next task
        const task = this.taskQueue.shift();
        if (!task) return;

        // Assign task to worker
        availableWorker.busy = true;
        availableWorker.currentTask = task;

        // Send task to worker
        availableWorker.worker.postMessage({
            type: 'process',
            taskId: task.id,
            ...task.data
        });

        logger.debug(`[WorkerPool] Task ${task.id} assigned to worker ${availableWorker.worker.threadId}`);
    }

    /**
     * Get pool statistics
     */
    getStats() {
        const busyWorkers = this.workers.filter(w => w.busy).length;
        return {
            totalWorkers: this.workers.length,
            busyWorkers,
            idleWorkers: this.workers.length - busyWorkers,
            queuedTasks: this.taskQueue.length
        };
    }

    /**
     * Shutdown the worker pool
     */
    async shutdown(): Promise<void> {
        logger.info('[WorkerPool] Shutting down...');
        this.isShuttingDown = true;

        // Clear task queue
        for (const task of this.taskQueue) {
            task.reject(new Error('Worker pool shutting down'));
        }
        this.taskQueue = [];

        // Terminate all workers
        const terminationPromises = this.workers.map(w => {
            w.worker.postMessage({ type: 'shutdown' });
            return new Promise<void>(resolve => {
                w.worker.once('exit', () => resolve());
                // Force terminate after 5 seconds
                setTimeout(() => {
                    w.worker.terminate();
                    resolve();
                }, 5000);
            });
        });

        await Promise.all(terminationPromises);
        this.workers = [];
        
        logger.info('[WorkerPool] Shutdown complete');
    }
}

// Singleton instance for image processing
let imageProcessorPool: WorkerPool | null = null;

export function getImageProcessorPool(): WorkerPool {
    if (!imageProcessorPool) {
        // Use the compiled JS file in the build directory
        const workerPath = path.join(__dirname, '../workers/image-processor.worker.js');
        imageProcessorPool = new WorkerPool(
            workerPath,
            parseInt(process.env.IMAGE_PROCESSOR_WORKERS || '2')
        );
    }
    return imageProcessorPool;
}