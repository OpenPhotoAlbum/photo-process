---
sidebar_position: 1
---

# Photo Management

Learn how to manage your photo collection with the Photo Management Platform.

## 📸 Adding Photos to Your Collection

### Automatic Scanning

The platform automatically scans your configured source directory for new photos:

```bash
# Trigger a manual scan
curl -X POST http://localhost:9000/api/scan

# Check scan status
curl http://localhost:9000/api/scan/status
```

:::tip Automatic Processing
When photos are scanned, the platform automatically:
- **Extracts metadata** (date, location, camera info)
- **Generates thumbnails** for fast viewing
- **Detects faces** for person identification
- **Identifies objects** for smart search
- **Creates hash-based storage** to prevent duplicates
:::

### Supported Formats

The platform supports these image and video formats:

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="images" label="📷 Images" default>
    - **JPEG** (.jpg, .jpeg)
    - **PNG** (.png)
    - **WebP** (.webp)
    - **TIFF** (.tiff, .tif)
    - **BMP** (.bmp)
  </TabItem>
  <TabItem value="videos" label="🎥 Videos">
    - **MP4** (.mp4)
    - **MOV** (.mov)
    - **AVI** (.avi)
    - **MKV** (.mkv)
  </TabItem>
  <TabItem value="raw" label="📸 RAW">
    - **Canon** (.cr2, .cr3)
    - **Nikon** (.nef)
    - **Sony** (.arw)
    - **Adobe** (.dng)
  </TabItem>
</Tabs>

## 🔍 Browsing Your Collection

### Gallery View

Access your photos through the API:

```bash
# Get recent photos
curl http://localhost:9000/api/gallery?limit=50

# Get photos by date range
curl "http://localhost:9000/api/gallery?startDate=2024-01-01&endDate=2024-12-31"

# Get photos by person
curl http://localhost:9000/api/persons/123/photos
```

### Search Capabilities

The platform offers powerful search features:

<Tabs>
  <TabItem value="objects" label="🏷️ Object Search" default>
    ```bash
    # Find photos containing specific objects
    curl "http://localhost:9000/api/search/objects?query=cat"
    curl "http://localhost:9000/api/search/objects?query=beach"
    curl "http://localhost:9000/api/search/objects?query=car"
    ```
  </TabItem>
  <TabItem value="faces" label="👥 Face Search">
    ```bash
    # Search by person
    curl http://localhost:9000/api/persons/search?name=John

    # Get unidentified faces
    curl http://localhost:9000/api/persons/unidentified
    ```
  </TabItem>
  <TabItem value="metadata" label="📊 Metadata Search">
    ```bash
    # Search by camera model
    curl "http://localhost:9000/api/search?camera=iPhone"

    # Search by location
    curl "http://localhost:9000/api/search?location=Paris"
    ```
  </TabItem>
</Tabs>

## 🤖 AI-Powered Features

### Face Recognition

The platform automatically detects and groups faces:

:::info How Face Recognition Works
1. **Detection**: CompreFace AI detects faces in photos
2. **Grouping**: Similar faces are clustered together
3. **Identification**: You can assign names to face clusters
4. **Learning**: The system learns from your assignments
:::

**Managing Faces:**

```bash
# Get all detected persons
curl http://localhost:9000/api/persons

# Assign a face to a person
curl -X POST http://localhost:9000/api/faces/123/assign \
  -H "Content-Type: application/json" \
  -d '{"personId": 456}'

# Train the recognition model
curl -X POST http://localhost:9000/api/compreface/train
```

### Object Detection

Automatically identifies objects in your photos:

```bash
# Get detected objects for a photo
curl http://localhost:9000/api/photos/123/objects

# Search for photos with specific objects
curl "http://localhost:9000/api/search/objects?query=dog&confidence=0.8"
```

**Common Detected Objects:**
- Animals (dog, cat, bird, horse)
- Vehicles (car, bicycle, motorcycle, truck)
- Nature (tree, flower, mountain, beach)
- People activities (sports, dining, travel)
- Indoor objects (furniture, electronics, food)

### Smart Albums

The platform creates intelligent photo collections:

```bash
# Get available smart albums
curl http://localhost:9000/api/smart-albums

# Get photos in a smart album
curl http://localhost:9000/api/smart-albums/123/photos
```

**Types of Smart Albums:**
- **Person Albums** - Collections for each identified person
- **Object Albums** - Photos grouped by common objects
- **Time-based Albums** - Events, trips, seasons
- **Location Albums** - Photos from specific locations

## 📱 Mobile and Screenshots

### Screenshot Detection

The platform automatically identifies screenshots:

:::tip Screenshot Benefits
Screenshots are:
- Automatically categorized separately
- Excluded from certain smart albums
- Easily filtered in search results
- Useful for organizing digital content vs. real photos
:::

```bash
# Get all screenshots
curl http://localhost:9000/api/photos?type=screenshot

# Exclude screenshots from search
curl "http://localhost:9000/api/search?excludeScreenshots=true"
```

### Mobile Photo Processing

Special handling for mobile photos:

- **Live Photos** - Processes both image and video components
- **Portrait Mode** - Recognizes depth-effect photos  
- **Burst Photos** - Groups related burst sequences
- **HEIC Format** - Converts Apple's HEIC to standard formats

## 🎯 Best Practices

:::tip Organization Tips
1. **Use descriptive folder names** in your source directory
2. **Regularly train face recognition** as you tag people
3. **Keep originals safe** - the platform preserves your source files
4. **Use search filters** to find specific content quickly
5. **Review unidentified faces** periodically for better recognition
:::

### Photo Organization Workflow

1. **Import** - Add photos to your source directory
2. **Scan** - Let the platform process new content
3. **Review** - Check detected faces and objects
4. **Tag** - Assign names to people and correct any mistakes
5. **Train** - Update the AI model with your corrections
6. **Enjoy** - Use smart search and albums to rediscover memories

## 🛠️ Maintenance

### Regular Tasks

```bash
# Check processing status
curl http://localhost:9000/api/scan/status

# View processing statistics
curl http://localhost:9000/api/stats

# Clean up low-confidence detections
npm run cleanup:low-confidence
```

### Backup Your Collection

:::warning Important
Always maintain backups of your photo collection:
- **Source photos** - Your original files
- **Database** - Contains all metadata and face assignments
- **Configuration** - Your platform settings
:::

```bash
# Backup database
npm run db:backup

# Check processed files
ls -la /path/to/processed/photos
```