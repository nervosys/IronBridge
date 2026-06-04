// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Chasm Session Tree View Provider
// Displays chat sessions for a selected workspace

import * as vscode from 'vscode';
import { ChasmExecutor, SessionInfo } from './chasmExecutor';

export class SessionItem extends vscode.TreeItem {
    constructor(
        public readonly sessionInfo: SessionInfo,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(sessionInfo.sessionFile, collapsibleState);

        this.tooltip = `Session: ${sessionInfo.sessionFile}\nLast Modified: ${sessionInfo.lastModified}\nMessages: ${sessionInfo.messages}`;

        if (sessionInfo.messages === 0) {
            this.description = 'empty';
            this.iconPath = new vscode.ThemeIcon('circle-slash');
        } else {
            this.description = `${sessionInfo.messages} messages`;

            // Set icon based on message count
            if (sessionInfo.messages > 100) {
                this.iconPath = new vscode.ThemeIcon('comment-discussion');
            } else if (sessionInfo.messages > 10) {
                this.iconPath = new vscode.ThemeIcon('comment');
            } else {
                this.iconPath = new vscode.ThemeIcon('comment-draft');
            }
        }

        this.contextValue = 'session';

        // Click handler - open session details
        this.command = {
            command: 'chasm.selectSession',
            title: 'Select Session',
            arguments: [this]
        };
    }
}

export class SessionProvider implements vscode.TreeDataProvider<SessionItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SessionItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private currentWorkspacePath?: string;
    private sessions: SessionInfo[] = [];
    private outputChannel?: vscode.OutputChannel;

    constructor(private executor: ChasmExecutor, outputChannel?: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    private log(message: string): void {
        this.outputChannel?.appendLine(`[SessionProvider] ${message}`);
    }

    refresh(): void {
        this.log(`Refreshing sessions for: ${this.currentWorkspacePath || 'none'}`);
        this._onDidChangeTreeData.fire();
    }

    setWorkspacePath(path: string | undefined): void {
        this.log(`Setting workspace path: ${path}`);
        this.currentWorkspacePath = path;
        this.refresh();
    }

    getWorkspacePath(): string | undefined {
        return this.currentWorkspacePath;
    }

    getTreeItem(element: SessionItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SessionItem): Promise<SessionItem[]> {
        if (element) {
            // No children for session items
            return [];
        }

        if (!this.currentWorkspacePath) {
            this.log('No workspace path set, returning empty');
            return [];
        }

        this.log(`Fetching sessions for: ${this.currentWorkspacePath}`);

        // Fetch sessions for current workspace
        const result = await this.executor.listSessions(this.currentWorkspacePath);

        this.log(`listSessions result: success=${result.success}, output length=${result.output?.length || 0}`);

        if (!result.success) {
            // Don't show error for empty results
            if (result.error?.includes('No chat sessions')) {
                this.log('No chat sessions found');
                return [];
            }
            this.log(`Error: ${result.error}`);
            vscode.window.showErrorMessage(`Failed to list sessions: ${result.error}`);
            return [];
        }

        this.sessions = this.executor.parseSessionList(result.output);
        this.log(`Parsed ${this.sessions.length} sessions`);

        return this.sessions.map(
            (session) => new SessionItem(session, vscode.TreeItemCollapsibleState.None)
        );
    }

    getParent(): vscode.ProviderResult<SessionItem> {
        return null;
    }
}

