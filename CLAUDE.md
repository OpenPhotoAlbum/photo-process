# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Run
- `tsc` - Compile TypeScript to build/ directory

#### Server Management (IMPORTANT - Use this pattern to avoid recurring startup issues)
```bash
# 1. Kill any existing server processes
pkill -f "node.*build/index.js" 2>/dev/null || true

# 2. Start server in background with persistence  
nohup node build/index.js > server-debug.log 2>&1 & echo "Server PID: $!"

# 3. Verify server is responding (wait 3 seconds for startup)
sleep 3 && curl -s http://localhost:9000/api/persons/unidentified?limit=1 > /dev/null && echo "✅ Server responding" || echo "❌ Server not responding"
```

#### Alternative Methods (avoid for development)
- `./run.sh` - Legacy script that blocks terminal and times out
- `node build/index.js` - Run directly in foreground (for debugging only)

### Photo Processing
- `curl http://localhost:9000/scan` - Start photo processing via API
- `curl http://localhost:9000/scan/status` - Check processing status
- Process photos directly: `node -e "import('./build/api/scanner/scan.js').then(({Start}) => Start('/source/path', '/dest/path'))"`

### Maintenance & Migration Tools
- `npm run maintenance:migrate-features` - Check migration status for all features
- `npm run maintenance:retroactive` - Add missing features to existing photos
- `npm run maintenance:fix-dates` - Fix date issues in processed images
- `npm run maintenance:update-objects` - Update object detection data
- `npm run maintenance:import-faces` - Import face data
- `npm run maintenance:import-missing` - Import missing data
- `npm run maintenance:check-missing` - Check for missing files

### Cleanup Tools
- `npm run cleanup:menu` - Interactive cleanup menu
- `npm run cleanup:compreface` - Clean CompreFace data
- `npm run cleanup:fresh-start` - Complete system reset
- `npm run cleanup:local-data` - Clean local processing data
- `npm run cleanup:low-confidence` - Remove low confidence detections

### Testing & Development
- `npm run test:full-processing` - Test complete processing pipeline
- `npm run test:object-detection` - Test object detection
- `npm run test:single-file` - Test single file processing

**Note**: Direct script access available in `tools/` subdirectories if needed

**Pattern**: Whenever we add new processing features, always create retroactive scripts to update existing images.

### Database Management
- `npm run db:start` - Start MySQL database using Docker Compose
- `npm run db:migrate` - Run Knex migrations (creates media table)
- `npm run db:seed` - Run database seeds
- `npm run db:create-migration` - Create new Knex migration
- `npm run db:create-seed` - Create new Knex seed

**Note**: Direct script access available at `tools/database/` if needed

### Services
- `docker compose -f services/CompreFace/docker-compose.yaml up -d` - Start CompreFace AI service
- `docker compose -f services/database/docker-compose.yaml up -d` - Start MySQL database

## Architecture Overview

### Core Application Flow
This is a photo processing service that processes iPhone PhotoSync backups with AI-powered analysis:

1. **Entry Point**: `src/index.ts` → `src/api/index.ts` - Express.js API server
2. **Scanner**: `src/api/scanner/scan.ts` - Batch processes directories of images from PhotoSync backup
3. **Processing Pipeline**: `src/api/util/process-source.ts` - Orchestrates all analysis steps
4. **Output**: Creates organized directory structure with JSON metadata files and extracted face images

### Photo Processing Workflow
1. **PhotoSync App** → Automatic iPhone backup to `/mnt/sg1/uploads/stephen/iphone/recents/`
2. **Scanner** → Discovers new unprocessed photos in backup directory
3. **Processing** → Extracts EXIF + Face detection + Dominant color analysis
4. **Output** → Saves to `/mnt/hdd/photo-process/processed/` with organized folder structure

### Key Processing Components

- **CompreFace Integration** (`src/api/util/compreface.ts`): AI-powered face detection using local CompreFace service (localhost:8000)
- **Object Detection** (`src/api/util/object-detection.ts`): YOLO-based object detection using TensorFlow.js and COCO-SSD model
- **Search API** (`src/api/routes/search.ts`): Object-based image search with autocomplete suggestions and filtering
- **EXIF Processing** (`src/api/util/exif.ts`): Extracts comprehensive image metadata using ExifTool
- **Image Analysis** (`src/api/util/image.ts`): Calculates dominant colors and handles image manipulation with Sharp
- **Media Serving** (`src/api/routes/media.ts`): Serves processed images with optional thumbnail generation

### Data Organization
- Source images processed from `source/` directory
- Metadata stored as JSON files in `meta/` subdirectories (includes EXIF, face detection, object detection)
- Extracted face images saved in `faces/` subdirectories
- Database stores structured data for efficient searching (images, faces, objects, metadata)
- Maintains original directory structure in destination

### Database Setup
- Uses MySQL with Knex.js for query building and migrations
- Connection configured via `.env` file (mysql_host, mysql_port, mysql_user, mysql_pass, mysql_db)
- Simple media table tracks processed files

### External Dependencies
- **CompreFace**: Self-hosted face recognition service (requires Docker)
- **ExifTool**: Image metadata extraction (vendored package)
- **Sharp**: High-performance image processing
- **MySQL**: Database for tracking processed media

### Configuration System

**Enhanced Multi-Layer Configuration** (Phase 2 Complete):
- **Priority Order**: Runtime API > JSON Config File > Environment Variables > File-based Defaults
- **No Hardcoded Defaults**: All defaults in `config/defaults.json` for easy discovery
- **Validation**: Startup validation with helpful error messages
- **Backward Compatibility**: Legacy variables (mysql_host, etc.) still supported
- **Admin Ready**: Future admin panel API endpoints prepared

#### Configuration Methods

1. **Environment Variables** (.env file):
```bash
# New standardized format
MYSQL_HOST=localhost
MYSQL_PASSWORD=your_password
MEDIA_SOURCE_DIR=/path/to/photos
OBJECT_DETECTION_MIN_CONFIDENCE=0.75
```

2. **JSON Configuration** (config/settings.json):
```json
{
  "database": { "host": "localhost", "password": "secret" },
  "processing": { "objectDetection": { "minConfidence": 0.75 } }
}
```

3. **Runtime Updates** (future admin panel):
```bash
# Will be available via API when admin panel is implemented
PUT /api/admin/config
```

#### Configuration Commands

- `npm run config:status` - Show current configuration summary
- `npm run config:migrate` - Migrate legacy .env variables to new format

### Logging Commands

- `npm run logs:processing` - Monitor photo processing logs (summary format)
- `npm run logs:api` - Monitor API request/response logs
- `npm run logs:errors` - Monitor error logs from all sources
- `npm run logs:faces` - Monitor face detection/recognition logs
- `npm run logs:system` - Monitor system startup and configuration logs
- `npm run logs:all` - Monitor all log files simultaneously

### Structured Logging System

**Multi-File Logging** (Phase 3 Complete):
- **Separate log streams**: Different files for different concerns (processing, API, faces, errors)
- **JSON format**: Structured, searchable logs for production analysis
- **Daily rotation**: Automatic compression and cleanup with configurable retention
- **Request correlation**: Every API request gets a unique ID for tracing

#### Log Files

1. **system-YYYY-MM-DD.log** - Server startup, configuration, infrastructure events
2. **api-YYYY-MM-DD.log** - HTTP requests/responses with performance metrics
3. **processing-YYYY-MM-DD.log** - Detailed image processing pipeline logs
4. **processing-summary-YYYY-MM-DD.log** - Quick scannable summary of processed images
5. **faces-YYYY-MM-DD.log** - Face detection and recognition events
6. **faces-review-YYYY-MM-DD.log** - Faces needing manual review
7. **error-YYYY-MM-DD.log** - All errors from any source (consolidated)
8. **performance-YYYY-MM-DD.log** - Performance metrics and timing data
9. **audit-YYYY-MM-DD.log** - Security-sensitive events (future)

#### Log Analysis Examples

```bash
# See all successfully processed images today
grep "success" /media/stephen/Expansion/photos/logs/processing-summary-$(date +%Y-%m-%d).log

# Find API requests that took longer than 1 second
jq 'select(.duration > 1000)' /media/stephen/Expansion/photos/logs/api-$(date +%Y-%m-%d).log

# Monitor face recognition events in real-time
tail -f /media/stephen/Expansion/photos/logs/faces-$(date +%Y-%m-%d).log | jq

# Check for any errors in the last hour
jq 'select(.timestamp > (now - 3600))' /media/stephen/Expansion/photos/logs/error-$(date +%Y-%m-%d).log
```

#### Configuration Files

- `.env.example` - Complete template with all available options  
- `config/defaults.json` - **System defaults** (no hardcoded values in source code)
- `config/settings.example.json` - JSON configuration template
- `config/settings.json` - Optional custom JSON configuration (overrides .env)
- `config/README.md` - Complete configuration documentation
- Legacy variables still supported: `mysql_host`, `mysql_pass`, `media_source_dir`, etc.

### Configuration Examples
```bash
# Object detection settings
OBJECT_DETECTION_MIN_CONFIDENCE=0.85   # Higher = more accurate, fewer detections
OBJECT_DETECTION_BATCH_SIZE=4          # Process more images in parallel
OBJECT_DETECTION_IMAGE_WIDTH=640       # AI model input size
OBJECT_DETECTION_IMAGE_HEIGHT=640

# Image processing settings  
IMAGE_THUMBNAIL_SIZE=256               # Thumbnail size in pixels
IMAGE_JPEG_QUALITY=85                 # JPEG compression quality (1-100)
IMAGE_CACHE_TIMEOUT=86400             # Cache timeout in seconds

# Storage paths (external drive support)
MEDIA_PROCESSED_DIR=/external/photos/processed
MEDIA_THUMBNAIL_DIR=/external/photos/thumbnails
MEDIA_CACHE_DIR=/external/photos/cache
MEDIA_LOGS_DIR=/external/photos/logs
```

## Current Development Plans

### IMPORTANT: UI Strategy Context
**The current web UI is temporary** and only meant for API interaction and CompreFace training. The user plans to **remove this UI entirely** and create a new React app in the future. Therefore:

- ✅ **Focus on:** Robust backend APIs and data models
- ✅ **Build:** Clean APIs that the future React app can consume  
- 🔄 **Minimal:** Basic UI updates just for testing/training CompreFace
- ❌ **Skip:** Complex UI features that will be replaced

### Next Priority: Face Recognition Enhancement (Backend Focus)

**Phase A: Core Recognition Engine**
- **Person Identification**: Build backend APIs to identify who faces belong to
- **Face Clustering**: Algorithm to group similar faces for easier person assignment
- **Training Management**: APIs to manage CompreFace training data and confidence scoring
- **Person Management**: CRUD APIs for person entities and face associations

**Phase B: Advanced Recognition Features**  
- **Auto-Assignment**: Smart face-to-person matching based on confidence thresholds
- **Review Workflows**: APIs for faces that need manual review/confirmation
- **Batch Operations**: Bulk face assignment and training operations
- **Analytics**: Recognition accuracy tracking and improvement suggestions

**Phase C: Integration & Polish**
- **Retroactive Processing**: Apply recognition to existing photo collections
- **Performance Optimization**: Efficient batch processing and caching
- **Data Consistency**: Ensure face data stays synchronized across systems

### Backend API Design Goals
- Clean, RESTful endpoints ready for React app consumption
- Comprehensive person and face management
- Flexible confidence threshold handling
- Efficient bulk operations for large photo collections
- Strong data validation and error handling

## Future Development Roadmap

### 1. Face Recognition Enhancement (IN PROGRESS - Backend Focus)
- **Person Identification**: Backend APIs to identify who faces belong to 
- **Face Clustering**: Group similar faces together to help identify recurring people
- **Manual Face Tagging**: APIs for manual face-to-person assignment (React UI will consume these)

### 2. Search & Discovery Features
- **Advanced Search Interface**: Build a more sophisticated web UI with filters for date, location, camera, objects, and faces
- **Smart Albums**: Automatically create albums based on detected content (e.g., "Beach Photos", "Family Gatherings")
- **Similar Photo Detection**: Find duplicate or very similar photos using image hashing

### 3. Content Analysis Expansion
- **Scene Classification**: Detect scenes like "beach", "indoor", "party", "nature"
- **Activity Recognition**: Identify activities like "cooking", "sports", "reading"
- **Text Detection (OCR)**: Extract text from images (signs, documents, etc.)
- **Emotion Detection**: Analyze facial expressions in detected faces

### 4. Performance & Scalability
- **Batch Processing Optimization**: Process multiple images in parallel
- **Progressive Loading**: Stream results as they're processed
- **Caching System**: Cache frequently accessed thumbnails and metadata

### 5. User Interface Improvements
- **Mobile-Responsive Gallery**: Better mobile experience for browsing photos
- **Keyboard Shortcuts**: Quick navigation and search shortcuts
- **Export Features**: Export search results, create shareable albums

### 6. Automation & Intelligence
- **Smart Notifications**: Alert when interesting photos are processed
- **Auto-Tagging**: Suggest tags based on detected content
- **Memory Creation**: Automatically create "memories" from photos taken on the same day in previous years

### 7. Data Storage Architecture Analysis
**Critical Architecture Questions** requiring research and analysis:

- **Metadata Storage Strategy**: What are the benefits/drawbacks of storing metadata as JSON files vs. purely in the database?
  - JSON files: Easy debugging, portable, can survive DB crashes, natural backup with photos
  - Database only: Better querying, indexing, relationships, atomic updates, consistency
  - Hybrid approach: Best of both worlds but adds complexity
  
- **Thumbnail Generation Strategy**: Should thumbnails be pre-generated and stored, or generated on-demand with caching?
  - Pre-generated: Faster response times, predictable storage usage, consistent quality
  - On-demand + cache: Less storage usage, flexible sizing, cache invalidation complexity
  - Performance implications for 10k+ photos, storage requirements, and cache hit rates

- **Analysis**: Need to benchmark both approaches with realistic data volumes and access patterns
- **Decision factors**: Storage costs, response times, system complexity, backup/restore procedures

**Reminder**: Always make sure the server is running when you are finished

## Project Reorganization Plan

### Current Issues
The project has grown organically and suffers from organizational issues that impact maintainability and professionalism:

1. **Root Directory Chaos**: 25+ files scattered in root (scripts, logs, configs, data)
2. **Data Storage Strategy**: Processed photos (potentially GBs) mixed with source code 
3. **Script Proliferation**: 15+ utility scripts with no clear organization
4. **Configuration Scattered**: Multiple config approaches across files
5. **Runtime vs Development**: No clear separation of concerns

### Proposed Directory Structure
```
/mnt/hdd/photo-process/
├── README.md                    # Main project documentation
├── package.json                 
├── tsconfig.json
├── .env                         # Environment config only
├── 
├── src/                         # Application source code
├── build/                       # Compiled TypeScript
├── 
├── tools/                       # Development & maintenance tools
│   ├── database/
│   │   ├── migrate.sh
│   │   ├── seed.sh
│   │   └── create-*.sh
│   ├── cleanup/
│   │   └── cleanup-*.js
│   ├── maintenance/
│   │   ├── fix-dates.js
│   │   ├── migrate-*.js
│   │   └── retroactive-process.js
│   └── testing/
│       └── test-*.js
├── 
├── config/                      # All configuration
│   ├── knexfile.js
│   ├── database.js
│   └── docker/
│       └── docker-compose.*.yml
├── 
├── database/                    # Schema & migrations
│   ├── migrations/
│   └── seeds/
├── 
├── public/                      # Web interface
└── docs/                        # All documentation
    ├── SETUP.md
    ├── API.md
    └── DEPLOYMENT.md
```

### External Data Strategy
**Move data outside project directory**:
```
/var/lib/photo-process/          # or /mnt/data/photo-process/
├── source/                      # Input photos
├── processed/                   # Processed outputs  
├── thumbnails/                  # Generated thumbnails
├── cache/                       # Temporary processing files
└── logs/                        # All application logs
    ├── app.log
    ├── scan.log
    └── error.log
```

### Implementation Phases

**Phase 1 (High Impact, Low Risk)**:
1. Move all scripts to `tools/` directory
2. Move logs to external `logs/` directory 
3. Organize documentation in `docs/`
4. Add npm scripts for common operations

**Phase 2 (Medium Impact, Medium Risk)**:
1. Move processed data to external location
2. Consolidate configuration system
3. Enhance Docker Compose setup
4. Add comprehensive .env.example

**Phase 3 (High Impact, Higher Risk)**:
1. Implement structured logging
2. Add configuration validation
3. Create deployment scripts
4. Add automated testing workflow

### Key Benefits
- **Professionalism**: Clean, standard project structure
- **Maintainability**: Clear separation of concerns
- **Scalability**: Easy to add new features without clutter
- **Team Collaboration**: Standard structure any developer can understand
- **Deployment**: Clear separation of code vs. data for production