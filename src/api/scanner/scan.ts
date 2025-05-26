import fs, { promises } from 'fs'
import { resolve } from 'path';
import { readdir } from 'fs/promises'
import mime from 'mime-types';
import path from 'path';
import { generateImageDataJson } from '../util/process-source';

const blacklist_doesnt_start_with: string[] = [
    // '/home/uploads/cayce',
    // '/home/uploads/stephen/'
    // '/home/uploads/cayce/iPhone/Recents',
    // '/home/uploads/google/cayce',
    // '/home/uploads/google/stephen-iphone'
]

const supportedMIMEtypeInput = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg",
    "image/tiff"
]

export enum ScanStatus {
    NotStarted = 'NotStarted',
    InProgress = 'InProgress',
    Completed = 'Completed',
    Failed = 'Failed'
}

const blacklist = (f:string) => blacklist_doesnt_start_with.map(i => !f.startsWith(i)).every(a => a)

const chunk = (arr: any[], size: number) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
    );

async function* getFiles(dir: string): any {
    const dirents = await promises.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getFiles(res);
        } else {
            yield res;
        }
    }
}

const getDirectories = async (source: string) =>
    (await readdir(source, { withFileTypes: true }))
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

const run = (fileToScan: string, dest: string) => {
    return new Promise((resolve) => {
        const jsonData = generateImageDataJson(fileToScan, dest);
        console.log(`Extracting JSON Data & Faces: ${fileToScan}`)
        resolve(jsonData);
    });
}

export const Start = async (scanDir: string, dest: string) => {
    const processed: unknown[] = [];
    const files: any[] = []
    let total_files = 0;
    const dirs = await getDirectories(scanDir);

    for (const d of dirs) {
        for await (const f of getFiles(scanDir + '/' + d)) {
            total_files++;
            const mt = mime.lookup(f);

            const mimeTypeChecks = mt && supportedMIMEtypeInput.includes(mt as string)
            
            if (mimeTypeChecks) {
                files.push(f)
            }
        }
    }

    const numFilesToScan = files.filter(blacklist).length;

    const groupedFiles = files.filter(blacklist).reduce((acc, cur) => {
        if (!acc[path.parse(cur).dir]) {
            acc[path.parse(cur).dir] = [cur]
        } else {
            acc[path.parse(cur).dir].push(cur)
        }

        return acc;
    }, {});


    for (const file of Object.keys(groupedFiles)) { 

        const unscannedOnly = (f: string) => {
            const json_file = `${dest}meta/${f}.json`
            console.log(json_file);
            const scan_file_exists = fs.existsSync(json_file);
            return !scan_file_exists
        };

        const groupsOfFiles = groupedFiles[file].filter(unscannedOnly);

        const batch = 5;
        const chunkedFiles = chunk(groupsOfFiles, batch);

        for await (const a of chunkedFiles) {
            const contents = await Promise.all(a.map(i => run(i, dest)));
            processed.push(contents);
        }
    }

    return processed;
}

export const Status = async () => {
    const _status = ScanStatus.InProgress;

    return {
        message: _status,
        processed: 10,
        total_files: 422,
        percentage: 2.4,
        eta: '1 hour 30 minutes',
        started_at: new Date().toISOString(),
        completed_at: null,
        error: null
    }
}