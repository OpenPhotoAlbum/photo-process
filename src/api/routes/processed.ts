import dotenv from 'dotenv';
import mime from 'mime-types';
import fs from 'fs';
import path from 'path';
import { Image } from '../util/image';
import { Request, Response } from 'express';

dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const MEDIA_DEST_DIR = process.env.media_dest_dir || '';

export const ProcessedMedia = async (request: Request, response: Response) => {
    try {
        const { thumb } = request.query;
        const requestedPath = request.params[0];
        
        // Security check - prevent directory traversal
        if (requestedPath.includes('..')) {
            return response.status(400).json({ error: 'Invalid path' });
        }
        
        const fullPath = path.join(MEDIA_DEST_DIR, requestedPath);
        
        if (!fs.existsSync(fullPath)) {
            return response.status(404).json({ error: 'File not found' });
        }
        
        const image = Image(fullPath);
        
        if (thumb) {
            image.resize(200);
        }
        
        const buffer = await image.toBuffer();
        const mimetype = mime.lookup(fullPath) || 'application/octet-stream';
        const expiry_time = Date.now() + 86400 * 1000; // 24 hours
        
        const headers = {
            "Content-Type": mimetype,
            "Cache-Control": `public, max-age=86400`,
            "Content-Length": buffer.length,
            Expires: new Date(expiry_time).toUTCString(),
        };
        
        response.set(headers).status(200).send(buffer);
    } catch (error) {
        console.error('Error serving processed media:', error);
        response.status(500).json({ error: 'Failed to serve image' });
    }
};