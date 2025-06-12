import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { Logger } from './logger';
import * as routes from './routes';
import { searchByObjects, getObjectStats, advancedSearch } from './routes/search';

const logger = Logger.getInstance();
logger.info('Starting API...');
dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const main = () => {
    const app = express()
    const port = process.env.PORT || 9000

    // Serve static files for frontend
    app.use('/static', express.static(path.join(__dirname, '../../public')));

    app.get('/', routes.Root)

    // Serve source images statically
    app.use('/media', express.static(process.env.media_source_dir || ''));

    app.get('/scan/status', routes.Scan.ScanStatusResolver);
    app.get('/scan', routes.Scan.ScanStartResolver);

    // Gallery API routes
    app.get('/api/gallery', routes.Gallery.GalleryListResolver);
    
    // Search API routes
    app.get('/api/search/objects', searchByObjects as any);
    app.get('/api/search/advanced', advancedSearch as any);
    app.get('/api/objects/stats', getObjectStats as any);
    
    // Serve processed images (faces, thumbnails)
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

    app.listen(port, () => logger.info(`listening on port: ${port}`))
}

export default main;