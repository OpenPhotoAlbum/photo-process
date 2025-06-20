#!/usr/bin/env node

/**
 * Google Takeout Metadata Scanner
 * 
 * Scans Google Takeout directories to analyze and inventory available metadata:
 * 1. Individual image JSON files with people, GPS, timestamps, view counts
 * 2. Album metadata.json files with titles, locations, enrichments
 * 3. Folder structure representing album organization
 * 
 * This script analyzes what data is available before implementing the import system.
 */

const path = require('path');
const fs = require('fs');

const TAKEOUT_BASE_DIR = '/mnt/sg1/uploads/google/takeout';

class GoogleTakeoutScanner {
    constructor() {
        this.stats = {
            totalAlbums: 0,
            totalImageJsonFiles: 0,
            totalImages: 0,
            albumsWithMetadata: 0,
            imagesWithPeople: 0,
            imagesWithGPS: 0,
            imagesWithViewCounts: 0,
            uniquePeople: new Set(),
            deviceTypes: new Set(),
            locationEnrichments: []
        };
        
        this.sampleData = {
            imageMetadata: [],
            albumMetadata: [],
            peopleExamples: [],
            locationExamples: []
        };
    }

    /**
     * Parse individual image JSON metadata
     */
    parseImageJson(jsonPath) {
        try {
            const content = fs.readFileSync(jsonPath, 'utf8');
            const metadata = JSON.parse(content);
            
            const analysis = {
                path: jsonPath,
                title: metadata.title,
                hasGPS: this.hasValidGPS(metadata.geoData || metadata.geoDataExif),
                hasPeople: metadata.people && metadata.people.length > 0,
                peopleCount: metadata.people ? metadata.people.length : 0,
                people: metadata.people ? metadata.people.map(p => p.name) : [],
                hasViewCount: !!metadata.imageViews,
                viewCount: metadata.imageViews ? parseInt(metadata.imageViews) : 0,
                deviceType: metadata.googlePhotosOrigin?.mobileUpload?.deviceType,
                timestamps: {
                    created: metadata.creationTime?.formatted,
                    photoTaken: metadata.photoTakenTime?.formatted,
                    lastModified: metadata.photoLastModifiedTime?.formatted
                },
                gps: this.extractGPS(metadata.geoData || metadata.geoDataExif)
            };
            
            return analysis;
        } catch (error) {
            console.warn(`Error parsing ${jsonPath}: ${error.message}`);
            return null;
        }
    }

    /**
     * Parse album metadata.json
     */
    parseAlbumJson(jsonPath) {
        try {
            const content = fs.readFileSync(jsonPath, 'utf8');
            const metadata = JSON.parse(content);
            
            const analysis = {
                path: jsonPath,
                directory: path.dirname(jsonPath),
                title: metadata.title,
                description: metadata.description,
                access: metadata.access,
                date: metadata.date?.formatted,
                hasLocation: !!metadata.location,
                location: metadata.location,
                hasEnrichments: metadata.enrichments && metadata.enrichments.length > 0,
                enrichments: this.parseEnrichments(metadata.enrichments || [])
            };
            
            return analysis;
        } catch (error) {
            console.warn(`Error parsing album ${jsonPath}: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract and parse location enrichments
     */
    parseEnrichments(enrichments) {
        const locations = [];
        
        enrichments.forEach(enrichment => {
            if (enrichment.locationEnrichment?.location) {
                enrichment.locationEnrichment.location.forEach(loc => {
                    locations.push({
                        name: loc.name,
                        description: loc.description,
                        lat: loc.latitudeE7 / 1e7,
                        lng: loc.longitudeE7 / 1e7
                    });
                });
            }
        });
        
        return locations;
    }

    /**
     * Check if GPS data is valid (not zeros)
     */
    hasValidGPS(geoData) {
        return geoData && 
               geoData.latitude !== 0 && 
               geoData.longitude !== 0 &&
               geoData.latitude !== undefined && 
               geoData.longitude !== undefined;
    }

    /**
     * Extract GPS coordinates
     */
    extractGPS(geoData) {
        if (!this.hasValidGPS(geoData)) return null;
        
        return {
            latitude: geoData.latitude,
            longitude: geoData.longitude,
            altitude: geoData.altitude
        };
    }

    /**
     * Scan a single takeout album directory
     */
    scanAlbumDirectory(albumDir) {
        const albumName = path.basename(albumDir);
        const metadataPath = path.join(albumDir, 'metadata.json');
        
        console.log(`📁 Scanning album: ${albumName}`);
        
        let albumMetadata = null;
        if (fs.existsSync(metadataPath)) {
            albumMetadata = this.parseAlbumJson(metadataPath);
            if (albumMetadata) {
                this.stats.albumsWithMetadata++;
                this.sampleData.albumMetadata.push(albumMetadata);
                
                // Collect location enrichments
                if (albumMetadata.enrichments.length > 0) {
                    this.stats.locationEnrichments.push(...albumMetadata.enrichments);
                    this.sampleData.locationExamples.push(...albumMetadata.enrichments);
                }
            }
        }
        
        // Find all JSON files for images
        const jsonFiles = fs.readdirSync(albumDir)
            .filter(file => file.endsWith('.json') && file !== 'metadata.json')
            .map(file => path.join(albumDir, file));
            
        console.log(`  📋 Found ${jsonFiles.length} image JSON files`);
        this.stats.totalImageJsonFiles += jsonFiles.length;
        
        // Sample some image metadata
        const samplesToTake = Math.min(3, jsonFiles.length);
        const samples = jsonFiles.slice(0, samplesToTake);
        
        samples.forEach(jsonFile => {
            const imageAnalysis = this.parseImageJson(jsonFile);
            if (imageAnalysis) {
                this.updateStatsFromImage(imageAnalysis);
                
                // Keep samples for reporting
                if (this.sampleData.imageMetadata.length < 10) {
                    this.sampleData.imageMetadata.push(imageAnalysis);
                }
            }
        });
        
        // Count total images (assuming each JSON has a corresponding image)
        this.stats.totalImages += jsonFiles.length;
    }

    /**
     * Update statistics from image analysis
     */
    updateStatsFromImage(imageAnalysis) {
        if (imageAnalysis.hasGPS) this.stats.imagesWithGPS++;
        if (imageAnalysis.hasPeople) this.stats.imagesWithPeople++;
        if (imageAnalysis.hasViewCount) this.stats.imagesWithViewCounts++;
        
        // Collect unique people
        imageAnalysis.people.forEach(person => {
            this.stats.uniquePeople.add(person);
            if (this.sampleData.peopleExamples.length < 20) {
                this.sampleData.peopleExamples.push({
                    name: person,
                    image: imageAnalysis.title
                });
            }
        });
        
        // Collect device types
        if (imageAnalysis.deviceType) {
            this.stats.deviceTypes.add(imageAnalysis.deviceType);
        }
    }

    /**
     * Main scanning function
     */
    async scan() {
        console.log('🔍 Google Takeout Metadata Scanner');
        console.log('=====================================');
        console.log(`Scanning: ${TAKEOUT_BASE_DIR}\n`);
        
        if (!fs.existsSync(TAKEOUT_BASE_DIR)) {
            console.error(`❌ Takeout directory not found: ${TAKEOUT_BASE_DIR}`);
            return;
        }
        
        // Get all album directories (subdirectories of takeout)
        const albumDirs = fs.readdirSync(TAKEOUT_BASE_DIR)
            .map(dir => path.join(TAKEOUT_BASE_DIR, dir))
            .filter(dir => fs.statSync(dir).isDirectory());
            
        console.log(`Found ${albumDirs.length} potential album directories\n`);
        this.stats.totalAlbums = albumDirs.length;
        
        // Scan each album directory
        for (const albumDir of albumDirs) {
            try {
                this.scanAlbumDirectory(albumDir);
            } catch (error) {
                console.error(`Error scanning ${albumDir}: ${error.message}`);
            }
        }
        
        this.printReport();
    }

    /**
     * Print comprehensive analysis report
     */
    printReport() {
        console.log('\n📊 Google Takeout Analysis Report');
        console.log('==================================\n');
        
        // Overall statistics
        console.log('📈 Overall Statistics:');
        console.log(`  📁 Total album directories: ${this.stats.totalAlbums}`);
        console.log(`  📋 Albums with metadata.json: ${this.stats.albumsWithMetadata}`);
        console.log(`  🖼️  Total images: ${this.stats.totalImages}`);
        console.log(`  📄 Total image JSON files: ${this.stats.totalImageJsonFiles}`);
        console.log('');
        
        // Image metadata statistics
        console.log('🖼️ Image Metadata Analysis:');
        console.log(`  📍 Images with GPS data: ${this.stats.imagesWithGPS}`);
        console.log(`  👥 Images with people tags: ${this.stats.imagesWithPeople}`);
        console.log(`  👁️  Images with view counts: ${this.stats.imagesWithViewCounts}`);
        console.log(`  📱 Device types found: ${Array.from(this.stats.deviceTypes).join(', ')}`);
        console.log('');
        
        // People analysis
        console.log('👥 People Analysis:');
        console.log(`  🏷️  Unique people tagged: ${this.stats.uniquePeople.size}`);
        if (this.stats.uniquePeople.size > 0) {
            const peopleList = Array.from(this.stats.uniquePeople).slice(0, 10);
            console.log(`  📝 Sample people: ${peopleList.join(', ')}`);
            if (this.stats.uniquePeople.size > 10) {
                console.log(`  ... and ${this.stats.uniquePeople.size - 10} more`);
            }
        }
        console.log('');
        
        // Location analysis
        console.log('📍 Location Analysis:');
        console.log(`  🏞️  Location enrichments found: ${this.stats.locationEnrichments.length}`);
        if (this.stats.locationEnrichments.length > 0) {
            console.log('  📍 Sample locations:');
            this.sampleData.locationExamples.slice(0, 5).forEach(loc => {
                console.log(`    • ${loc.name} (${loc.description}) - ${loc.lat}, ${loc.lng}`);
            });
        }
        console.log('');
        
        // Sample data
        console.log('📋 Sample Album Metadata:');
        this.sampleData.albumMetadata.slice(0, 3).forEach(album => {
            console.log(`  📁 "${album.title}"`);
            console.log(`     📅 Date: ${album.date}`);
            console.log(`     🔒 Access: ${album.access}`);
            console.log(`     📍 Enrichments: ${album.enrichments.length}`);
        });
        console.log('');
        
        console.log('📋 Sample Image Metadata:');
        this.sampleData.imageMetadata.slice(0, 3).forEach(img => {
            console.log(`  🖼️  "${img.title}"`);
            console.log(`     👥 People: ${img.people.join(', ') || 'None'}`);
            console.log(`     📍 GPS: ${img.hasGPS ? 'Yes' : 'No'}`);
            console.log(`     👁️  Views: ${img.viewCount}`);
        });
        
        console.log('\n🎯 Implementation Recommendations:');
        console.log('===================================');
        console.log('1. 📋 Create album import system for folder structure');
        console.log('2. 👥 Import people tags to pre-populate face assignments');
        console.log('3. 📍 Use GPS data to enhance location accuracy');
        console.log('4. 📊 Store view counts and engagement metrics');
        console.log('5. 🏞️  Import location enrichments for better place names');
        console.log('6. 📅 Use precise timestamps for better date organization');
    }
}

// Run the scanner
async function main() {
    const scanner = new GoogleTakeoutScanner();
    await scanner.scan();
}

main().catch(error => {
    console.error('❌ Scanner error:', error);
    process.exit(1);
});