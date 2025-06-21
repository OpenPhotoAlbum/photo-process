# Monitoring & Logging System

The Photo Management Platform includes a comprehensive monitoring and logging system built on **Elasticsearch** and **Kibana**, providing real-time insights into system performance, errors, and user activity.

## Architecture Overview

```
Monitoring Stack
├── Application Logs → Elasticsearch (Direct)
├── Elasticsearch → Data Storage & Indexing  
├── Kibana → Visualization & Dashboards
└── File Logs → Backup & Development
```

### Components

- **Elasticsearch**: Primary log storage with organized indices
- **Kibana**: Web-based visualization and query interface
- **Direct Logging**: Application logs directly to Elasticsearch (no Filebeat needed)
- **File Backup**: Local file logs with daily rotation as backup

## Quick Start

### Access Kibana Dashboard

```bash
# Start Elasticsearch and Kibana
npm run logs:start

# Open Kibana in browser
npm run logs:kibana
# Or manually: http://localhost:5601
```

### Essential Commands

```bash
# Start monitoring stack
npm run logs:start

# Stop monitoring stack  
npm run logs:stop

# Restart monitoring stack
npm run logs:restart

# Check service status
npm run logs:status

# View current indices
npm run logs:check-indices

# Ship today's logs to Elasticsearch
npm run logs:ship-today
```

## Log Categories & Indices

The platform organizes logs into specialized indices for efficient analysis:

### System Indices
- **`photo-platform-system-*`** - Server startup, configuration, general operations
- **`photo-platform-errors-*`** - All errors consolidated across platform components
- **`photo-platform-performance-*`** - Performance metrics, response times, resource usage

### Processing Indices  
- **`photo-platform-processing-*`** - Detailed image processing logs with metadata
- **`photo-platform-faces-*`** - Face detection, recognition, and training activities
- **`photo-platform-file-tracker-*`** - File discovery and indexing operations

### API & User Activity
- **`photo-platform-api-*`** - HTTP requests, responses, authentication
- **`photo-platform-audit-*`** - User actions, data modifications, security events

## Configuration

### Environment Setup

Enable Elasticsearch logging in your `.env` file:

```bash
# Enable direct Elasticsearch logging
ENABLE_ELASTICSEARCH_LOGGING=true

# Elasticsearch connection
ELASTICSEARCH_URL=http://localhost:9200

# Optional authentication (if required)
ELASTICSEARCH_USER=elastic
ELASTICSEARCH_PASS=changeme
```

### Dual Logging System

The platform uses a **dual logging approach**:

1. **Primary**: Direct to Elasticsearch for real-time analysis
2. **Backup**: Local files with daily rotation for development/debugging

Benefits:
- ✅ **No Data Loss**: Logs persist even if Elasticsearch is down
- ✅ **Real-time Analysis**: Immediate availability in Kibana
- ✅ **Development Friendly**: Local files for debugging
- ✅ **Fault Tolerant**: Application continues if monitoring fails

## Key Features

### Automatic Index Management

**Date-based Indices**: Logs automatically create daily indices
```
photo-platform-processing-2025-06-21
photo-platform-api-2025-06-21
photo-platform-errors-2025-06-21
```

**Field Standardization**: All logs include:
- `@timestamp` - Precise event timing
- `level` - Log level (error, warn, info, debug)
- `component` - Source component or service
- `message` - Log content
- `category` - Log category for filtering

### Performance Monitoring

**Real-time Metrics**:
- API response times
- Image processing duration
- Face recognition confidence scores
- Database query performance
- Resource utilization

**Alerting Capabilities** (via Kibana):
- Error rate thresholds
- Processing queue backlog
- Storage space warnings
- Service availability

## Common Use Cases

### 🚨 System Health Monitoring

**Daily Health Check**:
1. Check error rates: `level:error`
2. Monitor processing failures: `processing_status:failed`
3. Review API performance: `component:api AND duration:>1000`

**Real-time Alerts**:
- Error spikes in any component
- Face recognition service downtime
- Database connectivity issues

### 📊 Performance Analysis

**Processing Pipeline**:
- Images per hour throughput
- Average processing time per photo
- Face detection accuracy trends
- Object detection performance

**Resource Monitoring**:
- Memory usage patterns
- CPU utilization during processing
- Disk space consumption
- Network throughput

### 🔍 Content Analytics

**Photo Analysis**:
- Face recognition accuracy over time
- Object detection confidence distributions
- Geographic distribution of photos
- File format and size analysis

**User Behavior**:
- Upload patterns and frequency
- Mobile app usage statistics
- Album creation and organization
- Search query patterns

### 🐛 Debugging & Troubleshooting

**Error Investigation**:
```bash
# Find all face recognition errors
component:face-recognition AND level:error

# Processing failures for specific files
filename:IMG_1234.jpg AND processing_status:failed

# API errors in the last hour
level:error AND component:api
```

**Performance Debugging**:
```bash
# Slow API responses
component:api AND duration:>2000

# High memory usage events
message:memory AND level:warn

# Database query performance
component:database AND duration:>500
```

## Advanced Features

### Custom Dashboards

Create specialized dashboards for different roles:

**Operations Dashboard**:
- System health indicators
- Error rate monitoring
- Service availability
- Resource utilization

**Developer Dashboard**:
- Recent errors and warnings
- API performance metrics
- Processing queue status
- Component-specific logs

**Business Intelligence**:
- Photo processing statistics
- User engagement metrics
- Content analysis trends
- Growth and usage patterns

### Data Retention & Management

**Index Lifecycle Management**:
- **Hot Phase**: 7 days (high-performance SSD)
- **Warm Phase**: 30 days (standard storage)
- **Delete Phase**: 90 days (automatic cleanup)

**Storage Optimization**:
- Automatic index compression
- Field mapping optimization
- Shard allocation strategies
- Snapshot backup policies

### Integration Points

**Application Integration**:
- TypeScript structured logger
- Automatic error context capture
- Performance metric collection
- User action tracking

**External Integrations**:
- Slack notifications for critical errors
- Email alerts for system issues
- Webhook endpoints for custom monitoring
- Prometheus metrics export (future)

## Setup & Installation

### Prerequisites

- Docker and Docker Compose
- Minimum 4GB RAM for Elasticsearch
- 10GB+ disk space for log storage

### Installation Steps

1. **Start Services**:
   ```bash
   npm run logs:start
   ```

2. **Configure Kibana**:
   - Open http://localhost:5601
   - Go to "Stack Management" → "Index Patterns"
   - Create pattern: `photo-platform-*`
   - Set `@timestamp` as time field

3. **Enable Application Logging**:
   ```bash
   # Add to .env file
   echo "ENABLE_ELASTICSEARCH_LOGGING=true" >> .env
   
   # Restart API service
   docker compose -f docker-compose.platform.yml restart api
   ```

4. **Verify Setup**:
   ```bash
   # Check indices are being created
   curl http://localhost:9200/_cat/indices/photo-platform-*
   
   # View sample logs in Kibana
   # Navigate to Discover → Select photo-platform-* index
   ```

### Resource Requirements

**Minimum Configuration**:
- 4GB RAM for Elasticsearch
- 2 CPU cores
- 10GB disk space

**Recommended Production**:
- 8GB+ RAM for Elasticsearch
- 4+ CPU cores
- 100GB+ SSD storage
- Dedicated monitoring server

## Troubleshooting

### Common Issues

**Elasticsearch Won't Start**:
```bash
# Check logs
docker logs photo-elasticsearch

# Common fixes
# 1. Increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144

# 2. Clear data directory (development only)
rm -rf infrastructure/logging/elasticsearch_data/*
```

**No Logs Appearing**:
```bash
# Check environment variable
grep ENABLE_ELASTICSEARCH_LOGGING .env

# Verify API can reach Elasticsearch
docker exec photo-api curl http://elasticsearch:9200/_cluster/health

# Check API logs for connection errors
docker logs photo-api | grep -i elasticsearch
```

**Kibana Connection Issues**:
```bash
# Verify Elasticsearch is healthy
curl http://localhost:9200/_cluster/health

# Restart Kibana
docker restart photo-kibana

# Check Kibana logs
docker logs photo-kibana
```

### Performance Issues

**High Memory Usage**:
- Reduce JVM heap size in elasticsearch.yml
- Implement index lifecycle management
- Close unused indices

**Slow Queries**:
- Add field-specific indices
- Optimize query patterns
- Use shorter time ranges

**Disk Space**:
- Configure automatic index deletion
- Enable index compression
- Monitor retention policies

## Best Practices

### Query Optimization

1. **Use Specific Fields**: `level:error` vs `error`
2. **Set Time Ranges**: Use Kibana time picker
3. **Filter First**: Apply restrictive filters early
4. **Save Common Queries**: Create saved searches

### Dashboard Design

1. **Single Purpose**: One dashboard per use case
2. **Performance Aware**: Limit visualizations per dashboard
3. **Auto-refresh**: Set appropriate refresh intervals
4. **Mobile Friendly**: Design for different screen sizes

### Data Management

1. **Regular Cleanup**: Monitor storage usage
2. **Index Templates**: Standardize field mappings
3. **Backup Strategy**: Regular snapshots
4. **Access Control**: Implement user permissions

## Integration Benefits

With comprehensive monitoring, the platform provides:

✅ **Proactive Issue Detection**: Identify problems before users notice  
✅ **Performance Optimization**: Data-driven optimization decisions  
✅ **User Experience Insights**: Understand how users interact with the platform  
✅ **Operational Excellence**: Maintain high availability and reliability  
✅ **Debugging Efficiency**: Rapid problem identification and resolution  
✅ **Compliance & Auditing**: Complete audit trail of all activities  

This monitoring system transforms platform operations from reactive to proactive, enabling data-driven decisions and exceptional user experiences.