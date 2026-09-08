// Background Sync Service
// Handles background synchronization with battery optimization
// Copyright (c) 2024-2028 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform, AppState, AppStateStatus } from 'react-native';

const SYNC_CONFIG_KEY = '@ironbridge_sync_config';
const SYNC_HISTORY_KEY = '@ironbridge_sync_history';
const SYNC_QUEUE_KEY = '@ironbridge_sync_queue';

// ============================================================================
// Types
// ============================================================================

export interface SyncConfig {
  /** Enable background sync */
  enabled: boolean;
  /** Sync interval in minutes */
  intervalMinutes: number;
  /** Only sync on WiFi */
  wifiOnly: boolean;
  /** Only sync when charging */
  chargingOnly: boolean;
  /** Minimum battery level to sync (0-100) */
  minBatteryLevel: number;
  /** Sync during quiet hours */
  quietHoursEnabled: boolean;
  /** Quiet hours start (24h format, e.g., "22:00") */
  quietHoursStart: string;
  /** Quiet hours end (24h format, e.g., "07:00") */
  quietHoursEnd: string;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry backoff multiplier */
  retryBackoffMs: number;
}

export interface SyncHistoryEntry {
  id: string;
  timestamp: number;
  type: 'full' | 'incremental' | 'manual';
  status: 'success' | 'partial' | 'failed';
  sessionsSynced: number;
  bytesTransferred: number;
  durationMs: number;
  error?: string;
  batteryLevel?: number;
  networkType?: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'upload' | 'download' | 'delete';
  resourceType: 'session' | 'message' | 'attachment';
  resourceId: string;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  lastAttempt?: number;
  error?: string;
  data?: any;
}

export interface BatteryInfo {
  level: number;
  isCharging: boolean;
}

export interface NetworkInfo {
  isConnected: boolean;
  type: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';
  isMetered: boolean;
}

export interface SyncConditions {
  battery: BatteryInfo;
  network: NetworkInfo;
  isQuietHours: boolean;
  canSync: boolean;
  reason?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: SyncConfig = {
  enabled: true,
  intervalMinutes: 15,
  wifiOnly: false,
  chargingOnly: false,
  minBatteryLevel: 20,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  maxRetries: 3,
  retryBackoffMs: 5000,
};

// ============================================================================
// Background Sync Service
// ============================================================================

class BackgroundSyncService {
  private config: SyncConfig = DEFAULT_CONFIG;
  private syncHistory: SyncHistoryEntry[] = [];
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing: boolean = false;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private appState: AppStateStatus = 'active';
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  /**
   * Initialize the background sync service
   */
  async initialize(): Promise<void> {
    await this.loadConfig();
    await this.loadSyncHistory();
    await this.loadSyncQueue();

    // Listen to app state changes
    AppState.addEventListener('change', this.handleAppStateChange);

    // Start sync timer if enabled
    if (this.config.enabled) {
      this.schedulNextSync();
    }

    console.log('[BackgroundSync] Initialized', {
      enabled: this.config.enabled,
      interval: this.config.intervalMinutes,
      queuedItems: this.syncQueue.length,
    });
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    const prevState = this.appState;
    this.appState = nextAppState;

    if (prevState !== 'active' && nextAppState === 'active') {
      // App became active - check if sync needed
      this.checkAndSync();
    } else if (prevState === 'active' && nextAppState === 'background') {
      // App went to background - schedule background sync
      this.scheduleBackgroundSync();
    }
  };

  /**
   * Load configuration from storage
   */
  private async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_CONFIG_KEY);
      if (stored) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to load config:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  async saveConfig(config: Partial<SyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    try {
      await AsyncStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(this.config));
      
      // Restart sync timer with new interval
      this.cancelSyncTimer();
      if (this.config.enabled) {
        this.schedulNextSync();
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to save config:', error);
    }
  }

  /**
   * Load sync history from storage
   */
  private async loadSyncHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_HISTORY_KEY);
      if (stored) {
        this.syncHistory = JSON.parse(stored);
        // Keep only last 100 entries
        this.syncHistory = this.syncHistory.slice(-100);
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to load sync history:', error);
    }
  }

  /**
   * Load sync queue from storage
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        this.syncQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to load sync queue:', error);
    }
  }

  /**
   * Save sync queue to storage
   */
  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('[BackgroundSync] Failed to save sync queue:', error);
    }
  }

  /**
   * Get current battery info
   */
  private async getBatteryInfo(): Promise<BatteryInfo> {
    // In a real implementation, use react-native-battery
    // For now, return mock data
    return {
      level: 80,
      isCharging: false,
    };
  }

  /**
   * Get current network info
   */
  private async getNetworkInfo(): Promise<NetworkInfo> {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected ?? false,
      type: (state.type as NetworkInfo['type']) || 'unknown',
      isMetered: state.details?.isConnectionExpensive ?? false,
    };
  }

  /**
   * Check if currently in quiet hours
   */
  private isInQuietHours(): boolean {
    if (!this.config.quietHoursEnabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = this.config.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = this.config.quietHoursEnd.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 - 07:00)
    if (startMinutes > endMinutes) {
      return currentTime >= startMinutes || currentTime < endMinutes;
    }

    return currentTime >= startMinutes && currentTime < endMinutes;
  }

  /**
   * Check sync conditions
   */
  async checkSyncConditions(): Promise<SyncConditions> {
    const battery = await this.getBatteryInfo();
    const network = await this.getNetworkInfo();
    const isQuietHours = this.isInQuietHours();

    let canSync = true;
    let reason: string | undefined;

    if (!this.config.enabled) {
      canSync = false;
      reason = 'Sync disabled';
    } else if (!network.isConnected) {
      canSync = false;
      reason = 'No network connection';
    } else if (this.config.wifiOnly && network.type !== 'wifi') {
      canSync = false;
      reason = 'WiFi-only sync enabled';
    } else if (this.config.chargingOnly && !battery.isCharging) {
      canSync = false;
      reason = 'Charging-only sync enabled';
    } else if (battery.level < this.config.minBatteryLevel && !battery.isCharging) {
      canSync = false;
      reason = `Battery level too low (${battery.level}%)`;
    } else if (isQuietHours) {
      canSync = false;
      reason = 'Quiet hours active';
    }

    return { battery, network, isQuietHours, canSync, reason };
  }

  /**
   * Schedule next sync
   */
  private schedulNextSync(): void {
    this.cancelSyncTimer();
    
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    this.syncTimer = setTimeout(() => {
      this.checkAndSync();
    }, intervalMs);
  }

  /**
   * Cancel sync timer
   */
  private cancelSyncTimer(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Schedule background sync (when app goes to background)
   */
  private scheduleBackgroundSync(): void {
    // In a real implementation, use react-native-background-fetch
    // or similar library for true background execution
    console.log('[BackgroundSync] Scheduling background sync');
  }

  /**
   * Check conditions and sync if possible
   */
  async checkAndSync(): Promise<void> {
    const conditions = await this.checkSyncConditions();

    if (conditions.canSync) {
      await this.performSync('incremental');
    } else {
      console.log('[BackgroundSync] Sync skipped:', conditions.reason);
    }

    // Schedule next sync
    this.schedulNextSync();
  }

  /**
   * Add item to sync queue
   */
  async queueSync(item: Omit<SyncQueueItem, 'id' | 'retryCount'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0,
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();
    this.notifyListeners();

    // If high priority, try to sync immediately
    if (item.priority === 'high') {
      this.checkAndSync();
    }
  }

  /**
   * Perform sync operation
   */
  async performSync(type: 'full' | 'incremental' | 'manual'): Promise<SyncHistoryEntry> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.notifyListeners();

    const startTime = Date.now();
    const conditions = await this.checkSyncConditions();
    
    const entry: SyncHistoryEntry = {
      id: `sync_${startTime}`,
      timestamp: startTime,
      type,
      status: 'success',
      sessionsSynced: 0,
      bytesTransferred: 0,
      durationMs: 0,
      batteryLevel: conditions.battery.level,
      networkType: conditions.network.type,
    };

    try {
      // Process sync queue
      const processedItems: string[] = [];
      
      for (const item of this.syncQueue) {
        try {
          await this.processQueueItem(item);
          processedItems.push(item.id);
          entry.sessionsSynced++;
        } catch (error) {
          item.retryCount++;
          item.lastAttempt = Date.now();
          item.error = error instanceof Error ? error.message : 'Unknown error';

          if (item.retryCount >= this.config.maxRetries) {
            processedItems.push(item.id); // Remove after max retries
            entry.status = 'partial';
          }
        }
      }

      // Remove processed items
      this.syncQueue = this.syncQueue.filter(item => !processedItems.includes(item.id));
      await this.saveSyncQueue();

    } catch (error) {
      entry.status = 'failed';
      entry.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      entry.durationMs = Date.now() - startTime;
      
      // Add to history
      this.syncHistory.push(entry);
      await this.saveSyncHistory();

      this.isSyncing = false;
      this.notifyListeners();
    }

    return entry;
  }

  /**
   * Save sync history
   */
  private async saveSyncHistory(): Promise<void> {
    try {
      // Keep only last 100 entries
      this.syncHistory = this.syncHistory.slice(-100);
      await AsyncStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(this.syncHistory));
    } catch (error) {
      console.error('[BackgroundSync] Failed to save sync history:', error);
    }
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // In a real implementation, this would call the API
    console.log('[BackgroundSync] Processing queue item:', item.id);
  }

  /**
   * Trigger manual sync
   */
  async triggerManualSync(): Promise<SyncHistoryEntry> {
    return this.performSync('manual');
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return {
      isSyncing: this.isSyncing,
      queuedItems: this.syncQueue.length,
      lastSync: this.syncHistory[this.syncHistory.length - 1] ?? null,
      config: this.config,
    };
  }

  /**
   * Get sync history
   */
  getHistory(): SyncHistoryEntry[] {
    return [...this.syncHistory];
  }

  /**
   * Get sync queue
   */
  getQueue(): SyncQueueItem[] {
    return [...this.syncQueue];
  }

  /**
   * Subscribe to status changes
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Clear sync history
   */
  async clearHistory(): Promise<void> {
    this.syncHistory = [];
    await AsyncStorage.removeItem(SYNC_HISTORY_KEY);
    this.notifyListeners();
  }

  /**
   * Clear sync queue
   */
  async clearQueue(): Promise<void> {
    this.syncQueue = [];
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
    this.notifyListeners();
  }
}

export interface SyncStatus {
  isSyncing: boolean;
  queuedItems: number;
  lastSync: SyncHistoryEntry | null;
  config: SyncConfig;
}

// Export singleton instance
export const backgroundSync = new BackgroundSyncService();
export default backgroundSync;
