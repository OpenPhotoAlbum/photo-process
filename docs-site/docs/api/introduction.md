---
sidebar_position: 1
---

# API Introduction

Welcome to the Photo Management Platform API documentation. This RESTful API provides comprehensive endpoints for managing photos, people, faces, and AI-powered features.

## API Overview

> **Base URL**: `http://localhost:9000`  
> **Version**: 1.0  
> **Content Type**: `application/json`

The Photo Management Platform API supports:

- **Photo Management** - Upload, organize, and serve images
- **Face Recognition** - AI-powered face detection and person identification  
- **Object Detection** - Find photos by detected objects
- **Smart Organization** - Automated clustering and tagging
- **Background Processing** - Async job management

## Quick Start

```bash
# Check API health
curl http://localhost:9000/api/health

# Get all persons
curl http://localhost:9000/api/persons

# Search for photos with objects
curl "http://localhost:9000/api/search/objects?objects=person,car"
```

## API Features

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="core" label="🏠 Core Features" default>
    - Photo scanning and processing
    - Gallery browsing with pagination
    - Advanced search capabilities
    - Media serving with thumbnails
  </TabItem>
  <TabItem value="ai" label="🤖 AI Features">
    - Face detection and recognition
    - Person identification and management
    - Face clustering for organization
    - Object detection and tagging
  </TabItem>
  <TabItem value="system" label="⚙️ System Features">
    - Background job processing
    - System health monitoring
    - Consistency checking
    - Data migration tools
  </TabItem>
</Tabs>

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

:::warning Future Enhancement
Authentication and authorization will be added in future versions for production deployments.
:::

## Response Format

All API responses follow a consistent JSON format:

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

## Getting Started

Ready to explore the API? Start with these sections:

- [Media & Static Routes](./media-static) - Basic file serving
- [Gallery API](./gallery) - Browse your photo collection
- [Person Management](./persons) - Manage people in photos
- [Face Recognition](./faces) - AI-powered face features

## Need Help?

- Check the original comprehensive documentation at `/docs/api/overview` for detailed error handling and data models
- Test endpoints with the provided examples
- Monitor API responses for error codes and debugging information