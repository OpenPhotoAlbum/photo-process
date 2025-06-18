# Development Notes

This document contains development thoughts, architecture decisions, and technical notes for the photo management platform.

## Current Architecture Status

### ✅ Completed Migration
- **Platform Structure**: Successfully migrated from legacy monolith to microservices
- **Docker Orchestration**: Complete container setup with docker-compose.platform.yml
- **Database**: 15+ migrations successfully applied, MySQL 8.0 running
- **API Service**: Full TypeScript API with face recognition and object detection
- **FileTracker System**: Database-driven file discovery replacing slow directory scanning
- **Configuration**: Single source of truth via .env with Docker overrides
- **Documentation**: Comprehensive platform docs and Thunder Client collection

### 🔄 Current Development Focus
- **Frontend Development**: React app ready to be built in `services/web-app/`
- **Performance Optimization**: Background processing improvements
- **Advanced Search**: Enhanced search with filters and faceting

## Technical Decisions

### Service Architecture
- **API Service**: TypeScript with Express.js, handles all business logic
- **Database Service**: MySQL 8.0 with Knex.js migrations
- **CompreFace Service**: External face recognition service via Docker
- **Processing Service**: Planned background processing service

### Configuration Strategy
- **Priority Order**: Runtime API > JSON Config > Environment Variables > Defaults
- **Environment Variables**: Primary configuration method via .env file
- **Docker Overrides**: Minimal overrides for container-specific values only
- **Validation**: Startup validation ensures all required configuration is present

### Data Organization
- **Hash-Based Storage**: All files organized by hash to prevent duplicates
- **Database Storage**: All metadata in MySQL, no JSON files
- **FileTracker System**: `file_index` table provides instant file discovery (8,358+ files in <100ms)
- **Structured Logging**: Category-based log files with daily rotation
- **API-First**: Clean backend APIs with no frontend dependencies
- Standardize response body schemas across similar endpoints
- Include "total count" vs "returned count" for searches and lists
- Consistent patterns for pagination, filtering, sorting

### Architecture Evolution
- **Microservice Architecture**:
  - Separate API service
  - CompreFace service
  - Processing service
  - All running in Docker containers
- **Caching Layer**: Consider Elastic Cache for performance

### Technical Improvements
- **Face Clustering Enhancement**: Ensure clustering uses CompreFace recognition to compare faces
  - Include unidentified/unknown faces (but not "not a face" entries)

## Project Reorganization Plan

### Current Issues
The project has grown organically and suffers from organizational issues:

1. **Root Directory Chaos**: 25+ files scattered in root (scripts, logs, configs, data)
2. **Data Storage Strategy**: Processed photos (potentially GBs) mixed with source code 
3. **Script Proliferation**: 15+ utility scripts with no clear organization
4. **Configuration Scattered**: Multiple config approaches across files
5. **Runtime vs Development**: No clear separation of concerns

### Proposed Directory Structure
```
/mnt/hdd/photo-process/
├── README.md                    # Main project documentation
├── package.json                 
├── tsconfig.json
├── .env                         # Environment config only
├── 
├── src/                         # Application source code
├── build/                       # Compiled TypeScript
├── 
├── tools/                       # Development & maintenance tools
│   ├── database/
│   │   ├── migrate.sh
│   │   ├── seed.sh
│   │   └── create-*.sh
│   ├── cleanup/
│   │   └── cleanup-*.js
│   ├── maintenance/
│   │   ├── fix-dates.js
│   │   ├── migrate-*.js
│   │   └── retroactive-process.js
│   └── testing/
│       └── test-*.js
├── 
├── config/                      # All configuration
│   ├── knexfile.js
│   ├── database.js
│   └── docker/
│       └── docker-compose.*.yml
├── 
├── database/                    # Schema & migrations
│   ├── migrations/
│   └── seeds/
└── docs/                        # All documentation
    ├── SETUP.md
    ├── API.md
    └── DEPLOYMENT.md
```

### External Data Strategy
Move data outside project directory:
```
/var/lib/photo-process/          # or /mnt/data/photo-process/
├── source/                      # Input photos
├── processed/                   # Processed outputs  
├── thumbnails/                  # Generated thumbnails
├── cache/                       # Temporary processing files
└── logs/                        # All application logs
```

### Implementation Phases

**Phase 1 (High Impact, Low Risk)**:
1. Move all scripts to `tools/` directory
2. Move logs to external `logs/` directory 
3. Organize documentation in `docs/`
4. Add npm scripts for common operations

**Phase 2 (Medium Impact, Medium Risk)**:
1. Move processed data to external location
2. Consolidate configuration system
3. Enhance Docker Compose setup
4. Add comprehensive .env.example

**Phase 3 (High Impact, Higher Risk)**:
1. Implement structured logging
2. Add configuration validation
3. Create deployment scripts
4. Add automated testing workflow

### Benefits
- **Professionalism**: Clean, standard project structure
- **Maintainability**: Clear separation of concerns
- **Scalability**: Easy to add new features without clutter
- **Team Collaboration**: Standard structure any developer can understand
- **Deployment**: Clear separation of code vs. data for production

## Work Notes

### Face Clustering Context
When context limit reached during clustering work:
```bash
curl -X POST http://localhost:9000/api/clustering/start \
  -H "Content-Type: application/json" \
  -d '{"rebuild": false}'
```

Remember: Face clustering should use CompreFace recognition feature to compare faces, include unidentified/unknown faces, but exclude "not a face" entries.