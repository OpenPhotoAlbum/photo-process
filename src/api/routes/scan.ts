import { Logger } from '../logger';
import { Start, Status } from '../scanner/scan';
import { Request, Response } from 'express';

import dotenv from 'dotenv';

dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const MEDIA_SOURCE_DIR = process.env.media_source_dir || '';
const MEDIA_DEST_DIR = process.env.media_dest_dir || '';

export const ScanStartResolver = async (request: Request, response: Response) => {
    const limit = request.query.limit ? parseInt(request.query.limit as string) : undefined;
    const res = await Start(MEDIA_SOURCE_DIR, MEDIA_DEST_DIR, limit);
    response.send(res);
};

export const ScanStatusResolver = async (request: Request, response: Response) => {
    const res = await Status();
    response.send(res);
};
