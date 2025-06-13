import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { Logger } from './logger';
import * as routes from './routes';
import { searchByObjects, getObjectStats, advancedSearch } from './routes/search';
import { ImageServer } from './util/image-server';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import * as Junk from './routes/junk';
import * as Jobs from './routes/jobs';

const logger = Logger.getInstance();
logger.info('Starting API...');
dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const main = () => {
    const app = express()
    const port = process.env.PORT || 9000

    // Serve static files for frontend
    app.use('/static', express.static(path.join(__dirname, '../../public')));

    app.get('/', routes.Root)

    // Serve source images with thumbnail support through ImageServer
    app.use('/media', routes.Media);

    app.get('/scan/status', routes.Scan.ScanStatusResolver);
    app.get('/scan', routes.Scan.ScanStartResolver);

    // Gallery API routes (database-based)
    app.get('/api/gallery', routes.Gallery.GalleryListResolver);
    app.get('/api/gallery/:id/faces', routes.Gallery.GalleryRoutes.getImageFaces as any);
    
    // Search API routes
    app.get('/api/search/objects', searchByObjects as any);
    app.get('/api/search/advanced', advancedSearch as any);
    app.get('/api/objects/stats', getObjectStats as any);
    
    // Person management API routes
    app.use(express.json()); // Parse JSON bodies
    app.get('/api/persons', routes.Persons.getAllPersons as any);
    app.get('/api/persons/:id', routes.Persons.getPersonById as any);
    app.post('/api/persons', routes.Persons.createPerson as any);
    app.put('/api/persons/:id', routes.Persons.updatePerson as any);
    app.delete('/api/persons/:id', routes.Persons.deletePerson as any);
    
    // Face recognition API routes
    app.post('/api/faces/assign', routes.Persons.assignFaceToPerson as any);
    app.post('/api/faces/batch-assign', routes.Persons.batchAssignFacesToPerson as any);
    app.delete('/api/faces/:faceId/person', routes.Persons.removeFaceFromPerson as any);
    app.post('/api/faces/:faceId/mark-invalid', routes.Persons.markFaceAsInvalid as any);
    app.post('/api/faces/:faceId/mark-unknown', routes.Persons.markFaceAsUnknown as any);
    app.get('/api/faces/unidentified', routes.Persons.getUnidentifiedFaces as any);
    app.get('/api/faces/filter-options', routes.Persons.getFaceFilterOptions as any);
    app.post('/api/faces/auto-recognize', routes.Persons.batchAutoRecognize as any);
    app.post('/api/faces/cleanup-orphaned', routes.Persons.cleanupOrphanedFaces as any);
    app.post('/api/images/:imageId/recognize', routes.Persons.recognizeFacesInImage as any);
    app.get('/api/system/consistency', routes.Persons.checkConsistency as any);
    
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
    
    // Serve processed images statically (will add thumbnail support later)  
    app.use('/processed', express.static(process.env.media_dest_dir || ''));
    
    // Metadata API - serve JSON metadata files
    app.get('/api/metadata', (req: any, res: any) => {
        try {
            const { path: photoPath } = req.query;
            if (!photoPath) {
                return res.status(400).json({ error: 'Missing path parameter' });
            }
            
            const fullPath = path.join(process.env.media_dest_dir || '', photoPath);
            
            if (!require('fs').existsSync(fullPath)) {
                return res.status(404).json({ error: 'Photo metadata not found' });
            }
            
            const metadata = JSON.parse(require('fs').readFileSync(fullPath, 'utf8'));
            res.json(metadata);
        } catch (error) {
            console.error('Error getting photo metadata:', error);
            res.status(500).json({ error: 'Failed to get photo metadata' });
        }
    });

    // Error handling middleware (must be last)
    app.use(notFoundHandler);
    app.use(errorHandler);

    app.listen(port, () => logger.info(`listening on port: ${port}`))
}

export default main;