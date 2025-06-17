#!/usr/bin/env node

const { detectObjects } = require('../../services/api/build/util/object-detection');

async function testObjectDetection() {
    try {
        console.log('Testing object detection...');
        
        // Test with a photo that likely has recognizable objects
        const testImage = '/mnt/sg1/uploads/stephen/iphone/recents/2023-02-12_11-50-08_7d38d982-db93-47c5-95c5-a0a9db05d5a0.jpg';
        
        console.log('Processing:', testImage);
        const objects = await detectObjects(testImage);
        
        console.log('\n=== DETECTED OBJECTS ===');
        objects.forEach((obj, i) => {
            console.log(`${i + 1}. ${obj.class} (${Math.round(obj.confidence * 100)}% confidence)`);
            console.log(`   Location: x=${obj.bbox.x}, y=${obj.bbox.y}, w=${obj.bbox.width}, h=${obj.bbox.height}`);
        });
        
        console.log(`\nTotal objects detected: ${objects.length}`);
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testObjectDetection();