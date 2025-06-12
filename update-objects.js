#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ObjectRepository, ImageRepository } = require('./build/api/models/database');

async function updateObjectsForExistingImages() {
    console.log('Updating object detection data for existing images...');
    
    const metaDir = '/mnt/hdd/photo-process/processed/recents/meta';
    
    if (!fs.existsSync(metaDir)) {
        throw new Error(`Metadata directory not found: ${metaDir}`);
    }
    
    const metadataFiles = fs.readdirSync(metaDir)
        .filter(file => file.endsWith('.json'));
    
    console.log(`Found ${metadataFiles.length} metadata files to process`);
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    for (const metaFile of metadataFiles) {
        try {
            const metaPath = path.join(metaDir, metaFile);
            const metadataJson = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            
            // Extract original filename
            const originalFilename = metaFile.replace('.json', '');
            
            // Find the image in the database
            const images = await ImageRepository.searchImages({ filename: originalFilename });
            
            if (images.length === 0) {
                console.log(`Image not found in database: ${originalFilename}`);
                continue;
            }
            
            const imageId = images[0].id;
            
            // Check if objects exist in metadata and database
            if (metadataJson.objects && metadataJson.objects.length > 0) {
                // Check if objects already exist for this image
                const existingObjects = await ObjectRepository.getObjectsByImage(imageId);
                
                if (existingObjects.length === 0) {
                    // Create object records
                    const objectRecords = metadataJson.objects.map(obj => ({
                        image_id: imageId,
                        class: obj.class,
                        confidence: obj.confidence,
                        x: obj.bbox?.x || 0,
                        y: obj.bbox?.y || 0,
                        width: obj.bbox?.width || 0,
                        height: obj.bbox?.height || 0
                    }));
                    
                    await ObjectRepository.createObjects(objectRecords);
                    console.log(`Added ${objectRecords.length} objects for ${originalFilename}`);
                    updated++;
                } else {
                    console.log(`Objects already exist for ${originalFilename}`);
                }
            }
            
            processed++;
            
            if (processed % 50 === 0) {
                console.log(`Processed ${processed}/${metadataFiles.length} files... (${updated} updated)`);
            }
            
        } catch (error) {
            console.error(`Error processing ${metaFile}:`, error.message);
            errors++;
        }
    }
    
    console.log(`Update completed: ${processed} processed, ${updated} updated with objects, ${errors} errors`);
}

updateObjectsForExistingImages()
    .then(() => {
        console.log('Object update completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Object update failed:', error);
        process.exit(1);
    });