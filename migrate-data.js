#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');

// Ensure TypeScript is compiled first
console.log('Compiling TypeScript...');
try {
    execSync('npx tsc', { stdio: 'inherit' });
} catch (error) {
    console.error('TypeScript compilation failed:', error.message);
    process.exit(1);
}

// Import the migration utility
const { DataMigrator } = require('./build/api/util/migrate-to-db');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

async function runMigration() {
    try {
        console.log('Starting database migration...');
        
        const sourceDir = process.env.media_source_dir || '/mnt/sg1/uploads/stephen/iphone';
        const destDir = process.env.media_dest_dir || '/mnt/hdd/photo-process/processed';
        
        console.log('Source directory:', sourceDir);
        console.log('Destination directory:', destDir);
        
        await DataMigrator.migrateProcessedData(sourceDir, destDir);
        
        console.log('Migration completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Check if we should run the database schema migration first
const args = process.argv.slice(2);
if (args.includes('--schema-only')) {
    console.log('Running database schema migration only...');
    try {
        execSync('npx knex migrate:latest', { stdio: 'inherit' });
        console.log('Schema migration completed!');
    } catch (error) {
        console.error('Schema migration failed:', error.message);
        process.exit(1);
    }
} else if (args.includes('--data-only')) {
    console.log('Running data migration only...');
    runMigration();
} else {
    console.log('Running both schema and data migration...');
    try {
        console.log('Step 1: Running schema migration...');
        execSync('npx knex migrate:latest', { stdio: 'inherit' });
        
        console.log('Step 2: Running data migration...');
        runMigration();
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
}