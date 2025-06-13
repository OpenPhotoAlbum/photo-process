import path from 'node:path';
import fs from 'fs';

import { dominantColorFromImage } from './image';
import { exifFromImage } from './exif';
import { extractFaces } from './compreface';
import { detectObjects, filterByConfidence } from './object-detection';
import { ScreenshotDetector } from './screenshot-detector';

export const getImageMetaFilename = (imagepath: string, dest: string): string => {
    // Create a relative path structure under dest directory
    const relativePath = path.relative('/mnt/sg1/uploads/stephen/iphone', imagepath);
    const filename = `${dest}/${path.dirname(relativePath)}/meta/${path.basename(imagepath, path.extname(imagepath))}${path.extname(imagepath)}.json`;
    return filename;
};

export const generateImageDataJson = async (imagepath: string, dest: string): Promise<string> => {
    const [exif, dominantColor, faces, allObjects] = await Promise.all([
        exifFromImage(imagepath),
        dominantColorFromImage(imagepath),
        extractFaces(imagepath, dest),
        detectObjects(imagepath)
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
