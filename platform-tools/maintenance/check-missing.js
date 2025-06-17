#!/usr/bin/env node

/**
 * Check for missing images between database and file system
 * Updated for database-centric architecture with hash-based file organization
 */

const fs = require('fs');
const path = require('path');

// Import our database models and config system
const { ImageRepository, db } = require('../../services/api/build/models/database');
const { configManager } = require('../../services/api/build/util/config-manager');

async function checkMissingImages() {
    try {
        console.log('🔍 Checking for missing images between database and file system...\n');
        
        // Get configuration (configManager is a singleton that auto-initializes)
        const config = {
            storage: configManager.getStorage()
        };
        
        console.log('📊 Database vs File System Analysis\n');
        console.log('=' .repeat(50));
        
        // Get all images from database
        const allImages = await ImageRepository.findMany();
        console.log(`📊 Database contains: ${allImages.length} images`);
        
        // Check different file organization approaches
        await checkHashBasedFiles(allImages, config);
        await checkLegacyFiles(allImages, config);
        await checkOriginalFiles(allImages, config);
        
        // Summary statistics
        await printDatabaseStatistics();
        
    } catch (error) {
        console.error('❌ Error checking missing images:', error);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

/**
 * Check hash-based organized files (new system)
 */
async function checkHashBasedFiles(images, config) {
    console.log('\n🗂️  Checking Hash-Based Files (New System)');
    console.log('-'.repeat(40));
    
    const processedMediaDir = path.join(config.storage.processedDir, 'media');
    let hashBasedCount = 0;
    let missingHashBased = [];
    let foundHashBased = [];
    
    for (const image of images) {
        if (image.relative_media_path) {
            hashBasedCount++;
            const filePath = path.join(processedMediaDir, image.relative_media_path);
            
            if (fs.existsSync(filePath)) {
                foundHashBased.push(image);
            } else {
                missingHashBased.push({
                    id: image.id,
                    filename: image.filename,
                    relativePath: image.relative_media_path,
                    expectedPath: filePath
                });
            }
        }
    }
    
    console.log(`  📁 Hash-based images in DB: ${hashBasedCount}`);
    console.log(`  ✅ Found on disk: ${foundHashBased.length}`);
    console.log(`  ❌ Missing from disk: ${missingHashBased.length}`);
    
    if (missingHashBased.length > 0 && missingHashBased.length <= 10) {
        console.log('\n  Missing hash-based files:');
        missingHashBased.forEach(item => {
            console.log(`    - ID ${item.id}: ${item.relativePath}`);
        });
    } else if (missingHashBased.length > 10) {
        console.log(`\n  ⚠️  Too many missing files to list (${missingHashBased.length} total)`);
    }
}

/**
 * Check legacy processed files (old system)
 */
async function checkLegacyFiles(images, config) {
    console.log('\n📂 Checking Legacy Processed Files (Old System)');
    console.log('-'.repeat(40));
    
    const legacyProcessedDir = path.join(config.storage.processedDir, 'recents');
    let legacyCount = 0;
    let missingLegacy = [];
    let foundLegacy = [];
    
    for (const image of images) {
        if (!image.relative_media_path && image.filename) {
            legacyCount++;
            const filePath = path.join(legacyProcessedDir, image.filename);
            
            if (fs.existsSync(filePath)) {
                foundLegacy.push(image);
            } else {
                missingLegacy.push({
                    id: image.id,
                    filename: image.filename,
                    expectedPath: filePath
                });
            }
        }
    }
    
    console.log(`  📁 Legacy images in DB: ${legacyCount}`);
    console.log(`  ✅ Found on disk: ${foundLegacy.length}`);
    console.log(`  ❌ Missing from disk: ${missingLegacy.length}`);
    
    if (missingLegacy.length > 0 && missingLegacy.length <= 10) {
        console.log('\n  Missing legacy files:');
        missingLegacy.forEach(item => {
            console.log(`    - ID ${item.id}: ${item.filename}`);
        });
    } else if (missingLegacy.length > 10) {
        console.log(`\n  ⚠️  Too many missing files to list (${missingLegacy.length} total)`);
    }
}

/**
 * Check original source files
 */
async function checkOriginalFiles(images, config) {
    console.log('\n📷 Checking Original Source Files');
    console.log('-'.repeat(40));
    
    let missingOriginals = [];
    let foundOriginals = [];
    let invalidPaths = [];
    
    for (const image of images) {
        if (image.original_path) {
            if (fs.existsSync(image.original_path)) {
                foundOriginals.push(image);
            } else {
                // Try alternative path construction for legacy entries
                const alternativePath = path.join(config.storage.sourceDir, 'recents', image.filename);
                if (fs.existsSync(alternativePath)) {
                    foundOriginals.push(image);
                } else {
                    missingOriginals.push({
                        id: image.id,
                        filename: image.filename,
                        originalPath: image.original_path,
                        alternativePath: alternativePath
                    });
                }
            }
        } else {
            invalidPaths.push(image);
        }
    }
    
    console.log(`  📁 Images with original paths: ${images.length - invalidPaths.length}`);
    console.log(`  ✅ Original files found: ${foundOriginals.length}`);
    console.log(`  ❌ Missing original files: ${missingOriginals.length}`);
    console.log(`  ⚠️  Invalid/missing paths: ${invalidPaths.length}`);
    
    if (missingOriginals.length > 0 && missingOriginals.length <= 5) {
        console.log('\n  Missing original files:');
        missingOriginals.forEach(item => {
            console.log(`    - ID ${item.id}: ${item.originalPath}`);
        });
    }
}

/**
 * Print database statistics
 */
async function printDatabaseStatistics() {
    console.log('\n📈 Database Statistics');
    console.log('-'.repeat(40));
    
    try {
        // Processing status breakdown
        const statusStats = await db('images')
            .select('processing_status')
            .count('* as count')
            .groupBy('processing_status');
        
        console.log('  Processing Status:');
        statusStats.forEach(stat => {
            console.log(`    ${stat.processing_status}: ${stat.count}`);
        });
        
        // Migration status for hash-based files
        const migrationStats = await db('images')
            .select('migration_status')
            .count('* as count')
            .whereNotNull('migration_status')
            .groupBy('migration_status');
        
        if (migrationStats.length > 0) {
            console.log('\n  Hash Migration Status:');
            migrationStats.forEach(stat => {
                console.log(`    ${stat.migration_status}: ${stat.count}`);
            });
        }
        
        // Astrophotography statistics
        const astroStats = await db('images')
            .select('is_astrophotography')
            .count('* as count')
            .whereNotNull('is_astrophotography')
            .groupBy('is_astrophotography');
        
        if (astroStats.length > 0) {
            console.log('\n  Astrophotography Detection:');
            astroStats.forEach(stat => {
                const label = stat.is_astrophotography ? 'Astrophotography' : 'Regular photos';
                console.log(`    ${label}: ${stat.count}`);
            });
        }
        
        // File organization breakdown
        const hashBasedCount = await db('images').whereNotNull('relative_media_path').count('* as count').first();
        const legacyCount = await db('images').whereNull('relative_media_path').count('* as count').first();
        
        console.log('\n  File Organization:');
        console.log(`    Hash-based: ${hashBasedCount.count}`);
        console.log(`    Legacy: ${legacyCount.count}`);
        
    } catch (error) {
        console.log('  ❌ Error fetching statistics:', error.message);
    }
}

/**
 * Check orphaned files on disk that aren't in database
 */
async function checkOrphanedFiles(config) {
    console.log('\n🗑️  Checking for Orphaned Files');
    console.log('-'.repeat(40));
    
    // This would be a comprehensive scan of the file system
    // vs database entries - could be added as an optional feature
    console.log('  📝 Note: Orphaned file detection can be added if needed');
}

// Run the check
if (require.main === module) {
    checkMissingImages().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { checkMissingImages };