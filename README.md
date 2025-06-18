# Photo Management Platform

A self-hosted photo management platform with AI-powered face recognition, object detection, and smart organization capabilities.

## 🏗️ **Platform Architecture**

Modern microservices platform architecture with Docker orchestration:

```
photo-process/
├── VISION.md                    # Product vision and goals
├── docker-compose.platform.yml # Main Docker orchestration
├── services/                   # Microservices
│   ├── api/                   # TypeScript API service (worker threads, FileTracker)
│   ├── mobile-app/            # React Native mobile app (auto-upload, face recognition)
│   ├── processing/            # Background processing service (planned)
│   └── web-app/               # React frontend (planned)
├── infrastructure/            # Infrastructure as code
│   ├── database/             # MySQL with 20+ migrations
│   ├── compreface/           # Face recognition service (CompreFace)
│   └── search/               # Search service (planned)
├── platform-docs/           # Complete documentation + docs-site
├── platform-tests/          # Testing infrastructure (93 passing tests)
├── platform-tools/          # Development and maintenance tools
└── shared/                   # Shared resources and utilities
```

## 🚀 **Quick Start**

```bash
# 1. Start all services with Docker
npm run dev

# 2. Run database migrations
npm run db:migrate

# 3. Verify everything is working
curl http://localhost:9000/api/persons
curl http://localhost:8001  # CompreFace UI
```

### **Platform Status**
- ✅ **Backend API** - Full TypeScript API with face recognition and object detection
- ✅ **Mobile App** - Complete React Native app with auto-upload, face recognition, and photo management
- ✅ **Auto-Upload System** - Real-time camera roll sync with AI-powered processing
- ✅ **Geolocation System** - GPS-based photo location matching with 59 cities across 45,000+ worldwide
- ✅ **Database** - MySQL with complete schema (20+ migrations including geolocation tables)
- ✅ **AI Services** - CompreFace face recognition + YOLO object detection fully integrated
- ✅ **Worker Threads** - Non-blocking background processing for image analysis
- ✅ **FileTracker System** - Database-driven file discovery (8,358+ files tracked)
- ✅ **Docker Setup** - Complete container orchestration with development workflow
- ✅ **Tools & Testing** - Comprehensive development toolkit with 93 passing tests
- 🔄 **Frontend** - React app ready to be built in `services/web-app/`

## 📚 **Documentation**

- **[Product Vision](VISION.md)** - Core goals and user experience
- **[API Documentation](platform-docs/api/API.md)** - Complete API reference
- **[Configuration Guide](platform-docs/CONFIG.md)** - Setup and configuration
- **[Database Schema](platform-docs/DATABASE_SCHEMA.md)** - Tables and relationships
- **[Development Tools](platform-tools/README.md)** - Tools and utilities
- **[Testing Guide](platform-tests/README.md)** - Testing infrastructure

## 🔧 **Development Commands**

```bash
# Platform Management
npm run dev                     # Start all services
npm run dev:api                # Start API only  
npm run logs:api               # View API logs
npm run logs:processing        # View processing logs

# Database
npm run db:migrate             # Run migrations
npm run db:seed               # Seed database
npm run db:create-migration   # Create new migration

# Photo Processing  
curl http://localhost:9000/scan?limit=10        # Start scan
curl http://localhost:9000/scan/status          # Check status

# Mobile App Development (Linux → Mac → iPhone workflow)
cd services/mobile-app
bash sync-to-mac.sh            # Sync to Mac for building
# On Mac: npx expo start       # Run in Expo Go for development
# On Mac: eas build --platform ios --profile preview # Build standalone app

# Maintenance
npm run maintenance:retroactive  # Add features to existing photos
npm run cleanup:menu            # Interactive cleanup options

# Testing
npm run test:unit              # Unit tests
npm run test:integration       # Integration tests
npm run test:coverage         # Coverage report
```

## 🎯 **Vision & Goals**

**See [VISION.md](VISION.md) for complete product vision**

Core principles:
1. **Digital Independence** - Break free from Big Tech photo storage
2. **Smart Organization** - AI-powered face and object recognition  
3. **Reliable Self-Hosting** - Complete control over your photo data
4. **Modern Architecture** - Scalable microservices with Docker

## 🏁 **Current Features**

### ✅ **Core Platform**
- **Photo Processing**: Worker thread-based processing with EXIF extraction and thumbnail generation
- **Face Recognition**: CompreFace integration with person management, clustering, and training
- **Object Detection**: YOLO-based detection with confidence filtering and 80+ object classes
- **Geolocation System**: GPS-based location matching with 45,000+ cities worldwide
- **Smart Albums**: Auto-generated albums based on content analysis and metadata
- **Hash-Based Storage**: Deduplication and organized file structure prevents duplicates
- **Screenshot Detection**: Automatic identification and classification of screenshots
- **Astrophotography Detection**: Specialized detection for night sky and space photography
- **FileTracker System**: Database-driven file discovery replaces slow directory scanning

### ✅ **Mobile Application**
- **Photo Grid**: Infinite scroll gallery with thumbnail optimization and dominant color backgrounds
- **Photo Details**: Full-screen view with pinch-to-zoom, face detection visualization, and metadata display
- **Face Recognition**: Tap faces to assign to persons with real-time training integration
- **Photo Upload**: Camera and gallery selection with progress tracking and duplicate detection
- **Auto-Upload**: Real-time camera roll sync with background processing and network-aware uploading
- **Person Management**: Complete person assignment and training workflow
- **Map Integration**: GPS location display with OpenStreetMap tile compositing

### ✅ **Technical Infrastructure**
- **Worker Threads**: Non-blocking image processing prevents API blocking during CPU-intensive operations
- **FileTracker**: Database-indexed file discovery enables instant scanning of 8,358+ files
- **Structured Logging**: Category-based log files with JSON format for easy analysis
- **Docker Orchestration**: Complete development and production environment via Docker Compose
- **Migration System**: Comprehensive database migrations with automatic schema updates
- **Testing Suite**: 93 passing tests covering unit, integration, and end-to-end scenarios

### 🔄 **In Progress**
- **React Frontend**: Building user interface in `services/web-app/`
- **Advanced Search**: Enhanced search with filters and faceting
- **Smart Album Enhancement**: Auto-generation based on advanced content analysis

## 📱 **Mobile App**

### **React Native Application**
The mobile app provides a complete photo management experience with native iOS functionality:

**Key Features:**
- **Auto-Upload**: Automatic camera roll sync with AI processing
- **Face Recognition**: Tap faces to assign to persons
- **Photo Grid**: Infinite scroll with thumbnail optimization
- **Photo Details**: Full-screen view with metadata and GPS maps
- **Upload Management**: Camera/gallery selection with progress tracking

**Development Workflow:**
```bash
# Linux development → Mac build → iPhone testing
cd services/mobile-app
bash sync-to-mac.sh                    # Sync to Mac
# On Mac: eas build --platform ios     # Build standalone app
```

**Auto-Upload System:**
- **Environment Detection**: Demo mode in Expo Go, full functionality in standalone builds
- **Permissions**: Proper iOS permissions for camera roll and background processing
- **Network Awareness**: WiFi-only option with cellular fallback
- **Duplicate Prevention**: Uses same hash-based system as platform
- **Background Processing**: Continues uploading when app is closed

See `services/mobile-app/README.md` for complete mobile development guide.

## 📁 **Architecture Notes**

- **Service-Based**: Each service runs in its own container with clear boundaries
- **Docker First**: All development and deployment through Docker Compose
- **Configuration**: Single source of truth via `.env` with Docker overrides
- **Database**: MySQL with comprehensive migration system
- **Logging**: Structured logging with category-based log files
- **Testing**: Jest with comprehensive unit and integration tests

## 🚨 **Migration Complete**

This project was successfully migrated from a legacy monolith to the current platform architecture. All functionality has been preserved and enhanced with proper service separation and Docker orchestration.