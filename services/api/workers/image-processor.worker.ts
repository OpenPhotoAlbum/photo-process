import { parentPort, workerData } from 'worker_threads';
import { generateImageDataJsonHashed, storeImageDataHashed } from '../util/process-source';
import { HashManager } from '../util/hash-manager';
import { Logger } from '../logger';
import fs from 'fs';

// Configure logger for worker thread
const logger = Logger.getInstance('worker');

interface WorkerMessage {
    type: 'process' | 'shutdown';
    filePath?: string;
    dateTaken?: Date;
    taskId?: string;
}

interface WorkerResult {
    taskId: string;
    success: boolean;
    imageId?: number;
    error?: string;
    duplicate?: boolean;
}

// Handle messages from main thread
parentPort?.on('message', async (message: WorkerMessage) => {
    if (message.type === 'shutdown') {
        process.exit(0);
    }

    if (message.type === 'process' && message.filePath && message.taskId) {
        const result: WorkerResult = {
            taskId: message.taskId,
            success: false
        };

        try {
            logger.info(`[Worker] Processing: ${message.filePath}`);
            
            // Process the image
            const { fileInfo, processingResults } = await generateImageDataJsonHashed(
                message.filePath, 
                message.dateTaken
            );
            
            // Store in database
            const imageId = await storeImageDataHashed(
                message.filePath, 
                fileInfo, 
                processingResults
            );
            
            result.success = true;
            result.imageId = imageId;
            
            logger.info(`[Worker] Completed: ${message.filePath} (ID: ${imageId})`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Handle duplicates as successful
            if (errorMessage.includes('Duplicate file detected')) {
                logger.info(`[Worker] Duplicate detected: ${message.filePath}`);
                result.success = true;
                result.duplicate = true;
            } else {
                logger.error(`[Worker] Failed: ${message.filePath}`, error);
                result.success = false;
                result.error = errorMessage;
            }
        }

        // Send result back to main thread
        parentPort?.postMessage(result);
    }
});

// Signal that worker is ready
parentPort?.postMessage({ type: 'ready' });

logger.info('[Worker] Image processor worker started');