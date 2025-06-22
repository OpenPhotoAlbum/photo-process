# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Vision

**See `VISION.md` in the project root for the complete product vision and user experience goals.**

This vision should guide all feature decisions, design choices, and technical priorities. The core goal is digital independence with smart organization - breaking free from Big Tech photo storage while building intelligent personal photo management.

**See `MODULE_EXPANSION.md` for future specialized product ecosystem planning.**

This document outlines the long-term vision for expanding beyond core photo management into specialized products like AstroVault (astrophotography), FamilyTree (genealogy), and PeopleStories (personal narratives), following an Atlassian-style product suite model.

## Development Commands

### Build and Run
- `tsc` - Compile TypeScript to build/ directory

#### Server Management (IMPORTANT - Use Docker for all operations)
```bash
# 1. Start all platform services
docker compose -f docker-compose.platform.yml up -d

# 2. Start only API and database
docker compose -f docker-compose.platform.yml up -d api database

# 3. View API logs
docker compose -f docker-compose.platform.yml logs -f api

# 4. Restart API service
docker compose -f docker-compose.platform.yml restart api

# 5. Stop all services
docker compose -f docker-compose.platform.yml down

# 6. Verify server is responding (wait 3 seconds for startup)
sleep 3 && curl -s http://localhost:9000/api/persons/unidentified?limit=1 > /dev/null && echo "✅ Server responding" || echo "❌ Server not responding"
```

### Photo Processing
- `curl http://localhost:9000/scan` - Start photo processing via API
- `curl http://localhost:9000/scan/status` - Check processing status

### Database Management
- `npm run db:migrate` - Run Knex migrations  
- `npm run db:seed` - Run database seeds
- `npm run db:create-migration` - Create new Knex migration

### Testing
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:coverage` - Generate test coverage report
- `npm run test:watch` - Run tests in watch mode

### Maintenance & Migration Tools
- `npm run maintenance:migrate-features` - Check migration status for all features
- `npm run maintenance:retroactive` - Add missing features to existing photos
- `npm run maintenance:fix-dates` - Fix date issues in processed images
- `npm run maintenance:update-objects` - Update object detection data

### Cleanup Tools
- `npm run cleanup:menu` - Interactive cleanup menu
- `npm run cleanup:compreface` - Clean CompreFace data
- `npm run cleanup:fresh-start` - Complete system reset
- `npm run cleanup:local-data` - Clean local processing data

### Logging Commands
- `npm run logs:processing` - Monitor photo processing logs
- `npm run logs:api` - Monitor API request/response logs
- `npm run logs:errors` - Monitor error logs
- `npm run logs:faces` - Monitor face detection/recognition logs
- `npm run logs:system` - Monitor system startup logs

### Claude Brain MCP Commands
- `npm run mcp:start` - Start Claude Brain MCP server for Claude Code integration
- `npm run mcp:start-simple` - Start simple MCP server version
- `npm run mcp:test` - Test MCP server (show help message)
- `npm run mcp:inject` - Rebuild embeddings database with current codebase
- `npm run mcp:rebuild` - Same as inject (rebuild database)
- `npm run mcp:check-drift` - Check for changes since last database update
- `npm run mcp:auto-update` - Check for drift and auto-rebuild if needed
- `npm run mcp:monitor` - Start continuous drift monitoring service
- `npm run mcp:monitor-once` - Run single drift check and update if needed
- `npm run mcp:update-cache` - Update drift detection cache
- `npm run mcp:cleanup-db` - Clean unwanted files from existing database

**Claude Brain Integration**: Provides semantic codebase search tools to Claude Code:
- **search_codebase**: Natural language search across entire project (6GB indexed database)
- **search_by_file_type**: Filter search by file extensions (.ts, .py, .js, etc.)
- **Database**: 6GB embeddings.db with full project codebase semantically indexed
- **Architecture**: Python MCP server in `claude_brain/` directory with virtual environment

**IMPORTANT**: Always prefer using `search_codebase` MCP tool over standard search tools (Grep, Glob, Task) when possible to prevent excessive token usage and get more relevant semantic results. The MCP tool provides natural language search with context-aware results.

**Drift Detection**: Automated system monitors file changes and keeps database current:
- **File Monitoring**: Tracks changes to all trackable files (code, docs, configs)
- **Smart Filtering**: Uses `.brainignore` to exclude unwanted files (logs, binaries, node_modules)
- **Automatic Updates**: Can trigger rebuilds when significant drift is detected
- **Continuous Monitoring**: Optional background service for real-time drift detection
- **Cache System**: Maintains file state cache for efficient change detection

### Monitoring & Logging Commands
- `npm run logs:start` - Start Elasticsearch and Kibana monitoring stack
- `npm run logs:stop` - Stop monitoring stack
- `npm run logs:restart` - Restart monitoring stack
- `npm run logs:status` - Check monitoring service status
- `npm run logs:kibana` - Open Kibana dashboard (http://localhost:5601)
- `npm run logs:check-indices` - View current Elasticsearch indices
- `npm run logs:ship-today` - Ship today's logs to Elasticsearch

**Monitoring Stack**: Comprehensive logging and analysis system:
- **Elasticsearch**: Primary log storage with organized daily indices
- **Kibana**: Web-based visualization and query interface at http://localhost:5601
- **Direct Logging**: Application logs directly to Elasticsearch (no Filebeat)
- **Log Categories**: System, API, processing, faces, errors, performance, audit
- **Dual Logging**: Both Elasticsearch and local files for redundancy

**Pattern**: Whenever we add new processing features, always create retroactive scripts to update existing images.

## Architecture Overview

### Core Application Flow
This is a photo processing service that processes iPhone PhotoSync backups with AI-powered analysis:

1. **Entry Point**: `services/api/index.ts` - Express.js API server
2. **File Discovery**: `services/api/util/file-tracker.ts` - Database-driven file discovery system
3. **Scanner**: `services/api/scanner/scan.ts` - Batch processes images using FileTracker
4. **Processing Pipeline**: `services/api/util/process-source.ts` - Orchestrates all analysis steps
5. **Output**: Stores all data in MySQL database with hash-based file organization

### Current Architecture (API-Only Mode)
- ✅ **API-Only**: Clean backend APIs with no frontend dependencies
- ✅ **Thunder Client Testing**: Comprehensive collection for API testing (`thunder-client-collection.json`)
- ✅ **Hash-Based Processing**: All files organized by hash to prevent duplicates
- ✅ **Database Storage**: All metadata stored in MySQL (no JSON files)
- ✅ **FileTracker System**: Database-driven file discovery replaces slow directory scanning
- 🔄 **Future UI**: React app will be built later to consume these APIs

### Key Processing Components
- **FileTracker** (`services/api/util/file-tracker.ts`): Database-driven file discovery system with `file_index` table
- **CompreFace Integration** (`services/api/util/compreface.ts`): AI-powered face detection and recognition
- **Object Detection** (`services/api/util/object-detection.ts`): YOLO-based object detection using TensorFlow.js
- **EXIF Processing** (`services/api/util/exif.ts`): Extracts comprehensive image metadata with singleton pattern
- **Geolocation System** (`services/api/util/geolocation.ts`): GPS-based location matching with comprehensive city database
- **Image Analysis** (`services/api/util/image.ts`): Calculates dominant colors and handles image manipulation
- **Media Serving** (`services/api/routes/media.ts`): Serves processed images with thumbnail generation

### Data Organization
- Source photos: `/mnt/sg1/uploads/stephen/iphone/recents/`
- Processed photos: Hash-based structure in configured directory
- All metadata stored in MySQL database
- Extracted face images saved separately for training

### External Dependencies
- **CompreFace**: Self-hosted face recognition service (Docker)
- **MySQL**: Primary data storage
- **ExifTool**: Image metadata extraction
- **Sharp**: High-performance image processing

## FileTracker System

### Overview
The FileTracker system provides ultra-fast file discovery by maintaining a database-driven index of all source files, replacing slow directory traversal with instant database queries.

### Architecture
- **Database Table**: `file_index` - Tracks all source files with metadata and processing status
- **Core Module**: `services/api/util/file-tracker.ts` - FileTracker class with database operations
- **Integration**: Scanner uses FileTracker for instant file discovery instead of directory scanning

### Key Features
- **Instant Discovery**: Database query returns 8,358+ files immediately (vs. minutes of directory scanning)
- **Processing Status Tracking**: Files marked as pending/processing/completed/failed
- **Change Detection**: Files updated based on size/mtime changes
- **Performance Metrics**: Real-time statistics via `/scan/status` endpoint

### Database Schema (file_index table)
```sql
CREATE TABLE file_index (
  file_path VARCHAR(500) PRIMARY KEY,
  file_size BIGINT NOT NULL,
  file_mtime DATETIME NOT NULL,
  file_hash VARCHAR(64) NULL,
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  last_processed DATETIME NULL,
  retry_count INT DEFAULT 0,
  error_message TEXT NULL
);
```

### Usage Examples
```bash
# Check FileTracker statistics
curl http://localhost:9000/scan/status | jq .file_tracker

# Start scan using FileTracker discovery
curl "http://localhost:9000/scan?limit=10"
```

### Performance Impact
- **Before**: Directory scanning took 2+ minutes for large photo collections
- **After**: File discovery is instant (< 100ms) via database query
- **Scalability**: Handles 8,358+ files efficiently with proper indexing

## Geolocation System

### Overview
The Geolocation System provides intelligent location matching by linking photos with GPS coordinates to specific geographic locations using a comprehensive global database of countries, states, and cities.

### Architecture
- **Database Tables**: 
  - `geo_countries` - Complete list of world countries with ISO codes
  - `geo_states` - States/provinces linked to countries  
  - `geo_cities` - 50K+ cities worldwide with precise lat/lng coordinates
  - `image_geolocations` - Links images to specific cities with confidence scoring
- **Core Module**: `services/api/util/geolocation.ts` - Geolocation service with spatial queries
- **Integration**: Processing pipeline extracts GPS from EXIF and matches to nearest city

### Key Features
- **Spatial Matching**: Uses MySQL's ST_Distance_Sphere for accurate distance calculations
- **Smart Confidence Scoring**: Rates location matches based on distance and GPS accuracy
- **Global Coverage**: Comprehensive database with 50K+ cities, states, and countries
- **Multiple Detection Methods**: EXIF GPS, manual tagging, and reverse geocoding support

### Database Schema (geolocation tables)
```sql
-- Countries with ISO codes and phone codes
CREATE TABLE geo_countries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  country_code VARCHAR(2) NOT NULL,
  iso3 VARCHAR(3),
  country_name VARCHAR(100) NOT NULL,
  phone_code VARCHAR(20)
);

-- States/provinces linked to countries
CREATE TABLE geo_states (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  FOREIGN KEY (country_code) REFERENCES geo_countries(country_code)
);

-- Cities with precise GPS coordinates
CREATE TABLE geo_cities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  postal_code VARCHAR(20),
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state_code VARCHAR(10),
  county_name VARCHAR(100),
  timezone VARCHAR(50),
  INDEX idx_coordinates (latitude, longitude)
);

-- Image-location relationships with confidence scoring
CREATE TABLE image_geolocations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  image_id INT NOT NULL,
  city_id INT NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL,
  detection_method ENUM('EXIF_GPS', 'CLOSEST_MATCH', 'MANUAL') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES images(id),
  FOREIGN KEY (city_id) REFERENCES geo_cities(id)
);
```

### Core Functions
```typescript
// Find closest city within radius
getClosestCityIdByCoords(lat: number, lon: number, radiusMiles?: number)

// Link image to location with confidence
linkImageToLocation(imageId: number, cityId: number, method: string)

// Search images by location
searchImagesByLocation(cityId?: number, stateCode?: string, countryCode?: string)

// Get location hierarchy for image
getImageLocationHierarchy(imageId: number)
```

### Usage Examples
```bash
# Search photos within 50 miles of San Francisco
curl "http://localhost:9000/api/locations/search?lat=37.7749&lng=-122.4194&radius=50"

# Get all photos from California
curl "http://localhost:9000/api/locations/search?state=CA"

# Get location data for specific image
curl "http://localhost:9000/api/images/123/location"
```

### Performance Features
- **Spatial Indexing**: Optimized lat/lng indexes for sub-second location queries
- **Batch Processing**: Retroactive location assignment for existing photo collections
- **Caching**: Location hierarchy cached for fast repeated queries
- **Smart Fallbacks**: Graceful handling of missing GPS data or remote locations

## Album System

### Overview
The Album System provides comprehensive album management with support for Google Takeout imports and vendor-neutral organization.

### Database Schema (albums)
```sql
-- Main albums table with vendor-neutral naming
CREATE TABLE albums (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  source VARCHAR(50) DEFAULT 'manual', -- 'google_takeout', 'manual', 'smart'
  source_folder_path VARCHAR(500), -- Original source folder path (vendor-neutral)
  access_level VARCHAR(50), -- 'protected', 'public', etc.
  album_date TIMESTAMP, -- When album was created in source system
  cover_image_hash VARCHAR(64), -- Hash of cover image
  image_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Album-image relationships
CREATE TABLE album_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  album_id INT NOT NULL,
  image_id INT NOT NULL,
  sort_order INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (album_id) REFERENCES albums(id),
  FOREIGN KEY (image_id) REFERENCES images(id)
);
```

### Key Features
- **Vendor-Neutral**: Uses `source_folder_path` instead of vendor-specific naming
- **Slug Generation**: SEO-friendly URLs with automatic slug creation
- **Import Support**: Google Takeout integration with metadata preservation
- **Access Control**: Configurable access levels for album visibility

## Configuration System

### Priority Order
Runtime API > JSON Config File > Environment Variables > File-based Defaults

### Configuration Methods

1. **Environment Variables** (.env file):
```bash
# Database
MYSQL_HOST=localhost
MYSQL_PASSWORD=your_password

# Processing
OBJECT_DETECTION_MIN_CONFIDENCE=0.75
IMAGE_THUMBNAIL_SIZE=256

# Storage paths
MEDIA_PROCESSED_DIR=/external/photos/processed
MEDIA_LOGS_DIR=/external/photos/logs
```

2. **JSON Configuration** (config/settings.json):
```json
{
  "database": { "host": "localhost", "password": "secret" },
  "processing": { "objectDetection": { "minConfidence": 0.75 } }
}
```

### Key Configuration Files
- `config/defaults.json` - System defaults (no hardcoded values)
- `.env.example` - Complete template with all options
- `config/settings.json` - Optional JSON overrides

## Structured Logging System

### Log Files (Daily Rotation)
- **system-YYYY-MM-DD.log** - Server startup, configuration
- **api-YYYY-MM-DD.log** - HTTP requests/responses
- **processing-YYYY-MM-DD.log** - Detailed processing logs
- **processing-summary-YYYY-MM-DD.log** - Quick scannable summary
- **faces-YYYY-MM-DD.log** - Face detection/recognition events
- **error-YYYY-MM-DD.log** - All errors (consolidated)

### Log Analysis Examples
```bash
# Successfully processed images today
grep "success" /media/stephen/Expansion/photos/logs/processing-summary-$(date +%Y-%m-%d).log

# API requests over 1 second
jq 'select(.duration > 1000)' /media/stephen/Expansion/photos/logs/api-$(date +%Y-%m-%d).log
```

## Current State & Future Plans

### ✅ Completed Features
- **Face Recognition System**: Full person management, clustering, training APIs with mobile interface
- **Mobile App**: Complete React Native app with 4-tab navigation (Photos, Albums, Faces, Settings)
- **Album System**: Google Takeout integration with 40+ albums and metadata import
- **Faces Management**: Comprehensive CompreFace training interface with 100+ people and smart filtering
- **FileTracker System**: Database-driven file discovery for instant scanning (8,358+ files tracked)
- **Hash-Based Storage**: Prevents duplicates, efficient organization
- **API-Only Architecture**: Clean backend ready for future React frontend
- **Comprehensive Testing**: Jest framework with 93 passing tests
- **Structured Logging**: Multi-file system with JSON format

### 🚧 Next Priorities
1. **Geolocation System**: GPS-based photo location matching with comprehensive global city database
2. **Search & Discovery**: Advanced search with filters for objects, faces, dates, locations
3. **Smart Albums**: Auto-generated albums based on content and location
4. **Performance Optimization**: Batch processing improvements
5. **Scene Classification**: Detect scenes like "beach", "party", "nature"

## Project File Structure

### Route Modules (API Endpoints)
```
src/api/routes/
├── media.ts                    # Static media serving
├── scan.ts                     # Photo scanning endpoints
├── gallery.ts                  # Gallery viewing & management
├── search.ts                   # Object/metadata search
├── persons.ts                  # Person & face management (modularized)
├── geolocation.ts              # Location-based photo search and filtering
└── ...
```

### Utility Modules (Key Files)
```
src/api/util/
├── compreface.ts              # Face detection/recognition (313 lines)
├── config-manager.ts          # Configuration system (596 lines - needs refactoring)
├── structured-logger.ts       # Logging system (351 lines)
├── process-source.ts          # Processing pipeline (156 lines)
├── geolocation.ts             # GPS coordinate to location matching
└── ...
```

### Database Layer
```
src/api/models/
└── database.ts                # All models & repositories (701 lines - needs refactoring)
```

## Token Optimization Strategy

### File Size Guidelines
- **Green Zone** (< 200 lines): Optimal for frequent reading
- **Yellow Zone** (200-400 lines): Monitor for growth
- **Red Zone** (> 400 lines): Priority for refactoring

### Next Refactoring Targets
1. **database.ts** → Split into types + repositories/
2. **config-manager.ts** → Split into validation/loaders/utils

## Thunder Client Collection

The project includes a comprehensive Thunder Client collection that MUST be kept in sync with API changes.

### Collection Structure
- 🏠 Core System
- 📊 Scanning & Jobs
- 🖼️ Gallery & Media
- 🔍 Search
- 👥 Person Management
- 👤 Face Recognition
- 🧩 Face Clustering
- 🎓 Training Management

**Pattern**: After any API route changes, immediately update the Thunder Client collection.

## API Documentation

### Key Endpoints

#### POST /api/process/image
Process a single image by URL or file path with full AI analysis.

#### GET /api/persons
List all persons in the system with face counts.

#### POST /api/faces/{faceId}/assign
Assign a face to a person.

#### POST /api/compreface/train
Train CompreFace with assigned faces.

#### GET /api/albums
List all albums with metadata and image counts.

#### GET /api/albums/{albumId}
Get album details with associated images.

#### GET /api/albums/google-people
List albums with Google Photos people tags.

See Thunder Client collection for complete API documentation.

## Collaboration Style

- **Discuss before acting**: When issues or topics are raised, engage in discussion first rather than immediately jumping to solutions
- **No blind agreement**: Always verify claims and provide thoughtful responses rather than reflexive agreement
- **Wait for explicit requests**: Don't assume implicit requests for action - wait for clear instructions like "let's fix that" or "please update X"
- **Direct communication**: Use clear, factual responses without excessive validation phrases or deference
- **Collaborative problem-solving**: Work together to understand issues fully before implementing solutions

## Documentation Maintenance

**CRITICAL**: Always update README.md whenever we make changes to our platform
- When adding new features, update the "Current Features" section
- When changing architecture, update the structure diagram
- When adding new commands, update the "Development Commands" section
- When changing deployment process, update the "Quick Start" section
- When changing anything, ensure that we update the docs-site
- Always refer to the TODO.md
- Always maintain the TODO as our plan changes, things are added to the list or completed. Do this before and after addressing items in this list.

The README.md is the first thing users see and must always reflect the current state of the platform.

## Achievement Tracking

**IMPORTANT**: Maintain ACHIEVEMENTS.md to track completed work
- When completing items from TODO.md, move them to ACHIEVEMENTS.md with completion date and details
- Remove completed items from TODO.md to keep it focused on current/future work
- Include impact, performance metrics, and technical details in achievements
- Use ACHIEVEMENTS.md to demonstrate platform progress and capabilities
- Update achievement statistics regularly (files processed, performance improvements, etc.)
- Make frequent commits as you complete tasks

**Pattern**: TODO.md → ACHIEVEMENTS.md workflow keeps documentation clean and showcases progress

## Bug Tracking

**IMPORTANT**: Use BUGS.md to track all known issues and their resolution status
- Document new bugs immediately when discovered with description, error messages, and reproduction steps
- Mark bugs as fixed with date and solution when resolved
- Include priority levels (High/Medium/Low) for issue triage
- Track both open issues and recently fixed bugs for reference
- Consider moving long-fixed bugs to ACHIEVEMENTS.md after verification

**Pattern**: Track bugs systematically in BUGS.md to ensure nothing gets lost and fixes are documented

## Tooling Script Maintenance

**IMPORTANT**: Keep all tooling scripts updated for platform architecture
- **Development Scripts**: Update start-dev.sh, npm scripts, Docker commands
- **Cleanup Scripts**: Update database paths, API URLs, service endpoints in platform-tools/cleanup/
- **Maintenance Scripts**: Update import paths, service URLs in platform-tools/maintenance/
- **Database Scripts**: Update connection strings and paths in platform-tools/database/
- **Testing Scripts**: Update paths and service URLs in platform-tools/testing/

When changing:
- Service URLs (API, CompreFace, database ports)
- File paths (moving to services/, infrastructure/)
- Docker configuration
- Database schema or connection methods

Always check and update corresponding scripts in platform-tools/

**CRITICAL**
- read(TODO.md)
- read(ACHIEVEMENTS.md)