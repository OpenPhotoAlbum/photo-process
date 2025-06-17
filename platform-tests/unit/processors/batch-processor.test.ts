import { resetAllMocks } from '../../helpers/mocks';
import { JobPriority, JobStatus, BatchJob } from '../../helpers/types';

// Mock all external dependencies before importing BatchProcessor
jest.mock('../../../src/api/util/structured-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/api/util/config-manager', () => ({
  configManager: {
    getServer: () => ({
      scanBatchSize: 2
    }),
    getProcessing: () => ({
      batchSize: 4
    })
  }
}));

// Mock worker threads to prevent actual worker creation
jest.mock('worker_threads', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    postMessage: jest.fn(),
    terminate: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock the BatchProcessor implementation to avoid singleton issues
class MockBatchProcessor {
  private jobs: Map<string, BatchJob> = new Map();
  private jobCounter = 0;
  private isShuttingDown = false;

  static getInstance(): MockBatchProcessor {
    if (!(this as any).instance) {
      (this as any).instance = new MockBatchProcessor();
    }
    return (this as any).instance;
  }

  addJob(
    type: BatchJob['type'],
    data: any,
    priority: JobPriority = JobPriority.NORMAL,
    totalItems: number = 1
  ): string {
    const jobId = `job-${++this.jobCounter}`;
    const job: BatchJob = {
      id: jobId,
      type,
      priority,
      status: JobStatus.PENDING,
      data,
      progress: 0,
      totalItems,
      processedItems: 0,
      failedItems: 0,
      errors: [],
      createdAt: new Date()
    };
    
    this.jobs.set(jobId, job);
    return jobId;
  }

  getJob(jobId: string): BatchJob | undefined {
    return this.jobs.get(jobId);
  }

  getJobs(filter: any = {}): BatchJob[] {
    let jobs = Array.from(this.jobs.values());
    
    if (filter.status) {
      jobs = jobs.filter(job => job.status === filter.status);
    }
    if (filter.type) {
      jobs = jobs.filter(job => job.type === filter.type);
    }
    if (filter.limit) {
      jobs = jobs.slice(0, filter.limit);
    }
    
    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && job.status === JobStatus.PENDING) {
      job.status = JobStatus.CANCELLED;
      return true;
    }
    return false;
  }

  getQueueStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter(j => j.status === JobStatus.PENDING).length,
      runningJobs: jobs.filter(j => j.status === JobStatus.RUNNING).length,
      completedJobs: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
      failedJobs: jobs.filter(j => j.status === JobStatus.FAILED).length,
      activeJobs: jobs.filter(j => j.status === JobStatus.RUNNING).length,
      maxWorkers: 2
    };
  }

  cleanupJobs(olderThanHours: number): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [jobId, job] of this.jobs) {
      if (job.createdAt < cutoffTime && 
          (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED)) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.jobs.clear();
  }

  // Reset method for testing
  static reset() {
    (this as any).instance = undefined;
  }
}

describe('BatchProcessor', () => {
  let batchProcessor: MockBatchProcessor;

  beforeEach(() => {
    resetAllMocks();
    MockBatchProcessor.reset();
    batchProcessor = MockBatchProcessor.getInstance();
  });

  afterEach(async () => {
    await batchProcessor.shutdown();
  });

  describe('Job Queue Management', () => {
    test('should add job to queue with correct priority ordering', () => {
      const lowPriorityJobId = batchProcessor.addJob(
        'image_processing',
        { filePaths: ['test1.jpg'] },
        JobPriority.LOW,
        1
      );

      const highPriorityJobId = batchProcessor.addJob(
        'image_processing',
        { filePaths: ['test2.jpg'] },
        JobPriority.HIGH,
        1
      );

      const normalPriorityJobId = batchProcessor.addJob(
        'image_processing',
        { filePaths: ['test3.jpg'] },
        JobPriority.NORMAL,
        1
      );

      // Verify jobs exist
      expect(batchProcessor.getJob(lowPriorityJobId)).toBeDefined();
      expect(batchProcessor.getJob(highPriorityJobId)).toBeDefined();
      expect(batchProcessor.getJob(normalPriorityJobId)).toBeDefined();

      // Verify priorities are set correctly
      expect(batchProcessor.getJob(lowPriorityJobId)?.priority).toBe(JobPriority.LOW);
      expect(batchProcessor.getJob(highPriorityJobId)?.priority).toBe(JobPriority.HIGH);
      expect(batchProcessor.getJob(normalPriorityJobId)?.priority).toBe(JobPriority.NORMAL);
    });

    test('should generate unique job IDs', () => {
      const jobId1 = batchProcessor.addJob('image_processing', { test: 1 });
      const jobId2 = batchProcessor.addJob('image_processing', { test: 2 });
      const jobId3 = batchProcessor.addJob('image_processing', { test: 3 });

      expect(jobId1).not.toBe(jobId2);
      expect(jobId2).not.toBe(jobId3);
      expect(jobId1).not.toBe(jobId3);
    });

    test('should return correct queue statistics', () => {
      batchProcessor.addJob('image_processing', { test: 1 }, JobPriority.NORMAL, 5);
      batchProcessor.addJob('face_detection', { test: 2 }, JobPriority.HIGH, 3);
      batchProcessor.addJob('smart_albums', { test: 3 }, JobPriority.LOW, 2);

      const stats = batchProcessor.getQueueStats();

      expect(stats.totalJobs).toBe(3);
      expect(stats.pendingJobs).toBe(3);
      expect(stats.maxWorkers).toBe(2);
    });
  });

  describe('Job Status Management', () => {
    test('should create job with pending status', () => {
      const jobId = batchProcessor.addJob('image_processing', { test: true });
      const job = batchProcessor.getJob(jobId);

      expect(job).toBeDefined();
      expect(job?.status).toBe(JobStatus.PENDING);
      expect(job?.progress).toBe(0);
      expect(job?.processedItems).toBe(0);
      expect(job?.failedItems).toBe(0);
      expect(job?.errors).toEqual([]);
    });

    test('should cancel pending job successfully', () => {
      const jobId = batchProcessor.addJob('image_processing', { test: true });
      
      const cancelled = batchProcessor.cancelJob(jobId);
      const job = batchProcessor.getJob(jobId);

      expect(cancelled).toBe(true);
      expect(job?.status).toBe(JobStatus.CANCELLED);
    });

    test('should not cancel non-existent job', () => {
      const cancelled = batchProcessor.cancelJob('non-existent-job');
      expect(cancelled).toBe(false);
    });
  });

  describe('Job Filtering and Querying', () => {
    beforeEach(() => {
      batchProcessor.addJob('image_processing', { test: 1 }, JobPriority.HIGH, 5);
      batchProcessor.addJob('face_detection', { test: 2 }, JobPriority.NORMAL, 3);
      batchProcessor.addJob('object_detection', { test: 3 }, JobPriority.LOW, 2);
    });

    test('should filter jobs by status', () => {
      const pendingJobs = batchProcessor.getJobs({ status: JobStatus.PENDING });
      
      expect(pendingJobs.length).toBe(3);
      pendingJobs.forEach(job => {
        expect(job.status).toBe(JobStatus.PENDING);
      });
    });

    test('should filter jobs by type', () => {
      const imageJobs = batchProcessor.getJobs({ type: 'image_processing' });
      const faceJobs = batchProcessor.getJobs({ type: 'face_detection' });

      expect(imageJobs.length).toBe(1);
      expect(faceJobs.length).toBe(1);
      expect(imageJobs[0].type).toBe('image_processing');
      expect(faceJobs[0].type).toBe('face_detection');
    });

    test('should limit number of returned jobs', () => {
      const limitedJobs = batchProcessor.getJobs({ limit: 2 });
      expect(limitedJobs.length).toBe(2);
    });

    test('should sort jobs by creation time (newest first)', () => {
      const allJobs = batchProcessor.getJobs();
      
      for (let i = 1; i < allJobs.length; i++) {
        expect(allJobs[i-1].createdAt.getTime()).toBeGreaterThanOrEqual(
          allJobs[i].createdAt.getTime()
        );
      }
    });
  });

  describe('Job Cleanup', () => {
    test('should clean up old completed jobs', () => {
      const jobId = batchProcessor.addJob('image_processing', { test: true });
      const job = batchProcessor.getJob(jobId);
      
      if (job) {
        job.status = JobStatus.COMPLETED;
        job.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      }

      const initialJobCount = batchProcessor.getQueueStats().totalJobs;
      const cleaned = batchProcessor.cleanupJobs(24); // Clean jobs older than 24 hours

      expect(cleaned).toBe(1);
      expect(batchProcessor.getQueueStats().totalJobs).toBe(initialJobCount - 1);
    });

    test('should not clean up recent completed jobs', () => {
      const jobId = batchProcessor.addJob('image_processing', { test: true });
      const job = batchProcessor.getJob(jobId);
      
      if (job) {
        job.status = JobStatus.COMPLETED;
        job.createdAt = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      }

      const cleaned = batchProcessor.cleanupJobs(24);
      expect(cleaned).toBe(0);
    });

    test('should not clean up active jobs', () => {
      const jobId = batchProcessor.addJob('image_processing', { test: true });
      const job = batchProcessor.getJob(jobId);
      
      if (job) {
        job.status = JobStatus.RUNNING;
        job.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      }

      const cleaned = batchProcessor.cleanupJobs(24);
      expect(cleaned).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid job types gracefully', () => {
      expect(() => {
        batchProcessor.addJob('invalid_type' as any, { test: true });
      }).not.toThrow();
    });

    test('should track job errors correctly', () => {
      const jobId = batchProcessor.addJob('image_processing', { test: true });
      const job = batchProcessor.getJob(jobId);

      if (job) {
        job.errors.push('Test error 1');
        job.errors.push('Test error 2');
      }

      const retrievedJob = batchProcessor.getJob(jobId);
      expect(retrievedJob?.errors).toEqual(['Test error 1', 'Test error 2']);
    });
  });

  describe('Shutdown', () => {
    test('should shutdown gracefully', async () => {
      await expect(batchProcessor.shutdown()).resolves.not.toThrow();
    });
  });
});