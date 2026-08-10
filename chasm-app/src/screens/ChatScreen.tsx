// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatContext } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import {
    ChatMessage,
    ChatProvider,
    sendChatCompletion,
    sendChatCompletionWithTools,
    callCsmTool,
    generateId,
} from '../api/chat';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

interface Props {
    navigation: ChatScreenNavigationProp;
}

export function ChatScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const {
        getActiveSession,
        getEnabledProviders,
        getDefaultProvider,
        createSession,
        addMessage,
        updateMessage,
        sessions,
        activeSessionId,
        setActiveSession,
    } = useChatContext();

    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [csmToolsEnabled, setCsmToolsEnabled] = useState(true);
    const scrollViewRef = useRef<ScrollView>(null);

    const activeSession = getActiveSession();
    const enabledProviders = getEnabledProviders();

    // Set up header with custom buttons
    useLayoutEffect(() => {
        navigation.setOptions({
            title: activeSession?.title || 'Chat',
            headerLeft: () => (
                <TouchableOpacity
                    style={{ paddingHorizontal: 8 }}
                    onPress={() => navigation.navigate('ChatHistory' as any)}
                >
                    <Ionicons name="time-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
            ),
            headerRight: () => (
                <TouchableOpacity
                    style={{ paddingHorizontal: 8 }}
                    onPress={handleNewChat}
                >
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
            ),
        });
    }, [navigation, activeSession?.title, colors.primary]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [activeSession?.messages]);

    const handleNewChat = async () => {
        const defaultProvider = getDefaultProvider();
        if (!defaultProvider) {
            Alert.alert(
                'No Provider Configured',
                'Please configure at least one AI provider in the Providers screen.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Configure', onPress: () => navigation.navigate('ChatProviders' as any) },
                ]
            );
            return;
        }
        await createSession(defaultProvider);
    };

    const handleSelectProvider = () => {
        if (enabledProviders.length === 0) {
            Alert.alert(
                'No Providers Enabled',
                'Please enable at least one AI provider.',
                [
                    { text: 'OK', onPress: () => navigation.navigate('ChatProviders' as any) },
                ]
            );
            return;
        }

        const options = enabledProviders.map(p => ({
            text: p.name,
            onPress: () => createSession(p),
        }));

        Alert.alert('Select Provider', 'Choose an AI provider for this chat', [
            ...options,
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleSend = async () => {
        if (!inputText.trim() || isLoading) return;

        let session = activeSession;

        // Create a new session if none exists
        if (!session) {
            const defaultProvider = getDefaultProvider();
            if (!defaultProvider) {
                handleSelectProvider();
                return;
            }
            session = await createSession(defaultProvider);
        }

        const userMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: inputText.trim(),
            timestamp: Date.now(),
        };

        addMessage(session.id, userMessage);
        setInputText('');
        setIsLoading(true);

        // Add placeholder assistant message
        const assistantMessageId = generateId();
        const assistantMessage: ChatMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
        };
        addMessage(session.id, assistantMessage);

        try {
            // Get updated session with new message
            const updatedSession = sessions.find(s => s.id === session!.id);
            const messagesForApi = updatedSession?.messages.filter(m => !m.isStreaming) || [userMessage];

            // Use tools-enabled completion if CSM tools are on and provider supports it
            const supportsTools = ['openai', 'anthropic'].includes(session.provider.type);

            if (csmToolsEnabled && supportsTools) {
                // First request - may return tool calls
                let response = await sendChatCompletionWithTools({
                    provider: session.provider,
                    messages: messagesForApi,
                    enableCsmTools: true,
                });

                // Handle tool calls if present
                if (response.toolCalls && response.toolCalls.length > 0) {
                    // Show that we're processing tools
                    updateMessage(session.id, assistantMessageId, {
                        content: '🔧 Querying chat history...',
                        isStreaming: true,
                    });

                    // Execute each tool call
                    const toolResults: string[] = [];
                    for (const toolCall of response.toolCalls) {
                        try {
                            const args = JSON.parse(toolCall.arguments);
                            const result = await callCsmTool(toolCall.name, args);
                            const resultText = result.result.content
                                .map((c: any) => c.text)
                                .join('\n');
                            toolResults.push(`Tool ${toolCall.name}:\n${resultText}`);
                        } catch (e) {
                            toolResults.push(`Tool ${toolCall.name} failed: ${e}`);
                        }
                    }

                    // Send tool results back to the model for final response
                    const toolResultMessage = toolResults.join('\n\n');
                    const followUpMessages = [
                        ...messagesForApi,
                        { role: 'assistant' as const, content: response.content || 'Let me check that.' },
                        { role: 'user' as const, content: `Tool results:\n${toolResultMessage}\n\nPlease summarize this information for me.` },
                    ];

                    const finalResponse = await sendChatCompletion({
                        provider: session.provider,
                        messages: followUpMessages,
                    });

                    updateMessage(session.id, assistantMessageId, {
                        content: finalResponse.content,
                        model: finalResponse.model,
                        tokens: finalResponse.tokens?.completion,
                        isStreaming: false,
                    });
                } else {
                    // No tool calls, just use the response
                    updateMessage(session.id, assistantMessageId, {
                        content: response.content,
                        model: response.model,
                        tokens: response.tokens?.completion,
                        isStreaming: false,
                    });
                }
            } else {
                // Regular completion without tools
                const response = await sendChatCompletion({
                    provider: session.provider,
                    messages: messagesForApi,
                });

                updateMessage(session.id, assistantMessageId, {
                    content: response.content,
                    model: response.model,
                    tokens: response.tokens?.completion,
                    isStreaming: false,
                });
            }
        } catch (error: any) {
            console.error('Chat error:', error);
            updateMessage(session.id, assistantMessageId, {
                content: '',
                error: error.message || 'Failed to get response',
                isStreaming: false,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const renderMessage = (message: ChatMessage, index: number) => {
        const isUser = message.role === 'user';
        const isError = !!message.error;

        return (
            <View
                key={message.id || index}
                style={[
                    styles.messageBubble,
                    isUser
                        ? [styles.userBubble, { backgroundColor: colors.primary }]
                        : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }],
                    isError && [styles.errorBubble, { backgroundColor: isDark ? '#3C1A1A' : '#FFF5F5', borderColor: colors.error }],
                ]}
            >
                {!isUser && (
                    <View style={styles.assistantHeader}>
                        <Ionicons name="sparkles" size={14} color={colors.textTertiary} />
                        <Text style={[styles.modelText, { color: colors.textTertiary }]}>
                            {message.model || activeSession?.provider.name || 'Assistant'}
                        </Text>
                    </View>
                )}
                {message.isStreaming ? (
                    <View style={styles.streamingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.streamingText, { color: colors.textSecondary }]}>Thinking...</Text>
                    </View>
                ) : isError ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color={colors.error} />
                        <Text style={[styles.errorText, { color: colors.error }]}>{message.error}</Text>
                    </View>
                ) : (
                    <Text style={[styles.messageText, { color: isUser ? '#FFFFFF' : colors.text }]}>
                        {message.content}
                    </Text>
                )}
                {message.tokens && (
                    <Text style={[styles.tokenText, { color: colors.textTertiary }]}>{message.tokens} tokens</Text>
                )}
            </View>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.iconSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Start a Conversation</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                {enabledProviders.length === 0
                    ? 'Configure an AI provider to start chatting'
                    : 'Type a message below to begin'}
            </Text>
            {enabledProviders.length === 0 && (
                <TouchableOpacity
                    style={[styles.configureButton, { backgroundColor: colors.primary }]}
                    onPress={() => navigation.navigate('ChatProviders' as any)}
                >
                    <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.configureButtonText}>Configure Providers</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {/* Provider subtitle under header with CSM tools toggle */}
            <View style={[styles.providerBar, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
                <View style={styles.providerBarLeft}>
                    <Ionicons name="flash" size={14} color={colors.textTertiary} />
                    <Text style={[styles.providerBarText, { color: colors.textTertiary }]}>
                        {activeSession?.provider.name || 'No provider'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[
                        styles.csmToolsToggle,
                        { backgroundColor: isDark ? '#38383A' : '#F2F2F7' },
                        csmToolsEnabled && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setCsmToolsEnabled(!csmToolsEnabled)}
                >
                    <Ionicons
                        name="library"
                        size={14}
                        color={csmToolsEnabled ? '#FFFFFF' : colors.textTertiary}
                    />
                    <Text
                        style={[
                            styles.csmToolsToggleText,
                            { color: colors.textTertiary },
                            csmToolsEnabled && styles.csmToolsToggleTextActive,
                        ]}
                    >
                        CSM
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
            >
                {!activeSession || activeSession.messages.length === 0
                    ? renderEmptyState()
                    : activeSession.messages.map(renderMessage)}
            </ScrollView>

            {/* Input */}
            <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.divider }]}>
                <TouchableOpacity
                    style={styles.providerButton}
                    onPress={handleSelectProvider}
                >
                    <Ionicons
                        name="flash-outline"
                        size={20}
                        color={enabledProviders.length > 0 ? colors.primary : colors.iconSecondary}
                    />
                </TouchableOpacity>
                <TextInput
                    style={[styles.input, { backgroundColor: colors.searchBackground, color: colors.text }]}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.placeholder}
                    multiline
                    maxLength={10000}
                    editable={!isLoading}
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        { backgroundColor: colors.primary },
                        (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Ionicons name="send" size={20} color="#FFFFFF" />
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    providerBar: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    providerBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    providerBarText: {
        fontSize: 12,
    },
    csmToolsToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    csmToolsToggleActive: {
        // backgroundColor set dynamically
    },
    csmToolsToggleText: {
        fontSize: 11,
        fontWeight: '600',
    },
    csmToolsToggleTextActive: {
        color: '#FFFFFF',
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        flexGrow: 1,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginTop: 8,
    },
    configureButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
        marginTop: 24,
    },
    configureButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 8,
    },
    messageBubble: {
        maxWidth: '85%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        marginBottom: 8,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#007AFF',
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E5EA',
    },
    errorBubble: {
        backgroundColor: '#FFF5F5',
        borderColor: '#FF3B30',
    },
    assistantHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    modelText: {
        fontSize: 11,
        marginLeft: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    userMessageText: {
        color: '#FFFFFF',
    },
    streamingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    streamingText: {
        fontSize: 14,
        marginLeft: 8,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 14,
        color: '#FF3B30',
        marginLeft: 6,
        flex: 1,
    },
    tokenText: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
    },
    providerButton: {
        padding: 8,
        marginRight: 4,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    sendButtonDisabled: {
        backgroundColor: '#C7C7CC',
    },
});
