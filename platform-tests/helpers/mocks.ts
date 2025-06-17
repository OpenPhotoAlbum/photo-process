import { BatchJob, JobStatus, JobPriority, SmartAlbum, Image, DetectedObject, DetectedFace } from './types';

// Mock batch jobs
export const createMockBatchJob = (overrides: Partial<BatchJob> = {}): BatchJob => ({
  id: 'test-job-001',
  type: 'image_processing',
  priority: JobPriority.NORMAL,
  status: JobStatus.PENDING,
  data: { filePaths: ['/test/image1.jpg', '/test/image2.jpg'] },
  progress: 0,
  totalItems: 2,
  processedItems: 0,
  failedItems: 0,
  errors: [],
  createdAt: new Date('2025-01-01T10:00:00Z'),
  startedAt: undefined,
  completedAt: undefined,
  estimatedTimeRemaining: undefined,
  ...overrides
});

// Mock smart albums
export const createMockSmartAlbum = (overrides: Partial<SmartAlbum> = {}): SmartAlbum => ({
  id: 1,
  name: 'Test Album',
  slug: 'test-album',
  description: 'A test album',
  type: 'object_based',
  rules: { requiredObjects: ['cat', 'dog'], minConfidence: 0.7 },
  is_active: true,
  is_system: false,
  priority: 100,
  cover_image_hash: undefined,
  image_count: 0,
  last_updated: new Date('2025-01-01T10:00:00Z'),
  created_at: new Date('2025-01-01T10:00:00Z'),
  updated_at: new Date('2025-01-01T10:00:00Z'),
  ...overrides
});

// Mock images
export const createMockImage = (overrides: Partial<Image> = {}): Image => ({
  id: 1,
  filename: 'test-image.jpg',
  original_path: '/test/source/test-image.jpg',
  relative_media_path: '2025/01/test-image_abc123.jpg',
  file_hash: 'abc123def456',
  file_size: 1024000,
  mime_type: 'image/jpeg',
  width: 1920,
  height: 1080,
  dominant_color: '#3366cc',
  date_taken: new Date('2025-01-01T10:00:00Z'),
  created_at: new Date('2025-01-01T10:00:00Z'),
  processing_status: 'completed',
  is_screenshot: false,
  is_astrophotography: false,
  astro_detected_at: undefined,
  migration_status: 'copied',
  // smart_albums_processed_at: new Date('2025-01-01T10:00:00Z'),
  // smart_album_count: 1,
  ...overrides
});

// Mock detected objects
export const createMockDetectedObject = (overrides: Partial<DetectedObject> = {}): DetectedObject => ({
  id: 1,
  image_id: 1,
  class: 'cat',
  confidence: 0.85,
  x: 100,
  y: 150,
  width: 200,
  height: 250,
  created_at: new Date('2025-01-01T10:00:00Z'),
  ...overrides
});

// Mock detected faces
export const createMockDetectedFace = (overrides: Partial<DetectedFace> = {}): DetectedFace => ({
  id: 1,
  image_id: 1,
  person_id: undefined,
  face_image_path: '/test/faces/face_001.jpg',
  relative_face_path: 'faces/2025/01/face_001.jpg',
  x_min: 100,
  y_min: 150,
  x_max: 300,
  y_max: 350,
  detection_confidence: 0.95,
  predicted_gender: 'female',
  gender_confidence: 0.8,
  age_min: 25,
  age_max: 35,
  age_confidence: 0.7,
  pitch: 0.1,
  roll: 0.05,
  yaw: -0.1,
  landmarks: '{"nose": [200, 250], "eyes": [[150, 200], [250, 200]]}',
  face_embedding: '[0.1, 0.2, 0.3, ...]',
  created_at: new Date('2025-01-01T10:00:00Z'),
  ...overrides
});

// Mock file system operations
export const mockFileSystem = {
  existsSync: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  copyFile: jest.fn()
};

// Mock database operations
export const mockDatabase = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
  first: jest.fn(),
  then: jest.fn()
};

// Mock external services
export const mockCompreFace = {
  detectFaces: jest.fn(),
  addFaceToSubject: jest.fn(),
  createSubject: jest.fn(),
  recognizeFaces: jest.fn()
};

export const mockTensorFlow = {
  loadModel: jest.fn(),
  detectObjects: jest.fn()
};

// Mock logger
export const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Helper to reset all mocks
export const resetAllMocks = () => {
  Object.values(mockFileSystem).forEach(mock => mock.mockReset());
  Object.values(mockDatabase).forEach(mock => mock.mockReset());
  Object.values(mockCompreFace).forEach(mock => mock.mockReset());
  Object.values(mockTensorFlow).forEach(mock => mock.mockReset());
  Object.values(mockLogger).forEach(mock => mock.mockReset());
};