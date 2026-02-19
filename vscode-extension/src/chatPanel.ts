// Chasm Chat Panel - Unified Chat Interface with Agent Support
// A comprehensive chat interface that rivals Google Agency's Antigravity
// Types aligned with chasm-shared and chasm-rust Agency

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ChasmExecutor } from './chasmExecutor';
import {
    ChatMessage,
    ChatSession,
    AgentConfig,
    AgentCapability,
    ToolDefinition,
    ProviderConfig,
    TaskPlan,
    PlanStep,
    AgentReflection,
    ToolCall,
    ToolResult,
    OrchestrationType,
    Swarm,
    SwarmAgent,
    SwarmWorkflow,
    AgentRun,
    AgentTask,
    AgentMessage,
    PanelState,
    WebviewMessage,
    TokenUsage,
    TaskStatus,
    SwarmStatus,
    AgentStatus,
    AgentRole,
} from './types';
import {
    DEFAULT_PROVIDERS,
    DEFAULT_AGENTS,
    ORCHESTRATION_MODES,
    AGENT_ROLES,
    LIMITS,
} from './constants';

/**
 * Chasm Chat Panel - A unified chat interface with multi-provider and agent support
 */
export class ChasmChatPanel {
    public static currentPanel: ChasmChatPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _executor: ChasmExecutor;
    private readonly _outputChannel: vscode.OutputChannel;
    private _disposables: vscode.Disposable[] = [];

    // State
    private _currentSession: ChatSession | null = null;
    private _sessions: ChatSession[] = [];
    private _providers: ProviderConfig[] = [];
    private _agents: AgentConfig[] = [];
    private _selectedProvider: string = 'copilot';
    private _selectedModel: string = 'gpt-4o';
    private _selectedAgent: string | null = null;
    private _isStreaming: boolean = false;
    private _availableTools: ToolDefinition[] = [];
    private _orchestrationMode: OrchestrationType = 'single';
    private _enablePlanning: boolean = true;
    private _enableReflection: boolean = true;
    private _maxAgentIterations: number = 10;

    // Swarm state (aligned with chasm-shared Swarm types)
    private _swarms: Swarm[] = [];
    private _currentSwarm: Swarm | null = null;
    private _activeRun: AgentRun | null = null;

    public static createOrShow(
        extensionUri: vscode.Uri,
        executor: ChasmExecutor,
        outputChannel: vscode.OutputChannel
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ChasmChatPanel.currentPanel) {
            ChasmChatPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            'chasmChat',
            'Chasm Chat',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'resources'),
                    vscode.Uri.joinPath(extensionUri, 'out')
                ]
            }
        );

        ChasmChatPanel.currentPanel = new ChasmChatPanel(panel, extensionUri, executor, outputChannel);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        executor: ChasmExecutor,
        outputChannel: vscode.OutputChannel
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._executor = executor;
        this._outputChannel = outputChannel;

        // Set initial HTML content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                await this._handleMessage(message);
            },
            null,
            this._disposables
        );

        // Initialize state
        this._initializeState();
    }

    private async _initializeState() {
        // Load providers from chasm
        await this._loadProviders();

        // Load saved sessions
        await this._loadSessions();

        // Load agent configurations
        await this._loadAgents();

        // Send initial state to webview
        this._sendState();
    }

    private async _loadProviders() {
        try {
            const result = await this._executor.execute(['provider', 'list', '--json']);
            if (result.success && result.output) {
                this._providers = JSON.parse(result.output);
            }
        } catch (e) {
            this._outputChannel.appendLine(`Error loading providers: ${e}`);
        }

        // Default providers from shared constants if Chasm doesn't return any
        if (this._providers.length === 0) {
            this._providers = DEFAULT_PROVIDERS.map(p => ({
                name: p.id,
                displayName: p.name,
                models: p.models,
                isAvailable: p.id === 'copilot', // Only copilot available by default
            }));
        }
    }

    private async _loadSessions() {
        // Load from workspace storage
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const result = await this._executor.execute(['list', 'sessions', '--json', '--path', workspaceFolder.uri.fsPath]);
                if (result.success && result.output) {
                    const rawSessions = JSON.parse(result.output);
                    this._sessions = rawSessions.map((s: any) => this._convertSession(s));
                }
            }
        } catch (e) {
            this._outputChannel.appendLine(`Error loading sessions: ${e}`);
        }
    }

    private _convertSession(raw: any): ChatSession {
        const messages = (raw.requests || []).map((r: any, i: number) => this._convertMessage(r, i));
        return {
            id: raw.session_id || raw.id || this._generateId(),
            title: raw.title || 'Untitled Chat',
            messages,
            messageCount: messages.length,
            createdAt: new Date(raw.created_at || Date.now()),
            updatedAt: new Date(raw.updated_at || raw.last_message_date || Date.now()),
            model: raw.model || 'unknown',
            provider: raw.provider || 'copilot',
            agentName: raw.agent_name,
            metadata: raw.metadata || {}
        };
    }

    private _convertMessage(raw: any, index: number): ChatMessage {
        const messages: ChatMessage[] = [];

        // User message
        if (raw.message?.text || raw.text) {
            return {
                id: `msg-${index}-user`,
                role: 'user',
                content: raw.message?.text || raw.text || '',
                timestamp: new Date(raw.timestamp || Date.now())
            };
        }

        // Assistant response
        if (raw.response) {
            let content = '';
            if (Array.isArray(raw.response)) {
                content = raw.response.map((r: any) => r.value || r).join('\n');
            } else if (raw.response.value) {
                content = Array.isArray(raw.response.value)
                    ? raw.response.value.map((v: any) => v.value || v).join('\n')
                    : raw.response.value;
            } else {
                content = String(raw.response);
            }
            return {
                id: `msg-${index}-assistant`,
                role: 'assistant',
                content,
                timestamp: new Date(raw.timestamp || Date.now())
            };
        }

        return {
            id: `msg-${index}`,
            role: 'user',
            content: JSON.stringify(raw),
            timestamp: new Date()
        };
    }

    private async _loadAgents() {
        // Load available tools
        await this._discoverTools();

        // Default agents from shared constants with enhanced capabilities
        this._agents = DEFAULT_AGENTS.map(agent => {
            const roleInfo = AGENT_ROLES[agent.role] || AGENT_ROLES.custom;
            return {
                name: agent.name,
                description: agent.description,
                instruction: agent.instruction,
                model: agent.model,
                provider: 'copilot',
                tools: agent.tools,
                temperature: agent.temperature,
                capabilities: roleInfo.capabilities.map(cap => ({
                    name: cap,
                    description: `${cap.replace(/_/g, ' ')} capability`,
                    enabled: true
                })),
                autonomy: agent.autonomy,
                maxIterations: agent.maxIterations
            };
        });
    }

    private async _discoverTools() {
        // Discover available VS Code tools
        this._availableTools = [
            { name: 'read_file', description: 'Read contents of a file', parameters: { filePath: 'string', startLine: 'number', endLine: 'number' }, category: 'file' },
            { name: 'write_file', description: 'Write content to a file', parameters: { filePath: 'string', content: 'string' }, category: 'file' },
            { name: 'create_file', description: 'Create a new file', parameters: { filePath: 'string', content: 'string' }, category: 'file' },
            { name: 'replace_string_in_file', description: 'Replace text in a file', parameters: { filePath: 'string', oldString: 'string', newString: 'string' }, category: 'file' },
            { name: 'semantic_search', description: 'Search workspace semantically', parameters: { query: 'string' }, category: 'search' },
            { name: 'grep_search', description: 'Search workspace by text pattern', parameters: { query: 'string', isRegexp: 'boolean' }, category: 'search' },
            { name: 'file_search', description: 'Search files by name pattern', parameters: { query: 'string' }, category: 'search' },
            { name: 'run_in_terminal', description: 'Execute terminal command', parameters: { command: 'string', explanation: 'string' }, category: 'code' },
            { name: 'get_errors', description: 'Get compile/lint errors', parameters: { filePaths: 'string[]' }, category: 'analysis' },
            { name: 'fetch_webpage', description: 'Fetch web page content', parameters: { urls: 'string[]', query: 'string' }, category: 'web' },
            { name: 'list_dir', description: 'List directory contents', parameters: { path: 'string' }, category: 'file' },
            { name: 'get_changed_files', description: 'Get git diff of changes', parameters: {}, category: 'code' }
        ];
    }

    private _sendState() {
        const state: PanelState = {
            sessions: this._sessions,
            currentSession: this._currentSession,
            providers: this._providers,
            agents: this._agents,
            selectedProvider: this._selectedProvider,
            selectedModel: this._selectedModel,
            selectedAgent: this._selectedAgent,
            isStreaming: this._isStreaming,
            orchestrationMode: this._orchestrationMode,
            enablePlanning: this._enablePlanning,
            enableReflection: this._enableReflection,
            availableTools: this._availableTools,
            swarms: this._swarms,
            currentSwarm: this._currentSwarm,
            activeRun: this._activeRun
        };
        this._panel.webview.postMessage({ type: 'setState', state });
    }

    private async _handleMessage(message: WebviewMessage) {
        switch (message.type) {
            case 'sendMessage':
                await this._sendChatMessage(message.content as string);
                break;
            case 'newSession':
                await this._createNewSession();
                break;
            case 'loadSession':
                await this._loadSession(message.sessionId as string);
                break;
            case 'deleteSession':
                await this._deleteSession(message.sessionId as string);
                break;
            case 'selectProvider':
                this._selectedProvider = message.provider as string;
                this._sendState();
                break;
            case 'selectModel':
                this._selectedModel = message.model as string;
                this._sendState();
                break;
            case 'selectAgent':
                this._selectedAgent = message.agent as string | null;
                this._sendState();
                break;
            case 'selectOrchestration':
                this._orchestrationMode = message.mode as OrchestrationType;
                this._sendState();
                break;
            case 'togglePlanning':
                this._enablePlanning = message.enabled as boolean;
                this._sendState();
                break;
            case 'toggleReflection':
                this._enableReflection = message.enabled as boolean;
                this._sendState();
                break;
            case 'stopGeneration':
                this._isStreaming = false;
                this._activeRun = null;
                this._sendState();
                break;
            case 'exportSession':
                await this._exportSession(message.sessionId as string, (message.format || 'json') as 'json' | 'markdown' | 'html');
                break;
            case 'renameSession':
                await this._renameSession(message.sessionId as string, message.title as string);
                break;
            case 'copyMessage':
                await vscode.env.clipboard.writeText(message.content as string);
                vscode.window.showInformationMessage('Message copied to clipboard');
                break;
            case 'insertCode':
                await this._insertCodeToEditor(message.code as string);
                break;
            case 'createAgent':
                await this._createAgent(message.config as AgentConfig);
                break;
            case 'createSwarm':
                await this._createSwarm(message.name as string, message.description as string, message.agentIds as string[]);
                break;
            case 'startSwarm':
                await this._startSwarm(message.swarmId as string, message.goal as string);
                break;
            case 'pauseSwarm':
                await this._pauseSwarm(message.swarmId as string);
                break;
            case 'swarmAction':
                await this._handleSwarmAction(message.action as string);
                break;
            case 'cancelRun':
                await this._cancelRun(message.runId as string);
                break;
            case 'refresh':
                await this._initializeState();
                break;
        }
    }

    private async _sendChatMessage(content: string) {
        if (!content.trim()) return;

        // Create session if needed
        if (!this._currentSession) {
            await this._createNewSession();
        }

        // Add user message
        const userMessage: ChatMessage = {
            id: this._generateId(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date()
        };
        this._currentSession!.messages.push(userMessage);
        this._currentSession!.updatedAt = new Date();

        // Update title if first message
        if (this._currentSession!.messages.length === 1) {
            this._currentSession!.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
        }

        this._isStreaming = true;
        this._sendState();

        // Get agent configuration
        const agent = this._agents.find(a => a.name === this._selectedAgent);
        const enablePlanning = agent?.capabilities?.find(c => c.name === 'planning')?.enabled ?? this._enablePlanning;
        const enableReflection = agent?.capabilities?.find(c => c.name === 'reflection')?.enabled ?? this._enableReflection;
        const maxIterations = agent?.maxIterations ?? this._maxAgentIterations;

        try {
            // Phase 1: Planning (if enabled)
            let plan: TaskPlan | undefined;
            if (enablePlanning && this._orchestrationMode !== 'single') {
                plan = await this._createTaskPlan(content);
                if (plan) {
                    // Show plan to user
                    const planMessage: ChatMessage = {
                        id: this._generateId(),
                        role: 'assistant',
                        content: `📋 **Task Plan**\\n\\n${plan.reasoning}\\n\\n**Steps:**\\n${plan.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\\n')}`,
                        timestamp: new Date(),
                        plan: plan,
                        agentName: this._selectedAgent || undefined
                    };
                    this._currentSession!.messages.push(planMessage);
                    this._sendState();
                }
            }

            // Phase 2: Execution
            const response = await this._executeAgentTask(content, plan, maxIterations);

            const assistantMessage: ChatMessage = {
                id: this._generateId(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
                model: this._selectedModel,
                agentName: this._selectedAgent || undefined,
                plan: plan
            };
            this._currentSession!.messages.push(assistantMessage);

            // Phase 3: Reflection (if enabled)
            if (enableReflection) {
                const reflection = await this._reflectOnResponse(content, response);
                if (reflection && reflection.confidence < 0.8) {
                    assistantMessage.reflection = reflection;
                    // Show reflection to user
                    const reflectionMessage: ChatMessage = {
                        id: this._generateId(),
                        role: 'assistant',
                        content: `🤔 **Self-Reflection** (Confidence: ${(reflection.confidence * 100).toFixed(0)}%)\\n\\n${reflection.evaluation}\\n\\n**Suggested Improvements:**\\n${reflection.improvements.map(i => `• ${i}`).join('\\n')}`,
                        timestamp: new Date(),
                        reflection: reflection,
                        agentName: this._selectedAgent || undefined
                    };
                    this._currentSession!.messages.push(reflectionMessage);
                }
            }

            this._currentSession!.updatedAt = new Date();
            await this._saveSession(this._currentSession!);

        } catch (e) {
            const errorMessage: ChatMessage = {
                id: this._generateId(),
                role: 'assistant',
                content: `❌ Error: ${e}`,
                timestamp: new Date()
            };
            this._currentSession!.messages.push(errorMessage);
        }

        this._isStreaming = false;
        this._sendState();
    }

    private async _createTaskPlan(task: string): Promise<TaskPlan | undefined> {
        try {
            const planningPrompt = `Given this task, create a step-by-step plan:\\n\\nTask: ${task}\\n\\nProvide a JSON response with this structure:\\n{\\n  \"reasoning\": \"explanation of approach\",\\n  \"steps\": [\\n    {\"id\": \"step1\", \"description\": \"step description\", \"status\": \"pending\"}\\n  ],\\n  \"estimatedTime\": 300\\n}`;

            const planResponse = await this._getChatResponse(planningPrompt);

            // Try to extract JSON from response
            const jsonMatch = planResponse.match(/\\{[\\s\\S]*\\}/);
            if (jsonMatch) {
                const planData = JSON.parse(jsonMatch[0]);
                return {
                    steps: planData.steps || [],
                    reasoning: planData.reasoning || 'No reasoning provided',
                    estimatedTime: planData.estimatedTime
                };
            }
        } catch (e) {
            this._outputChannel.appendLine(`Planning error: ${e}`);
        }
        return undefined;
    }

    private async _executeAgentTask(content: string, plan?: TaskPlan, maxIterations: number = 10): Promise<string> {
        // Execute based on orchestration mode
        switch (this._orchestrationMode) {
            case 'single':
                return await this._getChatResponse(content);

            case 'sequential':
                return await this._executeSequential(content, plan);

            case 'parallel':
                return await this._executeParallel(content, plan);

            case 'swarm':
                return await this._executeSwarm(content, plan);

            case 'hierarchical':
                return await this._executeHierarchical(content, plan);

            case 'debate':
                return await this._executeDebate(content);

            default:
                return await this._getChatResponse(content);
        }
    }

    private async _executeSequential(content: string, plan?: TaskPlan): Promise<string> {
        if (!plan || plan.steps.length === 0) {
            return await this._getChatResponse(content);
        }

        let results: string[] = [];
        for (const step of plan.steps) {
            step.status = 'in_progress';
            this._sendState();

            const stepResult = await this._getChatResponse(
                `Task: ${content}\\n\\nCurrent Step: ${step.description}\\n\\nPrevious Results: ${results.join('\\n\\n')}`
            );

            step.status = 'completed';
            step.result = stepResult;
            results.push(stepResult);
            this._sendState();
        }

        return `**Sequential Execution Results:**\\n\\n${results.map((r, i) => `**Step ${i + 1}:**\\n${r}`).join('\\n\\n---\\n\\n')}`;
    }

    private async _executeParallel(content: string, plan?: TaskPlan): Promise<string> {
        if (!plan || plan.steps.length === 0) {
            return await this._getChatResponse(content);
        }

        // Execute all steps in parallel
        const promises = plan.steps.map(step => {
            step.status = 'in_progress';
            return this._getChatResponse(`Task: ${content}\\n\\nSub-task: ${step.description}`);
        });

        const results = await Promise.all(promises);

        plan.steps.forEach((step, i) => {
            step.status = 'completed';
            step.result = results[i];
        });

        return `**Parallel Execution Results:**\\n\\n${results.map((r, i) => `**Thread ${i + 1} (${plan.steps[i].description}):**\\n${r}`).join('\\n\\n---\\n\\n')}`;
    }

    private async _executeSwarm(content: string, plan?: TaskPlan): Promise<string> {
        // Multi-agent swarm: each agent tackles the problem independently, then synthesize
        const agents = ['assistant', 'coder', 'researcher'].filter(a => this._agents.find(ag => ag.name === a));

        const agentResponses: string[] = [];
        for (const agentName of agents) {
            const prevAgent = this._selectedAgent;
            this._selectedAgent = agentName;

            const response = await this._getChatResponse(content);
            agentResponses.push(`**${agentName}:** ${response}`);

            this._selectedAgent = prevAgent;
        }

        // Synthesize responses
        const synthesisPrompt = `Given these responses from different specialized agents, synthesize a comprehensive answer:\\n\\n${agentResponses.join('\\n\\n')}\\n\\nOriginal question: ${content}`;
        return await this._getChatResponse(synthesisPrompt);
    }

    private async _executeHierarchical(content: string, plan?: TaskPlan): Promise<string> {
        // Coordinator delegates to specialized agents
        const coordinatorPrompt = `As a coordinator, analyze this task and delegate to specialized agents (coder, researcher, reviewer):\\n\\nTask: ${content}\\n\\nProvide delegation strategy.`;

        const strategy = await this._getChatResponse(coordinatorPrompt);

        // Execute delegated tasks (simplified version)
        const finalResponse = await this._getChatResponse(`Based on strategy: ${strategy}\\n\\nExecute: ${content}`);

        return `**Coordination Strategy:**\\n${strategy}\\n\\n---\\n\\n**Final Result:**\\n${finalResponse}`;
    }

    private async _executeDebate(content: string): Promise<string> {
        // Multi-turn debate between agents
        let debate: string[] = [];
        const agents = ['assistant', 'reviewer'];

        for (let round = 0; round < 3; round++) {
            for (const agentName of agents) {
                const prevAgent = this._selectedAgent;
                this._selectedAgent = agentName;

                const prompt = `Round ${round + 1} - You are ${agentName}. Consider previous arguments and provide your perspective:\\n\\n${content}\\n\\nPrevious debate:\\n${debate.join('\\n\\n')}`;
                const response = await this._getChatResponse(prompt);
                debate.push(`**${agentName} (Round ${round + 1}):** ${response}`);

                this._selectedAgent = prevAgent;
            }
        }

        return debate.join('\\n\\n---\\n\\n');
    }

    private async _reflectOnResponse(question: string, response: string): Promise<AgentReflection | undefined> {
        try {
            const reflectionPrompt = `Evaluate this response and suggest improvements:\\n\\nQuestion: ${question}\\n\\nResponse: ${response}\\n\\nProvide JSON:\\n{\\n  \"evaluation\": \"assessment of response quality\",\\n  \"improvements\": [\"improvement 1\", \"improvement 2\"],\\n  \"confidence\": 0.85\\n}`;

            const reflectionText = await this._getChatResponse(reflectionPrompt);

            const jsonMatch = reflectionText.match(/\\{[\\s\\S]*\\}/);
            if (jsonMatch) {
                const reflectionData = JSON.parse(jsonMatch[0]);
                return {
                    evaluation: reflectionData.evaluation || 'No evaluation',
                    improvements: reflectionData.improvements || [],
                    confidence: reflectionData.confidence || 0.5
                };
            }
        } catch (e) {
            this._outputChannel.appendLine(`Reflection error: ${e}`);
        }
        return undefined;
    }

    private async _getChatResponse(content: string): Promise<string> {
        // Get context from current editor
        const editor = vscode.window.activeTextEditor;
        let context = '';
        if (editor) {
            const selection = editor.selection;
            if (!selection.isEmpty) {
                context = editor.document.getText(selection);
            }
        }

        // Build prompt with agent instruction if selected
        let systemPrompt = '';
        if (this._selectedAgent) {
            const agent = this._agents.find(a => a.name === this._selectedAgent);
            if (agent) {
                systemPrompt = agent.instruction;
            }
        }

        // Use Chasm API if available, otherwise use VS Code's chat API
        try {
            // Try VS Code's language model API (Copilot)
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: this._selectedModel.includes('claude') ? 'claude-3.5-sonnet' : 'gpt-4o'
            });

            if (models.length > 0) {
                const model = models[0];
                const messages: vscode.LanguageModelChatMessage[] = [];

                // Add system prompt if agent selected
                if (systemPrompt) {
                    messages.push(vscode.LanguageModelChatMessage.User(
                        `[System Instruction]\n${systemPrompt}\n\n[User Message]\n${content}`
                    ));
                } else {
                    // Add context if available
                    if (context) {
                        messages.push(vscode.LanguageModelChatMessage.User(
                            `Context from editor:\n\`\`\`\n${context}\n\`\`\`\n\n${content}`
                        ));
                    } else {
                        messages.push(vscode.LanguageModelChatMessage.User(content));
                    }
                }

                const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

                let fullResponse = '';
                for await (const chunk of response.text) {
                    fullResponse += chunk;
                    // Stream update to UI
                    this._panel.webview.postMessage({
                        type: 'streamChunk',
                        content: fullResponse
                    });
                }
                return fullResponse;
            }
        } catch (e) {
            this._outputChannel.appendLine(`Language model error: ${e}`);
        }

        // Fallback: use Chasm API server if running
        try {
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: this._selectedProvider,
                    model: this._selectedModel,
                    messages: [
                        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                        { role: 'user', content }
                    ],
                    context
                })
            });
            if (response.ok) {
                const data = await response.json() as { response?: string; content?: string };
                return data.response || data.content || 'No response';
            }
        } catch (e) {
            // Chasm API not available
        }

        return 'Unable to get response. Please ensure a language model provider is configured.';
    }

    private async _createNewSession() {
        const newSession: ChatSession = {
            id: this._generateId(),
            title: 'New Chat',
            messages: [],
            messageCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            model: this._selectedModel,
            provider: this._selectedProvider,
            agentName: this._selectedAgent || undefined,
            metadata: {}
        };
        this._currentSession = newSession;
        this._sessions.unshift(newSession);
        this._sendState();
    }

    private async _loadSession(sessionId: string) {
        const session = this._sessions.find(s => s.id === sessionId);
        if (session) {
            this._currentSession = session;
            this._sendState();
        }
    }

    private async _deleteSession(sessionId: string) {
        const index = this._sessions.findIndex(s => s.id === sessionId);
        if (index !== -1) {
            this._sessions.splice(index, 1);
            if (this._currentSession?.id === sessionId) {
                this._currentSession = this._sessions[0] || null;
            }
            this._sendState();
        }
    }

    private async _saveSession(session: ChatSession) {
        // Save to workspace storage via chasm
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const sessionPath = path.join(
                    workspaceFolder.uri.fsPath,
                    '.chasm',
                    'sessions',
                    `${session.id}.json`
                );

                // Ensure directory exists
                const dir = path.dirname(sessionPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                // Convert to VS Code compatible format
                const vsCodeFormat = {
                    session_id: session.id,
                    title: session.title,
                    requests: session.messages.filter(m => m.role === 'user').map((userMsg, i) => {
                        const assistantMsg = session.messages.find(
                            (m, j) => m.role === 'assistant' && j > session.messages.indexOf(userMsg)
                        );
                        return {
                            message: { text: userMsg.content },
                            response: assistantMsg ? { value: assistantMsg.content } : null,
                            timestamp: userMsg.timestamp.getTime()
                        };
                    }),
                    created_at: session.createdAt.toISOString(),
                    updated_at: session.updatedAt.toISOString(),
                    last_message_date: session.updatedAt.getTime(),
                    model: session.model,
                    provider: session.provider,
                    agent_name: session.agentName
                };

                fs.writeFileSync(sessionPath, JSON.stringify(vsCodeFormat, null, 2));
            }
        } catch (e) {
            this._outputChannel.appendLine(`Error saving session: ${e}`);
        }
    }

    private async _exportSession(sessionId: string, format: 'json' | 'markdown' | 'html') {
        const session = this._sessions.find(s => s.id === sessionId);
        if (!session) return;

        let content: string;
        let extension: string;

        switch (format) {
            case 'markdown':
                content = this._sessionToMarkdown(session);
                extension = 'md';
                break;
            case 'html':
                content = this._sessionToHtml(session);
                extension = 'html';
                break;
            default:
                content = JSON.stringify(session, null, 2);
                extension = 'json';
        }

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${session.title.replace(/[^a-z0-9]/gi, '_')}.${extension}`),
            filters: { [format.toUpperCase()]: [extension] }
        });

        if (uri) {
            fs.writeFileSync(uri.fsPath, content);
            vscode.window.showInformationMessage(`Session exported to ${uri.fsPath}`);
        }
    }

    private _sessionToMarkdown(session: ChatSession): string {
        let md = `# ${session.title}\n\n`;
        md += `**Created:** ${session.createdAt.toLocaleString()}\n`;
        md += `**Model:** ${session.model}\n`;
        if (session.agentName) {
            md += `**Agent:** ${session.agentName}\n`;
        }
        md += `\n---\n\n`;

        for (const msg of session.messages) {
            const icon = msg.role === 'user' ? '👤' : '🤖';
            md += `## ${icon} ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}\n\n`;
            md += `${msg.content}\n\n`;
        }

        return md;
    }

    private _sessionToHtml(session: ChatSession): string {
        return `<!DOCTYPE html>
<html>
<head>
    <title>${session.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .message { margin: 16px 0; padding: 12px; border-radius: 8px; }
        .user { background: #e3f2fd; }
        .assistant { background: #f5f5f5; }
        .role { font-weight: bold; margin-bottom: 8px; }
        pre { background: #263238; color: #aed581; padding: 12px; border-radius: 4px; overflow-x: auto; }
        code { font-family: 'Fira Code', Consolas, monospace; }
    </style>
</head>
<body>
    <h1>${session.title}</h1>
    <p><strong>Created:</strong> ${session.createdAt.toLocaleString()}</p>
    <p><strong>Model:</strong> ${session.model}</p>
    ${session.agentName ? `<p><strong>Agent:</strong> ${session.agentName}</p>` : ''}
    <hr>
    ${session.messages.map(msg => `
        <div class="message ${msg.role}">
            <div class="role">${msg.role === 'user' ? '👤 User' : '🤖 Assistant'}</div>
            <div class="content">${this._escapeHtml(msg.content).replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')}</div>
        </div>
    `).join('')}
</body>
</html>`;
    }

    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private async _renameSession(sessionId: string, title: string) {
        const session = this._sessions.find(s => s.id === sessionId);
        if (session) {
            session.title = title;
            session.updatedAt = new Date();
            await this._saveSession(session);
            this._sendState();
        }
    }

    private async _insertCodeToEditor(code: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, code);
            });
        } else {
            // Open in new document
            const doc = await vscode.workspace.openTextDocument({ content: code });
            await vscode.window.showTextDocument(doc);
        }
    }

    private async _createAgent(config: AgentConfig) {
        this._agents.push(config);
        this._sendState();
        vscode.window.showInformationMessage(`Agent "${config.name}" created`);
    }

    // =========================================================================
    // Swarm Management (aligned with chasm-shared and chasm-rust Agency)
    // =========================================================================

    private async _createSwarm(name: string, description: string, agentIds: string[]) {
        const swarmAgents: SwarmAgent[] = agentIds.map(id => {
            const agent = this._agents.find(a => a.name === id);
            return {
                agentId: id,
                role: agent?.role || 'custom',
                position: { x: 0, y: 0 }
            };
        });

        const swarm: Swarm = {
            id: this._generateId(),
            name,
            description,
            agents: swarmAgents,
            tasks: [],
            messages: [],
            workflow: {
                nodes: swarmAgents.map((agent, i) => ({
                    id: `node-${i}`,
                    type: 'agent' as const,
                    agentId: agent.agentId,
                    position: { x: 100 + i * 200, y: 100 }
                })),
                edges: swarmAgents.slice(1).map((_, i) => ({
                    id: `edge-${i}`,
                    source: `node-${i}`,
                    target: `node-${i + 1}`
                }))
            },
            status: 'idle',
            coordinatorAgentId: agentIds[0],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this._swarms.push(swarm);
        this._currentSwarm = swarm;
        this._sendState();
        vscode.window.showInformationMessage(`Swarm "${name}" created with ${agentIds.length} agents`);
    }

    private async _startSwarm(swarmId: string, goal: string) {
        const swarm = this._swarms.find(s => s.id === swarmId);
        if (!swarm) {
            vscode.window.showErrorMessage('Swarm not found');
            return;
        }

        // Create a new run
        const run: AgentRun = {
            id: this._generateId(),
            swarmId,
            name: `${swarm.name} - ${new Date().toLocaleString()}`,
            description: goal,
            status: 'running',
            tasks: [],
            messages: [],
            tokensUsed: 0,
            startedAt: Date.now(),
            createdAt: Date.now()
        };

        // Update swarm state
        swarm.status = 'running';
        swarm.goalDescription = goal;
        swarm.startedAt = Date.now();
        swarm.updatedAt = Date.now();

        this._activeRun = run;
        this._currentSwarm = swarm;
        this._isStreaming = true;
        this._sendState();

        // Execute swarm
        try {
            const result = await this._executeSwarmRun(swarm, run, goal);

            run.status = 'completed';
            run.completedAt = Date.now();
            swarm.status = 'completed';
            swarm.result = result;
            swarm.completedAt = Date.now();

        } catch (error) {
            run.status = 'failed';
            run.completedAt = Date.now();
            swarm.status = 'failed';

            const errorMessage: AgentMessage = {
                id: this._generateId(),
                agentId: swarm.coordinatorAgentId || 'system',
                type: 'error',
                content: `Swarm execution failed: ${error}`,
                timestamp: Date.now()
            };
            run.messages.push(errorMessage);
        }

        this._isStreaming = false;
        this._sendState();
    }

    private async _executeSwarmRun(swarm: Swarm, run: AgentRun, goal: string): Promise<string> {
        const results: string[] = [];

        // Get coordinator
        const coordinatorId = swarm.coordinatorAgentId || swarm.agents[0]?.agentId;
        const coordinator = this._agents.find(a => a.name === coordinatorId);

        if (!coordinator) {
            throw new Error('No coordinator agent found');
        }

        // Phase 1: Coordinator creates plan
        const planMessage: AgentMessage = {
            id: this._generateId(),
            agentId: coordinatorId,
            type: 'thought',
            content: `Planning: ${goal}`,
            timestamp: Date.now()
        };
        run.messages.push(planMessage);
        this._sendState();

        const planPrompt = `As the coordinator of a multi-agent swarm, create a plan to accomplish this goal:

Goal: ${goal}

Available agents:
${swarm.agents.map(a => {
            const agent = this._agents.find(ag => ag.name === a.agentId);
            return `- ${a.agentId} (${a.role}): ${agent?.description || 'No description'}`;
        }).join('\n')}

Create a step-by-step plan with agent assignments.`;

        const prevAgent = this._selectedAgent;
        this._selectedAgent = coordinatorId;
        const planResponse = await this._getChatResponse(planPrompt);
        this._selectedAgent = prevAgent;

        const planResultMessage: AgentMessage = {
            id: this._generateId(),
            agentId: coordinatorId,
            type: 'result',
            content: planResponse,
            timestamp: Date.now()
        };
        run.messages.push(planResultMessage);
        results.push(`**Coordinator Plan:**\n${planResponse}`);
        this._sendState();

        // Phase 2: Execute with each worker agent
        for (const swarmAgent of swarm.agents) {
            if (swarmAgent.agentId === coordinatorId) continue;

            const agent = this._agents.find(a => a.name === swarmAgent.agentId);
            if (!agent) continue;

            const actionMessage: AgentMessage = {
                id: this._generateId(),
                agentId: swarmAgent.agentId,
                type: 'action',
                content: `Executing task for goal: ${goal}`,
                timestamp: Date.now()
            };
            run.messages.push(actionMessage);
            this._sendState();

            const workerPrompt = `You are ${agent.name}, a ${swarmAgent.role} agent in a multi-agent swarm.

Goal: ${goal}

Coordinator's Plan:
${planResponse}

Your role: ${agent.description}
Your capabilities: ${agent.tools?.join(', ') || 'general'}

Execute your part of the plan and provide your contribution.`;

            this._selectedAgent = swarmAgent.agentId;
            const workerResponse = await this._getChatResponse(workerPrompt);
            this._selectedAgent = prevAgent;

            const workerResultMessage: AgentMessage = {
                id: this._generateId(),
                agentId: swarmAgent.agentId,
                type: 'result',
                content: workerResponse,
                timestamp: Date.now()
            };
            run.messages.push(workerResultMessage);
            results.push(`**${agent.name} (${swarmAgent.role}):**\n${workerResponse}`);

            run.tokensUsed += 100; // Approximate
            this._sendState();
        }

        // Phase 3: Coordinator synthesizes results
        const synthesisMessage: AgentMessage = {
            id: this._generateId(),
            agentId: coordinatorId,
            type: 'thought',
            content: 'Synthesizing agent results...',
            timestamp: Date.now()
        };
        run.messages.push(synthesisMessage);
        this._sendState();

        const synthesisPrompt = `As the coordinator, synthesize the results from all agents:

Goal: ${goal}

Agent Results:
${results.join('\n\n---\n\n')}

Provide a comprehensive final response that combines all contributions.`;

        this._selectedAgent = coordinatorId;
        const finalResponse = await this._getChatResponse(synthesisPrompt);
        this._selectedAgent = prevAgent;

        const finalMessage: AgentMessage = {
            id: this._generateId(),
            agentId: coordinatorId,
            type: 'result',
            content: finalResponse,
            timestamp: Date.now()
        };
        run.messages.push(finalMessage);

        return finalResponse;
    }

    private async _pauseSwarm(swarmId: string) {
        const swarm = this._swarms.find(s => s.id === swarmId);
        if (swarm) {
            swarm.status = 'paused';
            swarm.updatedAt = Date.now();
            if (this._activeRun?.swarmId === swarmId) {
                this._activeRun.status = 'cancelled';
            }
            this._isStreaming = false;
            this._sendState();
            vscode.window.showInformationMessage(`Swarm "${swarm.name}" paused`);
        }
    }

    private async _handleSwarmAction(action: string) {
        if (!this._currentSwarm) {
            // Create a default swarm if none exists
            if (action === 'start') {
                const agentIds = this._agents.slice(0, 3).map(a => a.id).filter((id): id is string => id !== undefined);
                await this._createSwarm('Quick Swarm', 'Auto-created swarm for quick tasks', agentIds);
            }
            return;
        }

        switch (action) {
            case 'start':
            case 'resume':
                const goal = await vscode.window.showInputBox({
                    prompt: 'Enter the goal for this swarm run',
                    placeHolder: 'e.g., Analyze and refactor the authentication module'
                });
                if (goal) {
                    await this._startSwarm(this._currentSwarm.id, goal);
                }
                break;
            case 'pause':
                await this._pauseSwarm(this._currentSwarm.id);
                break;
            case 'cancel':
                if (this._activeRun) {
                    await this._cancelRun(this._activeRun.id);
                }
                break;
        }
    }

    private async _cancelRun(runId: string) {
        if (this._activeRun?.id === runId) {
            this._activeRun.status = 'cancelled';
            this._activeRun.completedAt = Date.now();
            this._isStreaming = false;

            if (this._currentSwarm && this._activeRun.swarmId === this._currentSwarm.id) {
                this._currentSwarm.status = 'paused';
            }

            this._sendState();
            vscode.window.showInformationMessage('Run cancelled');
        }
    }

    private _generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    private _update() {
        this._panel.webview.html = this._getHtmlContent();
    }

    private _getHtmlContent(): string {
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src http://localhost:*;">
    <title>Chasm Chat</title>
    <style>
        :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-sideBar-background);
            --bg-tertiary: var(--vscode-input-background);
            --text-primary: var(--vscode-editor-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --accent: var(--vscode-button-background);
            --accent-hover: var(--vscode-button-hoverBackground);
            --border: var(--vscode-panel-border);
            --user-bg: var(--vscode-textBlockQuote-background);
            --assistant-bg: var(--vscode-editor-inactiveSelectionBackground);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--text-primary);
            background: var(--bg-primary);
            height: 100vh;
            display: flex;
            overflow: hidden;
        }

        /* Sidebar */
        .sidebar {
            width: 280px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }

        .sidebar-header {
            padding: 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .sidebar-header h2 {
            font-size: 14px;
            font-weight: 600;
        }

        .new-chat-btn {
            margin-left: auto;
            background: var(--accent);
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .new-chat-btn:hover {
            background: var(--accent-hover);
        }

        .session-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }

        .session-item {
            padding: 10px 12px;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 4px;
            transition: background 0.15s;
        }

        .session-item:hover {
            background: var(--bg-tertiary);
        }

        .session-item.active {
            background: var(--accent);
            color: white;
        }

        .session-title {
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .session-meta {
            font-size: 11px;
            color: var(--text-secondary);
            margin-top: 2px;
        }

        .session-item.active .session-meta {
            color: rgba(255,255,255,0.7);
        }

        /* Main Chat Area */
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        /* Header */
        .header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--bg-secondary);
        }

        .header select {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
        }

        .header-title {
            flex: 1;
            font-weight: 500;
            font-size: 14px;
        }

        /* Messages Area */
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .message {
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 12px;
            line-height: 1.5;
        }

        .message.user {
            align-self: flex-end;
            background: var(--user-bg);
            border-bottom-right-radius: 4px;
        }

        .message.assistant {
            align-self: flex-start;
            background: var(--assistant-bg);
            border-bottom-left-radius: 4px;
        }

        .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 12px;
            color: var(--text-secondary);
        }

        .message-content {
            white-space: pre-wrap;
            word-break: break-word;
        }

        .message-content pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 8px 0;
        }

        .message-content code {
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
        }

        .message-actions {
            display: flex;
            gap: 8px;
            margin-top: 8px;
            opacity: 0;
            transition: opacity 0.15s;
        }

        .message:hover .message-actions {
            opacity: 1;
        }

        .message-action {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            font-size: 11px;
        }

        .message-action:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
        }

        /* Streaming indicator */
        .streaming {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            color: var(--text-secondary);
        }

        .streaming-dots {
            display: flex;
            gap: 4px;
        }

        .streaming-dots span {
            width: 6px;
            height: 6px;
            background: var(--accent);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out;
        }

        .streaming-dots span:nth-child(1) { animation-delay: -0.32s; }
        .streaming-dots span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        /* Input Area */
        .input-area {
            padding: 16px;
            border-top: 1px solid var(--border);
            background: var(--bg-secondary);
        }

        .input-container {
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }

        .input-wrapper {
            flex: 1;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 8px;
            display: flex;
            align-items: flex-end;
        }

        .input-wrapper:focus-within {
            border-color: var(--accent);
        }

        #message-input {
            flex: 1;
            background: transparent;
            border: none;
            padding: 12px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 14px;
            resize: none;
            max-height: 200px;
            outline: none;
        }

        .send-btn {
            background: var(--accent);
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
        }

        .send-btn:hover {
            background: var(--accent-hover);
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Empty state */
        .empty-state {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            text-align: center;
            padding: 40px;
        }

        .empty-state h3 {
            font-size: 18px;
            margin-bottom: 8px;
            color: var(--text-primary);
        }

        .empty-state p {
            margin-bottom: 20px;
        }

        /* Agent selector */
        .agent-selector {
            display: flex;
            gap: 8px;
            padding: 8px 16px;
            border-bottom: 1px solid var(--border);
            overflow-x: auto;
        }

        .agent-chip {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.15s;
        }

        .agent-chip:hover {
            border-color: var(--accent);
        }

        .agent-chip.active {
            background: var(--accent);
            border-color: var(--accent);
            color: white;
        }

        /* Swarm Section */
        .swarm-section {
            padding: 8px 16px;
            border-bottom: 1px solid var(--border);
            background: var(--bg-tertiary);
        }

        .swarm-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .swarm-title {
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .swarm-status {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            background: var(--bg-secondary);
        }

        .swarm-status.running {
            background: #22c55e20;
            color: #22c55e;
        }

        .swarm-status.paused {
            background: #f59e0b20;
            color: #f59e0b;
        }

        .swarm-agents {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        .swarm-agent {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 10px;
            background: var(--bg-secondary);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .swarm-agent.active {
            background: var(--accent);
            color: white;
        }

        .orchestration-mode {
            display: flex;
            gap: 4px;
            margin-top: 8px;
        }

        .mode-btn {
            font-size: 11px;
            padding: 4px 8px;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--text-secondary);
            border-radius: 4px;
            cursor: pointer;
        }

        .mode-btn:hover {
            border-color: var(--accent);
            color: var(--text-primary);
        }

        .mode-btn.active {
            background: var(--accent);
            border-color: var(--accent);
            color: white;
        }

        /* Task Planning Section */
        .task-section {
            padding: 8px 16px;
            border-bottom: 1px solid var(--border);
            max-height: 150px;
            overflow-y: auto;
            display: none;
        }

        .task-section.visible {
            display: block;
        }

        .task-item {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 6px 0;
            border-bottom: 1px solid var(--border);
            font-size: 12px;
        }

        .task-item:last-child {
            border-bottom: none;
        }

        .task-status-icon {
            flex-shrink: 0;
        }

        .task-status-icon.pending { color: var(--text-secondary); }
        .task-status-icon.in_progress { color: #3b82f6; }
        .task-status-icon.completed { color: #22c55e; }
        .task-status-icon.failed { color: #ef4444; }

        .task-content {
            flex: 1;
        }

        .task-title {
            font-weight: 500;
        }

        .task-agent {
            font-size: 11px;
            color: var(--text-secondary);
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--text-secondary);
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-header">
            <h2>💬 Chats</h2>
            <button class="new-chat-btn" onclick="newSession()">+ New</button>
        </div>
        <div class="session-list" id="session-list">
            <!-- Sessions populated by JS -->
        </div>
    </div>

    <div class="main">
        <div class="header">
            <span class="header-title" id="chat-title">New Chat</span>
            <select id="provider-select" onchange="selectProvider(this.value)">
                <option value="copilot">GitHub Copilot</option>
                <option value="ollama">Ollama</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google AI</option>
            </select>
            <select id="model-select" onchange="selectModel(this.value)">
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
            </select>
            <select id="orchestration-select" onchange="selectOrchestration(this.value)">
                <option value="single">Single Agent</option>
                <option value="sequential">Sequential</option>
                <option value="parallel">Parallel</option>
                <option value="swarm">Swarm</option>
                <option value="debate">Debate</option>
            </select>
        </div>

        <div class="agent-selector" id="agent-selector">
            <div class="agent-chip active" data-agent="" onclick="selectAgent('')">No Agent</div>
            <!-- Agents populated by JS -->
        </div>

        <div class="swarm-section" id="swarm-section" style="display: none;">
            <div class="swarm-header">
                <span class="swarm-title">🐝 Swarm: <span id="swarm-name">Research Team</span></span>
                <span class="swarm-status" id="swarm-status">idle</span>
            </div>
            <div class="swarm-agents" id="swarm-agents">
                <!-- Swarm agents populated by JS -->
            </div>
            <div class="orchestration-mode">
                <button class="mode-btn" onclick="swarmAction('start')">▶ Start</button>
                <button class="mode-btn" onclick="swarmAction('pause')">⏸ Pause</button>
                <button class="mode-btn" onclick="swarmAction('cancel')">⏹ Cancel</button>
            </div>
        </div>

        <div class="task-section" id="task-section">
            <!-- Tasks populated by JS -->
        </div>

        <div class="messages" id="messages">
            <div class="empty-state">
                <h3>Welcome to Chasm Chat</h3>
                <p>Start a conversation with AI. Select a provider, model, and optionally an agent.</p>
            </div>
        </div>

        <div class="input-area">
            <div class="input-container">
                <div class="input-wrapper">
                    <textarea id="message-input" placeholder="Type a message..." rows="1" onkeydown="handleKeyDown(event)"></textarea>
                </div>
                <button class="send-btn" id="send-btn" onclick="sendMessage()">
                    Send →
                </button>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let state = {
            sessions: [],
            currentSession: null,
            providers: [],
            agents: [],
            selectedProvider: 'copilot',
            selectedModel: 'gpt-4o',
            selectedAgent: null,
            selectedOrchestration: 'single',
            currentSwarm: null,
            currentTasks: [],
            isStreaming: false
        };

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'setState':
                    state = { ...state, ...message.state };
                    render();
                    break;
                case 'streamChunk':
                    updateStreamingMessage(message.content);
                    break;
                case 'swarmUpdate':
                    state.currentSwarm = message.swarm;
                    renderSwarm();
                    break;
                case 'taskUpdate':
                    state.currentTasks = message.tasks;
                    renderTasks();
                    break;
            }
        });

        function render() {
            renderSessions();
            renderAgents();
            renderSwarm();
            renderTasks();
            renderMessages();
            updateHeader();
        }

        function renderSessions() {
            const list = document.getElementById('session-list');
            if (state.sessions.length === 0) {
                list.innerHTML = '<div style="padding: 16px; color: var(--text-secondary); text-align: center;">No sessions yet</div>';
                return;
            }

            list.innerHTML = state.sessions.map(session => {
                const isActive = state.currentSession?.id === session.id;
                const date = new Date(session.updatedAt).toLocaleDateString();
                return \`
                    <div class="session-item \${isActive ? 'active' : ''}" onclick="loadSession('\${session.id}')">
                        <div class="session-title">\${escapeHtml(session.title)}</div>
                        <div class="session-meta">\${session.messages.length} messages · \${date}</div>
                    </div>
                \`;
            }).join('');
        }

        function renderAgents() {
            const selector = document.getElementById('agent-selector');
            selector.innerHTML = \`
                <div class="agent-chip \${!state.selectedAgent ? 'active' : ''}" onclick="selectAgent('')">No Agent</div>
                \${state.agents.map(agent => \`
                    <div class="agent-chip \${state.selectedAgent === agent.name ? 'active' : ''}" 
                         onclick="selectAgent('\${agent.name}')" 
                         title="\${escapeHtml(agent.description)}">
                        \${escapeHtml(agent.name)}
                    </div>
                \`).join('')}
            \`;
        }

        function renderSwarm() {
            const section = document.getElementById('swarm-section');
            const isSwarmMode = state.selectedOrchestration === 'swarm' || state.selectedOrchestration === 'parallel';
            
            if (!isSwarmMode || !state.currentSwarm) {
                section.style.display = 'none';
                return;
            }

            section.style.display = 'block';
            document.getElementById('swarm-name').textContent = state.currentSwarm.name || 'Custom Swarm';
            
            const statusEl = document.getElementById('swarm-status');
            statusEl.textContent = state.currentSwarm.status || 'idle';
            statusEl.className = 'swarm-status ' + (state.currentSwarm.status || 'idle');

            const agentsContainer = document.getElementById('swarm-agents');
            agentsContainer.innerHTML = (state.currentSwarm.agents || []).map(agent => \`
                <div class="swarm-agent \${agent.status === 'executing' ? 'active' : ''}">
                    <span>\${getRoleIcon(agent.role)}</span>
                    <span>\${escapeHtml(agent.name)}</span>
                </div>
            \`).join('');
        }

        function renderTasks() {
            const section = document.getElementById('task-section');
            
            if (!state.currentTasks || state.currentTasks.length === 0) {
                section.classList.remove('visible');
                return;
            }

            section.classList.add('visible');
            section.innerHTML = '<div style="font-size: 11px; font-weight: 600; margin-bottom: 8px;">📋 Task Plan</div>' +
                state.currentTasks.map(task => \`
                    <div class="task-item">
                        <span class="task-status-icon \${task.status}">\${getTaskIcon(task.status)}</span>
                        <div class="task-content">
                            <div class="task-title">\${escapeHtml(task.title)}</div>
                            \${task.assignedAgent ? \`<div class="task-agent">→ \${escapeHtml(task.assignedAgent)}</div>\` : ''}
                        </div>
                    </div>
                \`).join('');
        }

        function getRoleIcon(role) {
            const icons = {
                coordinator: '🎯',
                researcher: '🔍',
                coder: '💻',
                reviewer: '✅',
                executor: '⚡',
                writer: '✍️',
                tester: '🧪',
                custom: '🔧'
            };
            return icons[role] || '🤖';
        }

        function getTaskIcon(status) {
            const icons = {
                pending: '○',
                in_progress: '◐',
                completed: '●',
                failed: '✗'
            };
            return icons[status] || '○';
        }

        function renderMessages() {
            const container = document.getElementById('messages');
            
            if (!state.currentSession || state.currentSession.messages.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <h3>Welcome to Chasm Chat</h3>
                        <p>Start a conversation with AI. Select a provider, model, and optionally an agent.</p>
                    </div>
                \`;
                return;
            }

            container.innerHTML = state.currentSession.messages.map(msg => \`
                <div class="message \${msg.role}">
                    <div class="message-header">
                        <span>\${msg.role === 'user' ? '👤 You' : '🤖 Assistant'}</span>
                        \${msg.model ? \`<span>· \${msg.model}</span>\` : ''}
                        \${msg.agentName ? \`<span>· \${msg.agentName}</span>\` : ''}
                    </div>
                    <div class="message-content">\${formatMessage(msg.content)}</div>
                    <div class="message-actions">
                        <button class="message-action" onclick="copyMessage('\${escapeHtml(msg.content.replace(/'/g, "\\\\'"))}')">📋 Copy</button>
                        \${msg.role === 'assistant' ? \`<button class="message-action" onclick="insertCode('\${encodeURIComponent(msg.content)}')">📝 Insert</button>\` : ''}
                    </div>
                </div>
            \`).join('') + (state.isStreaming ? \`
                <div class="streaming">
                    <div class="streaming-dots">
                        <span></span><span></span><span></span>
                    </div>
                    <span>Generating...</span>
                </div>
            \` : '');

            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
        }

        function updateHeader() {
            document.getElementById('chat-title').textContent = 
                state.currentSession?.title || 'New Chat';
            document.getElementById('provider-select').value = state.selectedProvider;
            document.getElementById('model-select').value = state.selectedModel;
        }

        function formatMessage(content) {
            // Escape HTML first
            let html = escapeHtml(content);
            
            // Format code blocks
            html = html.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>');
            html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
            
            // Format links
            html = html.replace(/(https?:\\/\\/[^\\s]+)/g, '<a href="$1" target="_blank">$1</a>');
            
            return html;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function updateStreamingMessage(content) {
            // Update the last assistant message with streamed content
            if (state.currentSession && state.isStreaming) {
                const lastMsg = state.currentSession.messages[state.currentSession.messages.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.content = content;
                    renderMessages();
                }
            }
        }

        function handleKeyDown(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        }

        function sendMessage() {
            const input = document.getElementById('message-input');
            const content = input.value.trim();
            if (!content || state.isStreaming) return;

            vscode.postMessage({ type: 'sendMessage', content });
            input.value = '';
            input.style.height = 'auto';
        }

        function newSession() {
            vscode.postMessage({ type: 'newSession' });
        }

        function loadSession(sessionId) {
            vscode.postMessage({ type: 'loadSession', sessionId });
        }

        function selectProvider(provider) {
            vscode.postMessage({ type: 'selectProvider', provider });
        }

        function selectModel(model) {
            vscode.postMessage({ type: 'selectModel', model });
        }

        function selectAgent(agent) {
            vscode.postMessage({ type: 'selectAgent', agent: agent || null });
        }

        function selectOrchestration(mode) {
            state.selectedOrchestration = mode;
            vscode.postMessage({ type: 'selectOrchestration', mode });
            renderSwarm();
            renderTasks();
        }

        function swarmAction(action) {
            vscode.postMessage({ type: 'swarmAction', action });
        }

        function copyMessage(content) {
            vscode.postMessage({ type: 'copyMessage', content: decodeURIComponent(content) });
        }

        function insertCode(encodedContent) {
            vscode.postMessage({ type: 'insertCode', code: decodeURIComponent(encodedContent) });
        }

        // Auto-resize textarea
        document.getElementById('message-input').addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        });
    </script>
</body>
</html>`;
    }

    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public dispose() {
        ChasmChatPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}


