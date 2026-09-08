// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// IronBridge Workspace Tree View Provider
// Displays chat workspaces in a tree view

import * as vscode from 'vscode';
import { IronBridgeExecutor, WorkspaceInfo } from './ironbridgeExecutor';

export class WorkspaceItem extends vscode.TreeItem {
    constructor(
        public readonly workspaceInfo: WorkspaceInfo,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(workspaceInfo.projectPath, collapsibleState);

        this.tooltip = `${workspaceInfo.projectPath}\nHash: ${workspaceInfo.hash}\nSessions: ${workspaceInfo.sessions}\nHas Chats: ${workspaceInfo.hasChats}`;
        this.description = `${workspaceInfo.sessions} sessions`;

        // Set icon based on whether workspace has chats
        this.iconPath = workspaceInfo.hasChats
            ? new vscode.ThemeIcon('folder-active')
            : new vscode.ThemeIcon('folder');

        // Context value for conditional commands
        this.contextValue = workspaceInfo.hasChats ? 'workspaceWithChats' : 'workspace';

        // Click handler - show sessions for this workspace
        this.command = {
            command: 'ironbridge.selectWorkspace',
            title: 'Select Workspace',
            arguments: [this]
        };
    }

    get projectPath(): string {
        return this.workspaceInfo.projectPath;
    }

    get hash(): string {
        return this.workspaceInfo.hash;
    }
}

export class WorkspaceProvider implements vscode.TreeDataProvider<WorkspaceItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<WorkspaceItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private workspaces: WorkspaceInfo[] = [];
    private filter: string = '';
    private selectedWorkspace?: WorkspaceInfo;

    constructor(private executor: IronBridgeExecutor) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setFilter(pattern: string): void {
        this.filter = pattern.toLowerCase();
        this.refresh();
    }

    clearFilter(): void {
        this.filter = '';
        this.refresh();
    }

    getSelectedWorkspace(): WorkspaceInfo | undefined {
        return this.selectedWorkspace;
    }

    setSelectedWorkspace(workspace: WorkspaceInfo | undefined): void {
        this.selectedWorkspace = workspace;
    }

    getTreeItem(element: WorkspaceItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WorkspaceItem): Promise<WorkspaceItem[]> {
        if (element) {
            // No children for workspace items
            return [];
        }

        // Root level - fetch workspaces (filtered or all)
        let result;
        if (this.filter) {
            result = await this.executor.findWorkspace(this.filter);
        } else {
            result = await this.executor.listWorkspaces();
        }

        if (!result.success) {
            vscode.window.showErrorMessage(`Failed to list workspaces: ${result.error}`);
            return [];
        }

        this.workspaces = this.executor.parseWorkspaceList(result.output);

        return this.workspaces.map(
            (workspace) => new WorkspaceItem(workspace, vscode.TreeItemCollapsibleState.None)
        );
    }

    getParent(): vscode.ProviderResult<WorkspaceItem> {
        return null;
    }
}

