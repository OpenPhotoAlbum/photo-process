# Photo Processing API Documentation

> **Last Updated**: 2025-06-13  
> **Version**: 1.0  
> **Base URL**: `http://localhost:9000`

This document provides comprehensive documentation for all API endpoints in the photo processing system. The API supports photo scanning, face recognition, person management, clustering, and training workflows.

## Table of Contents

- [Authentication](#authentication)
- [Root & Static Routes](#root--static-routes)
- [Scan Operations](#scan-operations)
- [Gallery API](#gallery-api)
- [Search API](#search-api)
- [Person Management](#person-management)
- [Face Recognition](#face-recognition)
- [Face Clustering](#face-clustering)
- [Face Assignment](#face-assignment)
- [CompreFace Training Management](#compreface-training-management)
- [System & Utilities](#system--utilities)
- [Junk Detection](#junk-detection)
- [Background Jobs](#background-jobs)
- [Error Handling](#error-handling)
- [Data Models](#data-models)

---

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

---

## Root & Static Routes

### `GET /`
**Description**: Root endpoint  
**Response**: Basic application information

### `GET /static/*`
**Description**: Serve static frontend files  
**Path**: `/static/{filename}`

### `GET /media/*`
**Description**: Serve media files with thumbnail support  
**Path**: `/media/{path}`  
**Query Parameters**:
- `thumbnail` (boolean): Generate thumbnail if true
- `size` (number): Thumbnail size in pixels

### `GET /processed/*`
**Description**: Serve processed images statically  
**Path**: `/processed/{path}`

---

## Scan Operations

### `GET /scan/status`
**Description**: Get current scan status with FileTracker statistics  
**Response**:
```json
{
  "message": "NotStarted|InProgress|Completed|Failed",
  "processed": 0,
  "total_files": 0,
  "percentage": 0,
  "eta": null,
  "started_at": "2025-06-18T03:02:30.711Z",
  "completed_at": null,
  "error": null,
  "file_tracker": {
    "pending": 8358,
    "processing": 0,
    "completed": 0,
    "failed": 0
  }
}
```

### `GET /scan`
**Description**: Start photo scanning process using FileTracker system  
**Query Parameters**:
- `limit` (number): Maximum number of files to process
- `async` (boolean): Run in background (default: false)

**Response**:
```json
{
  "success": true,
  "processed": 2,
  "errors": 0,
  "message": "Hash-based scan completed - data stored directly in database",
  "mode": "hash-based"
}
```

**FileTracker Benefits**:
- **Instant Discovery**: 8,358+ files discovered in <100ms vs. minutes of directory scanning
- **Real-time Status**: Processing status tracked per file
- **Performance**: Database-driven file indexing eliminates slow filesystem operations

---

## Gallery API

### `GET /api/gallery`
**Description**: Get paginated gallery of processed images  
**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `sort` (string): Sort field (date_taken, filename)
- `order` (string): Sort order (asc, desc)

**Response**:
```json
{
  "images": [
    {
      "id": 1,
      "filename": "IMG_001.jpg",
      "date_taken": "2023-01-01T12:00:00Z",
      "faces_count": 2,
      "objects_count": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### `GET /api/gallery/:id/faces`
**Description**: Get faces detected in a specific image  
**Path Parameters**:
- `id` (number): Image ID

**Response**:
```json
{
  "image": {
    "id": 1,
    "filename": "IMG_001.jpg"
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
      "confidence": 0.95
    }
  ]
}
```

---

## Search API

### `GET /api/search/objects`
**Description**: Search images by detected objects  
**Query Parameters**:
- `objects` (string): Comma-separated object names
- `limit` (number): Maximum results (default: 50)
- `confidence` (number): Minimum confidence threshold

**Response**:
```json
{
  "images": [
    {
      "id": 1,
      "filename": "IMG_001.jpg",
      "objects": ["person", "car", "tree"],
      "confidence_scores": [0.95, 0.87, 0.92]
    }
  ],
  "total": 25
}
```

### `GET /api/search/advanced`
**Description**: Advanced search with multiple criteria  
**Query Parameters**:
- `objects` (string): Object names
- `persons` (string): Person IDs
- `date_from` (string): Start date (ISO format)
- `date_to` (string): End date (ISO format)
- `has_faces` (boolean): Images with faces

### `GET /api/objects/stats`
**Description**: Get object detection statistics  
**Response**:
```json
{
  "total_objects": 1500,
  "unique_objects": 45,
  "top_objects": [
    {"name": "person", "count": 300},
    {"name": "car", "count": 150}
  ]
}
```

---

## Person Management

### `GET /api/persons`
**Description**: Get all persons with face thumbnails  
**Response**:
```json
{
  "persons": [
    {
      "id": 1,
      "name": "John Doe",
      "notes": "Family member",
      "face_count": 25,
      "sample_face_image": "faces/john_face_1.jpg",
      "recognition_status": "trained",
      "auto_recognize": true
    }
  ]
}
```

### `GET /api/persons/:id`
**Description**: Get person by ID with all faces  
**Path Parameters**:
- `id` (number): Person ID

**Response**:
```json
{
  "person": {
    "id": 1,
    "name": "John Doe",
    "face_count": 25,
    "faces": [
      {
        "id": 1,
        "face_image_path": "faces/john_face_1.jpg",
        "confidence": 0.95
      }
    ]
  }
}
```

### `POST /api/persons`
**Description**: Create new person  
**Request Body**:
```json
{
  "name": "Jane Smith",
  "notes": "Optional notes"
}
```

**Response**:
```json
{
  "person": {
    "id": 2,
    "name": "Jane Smith",
    "face_count": 0,
    "recognition_status": "untrained"
  }
}
```

### `PUT /api/persons/:id`
**Description**: Update person information  
**Path Parameters**:
- `id` (number): Person ID

**Request Body**:
```json
{
  "name": "Updated Name",
  "notes": "Updated notes",
  "auto_recognize": true,
  "recognition_status": "trained"
}
```

### `DELETE /api/persons/:id`
**Description**: Delete person (unassigns all faces)  
**Path Parameters**:
- `id` (number): Person ID

---

## Face Recognition

### `GET /api/faces/unidentified`
**Description**: Get unidentified faces for manual assignment  
**Query Parameters**:
- `limit` (number): Maximum results (default: 50)
- `random` (boolean): Random selection
- `gender` (string): Filter by gender
- `ageMin`, `ageMax` (number): Age range filter
- `minConfidence` (number): Minimum detection confidence

**Response**:
```json
{
  "faces": [
    {
      "id": 1,
      "face_image_path": "faces/unknown_1.jpg",
      "detection_confidence": 0.95,
      "gender": "male",
      "age": 25,
      "image": {
        "id": 100,
        "filename": "IMG_001.jpg",
        "date_taken": "2023-01-01T12:00:00Z"
      }
    }
  ],
  "count": 10,
  "totalCount": 150
}
```

### `POST /api/faces/assign`
**Description**: Assign single face to person  
**Request Body**:
```json
{
  "faceId": 1,
  "personId": 5
}
```

### `POST /api/faces/batch-assign`
**Description**: Assign multiple faces to person  
**Request Body**:
```json
{
  "faceIds": [1, 2, 3],
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

### `DELETE /api/faces/:faceId/person`
**Description**: Remove face from person  
**Path Parameters**:
- `faceId` (number): Face ID

### `POST /api/faces/:faceId/mark-invalid`
**Description**: Mark face as invalid (not a real face)  
**Path Parameters**:
- `faceId` (number): Face ID

### `POST /api/faces/:faceId/mark-unknown`
**Description**: Mark face as unknown person  
**Path Parameters**:
- `faceId` (number): Face ID

### `POST /api/faces/auto-recognize`
**Description**: Run batch auto-recognition on unidentified faces  
**Query Parameters**:
- `limit` (number): Maximum faces to process
- `minConfidence` (number): Minimum confidence for auto-assignment

**Response**:
```json
{
  "recognized": 15,
  "processed": 50,
  "needsConfirmation": 5,
  "trainedPeople": 10,
  "message": "Auto-recognition completed: 15 auto-assigned, 5 need confirmation from 50 processed"
}
```

### `POST /api/faces/cleanup-orphaned`
**Description**: Clean up faces assigned locally but not in CompreFace

### `POST /api/images/:imageId/recognize`
**Description**: Run face recognition on specific image  
**Path Parameters**:
- `imageId` (number): Image ID

### `GET /api/faces/filter-options`
**Description**: Get available filter options for faces  
**Response**:
```json
{
  "genders": ["male", "female"],
  "ageRanges": [
    {"min": 0, "max": 18, "label": "Children"},
    {"min": 18, "max": 65, "label": "Adults"}
  ],
  "confidenceRange": {"min": 0.5, "max": 1.0}
}
```

### `GET /api/faces/needs-review`
**Description**: Get faces that need manual review  
**Query Parameters**:
- `limit` (number): Maximum results

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

### `GET /api/faces/:faceId/similar`
**Description**: Get similar faces for clustering  
**Path Parameters**:
- `faceId` (number): Face ID

**Query Parameters**:
- `threshold` (number): Similarity threshold (default: 0.8)
- `limit` (number): Maximum results

---

## Face Clustering

### `POST /api/clustering/start`
**Description**: Start face clustering process  
**Request Body**:
```json
{
  "similarityThreshold": 0.75,
  "minClusterSize": 2,
  "maxClusterSize": 50,
  "algorithm": "bbox_intersection",
  "rebuild": false
}
```

**Response**:
```json
{
  "success": true,
  "result": {
    "clustersCreated": 25,
    "facesProcessed": 320,
    "timeElapsed": 8700,
    "similaritiesCalculated": 1250
  },
  "message": "Created 25 clusters from 320 faces"
}
```

### `GET /api/clustering/stats`
**Description**: Get clustering statistics  
**Response**:
```json
{
  "stats": {
    "totalFaces": 1500,
    "clusteredFaces": 320,
    "unclusteredFaces": 1180,
    "totalClusters": 25,
    "averageClusterSize": 12.8,
    "pendingReview": 15
  }
}
```

### `GET /api/clusters`
**Description**: Get all face clusters  
**Query Parameters**:
- `includeReviewed` (boolean): Include reviewed clusters
- `limit` (number): Maximum results
- `offset` (number): Pagination offset

**Response**:
```json
{
  "clusters": [
    {
      "id": 1,
      "face_count": 15,
      "average_similarity": 0.85,
      "created_at": "2023-01-01T12:00:00Z",
      "is_reviewed": false,
      "sample_faces": [
        {
          "id": 1,
          "face_image_path": "faces/cluster_1_sample.jpg"
        }
      ]
    }
  ],
  "total": 25
}
```

### `GET /api/clusters/:clusterId`
**Description**: Get specific cluster with all members  
**Path Parameters**:
- `clusterId` (number): Cluster ID

**Response**:
```json
{
  "cluster": {
    "id": 1,
    "face_count": 15,
    "members": [
      {
        "face_id": 1,
        "similarity_to_cluster": 0.92,
        "face_image_path": "faces/face_1.jpg"
      }
    ]
  }
}
```

### `POST /api/clusters/:clusterId/assign`
**Description**: Assign entire cluster to a person  
**Path Parameters**:
- `clusterId` (number): Cluster ID

**Request Body**:
```json
{
  "personId": 5
}
```

**Response**:
```json
{
  "success": true,
  "message": "Assigned 15 faces from cluster to John Doe",
  "facesAssigned": 15
}
```

### `POST /api/clusters/:clusterId/review`
**Description**: Review cluster without assignment  
**Path Parameters**:
- `clusterId` (number): Cluster ID

**Request Body**:
```json
{
  "action": "approve|reject|split",
  "notes": "Optional review notes"
}
```

### `POST /api/clustering/cleanup`
**Description**: Clean up orphaned similarity records  
**Response**:
```json
{
  "success": true,
  "message": "Cleaned up 50 orphaned similarities",
  "deleted": 50
}
```

---

## Face Assignment

### `POST /api/faces/bulk-assign`
**Description**: Bulk assign multiple faces with validation  
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

### `POST /api/faces/suggest-persons`
**Description**: Get person suggestions for unassigned faces  
**Request Body**:
```json
{
  "faceIds": [1, 2, 3],
  "maxSuggestions": 3,
  "minConfidence": 0.7
}
```

**Response**:
```json
{
  "success": true,
  "suggestions": [
    {
      "faceId": 1,
      "suggestions": [
        {
          "personId": 5,
          "personName": "John Doe",
          "confidence": 0.85,
          "similarFaceId": 15
        }
      ],
      "reason": "Based on similar faces"
    }
  ]
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

### `GET /api/assignment/workflow`
**Description**: Get assignment workflow recommendations  
**Query Parameters**:
- `limit` (number): Maximum results
- `includeClusteredFaces` (boolean): Include clustered faces
- `includeSimilarityMatches` (boolean): Include similarity matches

**Response**:
```json
{
  "success": true,
  "workflow": {
    "pendingClusters": [
      {
        "id": 1,
        "face_count": 15,
        "priority": "high"
      }
    ],
    "similarityMatches": [
      {
        "unassigned_face_id": 1,
        "suggested_person_id": 5,
        "suggested_person_name": "John Doe",
        "similarity_score": 0.85
      }
    ],
    "unclusteredFaces": [],
    "statistics": {
      "pendingClusters": 5,
      "similarityMatches": 10,
      "totalUnassignedFaces": 150
    }
  },
  "recommendations": {
    "nextAction": "Review face clusters",
    "priority": "high"
  }
}
```

---

## CompreFace Training Management

### `POST /api/persons/:id/queue-training`
**Description**: Queue person for CompreFace training  
**Path Parameters**:
- `id` (number): Person ID

**Request Body**:
```json
{
  "trainingType": "full|incremental|validation",
  "config": {
    "minFacesThreshold": 3,
    "maxFacesPerBatch": 50
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Person queued for training",
  "trainingId": 1
}
```

### `POST /api/training/process-queue`
**Description**: Process pending training jobs  
**Request Body**:
```json
{
  "config": {
    "maxConcurrentJobs": 5
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Processed 3 training jobs",
  "results": [
    {
      "id": 1,
      "person_id": 5,
      "status": "completed",
      "faces_added": 15,
      "success_rate": 100
    }
  ]
}
```

### `POST /api/training/auto-train`
**Description**: Auto-queue eligible people for training  
**Request Body**:
```json
{
  "config": {
    "enabled": true,
    "minFacesThreshold": 3,
    "trainingInterval": 6
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Auto-queued 5 people for training",
  "queuedJobs": [
    {
      "id": 1,
      "person_id": 5,
      "person_name": "John Doe",
      "training_type": "full",
      "status": "pending"
    }
  ]
}
```

### `GET /api/training/queue`
**Description**: Get current training queue status  
**Response**:
```json
{
  "success": true,
  "queue": {
    "pendingJobs": [],
    "runningJobs": [
      {
        "id": 1,
        "person_name": "John Doe",
        "status": "running",
        "started_at": "2023-01-01T12:00:00Z"
      }
    ],
    "completedJobs": [],
    "totalPeople": 25,
    "trainedPeople": 10,
    "untrainedPeople": 15
  }
}
```

### `GET /api/training/stats`
**Description**: Get training statistics  
**Response**:
```json
{
  "success": true,
  "stats": {
    "totalPeople": 25,
    "trainedPeople": 10,
    "untrainedPeople": 15,
    "trainingJobs": 50,
    "averageTrainingTime": 120,
    "successRate": 95.5,
    "lastTrainingDate": "2023-01-01T12:00:00Z"
  }
}
```

### `DELETE /api/training/jobs/:jobId`
**Description**: Cancel training job  
**Path Parameters**:
- `jobId` (number): Training job ID

**Response**:
```json
{
  "success": true,
  "message": "Training job cancelled"
}
```

### `POST /api/training/jobs/:jobId/retry`
**Description**: Retry failed training job  
**Path Parameters**:
- `jobId` (number): Training job ID

**Response**:
```json
{
  "success": true,
  "message": "Training job retried",
  "newJobId": 15
}
```

### `POST /api/training/cleanup`
**Description**: Clean up old training history  
**Request Body**:
```json
{
  "daysToKeep": 30
}
```

**Response**:
```json
{
  "success": true,
  "message": "Cleaned up 50 old training history records",
  "deleted": 50
}
```

---

## System & Utilities

### `GET /api/system/consistency`
**Description**: Check system consistency between database and CompreFace  
**Query Parameters**:
- `autoRepair` (boolean): Automatically repair inconsistencies

**Response**:
```json
{
  "message": "Consistency check completed",
  "issues": 0,
  "repaired": 0,
  "checks": {
    "faces": "passed",
    "persons": "passed"
  }
}
```

### `GET /api/metadata`
**Description**: Get photo metadata  
**Query Parameters**:
- `path` (string): Photo path

**Response**: JSON metadata object

---

## Junk Detection

### `GET /api/junk/candidates`
**Description**: Get screenshot candidates for review  
**Response**:
```json
{
  "candidates": [
    {
      "id": 1,
      "filename": "screenshot.png",
      "confidence": 0.95,
      "status": "pending"
    }
  ]
}
```

### `PUT /api/junk/:id/status`
**Description**: Update junk status for image  
**Path Parameters**:
- `id` (number): Image ID

**Request Body**:
```json
{
  "status": "junk|keep|pending"
}
```

### `POST /api/junk/batch-update`
**Description**: Batch update junk status  
**Request Body**:
```json
{
  "imageIds": [1, 2, 3],
  "status": "junk"
}
```

### `GET /api/junk/stats`
**Description**: Get junk detection statistics

### `POST /api/junk/detect`
**Description**: Run screenshot detection on images

---

## Background Jobs

### `POST /api/jobs/scan`
**Description**: Start background scan job  
**Response**:
```json
{
  "jobId": "scan_123",
  "status": "queued",
  "message": "Scan job started"
}
```

### `POST /api/jobs/face-recognition`
**Description**: Start face recognition job

### `POST /api/jobs/thumbnail`
**Description**: Start thumbnail generation job

### `GET /api/jobs/:jobId`
**Description**: Get job status  
**Path Parameters**:
- `jobId` (string): Job ID

**Response**:
```json
{
  "id": "scan_123",
  "type": "scan",
  "status": "running",
  "progress": 45,
  "created_at": "2023-01-01T12:00:00Z"
}
```

### `GET /api/jobs`
**Description**: Get all jobs  
**Response**:
```json
{
  "jobs": [
    {
      "id": "scan_123",
      "type": "scan",
      "status": "completed",
      "progress": 100
    }
  ]
}
```

### `DELETE /api/jobs/:jobId`
**Description**: Cancel job  
**Path Parameters**:
- `jobId` (string): Job ID

### `GET /api/jobs-stats`
**Description**: Get job queue statistics

### `POST /api/jobs/cleanup`
**Description**: Clean up completed jobs

---

## Error Handling

All endpoints follow consistent error response format:

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

### Common Error Codes
- `VALIDATION_ERROR` - Invalid request parameters
- `NOT_FOUND` - Resource not found
- `ALREADY_EXISTS` - Resource already exists
- `INSUFFICIENT_DATA` - Not enough data to perform operation
- `EXTERNAL_SERVICE_ERROR` - CompreFace or other service error

---

## Data Models

### Person
```typescript
interface Person {
  id: number;
  name: string;
  notes?: string;
  compreface_subject_id?: string;
  face_count: number;
  auto_recognize: boolean;
  recognition_status: 'untrained' | 'training' | 'trained' | 'failed';
  training_face_count: number;
  last_trained_at?: Date;
  created_at: Date;
  updated_at: Date;
}
```

### DetectedFace
```typescript
interface DetectedFace {
  id: number;
  image_id: number;
  person_id?: number;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  detection_confidence: number;
  person_confidence?: number;
  face_image_path?: string;
  recognition_method?: string;
  gender?: string;
  age?: number;
  needs_review: boolean;
  assigned_at?: Date;
  assigned_by?: string;
}
```

### TrainingJob
```typescript
interface TrainingJob {
  id: number;
  person_id: number;
  person_name: string;
  faces_trained_count: number;
  training_type: 'full' | 'incremental' | 'validation';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: Date;
  completed_at?: Date;
  error_message?: string;
  success_rate?: number;
  faces_added?: number;
  faces_failed?: number;
}
```

### FaceCluster
```typescript
interface FaceCluster {
  id: number;
  algorithm: string;
  similarity_threshold: number;
  face_count: number;
  average_similarity: number;
  is_reviewed: boolean;
  assigned_person_id?: number;
  created_at: Date;
  reviewed_at?: Date;
  notes?: string;
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. Consider implementing rate limiting for production use.

---

## Webhooks

No webhook support currently implemented.

---

## Changelog

### Version 1.0 (2025-06-13)
- Initial API documentation
- Complete face recognition system
- CompreFace training management
- Face clustering capabilities
- Enhanced assignment workflows

---

**Note**: This documentation is automatically maintained. When adding new endpoints or modifying existing ones, please update this file accordingly.