import { FaceRepository, FaceSimilarityRepository, FaceClusterRepository, FaceClusterMemberRepository, DetectedFace, db } from '../models/database';
import { Logger } from '../logger';
import { configManager } from './config-manager';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const logger = Logger.getInstance();

export interface ClusteringConfig {
    similarityThreshold: number;
    minClusterSize: number;
    maxClusterSize: number;
    algorithm: 'compreface_verification' | 'bbox_intersection';
    batchSize: number; // Process faces in batches to avoid overwhelming CompreFace
}

export interface ClusteringResult {
    clustersCreated: number;
    facesProcessed: number;
    similaritiesCalculated: number;
    timeElapsed: number;
    errors: string[];
}

export class EnhancedFaceClusteringService {
    private config: ClusteringConfig;
    private comprefaceVerifyUrl: string;
    private comprefaceApiKey: string;

    constructor(config: Partial<ClusteringConfig> = {}) {
        this.config = {
            similarityThreshold: config.similarityThreshold || 0.85, // Higher threshold for CompreFace
            minClusterSize: config.minClusterSize || 3, // More conservative
            maxClusterSize: config.maxClusterSize || 20,
            algorithm: config.algorithm || 'compreface_verification',
            batchSize: config.batchSize || 50
        };

        const comprefaceConfig = configManager.getCompreFace();
        this.comprefaceVerifyUrl = `${comprefaceConfig.baseUrl}/api/v1/verification/verify`;
        this.comprefaceApiKey = comprefaceConfig.recognizeApiKey || 'b6dd9990-6905-40b8-80d3-4655196ab139';
    }

    /**
     * Main clustering function using CompreFace Verification service
     */
    async clusterUnassignedFaces(): Promise<ClusteringResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        
        logger.info('Starting enhanced face clustering with CompreFace verification', { 
            config: this.config 
        });

        // Get all unassigned faces with valid face images
        const unassignedFaces = await this.getUnassignedFacesWithImages();
        
        if (unassignedFaces.length === 0) {
            logger.info('No unassigned faces found for clustering');
            return {
                clustersCreated: 0,
                facesProcessed: 0,
                similaritiesCalculated: 0,
                timeElapsed: Date.now() - startTime,
                errors
            };
        }

        logger.info(`Found ${unassignedFaces.length} unassigned faces for clustering`);

        // Process faces in batches to avoid overwhelming CompreFace
        let totalSimilarities = 0;
        let clustersCreated = 0;

        for (let i = 0; i < unassignedFaces.length; i += this.config.batchSize) {
            const batch = unassignedFaces.slice(i, i + this.config.batchSize);
            logger.info(`Processing batch ${Math.floor(i/this.config.batchSize) + 1} with ${batch.length} faces`);

            try {
                const batchSimilarities = await this.calculateBatchSimilarities(batch);
                totalSimilarities += batchSimilarities;

                const batchClusters = await this.performBatchClustering(batch);
                clustersCreated += batchClusters;
            } catch (error) {
                const errorMsg = `Batch processing failed: ${error instanceof Error ? error.message : String(error)}`;
                logger.error(errorMsg);
                errors.push(errorMsg);
            }
        }

        const timeElapsed = Date.now() - startTime;

        logger.info('Enhanced face clustering completed', {
            clustersCreated,
            facesProcessed: unassignedFaces.length,
            similaritiesCalculated: totalSimilarities,
            timeElapsed,
            errors: errors.length
        });

        return {
            clustersCreated,
            facesProcessed: unassignedFaces.length,
            similaritiesCalculated: totalSimilarities,
            timeElapsed,
            errors
        };
    }

    /**
     * Get unassigned faces that have valid face image files
     */
    private async getUnassignedFacesWithImages(): Promise<DetectedFace[]> {
        const faces = await db('detected_faces')
            .whereNull('person_id')
            .whereNotNull('face_image_path')
            .where('detection_confidence', '>=', 0.8) // Only high-quality face detections
            .orderBy('detection_confidence', 'desc')
            .limit(200); // Reasonable limit for clustering

        // Filter to faces with existing image files
        const validFaces = [];
        for (const face of faces) {
            const facePath = this.getFaceImagePath(face);
            if (fs.existsSync(facePath)) {
                validFaces.push(face);
            }
        }

        logger.info(`Filtered ${faces.length} faces to ${validFaces.length} with valid image files`);
        return validFaces;
    }

    /**
     * Calculate similarities for a batch of faces using CompreFace Verification
     */
    private async calculateBatchSimilarities(faces: DetectedFace[]): Promise<number> {
        let calculated = 0;
        const similarities: Array<{
            face_a_id: number;
            face_b_id: number;
            similarity_score: number;
            comparison_method: 'compreface_verification';
        }> = [];

        for (let i = 0; i < faces.length; i++) {
            for (let j = i + 1; j < faces.length; j++) {
                const faceA = faces[i];
                const faceB = faces[j];

                try {
                    // Check if similarity already exists
                    const existing = await FaceSimilarityRepository.findByFaces(
                        faceA.id!, 
                        faceB.id!, 
                        'compreface_verification'
                    );

                    if (existing) continue;

                    // Use CompreFace Verification to compare faces
                    const similarity = await this.compareFacesWithCompreFace(faceA, faceB);
                    
                    if (similarity !== null && similarity >= 0.5) { // Store meaningful similarities
                        similarities.push({
                            face_a_id: Math.min(faceA.id!, faceB.id!),
                            face_b_id: Math.max(faceA.id!, faceB.id!),
                            similarity_score: similarity,
                            comparison_method: 'compreface_verification'
                        });
                    }

                    calculated++;

                    // Rate limiting - don't overwhelm CompreFace
                    if (calculated % 10 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
                    }
                } catch (error) {
                    logger.error(`Error comparing faces ${faceA.id} and ${faceB.id}`, error);
                }
            }
        }

        // Batch insert similarities
        if (similarities.length > 0) {
            await FaceSimilarityRepository.batchCreate(similarities);
            logger.info(`Stored ${similarities.length} face similarities using CompreFace verification`);
        }

        return calculated;
    }

    /**
     * Compare two faces using CompreFace Verification service
     */
    private async compareFacesWithCompreFace(faceA: DetectedFace, faceB: DetectedFace): Promise<number | null> {
        try {
            const facePathA = this.getFaceImagePath(faceA);
            const facePathB = this.getFaceImagePath(faceB);

            if (!fs.existsSync(facePathA) || !fs.existsSync(facePathB)) {
                logger.warn(`Face image files missing: ${facePathA} or ${facePathB}`);
                return null;
            }

            const formData = new FormData();
            formData.append('source_image', fs.createReadStream(facePathA));
            formData.append('target_image', fs.createReadStream(facePathB));

            const response = await fetch(this.comprefaceVerifyUrl, {
                method: 'POST',
                headers: {
                    'x-api-key': this.comprefaceApiKey,
                    ...formData.getHeaders()
                },
                body: formData
            });

            if (!response.ok) {
                logger.error(`CompreFace verification failed: ${response.status} ${response.statusText}`);
                return null;
            }

            const result = await response.json() as any;
            
            // CompreFace verification returns similarity score
            if (result && typeof result.similarity === 'number') {
                return result.similarity;
            }

            logger.warn('CompreFace verification returned unexpected format', result);
            return null;
        } catch (error) {
            logger.error('Error in CompreFace verification', error);
            return null;
        }
    }

    /**
     * Get full path to face image file
     */
    private getFaceImagePath(face: DetectedFace): string {
        const processedDir = configManager.getStorage().processedDir;
        
        if (face.relative_face_path) {
            return path.join(processedDir, face.relative_face_path);
        } else if (face.face_image_path) {
            return path.join(processedDir, 'faces', face.face_image_path);
        } else {
            throw new Error(`Face ${face.id} has no valid image path`);
        }
    }

    /**
     * Perform clustering using computed similarities
     */
    private async performBatchClustering(faces: DetectedFace[]): Promise<number> {
        const processed = new Set<number>();
        let clustersCreated = 0;

        for (const face of faces) {
            if (processed.has(face.id!)) continue;

            // Find all faces similar to this one using stored similarities
            const similarFaces = await FaceSimilarityRepository.getSimilarFaces(
                face.id!,
                this.config.similarityThreshold,
                this.config.maxClusterSize
            );

            // Check if we have enough faces for a cluster
            if (similarFaces.length < (this.config.minClusterSize - 1)) {
                continue; // Not enough faces for a cluster
            }

            // Create cluster with meaningful name based on face characteristics
            const clusterName = `cluster_${new Date().toISOString().slice(0, 10)}_${uuidv4().slice(0, 8)}`;
            const clusterId = await FaceClusterRepository.create({
                cluster_name: clusterName,
                average_embedding: {}, // Could store CompreFace embeddings in future
                face_count: similarFaces.length + 1,
                avg_similarity: this.calculateAverageSimilarity(similarFaces),
                is_reviewed: false
            });

            // Add faces to cluster
            const members = [
                {
                    cluster_id: clusterId,
                    face_id: face.id!,
                    similarity_to_cluster: 1.0,
                    is_representative: true
                }
            ];

            // Add similar faces
            for (const similarFace of similarFaces) {
                if (!processed.has(similarFace.id)) {
                    members.push({
                        cluster_id: clusterId,
                        face_id: similarFace.id,
                        similarity_to_cluster: similarFace.similarity_score,
                        is_representative: false
                    });
                    processed.add(similarFace.id);
                }
            }

            await FaceClusterMemberRepository.batchCreate(members);

            // Mark all faces in this cluster as processed
            processed.add(face.id!);
            clustersCreated++;

            logger.info(`Created cluster ${clusterName} with ${members.length} faces (avg similarity: ${this.calculateAverageSimilarity(similarFaces).toFixed(3)})`);
        }

        return clustersCreated;
    }

    /**
     * Calculate average similarity for a group of faces
     */
    private calculateAverageSimilarity(faces: any[]): number {
        if (faces.length === 0) return 0;
        const totalSimilarity = faces.reduce((sum, face) => sum + face.similarity_score, 0);
        return totalSimilarity / faces.length;
    }

    /**
     * Find similar faces for batch assignment suggestions
     * This leverages the clustering data for immediate suggestions
     */
    async findSimilarFacesForBatchAssignment(
        recentlyAssignedFaceId: number, 
        personId: number,
        maxSuggestions: number = 5,
        minConfidence: number = 0.8
    ): Promise<any[]> {
        // First, check if the recently assigned face belongs to any cluster
        const clusterMembership = await db('face_cluster_members')
            .where('face_id', recentlyAssignedFaceId)
            .first();

        if (clusterMembership) {
            // Get other unassigned faces from the same cluster
            const clusterFaces = await db('face_cluster_members as fcm')
                .join('detected_faces as df', 'fcm.face_id', 'df.id')
                .join('images as i', 'df.image_id', 'i.id')
                .where('fcm.cluster_id', clusterMembership.cluster_id)
                .whereNull('df.person_id') // Still unassigned
                .where('fcm.similarity_to_cluster', '>=', minConfidence)
                .orderBy('fcm.similarity_to_cluster', 'desc')
                .limit(maxSuggestions)
                .select(
                    'df.*',
                    'fcm.similarity_to_cluster as cluster_similarity',
                    'i.filename',
                    'i.relative_media_path'
                );

            return clusterFaces.map(face => ({
                faceId: face.id,
                confidence: face.cluster_similarity,
                source: 'cluster_similarity',
                imageFilename: face.filename,
                faceImagePath: face.face_image_path || face.relative_face_path,
                mediaPath: face.relative_media_path
            }));
        }

        // Fallback: Use direct similarity comparison if no cluster exists
        const similarFaces = await FaceSimilarityRepository.getSimilarFaces(
            recentlyAssignedFaceId,
            minConfidence,
            maxSuggestions
        );

        return similarFaces.map(face => ({
            faceId: face.id,
            confidence: face.similarity_score,
            source: 'direct_similarity',
            imageFilename: face.filename || 'unknown',
            faceImagePath: face.face_image_path || face.relative_face_path
        }));
    }
}