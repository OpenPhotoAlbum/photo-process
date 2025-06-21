---
sidebar_position: 6
---

# Face Recognition

Advanced face detection, recognition, and assignment capabilities powered by AI.

## Face Assignment

### `POST /api/faces/assign`
**Description**: Assign single face to person

**Request Body**:
```json
{
  "faceId": 123,
  "personId": 5
}
```

**Response**:
```json
{
  "success": true,
  "message": "Face assigned to person successfully",
  "person": {
    "id": 5,
    "name": "John Doe",
    "face_count": 26
  }
}
```

### `POST /api/faces/batch-assign`
**Description**: Assign multiple faces to person efficiently

**Request Body**:
```json
{
  "faceIds": [123, 124, 125],
  "personId": 5
}
```

**Response**:
```json
{
  "person": {
    "id": 5,
    "name": "John Doe",
    "face_count": 28
  },
  "message": "Batch assignment completed: 3 successful, 0 failed",
  "successCount": 3,
  "errorCount": 0
}
```

### `POST /api/faces/bulk-assign`
**Description**: Bulk assign with validation and detailed results

**Request Body**:
```json
{
  "faceIds": [1, 2, 3, 4, 5],
  "personId": 5,
  "confidence": 0.95,
  "method": "manual_bulk"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Assigned 5 faces to John Doe",
  "results": [
    {"faceId": 1, "success": true},
    {"faceId": 2, "success": true}
  ],
  "person": {
    "id": 5,
    "name": "John Doe",
    "face_count": 30
  }
}
```

## Face Discovery

### `GET /api/faces/unidentified`
**Description**: Get unidentified faces for manual assignment

**Query Parameters**:
- `limit` (number): Maximum results (default: 50)
- `random` (boolean): Random selection vs. chronological
- `gender` (string): Filter by detected gender
- `ageMin`, `ageMax` (number): Age range filter
- `minConfidence` (number): Minimum detection confidence

**Example Requests**:
```bash
# Get 20 random unidentified faces
curl "http://localhost:9000/api/faces/unidentified?limit=20&random=true"

# Get high-confidence adult faces
curl "http://localhost:9000/api/faces/unidentified?minConfidence=0.9&ageMin=18"
```

**Response**:
```json
{
  "faces": [
    {
      "id": 1,
      "face_image_path": "/processed/faces/unknown_1.jpg",
      "detection_confidence": 0.95,
      "gender": "male",
      "age": 25,
      "face_url": "/processed/faces/unknown_1.jpg",
      "image": {
        "id": 100,
        "filename": "IMG_001.jpg",
        "date_taken": "2023-01-01T12:00:00Z",
        "media_url": "/media/2023/01/IMG_001.jpg"
      }
    }
  ],
  "count": 10,
  "totalCount": 150,
  "filters": {
    "random": true,
    "minConfidence": 0.8
  }
}
```

## Automatic Recognition

### `POST /api/faces/auto-recognize`
**Description**: Run batch auto-recognition on unidentified faces

**Query Parameters**:
- `limit` (number): Maximum faces to process (default: 50)
- `minConfidence` (number): Minimum confidence for auto-assignment (default: 0.9)

**Example Request**:
```bash
curl -X POST "http://localhost:9000/api/faces/auto-recognize?limit=100&minConfidence=0.85"
```

**Response**:
```json
{
  "recognized": 15,
  "processed": 50,
  "needsConfirmation": 5,
  "trainedPeople": 10,
  "results": [
    {
      "faceId": 1,
      "personId": 5,
      "personName": "John Doe",
      "confidence": 0.92,
      "action": "auto_assigned"
    }
  ],
  "confirmationNeeded": [
    {
      "faceId": 2,
      "personId": 3,
      "personName": "Jane Smith",
      "confidence": 0.78,
      "action": "needs_confirmation"
    }
  ],
  "message": "Auto-recognition completed: 15 auto-assigned, 5 need confirmation from 50 processed"
}
```

## Face Management

### `DELETE /api/faces/:faceId/person`
**Description**: Remove face from person assignment

**Path Parameters**:
- `faceId` (number): Face ID

**Response**:
```json
{
  "message": "Face removed from person successfully"
}
```

### `DELETE /api/faces/:faceId`
**Description**: Completely delete face detection (removes record and physical file)

**Path Parameters**:
- `faceId` (number): Face ID

**Response**:
```json
{
  "success": true,
  "message": "Face deleted successfully",
  "deletedFaceId": 123
}
```

:::warning Complete Deletion
This permanently removes the face detection from the database and deletes the physical face crop file. This action cannot be undone. Use with caution.
:::

### `POST /api/faces/:faceId/mark-invalid`
**Description**: Mark face as invalid (not actually a face)

**Path Parameters**:
- `faceId` (number): Face ID

**Response**:
```json
{
  "message": "Face marked as invalid successfully"
}
```

### `POST /api/faces/:faceId/mark-unknown`
**Description**: Mark face as unknown person (background person)

**Path Parameters**:
- `faceId` (number): Face ID

**Response**:
```json
{
  "message": "Face marked as unknown successfully"
}
```

## Face Review System

### `GET /api/faces/needs-review`
**Description**: Get faces that need manual review

**Query Parameters**:
- `limit` (number): Maximum results (default: 50)

**Response**:
```json
{
  "faces": [
    {
      "id": 1,
      "person_confidence": 0.75,
      "needs_review": true,
      "person": {
        "id": 5,
        "name": "John Doe"
      },
      "image": {
        "id": 100,
        "filename": "IMG_001.jpg",
        "date_taken": "2023-01-01T12:00:00Z"
      }
    }
  ],
  "count": 5
}
```

### `POST /api/faces/:faceId/review`
**Description**: Approve or reject face assignment

**Path Parameters**:
- `faceId` (number): Face ID

**Request Body**:
```json
{
  "approved": true,
  "personId": 5
}
```

**Response**:
```json
{
  "message": "Face assignment approved",
  "face": {
    "id": 1,
    "person_id": 5,
    "needs_review": false
  }
}
```

## Advanced Face Operations

### `GET /api/faces/:faceId/similar`
**Description**: Get similar faces for clustering assistance

**Path Parameters**:
- `faceId` (number): Face ID

**Query Parameters**:
- `threshold` (number): Similarity threshold (default: 0.8)
- `limit` (number): Maximum results (default: 20)

**Response**:
```json
{
  "baseFace": {
    "id": 1,
    "face_image_path": "/processed/faces/face_1.jpg"
  },
  "similarFaces": [
    {
      "id": 2,
      "similarity_score": 0.92,
      "face_image_path": "/processed/faces/face_2.jpg",
      "image": {
        "id": 101,
        "filename": "IMG_002.jpg"
      }
    }
  ],
  "threshold": 0.8
}
```

### `PUT /api/faces/:faceId/reassign`
**Description**: Reassign face from one person to another

**Path Parameters**:
- `faceId` (number): Face ID

**Request Body**:
```json
{
  "fromPersonId": 5,
  "toPersonId": 10,
  "confidence": 0.95,
  "reason": "Correction after review"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Face reassigned from John Doe to Jane Smith",
  "fromPerson": {
    "id": 5,
    "name": "John Doe",
    "face_count": 24
  },
  "toPerson": {
    "id": 10,
    "name": "Jane Smith", 
    "face_count": 16
  }
}
```

## Face Recognition Workflow

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="detection" label="🔍 Detection" default>
    **AI Detection Process:**
    - CompreFace analyzes images for faces
    - Extracts face coordinates and features
    - Estimates age, gender, and confidence
    - Saves face images for identification
  </TabItem>
  <TabItem value="identification" label="🎯 Identification">
    **Recognition Process:**
    - Compare detected faces to trained persons
    - Calculate similarity scores
    - Auto-assign high-confidence matches
    - Flag uncertain matches for review
  </TabItem>
  <TabItem value="training" label="🎓 Training">
    **Learning Process:**
    - Collect multiple face examples per person
    - Train CompreFace recognition model
    - Improve accuracy over time
    - Handle model updates and retraining
  </TabItem>
</Tabs>

## Error Responses

### Face Not Found
```json
{
  "error": "Face not found",
  "code": "NOT_FOUND",
  "details": {
    "face_id": 999
  }
}
```

### Already Assigned
```json
{
  "error": "Face already assigned to person",
  "code": "ALREADY_EXISTS",
  "details": {
    "face_id": 123,
    "current_person": "John Doe"
  }
}
```

### Insufficient Training Data
```json
{
  "error": "No trained people found for recognition",
  "code": "INSUFFICIENT_DATA",
  "details": {
    "suggestion": "Train at least one person before running auto-recognition"
  }
}
```

## Best Practices

:::tip Face Recognition Tips
- **Quality**: Use clear, well-lit face images for training
- **Quantity**: 5-10 diverse faces per person for good results
- **Review**: Always review auto-assignments with confidence < 0.9
- **Training**: Regularly retrain as you add more face examples
:::

### Confidence Thresholds
- **0.95+**: Very high confidence - safe for auto-assignment
- **0.85-0.94**: High confidence - good for most cases
- **0.70-0.84**: Medium confidence - review recommended
- **< 0.70**: Low confidence - manual verification required