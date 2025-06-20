import { Logger } from '../logger';
import { configManager } from './config-manager';
import { workerScanner } from '../scanner/scan-worker';
import { Status } from '../scanner/scan';

const logger = Logger.getInstance('AutoScanner');

export interface AutoScannerConfig {
    enabled: boolean;
    batchSize: number;
    intervalSeconds: number;
    startDelaySeconds: number;
}

class AutoScanner {
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private config: AutoScannerConfig;
    private scanInProgress: boolean = false;

    constructor() {
        this.config = {
            enabled: process.env.AUTO_SCAN_ENABLED === 'true',
            batchSize: parseInt(process.env.AUTO_SCAN_BATCH_SIZE || '50'),
            intervalSeconds: parseInt(process.env.AUTO_SCAN_INTERVAL || '60'),
            startDelaySeconds: parseInt(process.env.AUTO_SCAN_START_DELAY || '30')
        };
    }

    async start(): Promise<void> {
        if (!this.config.enabled) {
            logger.info('Auto scanner is disabled');
            return;
        }

        if (this.isRunning) {
            logger.warn('Auto scanner is already running');
            return;
        }

        logger.info('Starting auto scanner', {
            batchSize: this.config.batchSize,
            intervalSeconds: this.config.intervalSeconds,
            startDelaySeconds: this.config.startDelaySeconds
        });

        this.isRunning = true;

        // Wait for initial delay
        if (this.config.startDelaySeconds > 0) {
            logger.info(`Waiting ${this.config.startDelaySeconds} seconds before starting auto scan...`);
            await new Promise(resolve => setTimeout(resolve, this.config.startDelaySeconds * 1000));
        }

        // Start the scanning loop
        this.scheduleScan();
    }

    stop(): void {
        if (!this.isRunning) {
            return;
        }

        logger.info('Stopping auto scanner');
        this.isRunning = false;

        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
    }

    private scheduleScan(): void {
        if (!this.isRunning) {
            return;
        }

        this.intervalId = setTimeout(async () => {
            await this.runScanBatch();
            this.scheduleScan(); // Schedule next scan
        }, this.config.intervalSeconds * 1000);
    }

    private async runScanBatch(): Promise<void> {
        if (this.scanInProgress) {
            logger.info('Scan already in progress, skipping this batch');
            return;
        }

        try {
            // Check current status
            const status = await Status();
            
            if (status.file_tracker?.pending === 0) {
                logger.info('No pending files to scan');
                return;
            }

            if ((status.message as any) === 'Processing' || (status.message as any) === 'Starting') {
                logger.info('Another scan is already running, skipping');
                return;
            }

            logger.info(`Starting auto scan batch: ${status.file_tracker?.pending} files pending`);
            this.scanInProgress = true;

            // Start scan using worker scanner
            const result = await workerScanner.startScan(
                configManager.getStorage().sourceDir,
                this.config.batchSize
            );

            logger.info('Auto scan batch completed', {
                successful: result.successful,
                failed: result.failed,
                total: result.successful + result.failed
            });

        } catch (error) {
            logger.error('Auto scan batch failed', error);
        } finally {
            this.scanInProgress = false;
        }
    }

    getStatus(): {
        enabled: boolean;
        running: boolean;
        config: AutoScannerConfig;
        scanInProgress: boolean;
    } {
        return {
            enabled: this.config.enabled,
            running: this.isRunning,
            config: this.config,
            scanInProgress: this.scanInProgress
        };
    }
}

// Export singleton instance
export const autoScanner = new AutoScanner();