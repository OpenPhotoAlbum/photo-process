import express from 'express';
import dotenv from 'dotenv';
import { Logger } from './logger';
import * as routes from './routes';

const logger = Logger.getInstance();
logger.info('Starting API...');
dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const main = () => {
    const app = express()
    const port = process.env.PORT || 9000

    app.get('/', routes.Root)

    app.get(/media(.*)/, routes.Media);

    app.get('/scan/status', routes.Scan.ScanStatusResolver);
    app.get('/scan', routes.Scan.ScanStartResolver);

    app.listen(port, () => logger.info(`listening on port: ${port}`))
}

export default main;