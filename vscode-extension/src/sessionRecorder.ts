// =============================================================================
// CSM Session Recorder
// =============================================================================
// Real-time session recording to prevent data loss from crashes
// Watches chat sessions from multiple providers (VS Code, Cursor, Continue.dev, etc.)
// and sends events to csm-rust backend

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CsmApiClient, RecordingEventPayload, RecordedMessagePayload } from './apiClient';

// =============================================================================
// Provider Configuration
// =============================================================================

/**
 * Supported chat providers for recording
 */
export type ChatProvider = 
    | 'vscode'      // VS Code GitHub Copilot
    | 'cursor'      // Cursor IDE
    | 'continuedev' // Continue.dev extension
    | 'claude-code' // Claude Code (Anthropic)
    | 'opencode'    // OpenCode
    | 'openclaw'    // OpenClaw
    | 'antigravity' // Antigravity
    | 'windsurf'    // Codeium Windsurf
    | 'zed'         // Zed Editor
    | 'codespaces'; // GitHub Codespaces

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
    /** Provider identifier */
    provider: ChatProvider;
    /** Display name */
    displayName: string;
    /** Whether this provider is enabled for recording */
    enabled: boolean;
    /** Base application data folder name */
    appDataFolder: string;
    /** Session storage subdirectory pattern (relative to workspaceStorage) */
    sessionSubdir: string;
    /** File extensions to watch */
    fileExtensions: string[];
    /** Session file format */
    format: 'json' | 'jsonl' | 'sqlite';
    /** Whether sessions are per-workspace or global */
    perWorkspace: boolean;
}

/**
 * Default provider configurations
 */
export const DEFAULT_PROVIDER_CONFIGS: ProviderConfig[] = [
    {
        provider: 'vscode',
        displayName: 'VS Code Copilot',
        enabled: true,
        appDataFolder: 'Code',
        sessionSubdir: 'chatSessions',
        fileExtensions: ['.json', '.jsonl'],
        format: 'jsonl',
        perWorkspace: true,
    },
    {
        provider: 'cursor',
        displayName: 'Cursor',
        enabled: true,
        appDataFolder: 'Cursor',
        sessionSubdir: 'chatSessions',
        fileExtensions: ['.json', '.jsonl'],
        format: 'json',
        perWorkspace: true,
    },
    {
        provider: 'continuedev',
        displayName: 'Continue.dev',
        enabled: true,
        appDataFolder: 'continue',
        sessionSubdir: 'sessions',
        fileExtensions: ['.json'],
        format: 'json',
        perWorkspace: false,
    },
    {
        provider: 'claude-code',
        displayName: 'Claude Code',
        enabled: true,
        appDataFolder: 'claude-code',
        sessionSubdir: 'sessions',
        fileExtensions: ['.json', '.jsonl'],
        format: 'jsonl',
        perWorkspace: true,
    },
    {
        provider: 'opencode',
        displayName: 'OpenCode',
        enabled: true,
        appDataFolder: 'opencode',
        sessionSubdir: 'conversations',
        fileExtensions: ['.json'],
        format: 'json',
        perWorkspace: true,
    },
    {
        provider: 'openclaw',
        displayName: 'OpenClaw',
        enabled: true,
        appDataFolder: 'openclaw',
        sessionSubdir: 'chat-history',
        fileExtensions: ['.json'],
        format: 'json',
        perWorkspace: true,
    },
    {
        provider: 'antigravity',
        displayName: 'Antigravity',
        enabled: true,
        appDataFolder: 'antigravity',
        sessionSubdir: 'sessions',
        fileExtensions: ['.json'],
        format: 'json',
        perWorkspace: true,
    },
    {
        provider: 'windsurf',
        displayName: 'Windsurf',
        enabled: true,
        appDataFolder: 'Windsurf',
        sessionSubdir: 'chatSessions',
        fileExtensions: ['.json', '.jsonl'],
        format: 'json',
        perWorkspace: true,
    },
    {
        provider: 'zed',
        displayName: 'Zed',
        enabled: true,
        appDataFolder: 'Zed',
        sessionSubdir: 'conversations',
        fileExtensions: ['.json'],
        format: 'json',
        perWorkspace: false,
    },
    {
        provider: 'codespaces',
        displayName: 'GitHub Codespaces',
        enabled: true,
        appDataFolder: 'Code',
        sessionSubdir: 'chatSessions',
        fileExtensions: ['.json', '.jsonl'],
        format: 'jsonl',
        perWorkspace: true,
    },
];

// =============================================================================
// Types
// =============================================================================

// These interfaces use snake_case to match the Rust API exactly
/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Recording event types (must match csm-rust/src/api/recording.rs)
 */
export interface RecordingEvent {
    type: RecordingEventType;
    session_id: string;
    [key: string]: unknown;
}

export type RecordingEventType =
    | 'session_start'
    | 'session_end'
    | 'message_add'
    | 'message_update'
    | 'message_append'
    | 'session_update'
    | 'heartbeat'
    | 'session_snapshot';

export interface SessionStartEvent extends RecordingEvent {
    type: 'session_start';
    workspace_id?: string;
    workspace_path?: string;
    provider: string;
    title?: string;
    model?: string;
    metadata?: Record<string, unknown>;
}

export interface SessionEndEvent extends RecordingEvent {
    type: 'session_end';
    final_message_count?: number;
}

export interface MessageAddEvent extends RecordingEvent {
    type: 'message_add';
    message_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string;
    parent_id?: string;
    metadata?: Record<string, unknown>;
}

export interface MessageUpdateEvent extends RecordingEvent {
    type: 'message_update';
    message_id: string;
    content: string;
    is_complete: boolean;
}

export interface MessageAppendEvent extends RecordingEvent {
    type: 'message_append';
    message_id: string;
    content_delta: string;
}

export interface SessionSnapshotEvent extends RecordingEvent {
    type: 'session_snapshot';
    provider: string;
    workspace_path?: string;
    title?: string;
    messages: RecordedMessagePayload[];
    metadata?: Record<string, unknown>;
}

export interface RecordingResponse {
    type: 'ack' | 'error' | 'recovery';
    event_id?: string;
    session_id?: string;
    status?: string;
    code?: string;
    message?: string;
}

/* eslint-enable @typescript-eslint/naming-convention */

// =============================================================================
// Session File Watcher
// =============================================================================

/**
 * Watches VS Code chat session directory for changes
 */
export class SessionFileWatcher {
    private _watcher?: fs.FSWatcher;
    private _sessionPath: string;
    private _knownSessions: Map<string, SessionFileState> = new Map();
    private _outputChannel: vscode.OutputChannel;
    private _onSessionChange: vscode.EventEmitter<SessionChangeEvent> = new vscode.EventEmitter();

    public readonly onSessionChange = this._onSessionChange.event;

    constructor(sessionPath: string, outputChannel: vscode.OutputChannel) {
        this._sessionPath = sessionPath;
        this._outputChannel = outputChannel;
    }

    private log(message: string): void {
        this._outputChannel.appendLine(`[SessionWatcher] ${message}`);
    }

    /**
     * Start watching the session directory
     */
    start(): void {
        if (this._watcher) {
            this.stop();
        }

        if (!fs.existsSync(this._sessionPath)) {
            this.log(`Session path does not exist: ${this._sessionPath}`);
            return;
        }

        this.log(`Starting watcher on: ${this._sessionPath}`);

        // Initial scan
        this.scanDirectory();

        // Watch for changes
        this._watcher = fs.watch(this._sessionPath, { persistent: true }, (eventType, filename) => {
            if (filename && (filename.endsWith('.json') || filename.endsWith('.jsonl'))) {
                this.handleFileChange(eventType, filename);
            }
        });

        this._watcher.on('error', (err) => {
            this.log(`Watcher error: ${err.message}`);
        });
    }

    /**
     * Stop watching
     */
    stop(): void {
        if (this._watcher) {
            this._watcher.close();
            this._watcher = undefined;
            this.log('Watcher stopped');
        }
    }

    /**
     * Scan directory for existing sessions
     */
    private scanDirectory(): void {
        try {
            const files = fs.readdirSync(this._sessionPath);
            for (const file of files) {
                if (file.endsWith('.json') || file.endsWith('.jsonl')) {
                    const filePath = path.join(this._sessionPath, file);
                    this.updateSessionState(file, filePath);
                }
            }
            this.log(`Scanned ${this._knownSessions.size} sessions`);
        } catch (err) {
            this.log(`Scan error: ${(err as Error).message}`);
        }
    }

    /**
     * Handle file change event
     */
    private handleFileChange(eventType: string, filename: string): void {
        const filePath = path.join(this._sessionPath, filename);

        if (eventType === 'rename') {
            // File added or removed
            if (fs.existsSync(filePath)) {
                this.log(`Session file added: ${filename}`);
                this.updateSessionState(filename, filePath);
                this._onSessionChange.fire({
                    type: 'created',
                    filename,
                    filePath,
                });
            } else {
                this.log(`Session file removed: ${filename}`);
                this._knownSessions.delete(filename);
                this._onSessionChange.fire({
                    type: 'deleted',
                    filename,
                    filePath,
                });
            }
        } else if (eventType === 'change') {
            // File modified
            this.log(`Session file modified: ${filename}`);
            const prev = this._knownSessions.get(filename);
            this.updateSessionState(filename, filePath);
            const curr = this._knownSessions.get(filename);

            this._onSessionChange.fire({
                type: 'modified',
                filename,
                filePath,
                previousSize: prev?.size,
                currentSize: curr?.size,
            });
        }
    }

    /**
     * Update tracked state for a session file
     */
    private updateSessionState(filename: string, filePath: string): void {
        try {
            const stats = fs.statSync(filePath);
            this._knownSessions.set(filename, {
                filename,
                filePath,
                size: stats.size,
                mtime: stats.mtimeMs,
            });
        } catch (err) {
            // File may have been deleted
        }
    }

    dispose(): void {
        this.stop();
        this._onSessionChange.dispose();
    }
}

interface SessionFileState {
    filename: string;
    filePath: string;
    size: number;
    mtime: number;
}

interface SessionChangeEvent {
    type: 'created' | 'modified' | 'deleted';
    filename: string;
    filePath: string;
    previousSize?: number;
    currentSize?: number;
}

// =============================================================================
// Session Recorder
// =============================================================================

/**
 * Records VS Code chat sessions in real-time to csm-rust backend
 */
export class SessionRecorder {
    private _apiClient: CsmApiClient;
    private _watchers: Map<string, SessionFileWatcher> = new Map();
    private _eventBuffer: RecordingEvent[] = [];
    private _flushTimer?: NodeJS.Timeout;
    private _outputChannel: vscode.OutputChannel;
    private _isConnected = false;
    private _heartbeatTimer?: NodeJS.Timeout;
    private _disposables: vscode.Disposable[] = [];

    // Configuration
    private _config = {
        flushIntervalMs: 1000,
        maxBufferSize: 100,
        heartbeatIntervalMs: 30000,
        autoStart: true,
    };

    constructor(apiClient: CsmApiClient, outputChannel: vscode.OutputChannel) {
        this._apiClient = apiClient;
        this._outputChannel = outputChannel;
    }

    private log(message: string): void {
        this._outputChannel.appendLine(`[SessionRecorder] ${message}`);
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /**
     * Start recording sessions
     */
    async start(): Promise<void> {
        this.log('Starting session recorder');

        // Start flush timer
        this._flushTimer = setInterval(() => {
            this.flushEvents().catch(err => {
                this.log(`Flush error: ${err.message}`);
            });
        }, this._config.flushIntervalMs);

        // Start heartbeat
        this._heartbeatTimer = setInterval(() => {
            this.sendHeartbeat().catch(err => {
                this.log(`Heartbeat error: ${err.message}`);
            });
        }, this._config.heartbeatIntervalMs);

        // Check connection
        await this.checkConnection();

        // Watch default VS Code session directories
        await this.watchDefaultPaths();
    }

    /**
     * Stop recording
     */
    stop(): void {
        this.log('Stopping session recorder');

        // Flush remaining events
        this.flushEvents().catch(() => {});

        // Stop timers
        if (this._flushTimer) {
            clearInterval(this._flushTimer);
            this._flushTimer = undefined;
        }
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = undefined;
        }

        // Stop watchers
        for (const watcher of this._watchers.values()) {
            watcher.dispose();
        }
        this._watchers.clear();

        // Dispose subscriptions
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
        this._disposables = [];
    }

    // =========================================================================
    // Watching
    // =========================================================================

    /**
     * Watch session paths for all enabled providers
     */
    private async watchDefaultPaths(): Promise<void> {
        const config = vscode.workspace.getConfiguration('csm');
        const enabledProviders = config.get<string[]>('recording.providers', ['vscode', 'cursor']);

        for (const providerConfig of DEFAULT_PROVIDER_CONFIGS) {
            if (!enabledProviders.includes(providerConfig.provider)) {
                continue;
            }

            if (!providerConfig.enabled) {
                continue;
            }

            await this.watchProviderPaths(providerConfig);
        }
    }

    /**
     * Watch session paths for a specific provider
     */
    private async watchProviderPaths(providerConfig: ProviderConfig): Promise<void> {
        const storagePath = this.getProviderStoragePath(providerConfig);
        if (!storagePath) {
            this.log(`Could not determine storage path for ${providerConfig.displayName}`);
            return;
        }

        if (providerConfig.perWorkspace) {
            // Per-workspace storage (VS Code, Cursor, etc.)
            const workspaceStoragePath = path.join(storagePath, 'User', 'workspaceStorage');
            if (!fs.existsSync(workspaceStoragePath)) {
                this.log(`Workspace storage not found for ${providerConfig.displayName}: ${workspaceStoragePath}`);
                return;
            }

            try {
                const dirs = fs.readdirSync(workspaceStoragePath);
                let watchCount = 0;
                for (const dir of dirs) {
                    const sessionPath = path.join(workspaceStoragePath, dir, providerConfig.sessionSubdir);
                    if (fs.existsSync(sessionPath)) {
                        this.watchPath(sessionPath, providerConfig.provider);
                        watchCount++;
                    }
                }
                this.log(`${providerConfig.displayName}: watching ${watchCount} workspace(s)`);
            } catch (err) {
                this.log(`Error scanning ${providerConfig.displayName} workspace storage: ${(err as Error).message}`);
            }
        } else {
            // Global storage (Continue.dev, Zed, etc.)
            const sessionPath = path.join(storagePath, providerConfig.sessionSubdir);
            if (fs.existsSync(sessionPath)) {
                this.watchPath(sessionPath, providerConfig.provider);
                this.log(`${providerConfig.displayName}: watching global sessions`);
            } else {
                this.log(`${providerConfig.displayName}: session path not found: ${sessionPath}`);
            }
        }
    }

    /**
     * Get application data path for a provider
     */
    private getProviderStoragePath(providerConfig: ProviderConfig): string | undefined {
        const platform = process.platform;

        if (platform === 'win32') {
            // Windows: %APPDATA% or %LOCALAPPDATA%
            const appData = process.env.APPDATA;
            if (!appData) {
                return undefined;
            }

            // Special cases for different providers
            switch (providerConfig.provider) {
                case 'continuedev':
                    // Continue stores in user home directory
                    return process.env.USERPROFILE 
                        ? path.join(process.env.USERPROFILE, '.continue')
                        : undefined;
                case 'zed':
                    // Zed on Windows uses Local AppData
                    return process.env.LOCALAPPDATA
                        ? path.join(process.env.LOCALAPPDATA, providerConfig.appDataFolder)
                        : undefined;
                default:
                    return path.join(appData, providerConfig.appDataFolder);
            }
        } else if (platform === 'darwin') {
            // macOS: ~/Library/Application Support
            const home = process.env.HOME;
            if (!home) {
                return undefined;
            }

            switch (providerConfig.provider) {
                case 'continuedev':
                    return path.join(home, '.continue');
                case 'zed':
                    return path.join(home, '.config', 'zed');
                default:
                    return path.join(home, 'Library', 'Application Support', providerConfig.appDataFolder);
            }
        } else {
            // Linux: ~/.config
            const home = process.env.HOME;
            if (!home) {
                return undefined;
            }

            switch (providerConfig.provider) {
                case 'continuedev':
                    return path.join(home, '.continue');
                case 'vscode':
                case 'codespaces':
                    return path.join(home, '.config', 'Code');
                default:
                    return path.join(home, '.config', providerConfig.appDataFolder.toLowerCase());
            }
        }
    }

    /**
     * Watch a specific session directory
     */
    watchPath(sessionPath: string, provider: ChatProvider = 'vscode'): void {
        if (this._watchers.has(sessionPath)) {
            return;
        }

        const watcher = new SessionFileWatcher(sessionPath, this._outputChannel);

        // Handle session changes
        const subscription = watcher.onSessionChange(event => {
            this.handleSessionChange(event, sessionPath, provider);
        });
        this._disposables.push(subscription);

        watcher.start();
        this._watchers.set(sessionPath, watcher);

        this.log(`Watching [${provider}]: ${sessionPath}`);
    }

    /**
     * Handle session file change
     */
    private handleSessionChange(event: SessionChangeEvent, _basePath: string, provider: ChatProvider = 'vscode'): void {
        const sessionId = this.getSessionIdFromFilename(event.filename);

        if (event.type === 'created') {
            // New session - send snapshot
            this.sendSessionSnapshot(event.filePath, sessionId, provider);
        } else if (event.type === 'modified') {
            // Session updated - check for new messages
            this.sendSessionUpdate(event.filePath, sessionId, provider);
        } else if (event.type === 'deleted') {
            // Session ended
            /* eslint-disable @typescript-eslint/naming-convention */
            this.queueEvent({
                type: 'session_end',
                session_id: sessionId,
            });
            /* eslint-enable @typescript-eslint/naming-convention */
        }
    }

    /**
     * Extract session ID from filename
     */
    private getSessionIdFromFilename(filename: string): string {
        // Remove extension (.json or .jsonl)
        return filename.replace(/\.(json|jsonl)$/, '');
    }

    // =========================================================================
    // Session Data
    // =========================================================================

    /**
     * Send full session snapshot
     */
    private async sendSessionSnapshot(filePath: string, sessionId: string, provider: ChatProvider = 'vscode'): Promise<void> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const session = this.parseSessionFile(content, filePath);

            if (!session) {
                return;
            }

            /* eslint-disable @typescript-eslint/naming-convention */
            const event: SessionSnapshotEvent = {
                type: 'session_snapshot',
                session_id: sessionId,
                provider: provider,
                workspace_path: this.extractWorkspacePath(filePath),
                title: session.title,
                messages: session.messages.map((msg, idx) => ({
                    message_id: msg.id || `${sessionId}-${idx}`,
                    role: msg.role,
                    content: msg.content,
                    model: msg.model,
                    created_at: msg.timestamp || Date.now(),
                })),
            };
            /* eslint-enable @typescript-eslint/naming-convention */

            this.queueEvent(event);
            this.log(`Queued snapshot for session: ${sessionId} [${provider}]`);
        } catch (err) {
            this.log(`Error reading session: ${(err as Error).message}`);
        }
    }

    /**
     * Send session update (delta)
     */
    private async sendSessionUpdate(filePath: string, sessionId: string, provider: ChatProvider = 'vscode'): Promise<void> {
        // For now, send a full snapshot on update
        // Future: implement diff tracking
        await this.sendSessionSnapshot(filePath, sessionId, provider);
    }

    /**
     * Parse session file content (JSON or JSONL)
     */
    private parseSessionFile(content: string, filePath: string): ParsedSession | null {
        const isJsonl = filePath.endsWith('.jsonl');

        try {
            if (isJsonl) {
                return this.parseJsonlSession(content);
            } else {
                return this.parseJsonSession(content);
            }
        } catch (err) {
            this.log(`Parse error for ${filePath}: ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Parse JSON format session
     */
    private parseJsonSession(content: string): ParsedSession {
        const data = JSON.parse(content);
        const messages: ParsedMessage[] = [];

        // Handle different session formats
        if (data.requests) {
            // VS Code format
            for (const req of data.requests) {
                if (req.message?.text) {
                    messages.push({
                        id: req.message.id,
                        role: 'user',
                        content: req.message.text,
                        timestamp: req.message.timestamp,
                    });
                }
                if (req.response) {
                    const responseText = this.extractResponseText(req.response);
                    if (responseText) {
                        messages.push({
                            id: req.response.id,
                            role: 'assistant',
                            content: responseText,
                            model: req.response.model,
                            timestamp: req.response.timestamp,
                        });
                    }
                }
            }
        } else if (data.messages) {
            // Standard chat format
            for (const msg of data.messages) {
                messages.push({
                    id: msg.id,
                    role: msg.role || 'user',
                    content: msg.content || msg.text || '',
                    model: msg.model,
                    timestamp: msg.timestamp || msg.created_at,
                });
            }
        }

        return {
            title: data.customTitle || data.title,
            messages,
        };
    }

    /**
     * Parse JSONL format session (VS Code 1.109+)
     */
    private parseJsonlSession(content: string): ParsedSession {
        const messages: ParsedMessage[] = [];
        let title: string | undefined;

        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
            try {
                const event = JSON.parse(line);

                if (event.type === 'request' && event.message?.text) {
                    messages.push({
                        id: event.message.id || event.id,
                        role: 'user',
                        content: event.message.text,
                        timestamp: event.timestamp,
                    });
                } else if (event.type === 'response') {
                    const responseText = this.extractResponseText(event);
                    if (responseText) {
                        messages.push({
                            id: event.id,
                            role: 'assistant',
                            content: responseText,
                            model: event.model,
                            timestamp: event.timestamp,
                        });
                    }
                } else if (event.type === 'title' || event.customTitle) {
                    title = event.title || event.customTitle;
                }
            } catch {
                // Skip malformed lines
            }
        }

        return { title, messages };
    }

    /**
     * Extract text from response object
     */
    private extractResponseText(response: unknown): string {
        if (!response || typeof response !== 'object') {
            return '';
        }

        const resp = response as Record<string, unknown>;

        // Try different response formats
        if (typeof resp.text === 'string') {
            return resp.text;
        }

        if (resp.value && typeof (resp.value as Record<string, unknown>).text === 'string') {
            return (resp.value as Record<string, unknown>).text as string;
        }

        if (Array.isArray(resp.parts)) {
            return (resp.parts as Array<Record<string, unknown>>)
                .map(p => {
                    if (typeof p === 'string') {
                        return p;
                    }
                    if (p.text) {
                        return p.text;
                    }
                    if (p.value) {
                        return String(p.value);
                    }
                    return '';
                })
                .join('');
        }

        return '';
    }

    /**
     * Extract workspace path from session file path
     */
    private extractWorkspacePath(filePath: string): string | undefined {
        // Path format: .../workspaceStorage/<hash>/chatSessions/<session>.json
        // The workspace info is in state.vscdb in the same parent directory
        return path.dirname(path.dirname(filePath));
    }

    // =========================================================================
    // Event Queue
    // =========================================================================

    /**
     * Queue event for sending
     */
    queueEvent(event: RecordingEvent): void {
        this._eventBuffer.push(event);

        // Flush if buffer is full
        if (this._eventBuffer.length >= this._config.maxBufferSize) {
            this.flushEvents().catch(err => {
                this.log(`Flush error: ${err.message}`);
            });
        }
    }

    /**
     * Flush queued events to backend
     */
    async flushEvents(): Promise<void> {
        if (this._eventBuffer.length === 0) {
            return;
        }

        if (!this._isConnected) {
            // Buffer events when disconnected
            return;
        }

        const events = this._eventBuffer.splice(0, this._eventBuffer.length);

        try {
            const response = await this._apiClient.recording.sendEvents(events as RecordingEventPayload[]);

            if (response.success) {
                this.log(`Flushed ${events.length} events`);
            } else {
                // Put events back in buffer
                this._eventBuffer.unshift(...events);
                this.log(`Flush failed: ${response.error?.message}`);
            }
        } catch (err) {
            // Put events back in buffer
            this._eventBuffer.unshift(...events);
            this.log(`Flush error: ${(err as Error).message}`);
        }
    }

    // =========================================================================
    // Connection
    // =========================================================================

    /**
     * Check connection to backend
     */
    private async checkConnection(): Promise<void> {
        try {
            const response = await this._apiClient.recording.status();
            this._isConnected = response.success;
            this.log(`Connection status: ${this._isConnected ? 'connected' : 'disconnected'}`);
        } catch {
            this._isConnected = false;
        }
    }

    /**
     * Send heartbeat
     */
    private async sendHeartbeat(): Promise<void> {
        if (!this._isConnected) {
            await this.checkConnection();
            return;
        }

        /* eslint-disable @typescript-eslint/naming-convention */
        this.queueEvent({
            type: 'heartbeat',
            session_id: '',
            timestamp: Date.now(),
        });
        /* eslint-enable @typescript-eslint/naming-convention */
    }

    // =========================================================================
    // Accessors
    // =========================================================================

    get isConnected(): boolean {
        return this._isConnected;
    }

    get bufferSize(): number {
        return this._eventBuffer.length;
    }

    get watchedPaths(): string[] {
        return Array.from(this._watchers.keys());
    }

    dispose(): void {
        this.stop();
    }
}

// =============================================================================
// Types
// =============================================================================

interface ParsedSession {
    title?: string;
    messages: ParsedMessage[];
}

interface ParsedMessage {
    id?: string;
    role: 'user' | 'assistant' | 'system' | string;
    content: string;
    model?: string;
    timestamp?: number;
}
