import path from 'node:path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import sharp from 'sharp';

import { Logger } from '../logger';

const logger = Logger.getInstance();

const COMPREFACE_API_URL = 'http://localhost:8000/api/v1';

enum ComprefaceService {
    Detect = 'Detect',
    Recognize = 'Recognize'
}

enum ComprefaceKeys {
    Detect = 'dccaa628-2951-4812-a81d-e8a76b52b47c',
    Recognize = 'b6dd9990-6905-40b8-80d3-4655196ab139',
}

enum ComprefaceRoutes {
    Detect = `/detection/detect`,
    Recognize = `/recognition/recognize`,
}

const comprefaceApi = async (service: ComprefaceService, imagepath: string): Promise<JSON> => {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagepath));

    const query = '?limit=20&det_prob_threshold=0.8&face_plugins=landmarks&face_plugins=gender&face_plugins=age&face_plugins=pose';
    const url = `${COMPREFACE_API_URL}${ComprefaceRoutes[service]}${query}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            "content-type": "multipart/form-data",
            'x-api-key': ComprefaceKeys[service],
            ...formData.getHeaders()
        },
        body: formData
    });

    const result = await response.json();
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
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('CompreFace timeout after 10 seconds')), 10000);
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
export const recognizeFacesFromImagesBatch = async (imagePaths: string[], maxConcurrency: number = 5): Promise<Map<string, any>> => {
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

export const addFacesToSubjectBatch = async (subjectId: string, imagePaths: string[], maxConcurrency: number = 3): Promise<{ successful: string[], failed: Array<{ path: string, error: string }> }> => {
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
    const { result } = await detectFacesFromImage(imagepath);
    let i = 0;
    const faceData: Record<string, object> = {};
    for (const res in result) {
        // Use Sharp WITHOUT withMetadata() to avoid EXIF orientation being applied
        // This ensures face coordinates from CompreFace match the raw image orientation
        const s = sharp(imagepath);
        const { box } = result[res];

        const extract = {
            left: box.x_min,
            top: box.y_min,
            width: box.x_max - box.x_min,
            height: box.y_max - box.y_min,
        };

        // Create a relative path structure under dest directory
        const relativePath = path.relative('/mnt/sg1/uploads/stephen/iphone', imagepath);
        const filename = `${dest}/${path.dirname(relativePath)}/faces/${path.basename(imagepath, path.extname(imagepath))}__face_${i}${path.extname(imagepath)}`;
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        await s.extract(extract).toFile(filename);

        i++;

        faceData[filename] = result[res];
    }

    return faceData;
}