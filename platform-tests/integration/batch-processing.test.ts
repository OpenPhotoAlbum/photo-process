import { BatchProcessor, JobPriority, JobStatus } from '../../services/api/util/batch-processor';
import { ParallelScanner } from '../../services/api/util/parallel-scanner';
import { BatchWorker } from '../../services/api/util/batch-worker';
import { resetAllMocks } from '../helpers/mocks';
import fs from 'fs';
import path from 'path';

// Integration tests for the complete batch processing workflow
describe('Batch Processing Integration', () => {
  let batchProcessor: BatchProcessor;
  let parallelScanner: ParallelScanner;
  let testSourceDir: string;
  let testFiles: string[];

  beforeAll(async () => {
    // Set up test environment
    testSourceDir = '/tmp/batch-processing-test';
    testFiles = [
      path.join(testSourceDir, 'photo1.jpg'),
      path.join(testSourceDir, 'photo2.png'),
      path.join(testSourceDir, 'video1.mp4'),
      path.join(testSourceDir, 'subdir', 'photo3.jpeg')
    ];

    // Create test directory structure
    if (!fs.existsSync(testSourceDir)) {
      fs.mkdirSync(testSourceDir, { recursive: true });
      fs.mkdirSync(path.join(testSourceDir, 'subdir'), { recursive: true });
    }

    // Create mock test files
    testFiles.forEach(filePath => {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, 'mock image data');
      }
    });
  });

  beforeEach(() => {
    resetAllMocks();
    batchProcessor = BatchProcessor.getInstance();
    parallelScanner = ParallelScanner.getInstance();
  });

  afterEach(async () => {
    await batchProcessor.shutdown();
    await parallelScanner.shutdown();
  });

  afterAll(async () => {
    // Clean up test files
    if (fs.existsSync(testSourceDir)) {
      fs.rmSync(testSourceDir, { recursive: true, force: true });
    }
  });

  describe('End-to-End Directory Processing', () => {
    test('should discover, queue, and process files from directory', async () => {
      // Start the batch processor with workers
      const worker1 = new BatchWorker('integration-worker-1');
      const worker2 = new BatchWorker('integration-worker-2');
      
      worker1.start();
      worker2.start();

      try {
        // Scan directory and create batches
        const scanResult = await parallelScanner.scanDirectory(testSourceDir, {
          batchSize: 2,
          maxConcurrentFiles: 2,
          priority: JobPriority.HIGH,
          skipExisting: false
        });

        expect(scanResult.discoveredFiles).toBeGreaterThan(0);
        expect(scanResult.batchesCreated).toBeGreaterThan(0);

        // Monitor processing progress
        let allJobsComplete = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout

        while (!allJobsComplete && attempts < maxAttempts) {
          const stats = batchProcessor.getQueueStats();
          const jobs = batchProcessor.getJobs();
          
          const completedJobs = jobs.filter(job => 
            job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED
          );

          if (completedJobs.length === jobs.length && jobs.length > 0) {
            allJobsComplete = true;
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        }

        expect(allJobsComplete).toBe(true);

        // Verify final state
        const finalStats = batchProcessor.getQueueStats();
        expect(finalStats.pendingJobs).toBe(0);

      } finally {
        worker1.stop();
        worker2.stop();
      }
    }, 60000); // 60 second timeout for integration test

    test('should handle mixed file types correctly', async () => {
      const mixedFiles = [
        path.join(testSourceDir, 'image.jpg'),
        path.join(testSourceDir, 'video.mp4'),
        path.join(testSourceDir, 'document.pdf'), // Should be filtered out
        path.join(testSourceDir, 'audio.mp3')     // Should be filtered out
      ];

      // Create the files
      mixedFiles.forEach(filePath => {
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, 'mock file data');
        }
      });

      try {
        const result = await parallelScanner.processFiles(mixedFiles, {
          batchSize: 4
        });

        // Should only process supported file types (jpg, mp4)
        expect(result.processedFiles).toBe(2);
        expect(result.batchesCreated).toBe(1);

      } finally {
        // Clean up test files
        mixedFiles.forEach(filePath => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }
    });
  });

  describe('Worker Pool Management', () => {
    test('should distribute work across multiple workers', async () => {
      const workers = [
        new BatchWorker('pool-worker-1'),
        new BatchWorker('pool-worker-2'),
        new BatchWorker('pool-worker-3')
      ];

      workers.forEach(worker => worker.start());

      try {
        // Create multiple jobs
        const jobs = [];
        for (let i = 0; i < 6; i++) {
          const jobId = batchProcessor.addJob(
            'image_processing',
            { filePaths: [`/test/photo${i}.jpg`] },
            JobPriority.NORMAL,
            1
          );
          jobs.push(jobId);
        }

        // Process jobs with workers
        const processingPromises = workers.map(async worker => {
          while (true) {
            const pendingJobs = batchProcessor.getJobs({ status: JobStatus.PENDING });
            if (pendingJobs.length === 0) break;

            const job = pendingJobs[0];
            if (job) {
              job.status = JobStatus.RUNNING;
              await worker.processJob(job);
            }
          }
        });

        await Promise.all(processingPromises);

        // Verify all jobs completed
        const completedJobs = batchProcessor.getJobs({ status: JobStatus.COMPLETED });
        expect(completedJobs.length).toBe(jobs.length);

      } finally {
        workers.forEach(worker => worker.stop());
      }
    });

    test('should handle worker failures gracefully', async () => {
      const goodWorker = new BatchWorker('good-worker');
      const badWorker = new BatchWorker('bad-worker');

      // Mock the bad worker to fail
      const originalProcessJob = badWorker.processJob.bind(badWorker);
      badWorker.processJob = jest.fn().mockRejectedValue(new Error('Worker crashed'));

      goodWorker.start();
      badWorker.start();

      try {
        // Create jobs
        const jobId1 = batchProcessor.addJob('image_processing', { filePaths: ['/test/photo1.jpg'] });
        const jobId2 = batchProcessor.addJob('image_processing', { filePaths: ['/test/photo2.jpg'] });

        const job1 = batchProcessor.getJob(jobId1)!;
        const job2 = batchProcessor.getJob(jobId2)!;

        // Process jobs
        const results = await Promise.allSettled([
          badWorker.processJob(job1),
          goodWorker.processJob(job2)
        ]);

        // Bad worker should fail, good worker should succeed
        expect(results[0].status).toBe('rejected');
        expect(results[1].status).toBe('fulfilled');

      } finally {
        goodWorker.stop();
        badWorker.stop();
      }
    });
  });

  describe('Progress Tracking and Monitoring', () => {
    test('should track progress across multiple batches', async () => {
      const progressEvents: any[] = [];
      
      // Listen for progress events
      batchProcessor.on('jobProgress', (job) => {
        progressEvents.push({
          jobId: job.id,
          progress: job.progress,
          processedItems: job.processedItems,
          timestamp: new Date()
        });
      });

      const scanResult = await parallelScanner.scanDirectory(testSourceDir, {
        batchSize: 1, // Create more batches for better progress tracking
        skipExisting: false
      });

      // Simulate processing with a worker
      const worker = new BatchWorker('progress-worker');
      worker.start();

      try {
        const jobs = batchProcessor.getJobs({ status: JobStatus.PENDING });
        
        for (const job of jobs) {
          job.status = JobStatus.RUNNING;
          await worker.processJob(job);
        }

        // Verify progress was tracked
        expect(progressEvents.length).toBeGreaterThan(0);
        
        // Verify progress increases over time
        const sortedEvents = progressEvents.sort((a, b) => 
          a.timestamp.getTime() - b.timestamp.getTime()
        );
        
        let lastProgress = -1;
        for (const event of sortedEvents) {
          expect(event.progress).toBeGreaterThanOrEqual(lastProgress);
          lastProgress = event.progress;
        }

      } finally {
        worker.stop();
      }
    });

    test('should provide accurate processing statistics', async () => {
      const initialStats = parallelScanner.getProcessingStats();
      
      await parallelScanner.processFiles([testFiles[0]], { batchSize: 1 });
      
      const finalStats = parallelScanner.getProcessingStats();
      
      expect(finalStats.totalBatchesCreated).toBe(initialStats.totalBatchesCreated + 1);
      expect(finalStats.totalFilesProcessed).toBe(initialStats.totalFilesProcessed + 1);
      expect(finalStats.averageProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should continue processing other batches when one fails', async () => {
      // Create a mix of valid and invalid file paths
      const mixedFiles = [
        testFiles[0], // Valid file
        '/nonexistent/file.jpg', // Invalid file
        testFiles[1] // Valid file
      ];

      const result = await parallelScanner.processFiles(mixedFiles, {
        batchSize: 1 // Separate batches
      });

      // Should process the valid files despite the invalid one
      expect(result.processedFiles).toBe(2);
      expect(result.batchesCreated).toBe(3);
    });

    test('should handle concurrent job cancellation', async () => {
      // Create multiple jobs
      const jobIds = [];
      for (let i = 0; i < 5; i++) {
        const jobId = batchProcessor.addJob(
          'image_processing',
          { filePaths: [`/test/photo${i}.jpg`] },
          JobPriority.NORMAL,
          1
        );
        jobIds.push(jobId);
      }

      // Cancel some jobs
      const cancelledIds = jobIds.slice(0, 2);
      cancelledIds.forEach(jobId => {
        batchProcessor.cancelJob(jobId);
      });

      // Verify cancellation
      cancelledIds.forEach(jobId => {
        const job = batchProcessor.getJob(jobId);
        expect(job?.status).toBe(JobStatus.CANCELLED);
      });

      // Verify remaining jobs are still pending
      const remainingIds = jobIds.slice(2);
      remainingIds.forEach(jobId => {
        const job = batchProcessor.getJob(jobId);
        expect(job?.status).toBe(JobStatus.PENDING);
      });
    });
  });

  describe('Performance Under Load', () => {
    test('should handle high volume of small files efficiently', async () => {
      // Create many small test files
      const tempDir = path.join(testSourceDir, 'high-volume');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const manyFiles = [];
      for (let i = 0; i < 50; i++) {
        const filePath = path.join(tempDir, `photo${i}.jpg`);
        fs.writeFileSync(filePath, `mock image data ${i}`);
        manyFiles.push(filePath);
      }

      try {
        const startTime = Date.now();
        
        const result = await parallelScanner.processFiles(manyFiles, {
          batchSize: 10,
          maxConcurrentFiles: 4
        });
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        expect(result.processedFiles).toBe(50);
        expect(result.batchesCreated).toBe(5);
        expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds

      } finally {
        // Clean up
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    }, 45000); // 45 second timeout for high volume test

    test('should maintain memory usage within reasonable limits', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process multiple batches
      for (let batch = 0; batch < 5; batch++) {
        await parallelScanner.processFiles([testFiles[0]], {
          batchSize: 1
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Cleanup and Shutdown', () => {
    test('should clean up completed jobs properly', async () => {
      // Create and complete some jobs
      const jobId1 = batchProcessor.addJob('image_processing', { filePaths: ['/test/photo1.jpg'] });
      const jobId2 = batchProcessor.addJob('image_processing', { filePaths: ['/test/photo2.jpg'] });

      const job1 = batchProcessor.getJob(jobId1)!;
      const job2 = batchProcessor.getJob(jobId2)!;

      // Mark as completed and old
      job1.status = JobStatus.COMPLETED;
      job1.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      job2.status = JobStatus.COMPLETED;
      job2.createdAt = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

      const initialJobCount = batchProcessor.getQueueStats().totalJobs;
      const cleaned = batchProcessor.cleanupJobs(24); // Clean jobs older than 24 hours

      expect(cleaned).toBe(1); // Only job1 should be cleaned
      expect(batchProcessor.getQueueStats().totalJobs).toBe(initialJobCount - 1);
    });

    test('should shutdown gracefully with active jobs', async () => {
      // Create some jobs
      batchProcessor.addJob('image_processing', { filePaths: ['/test/photo1.jpg'] });
      batchProcessor.addJob('image_processing', { filePaths: ['/test/photo2.jpg'] });

      // Shutdown should complete without hanging
      await expect(batchProcessor.shutdown()).resolves.not.toThrow();
    });
  });
});