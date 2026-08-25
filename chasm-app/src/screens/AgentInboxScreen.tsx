// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// CSM App - Agent Inbox Screen
// =============================================================================
// Inbox-style interface for managing agent messages, notifications, and permissions

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Modal,
    Alert,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { inbox as inboxApi } from '../api/inbox';
import type {
    AgentNotification,
    InboxMessage,
    PermissionRequest,
    WorkflowProgress,
} from '../api/inboxTypes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type InboxTab = 'all' | 'messages' | 'permissions' | 'workflows';

// Icon mapping for notification categories
const CATEGORY_ICONS: Record<string, { icon: string; color: string }> = {
    workflow_progress: { icon: 'analytics-outline', color: '#3b82f6' },
    workflow_complete: { icon: 'checkmark-circle-outline', color: '#10b981' },
    workflow_error: { icon: 'alert-circle-outline', color: '#ef4444' },
    permission_request: { icon: 'shield-checkmark-outline', color: '#f59e0b' },
    agent_message: { icon: 'chatbubble-outline', color: '#8b5cf6' },
    task_complete: { icon: 'checkbox-outline', color: '#06b6d4' },
    handoff: { icon: 'swap-horizontal-outline', color: '#ec4899' },
    system: { icon: 'information-circle-outline', color: '#6b7280' },
};

const RISK_COLORS: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
};

export function AgentInboxScreen() {
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<InboxTab>('all');
    const [notifications, setNotifications] = useState<AgentNotification[]>([]);
    const [messages, setMessages] = useState<InboxMessage[]>([]);
    const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
    const [workflows, setWorkflows] = useState<WorkflowProgress[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
    const [selectedPermission, setSelectedPermission] = useState<PermissionRequest | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const [pendingPermissionsCount, setPendingPermissionsCount] = useState(0);
    const [loadError, setLoadError] = useState<string | null>(null);

    /**
     * Load the inbox from the server.
     *
     * One `GET /api/inbox` plus one `GET /api/inbox/counts`, rather than four
     * separate list calls: the counts are rendered on the tabs beside the very
     * lists they count, and four independent requests could disagree.
     *
     * On failure the lists are left alone and the error is shown rather than
     * clearing them. An empty inbox and an unreachable server look identical
     * on screen, and this screen has spent its whole life looking empty.
     */
    const loadData = useCallback(async () => {
        try {
            const [snapshot, counts] = await Promise.all([
                inboxApi.snapshot(),
                inboxApi.counts(),
            ]);
            setNotifications(snapshot.notifications);
            setMessages(snapshot.messages);
            setPermissions(snapshot.permissions);
            setWorkflows(snapshot.workflows);
            setUnreadCount(counts.unreadNotifications);
            setUnreadMessageCount(counts.unreadMessages);
            setPendingPermissionsCount(counts.pendingPermissions);
            setLoadError(null);
        } catch (error) {
            setLoadError(
                error instanceof Error ? error.message : 'Could not reach the server'
            );
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadData();
        setIsRefreshing(false);
    };

    /**
     * Every mutation below re-reads the inbox rather than editing local state.
     *
     * The server derives part of what is shown -- a permission expires on read,
     * the unread counts are COUNT(*) over the same rows -- so guessing the new
     * state locally would drift from what the next load returns.
     */
    const handleMarkAllRead = async () => {
        await inboxApi.markAllNotificationsRead();
        await loadData();
    };

    const handleNotificationPress = async (notification: AgentNotification) => {
        if (!notification.read) {
            await inboxApi.markNotificationRead(notification.id);
            await loadData();
        }
        // Navigate based on notification type
        if (notification.data?.messageId) {
            const msg = messages.find(m => m.id === notification.data?.messageId);
            if (msg) setSelectedMessage(msg);
        } else if (notification.data?.permissionId) {
            const perm = permissions.find(p => p.id === notification.data?.permissionId);
            if (perm) setSelectedPermission(perm);
        }
    };

    const handleDismissNotification = async (id: string) => {
        await inboxApi.dismissNotification(id);
        await loadData();
    };

    const handleMessagePress = async (message: InboxMessage) => {
        if (!message.read) {
            await inboxApi.markMessageRead(message.id);
            await loadData();
        }
        setSelectedMessage(message);
    };

    const handleMessageResponse = async (messageId: string, response: string) => {
        await inboxApi.respondToMessage(messageId, response);
        setSelectedMessage(null);
        await loadData();
    };

    /**
     * Star or unstar the open message.
     *
     * The old button called the store and stopped there: `selectedMessage` was
     * never updated, so the icon it draws from never changed and the tap read
     * as a no-op. The server toggles from its own stored value, so the new
     * state is read back rather than assumed.
     */
    const handleToggleStar = async (message: InboxMessage) => {
        await inboxApi.toggleMessageStar(message.id);
        const snapshot = await inboxApi.snapshot();
        setMessages(snapshot.messages);
        const updated = snapshot.messages.find(m => m.id === message.id);
        if (updated) setSelectedMessage(updated);
    };

    /**
     * The server refuses to approve a request that has already expired, so a
     * failure here is a real answer -- the agent that raised it has moved on --
     * and is reported rather than swallowed.
     */
    const handlePermissionResponse = async (permissionId: string, approved: boolean) => {
        try {
            await inboxApi.respondToPermission(permissionId, approved);
        } catch (error) {
            Alert.alert(
                'Not recorded',
                error instanceof Error
                    ? error.message
                    : 'That request is no longer pending -- it may have expired.'
            );
        }
        setSelectedPermission(null);
        await loadData();
    };

    // Render tabs
    const renderTabs = () => (
        <View style={[styles.tabsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {([
                { key: 'all', label: 'All', count: unreadCount },
                { key: 'messages', label: 'Messages', count: unreadMessageCount },
                { key: 'permissions', label: 'Permissions', count: pendingPermissionsCount },
                { key: 'workflows', label: 'Workflows', count: workflows.length },
            ] as const).map(tab => (
                <TouchableOpacity
                    key={tab.key}
                    style={[
                        styles.tab,
                        activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                >
                    <Text style={[
                        styles.tabLabel,
                        { color: activeTab === tab.key ? colors.primary : colors.textSecondary },
                    ]}>
                        {tab.label}
                    </Text>
                    {tab.count > 0 && (
                        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.badgeText}>{tab.count > 99 ? '99+' : tab.count}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );

    // Render notification item
    const renderNotification = (notification: AgentNotification) => {
        const categoryConfig = CATEGORY_ICONS[notification.category] || CATEGORY_ICONS.system;

        return (
            <TouchableOpacity
                key={notification.id}
                style={[
                    styles.notificationCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    !notification.read && { borderLeftWidth: 3, borderLeftColor: colors.primary },
                ]}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.7}
            >
                <View style={[styles.iconContainer, { backgroundColor: `${categoryConfig.color}15` }]}>
                    <Ionicons name={categoryConfig.icon as any} size={20} color={categoryConfig.color} />
                </View>
                <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                        <Text style={[styles.notificationTitle, { color: colors.text }]} numberOfLines={1}>
                            {notification.title}
                        </Text>
                        <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>
                            {formatRelativeTime(notification.createdAt)}
                        </Text>
                    </View>
                    <Text style={[styles.notificationBody, { color: colors.textSecondary }]} numberOfLines={2}>
                        {notification.body}
                    </Text>
                    {notification.agentName && (
                        <View style={styles.agentBadge}>
                            <Ionicons name="person-circle-outline" size={12} color={colors.textTertiary} />
                            <Text style={[styles.agentName, { color: colors.textTertiary }]}>
                                {notification.agentName}
                            </Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={() => handleDismissNotification(notification.id)}
                >
                    <Ionicons name="close" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    // Render inbox message
    const renderMessage = (message: InboxMessage) => (
        <TouchableOpacity
            key={message.id}
            style={[
                styles.messageCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                !message.read && { borderLeftWidth: 3, borderLeftColor: '#8b5cf6' },
            ]}
            onPress={() => handleMessagePress(message)}
            activeOpacity={0.7}
        >
            <View style={styles.messageHeader}>
                <View style={styles.messageFrom}>
                    <Ionicons
                        name={message.type === 'agent_to_user' ? 'chatbubble' : 'mail'}
                        size={16}
                        color={message.starred ? '#f59e0b' : colors.textSecondary}
                    />
                    <Text style={[styles.messageFromText, { color: colors.text }]}>
                        {message.fromAgentName || 'System'}
                    </Text>
                    {message.requiresResponse && !message.userResponse && (
                        <View style={[styles.responseRequired, { backgroundColor: '#ef444420' }]}>
                            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '600' }}>
                                Response Required
                            </Text>
                        </View>
                    )}
                </View>
                <Text style={[styles.messageTime, { color: colors.textSecondary }]}>
                    {formatRelativeTime(message.createdAt)}
                </Text>
            </View>
            <Text style={[styles.messageSubject, { color: colors.text }]} numberOfLines={1}>
                {message.subject}
            </Text>
            <Text style={[styles.messagePreview, { color: colors.textSecondary }]} numberOfLines={2}>
                {message.body}
            </Text>
            {message.userResponse && (
                <View style={[styles.responseTag, { backgroundColor: '#10b98120' }]}>
                    <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                    <Text style={{ color: '#10b981', fontSize: 11, marginLeft: 4 }}>Responded</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    // Render permission request
    const renderPermission = (request: PermissionRequest) => (
        <View
            key={request.id}
            style={[
                styles.permissionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
            ]}
        >
            <View style={styles.permissionHeader}>
                <View style={[styles.riskBadge, { backgroundColor: `${RISK_COLORS[request.riskLevel]}20` }]}>
                    <Ionicons
                        name={request.riskLevel === 'critical' ? 'warning' : 'shield'}
                        size={14}
                        color={RISK_COLORS[request.riskLevel]}
                    />
                    <Text style={[styles.riskText, { color: RISK_COLORS[request.riskLevel] }]}>
                        {request.riskLevel.toUpperCase()}
                    </Text>
                </View>
                <Text style={[styles.permissionTime, { color: colors.textSecondary }]}>
                    Expires {formatRelativeTime(request.expiresAt)}
                </Text>
            </View>
            <Text style={[styles.permissionTitle, { color: colors.text }]}>
                {request.title}
            </Text>
            <Text style={[styles.permissionDescription, { color: colors.textSecondary }]}>
                {request.description}
            </Text>
            <View style={styles.permissionAgent}>
                <Ionicons name="person-circle" size={14} color={colors.textTertiary} />
                <Text style={[styles.permissionAgentName, { color: colors.textTertiary }]}>
                    {request.agentName}
                </Text>
            </View>
            <View style={styles.permissionReason}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.permissionReasonText, { color: colors.textSecondary }]}>
                    {request.reason}
                </Text>
            </View>
            <View style={styles.permissionActions}>
                <TouchableOpacity
                    style={[styles.denyButton, { borderColor: '#ef4444' }]}
                    onPress={() => handlePermissionResponse(request.id, false)}
                >
                    <Ionicons name="close" size={18} color="#ef4444" />
                    <Text style={styles.denyText}>Deny</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.approveButton, { backgroundColor: '#10b981' }]}
                    onPress={() => handlePermissionResponse(request.id, true)}
                >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.approveText}>Approve</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Render workflow progress
    const renderWorkflow = (workflow: WorkflowProgress) => {
        const statusColors: Record<string, string> = {
            running: '#3b82f6',
            paused: '#f59e0b',
            completed: '#10b981',
            failed: '#ef4444',
            cancelled: '#6b7280',
        };
        const statusColor = statusColors[workflow.status] || '#6b7280';

        return (
            <View
                key={workflow.runId}
                style={[styles.workflowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
                <View style={styles.workflowHeader}>
                    <Text style={[styles.workflowName, { color: colors.text }]} numberOfLines={1}>
                        {workflow.name}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {workflow.status}
                        </Text>
                    </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${workflow.progress}%`, backgroundColor: statusColor },
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                        {workflow.progress}%
                    </Text>
                </View>

                {/* Current step */}
                {workflow.currentStep && (
                    <Text style={[styles.currentStep, { color: colors.textSecondary }]} numberOfLines={1}>
                        {workflow.currentStep}
                    </Text>
                )}

                {/* Active agents */}
                {workflow.activeAgents.length > 0 && (
                    <View style={styles.activeAgents}>
                        {workflow.activeAgents.slice(0, 3).map(agent => (
                            <View key={agent.id} style={[styles.agentChip, { backgroundColor: `${colors.primary}15` }]}>
                                <View style={[styles.agentStatusDot, { backgroundColor: '#10b981' }]} />
                                <Text style={[styles.agentChipText, { color: colors.primary }]}>
                                    {agent.name}
                                </Text>
                            </View>
                        ))}
                        {workflow.activeAgents.length > 3 && (
                            <Text style={[styles.moreAgents, { color: colors.textSecondary }]}>
                                +{workflow.activeAgents.length - 3} more
                            </Text>
                        )}
                    </View>
                )}

                {/* Metrics */}
                <View style={styles.workflowMetrics}>
                    <View style={styles.metric}>
                        <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.metricText, { color: colors.textSecondary }]}>
                            {formatDuration(workflow.elapsedTime)}
                        </Text>
                    </View>
                    <View style={styles.metric}>
                        <Ionicons name="analytics-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.metricText, { color: colors.textSecondary }]}>
                            {workflow.tokensUsed.toLocaleString()} tokens
                        </Text>
                    </View>
                    {workflow.estimatedCost !== undefined && (
                        <View style={styles.metric}>
                            <Ionicons name="cash-outline" size={14} color={colors.textTertiary} />
                            <Text style={[styles.metricText, { color: colors.textSecondary }]}>
                                ${workflow.estimatedCost.toFixed(4)}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    // Render message detail modal
    const renderMessageModal = () => (
        <Modal
            visible={!!selectedMessage}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setSelectedMessage(null)}
        >
            {selectedMessage && (
                <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                    <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={() => setSelectedMessage(null)}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Message</Text>
                        <TouchableOpacity onPress={() => handleToggleStar(selectedMessage)}>
                            <Ionicons
                                name={selectedMessage.starred ? 'star' : 'star-outline'}
                                size={24}
                                color={selectedMessage.starred ? '#f59e0b' : colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalContent}>
                        <View style={styles.messageDetailHeader}>
                            <Text style={[styles.messageDetailFrom, { color: colors.textSecondary }]}>
                                From: {selectedMessage.fromAgentName || 'System'}
                            </Text>
                            <Text style={[styles.messageDetailDate, { color: colors.textSecondary }]}>
                                {new Date(selectedMessage.createdAt).toLocaleString()}
                            </Text>
                        </View>
                        <Text style={[styles.messageDetailSubject, { color: colors.text }]}>
                            {selectedMessage.subject}
                        </Text>
                        <Text style={[styles.messageDetailBody, { color: colors.text }]}>
                            {selectedMessage.body}
                        </Text>

                        {selectedMessage.requiresResponse && !selectedMessage.userResponse && (
                            <View style={styles.responseSection}>
                                <Text style={[styles.responseSectionTitle, { color: colors.text }]}>
                                    Response Required
                                </Text>
                                {selectedMessage.responseOptions ? (
                                    <View style={styles.responseOptions}>
                                        {selectedMessage.responseOptions.map(option => (
                                            <TouchableOpacity
                                                key={option}
                                                style={[styles.responseOption, { backgroundColor: colors.primary }]}
                                                onPress={() => handleMessageResponse(selectedMessage.id, option)}
                                            >
                                                <Text style={styles.responseOptionText}>{option}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.responseActions}>
                                        <TouchableOpacity
                                            style={[styles.responseAction, { backgroundColor: '#ef4444' }]}
                                            onPress={() => handleMessageResponse(selectedMessage.id, 'denied')}
                                        >
                                            <Text style={styles.responseActionText}>Deny</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.responseAction, { backgroundColor: '#10b981' }]}
                                            onPress={() => handleMessageResponse(selectedMessage.id, 'approved')}
                                        >
                                            <Text style={styles.responseActionText}>Approve</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        {selectedMessage.userResponse && (
                            <View style={[styles.responseGiven, { backgroundColor: '#10b98115' }]}>
                                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                                <Text style={[styles.responseGivenText, { color: '#10b981' }]}>
                                    Responded: {selectedMessage.userResponse}
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            )}
        </Modal>
    );

    // Render content based on active tab
    const renderContent = () => {
        switch (activeTab) {
            case 'messages':
                return messages.length > 0 ? (
                    messages.map(renderMessage)
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="mail-outline" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Messages</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                            Agent messages will appear here
                        </Text>
                    </View>
                );

            case 'permissions':
                return permissions.length > 0 ? (
                    permissions.map(renderPermission)
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="shield-checkmark-outline" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Pending Permissions</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                            Permission requests will appear here
                        </Text>
                    </View>
                );

            case 'workflows':
                return workflows.length > 0 ? (
                    workflows.map(renderWorkflow)
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="git-network-outline" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Active Workflows</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                            Running workflows will appear here
                        </Text>
                    </View>
                );

            case 'all':
            default:
                const allItems = [
                    ...notifications.map(n => ({ type: 'notification' as const, data: n, time: n.createdAt })),
                ].sort((a, b) => b.time - a.time);

                return allItems.length > 0 ? (
                    allItems.map(item => item.type === 'notification' && renderNotification(item.data))
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="notifications-outline" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>All Caught Up!</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                            No notifications to show
                        </Text>
                    </View>
                );
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Agent Inbox</Text>
                {unreadCount > 0 && (
                    <TouchableOpacity style={styles.markAllReadButton} onPress={handleMarkAllRead}>
                        <Text style={[styles.markAllReadText, { color: colors.primary }]}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {renderTabs()}

            {/*
              * Shown instead of letting an unreachable server render as an
              * empty inbox, which is the failure this screen is most likely to
              * hit and the one hardest to tell from "nothing has happened yet".
              */}
            {loadError && (
                <View style={[styles.loadErrorBanner, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <Ionicons name="cloud-offline-outline" size={16} color="#ef4444" />
                    <Text style={[styles.loadErrorText, { color: colors.textSecondary }]}>
                        Could not load the inbox: {loadError}. Pull to retry.
                    </Text>
                </View>
            )}

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
            >
                {renderContent()}
            </ScrollView>

            {renderMessageModal()}
        </View>
    );
}

// Helper functions
function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadErrorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    loadErrorText: {
        flex: 1,
        fontSize: 13,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    markAllReadButton: {
        padding: 8,
    },
    markAllReadText: {
        fontSize: 14,
        fontWeight: '600',
    },
    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    badge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        gap: 12,
    },
    notificationCard: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationContent: {
        flex: 1,
    },
    notificationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    notificationTitle: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    notificationTime: {
        fontSize: 12,
    },
    notificationBody: {
        fontSize: 13,
        lineHeight: 18,
    },
    agentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4,
    },
    agentName: {
        fontSize: 11,
    },
    dismissButton: {
        padding: 4,
    },
    messageCard: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    messageFrom: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    messageFromText: {
        fontSize: 14,
        fontWeight: '600',
    },
    responseRequired: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    messageTime: {
        fontSize: 12,
    },
    messageSubject: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    messagePreview: {
        fontSize: 13,
        lineHeight: 18,
    },
    responseTag: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginTop: 8,
    },
    permissionCard: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    permissionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    riskBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 4,
    },
    riskText: {
        fontSize: 11,
        fontWeight: '700',
    },
    permissionTime: {
        fontSize: 12,
    },
    permissionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    permissionDescription: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 8,
    },
    permissionAgent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
    },
    permissionAgentName: {
        fontSize: 12,
    },
    permissionReason: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 8,
        marginBottom: 12,
    },
    permissionReasonText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
    },
    permissionActions: {
        flexDirection: 'row',
        gap: 12,
    },
    denyButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        gap: 6,
    },
    denyText: {
        color: '#ef4444',
        fontWeight: '600',
    },
    approveButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    approveText: {
        color: '#fff',
        fontWeight: '600',
    },
    workflowCard: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    workflowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    workflowName: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    progressBar: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '600',
        width: 40,
        textAlign: 'right',
    },
    currentStep: {
        fontSize: 13,
        marginBottom: 10,
    },
    activeAgents: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    agentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    agentStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    agentChipText: {
        fontSize: 12,
        fontWeight: '500',
    },
    moreAgents: {
        fontSize: 12,
        alignSelf: 'center',
    },
    workflowMetrics: {
        flexDirection: 'row',
        gap: 16,
    },
    metric: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metricText: {
        fontSize: 12,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    modalContent: {
        flex: 1,
        padding: 16,
    },
    messageDetailHeader: {
        marginBottom: 16,
    },
    messageDetailFrom: {
        fontSize: 14,
        marginBottom: 4,
    },
    messageDetailDate: {
        fontSize: 13,
    },
    messageDetailSubject: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
    },
    messageDetailBody: {
        fontSize: 15,
        lineHeight: 22,
    },
    responseSection: {
        marginTop: 24,
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    responseSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    responseOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    responseOption: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    responseOptionText: {
        color: '#fff',
        fontWeight: '600',
    },
    responseActions: {
        flexDirection: 'row',
        gap: 12,
    },
    responseAction: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    responseActionText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    responseGiven: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginTop: 16,
        gap: 8,
    },
    responseGivenText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
