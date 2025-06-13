import path from 'node:path';
import fs from 'fs';

import { dominantColorFromImage } from './image';
import { exifFromImage } from './exif';
import { extractFaces } from './compreface';
import { detectObjects, filterByConfidence } from './object-detection';
import { ScreenshotDetector } from './screenshot-detector';
import { Logger } from '../logger';

const logger = Logger.getInstance();

export const getImageMetaFilename = (imagepath: string, dest: string): string => {
    // Create a relative path structure under dest directory
    const relativePath = path.relative('/mnt/sg1/uploads/stephen/iphone', imagepath);
    const filename = `${dest}/${path.dirname(relativePath)}/meta/${path.basename(imagepath, path.extname(imagepath))}${path.extname(imagepath)}.json`;
    return filename;
};

export const generateImageDataJson = async (imagepath: string, dest: string): Promise<string> => {
    const processingStart = Date.now();
    const correlationId = logger.startOperation(`process-image-${path.basename(imagepath)}`);
    
    // Track individual operation timings
    const timings = {
        exif: { start: Date.now(), end: 0 },
        color: { start: Date.now(), end: 0 },
        faces: { start: Date.now(), end: 0 },
        objects: { start: Date.now(), end: 0 }
    };
    
    const [exif, dominantColor, faces, allObjects] = await Promise.all([
        exifFromImage(imagepath).then(result => {
            timings.exif.end = Date.now();
            return result;
        }),
        dominantColorFromImage(imagepath).then(result => {
            timings.color.end = Date.now();
            return result;
        }),
        extractFaces(imagepath, dest).then(result => {
            timings.faces.end = Date.now();
            return result;
        }),
        detectObjects(imagepath).then(result => {
            timings.objects.end = Date.now();
            return result;
        })
    ]);
    
    // Filter objects by confidence threshold (0.75)
    const objects = filterByConfidence(allObjects);
    
    // Perform screenshot detection
    const imageWidth = exif.ImageWidth || exif.ExifImageWidth;
    const imageHeight = exif.ImageHeight || exif.ExifImageHeight;
    const mimeType = getMimeTypeFromPath(imagepath);
    const filename = path.basename(imagepath);
    
    // Convert objects to database format for screenshot detection
    const dbObjects = objects.map(obj => ({
        image_id: 0, // Placeholder, not used in detection
        class: obj.class,
        confidence: obj.confidence,
        x: obj.bbox.x,
        y: obj.bbox.y,
        width: obj.bbox.width,
        height: obj.bbox.height
    }));
    
    const screenshotDetection = ScreenshotDetector.detectScreenshot(
        filename,
        {
            camera_make: exif.Make,
            camera_model: exif.Model,
            software: exif.Software,
            focal_length: parseNumeric(exif.FocalLength),
            aperture: exif.FNumber?.toString(),
            iso: parseNumeric(exif.ISO)
        } as any,
        dbObjects,
        imageWidth,
        imageHeight,
        mimeType
    );
    
    const outputFilename = getImageMetaFilename(imagepath, dest);

    fs.mkdirSync(path.dirname(outputFilename), { recursive: true });
    
    fs.writeFileSync(outputFilename, JSON.stringify({
        exif, 
        dominantColor, 
        people: faces,
        objects: objects,
        screenshotDetection: screenshotDetection
    }, null, 2), {});
    
    // Log the completed processing with detailed metrics
    const processingTime = Date.now() - processingStart;
    logger.logImageProcessed({
        imagePath: imagepath,
        processingTime,
        operations: {
            exif: { 
                success: true, 
                duration: timings.exif.end - timings.exif.start 
            },
            thumbnail: { 
                success: true, 
                duration: 0 // Thumbnail generation happens separately
            },
            faceDetection: { 
                success: true, 
                faces: Object.keys(faces).length,
                duration: timings.faces.end - timings.faces.start 
            },
            objectDetection: { 
                success: true, 
                objects: objects.length,
                duration: timings.objects.end - timings.objects.start 
            }
        },
        output: {
            metadataPath: outputFilename,
            thumbnailPath: '', // Set by thumbnail generation
            faceCount: Object.keys(faces).length
        }
    });
    
    correlationId.end({ processingTime, faceCount: Object.keys(faces).length, objectCount: objects.length });
    
    return outputFilename;
};

// Helper functions
function getMimeTypeFromPath(filepath: string): string {
    const ext = path.extname(filepath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

function parseNumeric(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}
