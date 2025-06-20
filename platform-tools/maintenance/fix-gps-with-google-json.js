#!/usr/bin/env node

/**
 * GPS Coordinate Repair Using Google Takeout JSON Metadata
 * 
 * This script identifies images with GPS coordinate issues and repairs them using:
 * 1. Google Takeout JSON metadata (most accurate)
 * 2. Longitude sign correction for Western hemisphere (fallback)
 * 
 * Google JSON structure:
 * {
 *   "geoData": {
 *     "latitude": 42.7437,
 *     "longitude": -71.1563,
 *     "altitude": 73.0
 *   }
 * }
 */

const path = require('path');
const fs = require('fs');
const knex = require('knex');

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
  useNullAsDefault: true
};

const db = knex(dbConfig);

/**
 * Try to find and parse Google Takeout JSON file for an image
 */
async function getGoogleTakeoutMetadata(imagePath) {
    try {
        const jsonPath = imagePath + '.json';
        
        if (!fs.existsSync(jsonPath)) {
            return null;
        }
        
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const metadata = JSON.parse(jsonContent);
        
        // Check if we have valid GPS data
        const geoData = metadata.geoData || metadata.geoDataExif;
        if (geoData && geoData.latitude !== 0 && geoData.longitude !== 0) {
            return {
                latitude: geoData.latitude,
                longitude: geoData.longitude,
                altitude: geoData.altitude || null,
                source: 'google_json'
            };
        }
        
        return null;
    } catch (error) {
        console.log(`  ⚠️  Error reading JSON metadata: ${error.message}`);
        return null;
    }
}

/**
 * Compare coordinates to see if they're significantly different
 */
function coordinatesAreDifferent(lat1, lon1, lat2, lon2, threshold = 0.001) {
    return Math.abs(lat1 - lat2) > threshold || Math.abs(lon1 - lon2) > threshold;
}

async function main() {
    try {
        console.log('🔧 GPS Coordinate Repair with Google JSON Metadata');
        console.log('===================================================');
        
        // Find images that potentially have GPS coordinate issues
        // Focus on takeout images first, then all positive longitude images
        const affectedImages = await db('images')
            .select('id', 'filename', 'gps_latitude', 'gps_longitude', 'original_path')
            .whereNotNull('gps_latitude')
            .whereNotNull('gps_longitude')
            .where(function() {
                // Target takeout images or positive longitude in North America
                this.where('original_path', 'like', '%takeout%')
                    .orWhere(function() {
                        this.where('gps_longitude', '>', 0)
                            .where('gps_latitude', '>=', 25)
                            .where('gps_latitude', '<=', 70);
                    });
            })
            .orderBy('original_path');
            
        console.log(`Found ${affectedImages.length} images to check for GPS corrections`);
        
        if (affectedImages.length === 0) {
            console.log('✅ No images need GPS coordinate correction');
            process.exit(0);
        }
        
        let takeoutCount = 0;
        let positiveCount = 0;
        let correctedCount = 0;
        let jsonSourceCount = 0;
        let signFlipCount = 0;
        let errorCount = 0;
        
        console.log('\n🔍 Analyzing images and correction methods...\n');
        
        for (const image of affectedImages) {
            try {
                const isTakeout = image.original_path.includes('takeout');
                const hasPositiveLongitude = image.gps_longitude > 0;
                
                if (isTakeout) takeoutCount++;
                if (hasPositiveLongitude) positiveCount++;
                
                let correctionMethod = null;
                let newLatitude = image.gps_latitude;
                let newLongitude = image.gps_longitude;
                let newAltitude = null;
                
                // Method 1: Try Google JSON metadata (most accurate)
                if (isTakeout) {
                    const googleGPS = await getGoogleTakeoutMetadata(image.original_path);
                    
                    if (googleGPS) {
                        // Check if Google's coordinates are different from our stored ones
                        if (coordinatesAreDifferent(
                            image.gps_latitude, image.gps_longitude,
                            googleGPS.latitude, googleGPS.longitude
                        )) {
                            newLatitude = googleGPS.latitude;
                            newLongitude = googleGPS.longitude;
                            newAltitude = googleGPS.altitude;
                            correctionMethod = 'google_json';
                            jsonSourceCount++;
                        }
                    }
                }
                
                // Method 2: Longitude sign correction (fallback)
                if (!correctionMethod && hasPositiveLongitude && 
                    image.gps_latitude >= 25 && image.gps_latitude <= 70) {
                    newLongitude = -Math.abs(image.gps_longitude);
                    correctionMethod = 'longitude_sign_flip';
                    signFlipCount++;
                }
                
                // Apply correction if needed
                if (correctionMethod) {
                    console.log(`Correcting ${image.filename} (${correctionMethod}):`);
                    console.log(`  ${image.gps_latitude}, ${image.gps_longitude} → ${newLatitude}, ${newLongitude}`);
                    
                    // Update coordinates in images table
                    await db('images')
                        .where('id', image.id)
                        .update({
                            gps_latitude: newLatitude,
                            gps_longitude: newLongitude,
                            gps_altitude: newAltitude,
                            updated_at: new Date()
                        });
                    
                    // Update coordinates in image_metadata table
                    await db('image_metadata')
                        .where('image_id', image.id)
                        .update({
                            latitude: newLatitude,
                            longitude: newLongitude,
                            altitude: newAltitude,
                            updated_at: new Date()
                        });
                    
                    // Clear existing geolocation data for reprocessing
                    const deletedGeoCount = await db('image_geolocations')
                        .where('image_id', image.id)
                        .del();
                    
                    if (deletedGeoCount > 0) {
                        console.log(`  📍 Cleared ${deletedGeoCount} geolocation record(s)`);
                    }
                    
                    correctedCount++;
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${image.filename}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n📊 GPS Coordinate Correction Summary:');
        console.log(`  📁 Takeout images analyzed: ${takeoutCount}`);
        console.log(`  🌍 Images with positive longitude: ${positiveCount}`);
        console.log(`  ✅ Total images corrected: ${correctedCount}`);
        console.log(`  📋 Corrections from Google JSON: ${jsonSourceCount}`);
        console.log(`  🔄 Corrections from longitude sign flip: ${signFlipCount}`);
        console.log(`  ❌ Errors encountered: ${errorCount}`);
        
        if (correctedCount > 0) {
            console.log('\n🎉 GPS coordinate correction completed successfully!');
            console.log('   📍 Google JSON metadata used when available for maximum accuracy');
            console.log('   🔄 Longitude sign correction applied as fallback');
            console.log('   📍 Geolocation records cleared for reprocessing');
            console.log('\n💡 Next steps:');
            console.log('   - Run a scan to reprocess geolocation for corrected images');
            console.log('   - Verify photos now appear in correct geographic locations');
        }
        
    } catch (error) {
        console.error('❌ Error during GPS coordinate correction:', error);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⚠️  Received interrupt signal, shutting down gracefully...');
    await db.destroy();
    process.exit(0);
});

main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});