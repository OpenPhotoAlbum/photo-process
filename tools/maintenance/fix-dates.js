const fs = require('fs');
const path = require('path');

// Simple database connection
const mysql = require('mysql2/promise');

async function fixDatesInDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.mysql_host || 'localhost',
        port: process.env.mysql_port || 3307,
        user: process.env.mysql_user || 'photo_app',
        password: process.env.mysql_pass || 'your_password',
        database: process.env.mysql_db || 'photo_process'
    });

    console.log('Connected to database');

    // Get all images with null date_taken
    const [images] = await connection.execute(
        'SELECT id, filename, original_path FROM images WHERE date_taken IS NULL'
    );

    console.log(`Found ${images.length} images with null date_taken`);

    let updated = 0;
    let errors = 0;

    for (const image of images) {
        try {
            // Construct metadata file path
            const metaFile = `${image.filename}.json`;
            const metaPath = path.join('/mnt/hdd/photo-process/processed/recents/meta', metaFile);
            
            if (!fs.existsSync(metaPath)) {
                console.log(`Metadata file not found: ${metaPath}`);
                continue;
            }

            // Read metadata
            const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            
            // Extract date from filename pattern: YYYY-MM-DD_HH-mm-ss_...
            let dateTaken = null;
            const dateMatch = image.filename.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
            
            if (dateMatch) {
                const [, year, month, day, hour, minute, second] = dateMatch;
                // Create date object
                dateTaken = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                
                // Check if the date is valid and not too old for MySQL
                if (isNaN(dateTaken.getTime())) {
                    console.log(`Invalid date parsed: ${year}-${month}-${day} ${hour}:${minute}:${second}`);
                    dateTaken = null;
                } else if (dateTaken.getFullYear() < 1970) {
                    // MySQL timestamp has issues with dates before 1970, use a different approach
                    console.log(`Old date detected: ${dateTaken.toISOString()}, will use DATETIME format`);
                } else {
                    console.log(`Parsed date from filename: ${dateTaken.toISOString()}`);
                }
            } else {
                // Fallback to EXIF fields
                const exif = metadata.exif;
                
                if (exif.DateTimeOriginal) {
                    dateTaken = parseExifDate(exif.DateTimeOriginal);
                } else if (exif.CreateDate) {
                    dateTaken = parseExifDate(exif.CreateDate);
                } else if (exif.ModifyDate) {
                    dateTaken = parseExifDate(exif.ModifyDate);
                } else if (exif.FileModifyDate) {
                    dateTaken = parseExifDate(exif.FileModifyDate);
                }
            }

            if (dateTaken) {
                // Format date as MySQL DATETIME string for old dates
                const mysqlDate = dateTaken.toISOString().slice(0, 19).replace('T', ' ');
                
                // Update database
                await connection.execute(
                    'UPDATE images SET date_taken = ? WHERE id = ?',
                    [mysqlDate, image.id]
                );
                updated++;
                console.log(`Updated ${image.filename}: ${dateTaken}`);
            } else {
                console.log(`No valid date found for ${image.filename}`);
            }

        } catch (error) {
            console.error(`Error processing ${image.filename}:`, error.message);
            errors++;
        }
    }

    await connection.end();
    console.log(`\nCompleted: ${updated} updated, ${errors} errors`);
}

function parseExifDate(dateValue) {
    if (!dateValue) return null;
    
    if (typeof dateValue === 'object' && dateValue.rawValue) {
        const date = new Date(dateValue.rawValue);
        return isNaN(date.getTime()) ? null : date;
    }
    
    if (typeof dateValue === 'string') {
        // Handle EXIF date format: "YYYY:MM:DD HH:mm:ss"
        const normalizedDate = dateValue.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        const date = new Date(normalizedDate);
        return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
}

// Load environment variables
require('dotenv').config({ path: '/mnt/hdd/photo-process/.env' });

fixDatesInDatabase().catch(console.error);