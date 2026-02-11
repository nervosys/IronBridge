// Widget Service
// Provides data and functionality for iOS/Android home screen widgets
// Copyright (c) 2024-2028 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

const WIDGET_DATA_KEY = '@chasm_widget_data';
const WIDGET_CONFIG_KEY = '@chasm_widget_config';

// ============================================================================
// Types
// ============================================================================

export interface WidgetConfig {
  /** Enabled widget types */
  enabledWidgets: WidgetType[];
  /** Refresh interval in minutes */
  refreshIntervalMinutes: number;
  /** Show session previews */
  showPreviews: boolean;
  /** Maximum sessions to show */
  maxSessions: number;
  /** Theme */
  theme: 'system' | 'light' | 'dark';
}

export type WidgetType = 
  | 'quick_stats'
  | 'recent_sessions'
  | 'quick_actions'
  | 'search'
  | 'favorites'
  | 'provider_status';

export interface WidgetData {
  /** Last update timestamp */
  lastUpdated: number;
  /** Quick stats data */
  stats: QuickStats;
  /** Recent sessions for widget */
  recentSessions: WidgetSession[];
  /** Favorite sessions */
  favorites: WidgetSession[];
  /** Provider status */
  providers: ProviderStatus[];
}

export interface QuickStats {
  totalSessions: number;
  totalMessages: number;
  sessionsToday: number;
  messagesToday: number;
  activeProviders: number;
  pendingSync: number;
}

export interface WidgetSession {
  id: string;
  title: string;
  provider: string;
  providerIcon: string;
  messageCount: number;
  lastMessage?: string;
  lastMessageTime: number;
  isFavorite: boolean;
  tags: string[];
}

export interface ProviderStatus {
  id: string;
  name: string;
  icon: string;
  isConnected: boolean;
  sessionCount: number;
  lastSync?: number;
}

export interface WidgetAction {
  type: 'open_session' | 'new_session' | 'search' | 'harvest' | 'sync' | 'open_app';
  sessionId?: string;
  query?: string;
  provider?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: WidgetConfig = {
  enabledWidgets: ['quick_stats', 'recent_sessions', 'quick_actions'],
  refreshIntervalMinutes: 30,
  showPreviews: true,
  maxSessions: 5,
  theme: 'system',
};

const DEFAULT_DATA: WidgetData = {
  lastUpdated: 0,
  stats: {
    totalSessions: 0,
    totalMessages: 0,
    sessionsToday: 0,
    messagesToday: 0,
    activeProviders: 0,
    pendingSync: 0,
  },
  recentSessions: [],
  favorites: [],
  providers: [],
};

// ============================================================================
// Widget Service
// ============================================================================

class WidgetService {
  private config: WidgetConfig = DEFAULT_CONFIG;
  private data: WidgetData = DEFAULT_DATA;
  private nativeModule: any = null;
  private eventEmitter: NativeEventEmitter | null = null;

  /**
   * Initialize the widget service
   */
  async initialize(): Promise<void> {
    await this.loadConfig();
    await this.loadData();

    // Initialize native module if available
    this.initializeNativeModule();

    console.log('[WidgetService] Initialized', {
      platform: Platform.OS,
      enabledWidgets: this.config.enabledWidgets,
    });
  }

  /**
   * Initialize native widget module
   */
  private initializeNativeModule(): void {
    try {
      if (Platform.OS === 'ios') {
        this.nativeModule = NativeModules.ChasmWidgetModule;
      } else if (Platform.OS === 'android') {
        this.nativeModule = NativeModules.ChasmWidgetModule;
      }

      if (this.nativeModule) {
        this.eventEmitter = new NativeEventEmitter(this.nativeModule);
        this.eventEmitter.addListener('widgetAction', this.handleWidgetAction);
      }
    } catch (error) {
      console.log('[WidgetService] Native module not available');
    }
  }

  /**
   * Handle action from widget
   */
  private handleWidgetAction = (action: WidgetAction): void => {
    console.log('[WidgetService] Widget action received:', action);
    // Emit event for app to handle
    this.actionListeners.forEach(listener => listener(action));
  };

  private actionListeners: Set<(action: WidgetAction) => void> = new Set();

  /**
   * Subscribe to widget actions
   */
  onWidgetAction(listener: (action: WidgetAction) => void): () => void {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  /**
   * Load configuration from storage
   */
  private async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(WIDGET_CONFIG_KEY);
      if (stored) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[WidgetService] Failed to load config:', error);
    }
  }

  /**
   * Save configuration
   */
  async saveConfig(config: Partial<WidgetConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    try {
      await AsyncStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(this.config));
      await this.refreshWidgets();
    } catch (error) {
      console.error('[WidgetService] Failed to save config:', error);
    }
  }

  /**
   * Load widget data from storage
   */
  private async loadData(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(WIDGET_DATA_KEY);
      if (stored) {
        this.data = { ...DEFAULT_DATA, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[WidgetService] Failed to load data:', error);
    }
  }

  /**
   * Save widget data
   */
  private async saveData(): Promise<void> {
    try {
      await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.error('[WidgetService] Failed to save data:', error);
    }
  }

  /**
   * Update widget data and refresh native widgets
   */
  async updateData(data: Partial<WidgetData>): Promise<void> {
    this.data = {
      ...this.data,
      ...data,
      lastUpdated: Date.now(),
    };

    await this.saveData();
    await this.refreshWidgets();
  }

  /**
   * Update quick stats
   */
  async updateStats(stats: Partial<QuickStats>): Promise<void> {
    this.data.stats = { ...this.data.stats, ...stats };
    this.data.lastUpdated = Date.now();
    await this.saveData();
    await this.refreshWidgets();
  }

  /**
   * Update recent sessions
   */
  async updateRecentSessions(sessions: WidgetSession[]): Promise<void> {
    this.data.recentSessions = sessions.slice(0, this.config.maxSessions);
    this.data.lastUpdated = Date.now();
    await this.saveData();
    await this.refreshWidgets();
  }

  /**
   * Update favorites
   */
  async updateFavorites(favorites: WidgetSession[]): Promise<void> {
    this.data.favorites = favorites;
    this.data.lastUpdated = Date.now();
    await this.saveData();
    await this.refreshWidgets();
  }

  /**
   * Update provider status
   */
  async updateProviders(providers: ProviderStatus[]): Promise<void> {
    this.data.providers = providers;
    this.data.lastUpdated = Date.now();
    await this.saveData();
    await this.refreshWidgets();
  }

  /**
   * Add/remove session from favorites
   */
  async toggleFavorite(sessionId: string): Promise<void> {
    const existingIndex = this.data.favorites.findIndex(s => s.id === sessionId);
    
    if (existingIndex >= 0) {
      this.data.favorites.splice(existingIndex, 1);
    } else {
      const session = this.data.recentSessions.find(s => s.id === sessionId);
      if (session) {
        this.data.favorites.unshift({ ...session, isFavorite: true });
      }
    }

    await this.saveData();
    await this.refreshWidgets();
  }

  /**
   * Refresh native widgets
   */
  async refreshWidgets(): Promise<void> {
    if (!this.nativeModule) return;

    try {
      // Prepare data for native widgets
      const widgetPayload = {
        stats: this.data.stats,
        recentSessions: this.data.recentSessions,
        favorites: this.data.favorites,
        providers: this.data.providers,
        config: this.config,
      };

      if (Platform.OS === 'ios') {
        await this.nativeModule.updateWidgets(widgetPayload);
      } else if (Platform.OS === 'android') {
        await this.nativeModule.updateWidgets(JSON.stringify(widgetPayload));
      }

      console.log('[WidgetService] Widgets refreshed');
    } catch (error) {
      console.error('[WidgetService] Failed to refresh widgets:', error);
    }
  }

  /**
   * Get current widget data
   */
  getData(): WidgetData {
    return { ...this.data };
  }

  /**
   * Get current widget config
   */
  getConfig(): WidgetConfig {
    return { ...this.config };
  }

  /**
   * Get supported widget types for current platform
   */
  getSupportedWidgets(): WidgetType[] {
    const common: WidgetType[] = ['quick_stats', 'recent_sessions', 'quick_actions'];
    
    if (Platform.OS === 'ios') {
      return [...common, 'search', 'favorites', 'provider_status'];
    } else if (Platform.OS === 'android') {
      return [...common, 'favorites'];
    }
    
    return common;
  }

  /**
   * Check if widgets are supported
   */
  isSupported(): boolean {
    return this.nativeModule !== null;
  }

  /**
   * Request widget gallery (iOS 17+)
   */
  async requestWidgetGallery(): Promise<void> {
    if (Platform.OS === 'ios' && this.nativeModule?.requestWidgetGallery) {
      await this.nativeModule.requestWidgetGallery();
    }
  }
}

// Export singleton instance
export const widgetService = new WidgetService();
export default widgetService;
