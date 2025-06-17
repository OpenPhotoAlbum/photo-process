---
sidebar_position: 3
---

# Gallery API

Browse and manage your photo collection with pagination, filtering, and metadata access.

## Gallery Endpoints

### `GET /api/gallery`
**Description**: Get paginated gallery of processed images  

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `sort` (string): Sort field (`date_taken`, `filename`)
- `order` (string): Sort order (`asc`, `desc`)

**Example Request**:
```bash
# Get first page with default settings
curl http://localhost:9000/api/gallery

# Get specific page with custom sort
curl "http://localhost:9000/api/gallery?page=2&limit=50&sort=date_taken&order=desc"
```

**Response**:
```json
{
  "images": [
    {
      "id": 1,
      "filename": "IMG_001.jpg",
      "date_taken": "2023-01-01T12:00:00Z",
      "faces_count": 2,
      "objects_count": 5,
      "thumbnail_url": "/media/2023/01/IMG_001.jpg?thumbnail=true",
      "media_url": "/media/2023/01/IMG_001.jpg"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### `GET /api/gallery/:id/faces`
**Description**: Get faces detected in a specific image  

**Path Parameters**:
- `id` (number): Image ID

**Example Request**:
```bash
curl http://localhost:9000/api/gallery/123/faces
```

**Response**:
```json
{
  "image": {
    "id": 123,
    "filename": "IMG_001.jpg",
    "date_taken": "2023-01-01T12:00:00Z",
    "media_url": "/media/2023/01/IMG_001.jpg"
  },
  "faces": [
    {
      "id": 1,
      "x_min": 100,
      "y_min": 150,
      "x_max": 200,
      "y_max": 250,
      "person_id": 5,
      "person_name": "John Doe",
      "confidence": 0.95,
      "face_url": "/processed/faces/face_001.jpg"
    }
  ],
  "total_faces": 1
}
```

## Scan Operations

### `GET /scan/status`
**Description**: Get current scan status  

**Response**:
```json
{
  "status": "idle|scanning",
  "progress": {
    "current": 0,
    "total": 0,
    "percentage": 0
  },
  "last_scan": "2023-01-01T12:00:00Z",
  "estimated_completion": "2023-01-01T12:30:00Z"
}
```

### `GET /scan`
**Description**: Start photo scanning process  

:::warning Background Operation
Scanning is a long-running background process. Use `/scan/status` to monitor progress.
:::

**Response**:
```json
{
  "message": "Scan started",
  "status": "scanning",
  "scan_id": "scan_001"
}
```

## Gallery Features

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="browsing" label="📖 Browsing" default>
    - **Pagination** - Efficient browsing of large collections
    - **Sorting** - Sort by date, filename, or other metadata
    - **Thumbnails** - Fast preview generation
    - **Metadata** - Access to EXIF and processing data
  </TabItem>
  <TabItem value="filtering" label="🔍 Filtering">
    - **Date Ranges** - Filter by when photos were taken
    - **Face Counts** - Find photos with/without faces
    - **Object Counts** - Filter by detected objects
    - **File Types** - Filter by image format
  </TabItem>
  <TabItem value="performance" label="⚡ Performance">
    - **Lazy Loading** - Only load visible images
    - **Thumbnail Caching** - Fast subsequent loads
    - **Database Indexing** - Optimized queries
    - **Batch Processing** - Efficient data retrieval
  </TabItem>
</Tabs>

## Common Use Cases

### Recent Photos
```bash
# Get latest 20 photos
curl "http://localhost:9000/api/gallery?sort=date_taken&order=desc&limit=20"
```

### Photos with People
```bash
# This would typically be combined with search API
# See Search API documentation for advanced filtering
```

### Browse by Date
```bash
# Oldest first
curl "http://localhost:9000/api/gallery?sort=date_taken&order=asc"
```

## Error Responses

### Invalid Page Number
```json
{
  "error": "Invalid page number",
  "code": "VALIDATION_ERROR",
  "details": {
    "page": "Must be a positive integer"
  }
}
```

### Invalid Sort Field
```json
{
  "error": "Invalid sort field",
  "code": "VALIDATION_ERROR",
  "details": {
    "sort": "Must be one of: date_taken, filename, created_at"
  }
}
```

## Performance Tips

:::tip Pagination Best Practices
- Use reasonable page sizes (20-50 items)
- Cache results when possible
- Use sorting to improve user experience
- Consider infinite scroll for modern UIs
:::

### Optimal Parameters
- **Small galleries** (&lt;1000 photos): `limit=50`
- **Large galleries** (&gt;10000 photos): `limit=20`
- **Mobile devices**: `limit=20` with thumbnail loading
- **Desktop applications**: `limit=50` with preloading