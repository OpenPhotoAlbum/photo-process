# Phase 2: Clean Slate Face Training Implementation

## Overview
Phase 2 implements a complete overhaul of CompreFace face training to address the core issue: excessive duplicate face uploads and lack of user control over what gets trained.

## Problem Solved
- **Henry Issue**: 1,616+ faces in CompreFace vs 1,445 in database due to re-uploading all faces on every training run
- **No Selective Control**: Users couldn't choose which faces to train
- **Missing Tracking**: No logging of what faces were uploaded when
- **Ignored Sync Flags**: System uploaded all faces regardless of `compreface_synced` status

## ✅ Implementation Completed

### 1. Database Schema Enhancement
**Migration Applied**: `20250621214006_face_management_cleanup.js`
- Added `compreface_uploaded_at` timestamp to `detected_faces`
- Created `face_training_log` table for detailed upload tracking
- Added `allow_auto_training` flag to `persons` table
- Added proper indexes for performance

### 2. CompreFace Cleanup Tool
**File**: `platform-tools/cleanup/cleanup-compreface-complete.js`
- Removes ALL subjects from CompreFace
- Resets all `compreface_synced` flags to false
- Clears all `compreface_uploaded_at` timestamps
- Creates backups before cleanup
- Interactive confirmation for safety

### 3. Selective Training Service
**File**: `services/api/util/selective-training.ts`
- **SelectiveTrainingService** class with controlled face uploads
- Only uploads faces with `assigned_by = 'user'` (manually verified)
- Checks `compreface_synced` flag to prevent duplicates
- Logs every upload attempt in `face_training_log`
- Sets `compreface_uploaded_at` timestamp on success
- Detailed error handling and logging

### 4. New API Endpoints
**File**: `services/api/routes/selective-training.ts`
```
POST   /api/training/selective/:personId              - Train person with only manual faces
GET    /api/training/selective/:personId/stats        - Get training statistics
POST   /api/training/selective/:personId/reset        - Reset training state
GET    /api/training/selective/:personId/manual-faces - List manually assigned faces
GET    /api/training/selective/:personId/log          - View training upload log
POST   /api/training/selective/batch                  - Batch train multiple people
POST   /api/training/selective/:personId/auto-training - Enable/disable auto-training
```

## Key Features

### Selective Training Options
```typescript
interface SelectiveTrainingOptions {
    onlyManuallyAssigned: boolean;     // Default: true
    maxFacesPerPerson?: number;        // Optional limit
    allowDuplicateUploads?: boolean;   // Default: false
}
```

### Comprehensive Logging
Every face upload attempt is logged with:
- Face ID and Person ID
- Upload success/failure status
- CompreFace response
- Error messages
- Timestamp

### Training Statistics
Per-person stats include:
- Total faces in database
- Manually assigned faces
- Successfully uploaded faces
- Pending faces (manual but not uploaded)
- Failed upload attempts

### Safety Controls
- **Manual Assignment Required**: Only `assigned_by = 'user'` faces are uploaded
- **Duplicate Prevention**: `compreface_synced` flag prevents re-uploads
- **Reset Capability**: Complete training state reset per person
- **Auto-Training Control**: Per-person flag to allow/disallow automatic training

## Usage Example

### Clean Slate Process
1. **Run cleanup** (removes all CompreFace subjects):
   ```bash
   node platform-tools/cleanup/cleanup-compreface-complete.js
   ```

2. **Train specific person** with only manual faces:
   ```bash
   curl -X POST http://localhost:9000/api/training/selective/1 \
     -H "Content-Type: application/json" \
     -d '{"onlyManuallyAssigned": true, "maxFacesPerPerson": 10}'
   ```

3. **Check training stats**:
   ```bash
   curl http://localhost:9000/api/training/selective/1/stats
   ```

4. **View upload log**:
   ```bash
   curl http://localhost:9000/api/training/selective/1/log
   ```

## Benefits

### For Users
- **Complete Control**: Choose exactly which faces to train
- **No Duplicates**: Never upload the same face twice
- **Transparency**: See exactly what was uploaded when
- **Rollback Capability**: Reset training state completely

### For System
- **Clean State**: Fresh start with known good data
- **Performance**: No wasted uploads or storage
- **Debugging**: Detailed logs for troubleshooting
- **Scalability**: Controlled growth of training data

## Next Steps

### Ready for Testing
1. Start API server: `docker compose -f docker-compose.platform.yml up -d api`
2. Run cleanup script to clear CompreFace
3. Test selective training with manually assigned faces
4. Verify no duplicates are created

### Future Enhancements
- Web UI for selective training management
- Bulk face assignment tools
- Training quality metrics
- CompreFace model performance tracking

## Migration Path

### From Old System
1. **Backup current state** (done in cleanup script)
2. **Run cleanup script** to reset CompreFace
3. **Use selective training** for new uploads
4. **Gradually migrate** existing manually assigned faces

### Backward Compatibility
- Old training endpoints still work (for now)
- Can run both systems in parallel during transition
- Mobile app can use new endpoints when ready

---

**Status**: ✅ Implementation Complete - Ready for Testing
**Created**: 2025-06-21
**Phase**: 2 - Clean Slate Approach