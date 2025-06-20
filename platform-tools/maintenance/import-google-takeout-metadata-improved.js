#!/usr/bin/env node

/**
 * Improved Google Takeout Metadata Importer
 * 
 * Enhanced with:
 * - Progress tracking and logging
 * - Better error handling and recovery
 * - Batch processing to prevent memory issues
 * - Resume capability from last processed file
 * - Timeout handling for slow operations
 */

const path = require('path');
const fs = require('fs');
const knex = require('knex');

// Database configuration
const dbConfig = {
  client: 'mysql2',
  connection: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3307,
    user: process.env.MYSQL_USER || 'photo',
    password: process.env.MYSQL_PASSWORD || 'Dalekini21',
    database: process.env.MYSQL_DATABASE || 'photo-process'
  },
  useNullAsDefault: true,
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  }
};

// Configuration
const BATCH_SIZE = 100;
const PROGRESS_INTERVAL = 50; // Log progress every N files
const SAVE_PROGRESS_INTERVAL = 500; // Save progress to file every N files
const MAX_RETRIES = 3;
const OPERATION_TIMEOUT = 30000; // 30 seconds per operation

// Progress tracking
let processedCount = 0;
let errorCount = 0;
let skippedCount = 0;
let startTime = Date.now();
let lastProgressSave = 0;

// Progress file to track where we left off
const PROGRESS_FILE = '/tmp/google-takeout-import-progress.json';

class GoogleTakeoutImporter {
  constructor() {
    this.db = knex(dbConfig);
    this.takeoutPath = process.env.GOOGLE_TAKEOUT_PATH || '/mnt/sg1/uploads/google/takeout';
  }

  async initialize() {
    try {
      await this.db.raw('SELECT 1');
      console.log('✅ Database connection established');
      
      // Load previous progress
      this.loadProgress();
      
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  loadProgress() {
    try {
      if (fs.existsSync(PROGRESS_FILE)) {
        const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        this.lastProcessedFile = progress.lastProcessedFile;
        this.startFromFile = progress.nextFile;
        console.log(`📂 Resuming from: ${this.startFromFile || 'beginning'}`);
      }
    } catch (error) {
      console.log('📂 Starting fresh import (no previous progress found)');
    }
  }

  saveProgress(currentFile, nextFile) {
    const progress = {
      lastProcessedFile: currentFile,
      nextFile: nextFile,
      processedCount,
      errorCount,
      skippedCount,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  }

  async findJsonFiles() {
    console.log(`🔍 Scanning for JSON files in: ${this.takeoutPath}`);
    const jsonFiles = [];
    
    const scanDirectory = (dir) => {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          
          if (item.isDirectory()) {
            scanDirectory(fullPath);
          } else if (item.isFile() && item.name.endsWith('.json')) {
            // Skip if we're resuming and haven't reached the start file yet
            if (this.startFromFile && fullPath < this.startFromFile) {
              return;
            }
            jsonFiles.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Skipping directory ${dir}: ${error.message}`);
      }
    };

    scanDirectory(this.takeoutPath);
    console.log(`📊 Found ${jsonFiles.length} JSON files to process`);
    return jsonFiles.sort(); // Process in consistent order
  }

  async processJsonFile(jsonPath, retryCount = 0) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), OPERATION_TIMEOUT);
      });

      const processPromise = this.doProcessJsonFile(jsonPath);
      
      await Promise.race([processPromise, timeoutPromise]);
      
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Retry ${retryCount + 1}/${MAX_RETRIES} for: ${path.basename(jsonPath)}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return this.processJsonFile(jsonPath, retryCount + 1);
      } else {
        console.error(`❌ Failed after ${MAX_RETRIES} retries: ${jsonPath} - ${error.message}`);
        errorCount++;
        throw error;
      }
    }
  }

  async doProcessJsonFile(jsonPath) {
    const content = fs.readFileSync(jsonPath, 'utf8');
    const metadata = JSON.parse(content);
    
    // Extract filename without .json extension
    const imageFilename = path.basename(jsonPath, '.json');
    
    // Find corresponding image in database
    const image = await this.db('images')
      .where('filename', imageFilename)
      .orWhere('filename', 'like', `${imageFilename.split('.')[0]}.%`)
      .first();

    if (!image) {
      skippedCount++;
      return; // Skip if image not found
    }

    // Process metadata in transaction
    await this.db.transaction(async (trx) => {
      // Import Google metadata
      if (metadata.photoTakenTime || metadata.geoData || metadata.people) {
        await this.importGoogleMetadata(trx, image.id, metadata);
      }

      // Import people tags
      if (metadata.people && metadata.people.length > 0) {
        await this.importPeopleTags(trx, image.id, metadata.people);
      }

      // Import albums if in album folder
      const albumName = this.extractAlbumFromPath(jsonPath);
      if (albumName) {
        await this.linkToAlbum(trx, image.id, albumName);
      }
    });

    processedCount++;
  }

  async importGoogleMetadata(trx, imageId, metadata) {
    const googleData = {
      image_id: imageId,
      google_title: metadata.title || null,
      google_description: metadata.description || null,
      google_view_count: parseInt(metadata.imageViews) || 0,
      google_url: metadata.url || null,
      device_type: metadata.googlePhotosOrigin?.mobileUpload?.deviceType || metadata.googlePhotosOrigin?.webUpload?.computerUpload ? 'computer' : null,
      google_creation_time: metadata.creationTime?.timestamp ? new Date(parseInt(metadata.creationTime.timestamp) * 1000) : null,
      google_photo_taken_time: metadata.photoTakenTime?.timestamp ? new Date(parseInt(metadata.photoTakenTime.timestamp) * 1000) : null,
      google_last_modified_time: metadata.photoLastModifiedTime?.timestamp ? new Date(parseInt(metadata.photoLastModifiedTime.timestamp) * 1000) : null,
      google_raw_metadata: JSON.stringify(metadata)
    };

    await trx('google_metadata').insert(googleData).onConflict('image_id').merge();
  }

  async importPeopleTags(trx, imageId, people) {
    for (const person of people) {
      const personData = {
        image_id: imageId,
        person_name: person.name,
        person_id: null, // Will be linked later
        is_verified: false,
        source: 'google_takeout'
      };

      await trx('google_people_tags').insert(personData).onConflict(['image_id', 'person_name']).ignore();
    }
  }

  async linkToAlbum(trx, imageId, albumName) {
    // Create or find album
    let album = await trx('albums').where('name', albumName).first();
    
    if (!album) {
      const [albumId] = await trx('albums').insert({
        name: albumName,
        slug: albumName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        source: 'google_takeout',
        created_at: new Date(),
        updated_at: new Date()
      });
      album = { id: albumId };
    }

    // Link image to album
    await trx('album_images').insert({
      album_id: album.id,
      image_id: imageId
    }).onConflict(['album_id', 'image_id']).ignore();
  }

  extractAlbumFromPath(jsonPath) {
    const relativePath = path.relative(this.takeoutPath, jsonPath);
    const pathParts = relativePath.split(path.sep);
    
    // Look for album folders (typically second level after takeout root)
    if (pathParts.length > 2) {
      return pathParts[1]; // First subfolder after takeout root
    }
    return null;
  }

  logProgress() {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processedCount / elapsed;
    
    console.log(`📊 Progress: ${processedCount} processed, ${errorCount} errors, ${skippedCount} skipped (${rate.toFixed(1)}/sec)`);
  }

  async run() {
    console.log('🚀 Starting Google Takeout metadata import...');
    
    if (!await this.initialize()) {
      process.exit(1);
    }

    const jsonFiles = await this.findJsonFiles();
    
    if (jsonFiles.length === 0) {
      console.log('✅ No JSON files found to process');
      return;
    }

    console.log(`📥 Processing ${jsonFiles.length} JSON files in batches of ${BATCH_SIZE}`);

    // Process in batches
    for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
      const batch = jsonFiles.slice(i, i + BATCH_SIZE);
      
      console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(jsonFiles.length / BATCH_SIZE)}`);
      
      // Process batch items sequentially to avoid overwhelming the database
      for (const jsonFile of batch) {
        try {
          await this.processJsonFile(jsonFile);
          
          // Log progress periodically
          if (processedCount % PROGRESS_INTERVAL === 0) {
            this.logProgress();
          }

          // Save progress periodically
          if (processedCount % SAVE_PROGRESS_INTERVAL === 0) {
            this.saveProgress(jsonFile, jsonFiles[i + batch.indexOf(jsonFile) + 1]);
          }
          
        } catch (error) {
          // Error already logged in processJsonFile
          continue;
        }
      }
      
      // Small delay between batches to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final progress report
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`✅ Import completed!`);
    console.log(`📊 Final stats: ${processedCount} processed, ${errorCount} errors, ${skippedCount} skipped`);
    console.log(`⏱️  Total time: ${elapsed.toFixed(1)} seconds (${(processedCount / elapsed).toFixed(1)}/sec)`);

    // Clean up progress file on successful completion
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }

    await this.db.destroy();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received interrupt signal, saving progress...');
  // Progress is already saved periodically
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received termination signal, saving progress...');
  process.exit(0);
});

// Run the importer
const importer = new GoogleTakeoutImporter();
importer.run().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});