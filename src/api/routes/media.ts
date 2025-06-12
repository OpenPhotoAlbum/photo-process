import dotenv from 'dotenv';
import mime from 'mime-types';
import { Image } from '../util/image';
import { Request, Response } from 'express';

dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const MEDIA_SOURCE = process.env.media_source_dir;

export const Media = async (request: Request, response: Response) => {
    console.log(request.query, 'bang');
    const { thumb } = request.query;

    const imagePath = `${MEDIA_SOURCE}/${request.params.path || ''}`;

    const image = Image(imagePath);

    if (thumb) {
        image.resize(200);
    }

    const buffer = await image.toBuffer();

    const mimetype = mime.lookup(imagePath);
    const expiry_time = Date.now() + parseInt('9999') * 1000;

    let headers = {
        "Content-Type": mimetype,
        "Cache-Control": `public, max-age=9999`,
        "Content-Length": buffer.length,
        Expires: new Date(expiry_time).toUTCString(),
    };

    response.set(headers).status(200).send(buffer);
}
