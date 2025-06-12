# Photo Processing System

A Node.js-based photo processing system that automatically extracts metadata, detects faces, and organizes photos from iPhone PhotoSync backups.

## Features

- **Automatic Photo Processing**: Processes photos from PhotoSync backup directories
- **Face Detection**: Uses CompreFace AI service for face detection and analysis
- **Metadata Extraction**: Extracts comprehensive EXIF data including location, camera settings, and dates
- **Dominant Color Analysis**: Calculates the dominant color of each image
- **Organized Output**: Creates structured directories with metadata JSON files and extracted face images

## Prerequisites

- Node.js (with TypeScript support)
- MySQL database
- CompreFace AI service (Docker-based)
- PhotoSync app configured to backup to your server

## Setup

### 1. Environment Configuration

Create a `.env` file in the project root:

```bash
# Database Configuration
mysql_host=0.0.0.0
mysql_root_password=your_password
mysql_db=photo-process
mysql_user=photo
mysql_pass=your_password
mysql_port=3307

# Photo Processing Paths
media_source_dir=/mnt/sg1/uploads/stephen/iphone
media_dest_dir=/mnt/hdd/photo-process/processed
```

### 2. Start Required Services

```bash
# Start MySQL database
./database.sh

# Start CompreFace AI service
docker compose -f services/CompreFace/docker-compose.yaml up -d
```

### 3. Database Setup

```bash
# Run database migrations
./migrate.sh

# (Optional) Run seeds
./seed.sh
```

### 4. Install Dependencies

```bash
npm install
```

## Running the Photo Processor

### Method 1: API Server

Start the Express API server:

```bash
./run.sh
```

Then trigger processing via HTTP:

```bash
# Start processing photos
curl http://localhost:9000/scan

# Check processing status
curl http://localhost:9000/scan/status
```

### Method 2: Direct Processing

Process photos directly without the API server:

```bash
# Compile TypeScript
tsc

# Run scanner directly
node -e "
import('./build/api/scanner/scan.js').then(({Start}) => {
  Start('/mnt/sg1/uploads/stephen/iphone', '/mnt/hdd/photo-process/processed')
    .then(result => console.log('Processed', result.length, 'batches'))
    .catch(err => console.error('Error:', err));
});
"
```

## Output Structure

The processor creates this organized structure:

```
processed/
├── recents/
│   ├── meta/
│   │   ├── photo1.jpg.json     # Metadata + face analysis
│   │   └── photo2.jpg.json
│   └── faces/
│       ├── photo1__face_0.jpg  # Extracted face images
│       ├── photo1__face_1.jpg
│       └── photo2__face_0.jpg
```

### Metadata JSON Structure

Each processed photo generates a JSON file containing:

- **EXIF data**: Camera settings, timestamps, GPS coordinates
- **Dominant color**: Hex color code of the image's dominant color
- **Face analysis**: For each detected face:
  - Age estimation (range)
  - Gender detection
  - Facial landmarks (coordinates)
  - Head pose (pitch, roll, yaw)
  - Bounding box coordinates

## Configuration

### Supported File Types

Currently supports:
- JPEG (.jpg, .JPG)
- PNG (.png, .PNG)

### Processing Limits

The scanner includes configurable limits:
- **Batch size**: 2 files processed simultaneously (configurable in `scan.ts`)
- **Test limit**: Currently limited to 4 files per directory (remove `limitedFiles` logic for full processing)

### CompreFace Settings

Face detection configured with:
- Detection threshold: 0.8
- Plugins: landmarks, gender, age, pose
- Maximum faces per image: 20

## Development

### Project Structure

```
src/
├── api/
│   ├── routes/          # Express route handlers
│   ├── scanner/         # Photo scanning and batch processing
│   └── util/           # Core processing utilities
│       ├── compreface.ts    # Face detection integration
│       ├── exif.ts          # EXIF metadata extraction
│       ├── image.ts         # Image processing with Sharp
│       └── process-source.ts # Main processing coordinator
```

### Key Components

- **Scanner** (`scanner/scan.ts`): Discovers and batches photos for processing
- **Process Source** (`util/process-source.ts`): Orchestrates all processing steps
- **CompreFace Integration** (`util/compreface.ts`): Handles AI face detection
- **EXIF Processor** (`util/exif.ts`): Extracts comprehensive image metadata
- **Image Processor** (`util/image.ts`): Calculates dominant colors and handles image operations

## Troubleshooting

### Common Issues

1. **CompreFace not responding**: Ensure the service is running on port 8000
2. **File permission errors**: Check that the process has read access to source directory and write access to destination
3. **Unsupported image format**: Some files may not be supported by Sharp library - these are skipped with error logging
4. **Database connection**: Verify MySQL is running and credentials in `.env` are correct

### Logs

The processor outputs detailed logs including:
- Files being processed
- Error messages for problematic files
- Processing progress and batch completion

## PhotoSync Integration

This system is designed to work with iPhone PhotoSync app:

1. Configure PhotoSync to upload to `/mnt/sg1/uploads/stephen/iphone/recents/`
2. The processor automatically discovers and processes new photos
3. Already processed photos are skipped on subsequent runs

## Future Enhancements

Potential improvements:
- File system watcher for real-time processing
- Web interface for browsing processed photos
- Database storage of metadata for searching
- Support for additional file formats
- Batch processing optimization
- Duplicate detection