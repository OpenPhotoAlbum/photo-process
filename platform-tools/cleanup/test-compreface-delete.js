#!/usr/bin/env node

/**
 * Test script to verify CompreFace API deletion works
 */

require('dotenv').config();

async function testCompreFaceDelete() {
    const comprefaceBaseUrl = process.env.COMPREFACE_URL || 'http://localhost:8000';
    const comprefaceApiKey = process.env.COMPREFACE_RECOGNIZE_API_KEY;
    
    console.log('🔍 Testing CompreFace API deletion...');
    console.log(`Base URL: ${comprefaceBaseUrl}`);
    console.log(`API Key: ${comprefaceApiKey ? comprefaceApiKey.substring(0, 8) + '...' : 'NOT SET'}`);
    
    if (!comprefaceApiKey) {
        console.log('❌ No CompreFace API key found');
        return;
    }
    
    try {
        const fetch = (await import('node-fetch')).default;
        
        // First, get all subjects
        console.log('\n📋 Fetching subjects...');
        const subjectsResponse = await fetch(`${comprefaceBaseUrl}/api/v1/recognition/subjects`, {
            headers: {
                'x-api-key': comprefaceApiKey
            }
        });
        
        if (!subjectsResponse.ok) {
            console.log(`❌ Failed to fetch subjects: ${subjectsResponse.status} ${subjectsResponse.statusText}`);
            const errorText = await subjectsResponse.text();
            console.log('Error response:', errorText);
            return;
        }
        
        const subjectsData = await subjectsResponse.json();
        const subjects = subjectsData.subjects || [];
        
        console.log(`✅ Found ${subjects.length} subjects`);
        console.log('First 5 subjects:', subjects.slice(0, 5));
        
        if (subjects.length === 0) {
            console.log('✅ No subjects to delete');
            return;
        }
        
        // Test deleting just the first subject
        const testSubject = subjects[0];
        console.log(`\n🗑️  Testing deletion of subject: ${testSubject}`);
        
        const deleteResponse = await fetch(`${comprefaceBaseUrl}/api/v1/recognition/subjects/${encodeURIComponent(testSubject)}`, {
            method: 'DELETE',
            headers: {
                'x-api-key': comprefaceApiKey
            }
        });
        
        if (deleteResponse.ok) {
            console.log(`✅ Successfully deleted subject: ${testSubject}`);
            
            // Verify it's gone
            const verifyResponse = await fetch(`${comprefaceBaseUrl}/api/v1/recognition/subjects`, {
                headers: {
                    'x-api-key': comprefaceApiKey
                }
            });
            
            const verifyData = await verifyResponse.json();
            const remainingSubjects = verifyData.subjects || [];
            
            if (remainingSubjects.includes(testSubject)) {
                console.log(`⚠️  Subject ${testSubject} still exists after deletion`);
            } else {
                console.log(`✅ Confirmed: Subject ${testSubject} was removed`);
                console.log(`Remaining subjects: ${remainingSubjects.length}`);
            }
            
        } else {
            console.log(`❌ Failed to delete subject ${testSubject}: ${deleteResponse.status} ${deleteResponse.statusText}`);
            const errorText = await deleteResponse.text();
            console.log('Delete error response:', errorText);
        }
        
    } catch (error) {
        console.log('❌ Error testing CompreFace deletion:', error.message);
    }
}

testCompreFaceDelete().catch(console.error);