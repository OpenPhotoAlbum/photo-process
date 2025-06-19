# Kibana Query Guide

This guide helps you search and analyze your photo platform logs using Kibana's powerful query language.

## Basic Query Syntax

### Simple Text Search
```
face detection        # Search anywhere for "face detection"
error                 # Find any logs containing "error"
CompreFace           # Search for CompreFace-related logs
```

### Field-Specific Queries  
```
level:error                    # Show only error-level logs
component:face-recognition     # Logs from face recognition component
message:"processing complete"  # Exact phrase search
filename:IMG_1234.jpg         # Specific file
```

### Wildcards & Patterns
```
filename:*.jpg                           # All JPG files
message:face*                           # Messages starting with "face"
original_path:/mnt/sg1/uploads/stephen/* # Stephen's uploads
component:*recognition*                  # Any component with "recognition"
```

### Boolean Logic
```
level:error AND component:face-recognition    # Errors in face recognition
level:(error OR warn)                        # Errors OR warnings  
NOT level:debug                              # Exclude debug logs
component:face-recognition AND NOT level:debug # Face recognition without debug
```

### Range Queries
```
confidence:>0.9                    # High confidence results
file_size:[1000000 TO 5000000]    # Files between 1-5MB
faces_detected:>=3                 # 3 or more faces detected
confidence:[0.1 TO 0.6]           # Low to medium confidence range
```

### Existence Queries
```
gps_latitude:*        # Has GPS latitude data
NOT gps_latitude:*    # Missing GPS latitude data
person_id:*          # Has person assignment
confidence:*         # Has confidence score
```

## Time Ranges

**Important:** Use the **time picker** at the top right instead of date ranges in queries.

### Using the Time Picker
1. Click the time picker (usually shows "Last 15 minutes")
2. Select from common ranges:
   - Last 15 minutes
   - Last 1 hour  
   - Last 24 hours
   - Last 7 days
   - Today
   - This week
   - Custom range

### Relative Time in Queries (Alternative)
```
@timestamp:>now-1h    # Last hour (may work in some versions)
@timestamp:>now-24h   # Last 24 hours (may work in some versions)
```

**Best Practice:** Set time range with the picker, then run your content queries.

## Essential Queries for Photo Platform

### 🚨 Error & Health Monitoring

#### All Errors
```
level:error
```
**Use Case:** Daily health check - see all system errors

#### Processing Failures
```
processing_status:failed
```
**Use Case:** Find photos that failed to process

#### Face Recognition Errors
```
component:face-recognition AND level:error
```
**Use Case:** Troubleshoot face detection issues

#### CompreFace Connectivity Issues
```
message:CompreFace AND level:error
```
**Use Case:** Diagnose AI service connectivity problems

#### Warning-Level Issues
```
level:warn
```
**Use Case:** Find potential problems before they become errors

### 📸 Photo Processing Insights

#### Successfully Processed Photos
```
processing_status:completed
```
**Use Case:** Confirm photos processed successfully

#### Large Files
```
file_size:>10000000
```
**Use Case:** Find files larger than 10MB that might need optimization

#### Photos with Many Faces
```
faces_detected:>=5
```
**Use Case:** Find group photos or crowded scenes

#### High-Confidence Face Detections
```
component:face-recognition AND confidence:>0.9
```
**Use Case:** Review most accurate face recognitions

#### Astrophotography Detections
```
is_astrophotography:true
```
**Use Case:** Find automatically detected astrophotography images

#### Processing Duration Analysis
```
message:processing AND duration:*
```
**Use Case:** Monitor processing performance

### 👥 Face Recognition Analytics

#### Face Recognition Training Events
```
message:training AND component:face-recognition
```
**Use Case:** Track when the AI model was retrained

#### Low Confidence Face Matches
```
component:face-recognition AND confidence:[0.1 TO 0.6]
```
**Use Case:** Find faces that might need manual review

#### Face Clustering Results
```
component:face-clustering
```
**Use Case:** Review automatic face grouping activities

#### Person Assignments
```
message:"assigned to person"
```
**Use Case:** Track manual face labeling activities

#### Unidentified Faces
```
component:face-recognition AND person_id:""
```
**Use Case:** Find faces that haven't been identified yet

### 🌍 Location & Geographic Data

#### Photos with GPS Data
```
gps_latitude:* AND gps_longitude:*
```
**Use Case:** Find geotagged photos

#### Photos from Specific Cities
```
city:"San Francisco"
city:"New York"
city:"London"
```
**Use Case:** Filter photos by location

#### High-Confidence Location Matches
```
component:geolocation AND confidence:>0.8
```
**Use Case:** Review accurate location detections

#### Photos Missing Location Data
```
NOT gps_latitude:*
```
**Use Case:** Find photos that could benefit from manual geotagging

#### Location Detection Activities
```
component:geolocation
```
**Use Case:** Monitor GPS coordinate to city matching

### 📱 Mobile App & Auto-Upload

#### Auto-Upload Activity
```
component:auto-upload
```
**Use Case:** Monitor mobile app upload activities

#### Mobile App Deletions
```
message:"moved to trash" AND deleted_by:mobile-user
```
**Use Case:** Track user-initiated deletions

#### Upload Completion Events
```
message:"upload complete"
```
**Use Case:** Confirm successful uploads

#### Duplicate Detection
```
message:duplicate
```
**Use Case:** Monitor duplicate file prevention

#### Mobile App Errors
```
component:mobile AND level:error
```
**Use Case:** Troubleshoot mobile app issues

### ⚡ Performance Monitoring

#### Processing Queue Status
```
message:queue
```
**Use Case:** Monitor background processing workload

#### Thumbnail Generation
```
component:thumbnail OR message:thumbnail
```
**Use Case:** Track thumbnail creation activities

#### Memory or Resource Issues
```
message:(memory OR cpu OR disk)
```
**Use Case:** Identify resource bottlenecks

#### API Response Times
```
component:api AND duration:>1000
```
**Use Case:** Find slow API responses (>1 second)

#### Database Queries
```
component:database OR message:query
```
**Use Case:** Monitor database performance

### 🔍 Content Analysis

#### Screenshot Detection
```
is_screenshot:true
```
**Use Case:** Find automatically detected screenshots

#### Object Detection Results
```
component:object-detection
```
**Use Case:** Review AI object recognition activities

#### Specific Objects Detected
```
detected_objects:person
detected_objects:car
detected_objects:dog
```
**Use Case:** Find photos containing specific objects

#### EXIF Data Extraction
```
component:exif OR message:EXIF
```
**Use Case:** Monitor metadata extraction

#### Image Format Analysis
```
mime_type:"image/jpeg"
mime_type:"image/png"
mime_type:"image/heic"
```
**Use Case:** Analyze file format distribution

### 🗂️ User & Source Analysis

#### Stephen's Photos
```
original_path:"/mnt/sg1/uploads/stephen/*"
```
**Use Case:** Filter to one user's uploads

#### Cayce's Photos  
```
original_path:"/mnt/sg1/uploads/cayce/*"
```
**Use Case:** Filter to another user's uploads

#### Google Photos Imports
```
original_path:"*google*"
```
**Use Case:** Find photos imported from Google Photos

#### Recently Added Files
```
component:file-tracker AND message:"discovered"
```
**Use Case:** See newly found files

## Advanced Query Techniques

### Combining Multiple Conditions
```
# High-confidence faces in Stephen's photos
original_path:"/mnt/sg1/uploads/stephen/*" AND component:face-recognition AND confidence:>0.8

# Large files with processing errors
file_size:>5000000 AND processing_status:failed

# Screenshots from mobile uploads
is_screenshot:true AND original_path:"*mobile*"
```

### Aggregation Queries
```
# Group by processing status
processing_status:*

# Group by detected objects
detected_objects:*

# Group by file types
mime_type:*
```

### Exclusion Patterns
```
# All logs except debug level
NOT level:debug

# Photos excluding screenshots
NOT is_screenshot:true

# Non-face-recognition components
NOT component:face-recognition
```

## Building Visualizations

### Common Visualization Types

1. **Line Charts:** Processing activity over time
2. **Bar Charts:** Error counts by component  
3. **Pie Charts:** File type distribution
4. **Data Tables:** Recent errors with details
5. **Metric Cards:** Total photos processed today

### Steps to Create Visualizations
1. Start with a working query
2. Click "Visualize" button
3. Choose visualization type
4. Configure aggregations
5. Save and add to dashboard

## Saved Searches & Dashboards

### Recommended Saved Searches
- "Daily Errors" - `level:error`
- "Processing Status" - `processing_status:*`
- "Face Recognition Activity" - `component:face-recognition`
- "Mobile App Activity" - `component:auto-upload OR deleted_by:mobile-user`
- "High-Confidence Results" - `confidence:>0.9`

### Dashboard Ideas
- **System Health:** Error counts, processing rates, resource usage
- **Content Analysis:** Object detection results, face recognition stats
- **User Activity:** Upload patterns, deletion activity
- **Performance Monitoring:** Processing times, queue status

## Tips & Best Practices

### Query Optimization
1. **Use field filters** instead of full-text search when possible
2. **Set appropriate time ranges** before running queries
3. **Start broad, then narrow** your search criteria
4. **Save frequently used queries** for quick access

### Troubleshooting
1. **Check field names** in the "Available fields" panel
2. **Verify spelling** - queries are case-sensitive for values
3. **Use wildcards** if unsure of exact values
4. **Check time range** if expecting results but seeing none

### Performance
1. **Limit time ranges** for large datasets
2. **Use specific fields** rather than full-text search
3. **Avoid very broad wildcards** on large datasets
4. **Close unused visualizations** to improve browser performance

## Example Workflows

### Daily Health Check
1. Set time range to "Last 24 hours"
2. Run `level:error` to check for errors
3. Run `processing_status:failed` to check failed processing
4. Review any unusual patterns

### Face Recognition Review
1. Set time range to "Last 7 days"
2. Run `component:face-recognition AND confidence:[0.3 TO 0.7]` 
3. Review medium-confidence matches for accuracy
4. Check `faces_detected:>=5` for group photos

### Performance Analysis
1. Set time range to "Last 1 hour"
2. Run `component:api AND duration:>1000` for slow responses
3. Check `message:queue` for processing backlog
4. Monitor `level:warn` for potential issues

### Content Discovery
1. Set time range to "Today"
2. Run `processing_status:completed` to see new photos
3. Try `is_astrophotography:true` for night sky photos
4. Check `detected_objects:person` for people photos

With these queries and techniques, you can gain deep insights into your photo platform's operation and discover patterns in your 360,000+ log entries!