// Test types to avoid importing actual modules that have side effects

export enum JobPriority {
    LOW = 1,
    NORMAL = 2,
    HIGH = 3,
    URGENT = 4
}

export enum JobStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

export interface BatchJob {
    id: string;
    type: 'image_processing' | 'face_detection' | 'object_detection' | 'smart_albums';
    priority: JobPriority;
    status: JobStatus;
    data: any;
    progress: number;
    totalItems: number;
    processedItems: number;
    failedItems: number;
    errors: string[];
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    estimatedTimeRemaining?: number;
    onProgress?: (job: BatchJob) => void;
}

export interface SmartAlbum {
    id: number;
    name: string;
    slug: string;
    description?: string;
    type: 'object_based' | 'person_based' | 'time_based' | 'metadata_based';
    rules: any;
    is_active: boolean;
    is_system: boolean;
    priority: number;
    cover_image_hash?: string;
    image_count: number;
    last_updated: Date;
    created_at: Date;
    updated_at: Date;
}

export interface Image {
    id?: number;
    filename: string;
    original_path: string;
    relative_media_path: string;
    file_hash: string;
    file_size: number;
    mime_type: string;
    width: number;
    height: number;
    dominant_color: string;
    date_taken: Date;
    created_at: Date;
    processing_status: string;
    is_screenshot: boolean;
    is_astrophotography: boolean;
    astro_detected_at?: Date;
    migration_status: string;
}

export interface DetectedObject {
    id: number;
    image_id: number;
    class: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
    created_at: Date;
}

export interface DetectedFace {
    id: number;
    image_id: number;
    person_id?: number;
    face_image_path: string;
    relative_face_path: string;
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
    detection_confidence: number;
    predicted_gender: string;
    gender_confidence: number;
    age_min: number;
    age_max: number;
    age_confidence: number;
    pitch: number;
    roll: number;
    yaw: number;
    landmarks: string;
    face_embedding: string;
    created_at: Date;
}