#!/usr/bin/env node

const knex = require('knex');
const config = require('../../infrastructure/database/knexfile.platform');
const fs = require('fs').promises;
const path = require('path');

const db = knex(config);

// Helper function to count files recursively
async function countFilesRecursively(dirPath) {
    let count = 0;
    try {
        const items = await fs.readdir(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = await fs.stat(itemPath);
            if (stats.isDirectory()) {
                count += await countFilesRecursively(itemPath);
            } else {
                count++;
            }
        }
    } catch (error) {
        // Ignore errors, just return current count
    }
    return count;
}

async function cleanupLocalData() {
    console.log('🧹 LOCAL DATA CLEANUP SCRIPT 🧹');
    console.log('===================================\n');

    try {
        // 1. Clear database tables (preserve CompreFace trained faces)
        console.log('1️⃣ Clearing database tables (preserving CompreFace trained faces)...');
        
        // Get count of persons with CompreFace subjects before clearing
        let preservedPersons = 0;
        try {
            const result = await db('persons').whereNotNull('compreface_subject_id').count('* as count').first();
            preservedPersons = result.count;
        } catch (error) {
            console.log('   ⚠️  Could not count CompreFace trained persons');
        }
        
        const tables = [
            'face_cluster_members',
            'face_clusters', 
            'face_similarities',
            'recognition_training_history',
            'detected_faces', 
            'detected_objects',
            'image_metadata', 
            'images'
        ];
        
        // Special handling for persons table - preserve CompreFace trained persons
        console.log('   🔄 Clearing persons table (preserving CompreFace trained faces)...');
        try {
            const personsCount = await db('persons').count('* as count').first();
            // Only delete persons that don't have CompreFace subject IDs
            const deletedPersons = await db('persons').whereNull('compreface_subject_id').del();
            console.log(`   ✅ Cleared persons table (${deletedPersons} of ${personsCount.count} records, preserved ${preservedPersons} CompreFace trained)`);
        } catch (error) {
            console.log(`   ⚠️  Error clearing persons table: ${error.message}`);
        }
        
        for (const table of tables) {
            try {
                const count = await db(table).count('* as count').first();
                await db(table).del();
                console.log(`   ✅ Cleared ${table} table (${count.count} records)`);
            } catch (error) {
                console.log(`   ⚠️  Table ${table} doesn't exist or error: ${error.message}`);
            }
        }

        // 2. Clear processed files
        console.log('\n2️⃣ Clearing processed files...');
        
        const processedDir = path.join(__dirname, '../../processed');
        
        try {
            const dirs = await fs.readdir(processedDir);
            
            for (const dir of dirs) {
                if (dir === '.gitkeep') continue;
                
                const dirPath = path.join(processedDir, dir);
                const stats = await fs.stat(dirPath);
                
                if (stats.isDirectory()) {
                    // Count files recursively before deletion
                    const fileCount = await countFilesRecursively(dirPath);
                    
                    // Remove directory and all its contents recursively
                    await fs.rm(dirPath, { recursive: true, force: true });
                    console.log(`   ✅ Removed directory: processed/${dir} (${fileCount} files)`);
                }
            }
        } catch (error) {
            console.log(`   ⚠️  Error clearing processed files: ${error.message}`);
        }

        // 3. Verify clean state
        console.log('\n3️⃣ Verifying local data clean state...');
        
        let totalRecords = 0;
        let remainingPersons = 0;
        
        for (const table of tables) {
            try {
                const count = await db(table).count('* as count').first();
                totalRecords += count.count;
            } catch (error) {
                // Ignore
            }
        }
        
        try {
            const personsCount = await db('persons').count('* as count').first();
            remainingPersons = personsCount.count;
            totalRecords += remainingPersons;
        } catch (error) {
            // Ignore
        }
        
        console.log(`   📊 Database records remaining: ${totalRecords}`);
        console.log(`   👥 CompreFace trained persons preserved: ${remainingPersons}`);

        console.log('\n🎉 LOCAL DATA CLEANUP COMPLETE! 🎉');
        console.log('=====================================\n');
        
        console.log('✅ Successfully cleared:');
        console.log('   - All database tables (except CompreFace trained persons)');
        console.log('   - All processed files');
        console.log('   - Face clustering data');
        console.log('   - Training history');
        console.log('   - Face similarities');
        
        console.log('\n🔒 Preserved:');
        console.log(`   - ${remainingPersons} CompreFace trained persons`);
        console.log('   - CompreFace face recognition models');
        
        console.log('\n💡 Next steps:');
        console.log('   - Start fresh photo processing');
        console.log('   - Re-run face clustering if needed');
        console.log('   - Run auto-recognition to identify faces using preserved models');
        
    } catch (error) {
        console.error('\n❌ Error during cleanup:', error);
    } finally {
        await db.destroy();
    }
}

// Run the cleanup
cleanupLocalData().catch(console.error);