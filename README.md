# Photo Management Platform

A self-hosted photo management platform with AI-powered face recognition, object detection, and smart organization capabilities.

## 🏗️ **Platform Architecture**

Modern microservices platform architecture with Docker orchestration:

```
photo-process/
├── VISION.md                    # Product vision and goals
├── docker-compose.platform.yml # Main Docker orchestration
├── services/                   # Microservices
│   ├── api/                   # TypeScript API service
│   ├── mobile-app/            # React Native mobile app
│   ├── processing/            # Background processing service (planned)
│   └── web-app/               # React frontend (planned)
├── infrastructure/            # Infrastructure as code
│   ├── database/             # MySQL with migrations
│   ├── compreface/           # Face recognition service
│   └── search/               # Search service (planned)
├── platform-docs/           # Complete documentation
├── platform-tests/          # Testing infrastructure  
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
- ✅ **Mobile App** - React Native app with photo grid, thumbnails, and infinite scroll
- ✅ **Database** - MySQL with complete schema (15+ migrations)
- ✅ **AI Services** - CompreFace face recognition fully integrated
- ✅ **Docker Setup** - Complete container orchestration
- ✅ **Tools & Testing** - Comprehensive development toolkit
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

### ✅ **Implemented**
- **Photo Processing**: Batch processing with EXIF extraction, thumbnail generation
- **Face Recognition**: CompreFace integration with person management and clustering
- **Object Detection**: YOLO-based detection with confidence filtering
- **Smart Albums**: Auto-generated albums based on content analysis
- **Hash-Based Storage**: Deduplication and organized file structure
- **Screenshot Detection**: Automatic identification and classification
- **Astrophotography Detection**: Specialized detection for night sky photos

### 🔄 **In Progress**
- **React Frontend**: Building user interface in `services/web-app/`
- **Advanced Search**: Enhanced search with filters and faceting
- **Performance Optimization**: Background processing improvements

## 📁 **Architecture Notes**

- **Service-Based**: Each service runs in its own container with clear boundaries
- **Docker First**: All development and deployment through Docker Compose
- **Configuration**: Single source of truth via `.env` with Docker overrides
- **Database**: MySQL with comprehensive migration system
- **Logging**: Structured logging with category-based log files
- **Testing**: Jest with comprehensive unit and integration tests

## 🚨 **Migration Complete**

This project was successfully migrated from a legacy monolith to the current platform architecture. All functionality has been preserved and enhanced with proper service separation and Docker orchestration.