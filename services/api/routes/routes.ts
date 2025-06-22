import { Express } from 'express';
import * as routes from './index';
import { searchByObjects, getObjectStats, advancedSearch } from './search';
import * as Junk from './junk';
import * as Jobs from './jobs';
import * as Process from './process';
import * as Geolocation from './geolocation';
import * as SelectiveTraining from './selective-training';
import { configManager } from '../util/config-manager';

export const setupRoutes = (app: Express) => {
    // Root endpoint for API status
    app.get('/', routes.Root);
    
    // Health check endpoint for Docker
    app.get('/api/health', routes.Health);

    // Serve source images with thumbnail support through ImageServer
    app.use('/media', routes.Media);
    
    // Map proxy endpoint
    app.get('/api/map', routes.MapProxy as any);

    // Scan endpoints
    app.get('/scan/status', routes.Scan.ScanStatusResolver);
    app.get('/scan', routes.Scan.ScanStartResolver);
    app.post('/scan', routes.Scan.ScanStartResolver);  // Support POST for auto-scanner

    // Gallery API routes (database-based)  
    app.get('/api/gallery', routes.Gallery.GalleryListResolver);
    app.get('/api/gallery/:id/faces', routes.Gallery.GalleryRoutes.getImageFaces as any);
    app.get('/api/gallery/:id', routes.Gallery.GalleryRoutes.getImageDetails as any);
    app.delete('/api/gallery/:id', routes.Gallery.GalleryRoutes.deleteImage as any);
    
    // Trash management endpoints
    app.get('/api/trash', routes.Gallery.GalleryRoutes.getTrash as any);
    app.post('/api/trash/:id/restore', routes.Gallery.GalleryRoutes.restoreImage as any);
    app.delete('/api/trash/:id', routes.Gallery.GalleryRoutes.permanentlyDeleteImage as any);
    
    // Gallery filter API routes
    app.get('/api/filters/cities', routes.Gallery.GalleryRoutes.getAvailableCities as any);
    
    // Search API routes
    app.get('/api/search/objects', searchByObjects as any);
    app.get('/api/search/advanced', advancedSearch as any);
    app.get('/api/objects/stats', getObjectStats as any);
    
    // Person management API routes
    app.get('/api/persons', routes.Persons.getAllPersons as any);
    app.get('/api/persons/:id', routes.Persons.getPersonById as any);
    app.get('/api/persons/:id/images', routes.Persons.getPersonImages as any);
    app.get('/api/persons/:id/faces', routes.Persons.getPersonFaces as any);
    app.post('/api/persons', routes.Persons.createPerson as any);
    app.put('/api/persons/:id', routes.Persons.updatePerson as any);
    app.delete('/api/persons/:id', routes.Persons.deletePerson as any);
    
    // Face recognition API routes
    app.post('/api/faces/assign', routes.Persons.assignFaceToPerson as any);
    app.post('/api/faces/batch-assign', routes.Persons.batchAssignFacesToPerson as any);
    app.delete('/api/faces/:faceId/person', routes.Persons.removeFaceFromPerson as any);
    app.delete('/api/faces/:faceId', routes.Persons.deleteFace as any);
    app.post('/api/faces/:faceId/mark-invalid', routes.Persons.markFaceAsInvalid as any);
    app.post('/api/faces/:faceId/mark-unknown', routes.Persons.markFaceAsUnknown as any);
    app.get('/api/faces/unidentified', routes.Persons.getUnidentifiedFaces as any);
    app.get('/api/faces/unassigned', routes.Persons.getUnidentifiedFaces as any); // Alias for mobile app
    app.get('/api/faces/filter-options', routes.Persons.getFaceFilterOptions as any);
    app.post('/api/faces/auto-recognize', routes.Persons.batchAutoRecognize as any);
    app.post('/api/faces/cleanup-orphaned', routes.Persons.cleanupOrphanedFaces as any);
    app.post('/api/images/:imageId/recognize', routes.Persons.recognizeFacesInImage as any);
    
    // Enhanced face recognition routes
    app.get('/api/persons/:id/training-history', routes.Persons.getPersonTrainingHistory as any);
    app.post('/api/persons/:id/train', routes.Persons.startPersonTraining as any);
    app.get('/api/faces/needs-review', routes.Persons.getFacesNeedingReview as any);
    app.post('/api/faces/:faceId/review', routes.Persons.reviewFaceAssignment as any);
    app.get('/api/faces/:faceId/similar', routes.Persons.getSimilarFaces as any);
    
    // Face clustering API routes
    app.post('/api/clustering/start', routes.Persons.startFaceClustering as any);
    app.get('/api/clustering/stats', routes.Persons.getClusteringStats as any);
    app.get('/api/clusters', routes.Persons.getFaceClusters as any);
    app.get('/api/clusters/:clusterId/faces', routes.Persons.getClusterFaces as any);
    app.post('/api/clusters/:clusterId/assign', routes.Persons.assignClusterToPerson as any);
    app.post('/api/clustering/rebuild', routes.Persons.rebuildClusters as any);
    
    // Enhanced face assignment API routes
    app.post('/api/faces/bulk-assign', routes.Persons.bulkAssignFaces as any);
    app.post('/api/faces/suggest-persons', routes.Persons.suggestPersonsForFaces as any);
    app.put('/api/faces/:faceId/reassign', routes.Persons.reassignFace as any);
    app.get('/api/assignment/workflow', routes.Persons.getAssignmentWorkflow as any);
    
    // CompreFace training management API routes
    app.post('/api/persons/:id/queue-training', routes.Persons.queuePersonTraining as any);
    app.post('/api/training/process-queue', routes.Persons.processTrainingQueue as any);
    app.post('/api/training/auto-train', routes.Persons.autoTrainEligiblePeople as any);
    app.get('/api/training/queue', routes.Persons.getTrainingQueue as any);
    app.get('/api/training/stats', routes.Persons.getTrainingStats as any);
    app.delete('/api/training/jobs/:jobId', routes.Persons.cancelTrainingJob as any);
    app.post('/api/training/jobs/:jobId/retry', routes.Persons.retryTrainingJob as any);
    app.post('/api/training/cleanup', routes.Persons.cleanupTrainingHistory as any);
    
    // Selective Training API routes (Phase 2 - Clean Slate Approach)
    app.post('/api/training/selective/batch', SelectiveTraining.batchTrainSelective as any);
    app.post('/api/training/selective/:personId', SelectiveTraining.trainPersonSelective as any);
    app.get('/api/training/selective/:personId/stats', SelectiveTraining.getPersonTrainingStats as any);
    app.post('/api/training/selective/:personId/reset', SelectiveTraining.resetPersonTraining as any);
    app.get('/api/training/selective/:personId/manual-faces', SelectiveTraining.getManuallyAssignedFaces as any);
    app.get('/api/training/selective/:personId/log', SelectiveTraining.getPersonTrainingLog as any);
    app.post('/api/training/selective/:personId/auto-training', SelectiveTraining.setAutoTraining as any);
    
    app.get('/api/system/consistency', routes.Persons.checkConsistency as any);
    app.post('/api/system/sync-persons-compreface', routes.Persons.syncPersonsToCompreFace as any);
    app.post('/api/system/sync-existing-faces-compreface', routes.Persons.syncExistingFacesToCompreFace as any);
    
    // Auto-face cleanup endpoints
    app.get('/api/system/preview-auto-face-cleanup', routes.Persons.previewAutoFaceCleanup as any);
    app.post('/api/system/cleanup-auto-faces', routes.Persons.cleanupAutoFacesFromCompreFace as any);
    
    // CompreFace training endpoint (mobile app compatible)
    app.post('/compreface/train', routes.Persons.trainPersonModel as any);
    
    // Auto-recognition endpoint
    app.post('/api/faces/auto-recognize-image', routes.Persons.autoRecognizeFaces as any);
    
    // Image processing API routes
    app.post('/api/process/image', Process.processImage as any);
    app.post('/api/process/upload', Process.upload.single('photo'), Process.uploadPhoto as any);
    app.get('/api/process/:id/status', Process.getProcessingStatus as any);
    
    // Geolocation API routes
    app.get('/api/locations/search', Geolocation.searchByLocation as any);
    app.get('/api/locations/stats', Geolocation.getLocationStats as any);
    app.get('/api/locations/closest', Geolocation.getClosestCity as any);
    app.get('/api/locations/images/:id/location', Geolocation.getImageLocation as any);
    app.post('/api/locations/retroactive', Geolocation.processRetroactiveGeolocation as any);
    
    // System configuration API route
    app.get('/api/config', (_req, res) => {
        res.json({
            system: {
                version: '1.0.0',
                mode: 'api-only'
            },
            storage: {
                sourceDir: configManager.getStorage().sourceDir,
                processedDir: configManager.getStorage().processedDir
            },
            server: {
                port: configManager.getServer().port
            }
        });
    });
    
    // Junk/Screenshot detection API routes
    app.get('/api/junk/candidates', Junk.getScreenshotCandidates as any);
    app.put('/api/junk/:id/status', Junk.updateJunkStatus as any);
    app.post('/api/junk/batch-update', Junk.batchUpdateJunkStatus as any);
    app.get('/api/junk/stats', Junk.getJunkStats as any);
    app.post('/api/junk/detect', Junk.runScreenshotDetection as any);
    
    // Background job API routes
    app.post('/api/jobs/scan', Jobs.startScanJob as any);
    app.post('/api/jobs/face-recognition', Jobs.startFaceRecognitionJob as any);
    app.post('/api/jobs/thumbnail', Jobs.startThumbnailJob as any);
    app.get('/api/jobs/:jobId', Jobs.getJobStatus as any);
    app.get('/api/jobs', Jobs.getAllJobs as any);
    app.delete('/api/jobs/:jobId', Jobs.cancelJob as any);
    app.get('/api/jobs-stats', Jobs.getQueueStats as any);
    app.post('/api/jobs/cleanup', Jobs.cleanupJobs as any);
    
    // Albums API routes (Google Takeout + Manual Albums)
    app.use('/api/albums', routes.Albums);
    
    // Smart Albums API routes - temporarily disabled for debugging
    // app.get('/api/smart-albums', routes.SmartAlbums.listAlbums as any);
    // app.post('/api/smart-albums', routes.SmartAlbums.createAlbum as any);
    // app.post('/api/smart-albums/initialize', routes.SmartAlbums.initializeDefaults as any);
    // app.post('/api/smart-albums/process', routes.SmartAlbums.processImages as any);
    // app.get('/api/smart-albums/:identifier', routes.SmartAlbums.getAlbum as any);
    // app.put('/api/smart-albums/:identifier', routes.SmartAlbums.updateAlbum as any);
    // app.delete('/api/smart-albums/:identifier', routes.SmartAlbums.deleteAlbum as any);
    // app.get('/api/smart-albums/:identifier/images', routes.SmartAlbums.getAlbumImages as any);
    // app.get('/api/smart-albums/:identifier/stats', routes.SmartAlbums.getAlbumStats as any);
};