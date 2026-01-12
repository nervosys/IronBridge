// Agent Types for tracking agentic AI communication and task completion
// Re-exports shared constants from @csm/shared when available

import { OAuthProviderType } from './oauth';
import { ChatProviderType } from './chat';
import { AGENT_ROLES, SWARM_TEMPLATES as SHARED_SWARM_TEMPLATES } from '@csm/shared';

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'failed' | 'paused';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type AgentRole = 'coordinator' | 'researcher' | 'coder' | 'reviewer' | 'executor' | 'writer' | 'tester' | 'custom';

// Authentication configuration for agents
export interface AgentAuthConfig {
    method: 'api-key' | 'oauth';
    apiKey?: string;
    oauthProvider?: OAuthProviderType;
    oauthConnected?: boolean;
}

export interface AgentMessage {
    id: string;
    agentId: string;
    targetAgentId?: string; // For inter-agent communication
    type: 'thought' | 'action' | 'observation' | 'result' | 'error' | 'handoff';
    content: string;
    metadata?: Record<string, any>;
    timestamp: number;
}

export interface AgentTask {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    assignedAgentId?: string;
    parentTaskId?: string;
    subtasks?: AgentTask[];
    result?: string;
    error?: string;
    startedAt?: number;
    completedAt?: number;
    createdAt: number;
    updatedAt: number;
}

export interface Agent {
    id: string;
    name: string;
    role: AgentRole;
    description: string;
    model?: string;
    providerId?: string;
    providerType?: ChatProviderType;
    systemPrompt?: string;
    status: AgentStatus;
    capabilities: string[];
    currentTaskId?: string;
    messageCount: number;
    // Authentication
    auth?: AgentAuthConfig;
    createdAt: number;
    updatedAt: number;
}

export interface AgentSwarm {
    id: string;
    name: string;
    description: string;
    agents: Agent[];
    tasks: AgentTask[];
    messages: AgentMessage[];
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    coordinatorAgentId?: string;
    goalDescription?: string;
    result?: string;
    startedAt?: number;
    completedAt?: number;
    createdAt: number;
    updatedAt: number;
}

export interface AgentRun {
    id: string;
    swarmId?: string;
    agentId?: string;
    name: string;
    description: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    tasks: AgentTask[];
    messages: AgentMessage[];
    tokensUsed: number;
    cost?: number;
    startedAt: number;
    completedAt?: number;
    createdAt: number;
}

// Generate unique ID
export function generateAgentId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSwarmId(): string {
    return `swarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateRunId(): string {
    return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create default agents for common roles
export function createAgent(
    name: string,
    role: AgentRole,
    description: string,
    providerId?: string
): Agent {
    return {
        id: generateAgentId(),
        name,
        role,
        description,
        providerId,
        status: 'idle',
        capabilities: getDefaultCapabilities(role),
        messageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export function createTask(title: string, description: string): AgentTask {
    return {
        id: generateTaskId(),
        title,
        description,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export function createSwarm(name: string, description: string, goalDescription?: string): AgentSwarm {
    return {
        id: generateSwarmId(),
        name,
        description,
        agents: [],
        tasks: [],
        messages: [],
        status: 'idle',
        goalDescription,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export function createAgentRun(name: string, description: string): AgentRun {
    return {
        id: generateRunId(),
        name,
        description,
        status: 'running',
        tasks: [],
        messages: [],
        tokensUsed: 0,
        startedAt: Date.now(),
        createdAt: Date.now(),
    };
}

function getDefaultCapabilities(role: AgentRole): string[] {
    // Use shared AGENT_ROLES capabilities when available
    const roleInfo = AGENT_ROLES[role as keyof typeof AGENT_ROLES];
    if (roleInfo && roleInfo.capabilities.length > 0) {
        return [...roleInfo.capabilities];
    }
    // Fallback for app-specific roles
    switch (role) {
        case 'coordinator':
            return ['task_planning', 'delegation', 'monitoring', 'synthesis'];
        case 'researcher':
            return ['web_search', 'document_analysis', 'summarization', 'fact_checking'];
        case 'coder':
            return ['code_generation', 'code_review', 'debugging', 'refactoring'];
        case 'reviewer':
            return ['code_review', 'quality_assurance', 'feedback', 'validation'];
        case 'executor':
            return ['tool_use', 'api_calls', 'file_operations', 'command_execution'];
        case 'writer':
            return ['documentation', 'content_creation', 'editing', 'summarization'];
        case 'tester':
            return ['test_generation', 'test_execution', 'bug_finding', 'coverage_analysis'];
        case 'custom':
        default:
            return [];
    }
}

// Agent Templates
export const AGENT_TEMPLATES: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'messageCount'>[] = [
    {
        name: 'Coordinator',
        role: 'coordinator',
        description: 'Orchestrates tasks and manages other agents',
        status: 'idle',
        capabilities: ['task_planning', 'delegation', 'monitoring', 'synthesis'],
        systemPrompt: 'You are a coordinator agent responsible for breaking down complex tasks and delegating them to specialized agents.',
    },
    {
        name: 'Researcher',
        role: 'researcher',
        description: 'Gathers and analyzes information',
        status: 'idle',
        capabilities: ['web_search', 'document_analysis', 'summarization', 'fact_checking'],
        systemPrompt: 'You are a research agent skilled at finding, analyzing, and synthesizing information from various sources.',
    },
    {
        name: 'Code Assistant',
        role: 'coder',
        description: 'Writes and reviews code',
        status: 'idle',
        capabilities: ['code_generation', 'code_review', 'debugging', 'refactoring'],
        systemPrompt: 'You are a coding agent that excels at writing clean, efficient code and solving programming challenges.',
    },
    {
        name: 'Quality Reviewer',
        role: 'reviewer',
        description: 'Reviews and validates outputs',
        status: 'idle',
        capabilities: ['code_review', 'quality_assurance', 'feedback', 'validation'],
        systemPrompt: 'You are a review agent focused on ensuring quality, catching errors, and providing constructive feedback.',
    },
    {
        name: 'Executor',
        role: 'executor',
        description: AGENT_ROLES.executor.description,
        status: 'idle',
        capabilities: [...AGENT_ROLES.executor.capabilities],
        systemPrompt: 'You are an executor agent that runs tools, makes API calls, and performs actions in the environment.',
    },
    {
        name: 'Writer',
        role: 'writer',
        description: AGENT_ROLES.writer.description,
        status: 'idle',
        capabilities: [...AGENT_ROLES.writer.capabilities],
        systemPrompt: 'You are a writer agent skilled at creating documentation, content, and written materials.',
    },
    {
        name: 'Tester',
        role: 'tester',
        description: AGENT_ROLES.tester.description,
        status: 'idle',
        capabilities: [...AGENT_ROLES.tester.capabilities],
        systemPrompt: 'You are a tester agent focused on creating and executing tests to ensure quality.',
    },
];

// Swarm Templates - extended from shared templates
export const SWARM_TEMPLATES: { name: string; description: string; roles: AgentRole[] }[] = [
    // Include shared templates (spread readonly arrays to mutable)
    ...SHARED_SWARM_TEMPLATES.map(t => ({
        ...t,
        roles: [...t.roles] as AgentRole[],
    })),
    // App-specific template
    {
        name: 'Full Stack Team',
        description: 'A comprehensive team for complex projects',
        roles: ['coordinator', 'researcher', 'coder', 'coder', 'reviewer', 'executor'],
    },
];
