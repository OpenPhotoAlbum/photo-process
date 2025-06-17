# Photo Management Platform

A self-hosted photo management platform with AI-powered face recognition, object detection, and smart organization capabilities.

## 🏗️ **Platform Architecture**

This project has been migrated to a modern microservices platform architecture:

```
photo-process/
├── services/            # 🚀 ACTIVE PLATFORM - Use this for all development
│   ├── services/        # Microservices (API, web-app, processing)
│   ├── infrastructure/  # Infrastructure as code (database, CompreFace, etc.)
│   ├── shared/          # Shared types, utilities, test data
│   ├── tools/           # Development and maintenance tools
│   ├── tests/           # Comprehensive testing suite
│   └── docs/            # Platform documentation
└── README.md            # This file
```

## 🚀 **Quick Start**

### **Active Platform** (Use this!)
```bash
cd photo-process/             # You're already in the active platform
npm install                   # Install dependencies
npm run dev:infrastructure    # Start database + CompreFace
npm run dev:api              # Start API service (in another terminal)
```

### **Platform Status**
- ✅ **Backend API** - Fully functional TypeScript API
- ✅ **Database** - MySQL with complete migration system
- ✅ **AI Services** - CompreFace face recognition working
- ✅ **Tools & Testing** - Comprehensive development toolkit
- 🔄 **Frontend** - React app ready to be built in `services/web-app/`

## 📚 **Documentation**

All current documentation is in the platform:

- **[Platform Overview](platform-readme.md)** - Complete platform guide
- **[API Documentation](platform-docs/api/API.md)** - API endpoints
- **[Configuration Guide](platform-docs/CONFIG.md)** - Setup and configuration
- **[Development Tools](platform-tools/README.md)** - Tools and utilities
- **[Testing Guide](platform-tests/README.md)** - Testing infrastructure

## 🔧 **Development**

### **Available Commands**
```bash
# Infrastructure
npm run dev                      # Start full platform
npm run dev:infrastructure       # Database + CompreFace only
npm run dev:api                  # API service only

# Database
npm run db:migrate              # Run migrations
npm run db:status               # Check database health

# Maintenance
npm run maintenance:retroactive  # Add features to existing images
npm run cleanup:menu            # Interactive cleanup

# Testing
npm run test:jest               # Run test suite
npm run test:unit               # Unit tests only
npm run test:integration        # Integration tests only
```

## 🎯 **Vision**

Building a self-hosted photo management platform that provides:

1. **Digital Independence** - Complete control over your photo data
2. **Smart Organization** - AI-powered face and object recognition
3. **Modern Architecture** - Scalable microservices platform
4. **Developer Experience** - Comprehensive tooling and documentation

## 📁 **Clean Architecture**

The platform uses a modern microservices architecture with clear separation of concerns. All development should use the platform structure with proper Docker orchestration.

## 🏁 **Next Steps**

1. **Explore the Platform**: `npm run dev`
2. **Build Frontend**: Create React app in `services/web-app/`
3. **Read Documentation**: Check `platform-docs/` for detailed guides
4. **Run Tests**: Verify everything with `npm run test:jest`

## 📋 **Migration Status**

- ✅ **Core Migration Complete** - All files and functionality migrated
- ✅ **Platform Working** - API, database, and AI services functional
- ✅ **Tools Migrated** - All maintenance and development tools
- ✅ **Tests Migrated** - Complete testing infrastructure
- ✅ **Documentation** - Comprehensive docs for new structure

**The platform is ready for frontend development!** 🚀