#!/usr/bin/env node

const { generateImageDataJsonHashed } = require('../../services/api/build/util/process-source');

async function testFullProcessing() {
    try {
        console.log('Testing full processing pipeline with object detection...');
        
        const testImage = '/mnt/sg1/uploads/stephen/iphone/recents/2023-02-12_11-50-08_7d38d982-db93-47c5-95c5-a0a9db05d5a0.jpg';
        const destDir = '/mnt/hdd/photo-process/processed';
        
        console.log('Processing:', testImage);
        const metadataFile = await generateImageDataJson(testImage, destDir);
        
        console.log('✅ Processing completed!');
        console.log('Metadata saved to:', metadataFile);
        
        // Read and display the generated metadata
        const fs = require('fs');
        const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        
        console.log('\n=== PROCESSING RESULTS ===');
        console.log('Dominant Color:', metadata.dominantColor);
        console.log('Faces detected:', Object.keys(metadata.people || {}).length);
        console.log('Objects detected:', (metadata.objects || []).length);
        
        if (metadata.objects && metadata.objects.length > 0) {
            console.log('\nDetected objects:');
            metadata.objects.forEach((obj, i) => {
                console.log(`  ${i + 1}. ${obj.class} (${Math.round(obj.confidence * 100)}%)`);
            });
        }
        
    } catch (error) {
        console.error('Full processing test failed:', error);
    }
}

testFullProcessing();