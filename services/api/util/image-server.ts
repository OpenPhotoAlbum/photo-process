import { Request, Response } from 'express';
import mime from 'mime-types';
import fs from 'fs';
import path from 'path';
import { Image } from './image';
import { configManager } from './config-manager';
import { ImageRepository } from '../models/database';

export interface ImageServerOptions {
    /** Base directory to serve from */
    baseDir: string;
    /** Cache duration in seconds (default: 86400 = 24 hours) */
    cacheDuration?: number;
    /** Whether to allow directory traversal protection (default: true) */
    securityCheck?: boolean;
    /** Default thumbnail size (default: 200) */
    thumbnailSize?: number;
}

export class ImageServer {
    /**
     * Serve images with thumbnail support and caching
     * Consolidates the logic from media.ts and processed.ts
     */
    static async serveImage(
        req: Request, 
        res: Response, 
        options: ImageServerOptions
    ): Promise<void> {
        try {
            const { 
                baseDir, 
                cacheDuration = 86400, 
                securityCheck = true,
                thumbnailSize = 200
            } = options;
            
            const { thumb } = req.query;
            
            // Get the requested path from URL
            // For app.use('/media', handler), req.url contains the remaining path after /media
            // Remove query parameters if they exist
            const urlPath = req.url.split('?')[0];
            const requestedPath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
            
            // Security check - prevent directory traversal
            if (securityCheck && requestedPath.includes('..')) {
                res.status(400).json({ error: 'Invalid path' });
                return;
            }
            
            // Build full path
            const fullPath = path.isAbsolute(requestedPath) 
                ? requestedPath 
                : path.join(baseDir, requestedPath);
            
            // Check if file exists
            if (!fs.existsSync(fullPath)) {
                res.status(404).json({ error: 'File not found' });
                return;
            }
            
            let buffer: Buffer;
            
            if (thumb) {
                // Try to serve pre-generated thumbnail first
                const thumbnailPath = await this.findPreGeneratedThumbnail(fullPath);
                
                if (thumbnailPath && fs.existsSync(thumbnailPath)) {
                    // Serve pre-generated thumbnail
                    buffer = fs.readFileSync(thumbnailPath);
                } else {
                    // Fall back to on-demand thumbnail generation
                    const image = Image(fullPath);
                    image.resize(thumbnailSize);
                    buffer = await image.toBuffer();
                }
            } else {
                // Serve full-size image
                buffer = fs.readFileSync(fullPath);
            }
            
            // Get MIME type
            const mimetype = mime.lookup(fullPath) || 'application/octet-stream';
            
            // Calculate cache expiry
            const expiry_time = Date.now() + cacheDuration * 1000;
            
            // Set headers
            const headers = {
                "Content-Type": mimetype,
                "Cache-Control": `public, max-age=${cacheDuration}`,
                "Content-Length": buffer.length,
                "Expires": new Date(expiry_time).toUTCString(),
            };
            
            res.set(headers).status(200).send(buffer);
            
        } catch (error) {
            console.error('Error serving image:', error);
            res.status(500).json({ error: 'Failed to serve image' });
        }
    }
    
    /**
     * Serve source media images (from storage.sourceDir)
     */
    static async serveSourceMedia(req: Request, res: Response): Promise<void> {
        await ImageServer.serveImage(req, res, {
            baseDir: configManager.getStorage().sourceDir,
            cacheDuration: 9999, // Match original media.ts behavior
            securityCheck: false, // Original media.ts didn't have security check
        });
    }
    
    /**
     * Serve processed media images (from storage.processedDir) 
     */
    static async serveProcessedMedia(req: Request, res: Response): Promise<void> {
        await ImageServer.serveImage(req, res, {
            baseDir: configManager.getStorage().processedDir,
            cacheDuration: 86400, // 24 hours - match original processed.ts
            securityCheck: true, // Original processed.ts had security check
        });
    }
    
    /**
     * Find pre-generated thumbnail path for a given image path
     */
    private static async findPreGeneratedThumbnail(imagePath: string): Promise<string | null> {
        try {
            // Look up image in database by path
            const image = await ImageRepository.findByPath(imagePath);
            
            if (image && image.thumbnail_path) {
                return image.thumbnail_path;
            }
            
            return null;
        } catch (error) {
            console.warn('Error looking up thumbnail path:', error);
            return null;
        }
    }
}