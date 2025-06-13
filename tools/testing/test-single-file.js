#!/usr/bin/env node

const { generateImageDataJson } = require('./build/api/util/process-source');

async function testSingleFile() {
    const filePath = '/mnt/sg1/uploads/stephen/iphone/recents/2023-05-27_18-29-50_2691363f-a460-4c93-8143-41949df79820.jpg';
    const destDir = '/mnt/hdd/photo-process/processed';
    
    try {
        console.log('Testing file:', filePath);
        const result = await generateImageDataJson(filePath, destDir);
        console.log('SUCCESS:', result);
    } catch (error) {
        console.error('ERROR:', error.message);
        console.error('Stack:', error.stack);
    }
}

testSingleFile();