require('dotenv').config();
import express from 'express';
import path from 'path';
import { Logger } from './logger';
import * as routes from './routes';
// import * as Persons from './routes/persons';
import { searchByObjects, getObjectStats, advancedSearch } from './routes/search';
import { ImageServer } from './util/image-server';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLogger, errorLogger } from './middleware/request-logger';
import * as Junk from './routes/junk';
import * as Jobs from './routes/jobs';
import * as Process from './routes/process';
import * as Geolocation from './routes/geolocation';
import { StartupValidator } from './util/startup-validator';
import { configManager } from './util/config-manager';
import { fileTracker } from './util/file-tracker';
import { logger as structuredLogger } from './util/structured-logger';

const logger = Logger.getInstance();

const main = async () => {
    try {
        // Temporarily disable startup validation during refactoring
        // const validator = new StartupValidator();
        // const validationReport = await validator.validateStartup();
        // StartupValidator.printReport(validationReport);
        
        logger.info('Starting API...');
        
        // Initialize FileTracker once at startup
        logger.info('Initializing FileTracker...');
        await fileTracker.initialize();
        
        const app = express()
        const port = configManager.getServer().port
        
        logger.info(`Configuring server on port ${port}...`);

    // Request logging middleware (before all routes)
    logger.info('Adding request logger middleware...');
    app.use(requestLogger);

    // Parse JSON bodies (must be early)
    app.use(express.json());

    // Root endpoint for API status
    logger.info('Adding root endpoint...');
    app.get('/', routes.Root)
    
    // Health check endpoint for Docker
    app.get('/api/health', routes.Health)

    // Serve source images with thumbnail support through ImageServer
    app.use('/media', routes.Media);
    
    // Map proxy endpoint
    app.get('/api/map', routes.MapProxy as any);

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
    
    app.get('/api/system/consistency', routes.Persons.checkConsistency as any);
    app.post('/api/system/sync-persons-compreface', routes.Persons.syncPersonsToCompreFace as any);
    app.post('/api/system/sync-existing-faces-compreface', routes.Persons.syncExistingFacesToCompreFace as any);
    
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
    app.get('/api/config', (req, res) => {
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
    
    // Serve processed images statically (will add thumbnail support later)
    const processedDir = configManager.getStorage().processedDir;
    logger.info(`Setting up static file serving for processed images from: ${processedDir}`);
    if (processedDir) {
        app.use('/processed', express.static(processedDir));
    }
    
    // Metadata now stored in database only - no file serving needed

    // Error handling middleware (must be last)
    app.use(notFoundHandler);
    app.use(errorLogger);  // Log errors before handling
    app.use(errorHandler);

    app.listen(port, async () => {
        logger.info(`Server started`, { port, environment: process.env.NODE_ENV || 'development' });
        
        // logRoutes(app);
        
        // Set up Elasticsearch logging after server starts
        setTimeout(async () => {
            await structuredLogger.setupElasticsearchLogging();
        }, 3000); // Wait 3 seconds for Elasticsearch to be ready
        
        // Start auto scanner if enabled
        if (process.env.AUTO_SCAN_ENABLED === 'true') {
            const { autoScanner } = await import('./util/auto-scanner');
            await autoScanner.start();
            logger.info('Auto scanner service started');
        }
    })
    } catch (error) {
        logger.error('Error in main:', error);
        throw error;
    }
}

// Call main to start the server
main().catch(error => {
    console.error('FULL ERROR:', error);
    logger.error('Failed to start server:', error?.message || error);
    logger.error('Stack trace:', error?.stack);
    process.exit(1);
});

const logRoutes = (app: any) => {
    var route, routes: any[] = [];
    app.router.stack.forEach(function(middleware: any){
        if(middleware.route){
            routes.push(middleware.route.path);
        } else if(middleware.name === 'router'){ 
            middleware.handle.stack.forEach(function(handler: any){
                route = handler.route.path;
                route && routes.push(route.path);
            });
        }
    });

    // eslint-disable-next-line
    console.log(routes);
}

export default main;