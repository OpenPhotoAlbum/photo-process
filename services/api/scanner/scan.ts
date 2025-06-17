import fs, { promises } from 'fs'
import { resolve } from 'path';
import { readdir } from 'fs/promises'
import mime from 'mime-types';
import { generateImageDataJsonHashed, storeImageDataHashed } from '../util/process-source';
import { HashManager } from '../util/hash-manager';
import { ImageRepository } from '../models/database';
import { Logger } from '../logger';
import winston from 'winston';

const logger = Logger.getInstance();

const colorizer = winston.format.colorize();
const logPrefix = colorizer.colorize('info', '[SCAN]');

const blacklist_doesnt_start_with: string[] = []

const supportedMIMEtypeInput = [
    "image/jpeg",
    "image/jpg",
    "image/png"
]

export enum ScanStatus {
    NotStarted = 'NotStarted',
    InProgress = 'InProgress',
    Completed = 'Completed',
    Failed = 'Failed'
}

// Global scan state tracking
interface ScanState {
    status: ScanStatus;
    processed: number;
    totalFiles: number;
    startedAt: Date | null;
    completedAt: Date | null;
    error: string | null;
    currentFile?: string;
}

let currentScanState: ScanState = {
    status: ScanStatus.NotStarted,
    processed: 0,
    totalFiles: 0,
    startedAt: null,
    completedAt: null,
    error: null
};

const blacklist = (f:string) => blacklist_doesnt_start_with.map(i => !f.startsWith(i)).every(a => a)

const chunk = (arr: any[], size: number) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );

async function* getFiles(dir: string): any {
    try {
        const dirents = await promises.readdir(dir, { withFileTypes: true });
        for (const dirent of dirents) {
            const res = resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                try {
                    yield* getFiles(res);
                } catch (error) {
                    logger.warn(`Warning: Cannot access subdirectory ${res}: ${error instanceof Error ? error.message : error}`);
                    // Continue with other directories instead of failing
                }
            } else {
                yield res;
            }
        }
    } catch (error) {
        logger.error(`Error reading directory ${dir}: ${error instanceof Error ? error.message : error}`);
        throw error;
    }
}

const getDirectories = async (source: string) =>
    (await readdir(source, { withFileTypes: true }))
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

// Legacy run function removed - use runHashed instead

const runHashed = async (fileToScan: string): Promise<{imageId: number}> => {
    try {
        logger.info(`${colorizer.colorize('debug', '[SCAN-PROCESS]')} Starting hash-based processing: ${fileToScan}`);
        
        // Extract date from EXIF for proper organization
        let dateTaken: Date | undefined;
        try {
            const exifPreview = await import('../util/exif').then(mod => mod.exifFromImage(fileToScan));
            if (exifPreview.DateTimeOriginal) {
                const dateStr = typeof exifPreview.DateTimeOriginal === 'string' ? 
                    exifPreview.DateTimeOriginal : 
                    exifPreview.DateTimeOriginal?.toString();
                if (dateStr) {
                    dateTaken = new Date(dateStr.replace(/:(\d{2}):(\d{2})/, '-$1-$2'));
                }
            } else if (exifPreview.DateTime) {
                const dateStr = typeof exifPreview.DateTime === 'string' ? 
                    exifPreview.DateTime : 
                    exifPreview.DateTime?.toString();
                if (dateStr) {
                    dateTaken = new Date(dateStr.replace(/:(\d{2}):(\d{2})/, '-$1-$2'));
                }
            }
        } catch (error) {
            // Use file modification time as fallback
            const stats = fs.statSync(fileToScan);
            dateTaken = stats.mtime;
        }
        
        // Process with hash-based organization
        const { fileInfo, processingResults } = await generateImageDataJsonHashed(fileToScan, dateTaken);
        
        // Store in database - this now handles metadata, faces, and objects
        const imageId = await storeImageDataHashed(fileToScan, fileInfo, processingResults);
        
        // Face, object, and metadata storage is now handled in storeImageDataHashed
        
        return { imageId };
    } catch (error) {
        logger.error(`[Error processing ${fileToScan}]:`, error);
        throw error;
    }
}

// Legacy Start function removed - use StartHashed instead

/**
 * Hash-based scanner with database integration
 */
export const StartHashed = async (scanDir: string, limit?: number) => {
    // Initialize scan state
    currentScanState = {
        status: ScanStatus.InProgress,
        processed: 0,
        totalFiles: limit || 0, // Set to limit for progress tracking
        startedAt: new Date(),
        completedAt: null,
        error: null
    };

    const processed: { imageId: number }[] = [];
    const files: any[] = [];
    const errors: any[] = [];
    let found_files = 0;
    
    try {
        logger.info(`${logPrefix} Starting optimized scan with limit: ${limit || 'unlimited'}`);
        
        // Handle both directory structure and flat structure
        const dirs = await getDirectories(scanDir);
        logger.info(`${logPrefix} Found directories in ${scanDir}: ${dirs.join(', ')}`);
    
    if (dirs.length > 0) {
        // Optimized: stop when we have enough files
        outer: for (const d of dirs) {
            logger.info(`${logPrefix} Scanning directory: ${d}`);
            for await (const f of getFiles(scanDir + '/' + d)) {
                found_files++;
                
                // Log progress every 1000 files
                if (found_files % 1000 === 0) {
                    logger.info(`${logPrefix} Discovery progress: ${found_files} files checked so far, found ${files.length} images...`);
                }
                
                const mt = mime.lookup(f);
                const mimeTypeChecks = mt && supportedMIMEtypeInput.includes(mt as string)
                
                if (mimeTypeChecks && blacklist(f)) {
                    // Check if already processed immediately
                    try {
                        const hash = await HashManager.calculateFileHash(f);
                        const existing = await ImageRepository.findByHash(hash);
                        if (!existing) {
                            files.push(f);
                            logger.info(`${logPrefix} Found unprocessed file: ${f} (${files.length}/${limit || 'unlimited'})`);
                            
                            // Early exit if we have enough files
                            if (limit && files.length >= limit) {
                                logger.info(`${logPrefix} Reached limit of ${limit} files, stopping discovery`);
                                break outer;
                            }
                        }
                    } catch (error) {
                        logger.error(`Error checking hash for ${f}:`, error);
                    }
                }
            }
        }
    } else {
        // Flat directory - optimized version
        logger.info(`${logPrefix} Scanning flat directory...`);
        for await (const f of getFiles(scanDir)) {
            found_files++;
            
            // Log progress every 1000 files
            if (found_files % 1000 === 0) {
                logger.info(`${logPrefix} Discovery progress: ${found_files} files checked so far, found ${files.length} images...`);
            }
            
            const mt = mime.lookup(f);
            const mimeTypeChecks = mt && supportedMIMEtypeInput.includes(mt as string)
            
            if (mimeTypeChecks && blacklist(f)) {
                // Check if already processed immediately
                try {
                    const hash = await HashManager.calculateFileHash(f);
                    const existing = await ImageRepository.findByHash(hash);
                    if (!existing) {
                        files.push(f);
                        logger.info(`${logPrefix} Found unprocessed file: ${f} (${files.length}/${limit || 'unlimited'})`);
                        
                        // Early exit if we have enough files
                        if (limit && files.length >= limit) {
                            logger.info(`${logPrefix} Reached limit of ${limit} files, stopping discovery`);
                            break;
                        }
                    }
                } catch (error) {
                    logger.error(`Error checking hash for ${f}:`, error);
                }
            }
        }
    }

    logger.info(`${logPrefix} Discovery complete: found ${files.length} unprocessed files after checking ${found_files} total files`);
    
    // Update total files count in state
    currentScanState.totalFiles = files.length;

    if (files.length === 0) {
        logger.info(`${logPrefix} No new files to process`);
        currentScanState.status = ScanStatus.Completed;
        currentScanState.completedAt = new Date();
        return {
            processed: 0,
            successful: [],
            errors: 0,
            errorDetails: []
        };
    }

    logger.info(`${logPrefix} Starting processing phase for ${files.length} files`);
    
    // Process files in batches
    const batch = 2;
    const chunkedFiles = chunk(files, batch);

    for await (const fileChunk of chunkedFiles) {
        logger.info(`${logPrefix} Processing batch of ${fileChunk.length} files...`);
        try {
            const results = await Promise.allSettled(fileChunk.map(async (f) => {
                logger.info(`${logPrefix} Starting processing: ${f}`);
                currentScanState.currentFile = f;
                const result = await runHashed(f);
                currentScanState.processed++;
                logger.info(`${logPrefix} Completed processing: ${f} (${currentScanState.processed}/${currentScanState.totalFiles})`);
                return result;
            }));
            
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    processed.push(result.value);
                } else {
                    errors.push(result.reason);
                    logger.error('Processing failed:', result.reason);
                }
            }
        } catch (error) {
            logger.error('Error processing batch:', error);
            errors.push(error);
        }
    }

    // Complete scan state
    currentScanState.status = errors.length > 0 ? ScanStatus.Failed : ScanStatus.Completed;
    currentScanState.completedAt = new Date();
    if (errors.length > 0) {
        currentScanState.error = `${errors.length} files failed to process`;
    }

    return {
        processed: processed.length,
        successful: processed,
        errors: errors.length,
        errorDetails: errors
    };
    
    } catch (error: any) {
        // Handle overall scan failure
        currentScanState.status = ScanStatus.Failed;
        currentScanState.completedAt = new Date();
        currentScanState.error = error.message || 'Unknown scan error';
        
        logger.error('Scan failed with error:', error);
        
        return {
            processed: processed.length,
            successful: processed,
            errors: errors.length + 1,
            errorDetails: [...errors, error]
        };
    }
}

export const Status = async () => {
    const percentage = currentScanState.totalFiles > 0 ? 
        (currentScanState.processed / currentScanState.totalFiles) * 100 : 0;
    
    // Calculate ETA based on processing rate
    let eta = null;
    if (currentScanState.status === ScanStatus.InProgress && currentScanState.startedAt && currentScanState.processed > 0) {
        const elapsed = Date.now() - currentScanState.startedAt.getTime();
        const rate = currentScanState.processed / (elapsed / 1000); // files per second
        const remaining = currentScanState.totalFiles - currentScanState.processed;
        const etaSeconds = remaining / rate;
        
        if (etaSeconds > 60) {
            eta = `${Math.round(etaSeconds / 60)} minutes`;
        } else {
            eta = `${Math.round(etaSeconds)} seconds`;
        }
    }

    return {
        message: currentScanState.status,
        processed: currentScanState.processed,
        total_files: currentScanState.totalFiles,
        percentage: Math.round(percentage * 10) / 10,
        eta: eta,
        started_at: currentScanState.startedAt?.toISOString() || null,
        completed_at: currentScanState.completedAt?.toISOString() || null,
        error: currentScanState.error,
        current_file: currentScanState.currentFile
    };
}