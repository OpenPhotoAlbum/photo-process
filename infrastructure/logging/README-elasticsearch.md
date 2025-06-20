# Direct Elasticsearch Logging

## Overview

The photo platform now supports direct logging to Elasticsearch, eliminating the need for Filebeat and ensuring no logs are lost during rotation.

## Configuration

### Environment Variables

```bash
# Enable/disable Elasticsearch logging (default: true)
ENABLE_ELASTICSEARCH_LOGGING=true

# Elasticsearch connection
ELASTICSEARCH_URL=http://localhost:9200

# Optional authentication
ELASTICSEARCH_USER=elastic
ELASTICSEARCH_PASS=changeme
```

### Log Indices

Logs are organized into separate indices for better organization and retention policies:

- `photo-platform-system` - System startup, configuration, general logs
- `photo-platform-errors` - All error logs across the platform
- `photo-platform-api` - HTTP request/response logs
- `photo-platform-processing` - Detailed image processing logs
- `photo-platform-processing-summary` - Quick processing summaries
- `photo-platform-faces` - Face detection and recognition logs
- `photo-platform-performance` - Performance metrics and timings
- `photo-platform-audit` - User actions and data modifications
- `photo-platform-file-tracker` - File discovery and indexing
- `photo-platform-faces-review` - Face review and assignment logs
- `photo-platform-general` - General application logs

## Features

### Dual Logging
- Logs are written to both files (with rotation) and Elasticsearch
- File logs serve as backup and for debugging without Elasticsearch
- Elasticsearch logs enable real-time analysis and long-term retention

### Automatic Timestamps
- All logs automatically include `@timestamp` field
- Category field added for easy filtering
- Original log structure preserved

### Error Handling
- Elasticsearch transport errors don't crash the application
- Logs continue to files even if Elasticsearch is down
- Errors are logged to console for monitoring

## Viewing Logs in Kibana

1. Open Kibana: http://localhost:5601
2. Go to Stack Management → Index Patterns
3. Create patterns for each index:
   - `photo-platform-*` (all logs)
   - `photo-platform-processing-*` (just processing)
   - etc.

### Example Queries

```
# All errors in the last hour
index: photo-platform-errors

# Processing failures
index: photo-platform-processing AND status: failed

# API requests over 1 second
index: photo-platform-api AND duration: >1000

# Face recognition matches
index: photo-platform-faces AND confidence: >0.9
```

## Migration from File-based Logging

To switch from file-based to Elasticsearch logging:

1. Update the logger import in `structured-logger.ts`:
   ```typescript
   export { logger } from './structured-logger-elasticsearch';
   ```

2. Restart the API service:
   ```bash
   docker compose -f docker-compose.platform.yml restart api
   ```

3. Verify logs appearing in Elasticsearch:
   ```bash
   curl http://localhost:9200/_cat/indices/photo-platform-*
   ```

## Retention Policies

Configure index lifecycle management in Kibana:

1. Stack Management → Index Lifecycle Policies
2. Create policy for photo-platform indices:
   - Hot phase: 7 days
   - Warm phase: 30 days (optional)
   - Delete phase: 90 days

This ensures logs don't consume unlimited disk space.