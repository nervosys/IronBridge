// Notification Service
// Handles local and push notifications for agent completion, errors, and updates

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AgentEvent, agentEngine } from './agentEngine';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export interface NotificationConfig {
    enableAgentNotifications: boolean;
    enableErrorNotifications: boolean;
    enableCompletionNotifications: boolean;
    soundEnabled: boolean;
}

const DEFAULT_CONFIG: NotificationConfig = {
    enableAgentNotifications: true,
    enableErrorNotifications: true,
    enableCompletionNotifications: true,
    soundEnabled: true,
};

class NotificationService {
    private config: NotificationConfig = DEFAULT_CONFIG;
    private unsubscribeAgentListener?: () => void;

    async initialize(): Promise<boolean> {
        // Request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Notification permissions not granted');
            return false;
        }

        // Setup notification channels for Android
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('agents', {
                name: 'Agent Notifications',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#007AFF',
            });

            await Notifications.setNotificationChannelAsync('errors', {
                name: 'Error Notifications',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 500, 250, 500],
                lightColor: '#FF3B30',
            });
        }

        // Subscribe to agent events
        this.subscribeToAgentEvents();

        return true;
    }

    private subscribeToAgentEvents(): void {
        this.unsubscribeAgentListener = agentEngine.addListener(this.handleAgentEvent);
    }

    private handleAgentEvent = async (event: AgentEvent): Promise<void> => {
        if (!this.config.enableAgentNotifications) return;

        switch (event.type) {
            case 'run_completed':
                if (this.config.enableCompletionNotifications) {
                    await this.sendNotification({
                        title: 'Agent Run Completed',
                        body: `Run ${event.runId.slice(0, 8)} has completed successfully`,
                        data: { runId: event.runId, type: 'run_completed' },
                        channelId: 'agents',
                    });
                }
                break;

            case 'run_failed':
                if (this.config.enableErrorNotifications) {
                    await this.sendNotification({
                        title: 'Agent Run Failed',
                        body: event.error || 'An error occurred during agent execution',
                        data: { runId: event.runId, type: 'run_failed' },
                        channelId: 'errors',
                    });
                }
                break;

            case 'task_completed':
                // Only notify for significant task completions
                if (this.config.enableCompletionNotifications) {
                    await this.sendNotification({
                        title: 'Task Completed',
                        body: `Task in run ${event.runId.slice(0, 8)} completed`,
                        data: { runId: event.runId, taskId: event.taskId, type: 'task_completed' },
                        channelId: 'agents',
                    });
                }
                break;

            case 'task_failed':
                if (this.config.enableErrorNotifications) {
                    await this.sendNotification({
                        title: 'Task Failed',
                        body: event.error || 'A task failed to complete',
                        data: { runId: event.runId, taskId: event.taskId, type: 'task_failed' },
                        channelId: 'errors',
                    });
                }
                break;
        }
    };

    async sendNotification(params: {
        title: string;
        body: string;
        data?: Record<string, any>;
        channelId?: string;
    }): Promise<string | null> {
        try {
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title: params.title,
                    body: params.body,
                    data: params.data,
                    sound: this.config.soundEnabled,
                },
                trigger: null, // Immediate notification
            });
            return id;
        } catch (error) {
            console.error('Failed to send notification:', error);
            return null;
        }
    }

    async scheduleNotification(params: {
        title: string;
        body: string;
        data?: Record<string, any>;
        seconds: number;
    }): Promise<string | null> {
        try {
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title: params.title,
                    body: params.body,
                    data: params.data,
                },
                trigger: {
                    seconds: params.seconds,
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                },
            });
            return id;
        } catch (error) {
            console.error('Failed to schedule notification:', error);
            return null;
        }
    }

    async cancelNotification(id: string): Promise<void> {
        await Notifications.cancelScheduledNotificationAsync(id);
    }

    async cancelAllNotifications(): Promise<void> {
        await Notifications.cancelAllScheduledNotificationsAsync();
    }

    async getBadgeCount(): Promise<number> {
        return await Notifications.getBadgeCountAsync();
    }

    async setBadgeCount(count: number): Promise<void> {
        await Notifications.setBadgeCountAsync(count);
    }

    async clearBadge(): Promise<void> {
        await Notifications.setBadgeCountAsync(0);
    }

    updateConfig(config: Partial<NotificationConfig>): void {
        this.config = { ...this.config, ...config };
    }

    getConfig(): NotificationConfig {
        return { ...this.config };
    }

    // Add notification response handler
    addNotificationResponseListener(
        handler: (response: Notifications.NotificationResponse) => void
    ): Notifications.Subscription {
        return Notifications.addNotificationResponseReceivedListener(handler);
    }

    // Add notification received handler (foreground)
    addNotificationReceivedListener(
        handler: (notification: Notifications.Notification) => void
    ): Notifications.Subscription {
        return Notifications.addNotificationReceivedListener(handler);
    }

    cleanup(): void {
        if (this.unsubscribeAgentListener) {
            this.unsubscribeAgentListener();
        }
    }
}

// Singleton instance
export const notificationService = new NotificationService();

// Hook for using in React components
export function useNotifications() {
    return {
        initialize: () => notificationService.initialize(),
        sendNotification: (params: Parameters<typeof notificationService.sendNotification>[0]) =>
            notificationService.sendNotification(params),
        scheduleNotification: (params: Parameters<typeof notificationService.scheduleNotification>[0]) =>
            notificationService.scheduleNotification(params),
        cancelNotification: (id: string) => notificationService.cancelNotification(id),
        cancelAllNotifications: () => notificationService.cancelAllNotifications(),
        getBadgeCount: () => notificationService.getBadgeCount(),
        setBadgeCount: (count: number) => notificationService.setBadgeCount(count),
        clearBadge: () => notificationService.clearBadge(),
        updateConfig: (config: Partial<NotificationConfig>) => notificationService.updateConfig(config),
        getConfig: () => notificationService.getConfig(),
        addResponseListener: notificationService.addNotificationResponseListener,
        addReceivedListener: notificationService.addNotificationReceivedListener,
    };
}
