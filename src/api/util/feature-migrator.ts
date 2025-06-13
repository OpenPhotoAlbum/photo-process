import fs from 'fs';
import path from 'path';
import { ImageRepository, ObjectRepository, FaceRepository, MetadataRepository, db } from '../models/database';

interface MigrationFeature {
    name: string;
    version: string;
    description: string;
    migrationFunction: (imageId: number, metadataJson: any, originalPath: string) => Promise<void>;
    shouldProcess: (metadataJson: any) => boolean;
}

export class FeatureMigrator {
    private static migrations: MigrationFeature[] = [
        {
            name: 'object_detection',
            version: '1.0.0',
            description: 'Migrate YOLO object detection data to database',
            migrationFunction: this.migrateObjectDetection,
            shouldProcess: (metadata) => metadata.objects && metadata.objects.length > 0
        },
        // Future migrations can be added here:
        // {
        //     name: 'face_recognition',
        //     version: '1.1.0', 
        //     description: 'Add face recognition clustering',
        //     migrationFunction: this.migrateFaceRecognition,
        //     shouldProcess: (metadata) => metadata.people && Object.keys(metadata.people).length > 0
        // }
    ];

    /**
     * Run all pending migrations for existing images
     */
    static async runPendingMigrations(forceAll = false): Promise<void> {
        console.log('🔄 Starting feature migrations...');
        
        for (const migration of this.migrations) {
            await this.runSingleMigration(migration, forceAll);
        }
        
        console.log('✅ All feature migrations completed');
    }

    /**
     * Run a specific migration by name
     */
    static async runMigrationByName(featureName: string, forceAll = false): Promise<void> {
        const migration = this.migrations.find(m => m.name === featureName);
        if (!migration) {
            throw new Error(`Migration not found: ${featureName}`);
        }
        
        await this.runSingleMigration(migration, forceAll);
    }

    /**
     * Run a single migration across all processed images
     */
    private static async runSingleMigration(migration: MigrationFeature, forceAll = false): Promise<void> {
        console.log(`\n📦 Running migration: ${migration.name} (${migration.version})`);
        console.log(`📝 ${migration.description}`);
        
        const metaDir = path.join(process.env.media_dest_dir || '', 'recents', 'meta');
        
        if (!fs.existsSync(metaDir)) {
            console.log('❌ Metadata directory not found, skipping migration');
            return;
        }
        
        const metadataFiles = fs.readdirSync(metaDir).filter(file => file.endsWith('.json'));
        console.log(`📁 Found ${metadataFiles.length} metadata files to check`);
        
        let processed = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        
        for (const metaFile of metadataFiles) {
            try {
                const metaPath = path.join(metaDir, metaFile);
                const metadataJson = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                
                // Check if this file has the feature data
                if (!migration.shouldProcess(metadataJson)) {
                    skipped++;
                    continue;
                }
                
                // Find corresponding image in database
                const originalFilename = metaFile.replace('.json', '');
                const images = await db('images').where('filename', originalFilename);
                
                if (images.length === 0) {
                    console.log(`⚠️  Image not found in database: ${originalFilename}`);
                    skipped++;
                    continue;
                }
                
                const imageId = images[0].id!;
                
                // Check if migration already completed for this image (unless forcing)
                if (!forceAll && await this.isMigrationCompleted(imageId, migration.name)) {
                    skipped++;
                    continue;
                }
                
                // Run the specific migration
                const originalPath = path.join(process.env.media_source_dir || '', 'recents', originalFilename);
                await migration.migrationFunction(imageId, metadataJson, originalPath);
                
                // Mark migration as completed
                await this.markMigrationCompleted(imageId, migration.name, migration.version);
                
                updated++;
                
                if (updated % 25 === 0) {
                    console.log(`   📊 Progress: ${processed + 1}/${metadataFiles.length} processed, ${updated} updated`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${metaFile}:`, error);
                errors++;
            }
            
            processed++;
        }
        
        console.log(`✅ Migration ${migration.name} completed:`);
        console.log(`   📊 ${processed} files processed`);
        console.log(`   ✨ ${updated} images updated`);
        console.log(`   ⏭️  ${skipped} skipped`);
        console.log(`   ❌ ${errors} errors`);
    }

    /**
     * Check if a specific migration has been completed for an image
     */
    private static async isMigrationCompleted(imageId: number, featureName: string): Promise<boolean> {
        try {
            const result = await db('migration_history')
                .where({ image_id: imageId, feature_name: featureName })
                .first();
            return !!result;
        } catch (error) {
            // If migration_history table doesn't exist, assume not completed
            return false;
        }
    }

    /**
     * Mark a migration as completed for an image
     */
    private static async markMigrationCompleted(imageId: number, featureName: string, version: string): Promise<void> {
        try {
            await db('migration_history').insert({
                image_id: imageId,
                feature_name: featureName,
                feature_version: version,
                migrated_at: new Date()
            }).onConflict(['image_id', 'feature_name']).merge();
        } catch (error: any) {
            // If migration_history table doesn't exist, create it
            if (error.code === 'ER_NO_SUCH_TABLE' || error.message?.includes('migration_history')) {
                await this.createMigrationHistoryTable();
                await this.markMigrationCompleted(imageId, featureName, version);
            } else {
                throw error;
            }
        }
    }

    /**
     * Create the migration history table
     */
    private static async createMigrationHistoryTable(): Promise<void> {
        await db.schema.createTable('migration_history', table => {
            table.increments('id').primary();
            table.integer('image_id').unsigned().notNullable();
            table.string('feature_name', 100).notNullable();
            table.string('feature_version', 20).notNullable();
            table.timestamp('migrated_at').defaultTo(db.fn.now());
            
            table.unique(['image_id', 'feature_name']);
            table.foreign('image_id').references('id').inTable('images').onDelete('CASCADE');
            table.index(['feature_name']);
        });
        
        console.log('📋 Created migration_history table');
    }

    /**
     * Object detection migration function
     */
    private static async migrateObjectDetection(imageId: number, metadataJson: any, originalPath: string): Promise<void> {
        if (!metadataJson.objects || metadataJson.objects.length === 0) {
            return;
        }

        // Check if objects already exist for this image
        const existingObjects = await ObjectRepository.getObjectsByImage(imageId);
        if (existingObjects.length > 0) {
            return; // Already migrated
        }

        // Create object records
        const objectRecords = metadataJson.objects.map((obj: any) => ({
            image_id: imageId,
            class: obj.class,
            confidence: obj.confidence,
            x: obj.bbox?.x || 0,
            y: obj.bbox?.y || 0,
            width: obj.bbox?.width || 0,
            height: obj.bbox?.height || 0
        }));

        await ObjectRepository.createObjects(objectRecords);
    }

    /**
     * Get migration status for all features
     */
    static async getMigrationStatus(): Promise<any> {
        const status = [];
        
        for (const migration of this.migrations) {
            try {
                const totalImages = await db('images').count('* as count').first();
                const migratedImages = await db('migration_history')
                    .where('feature_name', migration.name)
                    .count('* as count')
                    .first();
                
                status.push({
                    feature: migration.name,
                    version: migration.version,
                    description: migration.description,
                    totalImages: Number(totalImages?.count) || 0,
                    migratedImages: Number(migratedImages?.count) || 0,
                    completionPercentage: totalImages?.count 
                        ? Math.round(((Number(migratedImages?.count) || 0) / Number(totalImages.count)) * 100)
                        : 0
                });
            } catch (error: any) {
                status.push({
                    feature: migration.name,
                    version: migration.version,
                    description: migration.description,
                    error: error.message
                });
            }
        }
        
        return status;
    }
}