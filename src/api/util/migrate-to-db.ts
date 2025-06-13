import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ImageRepository, FaceRepository, MetadataRepository, ObjectRepository, Image, DetectedFace, ImageMetadata, DetectedObject } from '../models/database';
import { config } from '../../config';

interface ProcessedPhotoData {
    exif: any;
    dominantColor: string;
    people: Record<string, any>;
    objects?: any[];
    screenshotDetection?: {
        isScreenshot: boolean;
        confidence: number;
        reasons: string[];
    };
}

export class DataMigrator {
    
    static async migrateProcessedData(
        sourceDir: string, 
        destDir: string,
        progressCallback?: (progress: number, message?: string) => void
    ): Promise<void> {
        console.log('Starting data migration to database...');
        
        const metaDir = path.join(destDir, 'recents', 'meta');
        const facesDir = path.join(destDir, 'recents', 'faces');
        
        if (!fs.existsSync(metaDir)) {
            throw new Error(`Metadata directory not found: ${metaDir}`);
        }
        
        const metadataFiles = fs.readdirSync(metaDir)
            .filter(file => file.endsWith('.json'));
        
        console.log(`Found ${metadataFiles.length} metadata files to process`);
        
        let processed = 0;
        let errors = 0;
        let actuallyProcessed = 0;
        
        for (const metaFile of metadataFiles) {
            try {
                const wasProcessed = await this.processMetadataFile(metaFile, sourceDir, destDir, metaDir, facesDir);
                processed++;
                if (wasProcessed) actuallyProcessed++;
                
                if (processed % 10 === 0) {
                    console.log(`Processed ${processed}/${metadataFiles.length} files...`);
                    if (progressCallback) {
                        const progress = processed / metadataFiles.length;
                        progressCallback(progress, `Migrated ${actuallyProcessed} new images (${processed}/${metadataFiles.length} checked)`);
                    }
                }
            } catch (error) {
                console.error(`Error processing ${metaFile}:`, error);
                errors++;
            }
        }
        
        console.log(`Migration completed: ${actuallyProcessed} new images processed, ${processed - actuallyProcessed} already existed, ${errors} errors`);
    }
    
    static async processMetadataFile(
        metaFile: string, 
        sourceDir: string, 
        destDir: string, 
        metaDir: string, 
        facesDir: string
    ): Promise<boolean> {
        // Read metadata JSON
        const metaPath = path.join(metaDir, metaFile);
        const metadataJson: ProcessedPhotoData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        
        // Extract original filename from metadata filename
        const originalFilename = metaFile.replace('.json', '');
        const originalPath = path.join(sourceDir, 'recents', originalFilename);
        
        // Check if original file exists
        if (!fs.existsSync(originalPath)) {
            console.warn(`Original file not found: ${originalPath}`);
            return false;
        }
        
        // First check if image already exists by path (much faster than hash)
        const existingImageByPath = await ImageRepository.findByPath(originalPath);
        if (existingImageByPath) {
            console.log(`Image already exists in database (by path): ${originalFilename}`);
            return false;
        }
        
        // Calculate file hash for deduplication only if not found by path
        const fileBuffer = fs.readFileSync(originalPath);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        
        // Check if image already exists by hash (for duplicates with different paths)
        const existingImageByHash = await ImageRepository.findByHash(fileHash);
        if (existingImageByHash) {
            console.log(`Image already exists in database (by hash): ${originalFilename}`);
            return false;
        }
        
        // Create image record
        const imageData: Omit<Image, 'id'> = {
            filename: originalFilename,
            original_path: originalPath,
            processed_path: metaPath,
            file_hash: fileHash,
            file_size: fileBuffer.length,
            mime_type: this.getMimeType(originalFilename),
            width: metadataJson.exif.ImageWidth || metadataJson.exif.ExifImageWidth,
            height: metadataJson.exif.ImageHeight || metadataJson.exif.ExifImageHeight,
            dominant_color: this.normalizeDominantColor(metadataJson.dominantColor),
            processing_status: 'completed',
            date_taken: this.parseExifDate(metadataJson.exif.DateTimeOriginal || metadataJson.exif.FileModifyDate),
            date_processed: new Date(),
            is_screenshot: metadataJson.screenshotDetection?.isScreenshot || false,
            screenshot_confidence: metadataJson.screenshotDetection?.confidence || 0,
            screenshot_reasons: metadataJson.screenshotDetection?.reasons ? JSON.stringify(metadataJson.screenshotDetection.reasons) : undefined,
            junk_status: 'unreviewed'
        };
        
        const imageId = await ImageRepository.create(imageData);
        console.log(`Created image record: ${imageId} for ${originalFilename}`);
        
        // Create metadata record
        await this.createMetadataRecord(imageId, metadataJson.exif);
        
        // Create face records
        if (metadataJson.people && Object.keys(metadataJson.people).length > 0) {
            await this.createFaceRecords(imageId, metadataJson.people, facesDir);
        }
        
        // Create object detection records
        if (metadataJson.objects && metadataJson.objects.length > 0) {
            await this.createObjectRecords(imageId, metadataJson.objects);
        }
        
        return true;
    }
    
    private static async createMetadataRecord(imageId: number, exif: any): Promise<void> {
        const metadata: Omit<ImageMetadata, 'id'> = {
            image_id: imageId,
            camera_make: exif.Make,
            camera_model: exif.Model,
            software: exif.Software,
            focal_length: this.parseNumeric(exif.FocalLength),
            aperture: exif.FNumber?.toString(),
            shutter_speed: exif.ExposureTime?.toString() || exif.ShutterSpeedValue?.toString(),
            iso: this.parseNumeric(exif.ISO),
            flash: exif.Flash?.toString(),
            white_balance: exif.WhiteBalance?.toString(),
            exposure_mode: exif.ExposureMode?.toString(),
            latitude: this.parseGPSCoordinate(exif.GPSLatitude, exif.GPSLatitudeRef),
            longitude: this.parseGPSCoordinate(exif.GPSLongitude, exif.GPSLongitudeRef),
            city: exif.City,
            state: exif['Province-State'],
            country: exif['Country-PrimaryLocationName'],
            altitude: this.parseNumeric(exif.GPSAltitude),
            orientation: this.parseNumeric(exif.Orientation),
            color_space: exif.ColorSpace?.toString(),
            raw_exif: exif
        };
        
        await MetadataRepository.createMetadata(metadata);
    }
    
    private static async createFaceRecords(
        imageId: number, 
        peopleData: Record<string, any>, 
        facesDir: string
    ): Promise<void> {
        for (const [facePath, faceData] of Object.entries(peopleData)) {
            // Check if face image file exists
            const processedDir = config.getStorage().processedDir;
            const faceImagePath = facePath.replace(processedDir + '/', '');
            const fullFacePath = path.join(processedDir, faceImagePath);
            
            if (!fs.existsSync(fullFacePath)) {
                console.warn(`Face image not found: ${fullFacePath}`);
                continue;
            }
            
            const face: Omit<DetectedFace, 'id'> = {
                image_id: imageId,
                face_image_path: faceImagePath,
                x_min: faceData.box?.x_min || 0,
                y_min: faceData.box?.y_min || 0,
                x_max: faceData.box?.x_max || 0,
                y_max: faceData.box?.y_max || 0,
                detection_confidence: faceData.box?.probability || 0,
                predicted_gender: faceData.gender?.value,
                gender_confidence: faceData.gender?.probability || 0,
                age_min: faceData.age?.low,
                age_max: faceData.age?.high,
                age_confidence: faceData.age?.probability || 0,
                pitch: faceData.pose?.pitch || 0,
                roll: faceData.pose?.roll || 0,
                yaw: faceData.pose?.yaw || 0,
                landmarks: faceData.landmarks ? JSON.stringify(faceData.landmarks) : null
            };
            
            await FaceRepository.createFace(face);
        }
    }
    
    private static async createObjectRecords(imageId: number, objects: any[]): Promise<void> {
        const objectRecords: Omit<DetectedObject, 'id'>[] = objects.map(obj => ({
            image_id: imageId,
            class: obj.class,
            confidence: obj.confidence,
            x: obj.bbox?.x || 0,
            y: obj.bbox?.y || 0,
            width: obj.bbox?.width || 0,
            height: obj.bbox?.height || 0
        }));
        
        if (objectRecords.length > 0) {
            await ObjectRepository.createObjects(objectRecords);
        }
    }
    
    // Utility methods
    private static normalizeDominantColor(color: string): string {
        if (!color) return '#000000';
        
        // If it's already in correct format (#RRGGBB), return it
        if (color.match(/^#[0-9a-fA-F]{6}$/)) {
            return color;
        }
        
        // If it's a longer hex string, truncate to first 6 hex chars
        if (color.startsWith('#')) {
            const hexOnly = color.substring(1).replace(/[^0-9a-fA-F]/g, '');
            return '#' + hexOnly.substring(0, 6).padEnd(6, '0');
        }
        
        // Default fallback
        return '#000000';
    }
    
    private static getMimeType(filename: string): string {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
    
    private static parseExifDate(dateValue: any): Date | undefined {
        if (!dateValue) return undefined;
        
        if (typeof dateValue === 'object' && dateValue.rawValue) {
            const date = new Date(dateValue.rawValue);
            return isNaN(date.getTime()) ? undefined : date;
        }
        
        if (typeof dateValue === 'string') {
            // Handle EXIF date format: "YYYY:MM:DD HH:mm:ss"
            const normalizedDate = dateValue.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
            const date = new Date(normalizedDate);
            return isNaN(date.getTime()) ? undefined : date;
        }
        
        return undefined;
    }
    
    private static parseNumeric(value: any): number | undefined {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? undefined : parsed;
        }
        return undefined;
    }
    
    private static parseGPSCoordinate(coord: any, ref: any): number | undefined {
        if (!coord || !ref) return undefined;
        
        // GPS coordinates are often in degrees, minutes, seconds format
        if (Array.isArray(coord) && coord.length >= 3) {
            const degrees = this.parseNumeric(coord[0]) || 0;
            const minutes = this.parseNumeric(coord[1]) || 0;
            const seconds = this.parseNumeric(coord[2]) || 0;
            
            let decimal = degrees + (minutes / 60) + (seconds / 3600);
            
            // Apply hemisphere (negative for South/West)
            if (ref === 'S' || ref === 'W') {
                decimal = -decimal;
            }
            
            return decimal;
        }
        
        return this.parseNumeric(coord);
    }
}