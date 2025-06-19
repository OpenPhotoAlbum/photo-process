#!/usr/bin/env node

/**
 * Retroactively extract enhanced EXIF metadata from existing photos
 * This script processes photos that have already been imported but
 * could benefit from the new enhanced metadata fields
 */

const path = require('path');
const { performance } = require('perf_hooks');

// Load environment variables
require('dotenv').config({
    path: path.join(__dirname, '../../.env')
});

// Initialize Knex
const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: process.env.MYSQL_HOST || 'localhost',
        port: process.env.MYSQL_PORT || 3307,
        user: process.env.MYSQL_USER || 'photo',
        password: process.env.MYSQL_PASSWORD || 'Dalekini21',
        database: process.env.MYSQL_DATABASE || 'photo-process'
    }
});

// Import enhanced EXIF extraction
const { extractEnhancedMetadata, extractExifKeywords, estimateGPSAccuracy } = require('../../services/api/build/util/enhanced-exif-extractor');
const { exifFromImage } = require('../../services/api/build/util/exif');

async function checkMigrationStatus() {
    try {
        // Check if enhanced metadata columns exist
        const columns = await knex.raw(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'image_metadata' 
            AND COLUMN_NAME IN ('exposure_compensation', 'metering_mode', 'gps_h_positioning_error')
        `, [process.env.MYSQL_DATABASE || 'photo-process']);
        
        if (!columns[0].length) {
            console.error('❌ Enhanced metadata migration has not been run yet!');
            console.error('Please run: npm run db:migrate');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Failed to check migration status:', error);
        return false;
    }
}

async function getImagesToProcess(limit = null) {
    let query = knex('images')
        .leftJoin('image_metadata', 'images.id', 'image_metadata.image_id')
        .select(
            'images.id',
            'images.original_path',
            'images.filename',
            'image_metadata.raw_exif'
        )
        .whereNotNull('image_metadata.raw_exif')
        .whereNull('image_metadata.exposure_compensation') // Only process images without enhanced metadata
        .orderBy('images.id', 'desc');
    
    if (limit) {
        query = query.limit(limit);
    }
    
    return query;
}

async function processImage(image) {
    try {
        const startTime = performance.now();
        
        // Parse raw EXIF data
        const rawExif = typeof image.raw_exif === 'string' ? 
            JSON.parse(image.raw_exif) : 
            image.raw_exif;
        
        if (!rawExif || Object.keys(rawExif).length === 0) {
            console.log(`⚠️  No EXIF data for image ${image.id} (${image.filename})`);
            return { skipped: true };
        }
        
        // Extract enhanced metadata
        const enhanced = extractEnhancedMetadata(rawExif);
        
        // Estimate GPS accuracy if coordinates exist
        let gpsAccuracyInfo = null;
        if (enhanced.latitude && enhanced.longitude) {
            gpsAccuracyInfo = estimateGPSAccuracy(enhanced);
        }
        
        // Update metadata record with enhanced fields
        await knex('image_metadata')
            .where('image_id', image.id)
            .update({
                // Advanced camera settings
                exposure_compensation: enhanced.exposure_compensation,
                metering_mode: enhanced.metering_mode,
                exposure_program: enhanced.exposure_program,
                scene_type: enhanced.scene_type,
                subject_distance: enhanced.subject_distance,
                focal_length_35mm: enhanced.focal_length_35mm,
                max_aperture_value: enhanced.max_aperture_value,
                digital_zoom_ratio: enhanced.digital_zoom_ratio,
                gain_control: enhanced.gain_control,
                contrast: enhanced.contrast,
                saturation: enhanced.saturation,
                sharpness: enhanced.sharpness,
                brightness_value: enhanced.brightness_value,
                
                // GPS enhancements
                gps_latitude_ref: enhanced.gps_latitude_ref,
                gps_longitude_ref: enhanced.gps_longitude_ref,
                gps_altitude_ref: enhanced.gps_altitude_ref,
                gps_dop: enhanced.gps_dop,
                gps_satellites: enhanced.gps_satellites,
                gps_status: enhanced.gps_status,
                gps_measure_mode: enhanced.gps_measure_mode,
                gps_map_datum: enhanced.gps_map_datum,
                gps_datetime: enhanced.gps_datetime,
                gps_processing_method: enhanced.gps_processing_method,
                gps_area_information: enhanced.gps_area_information,
                gps_h_positioning_error: enhanced.gps_h_positioning_error,
                
                // Time precision
                subsec_time_original: enhanced.subsec_time_original,
                timezone_offset: enhanced.timezone_offset,
                
                // Creator/copyright
                artist: enhanced.artist,
                copyright: enhanced.copyright,
                image_description: enhanced.image_description,
                user_comment: enhanced.user_comment,
                rating: enhanced.rating,
                
                // Additional metadata
                lens_make: enhanced.lens_make,
                lens_serial_number: enhanced.lens_serial_number,
                lens_info: enhanced.lens_info,
                body_serial_number: enhanced.body_serial_number,
                owner_name: enhanced.owner_name,
                
                // Scene/subject
                scene_capture_type: enhanced.scene_capture_type,
                subject_area: enhanced.subject_area,
                light_source: enhanced.light_source,
                
                updated_at: new Date()
            });
        
        // Extract and store keywords
        const { keywords } = extractExifKeywords(rawExif);
        if (keywords.length > 0) {
            for (const keyword of keywords) {
                try {
                    await knex('image_keywords').insert({
                        image_id: image.id,
                        keyword: keyword,
                        source: 'exif',
                        created_at: new Date()
                    });
                } catch (error) {
                    // Ignore duplicate key errors
                    if (!error.message.includes('Duplicate entry')) {
                        console.error(`Failed to insert keyword "${keyword}" for image ${image.id}:`, error.message);
                    }
                }
            }
        }
        
        const processingTime = performance.now() - startTime;
        
        return {
            success: true,
            processingTime,
            enhanced: {
                hasGPSAccuracy: !!gpsAccuracyInfo,
                gpsAccuracy: gpsAccuracyInfo?.accuracy,
                gpsConfidence: gpsAccuracyInfo?.confidenceScore,
                keywordCount: keywords.length,
                hasCreator: !!enhanced.artist,
                hasRating: enhanced.rating !== undefined
            }
        };
        
    } catch (error) {
        console.error(`❌ Failed to process image ${image.id}:`, error);
        return { error: true, message: error.message };
    }
}

async function main() {
    console.log('🔍 Enhanced EXIF Metadata Extraction Tool');
    console.log('=========================================\n');
    
    try {
        // Check if migration has been run
        const migrationReady = await checkMigrationStatus();
        if (!migrationReady) {
            process.exit(1);
        }
        
        // Count images to process
        const totalCount = await knex('images')
            .leftJoin('image_metadata', 'images.id', 'image_metadata.image_id')
            .whereNotNull('image_metadata.raw_exif')
            .whereNull('image_metadata.exposure_compensation')
            .count('images.id as count')
            .first();
        
        const total = totalCount.count;
        console.log(`📊 Found ${total} images to process\n`);
        
        if (total === 0) {
            console.log('✅ All images already have enhanced metadata!');
            await knex.destroy();
            return;
        }
        
        // Ask user for confirmation
        console.log('This will extract enhanced metadata for all images.');
        console.log('The process is safe and can be interrupted at any time.\n');
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            readline.question('Do you want to proceed? (yes/no): ', resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            console.log('\n❌ Operation cancelled');
            await knex.destroy();
            return;
        }
        
        console.log('\n🚀 Starting enhanced metadata extraction...\n');
        
        // Process in batches
        const batchSize = 100;
        let processed = 0;
        let successful = 0;
        let skipped = 0;
        let errors = 0;
        
        const stats = {
            withGPSAccuracy: 0,
            withKeywords: 0,
            withCreator: 0,
            withRating: 0,
            totalProcessingTime: 0
        };
        
        while (processed < total) {
            const images = await getImagesToProcess(batchSize);
            
            for (const image of images) {
                const result = await processImage(image);
                
                if (result.success) {
                    successful++;
                    stats.totalProcessingTime += result.processingTime;
                    
                    if (result.enhanced.hasGPSAccuracy) stats.withGPSAccuracy++;
                    if (result.enhanced.keywordCount > 0) stats.withKeywords++;
                    if (result.enhanced.hasCreator) stats.withCreator++;
                    if (result.enhanced.hasRating) stats.withRating++;
                    
                    console.log(`✅ [${successful}/${total}] ${image.filename} - ${result.processingTime.toFixed(0)}ms`);
                    
                    if (result.enhanced.gpsAccuracy) {
                        console.log(`   📍 GPS: ${result.enhanced.gpsAccuracy} accuracy (${(result.enhanced.gpsConfidence * 100).toFixed(0)}% confidence)`);
                    }
                    if (result.enhanced.keywordCount > 0) {
                        console.log(`   🏷️  Keywords: ${result.enhanced.keywordCount}`);
                    }
                } else if (result.skipped) {
                    skipped++;
                } else if (result.error) {
                    errors++;
                }
                
                processed++;
                
                // Show progress every 10 images
                if (processed % 10 === 0) {
                    const percentage = ((processed / total) * 100).toFixed(1);
                    console.log(`\n📊 Progress: ${processed}/${total} (${percentage}%)\n`);
                }
            }
        }
        
        // Final statistics
        console.log('\n========================================');
        console.log('✅ Enhanced Metadata Extraction Complete!');
        console.log('========================================\n');
        console.log(`📊 Summary:`);
        console.log(`   • Total processed: ${processed}`);
        console.log(`   • Successful: ${successful}`);
        console.log(`   • Skipped: ${skipped}`);
        console.log(`   • Errors: ${errors}`);
        console.log(`\n📈 Enhanced Metadata Found:`);
        console.log(`   • GPS accuracy data: ${stats.withGPSAccuracy}`);
        console.log(`   • Keywords/tags: ${stats.withKeywords}`);
        console.log(`   • Creator info: ${stats.withCreator}`);
        console.log(`   • Star ratings: ${stats.withRating}`);
        console.log(`\n⏱️  Average processing time: ${(stats.totalProcessingTime / successful).toFixed(0)}ms per image`);
        console.log(`   Total time: ${(stats.totalProcessingTime / 1000).toFixed(1)}s`);
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
    } finally {
        await knex.destroy();
    }
}

// Run the script
main().catch(console.error);