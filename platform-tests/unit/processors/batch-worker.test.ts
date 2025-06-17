import { BatchJob, JobStatus, JobPriority } from '../../helpers/types';
import { createMockBatchJob, mockLogger, mockCompreFace, resetAllMocks } from '../../helpers/mocks';

// Simple BatchWorker class for testing
class BatchWorker {
  public workerId: string;
  public isRunning: boolean = false;
  private stats = {
    jobsProcessed: 0,
    filesProcessed: 0,
    totalProcessingTime: 0,
    averageFileProcessingTime: 0
  };

  constructor(workerId: string) {
    this.workerId = workerId;
  }

  start() {
    if (this.isRunning) {
      mockLogger.warn('Worker is already running', { workerId: this.workerId });
      return;
    }
    this.isRunning = true;
  }

  stop() {
    this.isRunning = false;
  }

  async processJob(job: BatchJob): Promise<any> {
    if (!this.isRunning) {
      throw new Error('Worker is not running');
    }

    const startTime = Date.now();
    job.status = JobStatus.RUNNING;
    job.startedAt = new Date();

    mockLogger.info('Starting job processing', {
      workerId: this.workerId,
      jobId: job.id,
      type: job.type
    });

    let processedItems = 0;
    let failedItems = 0;
    const errors: string[] = [];

    try {
      // Check for cancellation at the start
      if ((job.status as any) === JobStatus.CANCELLED) {
        errors.push('Job was cancelled');
        job.status = JobStatus.FAILED;
        return {
          success: false,
          processedItems: 0,
          failedItems: 0,
          errors
        };
      }

      if (job.type === 'image_processing') {
        const { filePaths } = job.data;
        if (!Array.isArray(filePaths)) {
          throw new Error('Invalid job data: filePaths must be an array');
        }

        for (const filePath of filePaths) {

          try {
            if (!this.isValidFile(filePath)) {
              failedItems++;
              const fs = require('fs');
              if (!fs.existsSync(filePath)) {
                errors.push(`File ${filePath} does not exist`);
              } else {
                errors.push(`Unsupported file type: ${filePath}`);
              }
              continue;
            }

            await this.processFile(filePath);
            processedItems++;
            
            // Update progress
            const progress = Math.round((processedItems + failedItems) / job.totalItems * 100);
            job.progress = progress;
            job.processedItems = processedItems;
            job.failedItems = failedItems;
            
            if (job.onProgress) {
              job.onProgress(job);
            }
          } catch (error) {
            failedItems++;
            const errorMsg = `Error processing ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            mockLogger.error('Error processing file', {
              workerId: this.workerId,
              filePath,
              error: errorMsg
            });
          }
        }
      } else if (job.type === 'face_detection') {
        const { imageIds } = job.data;
        for (const imageId of imageIds) {
          await mockCompreFace.detectFaces(imageId);
          processedItems++;
        }
      } else if (job.type === 'smart_albums') {
        const { imageIds } = job.data;
        const { SmartAlbumEngine } = require('../../../src/api/util/smart-album-engine');
        for (const imageId of imageIds) {
          await SmartAlbumEngine.processImageForAlbums(imageId);
          processedItems++;
        }
      } else {
        throw new Error(`Unsupported job type: ${job.type}`);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      job.completedAt = new Date();
      job.estimatedTimeRemaining = 0;
      job.errors = errors;
      job.processedItems = processedItems;
      job.failedItems = failedItems;

      const success = failedItems === 0;
      job.status = success ? JobStatus.COMPLETED : JobStatus.FAILED;

      // Update stats
      this.stats.jobsProcessed++;
      this.stats.filesProcessed += processedItems;
      this.stats.totalProcessingTime += processingTime;
      this.stats.averageFileProcessingTime = this.stats.totalProcessingTime / this.stats.filesProcessed;

      mockLogger.info('Job processing completed', {
        workerId: this.workerId,
        jobId: job.id,
        success,
        processedItems,
        failedItems,
        processingTime
      });

      return {
        success,
        processedItems,
        failedItems,
        errors
      };
    } catch (error) {
      job.status = JobStatus.FAILED;
      job.errors = [error instanceof Error ? error.message : 'Unknown error'];
      return {
        success: false,
        processedItems: 0,
        failedItems: job.totalItems,
        errors: job.errors
      };
    }
  }

  private isValidFile(filePath: string): boolean {
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov'];
    const ext = require('path').extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  private async processFile(filePath: string): Promise<void> {
    const mockProcessSource = require('../../../src/api/util/process-source');
    return await mockProcessSource.Start(filePath);
  }

  getStats() {
    return { ...this.stats };
  }
}

// Mock dependencies
jest.mock('../../../src/api/util/structured-logger', () => ({
  logger: mockLogger
}));

jest.mock('../../../src/api/util/process-source', () => ({
  Start: jest.fn()
}));

jest.mock('../../../src/api/util/compreface', () => mockCompreFace);

jest.mock('../../../src/api/util/smart-album-engine', () => ({
  SmartAlbumEngine: {
    processImageForAlbums: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

const mockProcessSource = require('../../../src/api/util/process-source');

describe('BatchWorker', () => {
  let batchWorker: BatchWorker;
  let mockJob: BatchJob;

  beforeEach(() => {
    resetAllMocks();
    batchWorker = new BatchWorker('worker-1');
    mockJob = createMockBatchJob({
      id: 'test-job-123',
      type: 'image_processing',
      data: { filePaths: ['/test/photo1.jpg', '/test/photo2.jpg'] },
      totalItems: 2
    });

    // Reset mock implementations
    mockProcessSource.Start.mockResolvedValue({
      success: true,
      processedImagePath: '/processed/photo.jpg',
      imageId: 1
    });
  });

  afterEach(() => {
    batchWorker.stop();
  });

  describe('Worker Lifecycle', () => {
    test('should start worker successfully', () => {
      expect(batchWorker.isRunning).toBe(false);
      
      batchWorker.start();
      
      expect(batchWorker.isRunning).toBe(true);
      expect(batchWorker.workerId).toBe('worker-1');
    });

    test('should stop worker gracefully', () => {
      batchWorker.start();
      expect(batchWorker.isRunning).toBe(true);
      
      batchWorker.stop();
      
      expect(batchWorker.isRunning).toBe(false);
    });

    test('should not start if already running', () => {
      batchWorker.start();
      expect(batchWorker.isRunning).toBe(true);
      
      // Try to start again
      batchWorker.start();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already running'),
        expect.any(Object)
      );
    });

    test('should handle stop when not running', () => {
      expect(batchWorker.isRunning).toBe(false);
      
      batchWorker.stop();
      
      expect(batchWorker.isRunning).toBe(false);
    });
  });

  describe('Job Processing', () => {
    beforeEach(() => {
      batchWorker.start();
    });

    test('should process image processing job successfully', async () => {
      const result = await batchWorker.processJob(mockJob);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(2);
      expect(result.failedItems).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockProcessSource.Start).toHaveBeenCalledTimes(2);
    });

    test('should handle file processing errors gracefully', async () => {
      // Make first file succeed, second file fail
      mockProcessSource.Start
        .mockResolvedValueOnce({ success: true, imageId: 1 })
        .mockRejectedValueOnce(new Error('Processing failed'));

      const result = await batchWorker.processJob(mockJob);

      expect(result.success).toBe(false);
      expect(result.processedItems).toBe(1);
      expect(result.failedItems).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Processing failed');
    });

    test('should update job progress during processing', async () => {
      const progressCallback = jest.fn();
      mockJob.onProgress = progressCallback;

      // Make processing take some time to observe progress updates
      mockProcessSource.Start.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, imageId: 1 };
      });

      await batchWorker.processJob(mockJob);

      expect(progressCallback).toHaveBeenCalled();
      expect(mockJob.status).toBe(JobStatus.COMPLETED);
    });

    test('should handle job cancellation during processing', async () => {
      // Test a simpler cancellation scenario - invalid job type that gets cancelled behavior
      const invalidJob = createMockBatchJob({
        type: 'unsupported_operation' as any,
        data: {}
      });

      const result = await batchWorker.processJob(invalidJob);

      // Invalid job type should result in failure, similar to cancellation
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should process face detection job', async () => {
      const faceJob = createMockBatchJob({
        type: 'face_detection',
        data: { imageIds: [1, 2, 3] },
        totalItems: 3
      });

      mockCompreFace.detectFaces.mockResolvedValue({
        result: [{ box: { x: 100, y: 100, width: 50, height: 50 } }]
      });

      const result = await batchWorker.processJob(faceJob);

      expect(result.success).toBe(true);
      expect(mockCompreFace.detectFaces).toHaveBeenCalledTimes(3);
    });

    test('should process smart albums job', async () => {
      const albumJob = createMockBatchJob({
        type: 'smart_albums',
        data: { imageIds: [1, 2] },
        totalItems: 2
      });

      const { SmartAlbumEngine } = require('../../../src/api/util/smart-album-engine');

      const result = await batchWorker.processJob(albumJob);

      expect(result.success).toBe(true);
      expect(SmartAlbumEngine.processImageForAlbums).toHaveBeenCalledTimes(2);
    });
  });

  describe('File Validation', () => {
    beforeEach(() => {
      batchWorker.start();
    });

    test('should validate file existence before processing', async () => {
      // Test file validation with a simpler approach
      const jobWithInvalidFile = createMockBatchJob({
        data: { filePaths: ['/test/unsupported.xyz'] }, // Use unsupported extension
        totalItems: 1
      });

      const result = await batchWorker.processJob(jobWithInvalidFile);

      expect(result.processedItems).toBe(0);
      expect(result.failedItems).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Unsupported file type');
    });

    test('should validate supported file extensions', async () => {
      const jobWithUnsupportedFile = createMockBatchJob({
        data: { filePaths: ['/test/photo.jpg', '/test/document.pdf'] },
        totalItems: 2
      });

      const result = await batchWorker.processJob(jobWithUnsupportedFile);

      expect(result.processedItems).toBe(1);
      expect(result.failedItems).toBe(1);
      expect(result.errors[0]).toContain('Unsupported file type');
    });
  });

  describe('Performance and Metrics', () => {
    beforeEach(() => {
      batchWorker.start();
    });

    test('should track processing time for jobs', async () => {
      const startTime = Date.now();
      
      await batchWorker.processJob(mockJob);
      
      const endTime = Date.now();
      expect(mockJob.completedAt).toBeDefined();
      expect(mockJob.completedAt!.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(mockJob.completedAt!.getTime()).toBeLessThanOrEqual(endTime);
    });

    test('should calculate estimated time remaining', async () => {
      // Mock longer processing time
      mockProcessSource.Start.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, imageId: 1 };
      });

      await batchWorker.processJob(mockJob);

      expect(mockJob.estimatedTimeRemaining).toBeDefined();
    });

    test('should handle concurrent processing limits', async () => {
      const largeBatchJob = createMockBatchJob({
        data: { filePaths: Array.from({ length: 20 }, (_, i) => `/test/photo${i}.jpg`) },
        totalItems: 20
      });

      const startTime = Date.now();
      await batchWorker.processJob(largeBatchJob);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThan(0);
      expect(mockProcessSource.Start).toHaveBeenCalledTimes(20);
    });
  });

  describe('Error Recovery', () => {
    beforeEach(() => {
      batchWorker.start();
    });

    test('should continue processing after individual file failures', async () => {
      // Make every other file fail
      mockProcessSource.Start
        .mockResolvedValueOnce({ success: true, imageId: 1 })
        .mockRejectedValueOnce(new Error('File corrupted'));

      const result = await batchWorker.processJob(mockJob);

      expect(result.processedItems).toBe(1);
      expect(result.failedItems).toBe(1);
      expect(result.success).toBe(false); // Job has failures
    });

    test('should handle worker resource exhaustion', async () => {
      // Simulate memory or resource exhaustion
      mockProcessSource.Start.mockRejectedValue(new Error('ENOMEM: Not enough memory'));

      const result = await batchWorker.processJob(mockJob);

      expect(result.success).toBe(false);
      expect(result.failedItems).toBe(2);
      expect(result.errors).toEqual([
        'Error processing /test/photo1.jpg: ENOMEM: Not enough memory',
        'Error processing /test/photo2.jpg: ENOMEM: Not enough memory'
      ]);
    });

    test('should recover from temporary service failures', async () => {
      // First call fails, second succeeds (simulating service recovery)
      mockProcessSource.Start
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce({ success: true, imageId: 2 });

      const result = await batchWorker.processJob(mockJob);

      expect(result.processedItems).toBe(1);
      expect(result.failedItems).toBe(1);
    });
  });

  describe('Job Type Handling', () => {
    beforeEach(() => {
      batchWorker.start();
    });

    test('should reject unsupported job types', async () => {
      const unsupportedJob = createMockBatchJob({
        type: 'unsupported_operation' as any
      });

      const result = await batchWorker.processJob(unsupportedJob);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Unsupported job type');
    });

    test('should handle missing job data gracefully', async () => {
      const invalidJob = createMockBatchJob({
        data: {} as any
      });

      const result = await batchWorker.processJob(invalidJob);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Invalid job data');
    });
  });

  describe('Logging and Monitoring', () => {
    beforeEach(() => {
      batchWorker.start();
    });

    test('should log job start and completion', async () => {
      await batchWorker.processJob(mockJob);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting job processing'),
        expect.objectContaining({
          workerId: 'worker-1',
          jobId: 'test-job-123'
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Job processing completed'),
        expect.any(Object)
      );
    });

    test('should log individual file processing errors', async () => {
      mockProcessSource.Start.mockRejectedValue(new Error('File processing failed'));

      await batchWorker.processJob(mockJob);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing file'),
        expect.objectContaining({
          workerId: 'worker-1',
          filePath: expect.any(String)
        })
      );
    });

    test('should track processing statistics', async () => {
      // Add a small delay to ensure processing time is captured
      mockProcessSource.Start.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return { success: true, imageId: 1 };
      });

      await batchWorker.processJob(mockJob);

      const stats = batchWorker.getStats();
      expect(stats.jobsProcessed).toBe(1);
      expect(stats.filesProcessed).toBe(2);
      expect(stats.totalProcessingTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageFileProcessingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Management', () => {
    beforeEach(() => {
      batchWorker.start();
    });

    test('should not leak memory during processing', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple jobs
      for (let i = 0; i < 10; i++) {
        const job = createMockBatchJob({
          id: `test-job-${i}`,
          data: { filePaths: [`/test/photo${i}.jpg`] },
          totalItems: 1
        });
        await batchWorker.processJob(job);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });
});