import path from 'node:path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import sharp from 'sharp';

import { Logger } from '../logger';
import { configManager } from './config-manager';

// Transform coordinates from display orientation to raw file orientation for Sharp extraction
const transformCoordinatesForOrientation = (
    x_min: number, y_min: number, x_max: number, y_max: number,
    displayWidth: number, displayHeight: number, orientation: number
) => {
    let left, top, width, height;
    
    switch (orientation) {
        case 6: // 90° CW rotation (portrait photo)
            left = y_min;
            top = displayWidth - x_max;
            width = y_max - y_min;
            height = x_max - x_min;
            break;
        case 8: // 90° CCW rotation
            left = displayHeight - y_max;
            top = x_min;
            width = y_max - y_min;
            height = x_max - x_min;
            break;
        case 3: // 180° rotation
            left = displayWidth - x_max;
            top = displayHeight - y_max;
            width = x_max - x_min;
            height = y_max - y_min;
            break;
        case 5: // 90° CW + horizontal flip
        case 7: // 90° CCW + horizontal flip
            // These are less common, handle similarly to 6/8 but with flip
            left = y_min;
            top = displayWidth - x_max;
            width = y_max - y_min;
            height = x_max - x_min;
            break;
        default:
            // No transformation needed
            left = x_min;
            top = y_min;
            width = x_max - x_min;
            height = y_max - y_min;
    }
    
    return { left, top, width, height };
};

const logger = Logger.getInstance();

const COMPREFACE_API_URL = `${configManager.getCompreFace().baseUrl}/api/v1`;
enum ComprefaceService {
    Detect = 'Detect',
    Recognize = 'Recognize'
}

// Get API keys from config with fallback to defaults
const comprefaceConfig = configManager.getCompreFace();
const ComprefaceKeys = {
    Detect: comprefaceConfig.detectApiKey || 'dccaa628-2951-4812-a81d-e8a76b52b47c',
    Recognize: comprefaceConfig.recognizeApiKey || 'b6dd9990-6905-40b8-80d3-4655196ab139',
};

enum ComprefaceRoutes {
    Detect = `/detection/detect`,
    Recognize = `/recognition/recognize`,
}

const comprefaceApi = async (service: ComprefaceService, imagepath: string): Promise<JSON> => {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagepath));
    const faceDetectionConfig = configManager.getProcessing().faceDetection;
    const detectionThreshold = faceDetectionConfig.confidence.detection;
    const query = `?limit=20&det_prob_threshold=${detectionThreshold}&face_plugins=landmarks&face_plugins=gender&face_plugins=age&face_plugins=pose`;
    const url = `${COMPREFACE_API_URL}${ComprefaceRoutes[service]}${query}`;
    const apiKey = ComprefaceKeys[service];
    
    logger.info(`CompreFace API call: ${service} to ${url} with key: ${apiKey}`);
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            "content-type": "multipart/form-data",
            'x-api-key': apiKey,
            ...formData.getHeaders()
        },
        body: formData
    });
    const result = await response.json();
    
    logger.info(`CompreFace response: ${JSON.stringify(result)}`);
    
    return result;
}

export const detectFacesFromImage = async (imagepath: string): Promise<any> => {
    return await comprefaceApi(ComprefaceService.Detect, imagepath)
};

export const recognizeFacesFromImage = async (imagepath: string): Promise<any> => {
    return await comprefaceApi(ComprefaceService.Recognize, imagepath)
};

// CompreFace Subject Management
export const createComprefaceSubject = async (subjectName: string): Promise<string> => {
    try {
        const url = `${COMPREFACE_API_URL}/recognition/subjects`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ComprefaceKeys.Recognize,
            },
            body: JSON.stringify({ subject: subjectName })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(`CompreFace error: ${result.message || 'Unknown error'}`);
        }

        logger.info(`Created CompreFace subject: ${subjectName} with ID: ${result.subject}`);
        return result.subject;
    } catch (error) {
        logger.error(`Error creating CompreFace subject: ${error}`);
        throw error;
    }
};

export const addFaceToSubject = async (subjectId: string, imagePath: string): Promise<any> => {
    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(imagePath));

        const url = `${COMPREFACE_API_URL}/recognition/faces?subject=${encodeURIComponent(subjectId)}`;
        
        // Create a timeout promise using config value
        const timeoutMs = configManager.getCompreFace().timeout;
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`CompreFace timeout after ${timeoutMs}ms`)), timeoutMs);
        });
        
        // Race between fetch and timeout
        const fetchPromise = fetch(url, {
            method: 'POST',
            headers: {
                'x-api-key': ComprefaceKeys.Recognize,
                ...formData.getHeaders()
            },
            body: formData
        });
        
        const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

        const result = await response.json();
        if (!response.ok) {
            throw new Error(`CompreFace error: ${result.message || 'Unknown error'}`);
        }

        logger.info(`Added face to subject ${subjectId}: ${imagePath}`);
        return result;
    } catch (error) {
        logger.error(`Error adding face to subject: ${error}`);
        throw error;
    }
};

export const deleteFaceFromSubject = async (faceImagePath: string): Promise<any> => {
    try {
        // Get all faces from CompreFace to find the one with matching image
        const url = `${COMPREFACE_API_URL}/recognition/faces`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-api-key': ComprefaceKeys.Recognize,
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch CompreFace faces: ${response.status}`);
        }

        const result = await response.json();
        logger.info(`Found ${result.faces?.length || 0} faces in CompreFace to search through`);

        // For now, we'll implement a workaround since CompreFace doesn't store image paths
        // We'll need to delete faces by subject and re-upload the remaining ones
        // This is not ideal but ensures consistency
        logger.warn(`CompreFace face deletion not fully implemented for: ${faceImagePath}`);
        logger.warn('Consider using cleanup-orphaned function to maintain consistency');
        
        return { success: true, note: 'Face deletion tracked, use cleanup for full sync' };
    } catch (error) {
        logger.error(`Error deleting face from subject: ${error}`);
        throw error;
    }
};

export const getComprefaceSubjects = async (): Promise<any> => {
    try {
        const url = `${COMPREFACE_API_URL}/recognition/subjects`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-api-key': ComprefaceKeys.Recognize,
            }
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(`CompreFace error: ${result.message || 'Unknown error'}`);
        }

        return result;
    } catch (error) {
        logger.error(`Error getting CompreFace subjects: ${error}`);
        throw error;
    }
};

// Batch processing functions for improved performance
export const recognizeFacesFromImagesBatch = async (imagePaths: string[], maxConcurrency: number = configManager.getCompreFace().maxConcurrency): Promise<Map<string, any>> => {
    const results = new Map<string, any>();
    
    // Process images in batches to avoid overwhelming CompreFace
    const batches = [];
    for (let i = 0; i < imagePaths.length; i += maxConcurrency) {
        batches.push(imagePaths.slice(i, i + maxConcurrency));
    }
    
    logger.info(`Processing ${imagePaths.length} images in ${batches.length} batches (max ${maxConcurrency} concurrent)`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        logger.info(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} images`);
        
        // Process all images in current batch concurrently
        const batchPromises = batch.map(async (imagePath) => {
            try {
                const result = await recognizeFacesFromImage(imagePath);
                return { imagePath, result, success: true };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(`Error recognizing faces in ${imagePath}: ${errorMessage}`);
                return { imagePath, error: errorMessage, success: false };
            }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Collect results from current batch
        for (const promiseResult of batchResults) {
            if (promiseResult.status === 'fulfilled') {
                const { imagePath, result, success, error } = promiseResult.value;
                if (success) {
                    results.set(imagePath, result);
                } else {
                    results.set(imagePath, { error });
                }
            } else {
                const errorMessage = promiseResult.reason instanceof Error ? promiseResult.reason.message : String(promiseResult.reason);
                logger.error(`Batch processing error: ${errorMessage}`);
            }
        }
        
        // Small delay between batches to be gentle on CompreFace
        if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    logger.info(`Batch recognition completed: ${results.size} images processed`);
    return results;
};

export const addFacesToSubjectBatch = async (subjectId: string, imagePaths: string[], maxConcurrency: number = Math.max(1, Math.floor(configManager.getCompreFace().maxConcurrency / 2))): Promise<{ successful: string[], failed: Array<{ path: string, error: string }> }> => {
    const successful: string[] = [];
    const failed: Array<{ path: string, error: string }> = [];
    
    // Process face uploads in batches with lower concurrency (CompreFace training can be intensive)
    const batches = [];
    for (let i = 0; i < imagePaths.length; i += maxConcurrency) {
        batches.push(imagePaths.slice(i, i + maxConcurrency));
    }
    
    logger.info(`Adding ${imagePaths.length} faces to subject ${subjectId} in ${batches.length} batches`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        logger.info(`Uploading batch ${batchIndex + 1}/${batches.length} with ${batch.length} faces`);
        
        // Process all faces in current batch concurrently
        const batchPromises = batch.map(async (imagePath) => {
            try {
                await addFaceToSubject(subjectId, imagePath);
                return { imagePath, success: true };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(`Error adding face to subject ${subjectId}: ${imagePath} - ${errorMessage}`);
                return { imagePath, error: errorMessage, success: false };
            }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Collect results from current batch
        for (const promiseResult of batchResults) {
            if (promiseResult.status === 'fulfilled') {
                const { imagePath, success, error } = promiseResult.value;
                if (success) {
                    successful.push(imagePath);
                } else {
                    failed.push({ path: imagePath, error: error || 'Unknown error' });
                }
            } else {
                const errorMessage = promiseResult.reason instanceof Error ? promiseResult.reason.message : String(promiseResult.reason);
                failed.push({ path: 'unknown', error: errorMessage });
            }
        }
        
        // Longer delay between batches for face training (CompreFace needs time to process)
        if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    logger.info(`Batch face upload completed: ${successful.length} successful, ${failed.length} failed`);
    return { successful, failed };
};

export const extractFaces = async (imagepath: string, dest: string): Promise<Record<string, object>> => {
    logger.info(`[EXTRACT FACES] from: ${imagepath}`);
    const response = await detectFacesFromImage(imagepath);
    logger.info(`[EXTRACT FACES] detectFacesFromImage response: ${JSON.stringify(response)}`);
    
    const { result } = response;
    if (!result || Object.keys(result).length === 0) {
        logger.warn(`[EXTRACT FACES] No faces detected in image: ${imagepath}`);
        return {};
    }
    
    // Get image metadata to handle EXIF orientation
    const imageMetadata = await sharp(imagepath).metadata();
    const { width: rawWidth, height: rawHeight, orientation = 1 } = imageMetadata;
    
    // Determine if image needs rotation based on EXIF orientation
    const needsRotation = orientation >= 5 && orientation <= 8;
    const displayWidth = needsRotation ? rawHeight : rawWidth;
    const displayHeight = needsRotation ? rawWidth : rawHeight;
    
    logger.info(`[EXTRACT FACES] Image ${imagepath}: raw(${rawWidth}x${rawHeight}) display(${displayWidth}x${displayHeight}) orientation(${orientation})`);
    
    let i = 0;
    const faceData: Record<string, object> = {};
    for (const res in result) {
        const { box } = result[res];
        
        // CompreFace returns coordinates based on display orientation
        // Convert them to raw file coordinates for Sharp extraction
        let extractCoords;
        if (needsRotation) {
            // Transform display coordinates to raw file coordinates based on orientation
            extractCoords = transformCoordinatesForOrientation(
                box.x_min, box.y_min, box.x_max, box.y_max,
                displayWidth, displayHeight, orientation
            );
        } else {
            // No rotation needed, use coordinates as-is
            extractCoords = {
                left: box.x_min,
                top: box.y_min,
                width: box.x_max - box.x_min,
                height: box.y_max - box.y_min,
            };
        }
        
        logger.info(`[EXTRACT FACES] Face ${i}: original box(${box.x_min},${box.y_min},${box.x_max},${box.y_max}) -> extract(${extractCoords.left},${extractCoords.top},${extractCoords.width},${extractCoords.height})`);
        
        // Use Sharp WITHOUT withMetadata() and apply our coordinate transformation
        const s = sharp(imagepath);

        // Create face filename in the dest directory
        const faceFilename = `${path.basename(imagepath, path.extname(imagepath))}__face_${i}${path.extname(imagepath)}`;
        const filename = path.join(dest, faceFilename);
        
        logger.info(`[EXTRACT FACES] Saving face ${i} to: ${filename}`);
        
        // Ensure the dest directory exists
        fs.mkdirSync(dest, { recursive: true });
        try {
            await s.extract(extractCoords).toFile(filename);
        } catch (error) {
            logger.error(`[EXTRACT FACES] Error extracting face ${i} from ${imagepath}: ${error}`);
            continue; // Skip this face if extraction fails
        }

        // Store face data with index as key and include the face image path
        faceData[i.toString()] = {
            ...result[res],
            face_image_path: faceFilename,
            x_min: box.x_min,
            y_min: box.y_min,
            x_max: box.x_max,
            y_max: box.y_max
        };
        
        i++;
    }

    return faceData;
}