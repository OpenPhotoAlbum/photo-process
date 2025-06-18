// Full AutoUpload service with native functionality for standalone builds
import { Platform } from 'react-native';
import { UploadAPI, UploadResponse, UploadProgress } from './UploadAPI';
import Constants from 'expo-constants';

// Conditionally import native modules
let MediaLibrary: any = null;
let Network: any = null;
let TaskManager: any = null;
let BackgroundFetch: any = null;
let AsyncStorage: any = null;

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

class AutoUploadService {
  private uploadAPI: UploadAPI;
  private isMonitoring: boolean = false;
  private uploadQueue: QueueItem[] = [];
  private activeUploads: Set<string> = new Set();
  private maxRetries: number = 3;
  private retryDelay: number = 30000;
  private isInitialized: boolean = false;
  private hasPermissions: boolean = false;
  private isStandalone: boolean = false;

  constructor() {
    this.uploadAPI = new UploadAPI();
    this.checkEnvironment();
    this.initializeModules();
  }

  // Check if running in standalone app vs Expo Go
  private checkEnvironment(): void {
    this.isStandalone = Constants.executionEnvironment === 'standalone';
    console.log('AutoUploadService: Running in', this.isStandalone ? 'standalone app' : 'Expo Go');
  }

  // Safely initialize native modules
  private async initializeModules(): Promise<void> {
    if (!this.isStandalone) {
      console.log('AutoUploadService: Expo Go detected - native modules disabled');
      return;
    }

    try {
      console.log('AutoUploadService: Loading native modules for standalone app...');
      
      MediaLibrary = await import('expo-media-library');
      Network = await import('expo-network');
      TaskManager = await import('expo-task-manager');
      BackgroundFetch = await import('expo-background-fetch');
      AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

      console.log('AutoUploadService: Native modules loaded successfully');
    } catch (error) {
      console.warn('AutoUploadService: Failed to load native modules:', error);
    }
  }

  // Initialize permissions and monitoring
  async initialize(): Promise<boolean> {
    try {
      console.log('AutoUploadService: Starting initialization...');

      if (!this.isStandalone) {
        console.log('AutoUploadService: Running in Expo Go - using safe mode');
        this.isInitialized = true;
        return true;
      }

      if (!MediaLibrary || !AsyncStorage) {
        console.log('AutoUploadService: Required modules not available');
        return false;
      }

      // Request media library permissions
      try {
        console.log('AutoUploadService: Requesting media library permissions...');
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          this.hasPermissions = true;
          console.log('AutoUploadService: Media library permissions granted');
        } else {
          console.log('AutoUploadService: Media library permission denied');
        }
      } catch (permError) {
        console.warn('AutoUploadService: Permission request failed:', permError);
      }

      // Load existing queue
      await this.loadQueue();

      this.isInitialized = true;
      console.log('AutoUploadService: Initialization completed');
      return true;
    } catch (error) {
      console.error('AutoUploadService: Initialization failed:', error);
      return false;
    }
  }

  // Get current auto-upload settings
  async getSettings(): Promise<AutoUploadSettings> {
    try {
      if (!this.isStandalone || !AsyncStorage) {
        return this.getDefaultSettings();
      }
      
      const [enabled, wifiOnly, quality, dailyLimit] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_UPLOAD_ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.WIFI_ONLY),
        AsyncStorage.getItem(STORAGE_KEYS.QUALITY_SETTING),
        AsyncStorage.getItem(STORAGE_KEYS.DAILY_LIMIT)
      ]);

      return {
        enabled: enabled === 'true' && this.hasPermissions,
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
      if (!this.isStandalone || !AsyncStorage) {
        console.log('AutoUploadService: Settings update - running in demo mode');
        return;
      }

      const updates: Array<Promise<void>> = [];
      
      if (settings.enabled !== undefined) {
        const canEnable = settings.enabled && this.hasPermissions;
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.AUTO_UPLOAD_ENABLED, canEnable.toString()));
        
        if (canEnable) {
          await this.startMonitoring();
        } else {
          await this.stopMonitoring();
        }
      }
      
      if (settings.wifiOnly !== undefined) {
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.WIFI_ONLY, settings.wifiOnly.toString()));
      }
      
      if (settings.qualitySetting !== undefined) {
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.QUALITY_SETTING, settings.qualitySetting));
      }
      
      if (settings.dailyLimit !== undefined) {
        updates.push(AsyncStorage.setItem(STORAGE_KEYS.DAILY_LIMIT, settings.dailyLimit.toString()));
      }

      await Promise.all(updates);
      console.log('AutoUploadService: Settings updated:', settings);
    } catch (error) {
      console.error('AutoUploadService: Failed to update settings:', error);
    }
  }

  // Start monitoring camera roll for new photos
  async startMonitoring(): Promise<void> {
    if (!this.isStandalone || !this.hasPermissions || !MediaLibrary) {
      console.log('AutoUploadService: Cannot start monitoring - missing requirements');
      return;
    }

    if (this.isMonitoring) {
      console.log('AutoUploadService: Already monitoring');
      return;
    }

    try {
      const settings = await this.getSettings();
      if (!settings.enabled) {
        console.log('AutoUploadService: Auto-upload disabled');
        return;
      }

      console.log('AutoUploadService: Starting camera roll monitoring...');
      this.isMonitoring = true;

      // Scan for new photos immediately
      await this.scanForNewPhotos();

      console.log('AutoUploadService: Monitoring started successfully');
    } catch (error) {
      console.error('AutoUploadService: Failed to start monitoring:', error);
      this.isMonitoring = false;
    }
  }

  // Stop monitoring
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    try {
      console.log('AutoUploadService: Stopping monitoring...');
      this.isMonitoring = false;
      console.log('AutoUploadService: Monitoring stopped');
    } catch (error) {
      console.error('AutoUploadService: Failed to stop monitoring:', error);
    }
  }

  // Scan camera roll for new photos since last scan
  async scanForNewPhotos(): Promise<void> {
    if (!this.isStandalone || !this.hasPermissions || !MediaLibrary || !AsyncStorage) {
      console.log('AutoUploadService: Scan - using demo mode');
      return;
    }

    try {
      const lastScanTime = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SCAN_TIME);
      const since = lastScanTime ? parseInt(lastScanTime) : Date.now() - (24 * 60 * 60 * 1000);

      console.log(`AutoUploadService: Scanning for photos since: ${new Date(since).toISOString()}`);

      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        createdAfter: since,
        sortBy: [MediaLibrary.SortBy.creationTime],
        first: 50,
      });

      console.log(`AutoUploadService: Found ${assets.assets.length} new photos`);

      // Add new photos to upload queue
      for (const asset of assets.assets) {
        await this.addToQueue(asset);
      }

      // Update last scan time
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SCAN_TIME, Date.now().toString());

      // Process upload queue
      await this.processQueue();
    } catch (error) {
      console.error('AutoUploadService: Failed to scan for new photos:', error);
    }
  }

  // Add photo to upload queue
  private async addToQueue(asset: any): Promise<void> {
    try {
      const existingItem = this.uploadQueue.find(item => item.id === asset.id);
      if (existingItem) {
        return;
      }

      const queueItem: QueueItem = {
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        creationTime: asset.creationTime,
        retryCount: 0,
        status: 'pending'
      };

      this.uploadQueue.push(queueItem);
      await this.saveQueue();

      console.log(`AutoUploadService: Added to queue: ${asset.filename}`);
    } catch (error) {
      console.error('AutoUploadService: Failed to add photo to queue:', error);
    }
  }

  // Process upload queue
  async processQueue(): Promise<void> {
    if (!this.isInitialized) {
      console.log('AutoUploadService: Cannot process queue - not initialized');
      return;
    }

    try {
      const settings = await this.getSettings();
      if (!settings.enabled) {
        console.log('AutoUploadService: Auto-upload disabled, skipping queue processing');
        return;
      }

      // Check network if available
      if (this.isStandalone && Network) {
        try {
          const networkState = await Network.getNetworkStateAsync();
          if (!networkState.isConnected) {
            console.log('AutoUploadService: No network connection, skipping upload');
            return;
          }

          if (settings.wifiOnly && networkState.type !== Network.NetworkStateType.WIFI) {
            console.log('AutoUploadService: WiFi-only mode enabled, but not on WiFi');
            return;
          }
        } catch (netError) {
          console.warn('AutoUploadService: Network check failed:', netError);
        }
      }

      // Get pending items
      const pendingItems = this.uploadQueue.filter(item => 
        item.status === 'pending' || 
        (item.status === 'failed' && item.retryCount < this.maxRetries)
      );

      console.log(`AutoUploadService: Processing ${pendingItems.length} pending uploads`);

      // Process uploads (limited concurrency)
      const activeUploadCount = this.activeUploads.size;
      const maxConcurrent = settings.maxConcurrentUploads;
      const availableSlots = maxConcurrent - activeUploadCount;

      for (let i = 0; i < Math.min(availableSlots, pendingItems.length); i++) {
        const item = pendingItems[i];
        this.uploadPhoto(item);
      }
    } catch (error) {
      console.error('AutoUploadService: Failed to process queue:', error);
    }
  }

  // Upload individual photo
  private async uploadPhoto(item: QueueItem): Promise<void> {
    if (this.activeUploads.has(item.id)) {
      return;
    }

    this.activeUploads.add(item.id);
    item.status = 'uploading';
    item.lastAttempt = Date.now();
    await this.saveQueue();

    try {
      console.log(`AutoUploadService: Uploading: ${item.filename}`);

      const response = await this.uploadAPI.uploadPhoto(
        item.uri,
        item.filename,
        (progress: UploadProgress) => {
          console.log(`AutoUploadService: Upload progress for ${item.filename}: ${progress.percentage}%`);
        }
      );

      item.status = 'completed';
      await this.trackUploadedSize(item.uri);
      console.log(`AutoUploadService: Upload completed: ${item.filename}`, response);

    } catch (error) {
      console.error(`AutoUploadService: Upload failed for ${item.filename}:`, error);
      
      item.retryCount++;
      if (item.retryCount >= this.maxRetries) {
        item.status = 'failed';
        console.log(`AutoUploadService: Max retries reached for ${item.filename}`);
      } else {
        item.status = 'pending';
        console.log(`AutoUploadService: Will retry ${item.filename} later`);
      }
    } finally {
      this.activeUploads.delete(item.id);
      await this.saveQueue();
    }
  }

  // Get upload statistics
  async getUploadStats(): Promise<UploadStats> {
    try {
      const uploadedToday = await this.getUploadedTodayMB();
      const settings = await this.getSettings();
      
      return {
        totalQueued: this.uploadQueue.filter(item => item.status === 'pending').length,
        totalCompleted: this.uploadQueue.filter(item => item.status === 'completed').length,
        totalFailed: this.uploadQueue.filter(item => item.status === 'failed').length,
        uploadedsToday: uploadedToday,
        dailyLimitMB: settings.dailyLimit
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
    await this.saveQueue();
    console.log('AutoUploadService: Cleared completed uploads from queue');
  }

  // Manual scan trigger
  async manualScan(): Promise<void> {
    console.log('AutoUploadService: Manual scan triggered');
    await this.scanForNewPhotos();
  }

  // Load queue from storage
  private async loadQueue(): Promise<void> {
    if (!this.isStandalone || !AsyncStorage) {
      this.uploadQueue = [];
      return;
    }

    try {
      const queueData = await AsyncStorage.getItem(STORAGE_KEYS.UPLOAD_QUEUE);
      if (queueData) {
        this.uploadQueue = JSON.parse(queueData);
        console.log(`AutoUploadService: Loaded ${this.uploadQueue.length} items from queue`);
      }
    } catch (error) {
      console.error('AutoUploadService: Failed to load queue:', error);
      this.uploadQueue = [];
    }
  }

  // Save queue to storage
  private async saveQueue(): Promise<void> {
    if (!this.isStandalone || !AsyncStorage) {
      return;
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.UPLOAD_QUEUE, JSON.stringify(this.uploadQueue));
    } catch (error) {
      console.error('AutoUploadService: Failed to save queue:', error);
    }
  }

  // Track uploaded file size for daily limit
  private async trackUploadedSize(uri: string): Promise<void> {
    if (!this.isStandalone || !AsyncStorage) {
      return;
    }

    try {
      const estimatedMB = 2; // Average mobile photo size
      const uploadedToday = await this.getUploadedTodayMB();
      const newTotal = uploadedToday + estimatedMB;
      
      await AsyncStorage.setItem(STORAGE_KEYS.UPLOADED_TODAY, newTotal.toString());
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_RESET_DATE, new Date().toDateString());
    } catch (error) {
      console.error('AutoUploadService: Failed to track uploaded size:', error);
    }
  }

  // Get uploaded data for today in MB
  private async getUploadedTodayMB(): Promise<number> {
    if (!this.isStandalone || !AsyncStorage) {
      return 0;
    }

    try {
      const lastResetDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_RESET_DATE);
      const today = new Date().toDateString();
      
      if (lastResetDate !== today) {
        await AsyncStorage.setItem(STORAGE_KEYS.UPLOADED_TODAY, '0');
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_RESET_DATE, today);
        return 0;
      }
      
      const uploadedToday = await AsyncStorage.getItem(STORAGE_KEYS.UPLOADED_TODAY);
      return parseFloat(uploadedToday || '0');
    } catch (error) {
      console.error('AutoUploadService: Failed to get uploaded today:', error);
      return 0;
    }
  }

  // Check if running in standalone mode
  isRunningStandalone(): boolean {
    return this.isStandalone;
  }
}

// Create singleton instance
export const autoUploadService = new AutoUploadService();