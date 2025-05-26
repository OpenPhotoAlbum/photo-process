import path from 'node:path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { inspect } from 'node:util';

import { Logger } from '../logger';
import { Image } from './image';

const logger = Logger.getInstance();

const COMPREFACE_API_URL = 'http://localhost:8000/api/v1';

enum ComprefaceService {
    Detect = 'Detect',
    Recognize = 'Recognize'
}

enum ComprefaceKeys {
    Detect = 'dccaa628-2951-4812-a81d-e8a76b52b47c',
    Recognize = 'b6dd9990-6905-40b8-80d3-4655196ab139',
}

enum ComprefaceRoutes {
    Detect = `/detection/detect`,
    Recognize = `/recognition/recognize`,
}

const comprefaceApi = async (service: ComprefaceService, imagepath: string): Promise<JSON> => {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagepath));

    const query = '?limit=20&det_prob_threshold=0.8&face_plugins=landmarks&face_plugins=gender&face_plugins=age&face_plugins=pose';
    const url = `${COMPREFACE_API_URL}${ComprefaceRoutes[service]}${query}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            "content-type": "multipart/form-data",
            'x-api-key': ComprefaceKeys[service],
            ...formData.getHeaders()
        },
        body: formData
    });

    const result = await response.json();
    return result;
}

export const detectFacesFromImage = async (imagepath: string): Promise<any> => {
    return await comprefaceApi(ComprefaceService.Detect, imagepath)
};

export const recognizeFacesFromImage = async (imagepath: string): Promise<any> => {
    return await comprefaceApi(ComprefaceService.Recognize, imagepath)
};

export const extractFaces = async (imagepath: string, dest: string): Promise<Record<string, object>> => {
    const { result } = await detectFacesFromImage(imagepath);
    let i = 0;
    const faceData: Record<string, object> = {};
    for (const res in result) {
        const s = Image(imagepath);
        const { box } = result[res];

        const extract = {
            left: box.x_min,
            top: box.y_min,
            width: box.x_max - box.x_min,
            height: box.y_max - box.y_min,
        };

        const filename = `${dest}${path.dirname(imagepath)}/faces/${path.basename(imagepath, path.extname(imagepath))}__face_${i}${path.extname(imagepath)}`;
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        await s.extract(extract).toFile(filename);

        i++;

        faceData[filename] = result[res];
    }

    return faceData;
}