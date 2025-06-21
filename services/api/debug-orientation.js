#!/usr/bin/env node
/**
 * Debug orientation handling for image 16206
 */

require('dotenv').config();
const { db } = require('./build/models/database');
const sharp = require('sharp');
const { detectFacesFromImage } = require('./build/util/compreface');
const { configManager } = require('./build/util/config-manager');

async function debugOrientation() {
    const imageId = 16206;
    console.log(`🔍 Debugging orientation for image ${imageId}...`);
    
    try {
        // Get image details
        const image = await db('images').where('id', imageId).first();
        const metadata = await db('image_metadata').where('image_id', imageId).first();
        
        const processedDir = configManager.getStorage().processedDir;
        const imagePath = `${processedDir}/media/${image.relative_media_path}`;
        
        console.log(`📸 Image: ${image.filename}`);
        console.log(`📁 Path: ${imagePath}`);
        console.log(`🔄 EXIF Orientation: ${metadata?.orientation}`);
        console.log(`📐 Database dimensions: ${image.width}x${image.height}`);
        
        // Get Sharp metadata
        const sharpMeta = await sharp(imagePath).metadata();
        console.log(`📐 Sharp raw dimensions: ${sharpMeta.width}x${sharpMeta.height}`);
        console.log(`📐 Sharp orientation: ${sharpMeta.orientation}`);
        
        // Get CompreFace response
        console.log(`\n🤖 Calling CompreFace...`);
        const comprefaceResponse = await detectFacesFromImage(imagePath);
        
        if (comprefaceResponse.result && comprefaceResponse.result.length > 0) {
            console.log(`👥 CompreFace found ${comprefaceResponse.result.length} faces:`);
            
            comprefaceResponse.result.forEach((face, i) => {
                const { box } = face;
                console.log(`   Face ${i}: box(${box.x_min},${box.y_min},${box.x_max},${box.y_max})`);
                console.log(`   Face ${i}: size ${box.x_max - box.x_min}x${box.y_max - box.y_min}`);
                
                // What would different transformations look like?
                const w = sharpMeta.width;
                const h = sharpMeta.height;
                
                console.log(`   Face ${i} transformations:`);
                console.log(`     No transform: (${box.x_min},${box.y_min},${box.x_max - box.x_min},${box.y_max - box.y_min})`);
                console.log(`     180° both axes: (${w - box.x_max},${h - box.y_max},${box.x_max - box.x_min},${box.y_max - box.y_min})`);
                console.log(`     180° X only: (${w - box.x_max},${box.y_min},${box.x_max - box.x_min},${box.y_max - box.y_min})`);
                console.log(`     180° Y only: (${box.x_min},${h - box.y_max},${box.x_max - box.x_min},${box.y_max - box.y_min})`);
            });
        } else {
            console.log(`❌ No faces found by CompreFace`);
        }
        
    } catch (error) {
        console.error(`❌ Error:`, error.message);
    } finally {
        await db.destroy();
    }
}

if (require.main === module) {
    debugOrientation().catch(console.error);
}