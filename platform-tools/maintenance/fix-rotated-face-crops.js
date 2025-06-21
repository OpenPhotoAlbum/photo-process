#!/usr/bin/env node
/**
 * Fix incorrectly cropped faces due to EXIF orientation issues
 * 
 * This script identifies and re-extracts face crops for images that have
 * EXIF orientation metadata but were processed with incorrect coordinates.
 */

require('dotenv').config();
const { db } = require('./build/models/database');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Import the corrected face extraction logic
const { extractFaces } = require('./build/util/compreface');
const { configManager } = require('./build/util/config-manager');

async function main() {
    console.log('🔧 Starting retroactive face crop correction...');
    
    try {
        // Find all images with EXIF orientation != 1 that have faces
        const problematicImages = await db('images')
            .join('image_metadata', 'images.id', 'image_metadata.image_id')
            .join('detected_faces', 'images.id', 'detected_faces.image_id')
            .where('image_metadata.orientation', '!=', 1)
            .whereNotNull('image_metadata.orientation')
            .whereNotNull('detected_faces.face_image_path')
            .select(
                'images.id',
                'images.filename',
                'images.relative_media_path',
                'image_metadata.orientation',
                db.raw('COUNT(detected_faces.id) as face_count')
            )
            .groupBy('images.id', 'images.filename', 'images.relative_media_path', 'image_metadata.orientation')
            .orderBy('images.id');

        console.log(`📊 Found ${problematicImages.length} images with orientation issues and faces`);
        
        if (problematicImages.length === 0) {
            console.log('✅ No problematic images found!');
            return;
        }

        // Show breakdown by orientation
        const orientationBreakdown = {};
        problematicImages.forEach(img => {
            orientationBreakdown[img.orientation] = (orientationBreakdown[img.orientation] || 0) + 1;
        });
        
        console.log('📈 Breakdown by orientation:');
        Object.entries(orientationBreakdown).forEach(([orientation, count]) => {
            const description = getOrientationDescription(orientation);
            console.log(`   Orientation ${orientation} (${description}): ${count} images`);
        });

        const processedDir = configManager.getStorage().processedDir;
        const facesDir = path.join(processedDir, 'faces');
        
        let processedImages = 0;
        let processedFaces = 0;
        let errors = 0;

        for (const image of problematicImages) {
            try {
                console.log(`\n🔄 Processing image ${image.id}: ${image.filename} (orientation ${image.orientation})`);
                
                // Get the full path to the processed image
                const imagePath = path.join(processedDir, 'media', image.relative_media_path);
                
                if (!fs.existsSync(imagePath)) {
                    console.log(`   ⚠️  Image file not found: ${imagePath}`);
                    continue;
                }

                // Get existing faces for this image
                const existingFaces = await db('detected_faces')
                    .where('image_id', image.id)
                    .whereNotNull('face_image_path');

                console.log(`   📷 Found ${existingFaces.length} existing faces to re-extract`);

                // Backup existing face files
                const backupDir = path.join(facesDir, 'backup');
                fs.mkdirSync(backupDir, { recursive: true });

                for (const face of existingFaces) {
                    const faceFilePath = path.join(facesDir, face.relative_face_path || face.face_image_path);
                    const backupPath = path.join(backupDir, `${Date.now()}_${face.relative_face_path || face.face_image_path}`);
                    
                    if (fs.existsSync(faceFilePath)) {
                        fs.copyFileSync(faceFilePath, backupPath);
                        console.log(`   💾 Backed up: ${face.relative_face_path || face.face_image_path}`);
                    }
                }

                // Re-extract faces with corrected orientation handling
                console.log(`   🎯 Re-extracting faces from: ${imagePath}`);
                const newFaceData = await extractFaces(imagePath, facesDir);
                
                if (Object.keys(newFaceData).length !== existingFaces.length) {
                    console.log(`   ⚠️  Face count mismatch: extracted ${Object.keys(newFaceData).length}, expected ${existingFaces.length}`);
                }

                // Update database records with new face data (coordinates may have changed)
                let faceIndex = 0;
                for (const face of existingFaces) {
                    const newFace = newFaceData[faceIndex.toString()];
                    if (newFace) {
                        await db('detected_faces')
                            .where('id', face.id)
                            .update({
                                x_min: newFace.x_min,
                                y_min: newFace.y_min, 
                                x_max: newFace.x_max,
                                y_max: newFace.y_max,
                                updated_at: new Date()
                            });
                        
                        console.log(`   ✅ Updated face ${face.id} coordinates`);
                        processedFaces++;
                    }
                    faceIndex++;
                }

                processedImages++;
                console.log(`   ✅ Completed image ${image.id}`);

            } catch (error) {
                console.error(`   ❌ Error processing image ${image.id}:`, error.message);
                errors++;
            }
        }

        console.log(`\n🎉 Retroactive fix completed!`);
        console.log(`📊 Summary:`);
        console.log(`   • Images processed: ${processedImages}/${problematicImages.length}`);
        console.log(`   • Faces re-extracted: ${processedFaces}`);
        console.log(`   • Errors: ${errors}`);
        console.log(`   • Backup location: ${path.join(facesDir, 'backup')}`);

    } catch (error) {
        console.error('❌ Error during retroactive fix:', error);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

function getOrientationDescription(orientation) {
    const descriptions = {
        1: 'Normal',
        2: 'Horizontal flip',
        3: '180° rotation',
        4: 'Vertical flip',
        5: '90° CW + horizontal flip',
        6: '90° CW rotation',
        7: '90° CCW + horizontal flip', 
        8: '90° CCW rotation'
    };
    return descriptions[orientation] || 'Unknown';
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };