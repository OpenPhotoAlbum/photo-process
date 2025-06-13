#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Ensure TypeScript is compiled first
console.log('📦 Compiling TypeScript...');
try {
    execSync('npx tsc', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ TypeScript compilation failed:', error.message);
    process.exit(1);
}

// Import the feature migrator
const { FeatureMigrator } = require('./build/api/util/feature-migrator');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

async function main() {
    const args = process.argv.slice(2);
    
    try {
        if (args.includes('--help') || args.includes('-h')) {
            showHelp();
            return;
        }
        
        if (args.includes('--status')) {
            console.log('📊 Getting migration status...\n');
            const status = await FeatureMigrator.getMigrationStatus();
            
            console.log('Feature Migration Status:');
            console.log('========================');
            status.forEach(feature => {
                if (feature.error) {
                    console.log(`❌ ${feature.feature}: ERROR - ${feature.error}`);
                } else {
                    console.log(`${feature.completionPercentage === 100 ? '✅' : '🔄'} ${feature.feature} (${feature.version})`);
                    console.log(`   📝 ${feature.description}`);
                    console.log(`   📊 ${feature.migratedImages}/${feature.totalImages} images (${feature.completionPercentage}%)`);
                }
                console.log('');
            });
            return;
        }
        
        const featureName = args.find(arg => arg.startsWith('--feature='))?.split('=')[1];
        const forceAll = args.includes('--force');
        
        if (featureName) {
            console.log(`🎯 Running specific migration: ${featureName}`);
            await FeatureMigrator.runMigrationByName(featureName, forceAll);
        } else {
            console.log('🚀 Running all pending migrations...');
            await FeatureMigrator.runPendingMigrations(forceAll);
        }
        
        console.log('\n🎉 Migration completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
}

function showHelp() {
    console.log(`
📋 Feature Migration Tool
========================

This tool manages migrations for new features added to the photo processing pipeline.

Usage:
  node migrate-features.js [options]

Options:
  --help, -h              Show this help message
  --status                Show migration status for all features
  --feature=NAME          Run migration for specific feature only
  --force                 Force re-migration of all images (even if already migrated)

Examples:
  node migrate-features.js --status
  node migrate-features.js --feature=object_detection
  node migrate-features.js --force

Available Features:
  - object_detection      Migrate YOLO object detection data to database
  
When you add new features to the scanning pipeline:
1. Add the feature's migration function to FeatureMigrator
2. Run this tool to migrate existing images
3. Future scans will automatically include the new feature
`);
}

main();