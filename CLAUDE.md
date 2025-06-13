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

### Feature Migrations (for new processing features)
- `node migrate-features.js --status` - Check migration status for all features
- `node migrate-features.js --feature=object_detection` - Run specific feature migration
- `node migrate-features.js --force` - Force re-migration of all existing images

### Retroactive Processing (for adding new features to existing photos)
- `node retroactive-process.js --feature=object_detection --limit=50` - Add object detection to 50 existing photos
- `node retroactive-process.js --feature=all --limit=25` - Add all missing features to 25 photos
- `node retroactive-process.js --status` - Check what features are missing from existing photos

**Pattern**: Whenever we add new processing features, always create retroactive scripts to update existing images.

### Database Management
- `./database.sh` - Start MySQL database using Docker Compose
- `./migrate.sh` - Run Knex migrations (creates media table)
- `./seed.sh` - Run database seeds
- `./create-migration.sh` - Create new Knex migration
- `./create-seed.sh` - Create new Knex seed

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

### Configuration
- Environment variables loaded from `/mnt/hdd/photo-process/.env`
- Global configuration system in `src/config.ts` manages all application settings
- Key settings can be adjusted via environment variables (see `CONFIG.md`)
- Object detection confidence threshold: `OBJECT_DETECTION_MIN_CONFIDENCE=0.75`
- CompreFace custom builds available in `services/CompreFace/custom-builds/`
- TypeScript compiled to CommonJS modules in `build/` directory

### Configuration Examples
```bash
# Adjust object detection sensitivity (0.0-1.0)
OBJECT_DETECTION_MIN_CONFIDENCE=0.85   # Higher = more accurate, fewer detections
OBJECT_DETECTION_MIN_CONFIDENCE=0.65   # Lower = more detections, some false positives

# Image processing settings
IMAGE_THUMBNAIL_SIZE=256               # Thumbnail size in pixels
JPEG_QUALITY=85                       # JPEG compression quality (1-100)
```

## Future Development Roadmap

### 1. Face Recognition Enhancement
- **Person Identification**: Currently we detect faces but don't identify who they are. Could implement face recognition to automatically tag people in photos
- **Face Clustering**: Group similar faces together to help identify recurring people
- **Manual Face Tagging**: UI for users to manually tag faces with names

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

**Reminder**: Always make sure the server is running when you are finished