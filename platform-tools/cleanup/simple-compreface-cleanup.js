#!/usr/bin/env node

/**
 * Simple CompreFace Cleanup - Just delete all subjects
 */

require('dotenv').config();

async function simpleCleanup() {
    const comprefaceBaseUrl = process.env.COMPREFACE_URL || 'http://localhost:8000';
    const comprefaceApiKey = process.env.COMPREFACE_RECOGNIZE_API_KEY;
    
    console.log('🗑️  Simple CompreFace Cleanup');
    console.log('============================');
    console.log(`Base URL: ${comprefaceBaseUrl}`);
    console.log(`API Key: ${comprefaceApiKey ? comprefaceApiKey.substring(0, 8) + '...' : 'NOT SET'}`);
    
    if (!comprefaceApiKey) {
        console.log('❌ No CompreFace API key found');
        return;
    }
    
    try {
        const fetch = (await import('node-fetch')).default;
        
        // Get all subjects
        console.log('\n📋 Fetching all subjects...');
        const subjectsResponse = await fetch(`${comprefaceBaseUrl}/api/v1/recognition/subjects`, {
            headers: {
                'x-api-key': comprefaceApiKey
            }
        });
        
        if (!subjectsResponse.ok) {
            console.log(`❌ Failed to fetch subjects: ${subjectsResponse.status}`);
            return;
        }
        
        const subjectsData = await subjectsResponse.json();
        const subjects = subjectsData.subjects || [];
        
        console.log(`✅ Found ${subjects.length} subjects to delete`);
        
        if (subjects.length === 0) {
            console.log('✅ No subjects to delete - CompreFace is already clean');
            return;
        }
        
        // Ask for confirmation
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            readline.question(`\nDelete all ${subjects.length} subjects? Type "yes" to continue: `, resolve);
        });
        
        readline.close();
        
        if (answer.toLowerCase() !== 'yes') {
            console.log('❌ Operation cancelled');
            return;
        }
        
        // Delete all subjects
        console.log(`\n🗑️  Deleting ${subjects.length} subjects...`);
        let deletedCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < subjects.length; i++) {
            const subject = subjects[i];
            try {
                console.log(`[${i + 1}/${subjects.length}] Deleting: ${subject}`);
                
                const deleteResponse = await fetch(`${comprefaceBaseUrl}/api/v1/recognition/subjects/${encodeURIComponent(subject)}`, {
                    method: 'DELETE',
                    headers: {
                        'x-api-key': comprefaceApiKey
                    }
                });
                
                if (deleteResponse.ok) {
                    deletedCount++;
                    console.log(`   ✅ Deleted`);
                } else {
                    errorCount++;
                    console.log(`   ❌ Failed: ${deleteResponse.status}`);
                }
                
                // Small delay to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                errorCount++;
                console.log(`   ❌ Error: ${error.message}`);
            }
        }
        
        console.log(`\n🎉 Cleanup completed!`);
        console.log(`✅ Deleted: ${deletedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        
        // Verify final state
        console.log('\n🔍 Verifying cleanup...');
        const finalResponse = await fetch(`${comprefaceBaseUrl}/api/v1/recognition/subjects`, {
            headers: {
                'x-api-key': comprefaceApiKey
            }
        });
        
        if (finalResponse.ok) {
            const finalData = await finalResponse.json();
            const remainingSubjects = finalData.subjects || [];
            console.log(`📊 Remaining subjects: ${remainingSubjects.length}`);
            
            if (remainingSubjects.length > 0) {
                console.log('⚠️  Some subjects remain:', remainingSubjects.slice(0, 5));
            } else {
                console.log('✅ CompreFace is now completely clean!');
            }
        }
        
    } catch (error) {
        console.log('❌ Error during cleanup:', error.message);
    }
}

simpleCleanup().catch(console.error);