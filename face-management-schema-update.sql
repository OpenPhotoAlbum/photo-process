-- Face Management Schema Updates for Phase 2
-- Adds proper tracking for CompreFace uploads

-- Add timestamp for when face was uploaded to CompreFace
ALTER TABLE detected_faces ADD COLUMN compreface_uploaded_at TIMESTAMP NULL;

-- Create detailed training log table
CREATE TABLE face_training_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    face_id INT NOT NULL,
    person_id INT NOT NULL,
    upload_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    upload_success BOOLEAN DEFAULT FALSE,
    compreface_response TEXT,
    error_message TEXT,
    training_job_id INT,
    FOREIGN KEY (face_id) REFERENCES detected_faces(id),
    FOREIGN KEY (person_id) REFERENCES persons(id),
    INDEX idx_face_upload (face_id, upload_success),
    INDEX idx_person_upload (person_id, upload_success),
    INDEX idx_upload_date (upload_attempt_at)
);

-- Add index for faster queries on synced faces
CREATE INDEX idx_compreface_synced ON detected_faces(compreface_synced, person_id);
CREATE INDEX idx_compreface_uploaded ON detected_faces(compreface_uploaded_at, person_id);

-- Add flag to control which persons can be auto-trained
ALTER TABLE persons ADD COLUMN allow_auto_training BOOLEAN DEFAULT FALSE;

-- Update existing manually assigned faces to be marked as "ready for training"
UPDATE detected_faces 
SET compreface_synced = FALSE, compreface_uploaded_at = NULL 
WHERE assigned_by = 'user';