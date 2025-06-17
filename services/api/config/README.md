# Configuration Directory

This directory contains all configuration files for the Photo Processing Service. **No configuration defaults are hardcoded in source code** - everything is in this directory for easy discovery and management.

## Configuration Files

### `defaults.json` ⭐ **Default Values**
- **Purpose**: Fallback values for all configuration options
- **Priority**: Lowest (used when no other source provides a value)
- **Edit**: Safe to modify - these are your system defaults
- **Format**: JSON with comments explaining each section

### `settings.example.json` 📋 **Template**
- **Purpose**: Example configuration file with all available options
- **Usage**: Copy to `settings.json` for custom JSON-based configuration
- **Priority**: Higher than environment variables and defaults

### `settings.json` 🎛️ **Custom Configuration** 
- **Purpose**: Optional JSON-based configuration (if you prefer JSON over .env)
- **Priority**: Higher than environment variables, lower than runtime API
- **Usage**: `cp settings.example.json settings.json` and customize
- **Git**: Ignored by default (local-only configuration)

## Configuration Priority Order

Configuration values are applied in this order (later sources override earlier ones):

1. **`defaults.json`** - System defaults (this directory)
2. **Environment Variables** - `.env` file in project root  
3. **`settings.json`** - JSON config file (this directory)
4. **Runtime API** - Admin panel updates (future feature)

## Quick Reference

### View Current Configuration
```bash
npm run config:status          # Show current effective configuration
npm run config:validate        # Validate configuration
```

### Setup Configuration
```bash
npm run config:example         # Create .env from template
cp config/settings.example.json config/settings.json  # Create JSON config
```

### Migrate Legacy Configuration  
```bash
npm run config:migrate         # Migrate old variable names to new format
```

## Configuration Methods

Choose your preferred configuration method:

### Option 1: Environment Variables (Recommended)
- **File**: Project root `.env`
- **Format**: `KEY=value` 
- **Example**: `MYSQL_HOST=localhost`
- **Pros**: Simple, widely supported, good for containers
- **Cons**: Limited structure for complex values

### Option 2: JSON Configuration
- **File**: `config/settings.json`
- **Format**: Structured JSON
- **Example**: `{"database": {"host": "localhost"}}`
- **Pros**: Structured, supports comments, hierarchical
- **Cons**: More complex than environment variables

### Option 3: Hybrid Approach
- Use `defaults.json` for system defaults
- Use `.env` for environment-specific overrides
- Use `settings.json` for complex structured configuration
- Use runtime API for dynamic updates (when implemented)

## File Locations Summary

```
/mnt/hdd/photo-process/
├── .env                           # Environment variables (main config)
├── .env.example                   # Environment template
└── config/
    ├── README.md                  # This file
    ├── defaults.json             # ⭐ Default values (replaces hardcoded defaults)
    ├── settings.example.json     # JSON configuration template  
    └── settings.json             # Custom JSON configuration (optional)
```

## Legacy Support

The system maintains backward compatibility:
- Old variable names (`mysql_host`, `mysql_pass`, etc.) still work
- Helpful warnings suggest new standardized names
- Migration tool available: `npm run config:migrate`

## Granular Confidence Thresholds

The system now supports granular confidence thresholds for different workflows:

### Face Recognition Confidence Levels
- **Review Threshold** (0.75): Shows potential matches for manual review
- **Auto-Assign Threshold** (0.99): Automatically assigns faces without human review
- **Similarity Threshold** (0.65): Minimum similarity to consider faces as potential matches

### Object Detection Confidence Levels
- **Detection** (0.75): Minimum confidence to detect and save objects
- **Search** (0.5): Lower threshold for search results (more inclusive)
- **High Quality** (0.85): Threshold for featured/priority objects

### Face Detection Confidence Levels
- **Detection** (0.8): CompreFace API threshold for detecting faces
- **Review** (0.75): Minimum confidence to show in review queue
- **Auto-Assign** (0.99): Minimum confidence for automatic assignment
- **Gender/Age** (0.7): Prediction confidence thresholds

### Configuration Examples

```bash
# Face Recognition - Separate control for different workflows
FACE_RECOGNITION_CONFIDENCE_REVIEW=0.75         # Show matches for review
FACE_RECOGNITION_CONFIDENCE_AUTO_ASSIGN=0.99    # Auto-assign high confidence
FACE_RECOGNITION_CONFIDENCE_SIMILARITY=0.65     # Consider as potential match

# Object Detection - Different thresholds for different uses
OBJECT_DETECTION_CONFIDENCE_DETECTION=0.75      # Save to database
OBJECT_DETECTION_CONFIDENCE_SEARCH=0.5          # Show in search results
OBJECT_DETECTION_CONFIDENCE_HIGH_QUALITY=0.85   # Featured objects
```

### Workflow Control
- **Enable Auto-Assignment**: `FACE_RECOGNITION_ENABLE_AUTO_ASSIGNMENT=true`
- **Enable Review Queue**: `FACE_RECOGNITION_ENABLE_REVIEW_QUEUE=true`
- **Max Review Queue Size**: `FACE_RECOGNITION_MAX_REVIEW_QUEUE_SIZE=1000`

## Admin Panel Integration (Future)

When the admin panel is implemented:
- Runtime configuration updates will be stored in memory
- Changes can be persisted to `settings.json` via API
- Feature flag: `FEATURE_API_CONFIG=true` to enable admin endpoints