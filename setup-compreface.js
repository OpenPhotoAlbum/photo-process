#!/usr/bin/env node

/**
 * CompreFace Setup Script
 * Sets up the required API keys and services for face detection and recognition
 */

const fetch = require('node-fetch');

const COMPREFACE_URL = 'http://localhost:8000';
const ADMIN_API = `${COMPREFACE_URL}/admin`;

// These are the expected API keys from our application
const EXPECTED_KEYS = {
    detect: 'dccaa628-2951-4812-a81d-e8a76b52b47c',
    recognize: 'b6dd9990-6905-40b8-80d3-4655196ab139'
};

async function checkComprefaceStatus() {
    try {
        console.log('🔍 Checking CompreFace status...');
        const response = await fetch(`${COMPREFACE_URL}/admin/healthcheck`);
        if (response.ok) {
            console.log('✅ CompreFace is running');
            return true;
        } else {
            console.log('❌ CompreFace admin service not responding');
            return false;
        }
    } catch (error) {
        console.log('❌ CompreFace is not accessible:', error.message);
        return false;
    }
}

async function testApiKeys() {
    console.log('🔑 Testing existing API keys...');
    
    // Test detection API key
    try {
        const response = await fetch(`${COMPREFACE_URL}/api/v1/detection/detect`, {
            method: 'POST',
            headers: {
                'x-api-key': EXPECTED_KEYS.detect,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({}) // Empty body to trigger validation error
        });
        
        const result = await response.text();
        if (result.includes('Missing header') || result.includes('Request method')) {
            console.log('❌ Detection API key needs to be configured');
            return false;
        } else if (result.includes('multipart')) {
            console.log('✅ Detection API key is working');
            return true;
        }
    } catch (error) {
        console.log('❌ Error testing detection key:', error.message);
        return false;
    }
}

async function createTestImage() {
    // Create a minimal 1x1 pixel PNG for testing
    const fs = require('fs');
    const path = require('path');
    
    const testImagePath = path.join(__dirname, 'test.png');
    
    // Minimal PNG data (1x1 transparent pixel)
    const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk header
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // Width: 1, Height: 1
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // Bit depth: 8, Color type: 6, CRC
        0x89, 0x00, 0x00, 0x00, 0x0B, 0x49, 0x44, 0x41, // IDAT chunk header
        0x54, 0x08, 0x1D, 0x01, 0x00, 0x00, 0x00, 0x00, // IDAT data
        0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x00, // IDAT CRC, IEND chunk
        0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82  // IEND
    ]);
    
    fs.writeFileSync(testImagePath, pngData);
    return testImagePath;
}

async function testDetectionAPI() {
    console.log('🎯 Testing face detection API...');
    
    const testImagePath = await createTestImage();
    const FormData = require('form-data');
    const fs = require('fs');
    
    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(testImagePath));
        
        const response = await fetch(`${COMPREFACE_URL}/api/v1/detection/detect?limit=20&det_prob_threshold=0.8`, {
            method: 'POST',
            headers: {
                'x-api-key': EXPECTED_KEYS.detect,
                ...formData.getHeaders()
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Face detection API is working');
            console.log('Response:', JSON.stringify(result, null, 2));
            return true;
        } else {
            console.log('❌ Face detection API error:', result);
            return false;
        }
    } catch (error) {
        console.log('❌ Error testing detection API:', error.message);
        return false;
    } finally {
        // Clean up test image
        const fs = require('fs');
        try {
            fs.unlinkSync(testImagePath);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

async function main() {
    console.log('🚀 Setting up CompreFace...\n');
    
    // Step 1: Check if CompreFace is running
    const isRunning = await checkComprefaceStatus();
    if (!isRunning) {
        console.log('\n❌ CompreFace is not running. Please start it first:');
        console.log('cd services/CompreFace && docker-compose up -d');
        process.exit(1);
    }
    
    // Step 2: Test existing API keys
    const keysWork = await testApiKeys();
    if (!keysWork) {
        console.log('\n⚠️  API keys need to be configured in CompreFace');
        console.log('\n📋 Manual setup required:');
        console.log('1. Open http://localhost:8000 in your browser');
        console.log('2. Create a new account or log in');
        console.log('3. Create a new application');
        console.log('4. Create Face Detection and Face Recognition services');
        console.log('5. Set the API keys to:');
        console.log(`   - Detection: ${EXPECTED_KEYS.detect}`);
        console.log(`   - Recognition: ${EXPECTED_KEYS.recognize}`);
        console.log('\nAfter setup, run this script again to verify.');
        process.exit(1);
    }
    
    // Step 3: Test face detection API
    const detectionWorks = await testDetectionAPI();
    if (!detectionWorks) {
        console.log('\n❌ Face detection API is not working properly');
        process.exit(1);
    }
    
    console.log('\n🎉 CompreFace setup complete!');
    console.log('Your photo processing should now work correctly.');
}

if (require.main === module) {
    main().catch(error => {
        console.error('Setup failed:', error);
        process.exit(1);
    });
}