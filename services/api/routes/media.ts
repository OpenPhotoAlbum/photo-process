import { Request, Response } from 'express';
import { ImageServer } from '../util/image-server';
import * as mediaResolvers from '../resolvers/media';
import path from 'path';
import { configManager } from '../util/config-manager';

export const Media = async (request: Request, response: Response) => {
    try {
        const mediaInfo = await mediaResolvers.serveMedia(request.url);
        
        if (mediaInfo.type === 'hash-based') {
            // Serve directly from processedDir/media/ using custom options
            await ImageServer.serveImage(request, response, {
                baseDir: mediaInfo.basePath || '',
                cacheDuration: 86400,
                securityCheck: true
            });
        } else if (mediaInfo.type === 'processed') {
            // File exists in processed directory (face images, thumbnails, etc.)
            await ImageServer.serveProcessedMedia(request, response);
        } else if (mediaInfo.type === 'source') {
            // File exists in source directory (original photos)
            await ImageServer.serveSourceMedia(request, response);
        }
    } catch (error) {
        const status = (error as any).status || 500;
        response.status(status).json({ 
            error: error instanceof Error ? error.message : 'Media serving failed' 
        });
    }
}

// Map proxy endpoint - fetch and stitch OpenStreetMap tiles
export const MapProxy = async (request: Request, response: Response) => {
    try {
        const result = await mediaResolvers.generateMapProxy(request.query);
        
        response.setHeader('Content-Type', result.contentType);
        response.setHeader('Cache-Control', result.cacheControl);
        response.send(result.buffer);
    } catch (error) {
        console.error('Map proxy error:', error);
        response.status(500).json({ 
            error: error instanceof Error ? error.message : 'Map generation failed' 
        });
    }
}
