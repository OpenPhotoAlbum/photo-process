# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Run
- `./run.sh` - Compile TypeScript and run the API server
- `tsc` - Compile TypeScript to build/ directory
- `node build/index.js` - Run compiled application directly

### Photo Processing
- `curl http://localhost:9000/scan` - Start photo processing via API
- `curl http://localhost:9000/scan/status` - Check processing status
- Process photos directly: `node -e "import('./build/api/scanner/scan.js').then(({Start}) => Start('/source/path', '/dest/path'))"`

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
- **EXIF Processing** (`src/api/util/exif.ts`): Extracts comprehensive image metadata using ExifTool
- **Image Analysis** (`src/api/util/image.ts`): Calculates dominant colors and handles image manipulation with Sharp
- **Media Serving** (`src/api/routes/media.ts`): Serves processed images with optional thumbnail generation

### Data Organization
- Source images processed from `source/` directory
- Metadata stored as JSON files in `meta/` subdirectories
- Extracted face images saved in `faces/` subdirectories
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
- CompreFace custom builds available in `services/CompreFace/custom-builds/`
- TypeScript compiled to CommonJS modules in `build/` directory