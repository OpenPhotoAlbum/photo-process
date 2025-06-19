import path from 'node:path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { dominantColorFromImage } from './image';
import { exifFromImage } from './exif';
import { extractFaces } from './compreface';
import { detectObjects, filterByConfidence } from './object-detection';
import { ScreenshotDetector } from './screenshot-detector';
import { detectAstrophotography } from './astrophotography-detector';
import { Logger } from '../logger';
import { configManager } from './config-manager';
import { HashManager, HashFileInfo } from './hash-manager';
import { ImageRepository, MetadataRepository, ObjectRepository, FaceRepository } from '../models/database';
import { SmartAlbumEngine } from './smart-album-engine';
import { GeolocationService } from './geolocation';
import { extractBestDate } from './exif-date-extractor';
import { extractEnhancedMetadata, extractExifKeywords, estimateGPSAccuracy } from './enhanced-exif-extractor';

const logger = Logger.getInstance();

// Legacy functions removed - metadata now stored in database only

/**
 * Extract faces using hash-based naming
 */
export const extractFacesHashed = async (imagepath: string, fileInfo: HashFileInfo): Promise<any> => {
    const processedDir = configManager.getStorage().processedDir;
    const facesDir = path.join(processedDir, 'faces');

    // Ensure faces directory exists
    await fsPromises.mkdir(facesDir, { recursive: true });
    // Extract faces with hash-based naming
    const faces = await extractFaces(imagepath, facesDir);
    logger.info(`[EXTRACT FACES] extractFacesHashed ${Object.keys(faces).length} faces from ${imagepath}`, faces);
    // Update face paths to use hash-based naming
    const hashedFaces: any = {};
    for (const [faceIndex, faceData] of Object.entries(faces)) {
        if (faceData && typeof faceData === 'object' && 'face_image_path' in faceData) {
            const index = parseInt(faceIndex);
            const hashedFaceFilename = HashManager.generateFaceFilename(fileInfo.hashedFilename, index);
            const originalFacePath = (faceData as any).face_image_path;
            const hashedFacePath = path.join(facesDir, hashedFaceFilename);

            // Copy face image to hashed name
            if (fs.existsSync(originalFacePath)) {
                await fsPromises.copyFile(originalFacePath, hashedFacePath);
                // Clean up original
                await fsPromises.unlink(originalFacePath);
            }

            hashedFaces[faceIndex] = {
                ...faceData,
                face_image_path: hashedFaceFilename, // Store relative path only
                relative_face_path: hashedFaceFilename
            };
        }
    }

    return hashedFaces;
};

/**
 * Main image processing function with hash-based file organization
 * Data is stored directly in database (no JSON metadata files)
 */
export const generateImageDataJsonHashed = async (imagepath: string, dateTaken?: Date): Promise<{
    fileInfo: HashFileInfo;
    processingResults: any;
}> => {
    const processingStart = Date.now();
    const correlationId = logger.startOperation(`process-image-hashed-${path.basename(imagepath)}`);

    // Check if file already exists by hash
    const fileInfo = await HashManager.generateFileInfo(imagepath, dateTaken);
    const existingImage = await HashManager.findDuplicateByHash(fileInfo.hash);

    if (existingImage) {
        logger.logImageProcessed({
            imagePath: imagepath,
            processingTime: 0,
            operations: {
                exif: { success: true, duration: 0 },
                thumbnail: { success: true, duration: 0 },
                faceDetection: { success: true, faces: 0, duration: 0 },
                objectDetection: { success: true, objects: 0, duration: 0 },
                astrophotography: { success: true, isAstro: false, confidence: 0, duration: 0 }
            },
            output: { metadataPath: '', thumbnailPath: '', faceCount: 0 },
            duplicate: true,
            existingId: existingImage.id
        });

        correlationId.end({ processingTime: 0, duplicate: true });
        throw new Error(`Duplicate file detected. Hash: ${fileInfo.hash}, existing ID: ${existingImage.id}`);
    }

    // Copy file to organized structure
    await HashManager.copyToOrganized(imagepath, fileInfo);

    // Track individual operation timings
    const timings = {
        exif: { start: Date.now(), end: 0 },
        color: { start: Date.now(), end: 0 },
        faces: { start: Date.now(), end: 0 },
        objects: { start: Date.now(), end: 0 },
        astro: { start: Date.now(), end: 0 }
    };

    // Check configuration settings for conditional processing
    const processingConfig = configManager.getProcessing();
    const faceDetectionEnabled = processingConfig.faceDetection.enabled;
    const objectDetectionEnabled = processingConfig.objectDetection.enabled;

    logger.info(`Processing config - Face detection: ${faceDetectionEnabled}, Object detection: ${objectDetectionEnabled}`);

    const [exif, dominantColor, faces, allObjects, astroResult] = await Promise.all([
        // Extract EXIF data
        exifFromImage(fileInfo.fullPath).then(result => {
            timings.exif.end = Date.now();
            return result;
        }).catch(error => {
            timings.exif.end = Date.now();
            logger.error(`Failed to extract EXIF data from ${fileInfo.fullPath}:`, error);
            // Return minimal EXIF data instead of failing the entire process
            return {
                FileName: path.basename(fileInfo.fullPath),
                Directory: path.dirname(fileInfo.fullPath),
                FileSize: 0,
                FileModifyDate: new Date(),
                FileAccessDate: new Date(),
                FileInodeChangeDate: new Date(),
                FilePermissions: 'rw-r--r--',
                FileType: 'JPEG',
                FileTypeExtension: 'jpg',
                MIMEType: 'image/jpeg',
                ImageWidth: 0,
                ImageHeight: 0,
                EncodingProcess: 'Baseline DCT, Huffman coding',
                BitsPerSample: 8,
                ColorComponents: 3,
                YCbCrSubSampling: 'YCbCr4:2:0 (2 2)'
            } as any;
        }
        ),
        // Extract dominant color
        dominantColorFromImage(fileInfo.fullPath).then(result => {
            timings.color.end = Date.now();
            return result;
        }).catch(error => {
            timings.color.end = Date.now();
            logger.error(`Failed to extract dominant color from ${fileInfo.fullPath}:`, error);
            return '#ffffff'; // Default to white if extraction fails
        }
        ),
        // Extract faces with hash-based naming (only if enabled)
        faceDetectionEnabled ?
            extractFacesHashed(fileInfo.fullPath, fileInfo).then(result => {
                timings.faces.end = Date.now();
                return result;
            }).catch(error => {
                timings.faces.end = Date.now();
                logger.error(`[EXTRACT FACES] Failed to extract faces from ${fileInfo.fullPath}:`, error);
                return {};
            }) :
            Promise.resolve({}).then(result => {
                timings.faces.end = Date.now();
                return result;
            }),
        // Object detection (only if enabled)
        objectDetectionEnabled ?
            detectObjects(fileInfo.fullPath).then(result => {
                timings.objects.end = Date.now();
                return result;
            }).catch(error => {
                timings.objects.end = Date.now();
                logger.error(`[DETECT OBJECTS] Failed to detect objects in ${fileInfo.fullPath}:`, error);
                return [];
            }) :
            Promise.resolve([]).then(result => {
                timings.objects.end = Date.now();
                return result;
            }),
        // Astrophotography detection
        // Note: This is an optional step, so we handle it separately
        detectAstrophotography(fileInfo.fullPath).then(result => {
            timings.astro.end = Date.now();
            return result;
        }).catch(error => {
            timings.astro.end = Date.now();
            logger.error(`Failed to detect astrophotography in ${fileInfo.fullPath}:`, error);
            return { isAstro: false, confidence: 0, classification: 'unknown', details: {} };
        }
        )
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

    // No longer creating JSON metadata files - data stored in database only
    const processingResults = {
        exif,
        dominantColor,
        people: faces,
        objects: objects,
        screenshotDetection: screenshotDetection,
        astroResult: astroResult,
        hashInfo: {
            hash: fileInfo.hash,
            relativePath: fileInfo.relativePath,
            originalFilename: path.basename(imagepath),
            processedAt: new Date().toISOString()
        }
    };

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
            },
            astrophotography: {
                success: true,
                isAstro: astroResult.isAstro,
                confidence: astroResult.confidence,
                classification: astroResult.classification,
                duration: timings.astro.end - timings.astro.start
            }
        },
        output: {
            thumbnailPath: '', // Set by thumbnail generation
            faceCount: Object.keys(faces).length
        }
    });

    correlationId.end({ processingTime, faceCount: Object.keys(faces).length, objectCount: objects.length });

    return {
        fileInfo,
        processingResults
    };
};

/**
 * Store processed image data in database using hash-based structure
 */
export const storeImageDataHashed = async (
    originalPath: string,
    fileInfo: HashFileInfo,
    processingResults: any
): Promise<number> => {
    const { exif, dominantColor, people, objects, screenshotDetection, astroResult } = processingResults;
    logger.info(`[DB] Storing image data for ${originalPath} with hash ${fileInfo.hash}`);
    // Parse date taken from EXIF using robust extraction
    let dateTaken: Date;
    try {
        const extractedDate = extractBestDate(exif);
        if (extractedDate) {
            dateTaken = extractedDate;
        } else {
            // Fall back to file modification time if no valid EXIF date found
            const stats = fs.statSync(originalPath);
            dateTaken = stats.mtime;
            logger.debug(`Using file modification time as fallback for ${originalPath}: ${dateTaken.toISOString()}`);
        }
    } catch (error) {
        logger.error(`Failed to parse date taken from EXIF for ${originalPath}:`, error);
        // Fall back to file modification time
        const stats = fs.statSync(originalPath);
        dateTaken = stats.mtime;
    }

    // Extract GPS coordinates for geolocation using enhanced parsing
    const enhancedGPS = extractEnhancedMetadata(exif);
    const gpsLatitude = enhancedGPS.latitude;
    const gpsLongitude = enhancedGPS.longitude;
    const gpsAltitude = enhancedGPS.altitude;
    const gpsDirection = exif.GPSImgDirection?.toString();
    const gpsSpeed = parseNumeric(exif.GPSSpeed);

    // Create image record with hash-based fields and GPS data
    const imageData = {
        filename: path.basename(originalPath),
        original_path: originalPath,
        file_hash: fileInfo.hash,
        file_size: fileInfo.size,
        relative_media_path: fileInfo.relativePath,
        relative_meta_path: '', // Metadata stored in database only
        source_filename: path.basename(originalPath),
        date_imported: new Date(),
        migration_status: 'copied' as const,
        mime_type: getMimeTypeFromPath(originalPath),
        width: exif.ImageWidth || exif.ExifImageWidth,
        height: exif.ImageHeight || exif.ExifImageHeight,
        dominant_color: dominantColor,
        processing_status: 'completed' as const,
        date_taken: dateTaken,
        date_processed: new Date(),
        is_screenshot: screenshotDetection.isScreenshot,
        screenshot_confidence: screenshotDetection.confidence,
        screenshot_reasons: JSON.stringify(screenshotDetection.reasons),
        is_astrophotography: astroResult.isAstro,
        astro_confidence: astroResult.confidence,
        astro_details: JSON.stringify(astroResult.details),
        astro_classification: astroResult.classification,
        astro_detected_at: astroResult.isAstro ? new Date() : undefined,
        // GPS data from EXIF
        gps_latitude: gpsLatitude,
        gps_longitude: gpsLongitude,
        gps_altitude: gpsAltitude,
        gps_direction: gpsDirection,
        gps_speed: gpsSpeed
    };

    // Create the image record first
    const imageId = await ImageRepository.create(imageData);

    // Store detailed EXIF metadata in image_metadata table
    if (exif && Object.keys(exif).length > 0) {
        // Extract enhanced metadata
        const enhancedMetadata = extractEnhancedMetadata(exif);
        
        // Estimate GPS accuracy if coordinates exist
        let gpsAccuracy = null;
        if (enhancedMetadata.latitude && enhancedMetadata.longitude) {
            gpsAccuracy = estimateGPSAccuracy(enhancedMetadata);
            logger.info(`GPS accuracy for ${originalPath}: ${gpsAccuracy.accuracy} (${gpsAccuracy.confidenceScore * 100}%)`);
        }
        
        const metadataRecord = {
            image_id: imageId,
            // Basic camera info
            camera_make: enhancedMetadata.camera_make,
            camera_model: enhancedMetadata.camera_model,
            software: enhancedMetadata.software,
            lens_model: enhancedMetadata.lens_model,
            focal_length: enhancedMetadata.focal_length,
            aperture: enhancedMetadata.aperture,
            shutter_speed: enhancedMetadata.shutter_speed,
            iso: enhancedMetadata.iso,
            flash: enhancedMetadata.flash,
            white_balance: enhancedMetadata.white_balance,
            exposure_mode: enhancedMetadata.exposure_mode,
            
            // Enhanced fields (will be added after migration)
            // exposure_compensation: enhancedMetadata.exposure_compensation,
            // metering_mode: enhancedMetadata.metering_mode,
            // exposure_program: enhancedMetadata.exposure_program,
            // scene_type: enhancedMetadata.scene_type,
            // subject_distance: enhancedMetadata.subject_distance,
            // focal_length_35mm: enhancedMetadata.focal_length_35mm,
            // max_aperture_value: enhancedMetadata.max_aperture_value,
            // digital_zoom_ratio: enhancedMetadata.digital_zoom_ratio,
            // gain_control: enhancedMetadata.gain_control,
            // contrast: enhancedMetadata.contrast,
            // saturation: enhancedMetadata.saturation,
            // sharpness: enhancedMetadata.sharpness,
            // brightness_value: enhancedMetadata.brightness_value,
            
            // GPS fields
            latitude: enhancedMetadata.latitude,
            longitude: enhancedMetadata.longitude,
            altitude: enhancedMetadata.altitude,
            // gps_h_positioning_error: enhancedMetadata.gps_h_positioning_error,
            // gps_dop: enhancedMetadata.gps_dop,
            // gps_satellites: enhancedMetadata.gps_satellites,
            
            // Creator/copyright (will be added after migration)
            // artist: enhancedMetadata.artist,
            // copyright: enhancedMetadata.copyright,
            // image_description: enhancedMetadata.image_description,
            // user_comment: enhancedMetadata.user_comment,
            // rating: enhancedMetadata.rating,
            
            // Other
            orientation: enhancedMetadata.orientation,
            color_space: enhancedMetadata.color_space,
            raw_exif: enhancedMetadata.raw_exif, // Store complete EXIF data as JSON
            created_at: new Date(),
            updated_at: new Date()
        };

        await MetadataRepository.createMetadata(metadataRecord);
        
        // Extract and store keywords (will be enabled after migration)
        // const { keywords } = extractExifKeywords(exif);
        // if (keywords.length > 0) {
        //     for (const keyword of keywords) {
        //         await KeywordRepository.createKeyword({
        //             image_id: imageId,
        //             keyword: keyword,
        //             source: 'exif'
        //         });
        //     }
        //     logger.info(`Stored ${keywords.length} keywords for image ${imageId}`);
        // }
    }

    // Store detected objects in detected_objects table
    if (objects && objects.length > 0) {
        for (const obj of objects) {
            await ObjectRepository.createObject({
                image_id: imageId,
                class: obj.class,
                confidence: obj.confidence,
                x: Math.round(obj.bbox.x),
                y: Math.round(obj.bbox.y),
                width: Math.round(obj.bbox.width),
                height: Math.round(obj.bbox.height),
                created_at: new Date()
            });
        }
    }

    // Store faces in detected_faces table
    if (people && Object.keys(people).length > 0) {
        logger.info(`[DB - FACE] Storing ${Object.keys(people).length} faces for image ID ${imageId}`);
        for (const [faceKey, faceData] of Object.entries(people)) {
            const face = faceData as any;

            // Face paths from extractFacesHashed are already relative
            const relativeFacePath = face.relative_face_path || face.face_image_path;
            const fullFacePath = relativeFacePath ?
                path.join(configManager.getStorage().processedDir, 'faces', relativeFacePath) :
                undefined;

            try {
                logger.info(`[DB - FACE] Storing face ${faceKey} for image ID ${imageId} at path ${fullFacePath}`);
                await FaceRepository.createFace({
                    image_id: imageId,
                    face_image_path: fullFacePath,
                    relative_face_path: relativeFacePath,
                    x_min: face.box?.x_min || face.x_min || 0,
                    y_min: face.box?.y_min || face.y_min || 0,
                    x_max: face.box?.x_max || face.x_max || 0,
                    y_max: face.box?.y_max || face.y_max || 0,
                    detection_confidence: face.detection_confidence || face.box?.probability || face.confidence || 0,
                    predicted_gender: face.gender?.value || face.predicted_gender,
                    gender_confidence: face.gender?.probability || face.gender_confidence,
                    age_min: face.age?.low || face.age_min,
                    age_max: face.age?.high || face.age_max,
                    age_confidence: face.age?.probability || face.age_confidence,
                    pitch: face.pitch,
                    roll: face.roll,
                    yaw: face.yaw,
                    landmarks: face.landmarks ? JSON.stringify(face.landmarks) : null,
                    face_embedding: face.embedding ? JSON.stringify(face.embedding) : null,
                    created_at: new Date()
                });
            } catch (error) {
                logger.error(`[DB - FACE] Failed to store face data for image ID ${imageId}:`, error);
                // Continue processing other faces even if one fails
            }
        }
    }

    // Process geolocation if GPS coordinates are available
    if (gpsLatitude && gpsLongitude) {
        try {
            logger.info(`Processing geolocation for image ${imageId} at ${gpsLatitude}, ${gpsLongitude}`);
            const locationInfo = await GeolocationService.processImageLocation(
                imageId,
                { 
                    latitude: gpsLatitude, 
                    longitude: gpsLongitude, 
                    altitude: gpsAltitude 
                },
                25 // Search within 25 miles
            );
            
            if (locationInfo) {
                logger.info(`Successfully linked image ${imageId} to ${locationInfo.fullLocationString} (${locationInfo.distanceMiles.toFixed(2)} miles away)`);
            } else {
                logger.info(`No location found within 25 miles for image ${imageId}`);
            }
        } catch (geoError) {
            // Log error but don't fail the entire process
            logger.error(`Failed to process geolocation for image ${imageId}:`, geoError);
        }
    }

    // Process image for smart albums
    try {
        await SmartAlbumEngine.processImageForAlbums(imageId);
    } catch (albumError) {
        // Log error but don't fail the entire process
        logger.error('Failed to process image for smart albums:', albumError);
    }

    return imageId;
};

// Legacy function removed - use generateImageDataJsonHashed instead

// Helper functions
function parseNumeric(value: any): number | undefined {
    if (value === undefined || value === null) return undefined;
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? undefined : num;
}

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
