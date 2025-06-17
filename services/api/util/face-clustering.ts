import { FaceRepository, FaceSimilarityRepository, FaceClusterRepository, FaceClusterMemberRepository, DetectedFace, db } from '../models/database';
import { Logger } from '../logger';
import { configManager } from './config-manager';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

export interface ClusteringConfig {
    similarityThreshold: number;
    minClusterSize: number;
    maxClusterSize: number;
    algorithm: 'bbox_intersection' | 'embedding_distance';
}

export interface ClusteringResult {
    clustersCreated: number;
    facesProcessed: number;
    similaritiesCalculated: number;
    timeElapsed: number;
}

export class FaceClusteringService {
    private config: ClusteringConfig;

    constructor(config: Partial<ClusteringConfig> = {}) {
        this.config = {
            similarityThreshold: config.similarityThreshold || 0.5, // Lowered for testing
            minClusterSize: config.minClusterSize || 2,
            maxClusterSize: config.maxClusterSize || 50,
            algorithm: config.algorithm || 'bbox_intersection'
        };
    }

    /**
     * Main clustering function - clusters all unassigned faces
     */
    async clusterUnassignedFaces(): Promise<ClusteringResult> {
        const startTime = Date.now();
        
        logger.info('Starting face clustering process', { 
            config: this.config 
        });

        // Get all unassigned faces (limit to 10 for testing)
        const unassignedFaces = await FaceRepository.getUnidentifiedFaces(10, false, {});
        
        if (unassignedFaces.length === 0) {
            logger.info('No unassigned faces found for clustering');
            return {
                clustersCreated: 0,
                facesProcessed: 0,
                similaritiesCalculated: 0,
                timeElapsed: Date.now() - startTime
            };
        }

        logger.info(`Found ${unassignedFaces.length} unassigned faces for clustering`);

        // Calculate pairwise similarities
        const similaritiesCalculated = await this.calculatePairwiseSimilarities(unassignedFaces);

        // Perform clustering using similarity matrix
        const clustersCreated = await this.performClustering(unassignedFaces);

        const timeElapsed = Date.now() - startTime;

        logger.info('Face clustering completed', {
            clustersCreated,
            facesProcessed: unassignedFaces.length,
            similaritiesCalculated,
            timeElapsed
        });

        return {
            clustersCreated,
            facesProcessed: unassignedFaces.length,
            similaritiesCalculated,
            timeElapsed
        };
    }

    /**
     * Calculate similarities between all pairs of faces
     */
    private async calculatePairwiseSimilarities(faces: DetectedFace[]): Promise<number> {
        logger.info(`Calculating pairwise similarities for ${faces.length} faces`);
        
        try {
            const similarities: Array<{
                face_a_id: number;
                face_b_id: number;
                similarity_score: number;
                comparison_method: 'embedding_distance' | 'compreface_api' | 'manual' | 'bbox_intersection';
            }> = [];

            let calculated = 0;

            logger.info(`Starting face pair loops with ${faces.length} faces`);
            console.log(`CLUSTER DEBUG: Starting face pair loops with ${faces.length} faces`);
            for (let i = 0; i < faces.length; i++) {
                console.log(`CLUSTER DEBUG: Processing face ${i} of ${faces.length}`);
                for (let j = i + 1; j < faces.length; j++) {
                    const faceA = faces[i];
                    const faceB = faces[j];
                    
                    console.log(`CLUSTER DEBUG: Face A: id=${faceA.id}, coords=(${faceA.x_min},${faceA.y_min})-(${faceA.x_max},${faceA.y_max})`);
                    console.log(`CLUSTER DEBUG: Face B: id=${faceB.id}, coords=(${faceB.x_min},${faceB.y_min})-(${faceB.x_max},${faceB.y_max})`);

                    try {
                        // Check if similarity already exists
                        logger.debug(`Checking existing similarity between faces ${faceA.id} and ${faceB.id}`);
                        const existing = await FaceSimilarityRepository.findByFaces(
                            faceA.id!, 
                            faceB.id!, 
                            this.config.algorithm
                        );
                        logger.debug(`Existing similarity check complete: ${existing ? 'found' : 'not found'}`);

                        if (existing) continue;

                        // Calculate similarity based on algorithm
                        logger.debug(`Calculating similarity between faces ${faceA.id} and ${faceB.id}`);
                        let similarity: number;
                        try {
                            if (this.config.algorithm === 'bbox_intersection') {
                                similarity = this.calculateBoundingBoxSimilarity(faceA, faceB);
                            } else {
                                // For embedding_distance, we'd need face embeddings
                                // Fall back to bbox for now
                                similarity = this.calculateBoundingBoxSimilarity(faceA, faceB);
                            }
                            console.log(`CLUSTER DEBUG: Calculated similarity between faces ${faceA.id} and ${faceB.id}: ${similarity}`);
                            logger.debug(`Calculated similarity: ${similarity}`);
                        } catch (simError) {
                            logger.error(`Error calculating similarity between faces ${faceA.id} and ${faceB.id}:`, simError);
                            throw simError;
                        }

                        // Only store similarities above a minimum threshold to save space
                        // Temporarily lowered threshold to debug clustering
                        if (similarity >= 0.1) {
                            similarities.push({
                                face_a_id: Math.min(faceA.id!, faceB.id!), // Ensure face_a_id < face_b_id
                                face_b_id: Math.max(faceA.id!, faceB.id!),
                                similarity_score: similarity,
                                comparison_method: this.config.algorithm === 'bbox_intersection' ? 'bbox_intersection' : 'embedding_distance'
                            });
                            logger.debug(`Added similarity to batch: ${faceA.id}-${faceB.id} = ${similarity}`);
                        }

                        calculated++;
                    } catch (pairError) {
                        logger.error(`Error calculating similarity between faces ${faceA.id} and ${faceB.id}`, pairError);
                        // Continue with next pair
                    }
                }

                // Log progress for large datasets
                if (i % 10 === 0 && i > 0) {
                    logger.debug(`Similarity calculation progress: ${i}/${faces.length} faces processed`);
                }
            }

            // Batch insert similarities
            console.log(`CLUSTER DEBUG: About to insert ${similarities.length} similarities`);
            if (similarities.length > 0) {
                try {
                    console.log(`CLUSTER DEBUG: Sample similarity data:`, similarities[0]);
                    await FaceSimilarityRepository.batchCreate(similarities);
                    console.log(`CLUSTER DEBUG: Successfully stored ${similarities.length} similarities`);
                    logger.info(`Stored ${similarities.length} face similarities`);
                } catch (insertError) {
                    console.log(`CLUSTER DEBUG: Error inserting similarities:`, insertError);
                    console.log(`CLUSTER DEBUG: Error message:`, insertError instanceof Error ? insertError.message : String(insertError));
                    console.log(`CLUSTER DEBUG: Error stack:`, insertError instanceof Error ? insertError.stack : undefined);
                    logger.error(`Error inserting similarities`, insertError);
                    throw insertError;
                }
            } else {
                console.log(`CLUSTER DEBUG: No similarities to insert`);
            }

            return calculated;
        } catch (error) {
            logger.error('Error in calculatePairwiseSimilarities', error);
            logger.error('Full error details:', {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : undefined
            });
            throw error;
        }
    }

    /**
     * Calculate similarity based on bounding box intersection and size
     * NOTE: This is a placeholder algorithm. For proper face clustering across different images,
     * we need face embeddings from CompreFace or another face recognition model.
     */
    private calculateBoundingBoxSimilarity(faceA: DetectedFace, faceB: DetectedFace): number {
        // For cross-image face clustering, bounding box intersection doesn't work
        // because faces are from different images and won't overlap spatially.
        
        // Temporary approach: Use face size similarity as a weak proxy
        const areaA = (faceA.x_max - faceA.x_min) * (faceA.y_max - faceA.y_min);
        const areaB = (faceB.x_max - faceB.x_min) * (faceB.y_max - faceB.y_max);
        
        // Size similarity (faces should be roughly similar size)
        const sizeSimilarity = Math.min(areaA, areaB) / Math.max(areaA, areaB);
        
        // Add some randomness to create test clusters for debugging
        // In production, this should be replaced with actual face embedding comparison
        const randomFactor = 0.3 + (Math.random() * 0.4); // 0.3 to 0.7 range
        
        // Combine size similarity with random factor
        // This will create some clusters for testing the clustering logic
        return (sizeSimilarity * 0.6) + (randomFactor * 0.4);
    }

    /**
     * Perform actual clustering using similarity matrix
     */
    private async performClustering(faces: DetectedFace[]): Promise<number> {
        logger.info('Starting clustering algorithm');
        console.log(`CLUSTER DEBUG: performClustering called with ${faces.length} faces`);

        const processed = new Set<number>();
        let clustersCreated = 0;

        for (const face of faces) {
            if (processed.has(face.id!)) continue;

            // Find all faces similar to this one
            console.log(`CLUSTER DEBUG: Looking for similar faces to face ${face.id} with threshold ${this.config.similarityThreshold}`);
            const similarFaces = await FaceSimilarityRepository.getSimilarFaces(
                face.id!,
                this.config.similarityThreshold,
                this.config.maxClusterSize
            );
            console.log(`CLUSTER DEBUG: Found ${similarFaces.length} similar faces to face ${face.id}`);

            // Check if we have enough faces for a cluster
            if (similarFaces.length < (this.config.minClusterSize - 1)) {
                console.log(`CLUSTER DEBUG: Not enough similar faces for clustering: ${similarFaces.length} < ${this.config.minClusterSize - 1}`);
                continue; // Not enough faces for a cluster
            }

            // Create cluster
            const clusterName = `cluster_${uuidv4().slice(0, 8)}`;
            const clusterId = await FaceClusterRepository.create({
                cluster_name: clusterName,
                average_embedding: {}, // Empty for bbox-based clustering
                face_count: similarFaces.length + 1,
                avg_similarity: this.calculateAverageSimilarity(similarFaces),
                is_reviewed: false
            });

            // Add faces to cluster
            const members = [
                {
                    cluster_id: clusterId,
                    face_id: face.id!,
                    similarity_to_cluster: 1.0, // Original face has perfect similarity
                    is_representative: true // First face is representative
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

            logger.debug(`Created cluster ${clusterName} with ${members.length} faces`);
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
     * Get clustering statistics
     */
    async getClusteringStats(): Promise<any> {
        const [
            totalClusters,
            reviewedClusters,
            unassignedFaces,
            clusteredFaces,
            avgClusterSize
        ] = await Promise.all([
            db('face_clusters').count('* as count').first(),
            db('face_clusters').where('is_reviewed', true).count('* as count').first(),
            db('detected_faces').whereNull('person_id').count('* as count').first(),
            db('face_cluster_members').count('* as count').first(),
            db('face_clusters').avg('face_count as avg').first()
        ]);

        return {
            totalClusters: Number(totalClusters?.count || 0),
            reviewedClusters: Number(reviewedClusters?.count || 0),
            unassignedFaces: Number(unassignedFaces?.count || 0),
            clusteredFaces: Number(clusteredFaces?.count || 0),
            avgClusterSize: Number(avgClusterSize?.avg || 0),
            pendingReview: Number(totalClusters?.count || 0) - Number(reviewedClusters?.count || 0)
        };
    }

    /**
     * Rebuild clusters from scratch
     */
    async rebuildAllClusters(): Promise<ClusteringResult> {
        logger.info('Rebuilding all face clusters');

        // Clear existing clusters and ALL similarities
        await db('face_cluster_members').del();
        await db('face_clusters').del();
        await db('face_similarities').del(); // Clear ALL similarities, not just specific method

        // Rebuild
        return this.clusterUnassignedFaces();
    }

    /**
     * Clean up orphaned similarities (faces that no longer exist)
     */
    async cleanupOrphanedSimilarities(): Promise<number> {
        const result = await db.raw(`
            DELETE fs FROM face_similarities fs
            LEFT JOIN detected_faces df_a ON fs.face_a_id = df_a.id
            LEFT JOIN detected_faces df_b ON fs.face_b_id = df_b.id
            WHERE df_a.id IS NULL OR df_b.id IS NULL
        `);

        const deleted = result[0].affectedRows || 0;
        
        if (deleted > 0) {
            logger.info(`Cleaned up ${deleted} orphaned face similarities`);
        }

        return deleted;
    }
}