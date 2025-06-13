import { Request, Response } from 'express';
import { ImageServer } from '../util/image-server';
import fs from 'fs';
import path from 'path';
import config from '../util/config';

export const Media = async (request: Request, response: Response) => {
    // Get the requested path from URL
    const urlPath = request.url.split('?')[0];
    const requestedPath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
    
    // Build full paths for both directories
    const processedPath = path.join(config.mediaDestDir, requestedPath);
    const sourcePath = path.join(config.mediaSourceDir, requestedPath);
    
    // Check which directory has the file and serve from there
    if (fs.existsSync(processedPath)) {
        // File exists in processed directory (face images, thumbnails, etc.)
        await ImageServer.serveProcessedMedia(request, response);
    } else if (fs.existsSync(sourcePath)) {
        // File exists in source directory (original photos)
        await ImageServer.serveSourceMedia(request, response);
    } else {
        // File not found in either directory
        response.status(404).json({ error: 'File not found' });
    }
}
