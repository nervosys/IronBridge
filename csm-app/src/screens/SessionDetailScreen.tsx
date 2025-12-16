import React, { useState } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { getSession, Message, SessionWithMessages, ToolInvocation, FileChange } from '../api';
import { RootStackParamList } from '../navigation/types';
import { formatDate } from '../utils/formatDate';
import { useTheme } from '../context/ThemeContext';

type Props = {
    route: RouteProp<RootStackParamList, 'SessionDetail'>;
};

// Helper functions for tool display
const getToolIcon = (toolName: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
        'run_in_terminal': 'terminal-outline',
        'terminal': 'terminal-outline',
        'copilot_replaceString': 'create-outline',
        'replace_string_in_file': 'create-outline',
        'read_file': 'document-text-outline',
        'create_file': 'add-circle-outline',
        'editFile': 'pencil-outline',
        'createFile': 'add-circle-outline',
        'get_terminal_output': 'reader-outline',
        'semantic_search': 'search-outline',
        'grep_search': 'search-outline',
        'list_dir': 'folder-outline',
    };
    return icons[toolName] || 'construct-outline';
};

const formatToolName = (name: string): string => {
    return name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
};

const getFileChangeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
        'terminal_command': 'terminal-outline',
        'editFile': 'pencil-outline',
        'createFile': 'add-circle-outline',
        'readFile': 'document-text-outline',
        'file_edit': 'pencil-outline',
        'file_create': 'add-circle-outline',
        'file_read': 'document-text-outline',
        'file_delete': 'trash-outline',
        'notebook_edit': 'code-slash-outline',
        'edit': 'pencil-outline',
        'create': 'add-circle-outline',
        'delete': 'trash-outline',
    };
    return icons[type] || 'document-outline';
};

// Get short filename from path
const getFileName = (path: string): string => {
    if (!path) return '';
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || path;
};

// Render a collapsible file change with diff
const FileChangeCard = ({ change, index }: { change: FileChange; index: number }) => {
    const [expanded, setExpanded] = useState(false);

    const fileType = typeof change.type === 'string' ? change.type : 'change';
    const filePath = typeof change.filePath === 'string' ? change.filePath : '';
    const fileName = getFileName(filePath);

    // Tool info for when path isn't available
    const toolName = (change as any).toolName as string | undefined;
    const note = (change as any).note as string | undefined;

    // Get diff or content changes
    const hasDiff = change.diffUnified || change.oldString || change.newString || change.oldContent || change.newContent;
    const diffContent = change.diffUnified || '';
    const oldContent = change.oldString || change.oldContent || '';
    const newContent = change.newString || change.newContent || '';

    // Terminal command
    const commandStr = typeof change.command === 'string'
        ? change.command
        : (change.command as any)?.original || '';
    const exitCode = change.exitCode;

    return (
        <View style={styles.fileChangeCard}>
            <TouchableOpacity
                style={styles.fileChangeCardHeader}
                onPress={() => setExpanded(!expanded)}
                activeOpacity={0.7}
            >
                <View style={styles.fileChangeCardLeft}>
                    <Ionicons
                        name={getFileChangeIcon(fileType)}
                        size={16}
                        color={fileType === 'delete' || fileType === 'file_delete' ? '#EF4444'
                            : fileType.includes('create') ? '#10B981'
                                : fileType.includes('edit') ? '#F59E0B'
                                    : '#6B7280'}
                    />
                    <View style={styles.fileChangeCardInfo}>
                        <Text style={styles.fileChangeCardType}>
                            {fileType.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                        {fileName ? (
                            <Text style={styles.fileChangeCardName} numberOfLines={1}>{fileName}</Text>
                        ) : toolName ? (
                            <Text style={styles.fileChangeCardName} numberOfLines={1}>{formatToolName(toolName)}</Text>
                        ) : null}
                    </View>
                </View>
                <View style={styles.fileChangeCardRight}>
                    {exitCode !== undefined && (
                        <View style={[styles.exitCodeBadge, exitCode === 0 ? styles.exitCodeSuccess : styles.exitCodeError]}>
                            <Text style={styles.exitCodeText}>Exit: {exitCode}</Text>
                        </View>
                    )}
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#6B7280"
                    />
                </View>
            </TouchableOpacity>

            {expanded && (
                <View style={styles.fileChangeCardContent}>
                    {filePath ? (
                        <Text style={styles.fileChangeFullPath} numberOfLines={2}>{filePath}</Text>
                    ) : null}

                    {commandStr ? (
                        <View style={styles.diffBlock}>
                            <Text style={styles.diffLabel}>Command</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                <Text style={styles.diffCommand}>$ {commandStr}</Text>
                            </ScrollView>
                        </View>
                    ) : null}

                    {diffContent ? (
                        <View style={styles.diffBlock}>
                            <Text style={styles.diffLabel}>Unified Diff</Text>
                            <ScrollView style={styles.diffScroll} nestedScrollEnabled>
                                <Text style={styles.diffText}>{diffContent}</Text>
                            </ScrollView>
                        </View>
                    ) : null}

                    {!diffContent && oldContent ? (
                        <View style={styles.diffBlock}>
                            <Text style={[styles.diffLabel, styles.diffLabelOld]}>- Removed</Text>
                            <ScrollView style={styles.diffScroll} nestedScrollEnabled>
                                <Text style={[styles.diffText, styles.diffTextOld]}>{oldContent}</Text>
                            </ScrollView>
                        </View>
                    ) : null}

                    {!diffContent && newContent ? (
                        <View style={styles.diffBlock}>
                            <Text style={[styles.diffLabel, styles.diffLabelNew]}>+ Added</Text>
                            <ScrollView style={styles.diffScroll} nestedScrollEnabled>
                                <Text style={[styles.diffText, styles.diffTextNew]}>{newContent}</Text>
                            </ScrollView>
                        </View>
                    ) : null}

                    {!hasDiff && !commandStr && note ? (
                        <Text style={styles.noDiffText}>{note}</Text>
                    ) : !hasDiff && !commandStr ? (
                        <Text style={styles.noDiffText}>No diff data available</Text>
                    ) : null}
                </View>
            )}
        </View>
    );
};

export function SessionDetailScreen({ route }: Props) {
    const { sessionId } = route.params;
    const { colors } = useTheme();
    const [viewMode, setViewMode] = useState<'messages' | 'changes'>('messages');

    const {
        data: session,
        isLoading,
        error,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['session', sessionId],
        queryFn: () => getSession(sessionId),
    });

    // Collect all file changes from all messages for the changes timeline
    const allFileChanges = React.useMemo(() => {
        if (!session?.messages) return [];

        const changes: Array<{
            messageIndex: number;
            timestamp: number | string | null | undefined;
            toolName: string;
            change: FileChange;
            toolCallId?: string;
        }> = [];

        session.messages.forEach((msg, msgIdx) => {
            if (msg.toolInvocations) {
                msg.toolInvocations.forEach(tool => {
                    if (tool.fileChanges && tool.fileChanges.length > 0) {
                        tool.fileChanges.forEach(fc => {
                            changes.push({
                                messageIndex: msgIdx,
                                timestamp: msg.createdAt,
                                toolName: tool.toolName,
                                toolCallId: tool.toolCallId,
                                change: fc,
                            });
                        });
                    }
                });
            }
        });

        return changes;
    }, [session?.messages]);

    const renderToolInvocation = (tool: ToolInvocation, index: number) => {
        const hasFileChanges = tool.fileChanges && tool.fileChanges.length > 0;
        const toolData = tool.toolSpecificData;

        // Extract command for terminal tools
        let command = '';
        if (toolData?.kind === 'terminal' && toolData?.commandLine) {
            command = typeof toolData.commandLine === 'string'
                ? toolData.commandLine
                : toolData.commandLine?.original || '';
        }

        // Safely get invocation message as string - handle all object cases
        let invocationMessage = '';
        if (tool.invocation_message) {
            if (typeof tool.invocation_message === 'string') {
                invocationMessage = tool.invocation_message;
            } else if (typeof tool.invocation_message === 'object') {
                // Extract value from object, or stringify if needed
                const msg = tool.invocationMessage as any;
                invocationMessage = msg.value && typeof msg.value === 'string'
                    ? msg.value
                    : '';
            }
        }

        return (
            <View key={index} style={styles.toolContainer}>
                <View style={styles.toolHeader}>
                    <Ionicons
                        name={getToolIcon(tool.toolName)}
                        size={14}
                        color="#8B5CF6"
                    />
                    <Text style={styles.toolName}>{formatToolName(tool.toolName)}</Text>
                    {tool.isComplete && (
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    )}
                </View>

                {invocationMessage !== '' && (
                    <Text style={styles.toolMessage}>{invocationMessage}</Text>
                )}

                {command && (
                    <View style={styles.commandContainer}>
                        <Text style={styles.commandLabel}>Command:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <Text style={styles.commandText}>{command}</Text>
                        </ScrollView>
                    </View>
                )}

                {hasFileChanges && (
                    <View style={styles.fileChangesSection}>
                        <Text style={styles.fileChangesSectionTitle}>
                            File Changes ({tool.fileChanges!.length})
                        </Text>
                        {tool.fileChanges!.map((fc, fcIdx) => (
                            <FileChangeCard key={fcIdx} change={fc} index={fcIdx} />
                        ))}
                    </View>
                )}
            </View>
        );
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';
        const isSystem = item.role === 'system';
        const hasTools = item.toolInvocations && item.toolInvocations.length > 0;

        return (
            <View
                style={[
                    styles.messageContainer,
                    isUser ? styles.userMessage : styles.assistantMessage,
                    isSystem && styles.systemMessage,
                ]}
            >
                <View style={styles.messageHeader}>
                    <View style={styles.roleContainer}>
                        <Ionicons
                            name={
                                isUser
                                    ? 'person-outline'
                                    : isSystem
                                        ? 'settings-outline'
                                        : 'sparkles-outline'
                            }
                            size={14}
                            color={isUser ? '#007AFF' : isSystem ? '#8E8E93' : '#10A37F'}
                        />
                        <Text
                            style={[
                                styles.roleText,
                                isUser && styles.userRoleText,
                                isSystem && styles.systemRoleText,
                            ]}
                        >
                            {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        {hasTools && (
                            <View style={styles.toolBadge}>
                                <Ionicons name="construct-outline" size={10} color="#8B5CF6" />
                                <Text style={styles.toolBadgeText}>{item.toolInvocations!.length}</Text>
                            </View>
                        )}
                        {(item.model || item.modelId) && (
                            <Text style={styles.modelText}>{item.model || item.modelId}</Text>
                        )}
                    </View>
                </View>

                <Text style={styles.messageContent} selectable={true}>
                    {item.contentRaw || item.content}
                </Text>

                {hasTools && (
                    <View style={styles.toolsSection}>
                        <Text style={styles.toolsSectionTitle}>
                            Tool Invocations ({item.toolInvocations!.length})
                        </Text>
                        {item.toolInvocations!.map((tool, idx) => renderToolInvocation(tool, idx))}
                    </View>
                )}

                <Text style={styles.timestampText}>
                    {formatDate(item.createdAt ?? undefined)}
                </Text>
            </View>
        );
    };

    // Render a change item in the timeline
    const renderChangeItem = ({ item, index }: { item: typeof allFileChanges[0]; index: number }) => {
        const change = item.change;
        const fileType = typeof change.type === 'string' ? change.type.replace(/_/g, ' ') : 'change';
        const filePath = typeof change.filePath === 'string' ? change.filePath : '';
        const fileName = getFileName(filePath);
        const toolName = (change as any).toolName as string | undefined;
        const note = (change as any).note as string | undefined;
        const commandStr = typeof change.command === 'string'
            ? change.command
            : (change.command as any)?.original || '';

        return (
            <View style={styles.timelineItem}>
                <View style={styles.timelineLine}>
                    <View style={[
                        styles.timelineDot,
                        fileType.includes('terminal') ? styles.timelineDotTerminal :
                            fileType.includes('create') ? styles.timelineDotCreate :
                                fileType.includes('delete') ? styles.timelineDotDelete :
                                    styles.timelineDotEdit
                    ]} />
                    {index < allFileChanges.length - 1 && <View style={styles.timelineConnector} />}
                </View>
                <View style={styles.timelineContent}>
                    <View style={styles.timelineItemHeader}>
                        <View style={styles.timelineHeaderLeft}>
                            <Text style={styles.timelineVersion}>v{index + 1}</Text>
                            <Ionicons
                                name={getFileChangeIcon(fileType.replace(/ /g, '_'))}
                                size={14}
                                color={fileType.includes('terminal') ? '#8B5CF6'
                                    : fileType.includes('create') ? '#10B981'
                                        : fileType.includes('delete') ? '#EF4444'
                                            : '#F59E0B'}
                            />
                            <Text style={styles.timelineType}>{fileType.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.timelineTime}>{formatDate(item.timestamp ?? undefined)}</Text>
                    </View>

                    {fileName ? (
                        <Text style={styles.timelineFileName}>{fileName}</Text>
                    ) : toolName ? (
                        <Text style={styles.timelineFileName}>{formatToolName(toolName)}</Text>
                    ) : null}

                    {filePath ? (
                        <Text style={styles.timelinePath} numberOfLines={1}>{filePath}</Text>
                    ) : note ? (
                        <Text style={styles.timelinePath} numberOfLines={2}>{note}</Text>
                    ) : null}

                    {commandStr ? (
                        <View style={styles.timelineCommand}>
                            <Text style={styles.timelineCommandText} numberOfLines={2}>$ {commandStr}</Text>
                        </View>
                    ) : null}

                    {(change.old_string || change.new_string) && (
                        <View style={styles.timelineDiff}>
                            {change.old_string && (
                                <View style={styles.timelineDiffOld}>
                                    <Text style={styles.timelineDiffLabel}>- Removed</Text>
                                    <Text style={styles.timelineDiffText} numberOfLines={3}>
                                        {typeof change.old_string === 'string' ? change.old_string : ''}
                                    </Text>
                                </View>
                            )}
                            {change.new_string && (
                                <View style={styles.timelineDiffNew}>
                                    <Text style={styles.timelineDiffLabel}>+ Added</Text>
                                    <Text style={styles.timelineDiffText} numberOfLines={3}>
                                        {typeof change.new_string === 'string' ? change.new_string : ''}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    <Text style={styles.timelineTool}>
                        via {formatToolName(item.toolName)} • Message #{item.messageIndex + 1}
                    </Text>
                </View>
            </View>
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading conversation...</Text>
            </View>
        );
    }

    if (error || !session) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.text }]}>Failed to load session</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>
                    {session.title || 'Untitled Session'}
                </Text>
                <View style={styles.headerMeta}>
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {session.provider} • {session.messageCount} messages
                    </Text>
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {formatDate(session.createdAt)}
                    </Text>
                </View>
            </View>

            {/* Tab Switcher */}
            <View style={[styles.tabContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.tab, viewMode === 'messages' && { borderBottomColor: colors.primary }]}
                    onPress={() => setViewMode('messages')}
                >
                    <Ionicons
                        name="chatbubbles-outline"
                        size={16}
                        color={viewMode === 'messages' ? colors.primary : colors.textTertiary}
                    />
                    <Text style={[styles.tabText, { color: viewMode === 'messages' ? colors.primary : colors.textTertiary }]}>
                        Messages
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, viewMode === 'changes' && { borderBottomColor: colors.primary }]}
                    onPress={() => setViewMode('changes')}
                >
                    <Ionicons
                        name="git-branch-outline"
                        size={16}
                        color={viewMode === 'changes' ? colors.primary : colors.textTertiary}
                    />
                    <Text style={[styles.tabText, { color: viewMode === 'changes' ? colors.primary : colors.textTertiary }]}>
                        Changes ({allFileChanges.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'messages' ? (
                <FlatList
                    data={session.messages}
                    renderItem={renderMessage}
                    keyExtractor={(item, index) => item.id || `msg-${index}`}
                    contentContainerStyle={styles.messagesList}
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>No messages in this session</Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={allFileChanges}
                    renderItem={renderChangeItem}
                    keyExtractor={(item, index) => `change-${index}-${item.toolCallId || index}`}
                    contentContainerStyle={styles.timelineList}
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="git-branch-outline" size={48} color="#C7C7CC" />
                            <Text style={styles.emptyText}>No file changes in this session</Text>
                            <Text style={styles.emptySubtext}>
                                File edits and terminal commands will appear here
                            </Text>
                        </View>
                    }
                    ListHeaderComponent={
                        allFileChanges.length > 0 ? (
                            <View style={styles.timelineHeader}>
                                <Text style={styles.timelineHeaderTitle}>Session Change History</Text>
                                <Text style={styles.timelineHeaderSubtitle}>
                                    {allFileChanges.length} changes • Oldest to newest
                                </Text>
                            </View>
                        ) : null
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    header: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
        marginBottom: 8,
    },
    headerMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metaText: {
        fontSize: 13,
        color: '#8E8E93',
    },
    messagesList: {
        padding: 16,
    },
    messageContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    userMessage: {
        borderLeftWidth: 3,
        borderLeftColor: '#007AFF',
    },
    assistantMessage: {
        borderLeftWidth: 3,
        borderLeftColor: '#10A37F',
    },
    systemMessage: {
        borderLeftWidth: 3,
        borderLeftColor: '#8E8E93',
        opacity: 0.8,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    roleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    roleText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#10A37F',
        marginLeft: 6,
    },
    userRoleText: {
        color: '#007AFF',
    },
    systemRoleText: {
        color: '#8E8E93',
    },
    modelText: {
        fontSize: 12,
        color: '#8E8E93',
    },
    messageContent: {
        fontSize: 15,
        color: '#000000',
        lineHeight: 22,
    },
    timestampText: {
        fontSize: 11,
        color: '#C7C7CC',
        marginTop: 8,
        textAlign: 'right',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#8E8E93',
    },
    errorText: {
        marginTop: 12,
        fontSize: 17,
        fontWeight: '600',
        color: '#FF3B30',
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 16,
        color: '#8E8E93',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    toolBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3E8FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        gap: 3,
    },
    toolBadgeText: {
        fontSize: 10,
        color: '#8B5CF6',
        fontWeight: '600',
    },
    toolsSection: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E5EA',
    },
    toolsSectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8B5CF6',
        marginBottom: 8,
    },
    toolContainer: {
        backgroundColor: '#FAFAFA',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E5EA',
    },
    toolHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    toolName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        flex: 1,
    },
    toolMessage: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
        fontStyle: 'italic',
    },
    commandContainer: {
        marginTop: 6,
        backgroundColor: '#1F2937',
        borderRadius: 6,
        padding: 8,
    },
    commandLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        marginBottom: 4,
    },
    commandText: {
        fontSize: 11,
        color: '#10B981',
        fontFamily: 'monospace',
    },
    fileChangeContainer: {
        marginTop: 6,
        paddingLeft: 8,
        borderLeftWidth: 2,
        borderLeftColor: '#F59E0B',
    },
    fileChangeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    fileChangeType: {
        fontSize: 10,
        fontWeight: '600',
        color: '#F59E0B',
        textTransform: 'uppercase',
    },
    filePath: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'monospace',
        marginTop: 2,
    },
    fileCommand: {
        fontSize: 10,
        color: '#9CA3AF',
        fontFamily: 'monospace',
        marginTop: 2,
    },
    // File Changes Section
    fileChangesSection: {
        marginTop: 8,
    },
    fileChangesSectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#F59E0B',
        marginBottom: 6,
    },
    // File Change Card
    fileChangeCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#E5E5EA',
        overflow: 'hidden',
    },
    fileChangeCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        backgroundColor: '#F9FAFB',
    },
    fileChangeCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 8,
    },
    fileChangeCardInfo: {
        flex: 1,
    },
    fileChangeCardType: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6B7280',
        letterSpacing: 0.5,
    },
    fileChangeCardName: {
        fontSize: 12,
        fontWeight: '500',
        color: '#111827',
        marginTop: 2,
    },
    fileChangeCardRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    exitCodeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    exitCodeSuccess: {
        backgroundColor: '#D1FAE5',
    },
    exitCodeError: {
        backgroundColor: '#FEE2E2',
    },
    exitCodeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#374151',
    },
    fileChangeCardContent: {
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#E5E5EA',
    },
    fileChangeFullPath: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'monospace',
        marginBottom: 8,
    },
    diffBlock: {
        marginBottom: 8,
    },
    diffLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    diffLabelOld: {
        color: '#DC2626',
    },
    diffLabelNew: {
        color: '#059669',
    },
    diffScroll: {
        maxHeight: 150,
        backgroundColor: '#1F2937',
        borderRadius: 6,
        padding: 8,
    },
    diffText: {
        fontSize: 11,
        color: '#E5E7EB',
        fontFamily: 'monospace',
        lineHeight: 16,
    },
    diffTextOld: {
        color: '#FCA5A5',
        backgroundColor: '#450A0A',
    },
    diffTextNew: {
        color: '#86EFAC',
        backgroundColor: '#052E16',
    },
    diffCommand: {
        fontSize: 11,
        color: '#10B981',
        fontFamily: 'monospace',
        backgroundColor: '#1F2937',
        padding: 8,
        borderRadius: 6,
    },
    noDiffText: {
        fontSize: 11,
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    // Tab Container
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#007AFF',
    },
    tabText: {
        fontSize: 14,
        color: '#8E8E93',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#007AFF',
    },
    // Timeline Styles
    timelineList: {
        padding: 16,
    },
    timelineHeader: {
        marginBottom: 16,
    },
    timelineHeaderTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    timelineHeaderSubtitle: {
        fontSize: 13,
        color: '#6B7280',
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    timelineLine: {
        width: 24,
        alignItems: 'center',
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#F59E0B',
        marginTop: 4,
    },
    timelineDotTerminal: {
        backgroundColor: '#8B5CF6',
    },
    timelineDotCreate: {
        backgroundColor: '#10B981',
    },
    timelineDotEdit: {
        backgroundColor: '#F59E0B',
    },
    timelineDotDelete: {
        backgroundColor: '#EF4444',
    },
    timelineConnector: {
        width: 2,
        flex: 1,
        backgroundColor: '#E5E5EA',
        marginTop: 4,
    },
    timelineContent: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 12,
        marginLeft: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E5EA',
    },
    timelineItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    timelineHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    timelineVersion: {
        fontSize: 11,
        fontWeight: '700',
        color: '#007AFF',
        backgroundColor: '#EBF5FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    timelineType: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6B7280',
        letterSpacing: 0.5,
    },
    timelineTime: {
        fontSize: 10,
        color: '#9CA3AF',
    },
    timelineFileName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 2,
    },
    timelinePath: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'monospace',
        marginBottom: 8,
    },
    timelineCommand: {
        backgroundColor: '#1F2937',
        borderRadius: 6,
        padding: 8,
        marginBottom: 8,
    },
    timelineCommandText: {
        fontSize: 11,
        color: '#10B981',
        fontFamily: 'monospace',
    },
    timelineDiff: {
        marginBottom: 8,
    },
    timelineDiffOld: {
        backgroundColor: '#FEF2F2',
        borderRadius: 4,
        padding: 6,
        marginBottom: 4,
    },
    timelineDiffNew: {
        backgroundColor: '#F0FDF4',
        borderRadius: 4,
        padding: 6,
    },
    timelineDiffLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 2,
    },
    timelineDiffText: {
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#374151',
    },
    timelineTool: {
        fontSize: 10,
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    emptySubtext: {
        fontSize: 13,
        color: '#C7C7CC',
        marginTop: 4,
    },
});
