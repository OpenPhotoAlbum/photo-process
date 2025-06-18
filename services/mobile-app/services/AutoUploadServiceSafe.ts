// Safe AutoUpload service that works without native dependencies
// This version provides the UI and structure but skips actual camera roll access

// Removed UploadAPI import to eliminate all external dependencies

// Storage keys
const STORAGE_KEYS = {
  AUTO_UPLOAD_ENABLED: 'auto_upload_enabled',
  LAST_SCAN_TIME: 'last_scan_time',
  UPLOAD_QUEUE: 'upload_queue',
  WIFI_ONLY: 'wifi_only',
  QUALITY_SETTING: 'quality_setting',
  DAILY_LIMIT: 'daily_limit',
  UPLOADED_TODAY: 'uploaded_today',
  LAST_RESET_DATE: 'last_reset_date'
};

export interface AutoUploadSettings {
  enabled: boolean;
  wifiOnly: boolean;
  qualitySetting: 'high' | 'medium' | 'low';
  dailyLimit: number;
  maxConcurrentUploads: number;
}

export interface QueueItem {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  retryCount: number;
  lastAttempt?: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
}

export interface UploadStats {
  totalQueued: number;
  totalCompleted: number;
  totalFailed: number;
  uploadedsToday: number;
  dailyLimitMB: number;
}

// Simple in-memory storage fallback
class SimpleStorage {
  private data: { [key: string]: string } = {};

  async getItem(key: string): Promise<string | null> {
    return this.data[key] || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data[key] = value;
  }
}

class AutoUploadServiceSafe {
  private isMonitoring: boolean = false;
  private uploadQueue: QueueItem[] = [];
  private activeUploads: Set<string> = new Set();
  private storage: SimpleStorage;
  private settings: AutoUploadSettings;

  constructor() {
    this.storage = new SimpleStorage();
    this.settings = this.getDefaultSettings();
    console.log('AutoUploadService: Safe mode initialized (native modules not available)');
  }

  // Initialize - always returns true in safe mode
  async initialize(): Promise<boolean> {
    console.log('AutoUploadService: Safe mode - initialization complete');
    return true;
  }

  // Get current auto-upload settings
  async getSettings(): Promise<AutoUploadSettings> {
    try {
      const [enabled, wifiOnly, quality, dailyLimit] = await Promise.all([
        this.storage.getItem(STORAGE_KEYS.AUTO_UPLOAD_ENABLED),
        this.storage.getItem(STORAGE_KEYS.WIFI_ONLY),
        this.storage.getItem(STORAGE_KEYS.QUALITY_SETTING),
        this.storage.getItem(STORAGE_KEYS.DAILY_LIMIT)
      ]);

      return {
        enabled: enabled === 'true',
        wifiOnly: wifiOnly !== 'false',
        qualitySetting: (quality as any) || 'medium',
        dailyLimit: parseInt(dailyLimit || '100'),
        maxConcurrentUploads: 2
      };
    } catch (error) {
      console.error('AutoUploadService: Failed to get settings:', error);
      return this.getDefaultSettings();
    }
  }

  private getDefaultSettings(): AutoUploadSettings {
    return {
      enabled: false,
      wifiOnly: true,
      qualitySetting: 'medium',
      dailyLimit: 100,
      maxConcurrentUploads: 2
    };
  }

  // Update auto-upload settings
  async updateSettings(settings: Partial<AutoUploadSettings>): Promise<void> {
    try {
      const updates: Array<Promise<void>> = [];
      
      if (settings.enabled !== undefined) {
        updates.push(this.storage.setItem(STORAGE_KEYS.AUTO_UPLOAD_ENABLED, settings.enabled.toString()));
        this.settings.enabled = settings.enabled;
        
        if (settings.enabled) {
          console.log('AutoUploadService: Safe mode - auto-upload enabled (simulation only)');
        } else {
          console.log('AutoUploadService: Safe mode - auto-upload disabled');
        }
      }
      
      if (settings.wifiOnly !== undefined) {
        updates.push(this.storage.setItem(STORAGE_KEYS.WIFI_ONLY, settings.wifiOnly.toString()));
        this.settings.wifiOnly = settings.wifiOnly;
      }
      
      if (settings.qualitySetting !== undefined) {
        updates.push(this.storage.setItem(STORAGE_KEYS.QUALITY_SETTING, settings.qualitySetting));
        this.settings.qualitySetting = settings.qualitySetting;
      }
      
      if (settings.dailyLimit !== undefined) {
        updates.push(this.storage.setItem(STORAGE_KEYS.DAILY_LIMIT, settings.dailyLimit.toString()));
        this.settings.dailyLimit = settings.dailyLimit;
      }

      await Promise.all(updates);
      console.log('AutoUploadService: Settings updated:', settings);
    } catch (error) {
      console.error('AutoUploadService: Failed to update settings:', error);
    }
  }

  // Start monitoring - simulated in safe mode
  async startMonitoring(): Promise<void> {
    this.isMonitoring = true;
    console.log('AutoUploadService: Safe mode - monitoring simulation started');
  }

  // Stop monitoring
  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    console.log('AutoUploadService: Safe mode - monitoring simulation stopped');
  }

  // Scan for new photos - simulated in safe mode
  async scanForNewPhotos(): Promise<void> {
    console.log('AutoUploadService: Safe mode - simulating camera roll scan');
    
    // In safe mode, we'll just simulate finding a few photos
    const simulatedPhotos = [
      { id: 'sim1', filename: 'IMG_0001.jpg', uri: 'simulated://photo1' },
      { id: 'sim2', filename: 'IMG_0002.jpg', uri: 'simulated://photo2' },
      { id: 'sim3', filename: 'IMG_0003.jpg', uri: 'simulated://photo3' }
    ];

    console.log(`AutoUploadService: Safe mode - found ${simulatedPhotos.length} simulated photos`);

    for (const photo of simulatedPhotos) {
      const existingItem = this.uploadQueue.find(item => item.id === photo.id);
      if (!existingItem) {
        this.uploadQueue.push({
          id: photo.id,
          uri: photo.uri,
          filename: photo.filename,
          creationTime: Date.now(),
          retryCount: 0,
          status: 'pending'
        });
      }
    }

    console.log('AutoUploadService: Safe mode - scan complete');
  }

  // Get upload statistics
  async getUploadStats(): Promise<UploadStats> {
    try {
      return {
        totalQueued: this.uploadQueue.filter(item => item.status === 'pending').length,
        totalCompleted: this.uploadQueue.filter(item => item.status === 'completed').length,
        totalFailed: this.uploadQueue.filter(item => item.status === 'failed').length,
        uploadedsToday: 0,
        dailyLimitMB: this.settings.dailyLimit
      };
    } catch (error) {
      console.error('AutoUploadService: Failed to get upload stats:', error);
      return {
        totalQueued: 0,
        totalCompleted: 0,
        totalFailed: 0,
        uploadedsToday: 0,
        dailyLimitMB: 100
      };
    }
  }

  // Clear completed items from queue
  async clearCompleted(): Promise<void> {
    this.uploadQueue = this.uploadQueue.filter(item => item.status !== 'completed');
    console.log('AutoUploadService: Cleared completed uploads from queue');
  }

  // Manual scan trigger for testing
  async manualScan(): Promise<void> {
    console.log('AutoUploadService: Manual scan triggered (safe mode)');
    await this.scanForNewPhotos();
  }

  // Process queue - simulated in safe mode
  async processQueue(): Promise<void> {
    console.log('AutoUploadService: Safe mode - processing queue (simulation)');
    
    // Simulate processing some items
    const pendingItems = this.uploadQueue.filter(item => item.status === 'pending');
    
    for (const item of pendingItems) {
      console.log(`AutoUploadService: Safe mode - simulating upload of ${item.filename}`);
      
      // Simulate some success and some failure
      if (Math.random() > 0.3) {
        item.status = 'completed';
        console.log(`AutoUploadService: Safe mode - ${item.filename} upload simulated as successful`);
      } else {
        item.status = 'failed';
        console.log(`AutoUploadService: Safe mode - ${item.filename} upload simulated as failed`);
      }
    }
  }
}

// Create singleton instance
export const autoUploadService = new AutoUploadServiceSafe();