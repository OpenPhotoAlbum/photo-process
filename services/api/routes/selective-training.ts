import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/error-handler';
import { SelectiveTrainingService, SelectiveTrainingOptions } from '../util/selective-training';
import { db } from '../models/database';

/**
 * Selective Training API Routes
 * 
 * These endpoints provide controlled face training to CompreFace:
 * - Only manually verified faces
 * - Duplicate prevention
 * - Detailed logging and tracking
 */

/**
 * Train a person using only manually assigned faces
 * POST /api/training/selective/:personId
 */
export const trainPersonSelective = asyncHandler(async (req: Request, res: Response) => {
    const personId = parseInt(req.params.personId);
    if (isNaN(personId)) {
        throw new AppError('Invalid person ID', 400);
    }

    const options: SelectiveTrainingOptions = {
        onlyManuallyAssigned: req.body.onlyManuallyAssigned !== false, // Default true
        maxFacesPerPerson: req.body.maxFacesPerPerson,
        allowDuplicateUploads: req.body.allowDuplicateUploads === true // Default false
    };

    req.logger.info(`Starting selective training for person ${personId}`, { options });

    const result = await SelectiveTrainingService.trainPersonSelective(personId, options);

    res.json({
        success: result.success,
        message: result.success 
            ? `Successfully trained ${result.personName} with ${result.facesUploaded} faces`
            : `Training failed for ${result.personName}`,
        data: result
    });
});

/**
 * Get training statistics for a person
 * GET /api/training/selective/:personId/stats
 */
export const getPersonTrainingStats = asyncHandler(async (req: Request, res: Response) => {
    const personId = parseInt(req.params.personId);
    if (isNaN(personId)) {
        throw new AppError('Invalid person ID', 400);
    }

    const stats = await SelectiveTrainingService.getPersonTrainingStats(personId);
    
    const person = await db('persons').where('id', personId).first();
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    res.json({
        success: true,
        data: {
            personId,
            personName: person.name,
            comprefaceSubjectId: person.compreface_subject_id,
            recognitionStatus: person.recognition_status,
            lastTrainedAt: person.last_trained_at,
            allowAutoTraining: person.allow_auto_training,
            stats
        }
    });
});

/**
 * Reset person's training state completely
 * POST /api/training/selective/:personId/reset
 */
export const resetPersonTraining = asyncHandler(async (req: Request, res: Response) => {
    const personId = parseInt(req.params.personId);
    if (isNaN(personId)) {
        throw new AppError('Invalid person ID', 400);
    }

    const person = await db('persons').where('id', personId).first();
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    req.logger.info(`Resetting training state for person: ${person.name}`);

    await SelectiveTrainingService.resetPersonTraining(personId);

    res.json({
        success: true,
        message: `Training state reset for ${person.name}`,
        data: {
            personId,
            personName: person.name
        }
    });
});

/**
 * Get list of manually assigned faces for a person
 * GET /api/training/selective/:personId/manual-faces
 */
export const getManuallyAssignedFaces = asyncHandler(async (req: Request, res: Response) => {
    const personId = parseInt(req.params.personId);
    if (isNaN(personId)) {
        throw new AppError('Invalid person ID', 400);
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const includeUploaded = req.query.includeUploaded === 'true';

    let query = db('detected_faces as df')
        .join('images as i', 'df.image_id', 'i.id')
        .where('df.person_id', personId)
        .where('df.assigned_by', 'user')
        .whereNotNull('df.face_image_path');

    if (!includeUploaded) {
        query = query.where('df.compreface_synced', false);
    }

    const faces = await query
        .select(
            'df.id as face_id',
            'df.compreface_synced',
            'df.compreface_uploaded_at',
            'df.detection_confidence',
            'df.face_image_path',
            'df.relative_face_path',
            'i.id as image_id',
            'i.filename as image_filename',
            'i.relative_media_path'
        )
        .orderBy('df.detection_confidence', 'desc')
        .limit(limit)
        .offset(offset);

    const totalCount = await db('detected_faces')
        .where('person_id', personId)
        .where('assigned_by', 'user')
        .whereNotNull('face_image_path')
        .modify((builder) => {
            if (!includeUploaded) {
                builder.where('compreface_synced', false);
            }
        })
        .count('* as count')
        .first();

    res.json({
        success: true,
        data: {
            faces,
            pagination: {
                total: Number(totalCount?.count) || 0,
                limit,
                offset,
                hasMore: offset + faces.length < (Number(totalCount?.count) || 0)
            }
        }
    });
});

/**
 * Get training log for a person
 * GET /api/training/selective/:personId/log
 */
export const getPersonTrainingLog = asyncHandler(async (req: Request, res: Response) => {
    const personId = parseInt(req.params.personId);
    if (isNaN(personId)) {
        throw new AppError('Invalid person ID', 400);
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const onlyFailures = req.query.onlyFailures === 'true';

    let query = db('face_training_log as ftl')
        .join('detected_faces as df', 'ftl.face_id', 'df.id')
        .where('ftl.person_id', personId);

    if (onlyFailures) {
        query = query.where('ftl.upload_success', false);
    }

    const logs = await query
        .select(
            'ftl.*',
            'df.detection_confidence',
            'df.face_image_path'
        )
        .orderBy('ftl.upload_attempt_at', 'desc')
        .limit(limit)
        .offset(offset);

    const totalCount = await db('face_training_log')
        .where('person_id', personId)
        .modify((builder) => {
            if (onlyFailures) {
                builder.where('upload_success', false);
            }
        })
        .count('* as count')
        .first();

    res.json({
        success: true,
        data: {
            logs,
            pagination: {
                total: Number(totalCount?.count) || 0,
                limit,
                offset,
                hasMore: offset + logs.length < (Number(totalCount?.count) || 0)
            }
        }
    });
});

/**
 * Batch train multiple people with selective training
 * POST /api/training/selective/batch
 */
export const batchTrainSelective = asyncHandler(async (req: Request, res: Response) => {
    const { personIds, options = {} } = req.body;

    if (!Array.isArray(personIds) || personIds.length === 0) {
        throw new AppError('personIds array is required', 400);
    }

    const trainingOptions: SelectiveTrainingOptions = {
        onlyManuallyAssigned: options.onlyManuallyAssigned !== false,
        maxFacesPerPerson: options.maxFacesPerPerson,
        allowDuplicateUploads: options.allowDuplicateUploads === true
    };

    req.logger.info(`Starting batch selective training for ${personIds.length} people`, { 
        personIds, 
        options: trainingOptions 
    });

    const results = [];
    
    for (const personId of personIds) {
        try {
            const result = await SelectiveTrainingService.trainPersonSelective(
                parseInt(personId), 
                trainingOptions
            );
            results.push(result);
        } catch (error) {
            results.push({
                personId: parseInt(personId),
                personName: 'Unknown',
                facesUploaded: 0,
                facesSkipped: 0,
                errors: [error instanceof Error ? error.message : String(error)],
                success: false
            });
        }
    }

    const successCount = results.filter(r => r.success).length;
    const totalFacesUploaded = results.reduce((sum, r) => sum + r.facesUploaded, 0);

    res.json({
        success: successCount > 0,
        message: `Batch training completed: ${successCount}/${results.length} people trained successfully with ${totalFacesUploaded} total faces`,
        data: {
            results,
            summary: {
                totalPeople: results.length,
                successful: successCount,
                failed: results.length - successCount,
                totalFacesUploaded
            }
        }
    });
});

/**
 * Enable/disable auto-training for a person
 * POST /api/training/selective/:personId/auto-training
 */
export const setAutoTraining = asyncHandler(async (req: Request, res: Response) => {
    const personId = parseInt(req.params.personId);
    if (isNaN(personId)) {
        throw new AppError('Invalid person ID', 400);
    }

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        throw new AppError('enabled field must be a boolean', 400);
    }

    const person = await db('persons').where('id', personId).first();
    if (!person) {
        throw new AppError('Person not found', 404);
    }

    await db('persons').where('id', personId).update({
        allow_auto_training: enabled
    });

    req.logger.info(`${enabled ? 'Enabled' : 'Disabled'} auto-training for person: ${person.name}`);

    res.json({
        success: true,
        message: `Auto-training ${enabled ? 'enabled' : 'disabled'} for ${person.name}`,
        data: {
            personId,
            personName: person.name,
            allowAutoTraining: enabled
        }
    });
});