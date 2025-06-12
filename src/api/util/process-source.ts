import path from 'node:path';
import fs from 'fs';

import { dominantColorFromImage } from './image';
import { exifFromImage } from './exif';
import { extractFaces } from './compreface';
import { detectObjects } from './object-detection';

export const getImageMetaFilename = (imagepath: string, dest: string): string => {
    // Create a relative path structure under dest directory
    const relativePath = path.relative('/mnt/sg1/uploads/stephen/iphone', imagepath);
    const filename = `${dest}/${path.dirname(relativePath)}/meta/${path.basename(imagepath, path.extname(imagepath))}${path.extname(imagepath)}.json`;
    return filename;
};

export const generateImageDataJson = async (imagepath: string, dest: string): Promise<string> => {
    const [exif, dominantColor, faces, objects] = await Promise.all([
        exifFromImage(imagepath),
        dominantColorFromImage(imagepath),
        extractFaces(imagepath, dest),
        detectObjects(imagepath)
    ]);
    
    const filename = getImageMetaFilename(imagepath, dest);

    fs.mkdirSync(path.dirname(filename), { recursive: true });
    
    fs.writeFileSync(filename, JSON.stringify({
        exif, 
        dominantColor, 
        people: faces,
        objects: objects
    }, null, 2), {});
    return filename;
};
