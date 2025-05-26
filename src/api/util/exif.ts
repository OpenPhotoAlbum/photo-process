import { cpus } from 'os';
import { ExifTool, Tags } from 'exiftool-vendored';

export const exifFromImage = async (imagepath: string): Promise<Tags> => {
    const exiftool = new ExifTool({
        taskTimeoutMillis: 5000,
        maxProcs: Math.round(cpus().length / 4),
        maxTasksPerProcess: 500,
        taskRetries: 1,
        ignoreZeroZeroLatLon: true,
        geolocation: true,
        checkPerl: true
    });
    const data = await exiftool.read(imagepath);
    await exiftool.end();
    return data;
};