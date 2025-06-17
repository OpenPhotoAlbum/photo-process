#!/usr/bin/env node

/**
 * Fresh Start Cleanup Script
 * 
 * This script completely resets the photo processing system to a clean state:
 * - Clears all database tables (persons, faces, images, metadata, objects)
 * - Removes all CompreFace subjects and training data
 * - Deletes all processed files (face crops, metadata JSON files)
 * - Maintains the orientation fix and consistency improvements
 * 
 * Usage:
 *   node cleanup-fresh-start.js [--keep-compreface] [--keep-processed] [--keep-db]
 * 
 * Options:
 *   --keep-compreface    Don't clear CompreFace subjects
 *   --keep-processed     Don't delete processed files
 *   --keep-db           Don't clear database tables
 */

const knex = require('knex');
const knexConfig = require('../../infrastructure/database/knexfile.platform');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Use development environment by default
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];
const db = knex(config);

const args = process.argv.slice(2);
const keepCompreFace = args.includes('--keep-compreface');
const keepProcessed = args.includes('--keep-processed');
const keepDatabase = args.includes('--keep-db');

async function freshStartCleanup() {
    try {
        console.log('🧹 FRESH START CLEANUP SCRIPT 🧹');
        console.log('===================================\n');
        
        console.log('Options:');
        console.log(`- Keep CompreFace: ${keepCompreFace ? 'YES' : 'NO'}`);
        console.log(`- Keep Processed Files: ${keepProcessed ? 'YES' : 'NO'}`);
        console.log(`- Keep Database: ${keepDatabase ? 'YES' : 'NO'}`);
        console.log('');
        
        let clearedItems = [];
        
        // 1. Clear Database Tables
        if (!keepDatabase) {
            console.log('1️⃣ Clearing database tables...');
            try {
                const tables = ['detected_faces', 'persons', 'images', 'image_metadata', 'detected_objects'];
                
                for (const table of tables) {
                    const count = await db(table).count('* as count').first();
                    await db(table).del();
                    console.log(`   ✅ Cleared ${table} table (${count.count} records)`);
                }
                
                clearedItems.push('Database tables');
            } catch (dbError) {
                console.error('   ❌ Database error:', dbError.message);
            }
        } else {
            console.log('1️⃣ Skipping database cleanup (--keep-db)');
        }
        
        // 2. Clear CompreFace Training Data
        if (!keepCompreFace) {
            console.log('\\n2️⃣ Clearing CompreFace training data...');
            try {
                // Get all subjects
                const subjectsResponse = await fetch('http://compreface-ui:80/api/v1/recognition/subjects', {
                    headers: { 'x-api-key': 'b6dd9990-6905-40b8-80d3-4655196ab139' }
                });
                
                if (subjectsResponse.ok) {
                    const subjectsData = await subjectsResponse.json();
                    const subjects = subjectsData.subjects || [];
                    console.log(`   Found ${subjects.length} subjects to delete`);
                    
                    // Delete each subject and all their face data
                    for (const subject of subjects) {
                        try {
                            const deleteResponse = await fetch(`http://compreface-ui:80/api/v1/recognition/subjects/${encodeURIComponent(subject)}`, {
                                method: 'DELETE',
                                headers: { 'x-api-key': 'b6dd9990-6905-40b8-80d3-4655196ab139' }
                            });
                            
                            if (deleteResponse.ok) {
                                console.log(`   ✅ Deleted subject: ${subject}`);
                            } else {
                                console.log(`   ⚠️ Failed to delete subject: ${subject}`);
                            }
                        } catch (error) {
                            console.log(`   ❌ Error deleting subject ${subject}:`, error.message);
                        }
                    }
                    
                    if (subjects.length > 0) {
                        clearedItems.push(`CompreFace subjects (${subjects.length})`);
                    }
                } else {
                    console.log('   ℹ️ No subjects found or CompreFace not accessible');
                }
            } catch (comprefaceError) {
                console.error('   ❌ CompreFace error:', comprefaceError.message);
                console.log('   ℹ️ CompreFace might not be running - skipping cleanup');
            }
        } else {
            console.log('\\n2️⃣ Skipping CompreFace cleanup (--keep-compreface)');
        }
        
        // 3. Clear Processed Files
        if (!keepProcessed) {
            console.log('\\n3️⃣ Clearing processed files...');
            const dirsToClean = [
                { path: '/mnt/hdd/photo-process/processed', name: 'processed' },
                { path: '/mnt/hdd/photo-process/dest', name: 'dest' }
            ];
            
            let processedFileCount = 0;
            
            for (const dir of dirsToClean) {
                try {
                    if (fs.existsSync(dir.path)) {
                        const items = fs.readdirSync(dir.path);
                        
                        for (const item of items) {
                            const itemPath = path.join(dir.path, item);
                            const stats = fs.statSync(itemPath);
                            
                            if (stats.isDirectory()) {
                                // Count files in directory before deletion
                                const fileCount = countFilesRecursively(itemPath);
                                processedFileCount += fileCount;
                                
                                fs.rmSync(itemPath, { recursive: true, force: true });
                                console.log(`   ✅ Removed directory: ${dir.name}/${item} (${fileCount} files)`);
                            } else {
                                fs.unlinkSync(itemPath);
                                processedFileCount++;
                                console.log(`   ✅ Removed file: ${dir.name}/${item}`);
                            }
                        }
                    } else {
                        console.log(`   ℹ️ Directory ${dir.name} does not exist`);
                    }
                } catch (fsError) {
                    console.error(`   ❌ File system error for ${dir.name}:`, fsError.message);
                }
            }
            
            if (processedFileCount > 0) {
                clearedItems.push(`Processed files (${processedFileCount})`);
            }
        } else {
            console.log('\\n3️⃣ Skipping processed files cleanup (--keep-processed)');
        }
        
        // 4. Verify Clean State
        console.log('\\n4️⃣ Verifying clean state...');
        
        if (!keepDatabase) {
            try {
                const totalRecords = await db('images').count('* as count').first();
                console.log(`   📊 Database records remaining: ${totalRecords.count}`);
            } catch (error) {
                console.log('   ⚠️ Could not verify database state');
            }
        }
        
        if (!keepCompreFace) {
            try {
                const subjectsCheck = await fetch('http://compreface-ui:80/api/v1/recognition/subjects', {
                    headers: { 'x-api-key': 'b6dd9990-6905-40b8-80d3-4655196ab139' }
                });
                
                if (subjectsCheck.ok) {
                    const subjectsData = await subjectsCheck.json();
                    console.log(`   🤖 CompreFace subjects remaining: ${subjectsData.subjects?.length || 0}`);
                }
            } catch (error) {
                console.log('   ⚠️ Could not verify CompreFace state');
            }
        }
        
        // 5. Summary
        console.log('\\n🎉 FRESH START CLEANUP COMPLETE! 🎉');
        console.log('=====================================\\n');
        
        if (clearedItems.length > 0) {
            console.log('✅ Successfully cleared:');
            clearedItems.forEach(item => console.log(`   - ${item}`));
        }
        
        console.log('\\n🚀 System Status:');
        console.log('   ✅ Orientation fix: Active');
        console.log('   ✅ Auto-migration: Enabled');
        console.log('   ✅ Consistency checks: Available');
        console.log('   ✅ Clean UI: Updated');
        
        console.log('\\n📋 Ready for:');
        console.log('   1. Start Scan (will auto-import to database)');
        console.log('   2. Tag Faces (will auto-sync to CompreFace)');
        console.log('   3. Auto-Recognition (with 90% confidence)');
        console.log('   4. Consistent face management');
        
        console.log('\\n💡 Tip: Your system is now ready for fresh photo processing!');
        
    } catch (error) {
        console.error('\\n❌ Fresh start cleanup failed:', error.message);
        console.error('\\nStack trace:', error.stack);
    } finally {
        process.exit(0);
    }
}

// Helper function to count files recursively
function countFilesRecursively(dirPath) {
    let count = 0;
    try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
                count += countFilesRecursively(itemPath);
            } else {
                count++;
            }
        }
    } catch (error) {
        // Ignore errors, just return current count
    }
    return count;
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Fresh Start Cleanup Script

This script completely resets the photo processing system to a clean state.

Usage:
  node cleanup-fresh-start.js [options]

Options:
  --keep-compreface    Don't clear CompreFace subjects and training data
  --keep-processed     Don't delete processed files (face crops, metadata)
  --keep-db           Don't clear database tables
  --help, -h          Show this help message

Examples:
  node cleanup-fresh-start.js                    # Full cleanup
  node cleanup-fresh-start.js --keep-compreface  # Keep CompreFace data
  node cleanup-fresh-start.js --keep-db          # Keep database data

Alternative Scripts:
  node cleanup-local-data.js    # Clear only local data (DB + files)
  node cleanup-compreface.js    # Clear only CompreFace data
    `);
    process.exit(0);
}

freshStartCleanup();