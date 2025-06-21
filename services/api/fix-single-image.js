#!/usr/bin/env node
/**
 * Fix face crops for a single image (16206) to test the orientation fix
 */

require('dotenv').config();
const { db } = require('./build/models/database');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { extractFaces } = require('./build/util/compreface');
const { configManager } = require('./build/util/config-manager');

async function fixSingleImage(imageId) {
    if (!imageId) {
        console.log('❌ Usage: node fix-single-image.js <imageId>');
        console.log('❌ Example: node fix-single-image.js 16206');
        return;
    }
    
    console.log(`🔧 Fixing face crops for image ${imageId}...`);
    
    try {
        // Get image details
        const image = await db('images').where('id', imageId).first();
        if (!image) {
            console.log(`❌ Image ${imageId} not found`);
            return;
        }
        
        console.log(`📸 Image: ${image.filename} (${image.width}x${image.height})`);
        
        // Get metadata for orientation
        const metadata = await db('image_metadata').where('image_id', imageId).first();
        console.log(`🔄 Orientation: ${metadata?.orientation || 'N/A'}`);
        
        // Get existing faces
        const existingFaces = await db('detected_faces').where('image_id', imageId);
        console.log(`👥 Found ${existingFaces.length} existing faces`);
        
        const processedDir = configManager.getStorage().processedDir;
        const facesDir = path.join(processedDir, 'faces');
        const imagePath = path.join(processedDir, 'media', image.relative_media_path);
        
        console.log(`📁 Image path: ${imagePath}`);
        console.log(`📁 Faces dir: ${facesDir}`);
        
        if (!fs.existsSync(imagePath)) {
            console.log(`❌ Image file not found: ${imagePath}`);
            return;
        }
        
        // Backup existing face files
        const backupDir = path.join(facesDir, 'backup');
        fs.mkdirSync(backupDir, { recursive: true });
        
        for (const face of existingFaces) {
            const faceFilePath = path.join(facesDir, face.relative_face_path);
            const backupPath = path.join(backupDir, `${Date.now()}_${face.relative_face_path}`);
            
            if (fs.existsSync(faceFilePath)) {
                fs.copyFileSync(faceFilePath, backupPath);
                console.log(`💾 Backed up: ${face.relative_face_path}`);
            }
        }
        
        // Re-extract faces with corrected orientation handling
        console.log(`🎯 Re-extracting faces from: ${imagePath}`);
        const newFaceData = await extractFaces(imagePath, facesDir);
        
        console.log(`✨ Extracted ${Object.keys(newFaceData).length} faces`);
        
        // Update database records with new face data
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
                
                console.log(`✅ Updated face ${face.id} coordinates: (${newFace.x_min},${newFace.y_min}) to (${newFace.x_max},${newFace.y_max})`);
            }
            faceIndex++;
        }
        
        console.log(`✅ Successfully fixed image ${imageId}`);
        
    } catch (error) {
        console.error(`❌ Error fixing image ${imageId}:`, error.message);
    } finally {
        await db.destroy();
    }
}

if (require.main === module) {
    const imageId = process.argv[2];
    fixSingleImage(parseInt(imageId)).catch(console.error);
}