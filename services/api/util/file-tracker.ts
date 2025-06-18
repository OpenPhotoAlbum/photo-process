import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';
import { Logger } from '../logger';
import { configManager } from './config-manager';
import knex from '../conn';

const logger = Logger.getInstance();

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
    private readonly supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];

    /**
     * Initialize the file tracker with database scanning
     */
    async initialize(): Promise<void> {
        logger.info('🔍 Initializing File Tracker...');
        
        // Run initial database scan to catch existing files
        await this.performInitialScan();
        
        logger.info('✅ File Tracker initialized successfully');
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
        logger.info('📂 Starting initial file system scan...');
        
        try {
            const sourceDir = configManager.getStorage().sourceDir;
            const startTime = Date.now();
            let scannedCount = 0;
            let newCount = 0;

            await this.scanDirectory(sourceDir, async (filePath: string, stats: fs.Stats) => {
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
     * Scan directory recursively
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
                    logger.info(`🔄 Updated modified file in index: ${filePath}`);
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
            
            logger.info(`📝 Added new file to index: ${filePath}`);
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
            logger.info(`🗑️ Removed file from index: ${filePath}`);
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

}

// Singleton instance
export const fileTracker = new FileTracker();