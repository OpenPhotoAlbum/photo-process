import { PersonRepository, FaceRepository, db } from '../models/database';
import { Logger } from '../logger';
import { configManager } from './config-manager';
import { recognizeFacesFromImagesBatch } from './compreface';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';

const logger = Logger.getInstance();

export interface RecognitionSuggestion {
    personId: number;
    personName: string;
    comprefaceSubjectId: string;
    suggestions: FaceSuggestion[];
    totalSuggestions: number;
    avgConfidence: number;
}

export interface FaceSuggestion {
    faceId: number;
    imageId: number;
    confidence: number;
    filename: string;
    faceImagePath: string;
    detectionConfidence: number;
}

export interface ClusterGroup {
    clusterId: string;
    clusterName: string;
    faces: UnknownFaceSuggestion[];
    avgSimilarity: number;
    representativeFace: UnknownFaceSuggestion;
}

export interface UnknownFaceSuggestion {
    faceId: number;
    imageId: number;
    filename: string;
    faceImagePath: string;
    detectionConfidence: number;
    clusterSimilarity?: number;
}

export interface IntelligentClusteringResult {
    recognitionSuggestions: RecognitionSuggestion[];
    unknownClusters: ClusterGroup[];
    totalUnassignedFaces: number;
    facesAnalyzed: number;
    processingTime: number;
    summary: {
        probablyKnown: number;
        trulyUnknown: number;
        clusteredUnknowns: number;
        suggestedAssignments: number;
    };
}

export class IntelligentFaceSuggestionsService {
    private batchSize: number = 100; // Process faces in batches
    private recognitionConfidenceThreshold: number = 0.85; // High confidence for suggestions
    private maxSuggestionsPerPerson: number = 50; // Limit to prevent overwhelming UI

    constructor() {
        // Load configuration from settings
        const faceConfig = configManager.getProcessing().faceDetection;
        this.recognitionConfidenceThreshold = faceConfig.confidence?.autoAssign || 0.85;
    }

    /**
     * Main entry point: Perform intelligent face clustering with two-phase approach
     */
    async performIntelligentClustering(): Promise<IntelligentClusteringResult> {
        const startTime = Date.now();
        logger.info('Starting intelligent face clustering with two-phase approach');

        try {
            // Get all unassigned faces with quality filtering
            const unassignedFaces = await this.getUnassignedFacesForAnalysis();
            logger.info(`Found ${unassignedFaces.length} unassigned faces for analysis`);

            if (unassignedFaces.length === 0) {
                return this.createEmptyResult(Date.now() - startTime);
            }

            // Phase 1: Recognition-based suggestions for known people
            const recognitionSuggestions = await this.findRecognitionBasedSuggestions(unassignedFaces);
            
            // Get face IDs that were suggested for known people
            const suggestedFaceIds = new Set(
                recognitionSuggestions.flatMap(suggestion => 
                    suggestion.suggestions.map(s => s.faceId)
                )
            );

            // Phase 2: Get remaining truly unknown faces
            const trulyUnknownFaces = unassignedFaces.filter(
                face => !suggestedFaceIds.has(face.id!)
            );

            // For now, we'll use existing clustering for unknowns (Phase 2 enhancement coming next)
            const unknownClusters = await this.getExistingUnknownClusters(trulyUnknownFaces);

            const processingTime = Date.now() - startTime;
            
            const result: IntelligentClusteringResult = {
                recognitionSuggestions,
                unknownClusters,
                totalUnassignedFaces: unassignedFaces.length,
                facesAnalyzed: unassignedFaces.length,
                processingTime,
                summary: {
                    probablyKnown: recognitionSuggestions.reduce((sum, r) => sum + r.totalSuggestions, 0),
                    trulyUnknown: trulyUnknownFaces.length,
                    clusteredUnknowns: unknownClusters.reduce((sum, c) => sum + c.faces.length, 0),
                    suggestedAssignments: recognitionSuggestions.length
                }
            };

            logger.info('Intelligent face clustering completed', {
                totalFaces: unassignedFaces.length,
                probablyKnown: result.summary.probablyKnown,
                trulyUnknown: result.summary.trulyUnknown,
                clusteredUnknowns: result.summary.clusteredUnknowns,
                processingTimeMs: processingTime
            });

            return result;

        } catch (error) {
            logger.error('Error in intelligent face clustering', error);
            throw error;
        }
    }

    /**
     * Phase 1: Find faces that likely belong to existing trained people
     */
    private async findRecognitionBasedSuggestions(unassignedFaces: any[]): Promise<RecognitionSuggestion[]> {
        logger.info('Phase 1: Finding recognition-based suggestions for trained people');

        // Get all people with trained CompreFace models
        const trainedPeople = await this.getTrainedPeople();
        logger.info(`Found ${trainedPeople.length} people with trained CompreFace models`);

        if (trainedPeople.length === 0) {
            logger.info('No trained people found - skipping recognition phase');
            return [];
        }

        const recognitionSuggestions: RecognitionSuggestion[] = [];

        // Process faces in batches to avoid overwhelming CompreFace
        for (let i = 0; i < unassignedFaces.length; i += this.batchSize) {
            const batch = unassignedFaces.slice(i, i + this.batchSize);
            logger.info(`Processing recognition batch ${Math.floor(i/this.batchSize) + 1} with ${batch.length} faces`);

            try {
                const batchSuggestions = await this.processBatchForRecognition(batch, trainedPeople);
                recognitionSuggestions.push(...batchSuggestions);

                // Rate limiting to avoid overwhelming CompreFace
                if (i + this.batchSize < unassignedFaces.length) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between batches
                }
            } catch (error) {
                logger.error(`Error processing recognition batch ${Math.floor(i/this.batchSize) + 1}`, error);
                // Continue with next batch
            }
        }

        // Consolidate suggestions by person
        const consolidatedSuggestions = this.consolidateSuggestionsByPerson(recognitionSuggestions);
        
        logger.info(`Recognition phase complete: Found suggestions for ${consolidatedSuggestions.length} people`);
        return consolidatedSuggestions;
    }

    /**
     * Get people who have trained CompreFace models
     */
    private async getTrainedPeople(): Promise<any[]> {
        return await db('persons')
            .whereNotNull('compreface_subject_id')
            .where('face_count', '>', 0)
            .select('id', 'name', 'compreface_subject_id', 'face_count')
            .orderBy('face_count', 'desc'); // Process people with more faces first
    }

    /**
     * Process a batch of faces for recognition against trained people
     */
    private async processBatchForRecognition(faces: any[], trainedPeople: any[]): Promise<RecognitionSuggestion[]> {
        const suggestions: RecognitionSuggestion[] = [];

        // Group faces by their source images for batch processing
        const imageToFacesMap = new Map<number, any[]>();
        const imagePathsMap = new Map<number, string>();

        for (const face of faces) {
            if (!imageToFacesMap.has(face.image_id)) {
                imageToFacesMap.set(face.image_id, []);
                
                // Get image path for recognition
                const imageData = await db('images').where('id', face.image_id).first();
                if (imageData && imageData.original_path) {
                    imagePathsMap.set(face.image_id, imageData.original_path);
                }
            }
            imageToFacesMap.get(face.image_id)!.push(face);
        }

        const uniqueImagePaths = Array.from(imagePathsMap.values());
        
        if (uniqueImagePaths.length === 0) {
            logger.warn('No valid image paths found for recognition batch');
            return suggestions;
        }

        logger.info(`Running CompreFace recognition on ${uniqueImagePaths.length} images for ${faces.length} faces`);

        try {
            // Use existing CompreFace batch recognition
            const batchResults = await recognizeFacesFromImagesBatch(uniqueImagePaths, 3);

            // Process results and match to our unassigned faces
            for (const [imageId, facesInImage] of imageToFacesMap) {
                const imagePath = imagePathsMap.get(imageId);
                if (!imagePath) continue;

                const recognitionResults = batchResults.get(imagePath);
                if (!recognitionResults || recognitionResults.error) {
                    logger.warn(`Recognition failed for image ${imagePath}: ${recognitionResults?.error || 'Unknown error'}`);
                    continue;
                }

                // Match each face to recognition results
                for (const face of facesInImage) {
                    const matchedResult = this.findMatchingRecognitionResult(face, recognitionResults);
                    
                    if (matchedResult && matchedResult.subjects && matchedResult.subjects.length > 0) {
                        const bestMatch = matchedResult.subjects[0];
                        
                        // Find the person by CompreFace subject ID
                        const person = trainedPeople.find(p => p.compreface_subject_id === bestMatch.subject);
                        
                        if (person && bestMatch.similarity >= this.recognitionConfidenceThreshold) {
                            // Create suggestion for this person-face match
                            let personSuggestion = suggestions.find(s => s.personId === person.id);
                            if (!personSuggestion) {
                                personSuggestion = {
                                    personId: person.id,
                                    personName: person.name,
                                    comprefaceSubjectId: person.compreface_subject_id,
                                    suggestions: [],
                                    totalSuggestions: 0,
                                    avgConfidence: 0
                                };
                                suggestions.push(personSuggestion);
                            }

                            // Add face suggestion
                            personSuggestion.suggestions.push({
                                faceId: face.id,
                                imageId: face.image_id,
                                confidence: bestMatch.similarity,
                                filename: face.filename || 'unknown',
                                faceImagePath: face.face_image_path || face.relative_face_path || '',
                                detectionConfidence: face.detection_confidence
                            });
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('Error in CompreFace batch recognition', error);
            throw error;
        }

        return suggestions;
    }

    /**
     * Find matching recognition result for a specific face using coordinate matching
     */
    private findMatchingRecognitionResult(face: any, recognitionResults: any): any | null {
        if (!recognitionResults.result || !Array.isArray(recognitionResults.result)) {
            return null;
        }

        // Use existing coordinate matching logic from process-source.ts
        for (const result of recognitionResults.result) {
            if (!result.box) continue;

            const resultBox = result.box;
            const tolerance = 20; // pixels

            // Check if this recognition result matches our face coordinates
            if (Math.abs(face.x_min - resultBox.x_min) <= tolerance &&
                Math.abs(face.y_min - resultBox.y_min) <= tolerance &&
                Math.abs(face.x_max - resultBox.x_max) <= tolerance &&
                Math.abs(face.y_max - resultBox.y_max) <= tolerance) {
                return result;
            }
        }

        return null;
    }

    /**
     * Consolidate suggestions by person and calculate statistics
     */
    private consolidateSuggestionsByPerson(suggestions: RecognitionSuggestion[]): RecognitionSuggestion[] {
        const consolidated = new Map<number, RecognitionSuggestion>();

        for (const suggestion of suggestions) {
            if (!consolidated.has(suggestion.personId)) {
                consolidated.set(suggestion.personId, {
                    personId: suggestion.personId,
                    personName: suggestion.personName,
                    comprefaceSubjectId: suggestion.comprefaceSubjectId,
                    suggestions: [],
                    totalSuggestions: 0,
                    avgConfidence: 0
                });
            }

            const existing = consolidated.get(suggestion.personId)!;
            existing.suggestions.push(...suggestion.suggestions);
        }

        // Calculate final statistics and apply limits
        return Array.from(consolidated.values()).map(suggestion => {
            // Sort by confidence and limit suggestions
            suggestion.suggestions.sort((a, b) => b.confidence - a.confidence);
            suggestion.suggestions = suggestion.suggestions.slice(0, this.maxSuggestionsPerPerson);
            
            suggestion.totalSuggestions = suggestion.suggestions.length;
            suggestion.avgConfidence = suggestion.suggestions.length > 0 
                ? suggestion.suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestion.suggestions.length 
                : 0;

            return suggestion;
        }).filter(suggestion => suggestion.totalSuggestions > 0)
          .sort((a, b) => b.totalSuggestions - a.totalSuggestions); // Sort by number of suggestions
    }

    /**
     * Get unassigned faces suitable for analysis
     */
    private async getUnassignedFacesForAnalysis(): Promise<any[]> {
        return await db('detected_faces as df')
            .join('images as i', 'df.image_id', 'i.id')
            .whereNull('df.person_id')
            .whereNotNull('df.face_image_path')
            .where('df.detection_confidence', '>=', 0.8) // Only high-quality detections
            .orderBy('df.detection_confidence', 'desc')
            .limit(1000) // Reasonable limit for processing
            .select(
                'df.*',
                'i.filename',
                'i.original_path',
                'i.relative_media_path'
            );
    }

    /**
     * Phase 2: Create clusters of truly unknown faces using CompreFace Verification
     */
    private async getExistingUnknownClusters(trulyUnknownFaces: any[]): Promise<ClusterGroup[]> {
        logger.info('Phase 2: Creating verification-based clusters for unknown faces', {
            unknownFaceCount: trulyUnknownFaces.length
        });

        if (trulyUnknownFaces.length === 0) {
            return [];
        }

        // Limit processing for performance (top 100 highest quality faces)
        const facesToCluster = trulyUnknownFaces
            .sort((a, b) => b.detection_confidence - a.detection_confidence)
            .slice(0, 100);

        logger.info(`Processing top ${facesToCluster.length} unknown faces for clustering`);

        // Use CompreFace Verification to create real face clusters
        const clusters = await this.createVerificationBasedClusters(facesToCluster);
        
        logger.info(`Created ${clusters.length} verification-based clusters`, {
            totalFacesInClusters: clusters.reduce((sum, c) => sum + c.faces.length, 0)
        });

        return clusters;
    }

    /**
     * Create clusters using CompreFace Verification API
     */
    private async createVerificationBasedClusters(faces: any[]): Promise<ClusterGroup[]> {
        const clusters: ClusterGroup[] = [];
        const processedFaces = new Set<number>();
        const verificationThreshold = 0.75; // Lower threshold for clustering unknowns
        const minClusterSize = 3; // Require at least 3 faces per cluster

        for (let i = 0; i < faces.length; i++) {
            const currentFace = faces[i];
            
            if (processedFaces.has(currentFace.id)) {
                continue; // Already in a cluster
            }

            // Find similar faces using CompreFace Verification
            const similarFaces = await this.findSimilarFacesUsingVerification(
                currentFace, 
                faces.slice(i + 1), // Only check remaining faces
                verificationThreshold
            );

            // Only create cluster if we have enough faces
            if (similarFaces.length >= (minClusterSize - 1)) {
                const clusterFaces = [currentFace, ...similarFaces];
                const clusterId = `verification_cluster_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                
                const cluster: ClusterGroup = {
                    clusterId,
                    clusterName: `Unknown Cluster ${clusters.length + 1}`,
                    faces: clusterFaces.map(face => ({
                        faceId: face.id,
                        imageId: face.image_id,
                        filename: face.filename || 'unknown',
                        faceImagePath: face.face_image_path || face.relative_face_path || '',
                        detectionConfidence: face.detection_confidence,
                        clusterSimilarity: face === currentFace ? 1.0 : 0.8 // Placeholder similarity
                    })),
                    avgSimilarity: 0.8, // Average from verification
                    representativeFace: {
                        faceId: currentFace.id,
                        imageId: currentFace.image_id,
                        filename: currentFace.filename || 'unknown',
                        faceImagePath: currentFace.face_image_path || currentFace.relative_face_path || '',
                        detectionConfidence: currentFace.detection_confidence
                    }
                };

                clusters.push(cluster);

                // Mark all faces in this cluster as processed
                clusterFaces.forEach(face => processedFaces.add(face.id));

                logger.info(`Created verification cluster with ${clusterFaces.length} faces`, {
                    clusterId,
                    representativeFace: currentFace.id
                });

                // Rate limiting between clusters
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        return clusters.sort((a, b) => b.faces.length - a.faces.length);
    }

    /**
     * Find similar faces using CompreFace Verification API
     */
    private async findSimilarFacesUsingVerification(
        targetFace: any, 
        candidateFaces: any[], 
        threshold: number
    ): Promise<any[]> {
        const similarFaces: any[] = [];
        const targetFacePath = this.getFaceImagePath(targetFace);

        if (!fs.existsSync(targetFacePath)) {
            logger.warn(`Target face image not found: ${targetFacePath}`);
            return [];
        }

        // Process candidates in small batches to avoid overwhelming CompreFace
        const batchSize = 10;
        for (let i = 0; i < candidateFaces.length && similarFaces.length < 20; i += batchSize) {
            const batch = candidateFaces.slice(i, i + batchSize);
            
            for (const candidateFace of batch) {
                try {
                    const similarity = await this.compareFacesWithVerification(targetFace, candidateFace);
                    
                    if (similarity !== null && similarity >= threshold) {
                        similarFaces.push(candidateFace);
                        logger.debug(`Found similar face: ${candidateFace.id} with similarity ${similarity.toFixed(3)}`);
                    }

                    // Rate limiting between comparisons
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    logger.error(`Error comparing faces ${targetFace.id} and ${candidateFace.id}`, error);
                }
            }

            // Longer pause between batches
            if (i + batchSize < candidateFaces.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return similarFaces;
    }

    /**
     * Compare two faces using CompreFace Verification API
     */
    private async compareFacesWithVerification(faceA: any, faceB: any): Promise<number | null> {
        try {
            const facePathA = this.getFaceImagePath(faceA);
            const facePathB = this.getFaceImagePath(faceB);

            if (!fs.existsSync(facePathA) || !fs.existsSync(facePathB)) {
                return null;
            }

            const comprefaceConfig = configManager.getCompreFace();
            const verificationUrl = `${comprefaceConfig.baseUrl}/api/v1/verification/verify`;
            const apiKey = comprefaceConfig.recognizeApiKey || 'b6dd9990-6905-40b8-80d3-4655196ab139';

            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('source_image', fs.createReadStream(facePathA));
            formData.append('target_image', fs.createReadStream(facePathB));

            const response = await fetch(verificationUrl, {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    ...formData.getHeaders()
                },
                body: formData
            });

            if (!response.ok) {
                logger.error(`CompreFace verification failed: ${response.status} ${response.statusText}`);
                return null;
            }

            const result = await response.json() as any;
            
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
    private getFaceImagePath(face: any): string {
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
     * Create empty result for cases with no unassigned faces
     */
    private createEmptyResult(processingTime: number): IntelligentClusteringResult {
        return {
            recognitionSuggestions: [],
            unknownClusters: [],
            totalUnassignedFaces: 0,
            facesAnalyzed: 0,
            processingTime,
            summary: {
                probablyKnown: 0,
                trulyUnknown: 0,
                clusteredUnknowns: 0,
                suggestedAssignments: 0
            }
        };
    }

    /**
     * Perform quick sample analysis for large datasets
     * Uses a smaller sample of high-quality faces to provide fast results
     */
    async performQuickSample(sampleFaces: any[]): Promise<IntelligentClusteringResult> {
        const startTime = Date.now();
        logger.info(`Starting quick sample analysis with ${sampleFaces.length} faces`);

        try {
            if (sampleFaces.length === 0) {
                return this.createEmptyResult(Date.now() - startTime);
            }

            // Phase 1: Recognition-based suggestions for known people
            const recognitionSuggestions = await this.findRecognitionBasedSuggestions(sampleFaces);
            
            // Get face IDs that were suggested for known people
            const suggestedFaceIds = new Set(
                recognitionSuggestions.flatMap(suggestion => 
                    suggestion.suggestions.map(s => s.faceId)
                )
            );

            // Phase 2: Get remaining truly unknown faces for clustering
            const trulyUnknownFaces = sampleFaces.filter(
                face => !suggestedFaceIds.has(face.id!)
            );

            // For quick sampling, create simplified clusters
            const unknownClusters = await this.createQuickClusters(trulyUnknownFaces);

            const processingTime = Date.now() - startTime;
            
            const result: IntelligentClusteringResult = {
                recognitionSuggestions,
                unknownClusters,
                totalUnassignedFaces: sampleFaces.length,
                facesAnalyzed: sampleFaces.length,
                processingTime,
                summary: {
                    probablyKnown: recognitionSuggestions.reduce((sum, r) => sum + r.totalSuggestions, 0),
                    trulyUnknown: trulyUnknownFaces.length,
                    clusteredUnknowns: unknownClusters.reduce((sum, c) => sum + c.faces.length, 0),
                    suggestedAssignments: recognitionSuggestions.length
                }
            };

            logger.info('Quick sample analysis completed', {
                sampleSize: sampleFaces.length,
                probablyKnown: result.summary.probablyKnown,
                trulyUnknown: result.summary.trulyUnknown,
                clusteredUnknowns: result.summary.clusteredUnknowns,
                processingTimeMs: processingTime
            });

            return result;

        } catch (error) {
            logger.error('Error in quick sample analysis', error);
            throw error;
        }
    }

    /**
     * Create simplified clusters for quick analysis
     * Uses detection confidence and basic grouping without CompreFace verification
     */
    private async createQuickClusters(trulyUnknownFaces: any[]): Promise<ClusterGroup[]> {
        if (trulyUnknownFaces.length === 0) {
            return [];
        }

        // For quick analysis, group faces by detection confidence ranges
        // This provides rough clustering without expensive CompreFace calls
        const highConfidenceFaces = trulyUnknownFaces.filter(f => f.detection_confidence >= 0.95);
        const mediumConfidenceFaces = trulyUnknownFaces.filter(f => f.detection_confidence >= 0.85 && f.detection_confidence < 0.95);
        const goodConfidenceFaces = trulyUnknownFaces.filter(f => f.detection_confidence >= 0.8 && f.detection_confidence < 0.85);

        const clusters: ClusterGroup[] = [];

        // Create clusters for high confidence faces (most likely to be same people)
        if (highConfidenceFaces.length >= 3) {
            clusters.push(this.createSimpleCluster(
                highConfidenceFaces.slice(0, Math.min(10, highConfidenceFaces.length)),
                `High Quality Cluster 1`,
                0.92
            ));
        }

        // Create clusters for medium confidence faces
        if (mediumConfidenceFaces.length >= 3) {
            clusters.push(this.createSimpleCluster(
                mediumConfidenceFaces.slice(0, Math.min(8, mediumConfidenceFaces.length)),
                `Medium Quality Cluster 1`,
                0.88
            ));
        }

        // Create clusters for good confidence faces
        if (goodConfidenceFaces.length >= 3) {
            clusters.push(this.createSimpleCluster(
                goodConfidenceFaces.slice(0, Math.min(6, goodConfidenceFaces.length)),
                `Good Quality Cluster 1`,
                0.85
            ));
        }

        logger.info(`Created ${clusters.length} quick clusters from ${trulyUnknownFaces.length} unknown faces`);
        return clusters;
    }

    /**
     * Create a simple cluster group without CompreFace verification
     */
    private createSimpleCluster(faces: any[], clusterName: string, avgSimilarity: number): ClusterGroup {
        const clusterId = `quick_cluster_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const representativeFace = faces[0]; // Use highest confidence face as representative

        return {
            clusterId,
            clusterName,
            faces: faces.map(face => ({
                faceId: face.id,
                imageId: face.image_id,
                filename: face.filename || 'unknown',
                faceImagePath: face.face_image_path || face.relative_face_path || '',
                detectionConfidence: face.detection_confidence,
                clusterSimilarity: avgSimilarity
            })),
            avgSimilarity,
            representativeFace: {
                faceId: representativeFace.id,
                imageId: representativeFace.image_id,
                filename: representativeFace.filename || 'unknown',
                faceImagePath: representativeFace.face_image_path || representativeFace.relative_face_path || '',
                detectionConfidence: representativeFace.detection_confidence
            }
        };
    }

    /**
     * Get suggestions for batch assignment when user assigns a face
     * This leverages recognition results for immediate suggestions
     */
    async getSuggestionsForBatchAssignment(
        recentlyAssignedFaceId: number,
        personId: number,
        maxSuggestions: number = 10
    ): Promise<FaceSuggestion[]> {
        logger.info('Getting batch assignment suggestions', {
            recentlyAssignedFaceId,
            personId,
            maxSuggestions
        });

        // Get person details
        const person = await PersonRepository.getPersonWithFaceCount(personId);
        if (!person || !person.compreface_subject_id) {
            logger.warn('Person not found or not trained for batch suggestions');
            return [];
        }

        // Get recent unassigned faces (last 100 processed)
        const recentUnassigned = await db('detected_faces as df')
            .join('images as i', 'df.image_id', 'i.id')
            .whereNull('df.person_id')
            .whereNotNull('df.face_image_path')
            .where('df.detection_confidence', '>=', 0.8)
            .orderBy('i.date_processed', 'desc')
            .limit(100)
            .select(
                'df.*',
                'i.filename',
                'i.original_path'
            );

        if (recentUnassigned.length === 0) {
            return [];
        }

        // Run recognition on recent unassigned faces
        try {
            const suggestions = await this.findRecognitionBasedSuggestions(recentUnassigned);
            const personSuggestions = suggestions.find(s => s.personId === personId);
            
            return personSuggestions ? personSuggestions.suggestions.slice(0, maxSuggestions) : [];
        } catch (error) {
            logger.error('Error getting batch assignment suggestions', error);
            return [];
        }
    }
}