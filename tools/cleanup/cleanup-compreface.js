#!/usr/bin/env node

const fetch = require('node-fetch');

const COMPREFACE_URL = 'http://localhost:8000';
const API_KEY = 'b6dd9990-6905-40b8-80d3-4655196ab139';

async function cleanupCompreFace() {
    console.log('🤖 COMPREFACE CLEANUP SCRIPT 🤖');
    console.log('===================================\n');

    try {
        // 1. Get all subjects
        console.log('1️⃣ Getting all CompreFace subjects...');
        
        const subjectsResponse = await fetch(`${COMPREFACE_URL}/api/v1/recognition/subjects`, {
            method: 'GET',
            headers: {
                'x-api-key': API_KEY
            }
        });
        
        if (!subjectsResponse.ok) {
            throw new Error(`Failed to get subjects: ${subjectsResponse.status}`);
        }
        
        const subjectsData = await subjectsResponse.json();
        const subjects = subjectsData.subjects || [];
        
        console.log(`   Found ${subjects.length} subjects to delete`);

        // 2. Delete each subject
        if (subjects.length > 0) {
            console.log('\n2️⃣ Deleting CompreFace subjects...');
            
            for (const subject of subjects) {
                try {
                    const deleteResponse = await fetch(`${COMPREFACE_URL}/api/v1/recognition/subjects/${subject}`, {
                        method: 'DELETE',
                        headers: {
                            'x-api-key': API_KEY
                        }
                    });
                    
                    if (deleteResponse.ok) {
                        console.log(`   ✅ Deleted subject: ${subject}`);
                    } else {
                        console.log(`   ⚠️  Failed to delete subject: ${subject} (${deleteResponse.status})`);
                    }
                } catch (error) {
                    console.log(`   ⚠️  Error deleting subject ${subject}: ${error.message}`);
                }
            }
        }

        // 3. Verify clean state
        console.log('\n3️⃣ Verifying CompreFace clean state...');
        
        const verifyResponse = await fetch(`${COMPREFACE_URL}/api/v1/recognition/subjects`, {
            method: 'GET',
            headers: {
                'x-api-key': API_KEY
            }
        });
        
        if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            const remainingSubjects = verifyData.subjects || [];
            console.log(`   🤖 CompreFace subjects remaining: ${remainingSubjects.length}`);
            
            if (remainingSubjects.length > 0) {
                console.log('   ⚠️  Some subjects could not be deleted:');
                remainingSubjects.forEach(subject => {
                    console.log(`      - ${subject}`);
                });
            }
        }

        console.log('\n🎉 COMPREFACE CLEANUP COMPLETE! 🎉');
        console.log('=====================================\n');
        
        console.log('✅ Successfully cleared CompreFace training data');
        
        console.log('\n💡 Next steps:');
        console.log('   - Run cleanup-local-data.js to clear local data');
        console.log('   - Or start training new faces');
        
    } catch (error) {
        console.error('\n❌ Error during CompreFace cleanup:', error);
        console.log('\n💡 Tips:');
        console.log('   - Make sure CompreFace is running (http://localhost:8000)');
        console.log('   - Check that the API key is correct');
    }
}

// Run the cleanup
cleanupCompreFace().catch(console.error);