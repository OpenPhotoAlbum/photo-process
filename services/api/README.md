# Photo Management Platform API

The backend API service for the photo management platform.

## Overview

This service provides:
- RESTful API for photo management
- Face detection and recognition 
- Object detection and search
- Smart album generation
- Background job processing
- Person management and clustering

## Quick Start

### Development
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server
npm run dev

# Start with file watching
npm run dev:watch
```

### Docker
```bash
# Build container
docker build -t photo-platform-api .

# Run container
docker run -p 9000:9000 photo-platform-api
```

### Via Platform
```bash
# From platform root
npm run dev:api

# Or start full platform
npm run dev
```

## Configuration

The API service uses environment variables for configuration:

### Database
- `MYSQL_HOST` - Database host (default: localhost)
- `MYSQL_PORT` - Database port (default: 3308)
- `MYSQL_USER` - Database user (default: photo_user)  
- `MYSQL_PASSWORD` - Database password
- `MYSQL_DATABASE` - Database name (default: photo_process)

### Storage
- `MEDIA_SOURCE_DIR` - Source photos directory
- `MEDIA_PROCESSED_DIR` - Processed photos directory
- `MEDIA_LOGS_DIR` - Log files directory

### CompreFace
- `COMPREFACE_BASE_URL` - CompreFace API URL (default: http://compreface-ui:80)
- `COMPREFACE_API_KEY` - CompreFace API key

### Processing
- `OBJECT_DETECTION_MIN_CONFIDENCE` - Object detection threshold (default: 0.75)
- `IMAGE_THUMBNAIL_SIZE` - Thumbnail size in pixels (default: 256)

## API Endpoints

### Core
- `GET /` - API status and endpoints
- `GET /api/health` - Health check for Docker

### Gallery & Media
- `GET /api/gallery` - List processed images
- `GET /media/*` - Serve media files with thumbnail support

### Person Management
- `GET /api/persons` - List all persons
- `POST /api/persons` - Create new person
- `PUT /api/persons/:id` - Update person
- `DELETE /api/persons/:id` - Delete person

### Face Recognition
- `POST /api/faces/assign` - Assign face to person
- `GET /api/faces/unidentified` - Get unidentified faces
- `POST /api/faces/auto-recognize` - Auto-recognize faces
- `POST /api/clustering/start` - Start face clustering

### Search
- `GET /api/search/objects` - Search by detected objects
- `GET /api/search/advanced` - Advanced search with filters

### Processing
- `POST /api/process/image` - Process single image
- `GET /scan` - Start directory scan
- `GET /scan/status` - Scan status

### Background Jobs
- `GET /api/jobs` - List background jobs
- `POST /api/jobs/scan` - Start scan job
- `POST /api/jobs/face-recognition` - Start face recognition job

See Thunder Client collection for complete API documentation.

## Architecture

### Key Components
- **Express.js** - Web framework
- **Knex.js** - Database query builder
- **Sharp** - Image processing
- **TensorFlow.js** - Object detection
- **CompreFace** - Face recognition
- **Winston** - Structured logging

### Database
- Uses MySQL with Knex migrations
- All metadata stored in database (no JSON files)
- Hash-based file organization prevents duplicates

### Processing Pipeline
1. Image scan/upload
2. EXIF extraction  
3. Face detection (CompreFace)
4. Object detection (YOLO/COCO-SSD)
5. Metadata storage in database
6. Hash-based file organization

## Development

### Project Structure
```
src/
├── index.ts           # Express app setup
├── config.ts          # Configuration management
├── routes/            # API route handlers  
├── models/            # Database models & types
├── util/              # Utility modules
├── middleware/        # Express middleware
├── jobs/              # Background job definitions
└── scanner/           # Directory scanning logic
```

### Key Utilities
- `config-manager.ts` - Enhanced configuration system
- `structured-logger.ts` - Multi-file logging
- `process-source.ts` - Main image processing pipeline
- `face-clustering.ts` - Face clustering algorithms
- `object-detection.ts` - YOLO object detection
- `compreface.ts` - CompreFace integration

### Testing
```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Lint code
npm run lint
```

## Integration

### Platform Integration
- Uses platform database configuration (`../../infrastructure/database/knexfile.platform.js`)
- Connects to platform infrastructure services (database, CompreFace)
- Integrates with platform Docker Compose orchestration

### External Services
- **Database**: Platform MySQL database on port 3308
- **CompreFace**: Face recognition service on port 8001 (development)
- **File Storage**: Hash-based storage in configured directories

## Migration Notes

This service was migrated from the monolithic structure to the platform architecture:
- Database configuration updated to use platform infrastructure
- All imports fixed for new directory structure  
- Docker integration added for containerized deployment
- Health checks added for orchestration

Original functionality preserved while gaining:
- Better separation of concerns
- Platform integration
- Containerization support
- Independent scaling capability