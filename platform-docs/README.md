# Platform Documentation

This directory contains all documentation for the photo management platform.

## Structure

```
docs/
├── README.md                    # This file - documentation index
├── api/
│   └── API.md                  # Complete API documentation
├── thunder-client/
│   ├── thunder-client-collection.json     # API test collection
│   └── thunder-client-environment.json    # API test environments
├── CONFIG.md                   # Configuration guide
├── DATABASE_SCHEMA.md          # Database schema documentation
└── DEVELOPMENT_NOTES.md        # Development thoughts and notes
```

## Quick Reference

### API Documentation
- **[API.md](api/API.md)** - Complete API endpoint documentation
- **[Thunder Client](thunder-client/)** - Import these files into Thunder Client for API testing

### Configuration
- **[CONFIG.md](CONFIG.md)** - Configuration options and setup guide
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Database tables and relationships

### Development
- **[DEVELOPMENT_NOTES.md](DEVELOPMENT_NOTES.md)** - Development thoughts, ideas, and TODOs

## External Documentation

Additional documentation can be found in:

- **[Platform README](../README.md)** - Main platform overview
- **[API Service README](../services/api/README.md)** - API service specific documentation
- **[Platform Tools README](../platform-tools/README.md)** - Development and maintenance tools
- **[Platform Tests README](../platform-tests/README.md)** - Testing suite documentation

## Recent Updates

### FileTracker System (Latest)
- **Ultra-fast file discovery**: Database-driven file indexing replaces slow directory scanning
- **Performance boost**: 8,358+ files discovered instantly (<100ms) vs. minutes of directory traversal
- **Real-time tracking**: Processing status monitoring for all files
- **See**: DATABASE_SCHEMA.md for `file_index` table documentation

## Getting Started

1. **API Testing**: Import Thunder Client collections for interactive API testing
2. **Configuration**: Review CONFIG.md for environment setup
3. **Database**: Check DATABASE_SCHEMA.md for data structure (including new FileTracker system)
4. **Development**: Read DEVELOPMENT_NOTES.md for current development context

## Contributing

When adding new documentation:

1. Keep it organized by category (api/, infrastructure/, etc.)
2. Update this README.md index
3. Use clear, descriptive filenames
4. Include examples where helpful
5. Link between related documents