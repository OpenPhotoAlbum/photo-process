# Face Management Phase 2: Clean Slate Approach

## Current Status from Phase 1
- ✅ **96 persons** backed up to CSV
- ✅ **3 manually assigned faces** identified 
- ⚠️ **CompreFace** not responding but services restarted
- 🚨 **Core Issue**: Training uploads ALL faces, ignoring sync flags

## Phase 2 Objectives
1. **Clear CompreFace completely** - Remove all subjects and faces
2. **Create controlled upload system** - Only manually verified faces
3. **Add proper tracking** - Never upload same face twice
4. **Implement admin controls** - Let user choose what to train

## Implementation Steps

### Step 1: Analyze Current CompreFace Integration
- Find training code that uploads faces
- Identify where `compreface_synced` flag should be used
- Locate CompreFace API calls

### Step 2: Create New Database Schema
```sql
-- Add better tracking
ALTER TABLE detected_faces ADD COLUMN compreface_uploaded_at TIMESTAMP NULL;
CREATE TABLE face_training_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    face_id INT,
    person_id INT, 
    uploaded_at TIMESTAMP,
    compreface_response TEXT,
    FOREIGN KEY (face_id) REFERENCES detected_faces(id)
);
```

### Step 3: Clear CompreFace
- Remove all subjects from CompreFace
- Reset training state in database

### Step 4: Selective Upload System
- Create new training endpoint that only uploads manually confirmed faces
- Add deduplication logic
- Implement upload confirmation tracking

## Next Actions
1. Use search_codebase to find current training implementation
2. Create migration script for new schema
3. Build new selective training system
4. Test with small set of manually verified faces

---
*Phase 2 Started: 2025-06-21*