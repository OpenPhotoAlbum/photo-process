#!/usr/bin/env node

/**
 * CompreFace Complete Cleanup Script
 * 
 * This script completely clears CompreFace and resets the database tracking state
 * to prepare for a clean slate approach to face training.
 * 
 * WARNING: This will delete ALL subjects and faces from CompreFace!
 */

const path = require('path');
const fs = require('fs');

async function main() {
    console.log('🚨 CompreFace Complete Cleanup Tool');
    console.log('=====================================');
    console.log('');
    console.log('This will:');
    console.log('1. Remove ALL subjects from CompreFace');
    console.log('2. Reset all compreface_synced flags to false');
    console.log('3. Clear all compreface_uploaded_at timestamps');
    console.log('4. Reset person training status');
    console.log('');
    
    // Safety confirmation
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
        readline.question('Are you sure you want to proceed? Type "yes" to continue: ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Operation cancelled');
        process.exit(0);
    }

    // Change to project root directory  
    const projectRoot = path.resolve(__dirname, '../..');
    process.chdir(projectRoot);
    
    // Load environment variables
    require('dotenv').config();

    try {
        // Import modules after setting up environment
        const knex = require('knex');
        
        // Database configuration
        const dbConfig = {
            client: 'mysql2',
            useNullAsDefault: true,
            connection: {
                host: process.env.MYSQL_HOST || 'localhost',
                port: parseInt(process.env.MYSQL_PORT || '3306'),
                user: process.env.MYSQL_USER || 'root',
                password: process.env.MYSQL_PASSWORD,
                database: process.env.MYSQL_DATABASE || 'photos'
            }
        };
        
        const db = knex(dbConfig);

        // CompreFace configuration
        const comprefaceBaseUrl = process.env.COMPREFACE_URL || process.env.COMPREFACE_BASE_URL || 'http://localhost:8000';
        const comprefaceApiKey = process.env.COMPREFACE_RECOGNIZE_API_KEY || process.env.COMPREFACE_API_KEY;
        
        if (!comprefaceApiKey) {
            console.log('⚠️  COMPREFACE_API_KEY not found - will skip CompreFace cleanup');
        }

        console.log('🔍 Step 1: Backing up current state...');
        
        // Backup current subjects from CompreFace
        if (comprefaceApiKey) {
            try {
                const fetch = (await import('node-fetch')).default;
                const response = await fetch(`${comprefaceBaseUrl}/api/v1/recognition/subjects`, {
                    headers: {
                        'x-api-key': comprefaceApiKey
                    }
                });
                
                if (response.ok) {
                    const subjects = await response.json();
                    const backupFile = `/tmp/compreface-subjects-backup-${new Date().toISOString().split('T')[0]}.json`;
                    fs.writeFileSync(backupFile, JSON.stringify(subjects, null, 2));
                    console.log(`✅ CompreFace subjects backed up to: ${backupFile}`);
                    console.log(`   Found ${subjects.subjects ? subjects.subjects.length : 0} subjects`);
                } else {
                    console.log('⚠️  Could not backup CompreFace subjects - API not responding');
                }
            } catch (error) {
                console.log('⚠️  Could not backup CompreFace subjects:', error.message);
            }
        }

        // Backup database state
        const personsWithTraining = await db('persons')
            .select('id', 'name', 'compreface_subject_id', 'recognition_status', 'face_count')
            .whereNotNull('compreface_subject_id');
        
        const facesWithSync = await db('detected_faces')
            .select('id', 'person_id', 'compreface_synced', 'compreface_uploaded_at')
            .where('compreface_synced', true);
        
        const dbBackupFile = `/tmp/face-training-state-backup-${new Date().toISOString().split('T')[0]}.json`;
        fs.writeFileSync(dbBackupFile, JSON.stringify({
            persons: personsWithTraining,
            faces: facesWithSync,
            timestamp: new Date().toISOString()
        }, null, 2));
        
        console.log(`✅ Database state backed up to: ${dbBackupFile}`);
        console.log(`   ${personsWithTraining.length} persons with CompreFace subjects`);
        console.log(`   ${facesWithSync.length} faces marked as synced`);

        console.log('');
        console.log('🗑️  Step 2: Removing all subjects from CompreFace...');
        
        if (comprefaceApiKey) {
            try {
                const fetch = (await import('node-fetch')).default;
                const subjectsResponse = await fetch(`${comprefaceBaseUrl}/api/v1/recognition/subjects`, {
                    headers: {
                        'x-api-key': comprefaceApiKey
                    }
                });
                
                if (subjectsResponse.ok) {
                    const subjectsData = await subjectsResponse.json();
                    const subjects = subjectsData.subjects || [];
                    let deletedCount = 0;
                    
                    for (const subject of subjects) {
                        try {
                            const deleteResponse = await fetch(`${comprefaceBaseUrl}/api/v1/recognition/subjects/${encodeURIComponent(subject)}`, {
                                method: 'DELETE',
                                headers: {
                                    'x-api-key': comprefaceApiKey
                                }
                            });
                            
                            if (deleteResponse.ok) {
                                deletedCount++;
                                console.log(`   ✅ Deleted subject: ${subject}`);
                            } else {
                                console.log(`   ❌ Failed to delete subject ${subject}: ${deleteResponse.status}`);
                            }
                        } catch (error) {
                            console.log(`   ❌ Failed to delete subject ${subject}:`, error.message);
                        }
                    }
                    
                    console.log(`✅ Deleted ${deletedCount}/${subjects.length} subjects from CompreFace`);
                } else {
                    console.log('❌ Could not fetch subjects from CompreFace');
                }
            } catch (error) {
                console.log('❌ Error removing subjects from CompreFace:', error.message);
                console.log('   Continuing with database cleanup...');
            }
        } else {
            console.log('⚠️  Skipping CompreFace cleanup - no API key provided');
        }

        console.log('');
        console.log('🔄 Step 3: Resetting database state...');
        
        // Reset all CompreFace sync flags
        const facesResetResult = await db('detected_faces')
            .update({
                compreface_synced: false,
                compreface_uploaded_at: null
            });
        
        console.log(`✅ Reset sync flags for ${facesResetResult} faces`);
        
        // Reset person training status
        const personsResetResult = await db('persons')
            .whereNotNull('compreface_subject_id')
            .update({
                compreface_subject_id: null,
                recognition_status: 'untrained',
                training_face_count: 0,
                last_trained_at: null,
                allow_auto_training: false
            });
        
        console.log(`✅ Reset training status for ${personsResetResult} persons`);
        
        // Clear any existing training log entries
        const hasTrainingLogTable = await db.schema.hasTable('face_training_log');
        if (hasTrainingLogTable) {
            const logClearResult = await db('face_training_log').del();
            console.log(`✅ Cleared ${logClearResult} training log entries`);
        } else {
            console.log(`ℹ️  face_training_log table does not exist yet`);
        }

        console.log('');
        console.log('🎉 Cleanup completed successfully!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Verify CompreFace is empty by checking the web UI');
        console.log('2. Use the new selective training system to upload only verified faces');
        console.log('3. Enable auto_training only for persons you want to train automatically');
        console.log('');
        console.log('Backup files created:');
        console.log(`- Database state: ${dbBackupFile}`);
        if (comprefaceApiKey) {
            console.log(`- CompreFace subjects: /tmp/compreface-subjects-backup-${new Date().toISOString().split('T')[0]}.json`);
        }

        await db.destroy();

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Handle script execution
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };