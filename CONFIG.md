# Configuration Guide

This document explains how to configure the photo processing system settings.

## Configuration Methods

### 1. Environment Variables (Recommended)

You can adjust settings by setting environment variables in your `.env` file or system environment:

```bash
# Object Detection Settings
OBJECT_DETECTION_MIN_CONFIDENCE=0.75  # Minimum confidence threshold (0.0 - 1.0)

# CompreFace Face Detection Settings
COMPREFACE_URL=http://localhost:8000                   # CompreFace service URL
COMPREFACE_DETECT_API_KEY=your_detect_key              # Detection API key
COMPREFACE_RECOGNIZE_API_KEY=your_recognize_key        # Recognition API key
COMPREFACE_TIMEOUT_MS=10000                           # API timeout in milliseconds
COMPREFACE_DETECTION_THRESHOLD=0.8                    # Face detection confidence (0.0 - 1.0)
COMPREFACE_FACE_LIMIT=20                              # Max faces to detect per image
COMPREFACE_MAX_CONCURRENCY_RECOGNITION=5              # Max concurrent recognition requests
COMPREFACE_MAX_CONCURRENCY_TRAINING=3                 # Max concurrent training requests
COMPREFACE_BATCH_DELAY_MS=500                         # Delay between batch operations
COMPREFACE_TRAINING_DELAY_MS=1000                     # Delay after face training

# Processing Settings
SCAN_BATCH_SIZE=2                                     # Images processed concurrently
GALLERY_DEFAULT_PAGE_SIZE=50                          # Gallery pagination size
UNIDENTIFIED_FACES_DEFAULT_LIMIT=50                   # Unidentified faces shown per page

# Screenshot Detection Settings
SCREENSHOT_DETECTION_THRESHOLD=60                     # Screenshot detection confidence (0-100)

# Image Processing Settings  
IMAGE_THUMBNAIL_SIZE=256                              # Thumbnail size in pixels
JPEG_QUALITY=85                                       # JPEG compression quality (1-100)
IMAGE_CACHE_DURATION_DEFAULT=86400                    # Default image cache duration (seconds)
IMAGE_CACHE_DURATION_SOURCE=9999                     # Source image cache duration
IMAGE_CACHE_DURATION_PROCESSED=86400                 # Processed image cache duration

# Search Settings
SEARCH_DEFAULT_LIMIT=100                              # Default number of search results
```

### 2. Code Configuration

Advanced settings can be modified in `src/config.ts`. After making changes, recompile with `npx tsc`.

## Key Settings

### Object Detection

**Setting:** `OBJECT_DETECTION_MIN_CONFIDENCE`  
**Default:** `0.75`  
**Range:** `0.0` to `1.0`  

Controls the minimum confidence threshold for object detection. Higher values = more accurate but fewer detections.

- **0.5** - More detections, some false positives
- **0.75** - Balanced accuracy and detection rate (recommended)
- **0.9** - Very high accuracy, fewer detections

### CompreFace Configuration

**Face Detection Threshold:** `COMPREFACE_DETECTION_THRESHOLD=0.8`  
Controls how confident CompreFace must be to detect a face (0.0 - 1.0).

**API Timeout:** `COMPREFACE_TIMEOUT_MS=10000`  
Maximum time to wait for CompreFace API responses (milliseconds).

**Concurrency Limits:**  
- `COMPREFACE_MAX_CONCURRENCY_RECOGNITION=5` - Simultaneous face recognition requests
- `COMPREFACE_MAX_CONCURRENCY_TRAINING=3` - Simultaneous training requests

**Batch Delays:**  
- `COMPREFACE_BATCH_DELAY_MS=500` - Pause between batch operations  
- `COMPREFACE_TRAINING_DELAY_MS=1000` - Pause after training faces

### Processing Performance

**Scan Batch Size:** `SCAN_BATCH_SIZE=2`  
Number of images processed simultaneously. Higher values = faster processing but more memory usage.

**Gallery Page Size:** `GALLERY_DEFAULT_PAGE_SIZE=50`  
Number of photos shown per page in gallery.

### Screenshot Detection

**Detection Threshold:** `SCREENSHOT_DETECTION_THRESHOLD=60`  
Confidence level (0-100) required to classify an image as a screenshot.

- **40-50** - Catches more screenshots, some false positives
- **60** - Balanced detection (recommended)  
- **80** - Very conservative, may miss some screenshots

### Image Processing

**Thumbnail Size:** `IMAGE_THUMBNAIL_SIZE=256`  
Controls the size of generated thumbnail images.

**JPEG Quality:** `JPEG_QUALITY=85`  
Compression quality for processed images (1-100, higher = better quality).

**Cache Durations:**  
- `IMAGE_CACHE_DURATION_DEFAULT=86400` - Standard cache (24 hours)
- `IMAGE_CACHE_DURATION_SOURCE=9999` - Source images (long cache)
- `IMAGE_CACHE_DURATION_PROCESSED=86400` - Processed images (24 hours)

## Applying Configuration Changes

### For Environment Variables:
1. Edit your `.env` file
2. Restart the application
3. Changes apply immediately to new processing

### For Code Changes:
1. Edit `src/config.ts`
2. Run `npx tsc` to compile
3. Restart the application

## Testing Configuration

Test object detection confidence by running:

```bash
# Check current status
node retroactive-process.js --status

# Process with current confidence setting
node retroactive-process.js --feature=object_detection --limit=5
```

## Common Adjustments

### Too Many False Positives
Increase confidence thresholds:
```bash
OBJECT_DETECTION_MIN_CONFIDENCE=0.85
COMPREFACE_DETECTION_THRESHOLD=0.9
SCREENSHOT_DETECTION_THRESHOLD=80
```

### Missing Valid Objects/Faces
Decrease confidence thresholds:
```bash
OBJECT_DETECTION_MIN_CONFIDENCE=0.65
COMPREFACE_DETECTION_THRESHOLD=0.6
SCREENSHOT_DETECTION_THRESHOLD=40
```

### Performance Optimization

**For Faster Processing:**
```bash
SCAN_BATCH_SIZE=4                           # Process more images concurrently
COMPREFACE_MAX_CONCURRENCY_RECOGNITION=8    # More concurrent face recognition
COMPREFACE_BATCH_DELAY_MS=200              # Shorter delays
```

**For Lower Resource Usage:**
```bash
SCAN_BATCH_SIZE=1                           # Process one image at a time
COMPREFACE_MAX_CONCURRENCY_RECOGNITION=2    # Fewer concurrent requests
COMPREFACE_BATCH_DELAY_MS=1000             # Longer delays
```

### Storage Optimization
Reduce thumbnail size and JPEG quality:
```bash
IMAGE_THUMBNAIL_SIZE=128
JPEG_QUALITY=75
IMAGE_CACHE_DURATION_DEFAULT=3600           # Shorter cache (1 hour)
```

### CompreFace Timeout Issues
If CompreFace is slow or timing out:
```bash
COMPREFACE_TIMEOUT_MS=30000                 # Increase to 30 seconds
COMPREFACE_MAX_CONCURRENCY_RECOGNITION=2    # Reduce concurrent load
```

### Gallery Performance
For large photo collections:
```bash
GALLERY_DEFAULT_PAGE_SIZE=25                # Smaller pages load faster
IMAGE_CACHE_DURATION_PROCESSED=172800      # Cache for 48 hours
```