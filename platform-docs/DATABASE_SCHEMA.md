# Database Schema Documentation

## Overview

This database schema is designed to store and efficiently query processed photo metadata, face detection results, and enable advanced search capabilities for your photo processing system.

## Database Tables

### 1. `file_index` - File Discovery System
**NEW:** Database-driven file tracking system that replaces slow directory scanning with instant database queries.

**Key Fields:**
- `file_path` - Full path to source file (PRIMARY KEY)
- `file_size` - File size in bytes
- `file_mtime` - File modification time
- `file_hash` - SHA-256 hash (populated after processing)
- `discovered_at` - When file was first discovered
- `processing_status` - Status: pending/processing/completed/failed
- `last_processed` - Last processing attempt timestamp
- `retry_count` - Number of processing retries
- `error_message` - Last error message if processing failed

**Performance Benefits:**
- **Instant Discovery**: 8,358+ files found in <100ms vs. minutes of directory scanning
- **Status Tracking**: Real-time processing progress monitoring
- **Scalability**: Handles large photo collections efficiently

**Usage:**
```bash
# Check FileTracker statistics
curl http://localhost:9000/scan/status | jq .file_tracker

# Start scan using FileTracker discovery
curl "http://localhost:9000/scan?limit=10"
```

### 2. `images` - Core Image Records
Primary table storing basic image information and processing status.

**Key Fields:**
- `id` - Primary key
- `filename` - Original filename  
- `original_path` - Full path to original image file
- `processed_path` - Path to processed metadata JSON
- `file_hash` - SHA-256 hash for deduplication
- `file_size`, `width`, `height` - Basic file properties
- `dominant_color` - Hex color extracted from image
- `processing_status` - Current processing state (pending/processing/completed/failed)
- `date_taken` - When photo was captured (from EXIF)
- `date_processed` - When processing completed

### 2. `image_metadata` - EXIF and Technical Data
Stores comprehensive EXIF metadata and camera information.

**Categories:**
- **Camera Info**: make, model, software, lens
- **Technical Settings**: focal length, aperture, shutter speed, ISO, flash
- **Location Data**: GPS coordinates, city, state, country
- **Other**: orientation, color space, raw EXIF JSON

### 3. `detected_faces` - Face Detection Results
Stores AI-detected faces with demographics and positioning.

**Face Data:**
- Bounding box coordinates (x_min, y_min, x_max, y_max)
- Detection confidence score
- Predicted demographics (gender, age range) with confidence
- Face pose (pitch, roll, yaw)
- Facial landmarks JSON
- Face embedding for similarity matching
- Optional person identification

### 4. `persons` - People Identification
Enables face recognition and person tagging.

**Person Records:**
- Name and notes
- Representative face image
- Average face embedding for matching
- Face count statistics

### 5. `image_tags` - Categorization
Flexible tagging system for manual or AI-generated labels.

**Tag Types:**
- Manual tags (user-added)
- Auto tags (rule-based)
- AI tags (machine learning generated)

### 6. `processing_jobs` - Job Queue
Tracks processing tasks and their status.

## Database Operations

### Setup and Migration

1. **Run Schema Migration:**
   ```bash
   npx knex migrate:latest
   ```

2. **Migrate Existing Data:**
   ```bash
   # Full migration (schema + data)
   ./migrate-data.js
   
   # Schema only
   ./migrate-data.js --schema-only
   
   # Data only (if schema already exists)
   ./migrate-data.js --data-only
   ```

### Using the Database API

The database includes TypeScript models and repositories for common operations:

```typescript
import { ImageRepository, FaceRepository, DatabaseUtils } from './models/database';

// Get processed images with pagination
const images = await ImageRepository.getProcessedImages(50, 0);

// Search images with filters
const searchResults = await ImageRepository.searchImages({
    dateFrom: new Date('2023-01-01'),
    camera: 'iPhone',
    hasFaces: true
});

// Get complete image data
const imageData = await DatabaseUtils.getImageWithAllData(imageId);

// Get dashboard statistics
const stats = await DatabaseUtils.getDashboardStats();
```

## Advanced Search Capabilities

The schema enables sophisticated photo searches:

### By Date Range
```sql
SELECT * FROM images 
WHERE date_taken BETWEEN '2023-01-01' AND '2023-12-31'
```

### By Location
```sql
SELECT i.*, m.city, m.state 
FROM images i
JOIN image_metadata m ON i.id = m.image_id
WHERE m.city LIKE '%Paris%'
```

### By Camera Equipment
```sql
SELECT i.*, m.camera_make, m.camera_model
FROM images i
JOIN image_metadata m ON i.id = m.image_id  
WHERE m.camera_make = 'Apple'
```

### Photos with People
```sql
SELECT i.*, COUNT(f.id) as face_count
FROM images i
LEFT JOIN detected_faces f ON i.id = f.image_id
GROUP BY i.id
HAVING face_count > 0
```

### Find Specific Person
```sql
SELECT i.*, p.name
FROM images i
JOIN detected_faces f ON i.id = f.image_id
JOIN persons p ON f.person_id = p.id
WHERE p.name = 'John Doe'
```

## API Endpoints

New database-powered API endpoints:

- `GET /api/v2/images` - Paginated image list
- `GET /api/v2/images/:id` - Detailed image data
- `GET /api/v2/search` - Advanced image search
- `GET /api/v2/stats` - Dashboard statistics
- `GET /api/v2/persons` - People directory
- `GET /api/v2/faces/unidentified` - Faces needing identification
- `POST /api/v2/faces/:id/assign` - Assign person to face

## Performance Considerations

### Indexes
The schema includes strategic indexes for common queries:
- File hash (deduplication)
- Processing status
- Date taken (chronological browsing)
- GPS coordinates (location searches)
- Camera make/model
- Person assignments

### Optimization Tips
1. **Batch Processing**: Process images in batches to reduce database overhead
2. **Pagination**: Always use LIMIT/OFFSET for large result sets
3. **Selective Joins**: Only join tables when needed
4. **Face Embeddings**: Use for similarity matching and duplicate detection

## Data Migration Details

The migration script (`migrate-data.js`) processes existing JSON metadata files and:

1. **Deduplicates Images**: Uses SHA-256 file hashes to prevent duplicates
2. **Extracts EXIF Data**: Parses comprehensive metadata into structured fields
3. **Processes Face Data**: Converts CompreFace results to database records
4. **Handles Errors**: Logs failures and continues processing other files

## Future Enhancements

The schema supports future features:

- **Face Recognition**: Person identification using embeddings
- **AI Tagging**: Automatic content classification
- **Duplicate Detection**: Hash-based and visual similarity
- **Batch Operations**: Bulk editing and organization
- **Advanced Analytics**: Photo statistics and insights

## Backup and Maintenance

Regular maintenance recommendations:

1. **Backup Strategy**: Regular database dumps and file system backups
2. **Index Optimization**: Monitor query performance and add indexes as needed
3. **Data Cleanup**: Periodic removal of orphaned face images
4. **Statistics Updates**: Refresh face counts and other derived data

This schema provides a solid foundation for a comprehensive photo management system with advanced search, face recognition, and organizational capabilities.