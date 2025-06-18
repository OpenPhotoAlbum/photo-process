import { Request, Response } from 'express';
import { ImageServer } from '../util/image-server';
import fs from 'fs';
import path from 'path';
import { configManager } from '../util/config-manager';
import { ImageRepository } from '../models/database';
import { HashManager } from '../util/hash-manager';

export const Media = async (request: Request, response: Response) => {
    // Get the requested path from URL
    const urlPath = request.url.split('?')[0];
    const requestedPath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
    
    // Check if this is a hash-based media request (starts with YYYY/MM/ pattern)
    const hashBasedPattern = /^(\d{4}\/\d{2}\/.+)$/;
    const isHashBased = hashBasedPattern.test(requestedPath);
    
    if (isHashBased) {
        // Hash-based media serving - files are stored in processedDir/media/
        const processedDir = configManager.getStorage().processedDir;
        const mediaPath = path.join(processedDir, 'media', requestedPath);
        
        if (fs.existsSync(mediaPath)) {
            // Serve directly from processedDir/media/ using custom options
            await ImageServer.serveImage(request, response, {
                baseDir: path.join(processedDir, 'media'),
                cacheDuration: 86400,
                securityCheck: true
            });
        } else {
            response.status(404).json({ error: 'Hash-based media file not found' });
        }
    } else {
        // Legacy media serving
        const processedPath = path.join(configManager.getStorage().processedDir, requestedPath);
        const sourcePath = path.join(configManager.getStorage().sourceDir, requestedPath);
        
        // Check which directory has the file and serve from there
        if (fs.existsSync(processedPath)) {
            // File exists in processed directory (face images, thumbnails, etc.)
            await ImageServer.serveProcessedMedia(request, response);
        } else if (fs.existsSync(sourcePath)) {
            // File exists in source directory (original photos)
            await ImageServer.serveSourceMedia(request, response);
        } else {
            response.status(404).json({ error: 'Legacy media file not found' });
        }
    }
}

// Map proxy endpoint - return a simple text placeholder for now
export const MapProxy = async (request: Request, response: Response) => {
    try {
        const { lat, lon } = request.query;
        
        if (!lat || !lon) {
            return response.status(400).json({ error: 'Missing lat or lon parameters' });
        }
        
        const latNum = parseFloat(lat as string);
        const lonNum = parseFloat(lon as string);
        
        if (isNaN(latNum) || isNaN(lonNum)) {
            return response.status(400).json({ error: 'Invalid lat or lon values' });
        }
        
        // For now, just return coordinates info as JSON
        // We can work on a better map solution later
        response.json({
            message: 'Map preview not yet implemented',
            coordinates: {
                latitude: latNum,
                longitude: lonNum
            },
            suggestion: 'Click coordinates to open in Google Maps'
        });
        
    } catch (error) {
        console.error('Map proxy error:', error);
        response.status(500).json({ error: 'Internal server error' });
    }
}
