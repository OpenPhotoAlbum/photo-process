#!/usr/bin/env node

/**
 * Environment Configuration Migration Tool
 * 
 * This script helps migrate from legacy .env variable names to the new standardized format.
 * It preserves your existing values while updating to the new naming convention.
 */

const fs = require('fs');
const path = require('path');

// Legacy to new variable mappings
const LEGACY_MAPPINGS = {
    'mysql_host': 'MYSQL_HOST',
    'mysql_port': 'MYSQL_PORT', 
    'mysql_user': 'MYSQL_USER',
    'mysql_pass': 'MYSQL_PASSWORD',
    'mysql_db': 'MYSQL_DATABASE',
    'mysql_root_password': 'MYSQL_ROOT_PASSWORD',
    'media_source_dir': 'MEDIA_SOURCE_DIR',
    'media_dest_dir': 'MEDIA_PROCESSED_DIR'
};

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log('❌ .env file not found:', filePath);
        return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const variables = {};
    const comments = [];
    const unknownLines = [];
    
    content.split('\n').forEach((line, index) => {
        const trimmed = line.trim();
        
        if (!trimmed || trimmed.startsWith('#')) {
            comments.push({ line: index, content: line });
            return;
        }
        
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const [, key, value] = match;
            variables[key.trim()] = value.trim();
        } else {
            unknownLines.push({ line: index, content: line });
        }
    });
    
    return { variables, comments, unknownLines };
}

function migrateLegacyVariables(variables) {
    const migrated = {};
    const legacy = {};
    const unchanged = {};
    
    Object.entries(variables).forEach(([key, value]) => {
        if (LEGACY_MAPPINGS[key]) {
            const newKey = LEGACY_MAPPINGS[key];
            migrated[newKey] = value;
            legacy[key] = { newKey, value };
        } else {
            unchanged[key] = value;
        }
    });
    
    return { migrated, legacy, unchanged };
}

function generateNewEnvContent(migrated, unchanged, legacy) {
    const lines = [];
    
    // Header
    lines.push('# Photo Processing Service Configuration');
    lines.push('# Migrated from legacy variable names\n');
    
    // Database section
    const dbVars = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'MYSQL_ROOT_PASSWORD'];
    const hasDbVars = dbVars.some(key => migrated[key] || unchanged[key]);
    
    if (hasDbVars) {
        lines.push('# Database Configuration');
        dbVars.forEach(key => {
            const value = migrated[key] || unchanged[key];
            if (value !== undefined) {
                lines.push(`${key}=${value}`);
            }
        });
        lines.push('');
    }
    
    // Storage section
    const storageVars = ['MEDIA_SOURCE_DIR', 'MEDIA_PROCESSED_DIR', 'MEDIA_THUMBNAIL_DIR', 'MEDIA_CACHE_DIR', 'MEDIA_LOGS_DIR'];
    const hasStorageVars = storageVars.some(key => migrated[key] || unchanged[key]);
    
    if (hasStorageVars) {
        lines.push('# Storage Paths');
        storageVars.forEach(key => {
            const value = migrated[key] || unchanged[key];
            if (value !== undefined) {
                lines.push(`${key}=${value}`);
            }
        });
        lines.push('');
    }
    
    // Other variables
    const otherVars = Object.keys({...migrated, ...unchanged}).filter(key => 
        !dbVars.includes(key) && !storageVars.includes(key)
    );
    
    if (otherVars.length > 0) {
        lines.push('# Other Configuration');
        otherVars.forEach(key => {
            const value = migrated[key] || unchanged[key];
            if (value !== undefined) {
                lines.push(`${key}=${value}`);
            }
        });
        lines.push('');
    }
    
    // Legacy variables (commented out)
    if (Object.keys(legacy).length > 0) {
        lines.push('# Legacy variables (migrated above, keeping for reference)');
        Object.entries(legacy).forEach(([oldKey, {newKey, value}]) => {
            lines.push(`# ${oldKey}=${value}  # Migrated to ${newKey}`);
        });
    }
    
    return lines.join('\n');
}

function createBackup(envPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${envPath}.backup.${timestamp}`;
    fs.copyFileSync(envPath, backupPath);
    return backupPath;
}

function main() {
    const envPath = path.join(process.cwd(), '.env');
    
    console.log('🔄 Environment Configuration Migration Tool');
    console.log('==========================================\n');
    
    // Parse current .env file
    const parsed = parseEnvFile(envPath);
    if (!parsed) {
        process.exit(1);
    }
    
    console.log(`📁 Found .env file with ${Object.keys(parsed.variables).length} variables`);
    
    // Check if migration is needed
    const migration = migrateLegacyVariables(parsed.variables);
    const legacyCount = Object.keys(migration.legacy).length;
    
    if (legacyCount === 0) {
        console.log('✅ No legacy variables found. Your .env file is already using the new format!');
        process.exit(0);
    }
    
    console.log(`\n📋 Migration Summary:`);
    console.log(`   - ${legacyCount} legacy variables to migrate`);
    console.log(`   - ${Object.keys(migration.unchanged).length} variables already in new format`);
    
    // Show what will be migrated
    console.log('\n🔄 Variables to migrate:');
    Object.entries(migration.legacy).forEach(([oldKey, {newKey, value}]) => {
        // Mask sensitive values
        const displayValue = oldKey.includes('pass') || oldKey.includes('password') 
            ? value.substring(0, 3) + '***'
            : value;
        console.log(`   ${oldKey} → ${newKey} (${displayValue})`);
    });
    
    // Ask for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('\n❓ Proceed with migration? (y/N): ', (answer) => {
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('❌ Migration cancelled');
            rl.close();
            process.exit(0);
        }
        
        try {
            // Create backup
            console.log('\n💾 Creating backup...');
            const backupPath = createBackup(envPath);
            console.log(`   Backup created: ${path.basename(backupPath)}`);
            
            // Generate new .env content
            console.log('📝 Generating new .env file...');
            const newContent = generateNewEnvContent(
                migration.migrated, 
                migration.unchanged, 
                migration.legacy
            );
            
            // Write new .env file
            fs.writeFileSync(envPath, newContent);
            
            console.log('✅ Migration completed successfully!');
            console.log('\n📋 Next steps:');
            console.log('   1. Review your new .env file');
            console.log('   2. Test your application');
            console.log('   3. Remove backup file when satisfied');
            console.log('\n💡 Tip: Compare with .env.example for additional configuration options');
            
        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            process.exit(1);
        }
        
        rl.close();
    });
}

if (require.main === module) {
    main();
}

module.exports = { parseEnvFile, migrateLegacyVariables, generateNewEnvContent };