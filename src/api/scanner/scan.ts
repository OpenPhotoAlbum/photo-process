import fs, { promises } from 'fs'
import { resolve } from 'path';
import { readdir } from 'fs/promises'
import mime from 'mime-types';
import path from 'path';
import { generateImageDataJson, getImageMetaFilename } from '../util/process-source';

const blacklist_doesnt_start_with: string[] = []

const supportedMIMEtypeInput = [
    "image/jpeg",
    "image/jpg",
    "image/png"
]

export enum ScanStatus {
    NotStarted = 'NotStarted',
    InProgress = 'InProgress',
    Completed = 'Completed',
    Failed = 'Failed'
}

const blacklist = (f:string) => blacklist_doesnt_start_with.map(i => !f.startsWith(i)).every(a => a)

const chunk = (arr: any[], size: number) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
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

const run = async (fileToScan: string, dest: string) => {
    try {
        console.log(`[Extracting JSON Data & Faces]: ${fileToScan}`)
        const jsonData = await generateImageDataJson(fileToScan, dest);
        return jsonData;
    } catch (error) {
        console.error(`[Error processing ${fileToScan}]:`, error);
        throw error;
    }
}

export const Start = async (scanDir: string, dest: string, limit?: number) => {
    const processed: unknown[] = [];
    const files: any[] = []
    let total_files = 0;
    
    // Handle both directory structure and flat structure
    const dirs = await getDirectories(scanDir);
    console.log(`Found directories in ${scanDir}:`, dirs);
    
    if (dirs.length > 0) {
        // Original behavior - scan subdirectories
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
    } else {
        // Flat directory - scan files directly
        for await (const f of getFiles(scanDir)) {
            total_files++;
            const mt = mime.lookup(f);

            const mimeTypeChecks = mt && supportedMIMEtypeInput.includes(mt as string)
            
            if (mimeTypeChecks) {
                files.push(f)
            }
        }
    }

    console.log(`Found ${files.length} total files`);
    const filteredFiles = files.filter(blacklist);
    console.log(`After blacklist filter: ${filteredFiles.length} files`);

    const groupedFiles = filteredFiles.reduce((acc, cur) => {
        if (!acc[path.parse(cur).dir]) {
            acc[path.parse(cur).dir] = [cur]
        } else {
            acc[path.parse(cur).dir].push(cur)
        }

        return acc;
    }, {});


    for (const file of Object.keys(groupedFiles)) { 

        const unscannedOnly = (f: string) => {
            const json_file = getImageMetaFilename(f, dest);
            const scan_file_exists = fs.existsSync(json_file);
            return !scan_file_exists
        };

        const validFileOnly = (f: string) => {
            try {
                const stats = fs.statSync(f);
                // Skip zero-byte files and files that can't be accessed
                if (stats.size === 0) {
                    console.log(`Skipping zero-byte file: ${f}`);
                    return false;
                }
                return true;
            } catch (error) {
                console.log(`Skipping inaccessible file: ${f}`);
                return false;
            }
        };

        const groupsOfFiles = groupedFiles[file].filter(unscannedOnly).filter(validFileOnly);

        // Apply limit if specified
        const limitedFiles = limit && limit > 0 ? groupsOfFiles.slice(0, limit) : groupsOfFiles;
        console.log(`Processing ${limitedFiles.length} files${limit ? ` (limited to ${limit})` : ''} from ${groupsOfFiles.length} unscanned files in ${file}`);

        const batch = 2;
        const chunkedFiles = chunk(limitedFiles, batch);

        for await (const a of chunkedFiles) {
            try {
                const contents = await Promise.allSettled(a.map(i => run(i, dest)));
                processed.push(contents);
            } catch (error) {
                console.error('Error processing batch:', error);
            }
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