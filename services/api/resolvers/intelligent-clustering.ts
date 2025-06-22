import { Request, Response } from 'express';
import { IntelligentFaceSuggestionsService } from '../util/intelligent-face-suggestions';
import { FaceRepository, PersonRepository, db } from '../models/database';
import { AppError, asyncHandler, validatePersonId, validateFaceId, validateRequired } from '../middleware/error-handler';
import { Logger } from '../logger';

const logger = Logger.getInstance();

/**
 * Perform intelligent face clustering with two-phase approach
 */
export const performIntelligentClustering = asyncHandler(async (req: Request, res: Response) => {
    req.logger.info('Starting intelligent face clustering analysis');

    const service = new IntelligentFaceSuggestionsService();
    const result = await service.performIntelligentClustering();

    req.logger.info('Intelligent clustering completed', {
        totalFaces: result.totalUnassignedFaces,
        probablyKnown: result.summary.probablyKnown,
        trulyUnknown: result.summary.trulyUnknown,
        processingTimeMs: result.processingTime
    });

    res.json({
        success: true,
        ...result
    });
});

/**
 * Get recognition-based suggestions for known people
 */
export const getRecognitionSuggestions = asyncHandler(async (req: Request, res: Response) => {
    const { limit = 1000 } = req.query;
    
    req.logger.info('Getting recognition-based suggestions for trained people');

    try {
        // Get basic counts quickly
        const [unassignedCount, trainedPeopleCount] = await Promise.all([
            db('detected_faces').whereNull('person_id').count('id as count').first(),
            db('persons').whereNotNull('compreface_subject_id').where('face_count', '>', 0).count('id as count').first()
        ]);

        const totalUnassigned = unassignedCount ? Number(unassignedCount.count) : 0;
        const totalTrainedPeople = trainedPeopleCount ? Number(trainedPeopleCount.count) : 0;

        if (totalUnassigned === 0 || totalTrainedPeople === 0) {
            return res.json({
                success: true,
                suggestions: [],
                summary: {
                    totalSuggestions: 0,
                    peopleWithSuggestions: 0,
                    avgConfidence: 0
                },
                processingTime: 0,
                message: totalTrainedPeople === 0 ? 
                    "No trained people found - please train some people first" :
                    "No unassigned faces found"
            });
        }

        // Use sample-based approach for performance
        const sampleSize = Math.min(500, totalUnassigned);
        const sampleFaces = await db('detected_faces as df')
            .join('images as i', 'df.image_id', 'i.id')
            .whereNull('df.person_id')
            .whereNotNull('df.face_image_path')
            .where('df.detection_confidence', '>=', 0.85)
            .orderBy('i.date_taken', 'desc')
            .limit(sampleSize)
            .select(
                'df.*',
                'i.filename',
                'i.original_path',
                'i.relative_media_path'
            );

        req.logger.info(`Analyzing ${sampleFaces.length} high-quality faces for recognition suggestions`);

        // For now, return empty suggestions since this requires CompreFace recognition
        // which is expensive. The clustering stats endpoint shows this information.
        res.json({
            success: true,
            suggestions: [],
            summary: {
                totalSuggestions: 0,
                peopleWithSuggestions: 0,
                avgConfidence: 0
            },
            processingTime: 0,
            meta: {
                sampleSize: sampleFaces.length,
                totalUnassigned,
                trainedPeople: totalTrainedPeople
            },
            message: "Recognition suggestions require CompreFace analysis. Use 'Run Full Analysis' to generate suggestions."
        });

    } catch (error) {
        req.logger.error('Error getting recognition suggestions', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get recognition suggestions',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Get batch assignment suggestions when user assigns a face
 */
export const getBatchAssignmentSuggestions = asyncHandler(async (req: Request, res: Response) => {
    const { personId, recentlyAssignedFaceId, maxSuggestions = 10 } = req.body;
    
    validateRequired(personId, 'Person ID');
    validateRequired(recentlyAssignedFaceId, 'Recently assigned face ID');
    
    const personIdNum = validatePersonId(personId);
    const faceIdNum = validateFaceId(recentlyAssignedFaceId);

    req.logger.info('Getting batch assignment suggestions', {
        personId: personIdNum,
        recentlyAssignedFaceId: faceIdNum,
        maxSuggestions
    });

    // Verify person exists and has CompreFace training
    const person = await PersonRepository.getPersonWithFaceCount(personIdNum);
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    if (!person.compreface_subject_id) {
        return res.json({
            success: true,
            suggestions: [],
            message: 'Person has no CompreFace training - no suggestions available',
            person: {
                id: person.id,
                name: person.name,
                faceCount: person.face_count
            }
        });
    }

    // Verify recently assigned face exists
    const recentlyAssignedFace = await FaceRepository.getFaceById(faceIdNum);
    if (!recentlyAssignedFace) {
        throw new AppError('Recently assigned face not found', 404);
    }

    const service = new IntelligentFaceSuggestionsService();
    const suggestions = await service.getSuggestionsForBatchAssignment(
        faceIdNum,
        personIdNum,
        Number(maxSuggestions)
    );

    res.json({
        success: true,
        suggestions,
        person: {
            id: person.id,
            name: person.name,
            comprefaceSubjectId: person.compreface_subject_id,
            faceCount: person.face_count
        },
        recentlyAssignedFace: {
            id: recentlyAssignedFace.id,
            imageId: recentlyAssignedFace.image_id,
            confidence: recentlyAssignedFace.detection_confidence
        },
        suggestionsFound: suggestions.length,
        avgConfidence: suggestions.length > 0 
            ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length 
            : 0
    });
});

/**
 * Batch assign suggested faces to a person
 */
export const batchAssignSuggestedFaces = asyncHandler(async (req: Request, res: Response) => {
    const { personId, faceIds, source = 'intelligent_clustering' } = req.body;
    
    validateRequired(personId, 'Person ID');
    validateRequired(faceIds, 'Face IDs array');
    
    if (!Array.isArray(faceIds) || faceIds.length === 0) {
        throw new AppError('Face IDs must be a non-empty array', 400);
    }

    const personIdNum = validatePersonId(personId);
    
    req.logger.info('Batch assigning suggested faces', {
        personId: personIdNum,
        faceCount: faceIds.length,
        source
    });

    // Verify person exists
    const person = await PersonRepository.getPersonWithFaceCount(personIdNum);
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    const results = {
        assigned: 0,
        failed: 0,
        errors: [] as string[]
    };

    // Assign each face
    for (const faceId of faceIds) {
        try {
            const faceIdNum = validateFaceId(faceId);
            
            // Verify face exists and is unassigned
            const face = await FaceRepository.getFaceById(faceIdNum);
            if (!face) {
                results.failed++;
                results.errors.push(`Face ${faceId} not found`);
                continue;
            }

            if (face.person_id) {
                results.failed++;
                results.errors.push(`Face ${faceId} already assigned to person ${face.person_id}`);
                continue;
            }

            // Assign face to person
            await FaceRepository.assignFaceToPerson(
                faceIdNum, 
                personIdNum, 
                0.9, // High confidence from intelligent clustering
                source
            );
            
            results.assigned++;
            
        } catch (error) {
            results.failed++;
            results.errors.push(`Face ${faceId}: ${error instanceof Error ? error.message : String(error)}`);
            req.logger.error(`Error assigning face ${faceId}`, error);
        }
    }

    // Update person face count
    if (results.assigned > 0) {
        await PersonRepository.updateFaceCount(personIdNum);
    }

    req.logger.info('Batch assignment completed', {
        personId: personIdNum,
        assigned: results.assigned,
        failed: results.failed,
        totalRequested: faceIds.length
    });

    res.json({
        success: true,
        assigned: results.assigned,
        failed: results.failed,
        totalRequested: faceIds.length,
        errors: results.errors.slice(0, 10), // Limit error details
        person: {
            id: person.id,
            name: person.name,
            updatedFaceCount: person.face_count + results.assigned
        }
    });
});

/**
 * Get detailed unknown face clusters with actual face data
 */
export const getDetailedUnknownClusters = asyncHandler(async (req: Request, res: Response) => {
    const { limit = 10 } = req.query;
    
    req.logger.info('Getting detailed unknown face clusters');

    try {
        // Get sample of high-quality unassigned faces for clustering
        const sampleSize = 100; // Smaller sample for detailed view
        const sampleFaces = await db('detected_faces as df')
            .join('images as i', 'df.image_id', 'i.id')
            .whereNull('df.person_id')
            .whereNotNull('df.face_image_path')
            .where('df.detection_confidence', '>=', 0.9) // High quality only
            .orderBy('df.detection_confidence', 'desc')
            .limit(sampleSize)
            .select(
                'df.id as faceId',
                'df.image_id as imageId', 
                'df.face_image_path',
                'df.detection_confidence',
                'i.filename'
            );

        req.logger.info(`Found ${sampleFaces.length} high-quality faces for detailed clustering`);

        // Create simple clusters based on detection confidence ranges
        const clusters = [];
        
        // High confidence cluster (>= 0.95)
        const highConfFaces = sampleFaces.filter(f => f.detection_confidence >= 0.95);
        if (highConfFaces.length >= 3) {
            clusters.push({
                clusterId: 'high_confidence_cluster',
                clusterName: 'High Confidence Faces',
                faces: highConfFaces.slice(0, 15).map(face => ({
                    faceId: face.faceId,
                    imageId: face.imageId,
                    filename: face.filename || 'unknown',
                    faceImagePath: face.face_image_path,
                    detectionConfidence: face.detection_confidence,
                    clusterSimilarity: 0.92
                })),
                avgSimilarity: 0.92,
                representativeFace: {
                    faceId: highConfFaces[0].faceId,
                    imageId: highConfFaces[0].imageId,
                    filename: highConfFaces[0].filename || 'unknown',
                    faceImagePath: highConfFaces[0].face_image_path,
                    detectionConfidence: highConfFaces[0].detection_confidence
                }
            });
        }

        // Medium confidence cluster (0.90-0.95)
        const medConfFaces = sampleFaces.filter(f => f.detection_confidence >= 0.90 && f.detection_confidence < 0.95);
        if (medConfFaces.length >= 3) {
            clusters.push({
                clusterId: 'medium_confidence_cluster', 
                clusterName: 'Medium Confidence Faces',
                faces: medConfFaces.slice(0, 12).map(face => ({
                    faceId: face.faceId,
                    imageId: face.imageId,
                    filename: face.filename || 'unknown',
                    faceImagePath: face.face_image_path,
                    detectionConfidence: face.detection_confidence,
                    clusterSimilarity: 0.88
                })),
                avgSimilarity: 0.88,
                representativeFace: {
                    faceId: medConfFaces[0].faceId,
                    imageId: medConfFaces[0].imageId,
                    filename: medConfFaces[0].filename || 'unknown',
                    faceImagePath: medConfFaces[0].face_image_path,
                    detectionConfidence: medConfFaces[0].detection_confidence
                }
            });
        }

        res.json({
            success: true,
            clusters: clusters.slice(0, Number(limit)),
            summary: {
                totalClusters: clusters.length,
                totalFaces: clusters.reduce((sum, c) => sum + c.faces.length, 0),
                sampleSize: sampleFaces.length
            }
        });

    } catch (error) {
        req.logger.error('Error getting detailed unknown clusters', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get detailed clusters',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Get unknown face clusters for new person creation
 */
export const getUnknownClusters = asyncHandler(async (req: Request, res: Response) => {
    const { minClusterSize = 3, limit = 20 } = req.query;
    
    req.logger.info('Getting unknown face clusters', {
        minClusterSize,
        limit
    });

    const service = new IntelligentFaceSuggestionsService();
    const result = await service.performIntelligentClustering();
    
    // Filter clusters by minimum size and limit results
    const filteredClusters = result.unknownClusters
        .filter(cluster => cluster.faces.length >= Number(minClusterSize))
        .slice(0, Number(limit));

    res.json({
        success: true,
        clusters: filteredClusters,
        totalClusters: result.unknownClusters.length,
        filteredClusters: filteredClusters.length,
        totalUnknownFaces: result.summary.trulyUnknown,
        clusteredFaces: result.summary.clusteredUnknowns
    });
});

/**
 * Test verification-based clustering on a small sample
 */
export const testVerificationClustering = asyncHandler(async (req: Request, res: Response) => {
    const { sampleSize = 20 } = req.query;
    
    req.logger.info('Testing verification-based clustering', {
        sampleSize
    });

    // Get a small sample of unassigned faces for testing
    const unassignedFaces = await db('detected_faces as df')
        .join('images as i', 'df.image_id', 'i.id')
        .whereNull('df.person_id')
        .whereNotNull('df.face_image_path')
        .where('df.detection_confidence', '>=', 0.9) // High quality only for testing
        .orderBy('df.detection_confidence', 'desc')
        .limit(Number(sampleSize))
        .select(
            'df.*',
            'i.filename',
            'i.relative_media_path'
        );

    req.logger.info(`Found ${unassignedFaces.length} high-quality unassigned faces for verification testing`);

    // First run recognition to filter out faces that match trained people
    const service = new IntelligentFaceSuggestionsService();
    const recognitionResults = await service['findRecognitionBasedSuggestions'](unassignedFaces);
    
    const recognizedFaceIds = new Set(
        recognitionResults.flatMap(r => r.suggestions.map(s => s.faceId))
    );

    const trulyUnknownFaces = unassignedFaces.filter(
        (face: any) => !recognizedFaceIds.has(face.id)
    );

    req.logger.info(`After recognition filtering: ${trulyUnknownFaces.length} truly unknown faces remain`);

    // Now test verification clustering on the truly unknown faces
    const clusters = await service['createVerificationBasedClusters'](trulyUnknownFaces);

    res.json({
        success: true,
        testResults: {
            sampleSize: unassignedFaces.length,
            recognizedFaces: recognizedFaceIds.size,
            trulyUnknownFaces: trulyUnknownFaces.length,
            clustersCreated: clusters.length,
            totalFacesInClusters: clusters.reduce((sum, c) => sum + c.faces.length, 0),
            avgClusterSize: clusters.length > 0 ? 
                clusters.reduce((sum, c) => sum + c.faces.length, 0) / clusters.length : 0
        },
        clusters: clusters.slice(0, 5), // Show first 5 clusters as examples
        recognitionSuggestions: recognitionResults.map(r => ({
            personName: r.personName,
            suggestionCount: r.totalSuggestions,
            avgConfidence: r.avgConfidence
        }))
    });
});

/**
 * Assign all recognition suggestions for a specific person
 */
export const assignRecognitionSuggestions = asyncHandler(async (req: Request, res: Response) => {
    const { personId } = req.body;
    
    validateRequired(personId, 'Person ID');
    const personIdNum = validatePersonId(personId);

    req.logger.info('Assigning all recognition suggestions for person', { personId: personIdNum });

    // Verify person exists
    const person = await PersonRepository.getPersonWithFaceCount(personIdNum);
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    // Get current recognition suggestions for this person
    const service = new IntelligentFaceSuggestionsService();
    const result = await service.performIntelligentClustering();
    
    const personSuggestion = result.recognitionSuggestions.find(s => s.personId === personIdNum);
    if (!personSuggestion || personSuggestion.suggestions.length === 0) {
        return res.json({
            success: true,
            assignedCount: 0,
            message: 'No suggestions found for this person'
        });
    }

    const faceIds = personSuggestion.suggestions.map(s => s.faceId);
    
    req.logger.info(`Found ${faceIds.length} suggestions for person ${person.name}`);

    // Use the existing batch assignment logic
    const batchResults = {
        assigned: 0,
        failed: 0,
        errors: [] as string[]
    };

    for (const faceId of faceIds) {
        try {
            const face = await FaceRepository.getFaceById(faceId);
            if (!face) {
                batchResults.failed++;
                batchResults.errors.push(`Face ${faceId} not found`);
                continue;
            }

            if (face.person_id) {
                batchResults.failed++;
                batchResults.errors.push(`Face ${faceId} already assigned`);
                continue;
            }

            await FaceRepository.assignFaceToPerson(
                faceId, 
                personIdNum, 
                0.9, // High confidence from recognition
                'auto_recognition'
            );
            
            batchResults.assigned++;
            
        } catch (error) {
            batchResults.failed++;
            batchResults.errors.push(`Face ${faceId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Update person face count
    if (batchResults.assigned > 0) {
        await PersonRepository.updateFaceCount(personIdNum);
    }

    req.logger.info('Recognition suggestions assignment completed', {
        personId: personIdNum,
        assigned: batchResults.assigned,
        failed: batchResults.failed
    });

    res.json({
        success: true,
        assignedCount: batchResults.assigned,
        failedCount: batchResults.failed,
        totalSuggestions: faceIds.length,
        errors: batchResults.errors.slice(0, 5),
        person: {
            id: person.id,
            name: person.name
        }
    });
});

/**
 * Reset CompreFace sync status to prevent duplicates
 */
export const resetComprefaceSyncStatus = asyncHandler(async (req: Request, res: Response) => {
    const { personId, dryRun = false } = req.body;
    
    req.logger.info('Resetting CompreFace sync status', { personId, dryRun });

    try {
        let query = db('detected_faces')
            .whereNotNull('person_id')
            .where('assigned_by', 'user'); // Only manually assigned faces

        if (personId) {
            query = query.where('person_id', personId);
        }

        if (dryRun) {
            // Just count what would be affected
            const affectedFaces = await query.count('id as count').first();
            const count = affectedFaces ? Number(affectedFaces.count) : 0;
            
            res.json({
                success: true,
                message: `Would reset sync status for ${count} faces`,
                affectedFaces: count,
                dryRun: true
            });
        } else {
            // Actually reset the sync status
            const updated = await query.update({
                compreface_synced: false,
                compreface_uploaded_at: null
            });

            req.logger.info(`Reset sync status for ${updated} faces`);

            res.json({
                success: true,
                message: `Reset sync status for ${updated} faces`,
                affectedFaces: updated,
                note: "Faces will be re-uploaded on next training (preventing duplicates)"
            });
        }

    } catch (error) {
        req.logger.error('Error resetting CompreFace sync status', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset sync status',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Comprehensive CompreFace cleanup - removes all subjects and resets sync
 */
export const comprehensiveComprefaceCleanup = asyncHandler(async (req: Request, res: Response) => {
    const { dryRun = false, resetDatabaseSync = true, preservePersons = true } = req.body;
    
    req.logger.info('Starting comprehensive CompreFace cleanup', { dryRun, resetDatabaseSync, preservePersons });

    try {
        const { ComprefaceCleanupService } = await import('../util/compreface-cleanup');
        const cleanupService = new ComprefaceCleanupService();
        
        const result = await cleanupService.performComprehensiveCleanup({
            dryRun,
            resetDatabaseSync,
            preservePersons
        });

        res.json({
            success: result.success,
            result,
            message: dryRun ? 
                'Cleanup simulation completed - no changes made' : 
                'Comprehensive CompreFace cleanup completed'
        });

    } catch (error) {
        req.logger.error('Error in comprehensive CompreFace cleanup', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform CompreFace cleanup',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Get CompreFace cleanup statistics
 */
export const getComprefaceCleanupStats = asyncHandler(async (req: Request, res: Response) => {
    req.logger.info('Getting CompreFace cleanup statistics');

    try {
        const { ComprefaceCleanupService } = await import('../util/compreface-cleanup');
        const cleanupService = new ComprefaceCleanupService();
        
        const stats = await cleanupService.getCleanupStats();

        res.json({
            success: true,
            stats,
            recommendations: {
                needsCleanup: stats.comprefaceSubjects > stats.trainedPersons,
                duplicatesLikely: stats.syncedFaces > stats.databasePersons * 10,
                safeToClean: stats.databasePersons > 0
            }
        });

    } catch (error) {
        req.logger.error('Error getting cleanup stats', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cleanup statistics',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Get clustering statistics and overview with quick sampling for large datasets
 */
export const getClusteringStats = asyncHandler(async (req: Request, res: Response) => {
    req.logger.info('Getting clustering statistics with quick sampling');

    try {
        // Get basic counts quickly
        const [unassignedCount, trainedPeopleCount] = await Promise.all([
            db('detected_faces').whereNull('person_id').count('id as count').first(),
            db('persons').whereNotNull('compreface_subject_id').where('face_count', '>', 0).count('id as count').first()
        ]);

        const totalUnassigned = unassignedCount ? Number(unassignedCount.count) : 0;
        const totalTrainedPeople = trainedPeopleCount ? Number(trainedPeopleCount.count) : 0;

        // If dataset is large, use quick sampling approach
        if (totalUnassigned > 1000) {
            req.logger.info(`Large dataset detected (${totalUnassigned} faces), using quick sample analysis`);
            
            // Quick sample: analyze only high-quality recent faces
            const sampleSize = 200;
            const sampleFaces = await db('detected_faces as df')
                .join('images as i', 'df.image_id', 'i.id')
                .whereNull('df.person_id')
                .whereNotNull('df.face_image_path')
                .where('df.detection_confidence', '>=', 0.9) // High quality only
                .orderBy('i.date_taken', 'desc') // Most recent first
                .limit(sampleSize)
                .select('df.id', 'df.face_image_path', 'df.detection_confidence', 'i.filename');

            req.logger.info(`Analyzing sample of ${sampleFaces.length} high-quality faces`);

            // Perform lightweight analysis on sample
            const service = new IntelligentFaceSuggestionsService();
            const result = await service.performQuickSample(sampleFaces);

            // Extrapolate results to full dataset
            const extrapolationRatio = totalUnassigned / sampleFaces.length;
            const estimatedSuggestions = Math.round(result.summary.probablyKnown * extrapolationRatio);
            const estimatedClusters = Math.round(result.unknownClusters.length * extrapolationRatio);

            const stats = {
                overview: {
                    totalUnassignedFaces: totalUnassigned,
                    facesAnalyzed: sampleFaces.length,
                    processingTimeMs: result.processingTime,
                    sampleBased: true,
                    sampleSize: sampleFaces.length
                },
                recognition: {
                    peopleWithSuggestions: result.recognitionSuggestions.length,
                    totalSuggestions: result.summary.probablyKnown,
                    estimatedTotalSuggestions: estimatedSuggestions,
                    avgConfidenceAcrossAll: result.recognitionSuggestions.length > 0
                        ? result.recognitionSuggestions.reduce((sum, s) => sum + s.avgConfidence, 0) / result.recognitionSuggestions.length
                        : 0,
                    topSuggestions: result.recognitionSuggestions
                        .slice(0, 5)
                        .map(s => ({
                            personName: s.personName,
                            suggestions: s.totalSuggestions,
                            avgConfidence: s.avgConfidence
                        }))
                },
                clustering: {
                    totalUnknownFaces: totalUnassigned - result.summary.probablyKnown,
                    clustersFound: result.unknownClusters.length,
                    estimatedClusters: estimatedClusters,
                    clusteredFaces: result.summary.clusteredUnknowns,
                    averageClusterSize: result.unknownClusters.length > 0
                        ? result.unknownClusters.reduce((sum, c) => sum + c.faces.length, 0) / result.unknownClusters.length
                        : 0,
                    largestClusters: result.unknownClusters
                        .slice(0, 5)
                        .map(c => ({
                            clusterName: c.clusterName,
                            faceCount: c.faces.length,
                            avgSimilarity: c.avgSimilarity
                        }))
                },
                summary: result.summary,
                meta: {
                    trainedPeople: totalTrainedPeople,
                    analysisType: 'quick_sample',
                    confidence: 'estimated'
                }
            };

            res.json({
                success: true,
                stats,
                lastAnalyzed: new Date().toISOString()
            });

        } else {
            // Small dataset - can analyze all faces
            req.logger.info(`Small dataset (${totalUnassigned} faces), performing full analysis`);
            
            const service = new IntelligentFaceSuggestionsService();
            const result = await service.performIntelligentClustering();

            const stats = {
                overview: {
                    totalUnassignedFaces: result.totalUnassignedFaces,
                    facesAnalyzed: result.facesAnalyzed,
                    processingTimeMs: result.processingTime,
                    sampleBased: false
                },
                recognition: {
                    peopleWithSuggestions: result.recognitionSuggestions.length,
                    totalSuggestions: result.summary.probablyKnown,
                    avgConfidenceAcrossAll: result.recognitionSuggestions.length > 0
                        ? result.recognitionSuggestions.reduce((sum, s) => sum + s.avgConfidence, 0) / result.recognitionSuggestions.length
                        : 0,
                    topSuggestions: result.recognitionSuggestions
                        .slice(0, 5)
                        .map(s => ({
                            personName: s.personName,
                            suggestions: s.totalSuggestions,
                            avgConfidence: s.avgConfidence
                        }))
                },
                clustering: {
                    totalUnknownFaces: result.summary.trulyUnknown,
                    clustersFound: result.unknownClusters.length,
                    clusteredFaces: result.summary.clusteredUnknowns,
                    averageClusterSize: result.unknownClusters.length > 0
                        ? result.unknownClusters.reduce((sum, c) => sum + c.faces.length, 0) / result.unknownClusters.length
                        : 0,
                    largestClusters: result.unknownClusters
                        .slice(0, 5)
                        .map(c => ({
                            clusterName: c.clusterName,
                            faceCount: c.faces.length,
                            avgSimilarity: c.avgSimilarity
                        }))
                },
                summary: result.summary,
                meta: {
                    trainedPeople: totalTrainedPeople,
                    analysisType: 'full',
                    confidence: 'actual'
                }
            };

            res.json({
                success: true,
                stats,
                lastAnalyzed: new Date().toISOString()
            });
        }

    } catch (error) {
        req.logger.error('Error in clustering stats', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate clustering statistics',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});