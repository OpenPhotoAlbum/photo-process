import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { configManager } from './config-manager';

/**
 * Hash-Based File Management Utilities
 * 
 * Provides utilities for content-based file hashing, organized directory structure,
 * and secure path management without exposing machine directory structure.
 */

export interface HashFileInfo {
    hash: string;
    shortHash: string;
    hashedFilename: string;
    relativePath: string;
    fullPath: string;
    size: number;
}

export interface FileOrganizerConfig {
    useHash: boolean;
    dateFormat: 'YYYY/MM' | 'YYYY/MM/DD' | 'YYYY';
    preserveOriginalName: boolean;
}

export class HashManager {
    private static readonly DEFAULT_CONFIG: FileOrganizerConfig = {
        useHash: true,
        dateFormat: 'YYYY/MM',
        preserveOriginalName: true
    };

    /**
     * Calculate SHA-256 hash of file content
     */
    static async calculateFileHash(filePath: string): Promise<string> {
        const fileBuffer = await fs.readFile(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    }

    /**
     * Calculate hash from buffer (for in-memory content)
     */
    static calculateBufferHash(buffer: Buffer): string {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * Generate unique filename with content hash
     */
    static generateHashedFilename(originalFilename: string, hash: string, shortHash = true): string {
        const ext = path.extname(originalFilename);
        const baseName = path.basename(originalFilename, ext);
        const hashToUse = shortHash ? hash.substring(0, 8) : hash;
        
        // Sanitize base name (remove special characters, limit length)
        const sanitizedBaseName = baseName
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 50); // Limit length
            
        return `${sanitizedBaseName}_${hashToUse}${ext}`;
    }

    /**
     * Generate organized directory path based on date
     */
    static getOrganizedPath(dateTaken: Date | string | null, config = HashManager.DEFAULT_CONFIG): string {
        let date: Date;
        
        if (dateTaken) {
            date = new Date(dateTaken);
            // Check if the date is valid
            if (isNaN(date.getTime())) {
                console.warn(`Invalid date provided for organization: ${dateTaken}, using current date`);
                date = new Date();
            }
        } else {
            date = new Date();
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        switch (config.dateFormat) {
            case 'YYYY/MM/DD':
                return `${year}/${month}/${day}`;
            case 'YYYY':
                return `${year}`;
            case 'YYYY/MM':
            default:
                return `${year}/${month}`;
        }
    }

    /**
     * Generate complete file organization info
     */
    static async generateFileInfo(
        originalPath: string, 
        dateTaken: Date | string | null = null,
        config = HashManager.DEFAULT_CONFIG
    ): Promise<HashFileInfo> {
        // Calculate hash and get file size
        const [hash, stats] = await Promise.all([
            HashManager.calculateFileHash(originalPath),
            fs.stat(originalPath)
        ]);

        const shortHash = hash.substring(0, 8);
        const originalFilename = path.basename(originalPath);
        const hashedFilename = HashManager.generateHashedFilename(originalFilename, hash, true);
        
        // Generate organized directory structure
        const organizedDir = HashManager.getOrganizedPath(dateTaken, config);
        const relativePath = path.join(organizedDir, hashedFilename);
        
        // Get full path in processed directory
        const processedDir = configManager.getStorage().processedDir;
        const fullPath = path.join(processedDir, 'media', relativePath);

        return {
            hash,
            shortHash,
            hashedFilename,
            relativePath,
            fullPath,
            size: stats.size
        };
    }

    /**
     * Generate paths for related files (media, faces, thumbnails)
     * Metadata is now stored in database only
     */
    static generateRelatedPaths(fileInfo: HashFileInfo): {
        media: string;
        thumbnail: string;
        faceDir: string;
    } {
        const { hashedFilename, relativePath } = fileInfo;
        const dir = path.dirname(relativePath);
        const ext = path.extname(hashedFilename);
        const baseName = path.basename(hashedFilename, ext);

        return {
            media: relativePath,
            thumbnail: path.join(dir, `${baseName}_thumb${ext}`),
            faceDir: baseName // Face files will be named: {baseName}__face_0.jpg, etc.
        };
    }

    /**
     * Generate face filename with hash base
     */
    static generateFaceFilename(hashedFilename: string, faceIndex: number): string {
        const ext = path.extname(hashedFilename);
        const baseName = path.basename(hashedFilename, ext);
        return `${baseName}__face_${faceIndex}${ext}`;
    }

    /**
     * Check if file with same hash already exists
     */
    static async findDuplicateByHash(hash: string): Promise<any | null> {
        const { db } = await import('../models/database');
        return await db('images').where('file_hash', hash).first();
    }

    /**
     * Ensure directory structure exists
     */
    static async ensureDirectoryStructure(relativePath: string): Promise<void> {
        const processedDir = configManager.getStorage().processedDir;
        const fullDir = path.dirname(path.join(processedDir, 'media', relativePath));
        await fs.mkdir(fullDir, { recursive: true });
        
        // Also ensure thumbnails directory exists (meta directory no longer needed)
        const thumbDir = path.dirname(path.join(processedDir, 'thumbnails', relativePath));
        await fs.mkdir(thumbDir, { recursive: true });
    }

    /**
     * Copy file to organized structure
     */
    static async copyToOrganized(originalPath: string, fileInfo: HashFileInfo): Promise<void> {
        await HashManager.ensureDirectoryStructure(fileInfo.relativePath);
        await fs.copyFile(originalPath, fileInfo.fullPath);
    }

    /**
     * Verify file integrity using hash
     */
    static async verifyFileIntegrity(filePath: string, expectedHash: string): Promise<boolean> {
        try {
            const actualHash = await HashManager.calculateFileHash(filePath);
            return actualHash === expectedHash;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get media URL for API responses (relative to media root)
     */
    static getMediaUrl(relativePath: string): string {
        return `/media/${relativePath}`;
    }

    /**
     * Get thumbnail URL for API responses
     */
    static getThumbnailUrl(relativePath: string): string {
        const dir = path.dirname(relativePath);
        const ext = path.extname(relativePath);
        const baseName = path.basename(relativePath, ext);
        const thumbPath = path.join(dir, `${baseName}_thumb${ext}`);
        return `/thumbnails/${thumbPath}`;
    }

    /**
     * Get face URL for API responses
     */
    static getFaceUrl(hashedFilename: string, faceIndex: number): string {
        const faceFilename = HashManager.generateFaceFilename(hashedFilename, faceIndex);
        return `/processed/faces/${faceFilename}`;
    }
}

export default HashManager;