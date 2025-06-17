#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure TypeScript is compiled first
console.log('📦 Compiling TypeScript...');
try {
    // Change to API directory to compile
    const apiDir = path.join(__dirname, '../../services/api');
    execSync('npm run build', { cwd: apiDir, stdio: 'inherit' });
} catch (error) {
    console.error('❌ TypeScript compilation failed:', error.message);
    process.exit(1);
}

const { detectObjects } = require('../../services/api/build/util/object-detection');
const { extractFaces } = require('../../services/api/build/util/compreface');
const { ImageRepository, ObjectRepository, FaceRepository, db } = require('../../services/api/build/models/database');
const { configManager } = require('../../services/api/build/util/config-manager');

async function main() {
    const args = process.argv.slice(2);
    
    try {
        if (args.includes('--help') || args.includes('-h')) {
            showHelp();
            return;
        }
        
        if (args.includes('--status')) {
            await showRetroactiveStatus();
            return;
        }
        
        const feature = args.find(arg => arg.startsWith('--feature='))?.split('=')[1];
        const limitArg = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
        const limit = limitArg ? parseInt(limitArg) : 25;
        
        if (!feature) {
            console.error('❌ Feature is required. Use --feature=object_detection or --feature=all');
            showHelp();
            return;
        }
        
        console.log(`🎯 Starting retroactive processing for feature: ${feature}`);
        console.log(`📊 Processing limit: ${limit} images`);
        
        if (feature === 'all') {
            await processAllMissingFeatures(limit);
        } else if (feature === 'object_detection') {
            await processObjectDetection(limit);
        } else {
            console.error(`❌ Unknown feature: ${feature}. Available: object_detection, all`);
            return;
        }
        
        console.log('\n🎉 Retroactive processing completed successfully!');
        
    } catch (error) {
        console.error('💥 Retroactive processing failed:', error);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

async function showRetroactiveStatus() {
    console.log('📊 Checking retroactive processing status...\n');
    
    // Get total images
    const totalImages = await ImageRepository.searchImages({});
    console.log(`📁 Total images in database: ${totalImages.length}`);
    
    // Check object detection coverage
    const imagesWithObjects = await ImageRepository.getImagesWithObjects();
    const objectCoverage = totalImages.length > 0 ? Math.round((imagesWithObjects.length / totalImages.length) * 100) : 0;
    
    console.log(`🔍 Object Detection Coverage:`);
    console.log(`   ✅ Images with objects: ${imagesWithObjects.length}`);
    console.log(`   📊 Coverage: ${objectCoverage}% (${imagesWithObjects.length}/${totalImages.length})`);
    console.log(`   🎯 Missing: ${totalImages.length - imagesWithObjects.length} images`);
    
    // Show recommendations
    console.log(`\n💡 Recommendations:`);
    if (objectCoverage < 50) {
        console.log(`   🚀 Run: node retroactive-process.js --feature=object_detection --limit=50`);
    } else if (objectCoverage < 100) {
        console.log(`   ⚡ Run: node retroactive-process.js --feature=object_detection --limit=25`);
    } else {
        console.log(`   ✨ Object detection coverage is complete!`);
    }
}

async function processObjectDetection(limit) {
    console.log(`\n🔍 Adding object detection to existing images...`);
    
    // Find images without object detection
    const imagesWithoutObjects = await findImagesWithoutObjects(limit);
    
    if (imagesWithoutObjects.length === 0) {
        console.log('✨ All images already have object detection!');
        return;
    }
    
    console.log(`📁 Found ${imagesWithoutObjects.length} images without object detection`);
    
    let processed = 0;
    let successful = 0;
    let errors = 0;
    
    for (const image of imagesWithoutObjects) {
        try {
            console.log(`🔄 Processing ${processed + 1}/${imagesWithoutObjects.length}: ${image.filename}`);
            
            // Run object detection on the original image
            const originalPath = image.original_path;
            
            if (!fs.existsSync(originalPath)) {
                console.log(`   ⚠️  Original file not found: ${originalPath}`);
                errors++;
                continue;
            }
            
            const objects = await detectObjects(originalPath);
            
            if (objects && objects.length > 0) {
                // Filter objects by confidence threshold from config
                const minConfidence = configManager.getMinConfidence();
                const highConfidenceObjects = objects.filter(obj => obj.confidence >= minConfidence);
                
                if (highConfidenceObjects.length > 0) {
                    // Save objects to database
                    const objectRecords = highConfidenceObjects.map(obj => ({
                        image_id: image.id,
                        class: obj.class,
                        confidence: obj.confidence,
                        x: obj.bbox?.x || 0,
                        y: obj.bbox?.y || 0,
                        width: obj.bbox?.width || 0,
                        height: obj.bbox?.height || 0
                    }));
                
                await ObjectRepository.createObjects(objectRecords);
                
                    // Update the JSON metadata file if it exists
                    await updateJsonMetadata(image, { objects: highConfidenceObjects });
                    
                    console.log(`   ✅ Added ${highConfidenceObjects.length} high-confidence objects (${highConfidenceObjects.map(o => o.class).join(', ')}) [conf >= ${minConfidence}]`);
                    successful++;
                } else {
                    console.log(`   📝 No high-confidence objects detected (${objects.length} low-confidence objects filtered out, conf < ${minConfidence})`);
                }
            } else {
                console.log(`   📝 No objects detected`);
            }
            
        } catch (error) {
            console.error(`   ❌ Error processing ${image.filename}:`, error.message);
            errors++;
        }
        
        processed++;
        
        // Progress update every 10 images
        if (processed % 10 === 0) {
            console.log(`\n📊 Progress: ${processed}/${imagesWithoutObjects.length} processed, ${successful} successful, ${errors} errors\n`);
        }
    }
    
    console.log(`\n✅ Object detection processing completed:`);
    console.log(`   📊 ${processed} images processed`);
    console.log(`   ✨ ${successful} images updated with objects`);
    console.log(`   ❌ ${errors} errors`);
}

async function processAllMissingFeatures(limit) {
    console.log(`\n🚀 Adding all missing features to existing images...`);
    
    // For now, this just does object detection, but can be extended for future features
    await processObjectDetection(limit);
    
    // Future features can be added here:
    // await processFaceRecognition(limit);
    // await processImageClassification(limit);
}

async function findImagesWithoutObjects(limit) {
    // Get images that don't have any objects in the detected_objects table
    const imagesWithoutObjects = await db('images')
        .leftJoin('detected_objects', 'images.id', 'detected_objects.image_id')
        .whereNull('detected_objects.image_id')
        .select('images.*')
        .limit(limit);
    
    return imagesWithoutObjects;
}

async function updateJsonMetadata(image, newData) {
    try {
        // Get storage config for legacy metadata files
        const storage = configManager.getStorage();
        const legacyMetadataPath = path.join(storage.processedDir, 'recents', 'meta', `${image.filename}.json`);
        
        if (!fs.existsSync(legacyMetadataPath)) {
            console.log(`   📝 No legacy metadata file to update`);
            return;
        }
        
        // Read existing metadata
        const existingMetadata = JSON.parse(fs.readFileSync(legacyMetadataPath, 'utf8'));
        
        // Add new data
        const updatedMetadata = {
            ...existingMetadata,
            ...newData
        };
        
        // Write back to file
        fs.writeFileSync(legacyMetadataPath, JSON.stringify(updatedMetadata, null, 2));
        console.log(`   📝 Updated legacy metadata file`);
        
    } catch (error) {
        console.error(`   ⚠️  Failed to update legacy metadata file:`, error.message);
    }
}

function showHelp() {
    console.log(`
📋 Retroactive Processing Tool
=============================

Add new processing features to existing images retroactively.

Usage:
  node retroactive-process.js [options]

Options:
  --help, -h              Show this help message
  --status                Show retroactive processing status
  --feature=FEATURE       Specify which feature to add (required)
  --limit=NUMBER          Number of images to process (default: 25)

Available Features:
  object_detection        Add YOLO object detection to existing images
  all                     Add all missing features to existing images

Examples:
  node retroactive-process.js --status
  node retroactive-process.js --feature=object_detection --limit=50
  node retroactive-process.js --feature=all --limit=25

Notes:
  - This tool processes existing images to add missing features
  - It updates both database records and JSON metadata files
  - Use --status to see which images need processing
  - Always create retroactive scripts when adding new features!
`);
}

main();