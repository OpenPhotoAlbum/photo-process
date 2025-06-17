# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Vision

**See `VISION.md` in the project root for the complete product vision and user experience goals.**

This vision should guide all feature decisions, design choices, and technical priorities. The core goal is digital independence with smart organization - breaking free from Big Tech photo storage while building intelligent personal photo management.

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

**Pattern**: Whenever we add new processing features, always create retroactive scripts to update existing images.

## Architecture Overview

### Core Application Flow
This is a photo processing service that processes iPhone PhotoSync backups with AI-powered analysis:

1. **Entry Point**: `src/index.ts` → `src/api/index.ts` - Express.js API server
2. **Scanner**: `src/api/scanner/scan.ts` - Batch processes directories of images
3. **Processing Pipeline**: `src/api/util/process-source.ts` - Orchestrates all analysis steps
4. **Output**: Stores all data in MySQL database with hash-based file organization

### Current Architecture (API-Only Mode)
- ✅ **API-Only**: Clean backend APIs with no frontend dependencies
- ✅ **Thunder Client Testing**: Comprehensive collection for API testing (`thunder-client-collection.json`)
- ✅ **Hash-Based Processing**: All files organized by hash to prevent duplicates
- ✅ **Database Storage**: All metadata stored in MySQL (no JSON files)
- 🔄 **Future UI**: React app will be built later to consume these APIs

### Key Processing Components
- **CompreFace Integration** (`src/api/util/compreface.ts`): AI-powered face detection and recognition
- **Object Detection** (`src/api/util/object-detection.ts`): YOLO-based object detection using TensorFlow.js
- **EXIF Processing** (`src/api/util/exif.ts`): Extracts comprehensive image metadata
- **Image Analysis** (`src/api/util/image.ts`): Calculates dominant colors and handles image manipulation
- **Media Serving** (`src/api/routes/media.ts`): Serves processed images with thumbnail generation

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
- **Face Recognition System**: Full person management, clustering, training APIs
- **Hash-Based Storage**: Prevents duplicates, efficient organization
- **API-Only Architecture**: Clean backend ready for future React frontend
- **Comprehensive Testing**: Jest framework with 93 passing tests
- **Structured Logging**: Multi-file system with JSON format

### 🚧 Next Priorities
1. **Search & Discovery**: Advanced search with filters for objects, faces, dates
2. **Smart Albums**: Auto-generated albums based on content
3. **Performance Optimization**: Batch processing improvements
4. **Scene Classification**: Detect scenes like "beach", "party", "nature"

## Project File Structure

### Route Modules (API Endpoints)
```
src/api/routes/
├── media.ts                    # Static media serving
├── scan.ts                     # Photo scanning endpoints
├── gallery.ts                  # Gallery viewing & management
├── search.ts                   # Object/metadata search
├── persons.ts                  # Person & face management (modularized)
└── ...
```

### Utility Modules (Key Files)
```
src/api/util/
├── compreface.ts              # Face detection/recognition (313 lines)
├── config-manager.ts          # Configuration system (596 lines - needs refactoring)
├── structured-logger.ts       # Logging system (351 lines)
├── process-source.ts          # Processing pipeline (156 lines)
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

The README.md is the first thing users see and must always reflect the current state of the platform.

**Reminder**: Always make sure the server is running when you are finished