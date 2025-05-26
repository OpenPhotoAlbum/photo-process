import path from 'node:path';
import fs from 'fs';

import { dominantColorFromImage } from './image';
import { exifFromImage } from './exif';
import { extractFaces } from './compreface';

export const generateImageDataJson = async (imagepath: string, dest: string): Promise<string> => {
    const exif = await exifFromImage(imagepath);
    const dominantColor = await dominantColorFromImage(imagepath);
    const faces = await extractFaces(imagepath, dest);
    
    const filename = `${dest}${path.dirname(imagepath)}/meta/${path.basename(imagepath, path.extname(imagepath))}${path.extname(imagepath)}`;

    fs.mkdirSync(path.dirname(filename), { recursive: true });
    
    fs.writeFileSync(`${filename}.json`, JSON.stringify({exif, dominantColor, people: faces }, null, 2), {});
    return filename;
};
