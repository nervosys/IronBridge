// Agent Execution Engine
// Handles running agents with LLM calls, task management, and message streaming

import { ChatProvider, sendChatCompletion, ChatMessage } from '../api/chat';
import {
    Agent,
    AgentRun,
    AgentTask,
    AgentMessage,
    AgentSwarm,
    createAgentRun,
    generateAgentId,
} from '../api/agents';

export type AgentEventType =
    | 'run_started'
    | 'run_completed'
    | 'run_failed'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'message'
    | 'thought'
    | 'action'
    | 'observation'
    | 'error';

export interface AgentEvent {
    type: AgentEventType;
    runId: string;
    agentId?: string;
    taskId?: string;
    message?: AgentMessage;
    error?: string;
    data?: any;
}

export type AgentEventListener = (event: AgentEvent) => void;

export interface ExecutionContext {
    run: AgentRun;
    provider: ChatProvider;
    onEvent: AgentEventListener;
    abortSignal?: AbortSignal;
}

// System prompts for different agent roles
const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
    coordinator: `You are a coordinator agent. Your responsibilities:
1. Break down complex goals into specific, actionable tasks
2. Assign tasks to appropriate agents based on their roles
3. Monitor progress and adjust plans as needed
4. Synthesize results from multiple agents
5. Report overall progress and completion status

Always respond with structured JSON containing:
- "thought": Your reasoning process
- "action": One of [create_task, assign_task, check_status, synthesize, complete]
- "action_input": Parameters for the action`,

    researcher: `You are a research agent. Your responsibilities:
1. Search for and analyze information relevant to assigned tasks
2. Summarize findings clearly and concisely
3. Identify key facts, patterns, and insights
4. Cite sources when possible
5. Flag any uncertainties or conflicting information

Focus on accuracy and thoroughness in your research.`,

    coder: `You are a coding agent. Your responsibilities:
1. Write clean, efficient, well-documented code
2. Follow best practices for the language/framework
3. Handle edge cases and errors appropriately
4. Test your code mentally before submitting
5. Explain your implementation choices

Always structure code with clear comments and logical organization.`,

    reviewer: `You are a review agent. Your responsibilities:
1. Review code, text, or other outputs for quality
2. Identify bugs, errors, or areas for improvement
3. Provide constructive, specific feedback
4. Suggest concrete improvements
5. Verify requirements are met

Be thorough but fair in your assessments.`,

    executor: `You are an executor agent. Your responsibilities:
1. Execute specific actions or commands
2. Report results accurately
3. Handle errors gracefully
4. Confirm completion of tasks
5. Document any issues encountered

Focus on reliable execution and clear status reporting.`,

    custom: `You are an AI assistant agent. Help complete the assigned tasks efficiently and accurately. Report your progress and results clearly.`,
};

// Main execution engine
export class AgentExecutionEngine {
    private listeners: Set<AgentEventListener> = new Set();
    private runningRuns: Map<string, AbortController> = new Map();

    addListener(listener: AgentEventListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit(event: AgentEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (e) {
                console.error('Agent event listener error:', e);
            }
        });
    }

    async executeRun(
        run: AgentRun,
        provider: ChatProvider,
        agent?: Agent
    ): Promise<AgentRun> {
        const abortController = new AbortController();
        this.runningRuns.set(run.id, abortController);

        this.emit({
            type: 'run_started',
            runId: run.id,
            data: { startTime: Date.now() },
        });

        try {
            // Execute each pending task
            for (const task of run.tasks.filter(t => t.status === 'pending')) {
                if (abortController.signal.aborted) {
                    break;
                }

                await this.executeTask(run, task, provider, agent, abortController.signal);
            }

            // Mark run as completed
            run.status = abortController.signal.aborted ? 'cancelled' : 'completed';
            run.completedAt = Date.now();

            this.emit({
                type: 'run_completed',
                runId: run.id,
                data: { completionTime: Date.now(), tokensUsed: run.tokensUsed },
            });
        } catch (error: any) {
            run.status = 'failed';
            run.completedAt = Date.now();

            this.emit({
                type: 'run_failed',
                runId: run.id,
                error: error.message || 'Unknown error',
            });
        } finally {
            this.runningRuns.delete(run.id);
        }

        return run;
    }

    async executeTask(
        run: AgentRun,
        task: AgentTask,
        provider: ChatProvider,
        agent?: Agent,
        signal?: AbortSignal
    ): Promise<AgentTask> {
        task.status = 'in_progress';
        task.startedAt = Date.now();

        this.emit({
            type: 'task_started',
            runId: run.id,
            taskId: task.id,
            agentId: agent?.id,
        });

        try {
            // Build conversation for this task
            const systemPrompt = agent?.systemPrompt ||
                ROLE_SYSTEM_PROMPTS[agent?.role || 'custom'] ||
                ROLE_SYSTEM_PROMPTS.custom;

            const messages: ChatMessage[] = [
                {
                    id: generateAgentId(),
                    role: 'system',
                    content: systemPrompt,
                    timestamp: Date.now(),
                },
                {
                    id: generateAgentId(),
                    role: 'user',
                    content: `Task: ${task.title}\n\nDescription: ${task.description}\n\nPlease complete this task and provide your results.`,
                    timestamp: Date.now(),
                },
            ];

            // Add thought message
            this.addRunMessage(run, {
                id: generateAgentId(),
                agentId: agent?.id || 'system',
                type: 'thought',
                content: `Starting task: ${task.title}`,
                timestamp: Date.now(),
            });

            // Call the LLM
            const response = await sendChatCompletion({
                provider,
                messages,
            });

            // Track tokens
            if (response.tokens) {
                run.tokensUsed += response.tokens.total || 0;
            }

            // Add result message
            this.addRunMessage(run, {
                id: generateAgentId(),
                agentId: agent?.id || 'system',
                type: 'result',
                content: response.content,
                metadata: {
                    model: response.model,
                    tokens: response.tokens,
                },
                timestamp: Date.now(),
            });

            // Mark task complete
            task.status = 'completed';
            task.completedAt = Date.now();
            task.result = response.content;

            this.emit({
                type: 'task_completed',
                runId: run.id,
                taskId: task.id,
                agentId: agent?.id,
                data: { result: response.content },
            });
        } catch (error: any) {
            task.status = 'failed';
            task.error = error.message || 'Task execution failed';
            task.completedAt = Date.now();

            // Add error message
            this.addRunMessage(run, {
                id: generateAgentId(),
                agentId: agent?.id || 'system',
                type: 'error',
                content: `Task failed: ${error.message || 'Unknown error'}`,
                timestamp: Date.now(),
            });

            this.emit({
                type: 'task_failed',
                runId: run.id,
                taskId: task.id,
                agentId: agent?.id,
                error: error.message,
            });
        }

        return task;
    }

    async executeSwarm(
        swarm: AgentSwarm,
        provider: ChatProvider
    ): Promise<AgentRun> {
        // Create a run for this swarm execution
        const run = createAgentRun(swarm.name, swarm.goalDescription || 'Swarm execution');
        run.swarmId = swarm.id;
        run.tasks = [...swarm.tasks];

        this.emit({
            type: 'run_started',
            runId: run.id,
            data: { swarmId: swarm.id, agentCount: swarm.agents.length },
        });

        // Get coordinator agent
        const coordinator = swarm.agents.find(a => a.id === swarm.coordinatorAgentId) ||
            swarm.agents.find(a => a.role === 'coordinator') ||
            swarm.agents[0];

        if (!coordinator) {
            run.status = 'failed';
            this.emit({
                type: 'run_failed',
                runId: run.id,
                error: 'No agents in swarm',
            });
            return run;
        }

        // Execute with coordinator
        return this.executeRun(run, provider, coordinator);
    }

    cancelRun(runId: string): boolean {
        const controller = this.runningRuns.get(runId);
        if (controller) {
            controller.abort();
            return true;
        }
        return false;
    }

    isRunning(runId: string): boolean {
        return this.runningRuns.has(runId);
    }

    private addRunMessage(run: AgentRun, message: AgentMessage): void {
        run.messages.push(message);
        this.emit({
            type: 'message',
            runId: run.id,
            agentId: message.agentId,
            message,
        });
    }
}

// Singleton instance
export const agentEngine = new AgentExecutionEngine();

// Helper hooks for React components
export function useAgentExecution() {
    return {
        executeRun: (run: AgentRun, provider: ChatProvider, agent?: Agent) =>
            agentEngine.executeRun(run, provider, agent),
        executeSwarm: (swarm: AgentSwarm, provider: ChatProvider) =>
            agentEngine.executeSwarm(swarm, provider),
        cancelRun: (runId: string) => agentEngine.cancelRun(runId),
        isRunning: (runId: string) => agentEngine.isRunning(runId),
        addListener: (listener: AgentEventListener) => agentEngine.addListener(listener),
    };
}
