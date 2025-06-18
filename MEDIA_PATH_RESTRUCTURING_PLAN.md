# Media Path Restructuring Plan

## Overview

This document outlines the comprehensive plan to flatten the media path structure in the Photo Management Platform, removing source path fragments and creating a clean, date-based organization system.

## Current Problem Analysis

### Current Issues
- Media URLs contain source path fragments: `/media/cayce/iphone/recents/filename.jpg`
- Inconsistent path structure between legacy and hash-based systems
- Thumbnails mirror complex source directory trees
- Face crops scattered with inconsistent naming

### Current Structure Examples
```
/media/cayce/iphone/recents/2021-08-24_12-09-10_651514150.789007_original.jpg
/media/stephen/iphone/recents/2023-05-27_18-29-50_2691363f-a460-4c93-8143-41949df79820.jpg
```

## Proposed Flattened Structure

### New URL Structure
```
/media/2021/08/2021-08-24_12-09-10_651514150_789007_original_a1b2c3d4.jpg
/media/2023/05/2023-05-27_18-29-50_2691363f_a460_4c93_8143_41949df79820_e5f6g7h8.jpg
```

### Directory Structure
```
processedDir/
├── media/
│   ├── 2021/
│   │   ├── 08/
│   │   │   ├── 2021-08-24_12-09-10_651514150_789007_original_a1b2c3d4.jpg
│   │   │   └── 2021-08-24_12-03-14_651513794_301643_original_b2c3d4e5.jpg
│   │   └── 09/
│   ├── 2023/
│   │   └── 05/
│   │       └── 2023-05-27_18-29-50_2691363f_a460_4c93_8143_41949df79820_e5f6g7h8.jpg
├── faces/
│   ├── 2021-08-24_12-09-10_651514150_789007_original_a1b2c3d4__face_0.jpg
│   └── 2023-05-27_18-29-50_2691363f_a460_4c93_8143_41949df79820_e5f6g7h8__face_0.jpg
└── thumbnails/
    ├── 2021/
    │   └── 08/
    │       └── 2021-08-24_12-09-10_651514150_789007_original_a1b2c3d4_thumb.jpg
    └── 2023/
        └── 05/
            └── 2023-05-27_18-29-50_2691363f_a460_4c93_8143_41949df79820_e5f6g7h8_thumb.jpg
```

## Benefits of This Approach

1. **Clean URLs**: No source path fragments, date-based organization
2. **Consistent Structure**: All media follows same pattern regardless of source
3. **Easy Backup/Sync**: Simple date-based hierarchy for external tools
4. **Path Independence**: No dependency on original source directory structure
5. **Future-Proof**: Scales well as more sources are added

## Migration Strategy

### Phase 1: Planning & Preparation

#### Database Schema Updates
- Add new fields: `flattened_media_path`, `flattened_thumbnail_path`, `flattened_face_path`
- Keep existing fields for rollback capability
- Add migration status tracking

#### Path Generation Updates
- Update `HashManager` to generate flattened paths
- Use `date_taken` or `date_processed` for year/month organization
- Ensure consistent filename generation with hash suffixes

#### API Updates
- Update `getMediaUrl()`, `getThumbnailUrl()`, `getFaceUrl()` helpers
- Modify media serving logic to support both old and new paths during transition
- Update gallery API to return new URLs

### Phase 2: Implementation

#### File Migration Script
- Create script to copy/move files from current locations to flattened structure
- Verify file integrity with hash checking
- Update database records with new paths
- Handle conflicts and errors gracefully

#### Database Migration
- Run database migration to add new path fields
- Populate new fields based on existing data and file locations
- Update API to prefer new paths when available

#### API Route Updates
- Update media serving to check flattened paths first
- Maintain fallback to legacy paths for compatibility
- Update thumbnail generation to use new structure

### Phase 3: Validation & Cleanup

#### Testing & Validation
- Verify all media accessible via new URLs
- Test mobile app with new structure
- Check face recognition and thumbnail generation
- Validate database consistency

#### Legacy Cleanup
- After validation period, remove old file copies
- Drop legacy path fields from database
- Remove legacy path support from API

## Migration Script Approach

### Key Components
1. **File Analysis**: Scan database for all media records
2. **Path Generation**: Generate new flattened paths based on dates
3. **File Operations**: Copy/move files to new locations with verification
4. **Database Updates**: Update all path references in database
5. **Rollback Capability**: Keep old files until validation complete

### Affected Systems
- Database records (media_url, thumbnail_url, face paths)
- Physical files in `/dest` directory
- API URL generation
- Media serving logic
- Face crop file references
- Thumbnail generation system

## Implementation Order

1. **Database Schema Migration**: Add new path fields
2. **HashManager Updates**: Generate flattened paths
3. **File Migration Script**: Move files to new structure
4. **API Updates**: Support both old and new paths
5. **Mobile App Testing**: Verify compatibility
6. **Legacy Cleanup**: Remove old files and path support

## Risk Mitigation

1. **Backup Strategy**: Full backup before migration
2. **Dual Path Support**: Maintain both systems during transition
3. **Rollback Plan**: Ability to revert to legacy structure
4. **Incremental Migration**: Process in batches with validation
5. **Testing**: Extensive testing with real data before production

## Technical Implementation Details

### Current System Analysis

#### Database Schema - Media Path Fields

**Legacy Path Fields (in `images` table):**
- `original_path` - Full path to source file
- `processed_path` - Full path to processed file (legacy, rarely used)
- `thumbnail_path` - Full path to thumbnail file (legacy system)

**Hash-Based Path Fields (in `images` table):**
- `relative_media_path` - Relative path in organized structure
- `relative_meta_path` - Relative path to metadata JSON (deprecated)
- `source_filename` - Original filename without path
- `file_hash` - SHA-256 content hash
- `migration_status` - Status of migration to hash system

**Face Path Fields (in `detected_faces` table):**
- `face_image_path` - Full path to extracted face image (legacy)
- `relative_face_path` - Relative path to face image (hash-based)

#### Processing Pipeline Components

1. **Hash Manager** (`services/api/util/hash-manager.ts`)
   - Calculates SHA-256 file hashes
   - Generates organized date-based directory structure (YYYY/MM)
   - Creates hash-based filenames: `{originalName}_{8charHash}.{ext}`

2. **Process Source** (`services/api/util/process-source.ts`)
   - Main processing pipeline entry point
   - Checks for duplicates by hash
   - Copies files to organized structure
   - Generates hash-based face files

3. **Media Serving** (`services/api/routes/media.ts`)
   - Detects hash-based requests using pattern `\d{4}/\d{2}/.+`
   - Hash-based files served from `processedDir/media/`
   - Legacy files served from either `processedDir/` or `sourceDir/`

### Migration Database Schema

#### New Fields to Add

**To `images` table:**
```sql
ALTER TABLE images ADD COLUMN flattened_media_path VARCHAR(500);
ALTER TABLE images ADD COLUMN flattened_thumbnail_path VARCHAR(500);
ALTER TABLE images ADD COLUMN path_migration_status ENUM('pending', 'migrated', 'verified', 'failed') DEFAULT 'pending';
```

**To `detected_faces` table:**
```sql
ALTER TABLE detected_faces ADD COLUMN flattened_face_path VARCHAR(500);
```

#### Path Generation Logic

**Date-Based Organization:**
- Use `date_taken` if available, fallback to `date_processed`
- Format: `YYYY/MM/` directory structure
- Filename: `{originalName}_{8charHash}.{ext}`

**Face Path Generation:**
- Base filename from media file
- Pattern: `{mediaBaseName}__face_{index}.jpg`
- Directory: `faces/` (flattened, no date hierarchy for simplicity)

**Thumbnail Path Generation:**
- Mirror media path structure
- Pattern: `{mediaBaseName}_thumb.jpg`
- Directory: `thumbnails/YYYY/MM/`

## Configuration Impact

### Storage Configuration Updates

**Current Configuration:**
```typescript
storage: {
    sourceDir: "/mnt/sg1/uploads/",
    processedDir: "/mnt/hdd/photo-process/dest/processed",
    thumbnailDir: null, // Uses processedDir/thumbnails
    cacheDir: "/mnt/hdd/photo-process/dest/cache",
    logsDir: "/external/photos/logs"
}
```

**Post-Migration Configuration:**
- No changes to configuration structure
- All paths remain relative to `processedDir`
- Migration transparent to configuration system

## Testing Strategy

### Pre-Migration Testing
1. **Database Backup**: Full backup of current database
2. **File System Backup**: Backup of `/dest` directory
3. **API Testing**: Comprehensive test of current functionality
4. **Mobile App Testing**: Verify current mobile app functionality

### Migration Testing
1. **Small Batch Test**: Migrate 10-20 images first
2. **API Verification**: Test all endpoints with migrated images
3. **Mobile App Testing**: Verify mobile app works with new URLs
4. **Face Recognition Testing**: Verify face crops and recognition work
5. **Thumbnail Testing**: Verify thumbnail generation and serving

### Post-Migration Testing
1. **Full System Test**: Test all functionality with migrated data
2. **Performance Testing**: Compare performance before/after migration
3. **Data Integrity**: Verify all images accessible and correct
4. **Rollback Testing**: Verify rollback capability if needed

## Rollback Plan

### Rollback Triggers
- Data corruption detected
- Significant performance degradation
- Critical functionality broken
- Mobile app compatibility issues

### Rollback Process
1. **Stop Processing**: Halt all new image processing
2. **Database Rollback**: Restore database from pre-migration backup
3. **File System Rollback**: Restore files from backup if necessary
4. **API Rollback**: Revert API changes to use legacy paths
5. **Verification**: Verify system restored to pre-migration state

### Rollback Prevention
- Comprehensive testing before migration
- Incremental migration approach
- Dual path support during transition
- Extensive validation at each step

---

**Status**: PLANNING PHASE - Documented but not yet implemented
**Next Steps**: Await approval to proceed with implementation
**Estimated Timeline**: 1-2 weeks for full implementation and validation