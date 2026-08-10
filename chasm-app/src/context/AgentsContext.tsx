// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Agent,
    AgentSwarm,
    AgentRun,
    AgentTask,
    AgentMessage,
    createAgent,
    createSwarm,
    createAgentRun,
    createTask,
    generateAgentId,
    AgentRole,
} from '../api/agents';

// Storage keys
const STORAGE_KEYS = {
    AGENTS: 'csm_agents',
    SWARMS: 'csm_swarms',
    RUNS: 'csm_agent_runs',
};

// State types
interface AgentsState {
    agents: Agent[];
    swarms: AgentSwarm[];
    runs: AgentRun[];
    activeRunId: string | null;
    isLoading: boolean;
}

type AgentsAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_AGENTS'; payload: Agent[] }
    | { type: 'ADD_AGENT'; payload: Agent }
    | { type: 'UPDATE_AGENT'; payload: Agent }
    | { type: 'REMOVE_AGENT'; payload: string }
    | { type: 'SET_SWARMS'; payload: AgentSwarm[] }
    | { type: 'ADD_SWARM'; payload: AgentSwarm }
    | { type: 'UPDATE_SWARM'; payload: AgentSwarm }
    | { type: 'REMOVE_SWARM'; payload: string }
    | { type: 'SET_RUNS'; payload: AgentRun[] }
    | { type: 'ADD_RUN'; payload: AgentRun }
    | { type: 'UPDATE_RUN'; payload: AgentRun }
    | { type: 'REMOVE_RUN'; payload: string }
    | { type: 'SET_ACTIVE_RUN'; payload: string | null }
    | { type: 'ADD_MESSAGE_TO_RUN'; payload: { runId: string; message: AgentMessage } }
    | { type: 'ADD_TASK_TO_RUN'; payload: { runId: string; task: AgentTask } }
    | { type: 'UPDATE_TASK_IN_RUN'; payload: { runId: string; task: AgentTask } };

// Reducer
function agentsReducer(state: AgentsState, action: AgentsAction): AgentsState {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };

        case 'SET_AGENTS':
            return { ...state, agents: action.payload };

        case 'ADD_AGENT':
            return { ...state, agents: [...state.agents, action.payload] };

        case 'UPDATE_AGENT':
            return {
                ...state,
                agents: state.agents.map(a =>
                    a.id === action.payload.id ? action.payload : a
                ),
            };

        case 'REMOVE_AGENT':
            return {
                ...state,
                agents: state.agents.filter(a => a.id !== action.payload),
            };

        case 'SET_SWARMS':
            return { ...state, swarms: action.payload };

        case 'ADD_SWARM':
            return { ...state, swarms: [...state.swarms, action.payload] };

        case 'UPDATE_SWARM':
            return {
                ...state,
                swarms: state.swarms.map(s =>
                    s.id === action.payload.id ? action.payload : s
                ),
            };

        case 'REMOVE_SWARM':
            return {
                ...state,
                swarms: state.swarms.filter(s => s.id !== action.payload),
            };

        case 'SET_RUNS':
            return { ...state, runs: action.payload };

        case 'ADD_RUN':
            return { ...state, runs: [action.payload, ...state.runs] };

        case 'UPDATE_RUN':
            return {
                ...state,
                runs: state.runs.map(r =>
                    r.id === action.payload.id ? action.payload : r
                ),
            };

        case 'REMOVE_RUN':
            return {
                ...state,
                runs: state.runs.filter(r => r.id !== action.payload),
                activeRunId: state.activeRunId === action.payload ? null : state.activeRunId,
            };

        case 'SET_ACTIVE_RUN':
            return { ...state, activeRunId: action.payload };

        case 'ADD_MESSAGE_TO_RUN': {
            const run = state.runs.find(r => r.id === action.payload.runId);
            if (!run) return state;

            const updatedRun: AgentRun = {
                ...run,
                messages: [...run.messages, action.payload.message],
            };

            return {
                ...state,
                runs: state.runs.map(r =>
                    r.id === action.payload.runId ? updatedRun : r
                ),
            };
        }

        case 'ADD_TASK_TO_RUN': {
            const run = state.runs.find(r => r.id === action.payload.runId);
            if (!run) return state;

            const updatedRun: AgentRun = {
                ...run,
                tasks: [...run.tasks, action.payload.task],
            };

            return {
                ...state,
                runs: state.runs.map(r =>
                    r.id === action.payload.runId ? updatedRun : r
                ),
            };
        }

        case 'UPDATE_TASK_IN_RUN': {
            const run = state.runs.find(r => r.id === action.payload.runId);
            if (!run) return state;

            const updatedRun: AgentRun = {
                ...run,
                tasks: run.tasks.map(t =>
                    t.id === action.payload.task.id ? action.payload.task : t
                ),
            };

            return {
                ...state,
                runs: state.runs.map(r =>
                    r.id === action.payload.runId ? updatedRun : r
                ),
            };
        }

        default:
            return state;
    }
}

// Initial state
const initialState: AgentsState = {
    agents: [],
    swarms: [],
    runs: [],
    activeRunId: null,
    isLoading: true,
};

// Context
interface AgentsContextValue extends AgentsState {
    // Agent actions
    addAgent: (name: string, role: AgentRole, description: string, providerId?: string) => Agent;
    updateAgent: (agent: Agent) => void;
    removeAgent: (id: string) => void;

    // Swarm actions
    addSwarm: (name: string, description: string, goalDescription?: string) => AgentSwarm;
    updateSwarm: (swarm: AgentSwarm) => void;
    removeSwarm: (id: string) => void;
    addAgentToSwarm: (swarmId: string, agent: Agent) => void;
    removeAgentFromSwarm: (swarmId: string, agentId: string) => void;

    // Run actions
    startRun: (name: string, description: string, swarmId?: string) => AgentRun;
    updateRun: (run: AgentRun) => void;
    completeRun: (runId: string, result?: string) => void;
    cancelRun: (runId: string) => void;
    removeRun: (id: string) => void;
    setActiveRun: (id: string | null) => void;
    getActiveRun: () => AgentRun | undefined;

    // Message/Task actions
    addMessageToRun: (runId: string, message: AgentMessage) => void;
    addTaskToRun: (runId: string, title: string, description: string) => AgentTask;
    updateTaskInRun: (runId: string, task: AgentTask) => void;
}

const AgentsContext = createContext<AgentsContextValue | undefined>(undefined);

// Provider component
export function AgentsContextProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(agentsReducer, initialState);

    // Load data from storage on mount
    useEffect(() => {
        loadData();
    }, []);

    // Save agents when they change
    useEffect(() => {
        if (!state.isLoading) {
            AsyncStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(state.agents));
        }
    }, [state.agents, state.isLoading]);

    // Save swarms when they change
    useEffect(() => {
        if (!state.isLoading) {
            AsyncStorage.setItem(STORAGE_KEYS.SWARMS, JSON.stringify(state.swarms));
        }
    }, [state.swarms, state.isLoading]);

    // Save runs when they change
    useEffect(() => {
        if (!state.isLoading) {
            AsyncStorage.setItem(STORAGE_KEYS.RUNS, JSON.stringify(state.runs));
        }
    }, [state.runs, state.isLoading]);

    const loadData = async () => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });

            // Load agents
            const agentsJson = await AsyncStorage.getItem(STORAGE_KEYS.AGENTS);
            if (agentsJson) {
                dispatch({ type: 'SET_AGENTS', payload: JSON.parse(agentsJson) });
            }

            // Load swarms
            const swarmsJson = await AsyncStorage.getItem(STORAGE_KEYS.SWARMS);
            if (swarmsJson) {
                dispatch({ type: 'SET_SWARMS', payload: JSON.parse(swarmsJson) });
            }

            // Load runs
            const runsJson = await AsyncStorage.getItem(STORAGE_KEYS.RUNS);
            if (runsJson) {
                dispatch({ type: 'SET_RUNS', payload: JSON.parse(runsJson) });
            }
        } catch (error) {
            console.error('Error loading agents data:', error);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    // Agent actions
    const addAgent = (name: string, role: AgentRole, description: string, providerId?: string): Agent => {
        const agent = createAgent(name, role, description, providerId);
        dispatch({ type: 'ADD_AGENT', payload: agent });
        return agent;
    };

    const updateAgent = (agent: Agent) => {
        dispatch({ type: 'UPDATE_AGENT', payload: { ...agent, updatedAt: Date.now() } });
    };

    const removeAgent = (id: string) => {
        dispatch({ type: 'REMOVE_AGENT', payload: id });
    };

    // Swarm actions
    const addSwarm = (name: string, description: string, goalDescription?: string): AgentSwarm => {
        const swarm = createSwarm(name, description, goalDescription);
        dispatch({ type: 'ADD_SWARM', payload: swarm });
        return swarm;
    };

    const updateSwarm = (swarm: AgentSwarm) => {
        dispatch({ type: 'UPDATE_SWARM', payload: { ...swarm, updatedAt: Date.now() } });
    };

    const removeSwarm = (id: string) => {
        dispatch({ type: 'REMOVE_SWARM', payload: id });
    };

    const addAgentToSwarm = (swarmId: string, agent: Agent) => {
        const swarm = state.swarms.find(s => s.id === swarmId);
        if (swarm) {
            updateSwarm({
                ...swarm,
                agents: [...swarm.agents, agent],
            });
        }
    };

    const removeAgentFromSwarm = (swarmId: string, agentId: string) => {
        const swarm = state.swarms.find(s => s.id === swarmId);
        if (swarm) {
            updateSwarm({
                ...swarm,
                agents: swarm.agents.filter(a => a.id !== agentId),
            });
        }
    };

    // Run actions
    const startRun = (name: string, description: string, swarmId?: string): AgentRun => {
        const run = createAgentRun(name, description);
        if (swarmId) {
            run.swarmId = swarmId;
        }
        dispatch({ type: 'ADD_RUN', payload: run });
        dispatch({ type: 'SET_ACTIVE_RUN', payload: run.id });
        return run;
    };

    const updateRun = (run: AgentRun) => {
        dispatch({ type: 'UPDATE_RUN', payload: run });
    };

    const completeRun = (runId: string, result?: string) => {
        const run = state.runs.find(r => r.id === runId);
        if (run) {
            updateRun({
                ...run,
                status: 'completed',
                completedAt: Date.now(),
            });
        }
    };

    const cancelRun = (runId: string) => {
        const run = state.runs.find(r => r.id === runId);
        if (run) {
            updateRun({
                ...run,
                status: 'cancelled',
                completedAt: Date.now(),
            });
        }
    };

    const removeRun = (id: string) => {
        dispatch({ type: 'REMOVE_RUN', payload: id });
    };

    const setActiveRun = (id: string | null) => {
        dispatch({ type: 'SET_ACTIVE_RUN', payload: id });
    };

    const getActiveRun = () => {
        return state.runs.find(r => r.id === state.activeRunId);
    };

    // Message/Task actions
    const addMessageToRun = (runId: string, message: AgentMessage) => {
        dispatch({ type: 'ADD_MESSAGE_TO_RUN', payload: { runId, message } });
    };

    const addTaskToRun = (runId: string, title: string, description: string): AgentTask => {
        const task = createTask(title, description);
        dispatch({ type: 'ADD_TASK_TO_RUN', payload: { runId, task } });
        return task;
    };

    const updateTaskInRun = (runId: string, task: AgentTask) => {
        dispatch({ type: 'UPDATE_TASK_IN_RUN', payload: { runId, task: { ...task, updatedAt: Date.now() } } });
    };

    const value: AgentsContextValue = {
        ...state,
        addAgent,
        updateAgent,
        removeAgent,
        addSwarm,
        updateSwarm,
        removeSwarm,
        addAgentToSwarm,
        removeAgentFromSwarm,
        startRun,
        updateRun,
        completeRun,
        cancelRun,
        removeRun,
        setActiveRun,
        getActiveRun,
        addMessageToRun,
        addTaskToRun,
        updateTaskInRun,
    };

    return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}

// Hook to use agents context
export function useAgentsContext() {
    const context = useContext(AgentsContext);
    if (!context) {
        throw new Error('useAgentsContext must be used within an AgentsContextProvider');
    }
    return context;
}
