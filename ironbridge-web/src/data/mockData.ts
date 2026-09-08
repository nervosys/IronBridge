// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// Mock data for demo/screenshot mode when API is unavailable
// This provides realistic-looking data for the UI

import type {
    Workspace,
    Session,
    Provider,
    ProviderHealth,
    Statistics,
    Agent,
    Swarm,
    ProviderAccount,
} from '../api/types';

const now = Date.now();
const hour = 60 * 60 * 1000;
const day = 24 * hour;

export const mockWorkspaces: Workspace[] = [
    {
        id: 'ws-001',
        path: '/Users/dev/projects/ironbridge',
        name: 'ironbridge',
        provider: 'copilot',
        sessionCount: 47,
        createdAt: now - 30 * day,
        updatedAt: now - 2 * hour,
    },
    {
        id: 'ws-002',
        path: '/Users/dev/projects/neural-engine',
        name: 'neural-engine',
        provider: 'copilot',
        sessionCount: 23,
        createdAt: now - 45 * day,
        updatedAt: now - 5 * hour,
    },
    {
        id: 'ws-003',
        path: '/Users/dev/projects/secure-comms',
        name: 'secure-comms',
        provider: 'cursor',
        sessionCount: 31,
        createdAt: now - 60 * day,
        updatedAt: now - day,
    },
    {
        id: 'ws-004',
        path: '/Users/dev/projects/data-pipeline',
        name: 'data-pipeline',
        provider: 'copilot',
        sessionCount: 15,
        createdAt: now - 90 * day,
        updatedAt: now - 3 * day,
    },
    {
        id: 'ws-005',
        path: '/Users/dev/projects/ml-ops',
        name: 'ml-ops',
        provider: 'cursor',
        sessionCount: 28,
        createdAt: now - 20 * day,
        updatedAt: now - 6 * hour,
    },
];

export const mockSessions: Session[] = [
    {
        id: 'sess-001',
        workspaceId: 'ws-001',
        title: 'Implementing E2E Encryption Module',
        provider: 'copilot',
        model: 'gpt-4o',
        messageCount: 47,
        createdAt: now - 2 * day,
        updatedAt: now - 2 * hour,
    },
    {
        id: 'sess-002',
        workspaceId: 'ws-001',
        title: 'Refactoring Auth Service',
        provider: 'copilot',
        model: 'gpt-4o',
        messageCount: 23,
        createdAt: now - 5 * day,
        updatedAt: now - 5 * hour,
    },
    {
        id: 'sess-003',
        workspaceId: 'ws-002',
        title: 'Neural Network Architecture Design',
        provider: 'cursor',
        model: 'claude-3.5-sonnet',
        messageCount: 89,
        createdAt: now - 3 * day,
        updatedAt: now - day,
    },
    {
        id: 'sess-004',
        workspaceId: 'ws-001',
        title: 'Performance Optimization for Harvest',
        provider: 'copilot',
        model: 'gpt-4o',
        messageCount: 34,
        createdAt: now - day,
        updatedAt: now - 4 * hour,
    },
    {
        id: 'sess-005',
        workspaceId: 'ws-003',
        title: 'Code Review: Crypto Module',
        provider: 'ollama',
        model: 'llama3.1:70b',
        messageCount: 12,
        createdAt: now - 7 * day,
        updatedAt: now - 6 * day,
    },
    {
        id: 'sess-006',
        workspaceId: 'ws-005',
        title: 'MLOps Pipeline Debugging',
        provider: 'cursor',
        model: 'claude-3.5-sonnet',
        messageCount: 56,
        createdAt: now - 2 * day,
        updatedAt: now - 8 * hour,
    },
    {
        id: 'sess-007',
        workspaceId: 'ws-004',
        title: 'Data Pipeline ETL Design',
        provider: 'copilot',
        model: 'gpt-4o',
        messageCount: 28,
        createdAt: now - 10 * day,
        updatedAt: now - 4 * day,
    },
    {
        id: 'sess-008',
        workspaceId: 'ws-001',
        title: 'API Server Implementation',
        provider: 'copilot',
        model: 'gpt-4o',
        messageCount: 67,
        createdAt: now - 4 * day,
        updatedAt: now - 3 * hour,
    },
];

export const mockProviders: Provider[] = [
    {
        id: 'openai',
        name: 'OpenAI',
        type: 'cloud',
        icon: '🤖',
        color: '#10a37f',
        endpoint: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
        status: 'connected',
        enabled: true,
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'cloud',
        icon: '🧠',
        color: '#d97706',
        endpoint: 'https://api.anthropic.com/v1',
        models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        status: 'connected',
        enabled: true,
    },
    {
        id: 'azure',
        name: 'Azure AI Foundry',
        type: 'cloud',
        icon: '☁️',
        color: '#0078d4',
        endpoint: 'https://models.inference.ai.azure.com',
        models: ['gpt-4o', 'gpt-4o-mini', 'Phi-4'],
        status: 'disconnected',
        enabled: true,
    },
    {
        id: 'ollama',
        name: 'Ollama',
        type: 'local',
        icon: '🦙',
        color: '#ffffff',
        endpoint: 'http://localhost:11434',
        models: ['llama3.3:70b', 'qwen2.5-coder:14b', 'deepseek-r1:14b'],
        status: 'connected',
        enabled: true,
    },
    {
        id: 'lmstudio',
        name: 'LM Studio',
        type: 'local',
        icon: '🎬',
        color: '#6366f1',
        endpoint: 'http://localhost:1234/v1',
        models: ['lmstudio-community/qwen2.5-coder-14b'],
        status: 'connected',
        enabled: true,
    },
];

export const mockProviderHealth: ProviderHealth[] = [
    { providerId: 'openai', status: 'connected', latency: 120, lastChecked: now - 30000, models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'] },
    { providerId: 'anthropic', status: 'connected', latency: 85, lastChecked: now - 30000, models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] },
    { providerId: 'azure', status: 'disconnected', latency: 0, lastChecked: now - 30000, error: 'Connection refused', models: [] },
    { providerId: 'ollama', status: 'connected', latency: 15, lastChecked: now - 30000, models: ['llama3.3:70b', 'qwen2.5-coder:14b', 'deepseek-r1:14b'] },
    { providerId: 'lmstudio', status: 'connected', latency: 25, lastChecked: now - 30000, models: ['lmstudio-community/qwen2.5-coder-14b'] },
];

export const mockStatistics: Statistics = {
    totalWorkspaces: 12,
    totalSessions: 218,
    totalMessages: 8437,
    totalProviders: 5,
    messagesThisWeek: 892,
    sessionsByProvider: [
        { provider: 'copilot', count: 127, color: '#0d9488' },
        { provider: 'cursor', count: 45, color: '#8b5cf6' },
        { provider: 'ollama', count: 23, color: '#ffffff' },
        { provider: 'foundry', count: 8, color: '#0078d4' },
        { provider: 'lm-studio', count: 15, color: '#6366f1' },
    ],
};

export const mockAgents: Agent[] = [
    {
        id: 'agent-001',
        name: 'CodeReviewer',
        role: 'reviewer',
        model: 'gpt-4o',
        status: 'idle',
        description: 'Reviews code for bugs, security issues, and best practices',
        systemPrompt: 'You are an expert code reviewer...',
        tools: ['read_file', 'grep_search', 'list_dir'],
        createdAt: now - 30 * day,
        updatedAt: now - day,
    },
    {
        id: 'agent-002',
        name: 'Researcher',
        role: 'researcher',
        model: 'claude-3.5-sonnet',
        status: 'executing',
        description: 'Researches topics and gathers information from multiple sources',
        systemPrompt: 'You are a thorough researcher...',
        tools: ['web_search', 'fetch_webpage', 'semantic_search'],
        createdAt: now - 20 * day,
        updatedAt: now - 2 * hour,
    },
    {
        id: 'agent-003',
        name: 'TestWriter',
        role: 'tester',
        model: 'gpt-4o',
        status: 'idle',
        description: 'Writes comprehensive unit and integration tests',
        systemPrompt: 'You are an expert test engineer...',
        tools: ['read_file', 'create_file', 'run_in_terminal'],
        createdAt: now - 15 * day,
        updatedAt: now - 3 * day,
    },
    {
        id: 'agent-004',
        name: 'DocWriter',
        role: 'writer',
        model: 'claude-3.5-sonnet',
        status: 'idle',
        description: 'Writes documentation, READMEs, and API docs',
        systemPrompt: 'You are a technical writer...',
        tools: ['read_file', 'create_file', 'semantic_search'],
        createdAt: now - 10 * day,
        updatedAt: now - 5 * day,
    },
];

export const mockSwarms: Swarm[] = [
    {
        id: 'swarm-001',
        name: 'CodeQuality',
        description: 'Reviews, tests, and documents code changes',
        agents: [
            { agentId: 'agent-001', role: 'reviewer', position: { x: 100, y: 100 } },
            { agentId: 'agent-003', role: 'tester', position: { x: 300, y: 100 } },
            { agentId: 'agent-004', role: 'writer', position: { x: 500, y: 100 } },
        ],
        workflow: {
            nodes: [
                { id: 'n1', type: 'agent', agentId: 'agent-001', position: { x: 100, y: 100 } },
                { id: 'n2', type: 'agent', agentId: 'agent-003', position: { x: 300, y: 100 } },
                { id: 'n3', type: 'agent', agentId: 'agent-004', position: { x: 500, y: 100 } },
            ],
            edges: [
                { id: 'e1', source: 'n1', target: 'n2' },
                { id: 'e2', source: 'n2', target: 'n3' },
            ],
        },
        status: 'idle',
        createdAt: now - 10 * day,
        updatedAt: now - 2 * day,
    },
    {
        id: 'swarm-002',
        name: 'Research Team',
        description: 'Collaborative research and analysis',
        agents: [
            { agentId: 'agent-002', role: 'researcher', position: { x: 100, y: 100 } },
            { agentId: 'agent-004', role: 'writer', position: { x: 300, y: 100 } },
        ],
        workflow: {
            nodes: [
                { id: 'n1', type: 'agent', agentId: 'agent-002', position: { x: 100, y: 100 } },
                { id: 'n2', type: 'agent', agentId: 'agent-004', position: { x: 300, y: 100 } },
            ],
            edges: [
                { id: 'e1', source: 'n1', target: 'n2' },
            ],
        },
        status: 'running',
        createdAt: now - 5 * day,
        updatedAt: now - hour,
    },
];

export const mockAccounts: ProviderAccount[] = [
    {
        id: 'acc-001',
        provider: 'openai',
        name: 'OpenAI API',
        email: 'dev@example.com',
        avatarUrl: null,
        scopes: ['chat', 'completions'],
        createdAt: now - 90 * day,
        updatedAt: now - day,
    },
    {
        id: 'acc-002',
        provider: 'anthropic',
        name: 'Anthropic API',
        email: 'dev@example.com',
        avatarUrl: null,
        scopes: ['messages'],
        createdAt: now - 60 * day,
        updatedAt: now - 2 * day,
    },
    {
        id: 'acc-003',
        provider: 'azure',
        name: 'Azure AI Foundry',
        email: 'enterprise@company.com',
        avatarUrl: null,
        scopes: ['inference'],
        createdAt: now - 30 * day,
        updatedAt: now - 5 * day,
    },
];

export const mockSystemStatus = {
    status: 'healthy',
    version: '1.0.1',
    uptime: 86400000,
};
