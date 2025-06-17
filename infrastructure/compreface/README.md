# CompreFace Infrastructure

CompreFace is the AI-powered face detection and recognition service used by the photo management platform.

## Architecture

- **compreface-postgres** - PostgreSQL database for CompreFace data
- **compreface-admin** - Admin service for managing applications and API keys
- **compreface-api** - Main API service for face operations
- **compreface-core** - Core ML processing service
- **compreface-ui** - Web interface (accessible at http://localhost:8000)

## Configuration

The service is configured via environment variables in `.env`. Key settings:

- `postgres_*` - Database connection settings
- `max_file_size` - Maximum upload file size (default: 5MB)
- `save_images_to_db` - Whether to store face images in database
- `uwsgi_processes` - Number of worker processes for ML service

## Custom Builds

The `custom-builds/` directory contains alternative CompreFace configurations:

- **FaceNet** - High accuracy face recognition model
- **Mobilenet** - Lightweight model for CPU usage
- **Mobilenet-gpu** - GPU-accelerated lightweight model  
- **SubCenter-ArcFace-r100** - Enterprise-grade accuracy
- **Single-Docker-File** - All-in-one container build

## Usage

### Via Platform Docker Compose
```bash
# Start all CompreFace services
docker-compose up compreface-postgres compreface-admin compreface-api compreface-core compreface-ui

# Or start the entire platform
docker-compose up
```

### Standalone Usage
```bash
# Use the original docker-compose for standalone operation
docker-compose -f docker-compose.yaml up
```

### API Access

Once running, CompreFace API is available at:
- **API Base URL**: http://localhost:8000/api/v1
- **Admin UI**: http://localhost:8000

## Integration

The platform API service connects to CompreFace via:
- **Internal URL**: http://compreface-ui:80/api/v1 (container network)
- **External URL**: http://localhost:8000/api/v1 (development)