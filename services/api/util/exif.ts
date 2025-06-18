import { cpus } from 'os';
import { ExifTool, Tags } from 'exiftool-vendored';

// Singleton ExifTool instance
let exiftoolInstance: ExifTool | null = null;

const getExifTool = (): ExifTool => {
    if (!exiftoolInstance) {
        exiftoolInstance = new ExifTool({
            taskTimeoutMillis: 10000, // Increased timeout
            maxProcs: Math.max(1, Math.round(cpus().length / 4)),
            maxTasksPerProcess: 1000, // Increased capacity
            taskRetries: 2, // More retries
            ignoreZeroZeroLatLon: true,
            geolocation: true,
            checkPerl: true
        });
    }
    return exiftoolInstance;
};

export const exifFromImage = async (imagepath: string): Promise<Tags> => {
    const exiftool = getExifTool();
    const data = await exiftool.read(imagepath);
    return data;
};

// Graceful shutdown function (can be called when server shuts down)
export const closeExifTool = async (): Promise<void> => {
    if (exiftoolInstance) {
        await exiftoolInstance.end();
        exiftoolInstance = null;
    }
};