# Photo Management Mobile App

Complete React Native mobile app with auto-upload, face recognition, and AI-powered photo management. Built with Expo and supports both development (Expo Go) and production (standalone) deployment.

## Development Workflow

### Linux + Mac Hybrid Development

**Linux (Primary Development):**
- Code editing and Git management
- API server runs here (`docker compose up -d`)

**Mac (iOS Building):**
- Expo development server
- iOS Simulator and device testing

### Setup Steps

#### 1. Mac Preparation
```bash
# Install Node.js and Expo CLI
brew install node watchman
npm install -g @expo/cli

# Enable SSH for remote access
sudo systemsetup -setremotelogin on
```

#### 2. Network Configuration
The app connects to your Linux machine where the photo server runs:

```bash
# Linux machine wireless IP: 192.168.40.103 (use this one!)
# Linux machine wired IP: 192.168.40.6 (not accessible from other devices)
# Mac IP: 192.168.40.234
# API_BASE configured: http://192.168.40.103:9000
```

#### 3. Sync Code to Mac
```bash
# From Linux, sync to Mac
rsync -av /mnt/hdd/photo-process/services/mobile-app/ username@mac-ip:/path/to/mobile-app/

# Or use the sync script (create below)
./sync-to-mac.sh
```

#### 4. Development vs Production Builds

**Development (Expo Go):**
```bash
# On Mac - runs in Expo Go with demo mode
cd /path/to/mobile-app
npx expo start
# Scan QR code with Expo Go app on iPhone
```

**Production (Standalone App):**
```bash
# On Mac - builds native iOS app with full functionality
eas build --platform ios --profile preview
# Install .ipa file on iPhone for real auto-upload testing
```

## 🚀 **Features**

### ✅ **Core Application**
- **Photo Gallery**: Infinite scroll grid with thumbnail optimization and dominant color backgrounds
- **Sticky Date Headers**: Organize photos by month/year with smooth scrolling headers
- **Advanced Filtering**: Date range, location, GPS presence, and city-based filtering with sort options
- **Photo Details**: Full-screen view with pinch-to-zoom, metadata display, and face visualization
- **Face Recognition**: Tap faces to assign to persons with real-time CompreFace training
- **Photo Upload**: Camera and gallery selection with progress tracking and duplicate detection
- **Debug System**: On-screen debug logging for troubleshooting standalone app issues
- **Map Integration**: GPS location display with OpenStreetMap tile compositing

### ✅ **Auto-Upload System**
- **Camera Roll Sync**: Automatic detection and upload of new photos
- **Environment Detection**: Demo mode in Expo Go, full functionality in standalone builds
- **Background Processing**: Continues uploading when app is closed (standalone only)
- **Network Awareness**: WiFi-only option with cellular fallback
- **Duplicate Prevention**: Uses same hash-based deduplication as platform
- **Settings Management**: Quality control, daily limits, and upload statistics
- **Permission Handling**: Proper iOS permissions for camera roll and background processing

### ✅ **Technical Infrastructure**
- **Smart Service Loading**: Automatically detects environment and loads appropriate functionality
- **Error Handling**: Comprehensive error states with user-friendly messages
- **Performance Optimization**: Image caching, lazy loading, and memory management
- **Offline Support**: Graceful degradation when API is unavailable
- **Progress Tracking**: Real-time upload progress and statistics

### 🔄 **Planned Enhancements**
- **Advanced Search**: Filters for objects, faces, dates, and locations
- **Smart Albums**: AI-generated albums based on content analysis
- **Enhanced Person Management**: Bulk face assignment and training improvements
- **Export Functionality**: Share and export photos in various formats

## 🏗️ **Auto-Upload Architecture**

### **Environment Detection**
The app automatically detects whether it's running in Expo Go (development) or a standalone build (production):

```typescript
// AutoUploadService.ts
private checkEnvironment(): void {
  // In newer Expo SDK versions, standalone apps report as 'bare' instead of 'standalone'
  this.isStandalone = Constants.executionEnvironment === 'standalone' || 
                     Constants.executionEnvironment === 'bare';
  console.log('Running in', this.isStandalone ? 'standalone app' : 'Expo Go');
}
```

### **Smart Module Loading**
Native modules are conditionally loaded based on environment:

```typescript
// Only load native modules in standalone builds
if (this.isStandalone) {
  MediaLibrary = await import('expo-media-library');
  Network = await import('expo-network');
  TaskManager = await import('expo-task-manager');
  BackgroundFetch = await import('expo-background-fetch');
}
```

### **Graceful Degradation**
- **Expo Go**: Demo mode with simulated functionality and UI exploration
- **Standalone**: Full camera roll access, background processing, and real uploads

### **Upload Pipeline**
1. **Scan**: Monitor camera roll for new photos since last scan
2. **Queue**: Add new photos to upload queue with retry logic
3. **Network Check**: Verify WiFi/cellular based on user preferences
4. **Upload**: Process queue with configurable concurrency limits
5. **Track**: Monitor daily usage and apply limits

## 📡 **API Integration**

### **Core Endpoints**
- **Gallery**: `GET /api/gallery` - Photo listing with pagination
- **Media**: `GET /media/{id}` - Photo files and thumbnails
- **Upload**: `POST /api/upload` - Photo upload with processing
- **Persons**: `GET /api/persons` - Person management and assignment
- **Faces**: `POST /api/faces/{id}/assign` - Face-to-person assignment
- **Training**: `POST /api/compreface/train` - Trigger face recognition training

### **Auto-Upload Endpoints**
- **Upload Queue**: Uses existing upload endpoint with duplicate detection
- **Hash Verification**: Leverages platform's hash-based deduplication
- **Processing Integration**: Automatic AI processing (faces, objects, metadata)

## 🛠️ **Development Guide**

### **Environment Variables**
```bash
# config.ts
export const API_BASE = 'http://192.168.40.103:9000';
```

### **Building & Testing**
```bash
# Development build (Expo Go)
npx expo start

# Production build (Standalone)
eas build --platform ios --profile preview

# Install on device
# Download .ipa from EAS and install via Xcode
```

### **Debugging**
- **Demo Mode**: Test UI without native dependencies
- **Standalone Mode**: Test real camera roll and background processing
- **Network Testing**: Verify API connectivity from device
- **Permission Testing**: Ensure camera roll permissions work correctly

## 📱 **Technical Stack**

- **React Native**: Cross-platform mobile development
- **Expo SDK 53**: Development platform and build tools
- **TypeScript**: Type safety and developer experience
- **Expo Image**: High-performance image rendering with caching
- **AsyncStorage**: Persistent settings and queue storage
- **Native Modules**: Camera roll, network detection, background tasks