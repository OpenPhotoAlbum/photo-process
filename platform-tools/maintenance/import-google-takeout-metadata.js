#!/usr/bin/env node

/**
 * Google Takeout Metadata Importer
 * 
 * Imports rich metadata from Google Takeout JSON files:
 * 1. Creates albums from folder structure
 * 2. Imports people tags and links to existing persons
 * 3. Imports precise GPS coordinates and location enrichments
 * 4. Stores view counts and engagement metrics
 * 5. Links images to albums
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
  useNullAsDefault: true
};

const db = knex(dbConfig);
const TAKEOUT_BASE_DIR = '/mnt/sg1/uploads/google/takeout';

class GoogleTakeoutImporter {
    constructor() {
        this.stats = {
            albumsCreated: 0,
            albumsUpdated: 0,
            imagesLinked: 0,
            peopleTagsImported: 0,
            locationEnrichmentsImported: 0,
            metadataRecordsCreated: 0,
            personsMatched: 0,
            personsCreated: 0,
            gpsCoordinatesUpdated: 0,
            errors: 0
        };
        
        this.personNameMap = new Map(); // Cache for person name -> ID mapping
        this.albumCache = new Map(); // Cache for album folder -> ID mapping
    }

    /**
     * Create URL-friendly slug from album name
     */
    createSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 100);
    }

    /**
     * Load existing persons into cache for fast lookup
     */
    async loadPersonCache() {
        const persons = await db('persons').select('id', 'name', 'google_person_name');
        
        persons.forEach(person => {
            // Map both current name and Google name
            this.personNameMap.set(person.name.toLowerCase(), person.id);
            if (person.google_person_name) {
                this.personNameMap.set(person.google_person_name.toLowerCase(), person.id);
            }
        });
        
        console.log(`📋 Loaded ${persons.length} existing persons into cache`);
    }

    /**
     * Find or create a person from Google tag
     */
    async findOrCreatePerson(googleName) {
        const normalizedName = googleName.toLowerCase();
        
        // Check cache first
        if (this.personNameMap.has(normalizedName)) {
            return this.personNameMap.get(normalizedName);
        }
        
        // Create new person
        const [personId] = await db('persons').insert({
            name: googleName,
            google_person_name: googleName,
            face_count: 0,
            is_from_google: true,
            google_first_seen: new Date(),
            created_at: new Date()
        });
        
        // Update cache
        this.personNameMap.set(normalizedName, personId);
        this.stats.personsCreated++;
        
        console.log(`  👤 Created person: ${googleName}`);
        return personId;
    }

    /**
     * Import or update album from folder
     */
    async importAlbum(albumDir, albumMetadata) {
        const albumName = path.basename(albumDir);
        const slug = this.createSlug(albumName);
        
        // Check if album already exists
        let album = await db('albums')
            .where('google_folder_path', albumDir)
            .orWhere('slug', slug)
            .first();
        
        const albumData = {
            name: albumName,
            slug: slug,
            source: 'google_takeout',
            source_folder_path: albumDir,
            updated_at: new Date()
        };
        
        if (albumMetadata) {
            albumData.description = albumMetadata.description || '';
            albumData.access_level = albumMetadata.access || 'protected';
            if (albumMetadata.date?.formatted) {
                const albumDate = new Date(albumMetadata.date.formatted);
                // Only set date if it's valid (not epoch/1970)
                if (albumDate.getFullYear() > 1970) {
                    albumData.album_date = albumDate;
                }
            }
        }
        
        if (album) {
            // Update existing album
            await db('albums').where('id', album.id).update(albumData);
            this.stats.albumsUpdated++;
            console.log(`  📁 Updated album: ${albumName}`);
        } else {
            // Create new album
            albumData.created_at = new Date();
            const [albumId] = await db('albums').insert(albumData);
            album = { id: albumId, ...albumData };
            this.stats.albumsCreated++;
            console.log(`  📁 Created album: ${albumName}`);
        }
        
        // Cache album
        this.albumCache.set(albumDir, album.id);
        
        // Import location enrichments if present
        if (albumMetadata?.enrichments) {
            await this.importLocationEnrichments(album.id, null, albumMetadata.enrichments);
        }
        
        return album.id;
    }

    /**
     * Import location enrichments
     */
    async importLocationEnrichments(albumId, imageId, enrichments) {
        for (const enrichment of enrichments) {
            if (enrichment.locationEnrichment?.location) {
                for (const location of enrichment.locationEnrichment.location) {
                    try {
                        await db('google_location_enrichments').insert({
                            album_id: albumId,
                            image_id: imageId,
                            place_name: location.name,
                            place_description: location.description,
                            latitude: location.latitudeE7 / 1e7,
                            longitude: location.longitudeE7 / 1e7,
                            place_type: 'poi'
                        });
                        
                        this.stats.locationEnrichmentsImported++;
                    } catch (error) {
                        if (!error.message.includes('Duplicate entry')) {
                            console.warn(`    ⚠️  Location enrichment error: ${error.message}`);
                        }
                    }
                }
            }
        }
    }

    /**
     * Import Google metadata for a single image
     */
    async importImageMetadata(imageId, imagePath, googleJson) {
        try {
            // Update GPS coordinates if Google's data is more precise
            if (googleJson.geoData && this.hasValidGPS(googleJson.geoData)) {
                const currentImage = await db('images').where('id', imageId).first();
                
                if (!currentImage.gps_latitude || !currentImage.gps_longitude) {
                    // No existing GPS data, use Google's
                    await db('images').where('id', imageId).update({
                        gps_latitude: googleJson.geoData.latitude,
                        gps_longitude: googleJson.geoData.longitude,
                        gps_altitude: googleJson.geoData.altitude,
                        google_imported_at: new Date()
                    });
                    
                    await db('image_metadata').where('image_id', imageId).update({
                        latitude: googleJson.geoData.latitude,
                        longitude: googleJson.geoData.longitude,
                        altitude: googleJson.geoData.altitude
                    });
                    
                    this.stats.gpsCoordinatesUpdated++;
                }
            }
            
            // Create or update Google metadata record
            const googleMetadata = {
                image_id: imageId,
                google_title: googleJson.title,
                google_description: googleJson.description || '',
                google_view_count: parseInt(googleJson.imageViews) || 0,
                google_url: googleJson.url,
                device_type: googleJson.googlePhotosOrigin?.mobileUpload?.deviceType,
                google_creation_time: googleJson.creationTime?.formatted ? new Date(googleJson.creationTime.formatted) : null,
                google_photo_taken_time: googleJson.photoTakenTime?.formatted ? new Date(googleJson.photoTakenTime.formatted) : null,
                google_last_modified_time: googleJson.photoLastModifiedTime?.formatted ? new Date(googleJson.photoLastModifiedTime.formatted) : null,
                google_raw_metadata: JSON.stringify(googleJson)
            };
            
            // Insert or update Google metadata
            await db('google_metadata')
                .insert(googleMetadata)
                .onConflict('image_id')
                .merge();
            
            this.stats.metadataRecordsCreated++;
            
            // Update image with Google view count
            await db('images').where('id', imageId).update({
                google_view_count: googleMetadata.google_view_count
            });
            
            // Import people tags
            if (googleJson.people && googleJson.people.length > 0) {
                for (const person of googleJson.people) {
                    const personId = await this.findOrCreatePerson(person.name);
                    
                    // Insert people tag
                    try {
                        await db('google_people_tags').insert({
                            image_id: imageId,
                            person_name: person.name,
                            person_id: personId,
                            source: 'google_photos'
                        });
                        
                        this.stats.peopleTagsImported++;
                        
                        // Update person's Google tag count
                        await db('persons').where('id', personId).increment('google_tag_count', 1);
                        
                    } catch (error) {
                        if (!error.message.includes('Duplicate entry')) {
                            console.warn(`    ⚠️  People tag error: ${error.message}`);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error(`    ❌ Error importing metadata for ${imagePath}: ${error.message}`);
            this.stats.errors++;
        }
    }

    /**
     * Check if GPS data is valid
     */
    hasValidGPS(geoData) {
        return geoData && 
               geoData.latitude !== 0 && 
               geoData.longitude !== 0 &&
               geoData.latitude !== undefined && 
               geoData.longitude !== undefined;
    }

    /**
     * Find image in database by original path
     */
    async findImageByPath(imagePath) {
        // Try exact path match first
        let image = await db('images').where('original_path', imagePath).first();
        
        if (!image) {
            // Try matching by filename only (for cases where paths might differ)
            const filename = path.basename(imagePath);
            const images = await db('images').where('filename', filename);
            
            // If only one match, use it
            if (images.length === 1) {
                image = images[0];
            }
        }
        
        return image;
    }

    /**
     * Process a single album directory
     */
    async processAlbum(albumDir) {
        const albumName = path.basename(albumDir);
        console.log(`📁 Processing album: ${albumName}`);
        
        // Import album metadata
        let albumMetadata = null;
        const metadataPath = path.join(albumDir, 'metadata.json');
        
        if (fs.existsSync(metadataPath)) {
            try {
                const content = fs.readFileSync(metadataPath, 'utf8');
                albumMetadata = JSON.parse(content);
            } catch (error) {
                console.warn(`  ⚠️  Error reading album metadata: ${error.message}`);
            }
        }
        
        const albumId = await this.importAlbum(albumDir, albumMetadata);
        
        // Find all image JSON files
        const jsonFiles = fs.readdirSync(albumDir)
            .filter(file => file.endsWith('.json') && file !== 'metadata.json')
            .map(file => path.join(albumDir, file));
        
        console.log(`  📋 Processing ${jsonFiles.length} image metadata files`);
        
        let processed = 0;
        for (const jsonFile of jsonFiles) {
            try {
                // Determine corresponding image path
                const imageFilename = path.basename(jsonFile, '.json');
                const possibleImagePaths = [
                    path.join(albumDir, imageFilename),
                    path.join(albumDir, imageFilename.toLowerCase()),
                    path.join(albumDir, imageFilename.toUpperCase())
                ];
                
                // Find the actual image file
                let imagePath = null;
                for (const possiblePath of possibleImagePaths) {
                    if (fs.existsSync(possiblePath)) {
                        imagePath = possiblePath;
                        break;
                    }
                }
                
                if (!imagePath) {
                    // Image file not found, skip
                    continue;
                }
                
                // Find image in database
                const image = await this.findImageByPath(imagePath);
                if (!image) {
                    // Image not in our database, skip
                    continue;
                }
                
                // Parse Google JSON metadata
                const content = fs.readFileSync(jsonFile, 'utf8');
                const googleJson = JSON.parse(content);
                
                // Import the metadata
                await this.importImageMetadata(image.id, imagePath, googleJson);
                
                // Link image to album
                try {
                    await db('album_images').insert({
                        album_id: albumId,
                        image_id: image.id,
                        sort_order: processed
                    });
                    this.stats.imagesLinked++;
                } catch (error) {
                    if (!error.message.includes('Duplicate entry')) {
                        console.warn(`    ⚠️  Album linking error: ${error.message}`);
                    }
                }
                
                processed++;
                
                if (processed % 100 === 0) {
                    console.log(`    📊 Processed ${processed}/${jsonFiles.length} images...`);
                }
                
            } catch (error) {
                console.error(`  ❌ Error processing ${jsonFile}: ${error.message}`);
                this.stats.errors++;
            }
        }
        
        // Update album image count
        const imageCount = await db('album_images').where('album_id', albumId).count('* as count').first();
        await db('albums').where('id', albumId).update({ 
            image_count: imageCount.count,
            updated_at: new Date()
        });
        
        console.log(`  ✅ Album complete: ${processed} images processed, ${imageCount.count} linked`);
    }

    /**
     * Main import function
     */
    async import() {
        console.log('📥 Google Takeout Metadata Importer');
        console.log('===================================');
        console.log(`Importing from: ${TAKEOUT_BASE_DIR}\n`);
        
        if (!fs.existsSync(TAKEOUT_BASE_DIR)) {
            console.error(`❌ Takeout directory not found: ${TAKEOUT_BASE_DIR}`);
            return;
        }
        
        // Load existing persons for matching
        await this.loadPersonCache();
        
        // Get all album directories
        const albumDirs = fs.readdirSync(TAKEOUT_BASE_DIR)
            .map(dir => path.join(TAKEOUT_BASE_DIR, dir))
            .filter(dir => fs.statSync(dir).isDirectory())
            ; // Process all albums
        
        console.log(`Found ${albumDirs.length} album directories to process\n`);
        
        // Process each album
        for (const albumDir of albumDirs) {
            try {
                await this.processAlbum(albumDir);
            } catch (error) {
                console.error(`❌ Error processing album ${albumDir}: ${error.message}`);
                this.stats.errors++;
            }
        }
        
        this.printSummary();
    }

    /**
     * Print import summary
     */
    printSummary() {
        console.log('\n📊 Import Summary');
        console.log('=================');
        console.log(`📁 Albums created: ${this.stats.albumsCreated}`);
        console.log(`📁 Albums updated: ${this.stats.albumsUpdated}`);
        console.log(`🔗 Images linked to albums: ${this.stats.imagesLinked}`);
        console.log(`👥 People tags imported: ${this.stats.peopleTagsImported}`);
        console.log(`👤 New persons created: ${this.stats.personsCreated}`);
        console.log(`📍 Location enrichments: ${this.stats.locationEnrichmentsImported}`);
        console.log(`📋 Metadata records: ${this.stats.metadataRecordsCreated}`);
        console.log(`🌍 GPS coordinates updated: ${this.stats.gpsCoordinatesUpdated}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        
        if (this.stats.albumsCreated > 0 || this.stats.imagesLinked > 0) {
            console.log('\n🎉 Google Takeout import completed successfully!');
            console.log('   Your photos now have rich album organization and metadata');
        }
    }
}

// Run the importer
async function main() {
    const importer = new GoogleTakeoutImporter();
    await importer.import();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⚠️  Received interrupt signal, shutting down gracefully...');
    await db.destroy();
    process.exit(0);
});

main().catch(error => {
    console.error('❌ Import error:', error);
    process.exit(1);
}).finally(async () => {
    await db.destroy();
});