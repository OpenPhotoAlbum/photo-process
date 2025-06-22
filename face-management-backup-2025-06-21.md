# Face Management Backup - June 21, 2025

## Current Situation
- **Issue**: CompreFace has excessive faces (especially Henry) compared to database
- **Root Cause**: System re-uploads ALL faces on every training run, ignoring `compreface_synced` flag
- **Impact**: Data integrity issues and inefficient training

## Pre-Cleanup State Documentation

### Assessment Status
- **Database Access**: ⚠️ API not responding - services may be down
- **CompreFace Access**: ⚠️ Unable to connect during assessment
- **Data Integrity**: 🚨 Known issues with duplicate uploads

### Known Issues from Previous Analysis
1. **Henry**: 1,445 faces in DB but 1,616+ in CompreFace training logs
2. **Training Process**: Uploads all faces regardless of `compreface_synced` status
3. **Duplicate Detection**: Missing - same faces uploaded multiple times
4. **Manual vs Auto**: Need to prioritize manually assigned faces only

### Database Schema (from previous analysis)
```sql
-- Key tables involved
detected_faces:
- id, image_id, person_id, assigned_by, compreface_synced
- compreface_synced column EXISTS but not used in training

persons:
- id, name, face_count, training status

training_history:
- Tracks training attempts but not individual face uploads
```

## Backup Strategy

### Phase 1 Requirements
1. ✅ **Document current state** - This file
2. ✅ **Export person/face mappings** - face-backup-persons-2025-06-21.csv (96 persons)
3. ⚠️ **Backup CompreFace state** - CompreFace API not responding
4. ✅ **Identify manually verified faces** - Found via API: assigned_by = 'user'

### Exported Data Files
- **face-backup-persons-2025-06-21.csv**: 96 persons with face counts and training status
- **Key findings**: Henry has 1,445 faces, Cayce has 629, many persons have 0 faces

## Next Steps
1. **Start services** if not running
2. **Export current database state** to CSV files
3. **Document CompreFace subjects/faces** via API
4. **Create restore scripts** for rollback capability

## Recovery Plan
If we need to rollback:
1. Use CSV exports to restore database state
2. Use CompreFace backup to restore subjects
3. Use training history to verify face counts

---
*Created: 2025-06-21*
*Purpose: Pre-cleanup documentation for face management overhaul*