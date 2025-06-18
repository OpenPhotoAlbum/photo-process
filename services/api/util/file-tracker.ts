import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';
import { Logger } from '../logger';
import { configManager } from './config-manager';
import knex from '../conn';

const logger = Logger.getInstance();
const fileTrackerLogger = Logger.getInstance('file-tracker');

export interface FileIndexRecord {
    file_path: string;
    file_size: number;
    file_mtime: Date;
    file_hash?: string;
    discovered_at: Date;
    processing_status: 'pending' | 'processing' | 'completed' | 'failed';
    last_processed?: Date;
    retry_count: number;
    error_message?: string;
}

export class FileTracker {
    private isScanning = false;
    private isInitialized = false;
    private readonly supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];

    /**
     * Initialize the file tracker with database scanning
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.info('🔍 File Tracker already initialized, skipping scan');
            return;
        }
        
        logger.info('🔍 Initializing File Tracker...');
        this.isInitialized = true;
        
        // Only run initial scan if there are no files in the index
        const stats = await this.getStats();
        const totalFiles = stats.pending + stats.processing + stats.completed + stats.failed;
        
        if (totalFiles === 0) {
            logger.info('📂 File index is empty, performing initial scan...');
            // Run initial database scan in background (non-blocking)
            this.performInitialScanBackground();
        } else {
            logger.info(`✅ File Tracker initialized with ${totalFiles} files already indexed`);
        }
    }

    /**
     * Perform initial scan of source directories to populate file_index (background, non-blocking)
     */
    private performInitialScanBackground(): void {
        if (this.isScanning) {
            logger.warn('Initial scan already in progress, skipping...');
            return;
        }

        // Run scan in background without blocking
        setImmediate(async () => {
            await this.performInitialScan();
        });
    }

    /**
     * Perform initial scan of source directories to populate file_index
     */
    async performInitialScan(): Promise<void> {
        if (this.isScanning) {
            logger.warn('Initial scan already in progress, skipping...');
            return;
        }

        this.isScanning = true;
        logger.info('📂 Starting initial file system scan (background)...');
        
        try {
            const sourceDir = configManager.getStorage().sourceDir;
            const startTime = Date.now();
            let scannedCount = 0;
            let newCount = 0;

            await this.scanDirectoryNonBlocking(sourceDir, async (filePath: string, stats: fs.Stats) => {
                scannedCount++;
                
                const isNew = await this.addFileToIndex(filePath, stats);
                if (isNew) newCount++;
                
                // Log progress every 100 files
                if (scannedCount % 100 === 0) {
                    logger.info(`📊 Scanned ${scannedCount} files, found ${newCount} new files`);
                }
            });

            const duration = Date.now() - startTime;
            logger.info(`✅ Initial scan completed: ${scannedCount} files scanned, ${newCount} new files added in ${duration}ms`);
        } catch (error) {
            logger.error('❌ Initial scan failed:', error);
        } finally {
            this.isScanning = false;
        }
    }


    /**
     * Get pending files for processing
     */
    async getPendingFiles(limit: number = 100): Promise<FileIndexRecord[]> {
        try {
            const files = await knex('file_index')
                .select('*')
                .where('processing_status', 'pending')
                .orderBy('discovered_at', 'asc')
                .limit(limit);
            
            return files;
        } catch (error) {
            logger.error('❌ Failed to get pending files:', error);
            return [];
        }
    }

    /**
     * Mark file as processing
     */
    async markFileAsProcessing(filePath: string): Promise<void> {
        try {
            await knex('file_index')
                .where('file_path', filePath)
                .update({
                    processing_status: 'processing',
                    last_processed: new Date()
                });
        } catch (error) {
            logger.error(`❌ Failed to mark file as processing: ${filePath}`, error);
        }
    }

    /**
     * Mark file as completed
     */
    async markFileAsCompleted(filePath: string, fileHash?: string): Promise<void> {
        try {
            const updateData: any = {
                processing_status: 'completed',
                last_processed: new Date(),
                error_message: null
            };
            
            if (fileHash) {
                updateData.file_hash = fileHash;
            }

            await knex('file_index')
                .where('file_path', filePath)
                .update(updateData);
        } catch (error) {
            logger.error(`❌ Failed to mark file as completed: ${filePath}`, error);
        }
    }

    /**
     * Mark file as failed
     */
    async markFileAsFailed(filePath: string, errorMessage: string): Promise<void> {
        try {
            await knex('file_index')
                .where('file_path', filePath)
                .update({
                    processing_status: 'failed',
                    last_processed: new Date(),
                    error_message: errorMessage,
                    retry_count: knex.raw('retry_count + 1')
                });
        } catch (error) {
            logger.error(`❌ Failed to mark file as failed: ${filePath}`, error);
        }
    }

    /**
     * Get processing statistics
     */
    async getStats(): Promise<any> {
        try {
            const stats = await knex('file_index')
                .select('processing_status')
                .count('* as count')
                .groupBy('processing_status');
            
            const result: any = {
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0
            };
            
            stats.forEach((stat: any) => {
                result[stat.processing_status] = parseInt(stat.count as string);
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to get stats:', error);
            return { pending: 0, processing: 0, completed: 0, failed: 0 };
        }
    }

    /**
     * Scan directory recursively (legacy method, kept for compatibility)
     */
    private async scanDirectory(dirPath: string, fileCallback: (filePath: string, stats: fs.Stats) => Promise<void>): Promise<void> {
        try {
            const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    await this.scanDirectory(fullPath, fileCallback);
                } else if (entry.isFile() && this.isSupportedImageFile(fullPath)) {
                    const stats = await fsPromises.stat(fullPath);
                    await fileCallback(fullPath, stats);
                }
            }
        } catch (error) {
            logger.error(`❌ Failed to scan directory: ${dirPath}`, error);
        }
    }

    /**
     * Scan directory recursively with non-blocking behavior
     */
    private async scanDirectoryNonBlocking(dirPath: string, fileCallback: (filePath: string, stats: fs.Stats) => Promise<void>, fileCount = { count: 0 }): Promise<void> {
        try {
            const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    await this.scanDirectoryNonBlocking(fullPath, fileCallback, fileCount);
                } else if (entry.isFile() && this.isSupportedImageFile(fullPath)) {
                    const stats = await fsPromises.stat(fullPath);
                    await fileCallback(fullPath, stats);
                    fileCount.count++;
                    
                    // Yield control to event loop every 50 files to prevent blocking
                    if (fileCount.count % 50 === 0) {
                        await new Promise(resolve => setImmediate(resolve));
                    }
                }
            }
        } catch (error) {
            logger.error(`❌ Failed to scan directory: ${dirPath}`, error);
        }
    }

    /**
     * Add file to index if not already present
     */
    private async addFileToIndex(filePath: string, stats: fs.Stats): Promise<boolean> {
        try {
            // Check if file already exists
            const existing = await knex('file_index')
                .select('file_path', 'file_mtime', 'file_size')
                .where('file_path', filePath)
                .first();
            
            if (existing) {
                // Check if file has been modified
                const existingMtime = new Date(existing.file_mtime).getTime();
                const currentMtime = stats.mtime.getTime();
                
                if (existingMtime !== currentMtime || existing.file_size !== stats.size) {
                    // File has been modified, reset to pending
                    await knex('file_index')
                        .where('file_path', filePath)
                        .update({
                            file_size: stats.size,
                            file_mtime: stats.mtime,
                            processing_status: 'pending',
                            file_hash: null,
                            retry_count: 0,
                            error_message: null
                        });
                    fileTrackerLogger.info(`🔄 Updated modified file in index: ${filePath}`);
                    return true;
                }
                return false; // File unchanged
            }
            
            // Add new file
            await knex('file_index').insert({
                file_path: filePath,
                file_size: stats.size,
                file_mtime: stats.mtime,
                discovered_at: new Date(),
                processing_status: 'pending',
                retry_count: 0
            });
            
            fileTrackerLogger.info(`📝 Added new file to index: ${filePath}`);
            return true;
        } catch (error) {
            logger.error(`❌ Failed to add file to index: ${filePath}`, error);
            return false;
        }
    }

    /**
     * Remove file from index
     */
    private async removeFileFromIndex(filePath: string): Promise<void> {
        try {
            await knex('file_index').where('file_path', filePath).del();
            fileTrackerLogger.info(`🗑️ Removed file from index: ${filePath}`);
        } catch (error) {
            logger.error(`❌ Failed to remove file from index: ${filePath}`, error);
        }
    }

    /**
     * Check if file is a supported image format
     */
    private isSupportedImageFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedExtensions.includes(ext);
    }

    /**
     * Perform incremental scan for new files only (much faster)
     * This could be called periodically or on-demand
     */
    async performIncrementalScan(): Promise<{ newFiles: number }> {
        if (this.isScanning) {
            logger.warn('Scan already in progress, skipping incremental scan');
            return { newFiles: 0 };
        }

        logger.info('🔍 Starting incremental scan for new files...');
        
        // For now, we'll just return existing stats
        // In the future, this could use file watching or other efficient methods
        const stats = await this.getStats();
        logger.info(`📁 Current file index: ${stats.pending} pending, ${stats.completed} completed`);
        
        return { newFiles: 0 };
    }

}

// Singleton instance
export const fileTracker = new FileTracker();