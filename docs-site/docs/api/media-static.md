---
sidebar_position: 2
---

# Media & Static Routes

Core endpoints for serving static files, media content, and basic application routes.

## Root Routes

### `GET /`
**Description**: Root endpoint with basic application information  
**Response**: Application status and version info

```bash
curl http://localhost:9000/
```

### `GET /api/health`
**Description**: Health check endpoint for monitoring  
**Response**: API health status

```bash
curl http://localhost:9000/api/health
```

## Static File Serving

### `GET /static/*`
**Description**: Serve static frontend files  
**Path**: `/static/{filename}`

Used for serving frontend assets when the React app is built.

```bash
# Example: Serve CSS file
curl http://localhost:9000/static/css/main.css
```

## Media File Serving

### `GET /media/*`
**Description**: Serve media files with thumbnail support  
**Path**: `/media/{path}`

**Query Parameters**:
- `thumbnail` (boolean): Generate thumbnail if true
- `size` (number): Thumbnail size in pixels (default: 256)

**Examples**:

```bash
# Serve original image
curl http://localhost:9000/media/2023/01/IMG_001.jpg

# Serve thumbnail
curl "http://localhost:9000/media/2023/01/IMG_001.jpg?thumbnail=true"

# Serve custom size thumbnail
curl "http://localhost:9000/media/2023/01/IMG_001.jpg?thumbnail=true&size=512"
```

### `GET /processed/*`
**Description**: Serve processed images statically  
**Path**: `/processed/{path}`

Used for serving AI-processed images, face crops, and metadata files.

```bash
# Example: Serve extracted face image
curl http://localhost:9000/processed/faces/person_1_face_001.jpg
```

## Response Examples

### Root Endpoint Response
```json
{
  "name": "Photo Management Platform",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2025-06-17T12:00:00Z"
}
```

### Health Check Response
```json
{
  "status": "healthy",
  "database": "connected",
  "compreface": "available",
  "version": "1.0.0",
  "uptime": 3600
}
```

## Cache Headers

Media files are served with appropriate cache headers:

- **Source Images**: Long cache duration (cache-control: max-age=9999)
- **Processed Images**: Standard cache duration (cache-control: max-age=86400)
- **Thumbnails**: Standard cache duration with ETag support

## Image Format Support

The media server supports common image formats:

- **JPEG** (.jpg, .jpeg) - Most common, good compression
- **PNG** (.png) - Lossless, good for screenshots  
- **WebP** (.webp) - Modern format, excellent compression
- **HEIC** (.heic) - iPhone photos (converted to JPEG for serving)

:::tip Thumbnail Performance
Thumbnails are generated on-demand and cached for subsequent requests. First access may be slower while the thumbnail is generated.
:::

## Error Responses

### File Not Found
```json
{
  "error": "File not found",
  "code": "NOT_FOUND",
  "path": "/media/invalid/path.jpg"
}
```

### Unsupported Format
```json
{
  "error": "Unsupported image format",
  "code": "UNSUPPORTED_FORMAT",
  "supportedFormats": ["jpg", "jpeg", "png", "webp", "heic"]
}
```