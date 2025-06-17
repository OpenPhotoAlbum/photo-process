#!/usr/bin/env node

/**
 * Update object detection data for existing images
 * Updated for database-centric architecture with hash-based file organization
 */

const fs = require('fs');
const path = require('path');

// Import our database models and config system
const { ObjectRepository, ImageRepository, db } = require('../../services/api/build/models/database');
const { configManager } = require('../../services/api/build/util/config-manager');

async function updateObjectsForExistingImages() {
    console.log('🔍 Updating object detection data for existing images...\n');
    
    // Get configuration
    const storage = configManager.getStorage();
    
    // Get all images from database that don't have object detection data
    const imagesWithoutObjects = await db('images')
        .leftJoin('detected_objects', 'images.id', 'detected_objects.image_id')
        .whereNull('detected_objects.image_id')
        .select('images.*');
    
    console.log(`📊 Found ${imagesWithoutObjects.length} images without object detection data`);
    
    if (imagesWithoutObjects.length === 0) {
        console.log('✅ All images already have object detection data!');
        return;
    }
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    let skipped = 0;
    
    // Check if legacy JSON metadata files exist
    const legacyMetaDir = path.join(storage.processedDir, 'recents', 'meta');
    const hasLegacyMetadata = fs.existsSync(legacyMetaDir);
    
    console.log(`📁 Legacy metadata directory: ${hasLegacyMetadata ? 'Found' : 'Not found'}`);
    console.log(`📂 Processing ${imagesWithoutObjects.length} images...\n`);
    
    for (const image of imagesWithoutObjects) {
        try {
            processed++;
            console.log(`🔄 Processing ${processed}/${imagesWithoutObjects.length}: ${image.filename}`);
            
            let objectsFound = false;
            
            // Try to find legacy JSON metadata file
            if (hasLegacyMetadata) {
                const metaPath = path.join(legacyMetaDir, `${image.filename}.json`);
                
                if (fs.existsSync(metaPath)) {
                    try {
                        const metadataJson = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                        
                        if (metadataJson.objects && metadataJson.objects.length > 0) {
                            // Create object records from JSON metadata
                            const objectRecords = metadataJson.objects.map(obj => ({
                                image_id: image.id,
                                class: obj.class,
                                confidence: obj.confidence,
                                x: obj.bbox?.x || 0,
                                y: obj.bbox?.y || 0,
                                width: obj.bbox?.width || 0,
                                height: obj.bbox?.height || 0
                            }));
                            
                            await ObjectRepository.createObjects(objectRecords);
                            console.log(`   ✅ Added ${objectRecords.length} objects from legacy metadata`);
                            updated++;
                            objectsFound = true;
                        }
                    } catch (jsonError) {
                        console.log(`   ⚠️  Error reading legacy metadata: ${jsonError.message}`);
                    }
                }
            }
            
            if (!objectsFound) {
                console.log(`   📝 No object data found for this image`);
                skipped++;
            }
            
            // Progress update every 25 images
            if (processed % 25 === 0) {
                console.log(`\n📊 Progress: ${processed}/${imagesWithoutObjects.length} processed, ${updated} updated, ${skipped} skipped, ${errors} errors\n`);
            }
            
        } catch (error) {
            console.error(`   ❌ Error processing ${image.filename}:`, error.message);
            errors++;
        }
    }
    
    console.log(`\n✅ Update completed:`);
    console.log(`   📊 ${processed} images processed`);
    console.log(`   ✨ ${updated} images updated with objects`);
    console.log(`   📝 ${skipped} images skipped (no object data found)`);
    console.log(`   ❌ ${errors} errors`);
}

async function main() {
    try {
        await updateObjectsForExistingImages();
        console.log('\n🎉 Object update completed successfully!');
    } catch (error) {
        console.error('\n💥 Object update failed:', error);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

// Run the update
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { updateObjectsForExistingImages };