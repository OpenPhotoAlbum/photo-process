#!/usr/bin/env node

const { db, ImageRepository, MetadataRepository } = require('../../services/api/build/models/database.js');
const { extractBestDate, getAllExifDates } = require('../../services/api/build/util/exif-date-extractor.js');
const fs = require('fs').promises;
const path = require('path');

async function backfillDates() {
    console.log('Starting date backfill process...');
    
    try {
        // Find all images with NULL date_taken
        const imagesWithNullDates = await db('images')
            .whereNull('date_taken')
            .select('id', 'filename', 'original_path', 'processed_path');
        
        console.log(`Found ${imagesWithNullDates.length} images with NULL date_taken`);
        
        let updated = 0;
        let failed = 0;
        
        for (const image of imagesWithNullDates) {
            try {
                console.log(`\nProcessing image ${image.id}: ${image.filename}`);
                
                // First try to get date from image_metadata table
                const metadata = await db('image_metadata')
                    .where('image_id', image.id)
                    .first();
                
                let bestDate = null;
                let source = 'unknown';
                
                // Try to get date from metadata JSON file if available
                if (image.processed_path) {
                    try {
                        // Build the metadata JSON path based on processed directory structure
                        const processedDir = path.dirname(image.processed_path);
                        const baseName = path.basename(image.processed_path, path.extname(image.processed_path));
                        const metadataPath = path.join(processedDir, 'meta', `${baseName}.json`);
                        
                        const metadataContent = await fs.readFile(metadataPath, 'utf8');
                        const metadataJson = JSON.parse(metadataContent);
                        
                        if (metadataJson.exif) {
                            bestDate = extractBestDate(metadataJson.exif);
                            source = 'metadata_json';
                            
                            // Debug: show all available dates
                            const allDates = getAllExifDates(metadataJson.exif);
                            console.log('Available dates in EXIF:');
                            for (const [field, date] of Object.entries(allDates)) {
                                if (date) {
                                    console.log(`  ${field}: ${date.toISOString()}`);
                                }
                            }
                        }
                    } catch (error) {
                        console.warn(`  Failed to read metadata JSON: ${error.message}`);
                    }
                }
                
                // If no date found yet, try to parse from filename
                if (!bestDate) {
                    // Common filename patterns: YYYY-MM-DD, YYYYMMDD, IMG_YYYYMMDD, etc.
                    const filenamePatterns = [
                        // YYYY-MM-DD format
                        /(\d{4})-(\d{2})-(\d{2})/,
                        // YYYYMMDD format
                        /(\d{4})(\d{2})(\d{2})/,
                        // IMG_YYYYMMDD format
                        /IMG_(\d{4})(\d{2})(\d{2})/
                    ];
                    
                    for (const pattern of filenamePatterns) {
                        const match = image.filename.match(pattern);
                        if (match) {
                            const year = parseInt(match[1]);
                            const month = parseInt(match[2]);
                            const day = parseInt(match[3]);
                            
                            if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                                bestDate = new Date(year, month - 1, day);
                                source = 'filename';
                                console.log(`  Extracted date from filename: ${bestDate.toISOString()}`);
                                break;
                            }
                        }
                    }
                }
                
                // Update the database if we found a date
                if (bestDate) {
                    await db('images')
                        .where('id', image.id)
                        .update({
                            date_taken: bestDate,
                            updated_at: new Date()
                        });
                    
                    console.log(`  ✓ Updated date_taken to ${bestDate.toISOString()} (source: ${source})`);
                    updated++;
                } else {
                    console.log(`  ✗ No valid date found`);
                    failed++;
                }
                
            } catch (error) {
                console.error(`  Error processing image ${image.id}:`, error.message);
                failed++;
            }
        }
        
        console.log('\n=== Backfill Summary ===');
        console.log(`Total images processed: ${imagesWithNullDates.length}`);
        console.log(`Successfully updated: ${updated}`);
        console.log(`Failed/No date found: ${failed}`);
        
        // Show some statistics
        const stats = await db('images')
            .select(
                db.raw('COUNT(*) as total'),
                db.raw('SUM(CASE WHEN date_taken IS NOT NULL THEN 1 ELSE 0 END) as with_date'),
                db.raw('SUM(CASE WHEN date_taken IS NULL THEN 1 ELSE 0 END) as without_date')
            )
            .first();
        
        console.log('\n=== Database Statistics ===');
        console.log(`Total images: ${stats.total}`);
        console.log(`Images with date: ${stats.with_date} (${((stats.with_date / stats.total) * 100).toFixed(2)}%)`);
        console.log(`Images without date: ${stats.without_date} (${((stats.without_date / stats.total) * 100).toFixed(2)}%)`);
        
    } catch (error) {
        console.error('Fatal error during backfill:', error);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

// Run the backfill
backfillDates()
    .then(() => {
        console.log('\nBackfill completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\nBackfill failed:', error);
        process.exit(1);
    });