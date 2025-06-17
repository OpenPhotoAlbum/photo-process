---
sidebar_position: 4
---

# Search API

Powerful search capabilities for finding photos by objects, metadata, and AI-detected content.

## Object Search

### `GET /api/search/objects`
**Description**: Search images by detected objects  

**Query Parameters**:
- `objects` (string): Comma-separated object names
- `limit` (number): Maximum results (default: 50)
- `confidence` (number): Minimum confidence threshold (0.0-1.0)
- `operator` (string): Search operator (`AND`, `OR`) - default: `OR`

**Example Requests**:
```bash
# Find photos with cars
curl "http://localhost:9000/api/search/objects?objects=car"

# Find photos with both persons and cars (AND operation)
curl "http://localhost:9000/api/search/objects?objects=person,car&operator=AND"

# High-confidence detections only
curl "http://localhost:9000/api/search/objects?objects=cat&confidence=0.8"
```

**Response**:
```json
{
  "images": [
    {
      "id": 1,
      "filename": "IMG_001.jpg",
      "date_taken": "2023-01-01T12:00:00Z",
      "objects": ["person", "car", "tree"],
      "confidence_scores": [0.95, 0.87, 0.92],
      "media_url": "/media/2023/01/IMG_001.jpg",
      "thumbnail_url": "/media/2023/01/IMG_001.jpg?thumbnail=true"
    }
  ],
  "total": 25,
  "query": {
    "objects": ["person", "car"],
    "operator": "OR",
    "confidence": 0.5
  }
}
```

## Advanced Search

### `GET /api/search/advanced`
**Description**: Advanced search with multiple criteria  

**Query Parameters**:
- `objects` (string): Object names (comma-separated)
- `persons` (string): Person IDs (comma-separated)
- `date_from` (string): Start date (ISO format)
- `date_to` (string): End date (ISO format)
- `has_faces` (boolean): Images with/without faces
- `has_objects` (boolean): Images with/without objects
- `camera` (string): Camera make/model
- `limit` (number): Maximum results (default: 100)

**Example Requests**:
```bash
# Photos with specific person in date range
curl "http://localhost:9000/api/search/advanced?persons=5&date_from=2023-01-01&date_to=2023-12-31"

# iPhone photos with faces
curl "http://localhost:9000/api/search/advanced?camera=iPhone&has_faces=true"

# Recent photos without faces (candid shots)
curl "http://localhost:9000/api/search/advanced?date_from=2023-06-01&has_faces=false"
```

**Response**:
```json
{
  "images": [
    {
      "id": 1,
      "filename": "IMG_001.jpg",
      "date_taken": "2023-06-15T14:30:00Z",
      "persons": [
        {
          "id": 5,
          "name": "John Doe"
        }
      ],
      "objects": ["person", "beach", "ocean"],
      "camera": {
        "make": "Apple",
        "model": "iPhone 13"
      },
      "location": {
        "city": "Santa Monica",
        "state": "California"
      }
    }
  ],
  "total": 15,
  "filters_applied": {
    "persons": [5],
    "date_range": ["2023-01-01", "2023-12-31"],
    "has_faces": true
  }
}
```

## Object Statistics

### `GET /api/objects/stats`
**Description**: Get object detection statistics  

**Response**:
```json
{
  "total_objects": 1500,
  "unique_objects": 45,
  "top_objects": [
    {
      "name": "person",
      "count": 300,
      "percentage": 20.0
    },
    {
      "name": "car",
      "count": 150,
      "percentage": 10.0
    },
    {
      "name": "tree",
      "count": 120,
      "percentage": 8.0
    }
  ],
  "categories": {
    "people": 300,
    "vehicles": 200,
    "nature": 250,
    "objects": 400,
    "animals": 100
  }
}
```

## Search Features

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="objects" label="🎯 Object Detection" default>
    **Supported Objects:**
    - **People & Body Parts** - person, face, hand
    - **Vehicles** - car, truck, bicycle, motorcycle, boat
    - **Animals** - cat, dog, bird, horse
    - **Nature** - tree, flower, beach, mountain
    - **Food** - apple, banana, cake, pizza
    - **Technology** - phone, laptop, tv, camera
  </TabItem>
  <TabItem value="metadata" label="📋 Metadata Search">
    **Search by:**
    - **Date & Time** - When photos were taken
    - **Camera Info** - Make, model, settings
    - **Location** - GPS coordinates, city, state
    - **File Properties** - Size, format, resolution
    - **Processing Status** - Completed, failed, pending
  </TabItem>
  <TabItem value="ai" label="🤖 AI-Powered">
    **Intelligent Features:**
    - **Confidence Scoring** - Filter by detection accuracy
    - **Facial Recognition** - Find specific people
    - **Scene Analysis** - Indoor/outdoor, lighting
    - **Content Categorization** - Automatic tagging
  </TabItem>
</Tabs>

## Common Search Patterns

### Family Photos
```bash
# Find family gatherings (multiple people)
curl "http://localhost:9000/api/search/objects?objects=person&confidence=0.8"
```

### Vacation Photos
```bash
# Beach/travel photos
curl "http://localhost:9000/api/search/objects?objects=beach,ocean,mountain"
```

### Pet Photos
```bash
# Find your pets
curl "http://localhost:9000/api/search/objects?objects=cat,dog"
```

### Recent Activity
```bash
# Last month's photos with faces
curl "http://localhost:9000/api/search/advanced?date_from=2023-11-01&has_faces=true"
```

## Performance Optimization

:::tip Search Performance
- Use specific object names for faster results
- Combine multiple filters to narrow searches
- Set reasonable confidence thresholds (0.7-0.9)
- Use pagination for large result sets
:::

### Indexing Strategy
The search system uses optimized database indexes:
- **Object names** - Full-text search index
- **Date ranges** - Temporal index for fast date queries
- **Person assignments** - Foreign key indexes
- **Confidence scores** - Range indexes for filtering

## Error Responses

### Invalid Object Name
```json
{
  "error": "Unknown object type",
  "code": "VALIDATION_ERROR",
  "details": {
    "objects": ["invalidobject"],
    "supported_objects": ["person", "car", "tree", "..."]
  }
}
```

### Invalid Date Format
```json
{
  "error": "Invalid date format",
  "code": "VALIDATION_ERROR",
  "details": {
    "date_from": "Must be in ISO format (YYYY-MM-DD)"
  }
}
```

### Search Timeout
```json
{
  "error": "Search query timeout",
  "code": "TIMEOUT_ERROR",
  "details": {
    "suggestion": "Try narrowing your search criteria"
  }
}
```