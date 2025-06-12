import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const MEDIA_DEST_DIR = process.env.media_dest_dir || '';

interface PhotoData {
    filename: string;
    metadataPath: string;
    faces: string[];
    metadata?: any;
}

const getProcessedPhotos = (): PhotoData[] => {
    const photos: PhotoData[] = [];
    
    if (!fs.existsSync(MEDIA_DEST_DIR)) {
        return photos;
    }

    // Scan for meta directories
    const scanForMeta = (dir: string): void => {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            
            if (item.isDirectory()) {
                if (item.name === 'meta') {
                    // Found a meta directory, scan for JSON files
                    const metaFiles = fs.readdirSync(fullPath);
                    
                    for (const metaFile of metaFiles) {
                        if (metaFile.endsWith('.json')) {
                            const metadataPath = path.join(fullPath, metaFile);
                            const facesDir = path.join(path.dirname(fullPath), 'faces');
                            
                            // Find corresponding face images
                            const baseFilename = metaFile.replace('.json', '');
                            const faces: string[] = [];
                            
                            if (fs.existsSync(facesDir)) {
                                const faceFiles = fs.readdirSync(facesDir);
                                for (const faceFile of faceFiles) {
                                    if (faceFile.startsWith(baseFilename.replace(/\.[^/.]+$/, '') + '__face_')) {
                                        faces.push(path.join(facesDir, faceFile));
                                    }
                                }
                            }
                            
                            photos.push({
                                filename: baseFilename,
                                metadataPath,
                                faces
                            });
                        }
                    }
                } else {
                    // Recursively scan subdirectories
                    scanForMeta(fullPath);
                }
            }
        }
    };

    scanForMeta(MEDIA_DEST_DIR);
    return photos.sort((a, b) => a.filename.localeCompare(b.filename));
};

export const GalleryListResolver = async (request: Request, response: Response) => {
    try {
        const photos = getProcessedPhotos();
        response.json({
            count: photos.length,
            photos: photos.map(photo => ({
                filename: photo.filename,
                metadataPath: photo.metadataPath.replace(MEDIA_DEST_DIR, ''),
                faceCount: photo.faces.length,
                faces: photo.faces.map(face => face.replace(MEDIA_DEST_DIR, ''))
            }))
        });
    } catch (error) {
        console.error('Error getting photo list:', error);
        response.status(500).json({ error: 'Failed to get photo list' });
    }
};

export const PhotoMetadataResolver = async (request: Request, response: Response) => {
    try {
        const photoPath = request.params[0];
        const fullPath = path.join(MEDIA_DEST_DIR, photoPath);
        
        if (!fs.existsSync(fullPath)) {
            return response.status(404).json({ error: 'Photo metadata not found' });
        }
        
        const metadata = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        response.json(metadata);
    } catch (error) {
        console.error('Error getting photo metadata:', error);
        response.status(500).json({ error: 'Failed to get photo metadata' });
    }
};