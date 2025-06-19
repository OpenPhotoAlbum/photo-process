#!/usr/bin/env node

/**
 * Retroactive Face Reprocessing Script
 * 
 * Identifies and reprocesses images with EXIF orientation issues (3,5,6,7,8)
 * that were processed before the backend face extraction fix.
 * 
 * This fixes face crops that were incorrectly extracted due to coordinate
 * misalignment between CompreFace detection and Sharp extraction.
 */

const path = require('path');
const fs = require('fs');
const knex = require('knex');
const { execSync } = require('child_process');

// Since we can't directly import ES modules, we'll shell out to the API for face processing
// or reimplement the core logic here

// Database configuration
const dbConfig = {
  client: 'mysql2',
  connection: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3307,
    user: process.env.MYSQL_USER || 'photo',
    password: process.env.MYSQL_PASSWORD || 'Dalekini21',
    database: process.env.MYSQL_DATABASE || 'photo-process'
  },
  acquireConnectionTimeout: 60000,
  timeout: 60000
};

const db = knex(dbConfig);

const AFFECTED_ORIENTATIONS = [3, 5, 6, 7, 8]; // EXIF orientations that need coordinate transformation

async function main() {
  console.log('🔄 Starting retroactive face reprocessing for EXIF orientation issues...\n');

  try {
    // Step 1: Find affected images
    console.log('📋 Step 1: Finding images with EXIF orientation issues...');
    const affectedImages = await findAffectedImages();
    
    if (affectedImages.length === 0) {
      console.log('✅ No images found with EXIF orientation issues. All good!');
      return;
    }

    console.log(`🎯 Found ${affectedImages.length} images with orientation issues:`);
    affectedImages.forEach(img => {
      const orientation = img.orientation || 'unknown';
      console.log(`  - ${img.filename} (${img.width}x${img.height}, orientation: ${orientation})`);
    });
    
    // Confirmation prompt
    console.log(`\n⚠️  This will:`);
    console.log(`   • Delete ${affectedImages.length} existing face records`);
    console.log(`   • Delete associated face crop files`);
    console.log(`   • Reprocess face detection with corrected coordinates`);
    console.log(`   • Generate new accurate face crops\n`);
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const proceed = await new Promise(resolve => {
      rl.question('Continue? (yes/no): ', answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
    
    if (!proceed) {
      console.log('❌ Cancelled by user');
      return;
    }

    // Step 2: Process each affected image
    console.log('\n🔧 Step 2: Reprocessing affected images...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const image of affectedImages) {
      try {
        console.log(`\n📸 Processing: ${image.filename}`);
        await reprocessImageFaces(image);
        successCount++;
        console.log(`✅ Successfully reprocessed: ${image.filename}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing ${image.filename}: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n📊 Reprocessing Summary:');
    console.log(`✅ Successfully processed: ${successCount} images`);
    console.log(`❌ Errors: ${errorCount} images`);
    console.log(`📈 Total affected images: ${affectedImages.length}`);
    
    if (successCount > 0) {
      console.log('\n🎉 Face extraction accuracy should be significantly improved!');
      console.log('💡 Try viewing face thumbnails in the mobile app to see the improvement.');
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
  } finally {
    await db.destroy();
  }
}

async function findAffectedImages() {
  const query = db('images')
    .select('images.id', 'images.filename', 'images.original_path', 'images.width', 'images.height', 'image_metadata.orientation')
    .where('images.processing_status', 'completed')
    .join('image_metadata', 'images.id', 'image_metadata.image_id')
    .whereIn('image_metadata.orientation', AFFECTED_ORIENTATIONS)
    .whereExists(function() {
      this.select('*')
        .from('detected_faces')
        .whereRaw('detected_faces.image_id = images.id');
    });
    
  return await query;
}

async function reprocessImageFaces(image) {
  const imageId = image.id;
  const originalPath = image.original_path;
  
  console.log(`  🗑️  Deleting existing face records for image ${imageId}...`);
  
  // Step 1: Get existing face data to delete face crop files
  const existingFaces = await db('detected_faces')
    .select('face_image_path')
    .where('image_id', imageId);
  
  // Step 2: Delete face crop files
  for (const face of existingFaces) {
    if (face.face_image_path) {
      try {
        const facePath = path.resolve(face.face_image_path);
        if (fs.existsSync(facePath)) {
          fs.unlinkSync(facePath);
          console.log(`    🗂️  Deleted face crop: ${face.face_image_path}`);
        }
      } catch (error) {
        console.warn(`    ⚠️  Could not delete face crop ${face.face_image_path}: ${error.message}`);
      }
    }
  }
  
  // Step 3: Delete face database records
  const deletedCount = await db('detected_faces').where('image_id', imageId).del();
  console.log(`  📝 Deleted ${deletedCount} face records from database`);
  
  // Step 4: Check if original image file exists
  if (!fs.existsSync(originalPath)) {
    throw new Error(`Original image file not found: ${originalPath}`);
  }
  
  // Step 5: Reprocess faces with the fixed extraction logic
  console.log(`  🔍 Reprocessing faces with corrected coordinate handling...`);
  
  // For now, we'll trigger reprocessing via the API endpoint
  // The API will use the fixed face extraction logic
  
  console.log(`  🔄 Triggering reprocessing via API...`);
  
  try {
    // Call the API to reprocess this specific image
    const response = await fetch(`http://localhost:9000/api/process/reprocess/${imageId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API reprocessing failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`    ✅ API reprocessing completed: ${JSON.stringify(result)}`);
    return;
    
  } catch (apiError) {
    console.warn(`    ⚠️  API reprocessing failed: ${apiError.message}`);
    console.log(`    💡 Manual reprocessing needed for image ID ${imageId}`);
  }
  const faceCount = Object.keys(faceData).length;
  
  if (faceCount === 0) {
    console.log(`    ℹ️  No faces detected in reprocessed image`);
    return;
  }
  
  console.log(`  👥 Found ${faceCount} faces, saving to database...`);
  
  // Step 6: Insert new face records
  for (const [faceIndex, face] of Object.entries(faceData)) {
    const faceRecord = {
      image_id: imageId,
      x_min: face.x_min,
      y_min: face.y_min,
      x_max: face.x_max,
      y_max: face.y_max,
      detection_confidence: face.detection_confidence || face.probability,
      face_image_path: path.join(facesDir, face.face_image_path),
      relative_face_path: face.face_image_path,
      person_id: null, // Will need to be reassigned manually
      person_name: null
    };
    
    await db('detected_faces').insert(faceRecord);
    console.log(`    💾 Saved face ${faceIndex} to database`);
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, findAffectedImages, reprocessImageFaces };