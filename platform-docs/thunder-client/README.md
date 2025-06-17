# Thunder Client API Testing Collections

This directory contains Thunder Client collections for comprehensive API testing of the Photo Platform.

## 📁 Files

- **`thunder-collection_photo-platform.json`** - Complete API collection with all endpoints
- **`thunder-environment_photo-platform.json`** - Development environment variables
- **`thunder-environment_production.json`** - Production environment template

## 🚀 Quick Setup

### 1. Import Collections in Thunder Client

1. Open VS Code with Thunder Client extension
2. Go to Thunder Client sidebar
3. Click **Collections** tab → **Import** → Select `thunder-collection_photo-platform.json`
4. Click **Environments** tab → **Import** → Select environment files

### 2. Configure Environment

**Development (Default):**
- Base URL: `http://localhost:9000`
- No authentication required
- Uses test data and lower limits

**Production:**
- Update `baseUrl` to your production domain
- Add API key if authentication is enabled
- Higher confidence thresholds

## 📋 Collection Overview

### 🏠 Root & Health
- **API Status** - Get service information and available endpoints
- **Health Check** - Docker health check endpoint

### 🖼️ Gallery & Media  
- **Gallery - List Images** - Paginated image listing with cursor support
- **Gallery - Search Images** - Advanced search with date/face filters

### 👤 Person Management
- **Persons - List All** - Get all persons with face counts
- **Persons - Create New** - Create new person for face assignment
- **Persons - Get by ID** - Get detailed person information

### 😊 Face Recognition
- **Faces - Get Unidentified** - Faces needing manual identification
- **Faces - Assign to Person** - Manual face-to-person assignment
- **Faces - Needs Review** - Medium confidence matches for review

### 🔍 Search & Discovery
- **Search - By Objects** - Find images containing specific objects
- **Search - Advanced** - Combined filters (date + objects + faces)
- **Search - Object Statistics** - Object detection analytics

### ⚙️ Processing & Jobs
- **Processing - Start Scan** - Trigger new photo scanning
- **Processing - Scan Status** - Check current scan progress
- **Jobs - List All** - Background job management
- **Jobs - Queue Stats** - Queue statistics and performance

### 🔧 Admin & Configuration
- **Admin - Get Configuration** - System configuration and settings

## 🧪 Testing Workflows

### Basic API Health Check
1. Run **API Status** - Should return service info
2. Run **Health Check** - Should return 200 OK
3. Run **Gallery - List Images** - Should return image array

### Face Recognition Workflow
1. **Faces - Get Unidentified** - Find faces needing identification
2. **Persons - Create New** - Create person if needed
3. **Faces - Assign to Person** - Assign face to person
4. **Faces - Needs Review** - Check review queue

### Search & Discovery Workflow  
1. **Search - Object Statistics** - See available objects
2. **Search - By Objects** - Search for specific objects
3. **Search - Advanced** - Combined search with multiple filters

### Processing Workflow
1. **Jobs - Queue Stats** - Check current queue status
2. **Processing - Start Scan** - Trigger new scan (async=true)
3. **Processing - Scan Status** - Monitor scan progress
4. **Jobs - List All** - Check job completion

## 🔧 Environment Variables

### Core URLs
- `baseUrl` - Main API base URL
- `apiUrl` - API endpoints base URL  
- `mediaUrl` - Media serving URL
- `processedUrl` - Processed image URL

### Test Data IDs
- `personId` - Test person ID (update after creating persons)
- `faceId` - Test face ID (get from unidentified faces)
- `imageId` - Test image ID (get from gallery)
- `jobId` - Job ID (captured from async operations)

### Search & Filter Values
- `testObjectSearch` - Object search terms (comma-separated)
- `defaultLimit` - Default result limit
- `testPersonName` - Name for test person creation

### Confidence Thresholds
- `highConfidence` (0.95) - Auto-assignment threshold
- `mediumConfidence` (0.75) - Review queue threshold  
- `lowConfidence` (0.5) - Detection threshold

## 📝 Test Validation

Each request includes automated tests:
- **Status Code Validation** - Ensures proper HTTP responses
- **Response Schema Validation** - Validates JSON structure
- **Data Type Validation** - Checks field types
- **Business Logic Validation** - Validates expected values

## 🐛 Debugging Tips

### Common Issues
1. **Connection Refused** - Check if API server is running (`npm start`)
2. **Database Errors** - Verify MySQL is running and migrated
3. **Empty Results** - Run scan first to populate test data
4. **Permission Errors** - Check file permissions on media directories

### Useful Debug Requests
1. **API Status** - Shows configuration and available endpoints
2. **Gallery - List Images** - Quick data availability check
3. **Jobs - Queue Stats** - Shows processing system health
4. **Admin - Get Configuration** - Shows current settings

## 🔄 Automated Testing

You can run these collections via command line using Thunder Client CLI:
```bash
# Install Thunder Client CLI
npm install -g @thunderclient/cli

# Run collection
thunder-client run thunder-collection_photo-platform.json \
  --env thunder-environment_photo-platform.json \
  --format json --output results.json
```

## 📊 Performance Testing

For load testing, use the provided collections with tools like:
- **Newman** (Postman CLI runner)
- **Artillery** (Load testing toolkit)  
- **k6** (Developer-centric load testing)

Example with Newman:
```bash
# Convert to Postman format first, then:
newman run collection.json -e environment.json --iteration-count 100
```