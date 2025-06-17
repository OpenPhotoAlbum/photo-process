import { Request, Response } from 'express';
import { ImageServer } from '../util/image-server';

export const ProcessedMedia = async (request: Request, response: Response) => {
    // Use consolidated image server utility
    await ImageServer.serveProcessedMedia(request, response);
};