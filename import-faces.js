#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

async function importAllFaces() {
    console.log('Importing face detection data...');
    
    // Connect to database
    const connection = await mysql.createConnection({
        host: process.env.mysql_host,
        port: parseInt(process.env.mysql_port),
        user: process.env.mysql_user,
        password: process.env.mysql_pass,
        database: process.env.mysql_db
    });
    
    // Get all images with their IDs
    const [images] = await connection.execute('SELECT id, filename FROM images');
    const imageMap = {};
    images.forEach(img => {
        imageMap[img.filename] = img.id;
    });
    
    console.log(`Found ${images.length} images in database`);
    
    // Process metadata files
    const metaDir = '/mnt/hdd/photo-process/processed/recents/meta';
    const metaFiles = fs.readdirSync(metaDir).filter(file => file.endsWith('.json'));
    
    let totalFaces = 0;
    let processedImages = 0;
    
    for (const metaFile of metaFiles) {
        const filename = metaFile.replace('.json', '');
        const imageId = imageMap[filename];
        
        if (!imageId) {
            console.warn(`No database record found for: ${filename}`);
            continue;
        }
        
        // Read metadata
        const metaPath = path.join(metaDir, metaFile);
        const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        
        if (metadata.people && Object.keys(metadata.people).length > 0) {
            console.log(`Processing faces for: ${filename} (${Object.keys(metadata.people).length} faces)`);
            
            for (const [facePath, faceData] of Object.entries(metadata.people)) {
                const faceImagePath = facePath.replace('/mnt/hdd/photo-process/processed/', '');
                
                try {
                    await connection.execute(`
                        INSERT INTO detected_faces (
                            image_id, face_image_path, x_min, y_min, x_max, y_max,
                            detection_confidence, predicted_gender, gender_confidence,
                            age_min, age_max, age_confidence, pitch, roll, yaw, landmarks
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        imageId,
                        faceImagePath,
                        faceData.box?.x_min || 0,
                        faceData.box?.y_min || 0,
                        faceData.box?.x_max || 0,
                        faceData.box?.y_max || 0,
                        faceData.box?.probability || 0,
                        faceData.gender?.value || null,
                        faceData.gender?.probability || 0,
                        faceData.age?.low || null,
                        faceData.age?.high || null,
                        faceData.age?.probability || 0,
                        faceData.pose?.pitch || 0,
                        faceData.pose?.roll || 0,
                        faceData.pose?.yaw || 0,
                        JSON.stringify(faceData.landmarks || null)
                    ]);
                    
                    totalFaces++;
                } catch (error) {
                    console.error(`Error inserting face for ${filename}:`, error.message);
                }
            }
            processedImages++;
        }
        
        if (processedImages % 10 === 0 && processedImages > 0) {
            console.log(`Processed ${processedImages} images with faces...`);
        }
    }
    
    await connection.end();
    
    console.log(`\nFace import completed:`);
    console.log(`- Images with faces: ${processedImages}`);
    console.log(`- Total faces imported: ${totalFaces}`);
}

importAllFaces().catch(console.error);