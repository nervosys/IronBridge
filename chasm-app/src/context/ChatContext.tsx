// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    ChatProvider,
    ChatSession,
    ChatMessage,
    DEFAULT_PROVIDERS,
    generateId,
    createChatSession,
} from '../api/chat';

// Storage keys
const STORAGE_KEYS = {
    PROVIDERS: 'csm_chat_providers',
    SESSIONS: 'csm_chat_sessions',
    ACTIVE_SESSION: 'csm_active_session',
};

// State types
interface ChatState {
    providers: ChatProvider[];
    sessions: ChatSession[];
    activeSessionId: string | null;
    isLoading: boolean;
}

type ChatAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_PROVIDERS'; payload: ChatProvider[] }
    | { type: 'ADD_PROVIDER'; payload: ChatProvider }
    | { type: 'UPDATE_PROVIDER'; payload: ChatProvider }
    | { type: 'REMOVE_PROVIDER'; payload: string }
    | { type: 'SET_SESSIONS'; payload: ChatSession[] }
    | { type: 'ADD_SESSION'; payload: ChatSession }
    | { type: 'UPDATE_SESSION'; payload: ChatSession }
    | { type: 'REMOVE_SESSION'; payload: string }
    | { type: 'SET_ACTIVE_SESSION'; payload: string | null }
    | { type: 'ADD_MESSAGE'; payload: { sessionId: string; message: ChatMessage } }
    | { type: 'UPDATE_MESSAGE'; payload: { sessionId: string; messageId: string; updates: Partial<ChatMessage> } };

// Reducer
function chatReducer(state: ChatState, action: ChatAction): ChatState {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };

        case 'SET_PROVIDERS':
            return { ...state, providers: action.payload };

        case 'ADD_PROVIDER':
            return { ...state, providers: [...state.providers, action.payload] };

        case 'UPDATE_PROVIDER':
            return {
                ...state,
                providers: state.providers.map(p =>
                    p.id === action.payload.id ? action.payload : p
                ),
            };

        case 'REMOVE_PROVIDER':
            return {
                ...state,
                providers: state.providers.filter(p => p.id !== action.payload),
            };

        case 'SET_SESSIONS':
            return { ...state, sessions: action.payload };

        case 'ADD_SESSION':
            return { ...state, sessions: [action.payload, ...state.sessions] };

        case 'UPDATE_SESSION':
            return {
                ...state,
                sessions: state.sessions.map(s =>
                    s.id === action.payload.id ? action.payload : s
                ),
            };

        case 'REMOVE_SESSION':
            return {
                ...state,
                sessions: state.sessions.filter(s => s.id !== action.payload),
                activeSessionId: state.activeSessionId === action.payload ? null : state.activeSessionId,
            };

        case 'SET_ACTIVE_SESSION':
            return { ...state, activeSessionId: action.payload };

        case 'ADD_MESSAGE': {
            const session = state.sessions.find(s => s.id === action.payload.sessionId);
            if (!session) return state;

            const updatedSession: ChatSession = {
                ...session,
                messages: [...session.messages, action.payload.message],
                updatedAt: Date.now(),
            };

            return {
                ...state,
                sessions: state.sessions.map(s =>
                    s.id === action.payload.sessionId ? updatedSession : s
                ),
            };
        }

        case 'UPDATE_MESSAGE': {
            const session = state.sessions.find(s => s.id === action.payload.sessionId);
            if (!session) return state;

            const updatedSession: ChatSession = {
                ...session,
                messages: session.messages.map(m =>
                    m.id === action.payload.messageId
                        ? { ...m, ...action.payload.updates }
                        : m
                ),
                updatedAt: Date.now(),
            };

            return {
                ...state,
                sessions: state.sessions.map(s =>
                    s.id === action.payload.sessionId ? updatedSession : s
                ),
            };
        }

        default:
            return state;
    }
}

// Initial state
const initialState: ChatState = {
    providers: [],
    sessions: [],
    activeSessionId: null,
    isLoading: true,
};

// Context
interface ChatContextValue extends ChatState {
    // Provider actions
    addProvider: (provider: ChatProvider) => Promise<void>;
    updateProvider: (provider: ChatProvider) => Promise<void>;
    removeProvider: (id: string) => Promise<void>;
    getEnabledProviders: () => ChatProvider[];
    getDefaultProvider: () => ChatProvider | undefined;

    // Session actions
    createSession: (provider: ChatProvider, title?: string) => Promise<ChatSession>;
    updateSession: (session: ChatSession) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    setActiveSession: (id: string | null) => void;
    getActiveSession: () => ChatSession | undefined;

    // Message actions
    addMessage: (sessionId: string, message: ChatMessage) => void;
    updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// Provider component
export function ChatContextProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(chatReducer, initialState);

    // Load data from storage on mount
    useEffect(() => {
        loadData();
    }, []);

    // Save providers when they change
    useEffect(() => {
        if (!state.isLoading) {
            AsyncStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(state.providers));
        }
    }, [state.providers, state.isLoading]);

    // Save sessions when they change
    useEffect(() => {
        if (!state.isLoading) {
            AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(state.sessions));
        }
    }, [state.sessions, state.isLoading]);

    // Save active session when it changes
    useEffect(() => {
        if (!state.isLoading) {
            if (state.activeSessionId) {
                AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, state.activeSessionId);
            } else {
                AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
            }
        }
    }, [state.activeSessionId, state.isLoading]);

    const loadData = async () => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });

            // Load providers
            const providersJson = await AsyncStorage.getItem(STORAGE_KEYS.PROVIDERS);
            let providers: ChatProvider[] = [];

            if (providersJson) {
                providers = JSON.parse(providersJson);
            } else {
                // Initialize with default providers (without API keys)
                providers = DEFAULT_PROVIDERS.map(p => ({
                    ...p,
                    apiKey: '',
                }));
            }
            dispatch({ type: 'SET_PROVIDERS', payload: providers });

            // Load sessions
            const sessionsJson = await AsyncStorage.getItem(STORAGE_KEYS.SESSIONS);
            if (sessionsJson) {
                const sessions = JSON.parse(sessionsJson);
                dispatch({ type: 'SET_SESSIONS', payload: sessions });
            }

            // Load active session
            const activeSessionId = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
            if (activeSessionId) {
                dispatch({ type: 'SET_ACTIVE_SESSION', payload: activeSessionId });
            }
        } catch (error) {
            console.error('Error loading chat data:', error);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    // Provider actions
    const addProvider = async (provider: ChatProvider) => {
        dispatch({ type: 'ADD_PROVIDER', payload: provider });
    };

    const updateProvider = async (provider: ChatProvider) => {
        dispatch({ type: 'UPDATE_PROVIDER', payload: provider });
    };

    const removeProvider = async (id: string) => {
        dispatch({ type: 'REMOVE_PROVIDER', payload: id });
    };

    const getEnabledProviders = () => {
        return state.providers.filter(p => p.isEnabled);
    };

    const getDefaultProvider = () => {
        return state.providers.find(p => p.isDefault && p.isEnabled) ||
            state.providers.find(p => p.isEnabled);
    };

    // Session actions
    const createSession = async (provider: ChatProvider, title?: string) => {
        const session = createChatSession(provider, title);
        dispatch({ type: 'ADD_SESSION', payload: session });
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: session.id });
        return session;
    };

    const updateSession = async (session: ChatSession) => {
        dispatch({ type: 'UPDATE_SESSION', payload: session });
    };

    const deleteSession = async (id: string) => {
        dispatch({ type: 'REMOVE_SESSION', payload: id });
    };

    const setActiveSession = (id: string | null) => {
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: id });
    };

    const getActiveSession = () => {
        return state.sessions.find(s => s.id === state.activeSessionId);
    };

    // Message actions
    const addMessage = (sessionId: string, message: ChatMessage) => {
        dispatch({ type: 'ADD_MESSAGE', payload: { sessionId, message } });
    };

    const updateMessage = (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => {
        dispatch({ type: 'UPDATE_MESSAGE', payload: { sessionId, messageId, updates } });
    };

    const value: ChatContextValue = {
        ...state,
        addProvider,
        updateProvider,
        removeProvider,
        getEnabledProviders,
        getDefaultProvider,
        createSession,
        updateSession,
        deleteSession,
        setActiveSession,
        getActiveSession,
        addMessage,
        updateMessage,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// Hook to use chat context
export function useChatContext() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChatContext must be used within a ChatContextProvider');
    }
    return context;
}
