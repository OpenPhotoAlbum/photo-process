#!/usr/bin/env node

const knex = require('knex');
const config = require('./knexfile');
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
        // 1. Clear database tables
        console.log('1️⃣ Clearing database tables...');
        
        const tables = ['detected_faces', 'persons', 'images', 'image_metadata', 'detected_objects'];
        
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
        
        const processedDir = path.join(__dirname, 'processed');
        
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
        for (const table of tables) {
            try {
                const count = await db(table).count('* as count').first();
                totalRecords += count.count;
            } catch (error) {
                // Ignore
            }
        }
        
        console.log(`   📊 Database records remaining: ${totalRecords}`);

        console.log('\n🎉 LOCAL DATA CLEANUP COMPLETE! 🎉');
        console.log('=====================================\n');
        
        console.log('✅ Successfully cleared:');
        console.log('   - All database tables');
        console.log('   - All processed files');
        
        console.log('\n💡 Next steps:');
        console.log('   - Run cleanup-compreface.js to clear CompreFace data');
        console.log('   - Or start fresh with photo processing');
        
    } catch (error) {
        console.error('\n❌ Error during cleanup:', error);
    } finally {
        await db.destroy();
    }
}

// Run the cleanup
cleanupLocalData().catch(console.error);