#!/usr/bin/env node

/**
 * Test single file processing with new database-centric architecture
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure TypeScript is compiled first
console.log('📦 Compiling TypeScript...');
try {
    execSync('npx tsc', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ TypeScript compilation failed:', error.message);
    process.exit(1);
}

const { configManager } = require('../../services/api/build/util/config-manager');
const { db } = require('../../services/api/build/models/database');
const { StartHashed } = require('../../services/api/build/scanner/scan');

async function testSingleFile() {
    try {
        console.log('🧪 Testing single file processing with database-centric architecture\n');
        
        // Get configuration
        const storage = configManager.getStorage();
        console.log('📁 Source directory:', storage.sourceDir);
        console.log('📁 Processed directory:', storage.processedDir);
        
        // Use a file from the source directory
        const testFile = path.join(__dirname, '../../source/sample/iphone.JPG');
        
        if (!fs.existsSync(testFile)) {
            console.error(`❌ Test file not found: ${testFile}`);
            console.log('Available test files:');
            const sampleDir = path.join(__dirname, '../../source/sample');
            if (fs.existsSync(sampleDir)) {
                fs.readdirSync(sampleDir).forEach(file => {
                    console.log(`   - ${file}`);
                });
            }
            return;
        }
        
        console.log('🔄 Testing file:', testFile);
        console.log('⏱️  Starting processing via scanner...\n');
        
        // Create a temporary directory with just our test file
        const tempDir = path.join(__dirname, '../../temp-test');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Copy test file to temp directory
        const tempFile = path.join(tempDir, path.basename(testFile));
        fs.copyFileSync(testFile, tempFile);
        
        const startTime = Date.now();
        const result = await StartHashed(tempDir, 1);
        const duration = Date.now() - startTime;
        
        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.log('\n✅ Processing completed successfully!');
        console.log('📊 Results:', {
            duration: `${duration}ms`,
            result: result
        });
        
    } catch (error) {
        console.error('\n❌ Processing failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    } finally {
        await db.destroy();
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📋 Single File Processing Test

This script tests the complete image processing pipeline on a single file.

Usage:
  node test-single-file.js [options]

Options:
  --help, -h     Show this help message

The script will:
1. Compile TypeScript
2. Load configuration from config system
3. Process a test image from source/sample/
4. Store all data in database (no JSON files)
5. Report processing results
`);
    process.exit(0);
}

if (require.main === module) {
    testSingleFile().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}