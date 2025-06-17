#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Ensure TypeScript is compiled first
console.log('📦 Compiling TypeScript...');
try {
    const apiDir = path.join(__dirname, '../../services/api');
    execSync('npm run build', { cwd: apiDir, stdio: 'inherit' });
} catch (error) {
    console.error('❌ TypeScript compilation failed:', error.message);
    process.exit(1);
}

const { db } = require('../../services/api/build/models/database');
const { configManager } = require('../../services/api/build/util/config-manager');
const fs = require('fs');

async function main() {
    const args = process.argv.slice(2);
    
    try {
        if (args.includes('--help') || args.includes('-h')) {
            showHelp();
            return;
        }
        
        if (args.includes('--dry-run')) {
            await performDryRun();
            return;
        }
        
        if (args.includes('--stats')) {
            await showStats();
            return;
        }
        
        console.log('🧹 Starting cleanup of low-confidence objects...');
        
        const minConfidence = config.getMinConfidence();
        console.log(`📊 Using minimum confidence threshold: ${minConfidence}`);
        
        await cleanupLowConfidenceObjects(minConfidence);
        await updateJsonMetadataFiles(minConfidence);
        
        console.log('✅ Cleanup completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('💥 Cleanup failed:', error);
        process.exit(1);
    }
}

async function showStats() {
    console.log('📊 Analyzing object detection confidence distribution...\n');
    
    const minConfidence = config.getMinConfidence();
    
    // Get total object count
    const totalObjects = await db('detected_objects').count('* as count').first();
    console.log(`📁 Total objects in database: ${totalObjects.count}`);
    
    // Get high confidence objects
    const highConfidenceObjects = await db('detected_objects')
        .where('confidence', '>=', minConfidence)
        .count('* as count').first();
    
    // Get low confidence objects
    const lowConfidenceObjects = await db('detected_objects')
        .where('confidence', '<', minConfidence)
        .count('* as count').first();
    
    console.log(`✅ High-confidence objects (>= ${minConfidence}): ${highConfidenceObjects.count}`);
    console.log(`❌ Low-confidence objects (< ${minConfidence}): ${lowConfidenceObjects.count}`);
    
    const percentage = totalObjects.count > 0 ? 
        Math.round((lowConfidenceObjects.count / totalObjects.count) * 100) : 0;
    console.log(`📊 ${percentage}% of objects would be removed`);
    
    // Show confidence distribution
    console.log('\n📈 Confidence Distribution:');
    const distribution = await db('detected_objects')
        .select(db.raw('ROUND(confidence, 1) as conf_range'))
        .count('* as count')
        .groupBy(db.raw('ROUND(confidence, 1)'))
        .orderBy('conf_range', 'desc');
    
    distribution.forEach(row => {
        const indicator = row.conf_range >= minConfidence ? '✅' : '❌';
        console.log(`   ${indicator} ${row.conf_range}: ${row.count} objects`);
    });
    
    // Show top low-confidence classes
    console.log('\n🔍 Top Low-Confidence Object Classes:');
    const lowConfidenceClasses = await db('detected_objects')
        .select('class')
        .count('* as count')
        .avg('confidence as avg_confidence')
        .where('confidence', '<', minConfidence)
        .groupBy('class')
        .orderBy('count', 'desc')
        .limit(10);
    
    lowConfidenceClasses.forEach(row => {
        console.log(`   ${row.class}: ${row.count} objects (avg conf: ${Math.round(row.avg_confidence * 100)/100})`);
    });
}

async function performDryRun() {
    console.log('🔍 Performing dry run (no changes will be made)...\n');
    
    const minConfidence = config.getMinConfidence();
    
    // Get objects that would be deleted
    const objectsToDelete = await db('detected_objects')
        .select('class', 'confidence', 'image_id')
        .where('confidence', '<', minConfidence)
        .orderBy('confidence', 'asc');
    
    console.log(`📊 Found ${objectsToDelete.length} objects that would be removed (confidence < ${minConfidence}):`);
    
    // Group by class for summary
    const classSummary = {};
    objectsToDelete.forEach(obj => {
        if (!classSummary[obj.class]) {
            classSummary[obj.class] = { count: 0, minConf: 1, maxConf: 0 };
        }
        classSummary[obj.class].count++;
        classSummary[obj.class].minConf = Math.min(classSummary[obj.class].minConf, obj.confidence);
        classSummary[obj.class].maxConf = Math.max(classSummary[obj.class].maxConf, obj.confidence);
    });
    
    console.log('\n📋 Objects to be removed by class:');
    Object.entries(classSummary)
        .sort(([,a], [,b]) => b.count - a.count)
        .forEach(([className, stats]) => {
            console.log(`   ${className}: ${stats.count} objects (conf range: ${stats.minConf.toFixed(2)} - ${stats.maxConf.toFixed(2)})`);
        });
    
    // Get affected images
    const affectedImages = await db('detected_objects')
        .select('image_id')
        .where('confidence', '<', minConfidence)
        .distinct('image_id');
    
    console.log(`\n🖼️  ${affectedImages.length} images would have objects removed`);
    
    console.log('\n💡 To perform the actual cleanup, run:');
    console.log('   node cleanup-low-confidence.js');
}

async function cleanupLowConfidenceObjects(minConfidence) {
    console.log(`🗑️  Removing objects with confidence < ${minConfidence}...`);
    
    // Get count before deletion
    const beforeCount = await db('detected_objects').count('* as count').first();
    
    // Delete low confidence objects
    const deletedCount = await db('detected_objects')
        .where('confidence', '<', minConfidence)
        .del();
    
    // Get count after deletion
    const afterCount = await db('detected_objects').count('* as count').first();
    
    console.log(`   ✅ Removed ${deletedCount} low-confidence objects`);
    console.log(`   📊 Objects remaining: ${afterCount.count} (was ${beforeCount.count})`);
    
    return deletedCount;
}

async function updateJsonMetadataFiles(minConfidence) {
    console.log(`📝 Updating JSON metadata files to remove low-confidence objects...`);
    
    const MEDIA_DEST_DIR = process.env.media_dest_dir || '/mnt/hdd/photo-process/processed';
    const metaDir = path.join(MEDIA_DEST_DIR, 'recents', 'meta');
    
    if (!fs.existsSync(metaDir)) {
        console.log('   ⚠️  Metadata directory not found, skipping JSON file updates');
        return;
    }
    
    const metaFiles = fs.readdirSync(metaDir).filter(file => file.endsWith('.json'));
    let updatedFiles = 0;
    let totalObjectsRemoved = 0;
    
    for (const file of metaFiles) {
        try {
            const filePath = path.join(metaDir, file);
            const metadata = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (metadata.objects && Array.isArray(metadata.objects)) {
                const originalCount = metadata.objects.length;
                metadata.objects = metadata.objects.filter(obj => obj.confidence >= minConfidence);
                const newCount = metadata.objects.length;
                
                if (originalCount !== newCount) {
                    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
                    updatedFiles++;
                    totalObjectsRemoved += (originalCount - newCount);
                }
            }
        } catch (error) {
            console.error(`   ⚠️  Error updating ${file}: ${error.message}`);
        }
    }
    
    console.log(`   ✅ Updated ${updatedFiles} JSON metadata files`);
    console.log(`   📊 Removed ${totalObjectsRemoved} low-confidence objects from JSON files`);
}

function showHelp() {
    console.log(`
🧹 Low-Confidence Object Cleanup Tool
=====================================

Remove objects from database and metadata files that don't meet the current confidence threshold.

Usage:
  node cleanup-low-confidence.js [options]

Options:
  --help, -h       Show this help message
  --stats          Show confidence distribution statistics
  --dry-run        Show what would be removed without making changes
  (no options)     Perform the cleanup

Examples:
  node cleanup-low-confidence.js --stats          # Analyze current objects
  node cleanup-low-confidence.js --dry-run        # Preview changes
  node cleanup-low-confidence.js                  # Clean up low-confidence objects

Notes:
  - Uses current confidence threshold from config (${config.getMinConfidence()})
  - Removes objects from both database and JSON metadata files
  - Always run --dry-run first to preview changes!
`);
}

main();