#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

async function checkMissingImages() {
    // Get all JSON metadata files
    const metaDir = '/mnt/hdd/photo-process/processed/recents/meta';
    const metaFiles = fs.readdirSync(metaDir)
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    
    console.log(`Found ${metaFiles.length} metadata files on disk`);
    
    // Connect to database
    const connection = await mysql.createConnection({
        host: process.env.mysql_host,
        port: parseInt(process.env.mysql_port),
        user: process.env.mysql_user,
        password: process.env.mysql_pass,
        database: process.env.mysql_db
    });
    
    // Get all filenames from database
    const [rows] = await connection.execute('SELECT filename FROM images');
    const dbFilenames = rows.map(row => row.filename);
    
    console.log(`Found ${dbFilenames.length} images in database`);
    
    // Find missing files
    const missingFromDB = metaFiles.filter(filename => !dbFilenames.includes(filename));
    const missingFromDisk = dbFilenames.filter(filename => !metaFiles.includes(filename));
    
    console.log(`\nMissing from database (${missingFromDB.length} files):`);
    missingFromDB.forEach(filename => console.log(`  - ${filename}`));
    
    if (missingFromDisk.length > 0) {
        console.log(`\nMissing from disk (${missingFromDisk.length} files):`);
        missingFromDisk.forEach(filename => console.log(`  - ${filename}`));
    }
    
    // Check if original files exist for missing entries
    console.log('\nChecking if original files exist for missing entries:');
    const sourceDir = process.env.media_source_dir;
    
    for (const filename of missingFromDB) {
        const originalPath = path.join(sourceDir, 'recents', filename);
        const exists = fs.existsSync(originalPath);
        console.log(`  ${filename}: ${exists ? 'EXISTS' : 'MISSING'} at ${originalPath}`);
    }
    
    await connection.end();
}

checkMissingImages().catch(console.error);