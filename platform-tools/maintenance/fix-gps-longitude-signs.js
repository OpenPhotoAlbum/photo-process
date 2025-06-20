#!/usr/bin/env node

/**
 * Fix GPS Longitude Signs for Western Hemisphere
 * 
 * This script identifies and fixes images where GPS longitude should be negative
 * (Western hemisphere) but was stored as positive due to missing GPSLongitudeRef
 * in EXIF data.
 * 
 * Problem: GPS coordinates like "42.34645, 71.095903" for Boston area
 * Should be: "42.34645, -71.095903" (negative longitude for Western hemisphere)
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

async function main() {
    try {
        console.log('🔧 GPS Longitude Sign Repair Tool');
        console.log('=====================================');
        
        // Find all images with positive longitude in North America latitude range
        // This catches most US/Canada photos that should have negative longitude
        const affectedImages = await db('images')
            .select('id', 'filename', 'gps_latitude', 'gps_longitude', 'original_path')
            .whereNotNull('gps_latitude')
            .whereNotNull('gps_longitude')
            .where('gps_longitude', '>', 0)
            .where('gps_latitude', '>=', 25)  // Southern US
            .where('gps_latitude', '<=', 70)  // Northern Canada
            .orderBy('gps_longitude', 'desc');
            
        console.log(`Found ${affectedImages.length} images with potentially incorrect positive longitude`);
        
        if (affectedImages.length === 0) {
            console.log('✅ No images need GPS longitude sign correction');
            process.exit(0);
        }
        
        // Show some examples
        console.log('\n📍 Sample affected coordinates:');
        affectedImages.slice(0, 5).forEach(img => {
            console.log(`  ${img.filename}: ${img.gps_latitude}, ${img.gps_longitude} (should be ${img.gps_latitude}, -${img.gps_longitude})`);
        });
        
        // Ask for confirmation
        console.log(`\n⚠️  This will update ${affectedImages.length} images to use negative longitude`);
        console.log('   This is typically correct for photos taken in North/South America');
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const shouldProceed = await new Promise(resolve => {
            readline.question('\nProceed with GPS longitude sign correction? (y/N): ', answer => {
                readline.close();
                resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
        });
        
        if (!shouldProceed) {
            console.log('❌ Operation cancelled');
            process.exit(0);
        }
        
        console.log('\n🔄 Starting GPS longitude sign correction...');
        
        let updatedCount = 0;
        let relocatedCount = 0;
        let errorCount = 0;
        
        for (const image of affectedImages) {
            try {
                const correctedLongitude = -Math.abs(image.gps_longitude);
                
                console.log(`Fixing ${image.filename}: ${image.gps_longitude} → ${correctedLongitude}`);
                
                // Update the longitude in the images table
                await db('images')
                    .where('id', image.id)
                    .update({
                        gps_longitude: correctedLongitude,
                        updated_at: new Date()
                    });
                
                // Also update in image_metadata table if it exists
                await db('image_metadata')
                    .where('image_id', image.id)
                    .update({
                        longitude: correctedLongitude,
                        updated_at: new Date()
                    });
                
                updatedCount++;
                
                // Clear existing geolocation data so it can be reprocessed later
                try {
                    const deletedCount = await db('image_geolocations')
                        .where('image_id', image.id)
                        .del();
                    
                    if (deletedCount > 0) {
                        console.log(`  📍 Cleared ${deletedCount} existing geolocation record(s)`);
                        relocatedCount++;
                    }
                } catch (geoError) {
                    console.log(`  ⚠️  Failed to clear geolocation data: ${geoError.message}`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${image.filename}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n📊 GPS Longitude Sign Correction Summary:');
        console.log(`  📝 Total images processed: ${affectedImages.length}`);
        console.log(`  ✅ GPS coordinates corrected: ${updatedCount}`);
        console.log(`  📍 Geolocation records cleared: ${relocatedCount}`);
        console.log(`  ❌ Errors encountered: ${errorCount}`);
        
        if (updatedCount > 0) {
            console.log('\n🎉 GPS longitude sign correction completed successfully!');
            console.log('   Photos now have correct Western hemisphere coordinates');
            console.log('   Cleared geolocation records will be reprocessed on next scan');
            console.log('\n💡 Next steps:');
            console.log('   - Run a scan to reprocess geolocation for corrected images');
            console.log('   - Check that photos now appear in correct geographic locations');
        }
        
    } catch (error) {
        console.error('❌ Error during GPS longitude correction:', error);
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