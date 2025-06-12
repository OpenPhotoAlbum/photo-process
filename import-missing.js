#!/usr/bin/env node

const { DataMigrator } = require('./build/api/util/migrate-to-db');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const missingFiles = [
    '2023-02-04_02-20-08_beb3100c-698d-4200-89d3-1ed12e9e24b0.png',
    '2023-02-07_21-53-16_171aa02c-3d19-452b-8c08-e4c399f41736.png',
    '2023-02-07_22-06-49_8dfc54a3-46e8-41e8-98fb-23a20db6f7e8.png',
    '2023-02-07_22-08-12_107a4016-ae39-4c98-83aa-a1b43e9deb29.png',
    '2023-02-09_12-49-33_90da187a-7690-4dbf-a168-0c241f144b74.png',
    '2023-02-09_12-49-39_aeba05c3-7b28-46c5-94cc-248a75bf453b.png',
    '2023-02-09_12-49-42_ef9ac78b-b9ad-4dcc-8958-37d2d9b5f496.png',
    '2023-02-09_12-49-46_513df607-3d37-421c-9174-b11e5ef76189.png'
];

async function importMissingFiles() {
    try {
        console.log('Importing missing PNG files...');
        
        const sourceDir = process.env.media_source_dir || '/mnt/sg1/uploads/stephen/iphone';
        const destDir = process.env.media_dest_dir || '/mnt/hdd/photo-process/processed';
        const metaDir = path.join(destDir, 'recents', 'meta');
        const facesDir = path.join(destDir, 'recents', 'faces');
        
        for (const filename of missingFiles) {
            const metaFile = filename + '.json';
            console.log(`Processing: ${filename}`);
            
            try {
                await DataMigrator.processMetadataFile(metaFile, sourceDir, destDir, metaDir, facesDir);
                console.log(`✅ Successfully imported: ${filename}`);
            } catch (error) {
                console.error(`❌ Error importing ${filename}:`, error.message);
            }
        }
        
        console.log('Missing file import completed!');
        process.exit(0);
        
    } catch (error) {
        console.error('Import failed:', error);
        process.exit(1);
    }
}

importMissingFiles();