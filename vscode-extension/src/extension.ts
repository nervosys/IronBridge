// CSM VS Code Extension - Main Entry Point
// GUI interface for Chat System Manager

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CsmExecutor } from './csmExecutor';
import { WorkspaceProvider, WorkspaceItem } from './workspaceProvider';
import { SessionProvider } from './sessionProvider';
import { CsmChatPanel } from './chatPanel';

let executor: CsmExecutor;
let workspaceProvider: WorkspaceProvider;
let sessionProvider: SessionProvider;
let outputChannel: vscode.OutputChannel;

/**
 * Extract text content from a chat message (handles various formats)
 */
function extractMessageText(msg: any): string {
    if (typeof msg === 'string') {
        return msg;
    }
    if (msg?.text) {
        return msg.text;
    }
    if (msg?.value) {
        return msg.value;
    }
    if (msg?.message) {
        return extractMessageText(msg.message);
    }
    return JSON.stringify(msg);
}

/**
 * Build markdown content from session data
 */
function buildSessionMarkdown(sessionData: any, pureSessionId: string): string {
    const requests = sessionData.requests || [];
    let markdown = `# Chat Session\n\n`;
    markdown += `**Session ID:** \`${pureSessionId}\`\n\n`;
    markdown += `**Messages:** ${requests.length}\n\n`;
    markdown += `---\n\n`;

    for (const req of requests) {
        // User message
        const userMsg = extractMessageText(req.message || req.text || req);
        markdown += `## 💬 User\n\n${userMsg}\n\n`;

        // Assistant response
        if (req.response) {
            let responseText = '';
            if (Array.isArray(req.response)) {
                responseText = req.response.map((r: any) => extractMessageText(r.value || r)).join('\n\n');
            } else if (req.response.value) {
                if (Array.isArray(req.response.value)) {
                    responseText = req.response.value.map((v: any) => extractMessageText(v.value || v)).join('\n\n');
                } else {
                    responseText = extractMessageText(req.response.value);
                }
            } else {
                responseText = extractMessageText(req.response);
            }
            markdown += `## 🤖 Assistant\n\n${responseText}\n\n`;
        }

        markdown += `---\n\n`;
    }
    return markdown;
}

/**
 * Opens a chat session with a quick pick menu for actions.
 * Since VS Code's chat session loading API is internal-only, we offer
 * various ways to interact with the session data.
 */
async function openChatSession(sessionId: string, output: vscode.OutputChannel): Promise<void> {
    // Strip .json extension if present
    const pureSessionId = sessionId.replace(/\.json$/i, '');
    const shortId = pureSessionId.substring(0, 8);

    // Find the session file
    let sessionData: any = null;
    let foundSessionPath = '';

    try {
        const appDataPath = process.env.APPDATA || '';
        const workspaceStoragePath = path.join(appDataPath, 'Code', 'User', 'workspaceStorage');

        if (fs.existsSync(workspaceStoragePath)) {
            const workspaceDirs = fs.readdirSync(workspaceStoragePath);
            for (const wsDir of workspaceDirs) {
                const sessionFile = path.join(workspaceStoragePath, wsDir, 'chatSessions', `${pureSessionId}.json`);
                if (fs.existsSync(sessionFile)) {
                    foundSessionPath = sessionFile;
                    sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
                    break;
                }
            }
        }
    } catch (e) {
        output.appendLine(`Error finding session: ${e}`);
    }

    if (!sessionData) {
        vscode.window.showErrorMessage(`Session not found: ${shortId}...`);
        return;
    }

    const requests = sessionData.requests || [];
    const firstMsg = requests[0] ? extractMessageText(requests[0].message || requests[0].text || requests[0]) : '';
    const preview = firstMsg.length > 60 ? firstMsg.substring(0, 60) + '...' : firstMsg;

    // Show quick pick with session info and actions
    const items: vscode.QuickPickItem[] = [
        {
            label: '$(eye) View Full Conversation',
            description: 'Open in editor as markdown',
            detail: `${requests.length} messages`
        },
        {
            label: '$(clippy) Copy Session ID',
            description: pureSessionId,
            detail: 'Copy full session ID to clipboard'
        },
        {
            label: '$(file-code) View Raw JSON',
            description: 'Open raw session file',
            detail: foundSessionPath
        },
        {
            label: '$(output) Show in Output',
            description: 'Display conversation in CSM Output panel',
            detail: 'Quick view without opening new editor'
        }
    ];

    const selected = await vscode.window.showQuickPick(items, {
        title: `Session: ${shortId}...`,
        placeHolder: preview || 'Select an action'
    });

    if (!selected) {
        return;
    }

    if (selected.label.includes('View Full Conversation')) {
        const markdown = buildSessionMarkdown(sessionData, pureSessionId);
        const doc = await vscode.workspace.openTextDocument({
            content: markdown,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, { preview: false });
    } else if (selected.label.includes('Copy Session ID')) {
        await vscode.env.clipboard.writeText(pureSessionId);
        vscode.window.showInformationMessage(`Copied: ${pureSessionId}`);
    } else if (selected.label.includes('View Raw JSON')) {
        if (foundSessionPath) {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(foundSessionPath));
            await vscode.window.showTextDocument(doc, { preview: false });
        }
    } else if (selected.label.includes('Show in Output')) {
        output.clear();
        output.appendLine(`=== Chat Session: ${shortId}... ===`);
        output.appendLine(`Session ID: ${pureSessionId}`);
        output.appendLine(`Messages: ${requests.length}`);
        output.appendLine('');

        for (let i = 0; i < requests.length; i++) {
            const req = requests[i];
            const userMsg = extractMessageText(req.message || req.text || req);
            output.appendLine(`[${i + 1}] USER:`);
            output.appendLine(userMsg);
            output.appendLine('');

            if (req.response) {
                let responseText = '';
                if (Array.isArray(req.response)) {
                    responseText = req.response.map((r: any) => extractMessageText(r.value || r)).join('\n\n');
                } else if (req.response.value) {
                    if (Array.isArray(req.response.value)) {
                        responseText = req.response.value.map((v: any) => extractMessageText(v.value || v)).join('\n\n');
                    } else {
                        responseText = extractMessageText(req.response.value);
                    }
                } else {
                    responseText = extractMessageText(req.response);
                }
                output.appendLine(`[${i + 1}] ASSISTANT:`);
                output.appendLine(responseText);
                output.appendLine('');
            }
            output.appendLine('---');
            output.appendLine('');
        }
        output.show();
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Create output channel
    outputChannel = vscode.window.createOutputChannel('CSM');
    outputChannel.appendLine('Chat System Manager activated');

    // Check if we should show chats after reload (triggered by csm.reloadAndShowChats)
    const showChatsAfterReload = context.globalState.get<boolean>('csm.showChatsAfterReload', false);
    if (showChatsAfterReload) {
        context.globalState.update('csm.showChatsAfterReload', false);
        // Give VS Code a moment to fully initialize, then open chat history
        setTimeout(async () => {
            try {
                // Try to open VS Code's built-in chat history picker
                await vscode.commands.executeCommand('workbench.action.chat.history');
            } catch {
                // Fallback: show info message
                vscode.window.showInformationMessage(
                    'Sessions registered! Open Chat panel and click "Show Chats..." to see them.'
                );
            }
        }, 1000);
    }

    // Initialize executor with extension path for bundled binary lookup
    executor = new CsmExecutor(outputChannel, context.extensionPath);

    // Initialize tree providers
    workspaceProvider = new WorkspaceProvider(executor);
    sessionProvider = new SessionProvider(executor, outputChannel);

    // Register tree views
    const workspaceTreeView = vscode.window.createTreeView('csm.workspaces', {
        treeDataProvider: workspaceProvider,
        showCollapseAll: true
    });

    const sessionTreeView = vscode.window.createTreeView('csm.sessions', {
        treeDataProvider: sessionProvider,
        showCollapseAll: true
    });

    context.subscriptions.push(workspaceTreeView, sessionTreeView);

    // Register commands
    context.subscriptions.push(
        // Open CSM Chat Panel - unified chat interface
        vscode.commands.registerCommand('csm.openChat', () => {
            CsmChatPanel.createOrShow(context.extensionUri, executor, outputChannel);
        }),

        vscode.commands.registerCommand('csm.refresh', () => {
            workspaceProvider.refresh();
            sessionProvider.refresh();
        }),

        // Reload window and open chat history picker (for use after csm register)
        vscode.commands.registerCommand('csm.reloadAndShowChats', async () => {
            // Store intent to show chats after reload
            await context.globalState.update('csm.showChatsAfterReload', true);
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }),

        // Click handler for workspace items - single click shows sessions
        vscode.commands.registerCommand('csm.selectWorkspace', async (item: WorkspaceItem) => {
            if (!item || !item.projectPath) {
                return;
            }
            workspaceProvider.setSelectedWorkspace(item.workspaceInfo);
            sessionProvider.setWorkspacePath(item.projectPath);
        }),

        // Click handler for session items - show dropdown menu
        vscode.commands.registerCommand('csm.selectSession', async (item: import('./sessionProvider').SessionItem) => {
            if (!item || !item.sessionInfo) {
                return;
            }

            // Define action items with proper typing
            interface ActionItem extends vscode.QuickPickItem {
                action: string;
            }

            const items: ActionItem[] = [
                {
                    label: '$(history) Open in Chat History',
                    description: 'Open Chat history picker to load this session',
                    action: 'load'
                },
                {
                    label: '$(git-merge) Merge All Sessions',
                    description: 'Merge all sessions into one combined session',
                    action: 'merge'
                },
                {
                    label: '$(cloud-download) Fetch from Other Workspaces',
                    description: 'Import sessions from other workspaces',
                    action: 'fetch'
                },
                {
                    label: '$(clippy) Copy Session ID',
                    description: 'Copy session UUID to clipboard',
                    action: 'copy'
                },
                {
                    label: '$(info) View Details',
                    description: 'Show session info in output panel',
                    action: 'details'
                }
            ];

            const action = await vscode.window.showQuickPick(items, {
                placeHolder: `${item.sessionInfo.messages} messages - Last modified: ${item.sessionInfo.lastModified}`
            });

            if (!action) {
                return;
            }

            switch (action.action) {
                case 'load':
                    await openChatSession(item.sessionInfo.sessionFile, outputChannel);
                    break;

                case 'merge':
                    const mergeResult = await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Merging sessions...',
                        cancellable: false
                    }, async () => {
                        return await executor.mergeHistory(item.sessionInfo.projectPath);
                    });

                    if (mergeResult.success) {
                        const reload = await vscode.window.showInformationMessage(
                            'Sessions merged! Reload VS Code to see the merged session.',
                            'Reload Window'
                        );
                        if (reload === 'Reload Window') {
                            await vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                        sessionProvider.refresh();
                    } else {
                        vscode.window.showErrorMessage(`Merge failed: ${mergeResult.error}`);
                    }
                    break;

                case 'fetch':
                    const fetchResult = await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Fetching sessions from other workspaces...',
                        cancellable: false
                    }, async () => {
                        return await executor.fetchHistory(item.sessionInfo.projectPath);
                    });

                    if (fetchResult.success) {
                        const reload = await vscode.window.showInformationMessage(
                            'Sessions fetched! Reload VS Code to see them in Chat history.',
                            'Reload Window'
                        );
                        if (reload === 'Reload Window') {
                            await vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                        sessionProvider.refresh();
                    } else {
                        vscode.window.showErrorMessage(`Fetch failed: ${fetchResult.error}`);
                    }
                    break;

                case 'copy':
                    await vscode.env.clipboard.writeText(item.sessionInfo.sessionFile);
                    vscode.window.showInformationMessage('Session ID copied to clipboard');
                    break;

                case 'details':
                    outputChannel.show();
                    outputChannel.appendLine('');
                    outputChannel.appendLine('=== Session Details ===');
                    outputChannel.appendLine(`File: ${item.sessionInfo.sessionFile}`);
                    outputChannel.appendLine(`Project: ${item.sessionInfo.projectPath}`);
                    outputChannel.appendLine(`Last Modified: ${item.sessionInfo.lastModified}`);
                    outputChannel.appendLine(`Messages: ${item.sessionInfo.messages}`);
                    break;
            }
        }),

        // Context menu: Load session in Chat
        vscode.commands.registerCommand('csm.loadSession', async (item: import('./sessionProvider').SessionItem) => {
            if (!item || !item.sessionInfo) {
                return;
            }
            await openChatSession(item.sessionInfo.sessionFile, outputChannel);
        }),

        // Context menu: Merge sessions
        vscode.commands.registerCommand('csm.mergeSessionsForWorkspace', async (item?: import('./sessionProvider').SessionItem | WorkspaceItem) => {
            let projectPath: string | undefined;

            if (item && 'sessionInfo' in item) {
                projectPath = item.sessionInfo.projectPath;
            } else if (item && 'projectPath' in item) {
                projectPath = item.projectPath;
            } else {
                projectPath = sessionProvider.getWorkspacePath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            }

            if (!projectPath) {
                vscode.window.showWarningMessage('No workspace selected');
                return;
            }

            const mergeResult = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Merging sessions...',
                cancellable: false
            }, async () => {
                return await executor.mergeHistory(projectPath!);
            });

            if (mergeResult.success) {
                const reload = await vscode.window.showInformationMessage(
                    'Sessions merged! Reload VS Code to see the merged session.',
                    'Reload Window'
                );
                if (reload === 'Reload Window') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                sessionProvider.refresh();
            } else {
                vscode.window.showErrorMessage(`Merge failed: ${mergeResult.error}`);
            }
        }),

        // Context menu: Fetch sessions from other workspaces
        vscode.commands.registerCommand('csm.fetchSessionsForWorkspace', async (item?: import('./sessionProvider').SessionItem | WorkspaceItem) => {
            let projectPath: string | undefined;

            if (item && 'sessionInfo' in item) {
                projectPath = item.sessionInfo.projectPath;
            } else if (item && 'projectPath' in item) {
                projectPath = item.projectPath;
            } else {
                projectPath = sessionProvider.getWorkspacePath() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            }

            if (!projectPath) {
                vscode.window.showWarningMessage('No workspace selected');
                return;
            }

            const fetchResult = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Fetching sessions from other workspaces...',
                cancellable: false
            }, async () => {
                return await executor.fetchHistory(projectPath!);
            });

            if (fetchResult.success) {
                const reload = await vscode.window.showInformationMessage(
                    'Sessions fetched! Reload VS Code to see them in Chat history.',
                    'Reload Window'
                );
                if (reload === 'Reload Window') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                sessionProvider.refresh();
            } else {
                vscode.window.showErrorMessage(`Fetch failed: ${fetchResult.error}`);
            }
        }),

        // Context menu: Copy session ID
        vscode.commands.registerCommand('csm.copySessionId', async (item: import('./sessionProvider').SessionItem) => {
            if (!item || !item.sessionInfo) {
                return;
            }
            await vscode.env.clipboard.writeText(item.sessionInfo.sessionFile);
            vscode.window.showInformationMessage('Session ID copied to clipboard');
        }),

        // Context menu: View session details
        vscode.commands.registerCommand('csm.viewSessionDetails', async (item: import('./sessionProvider').SessionItem) => {
            if (!item || !item.sessionInfo) {
                return;
            }
            outputChannel.show();
            outputChannel.appendLine('');
            outputChannel.appendLine('=== Session Details ===');
            outputChannel.appendLine(`File: ${item.sessionInfo.sessionFile}`);
            outputChannel.appendLine(`Project: ${item.sessionInfo.projectPath}`);
            outputChannel.appendLine(`Last Modified: ${item.sessionInfo.lastModified}`);
            outputChannel.appendLine(`Messages: ${item.sessionInfo.messages}`);
        }),

        vscode.commands.registerCommand('csm.showWorkspaces', async () => {
            await showWorkspacesWebview(context);
        }),

        vscode.commands.registerCommand('csm.showSessions', async (item?: WorkspaceItem) => {
            const path = item?.projectPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (path) {
                sessionProvider.setWorkspacePath(path);
                await showSessionsWebview(context, path);
            } else {
                vscode.window.showWarningMessage('No workspace selected');
            }
        }),

        vscode.commands.registerCommand('csm.showHistory', async () => {
            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (path) {
                await showHistoryWebview(context, path);
            } else {
                vscode.window.showWarningMessage('No workspace folder open');
            }
        }),

        vscode.commands.registerCommand('csm.findWorkspace', async () => {
            const pattern = await vscode.window.showInputBox({
                prompt: 'Enter search pattern',
                placeHolder: 'e.g., my_project'
            });
            if (pattern) {
                workspaceProvider.setFilter(pattern);
            }
        }),

        vscode.commands.registerCommand('csm.exportSessions', async (item?: WorkspaceItem) => {
            const path = item?.projectPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!path) {
                vscode.window.showWarningMessage('No workspace selected');
                return;
            }

            const dest = await vscode.window.showSaveDialog({
                title: 'Export Sessions To',
                defaultUri: vscode.Uri.file(`${path}_sessions_backup`),
                saveLabel: 'Export'
            });

            if (dest) {
                const result = await executor.exportSessions(dest.fsPath, path);
                if (result.success) {
                    vscode.window.showInformationMessage(`Sessions exported to ${dest.fsPath}`);
                } else {
                    vscode.window.showErrorMessage(`Export failed: ${result.error}`);
                }
            }
        }),

        vscode.commands.registerCommand('csm.importSessions', async () => {
            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!path) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }

            const src = await vscode.window.showOpenDialog({
                title: 'Import Sessions From',
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Import'
            });

            if (src && src[0]) {
                const result = await executor.importSessions(src[0].fsPath, path);
                if (result.success) {
                    vscode.window.showInformationMessage('Sessions imported successfully');
                    sessionProvider.refresh();
                } else {
                    vscode.window.showErrorMessage(`Import failed: ${result.error}`);
                }
            }
        }),

        vscode.commands.registerCommand('csm.fetchHistory', async (item?: WorkspaceItem) => {
            const path = item?.projectPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!path) {
                vscode.window.showWarningMessage('No workspace selected');
                return;
            }

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Fetching history from other workspaces...',
                cancellable: false
            }, async () => {
                return await executor.fetchHistory(path);
            });

            if (result.success) {
                vscode.window.showInformationMessage('History fetched successfully');
                sessionProvider.refresh();
            } else {
                vscode.window.showErrorMessage(`Fetch failed: ${result.error}`);
            }
        }),

        vscode.commands.registerCommand('csm.mergeHistory', async () => {
            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!path) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                'This will merge all sessions into a single unified session. Continue?',
                'Yes', 'No'
            );

            if (confirm === 'Yes') {
                const result = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Merging sessions...',
                    cancellable: false
                }, async () => {
                    return await executor.mergeHistory(path);
                });

                if (result.success) {
                    vscode.window.showInformationMessage('Sessions merged successfully');
                    sessionProvider.refresh();
                } else {
                    vscode.window.showErrorMessage(`Merge failed: ${result.error}`);
                }
            }
        }),

        vscode.commands.registerCommand('csm.launchTui', async () => {
            const terminal = vscode.window.createTerminal({
                name: 'CSM TUI',
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            });
            const binaryPath = vscode.workspace.getConfiguration('csm').get('binaryPath', 'csm');
            terminal.sendText(`"${binaryPath}" tui`);
            terminal.show();
        }),

        vscode.commands.registerCommand('csm.moveSessions', async (item?: WorkspaceItem) => {
            let sourceHash: string | undefined;

            if (item) {
                sourceHash = item.hash;
            } else {
                sourceHash = await vscode.window.showInputBox({
                    prompt: 'Enter source workspace hash',
                    placeHolder: 'abc123...'
                });
            }

            if (!sourceHash) {
                return;
            }

            const targetPath = await vscode.window.showInputBox({
                prompt: 'Enter target project path',
                placeHolder: '/path/to/target/project'
            });

            if (!targetPath) {
                return;
            }

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Moving sessions...',
                cancellable: false
            }, async () => {
                return await executor.moveSessions(sourceHash!, targetPath);
            });

            if (result.success) {
                vscode.window.showInformationMessage('Sessions moved successfully');
                workspaceProvider.refresh();
                sessionProvider.refresh();
            } else {
                vscode.window.showErrorMessage(`Move failed: ${result.error}`);
            }
        }),

        vscode.commands.registerCommand('csm.gitInit', async () => {
            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!path) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }

            const result = await executor.gitInit(path);
            if (result.success) {
                vscode.window.showInformationMessage('Git versioning initialized for chat sessions');
            } else {
                vscode.window.showErrorMessage(`Git init failed: ${result.error}`);
            }
        }),

        vscode.commands.registerCommand('csm.gitAdd', async () => {
            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!path) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }

            const message = await vscode.window.showInputBox({
                prompt: 'Enter commit message (optional)',
                placeHolder: 'Update chat sessions'
            });

            const result = await executor.gitAdd(path, message || undefined);
            if (result.success) {
                vscode.window.showInformationMessage('Chat sessions staged/committed');
            } else {
                vscode.window.showErrorMessage(`Git add failed: ${result.error}`);
            }
        }),

        vscode.commands.registerCommand('csm.gitStatus', async () => {
            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!path) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }

            const result = await executor.gitStatus(path);
            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('=== Git Status ===');
                outputChannel.appendLine(result.output);
            } else {
                vscode.window.showErrorMessage(`Git status failed: ${result.error}`);
            }
        }),

        vscode.commands.registerCommand('csm.gitSnapshot', async () => {
            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!path) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }

            const tag = await vscode.window.showInputBox({
                prompt: 'Enter snapshot tag (optional)',
                placeHolder: 'v1.0'
            });

            const result = await executor.gitSnapshot(path, tag || undefined);
            if (result.success) {
                vscode.window.showInformationMessage('Snapshot created');
            } else {
                vscode.window.showErrorMessage(`Snapshot failed: ${result.error}`);
            }
        }),

        vscode.commands.registerCommand('csm.createMigration', async () => {
            const dest = await vscode.window.showSaveDialog({
                title: 'Create Migration Package',
                defaultUri: vscode.Uri.file('csm_migration'),
                saveLabel: 'Create'
            });

            if (dest) {
                const result = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Creating migration package...',
                    cancellable: false
                }, async () => {
                    return await executor.createMigration(dest.fsPath);
                });

                if (result.success) {
                    vscode.window.showInformationMessage(`Migration package created at ${dest.fsPath}`);
                } else {
                    vscode.window.showErrorMessage(`Migration creation failed: ${result.error}`);
                }
            }
        }),

        vscode.commands.registerCommand('csm.restoreMigration', async () => {
            const src = await vscode.window.showOpenDialog({
                title: 'Select Migration Package',
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Restore'
            });

            if (src && src[0]) {
                const result = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Restoring migration...',
                    cancellable: false
                }, async () => {
                    return await executor.restoreMigration(src[0].fsPath);
                });

                if (result.success) {
                    vscode.window.showInformationMessage('Migration restored successfully');
                    workspaceProvider.refresh();
                } else {
                    vscode.window.showErrorMessage(`Migration restore failed: ${result.error}`);
                }
            }
        }),

        vscode.commands.registerCommand('csm.showVersion', async () => {
            const result = await executor.getVersion();
            if (result.success) {
                vscode.window.showInformationMessage(`CSM: ${result.output.trim()}`);
            } else {
                vscode.window.showErrorMessage(`Failed to get version: ${result.error}`);
            }
        }),

        // One-click harvest from workspace
        vscode.commands.registerCommand('csm.harvest', async () => {
            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Harvesting chat sessions...',
                cancellable: false
            }, async () => {
                return await executor.harvestSessions(path);
            });

            if (result.success) {
                const reload = await vscode.window.showInformationMessage(
                    'Sessions harvested! Reload VS Code to see updates.',
                    'Reload Window', 'Later'
                );
                if (reload === 'Reload Window') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                workspaceProvider.refresh();
                sessionProvider.refresh();
            } else {
                vscode.window.showErrorMessage(`Harvest failed: ${result.error}`);
            }
        }),

        // Harvest scan - show available providers
        vscode.commands.registerCommand('csm.harvestScan', async () => {
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Scanning for chat providers...',
                cancellable: false
            }, async () => {
                return await executor.harvestScan();
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('=== Harvest Scan Results ===');
                outputChannel.appendLine(result.output);
            } else {
                vscode.window.showErrorMessage(`Scan failed: ${result.error}`);
            }
        }),

        // Quick session search
        vscode.commands.registerCommand('csm.searchSessions', async () => {
            const query = await vscode.window.showInputBox({
                prompt: 'Search sessions',
                placeHolder: 'Enter search query (title, content, or ID)',
                title: 'Quick Session Search'
            });

            if (!query) {
                return;
            }

            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Searching for "${query}"...`,
                cancellable: false
            }, async () => {
                return await executor.searchSessions(query, path);
            });

            if (result.success) {
                // Parse results and show in quick pick
                const sessions = executor.parseSessionList(result.output);

                if (sessions.length === 0) {
                    vscode.window.showInformationMessage(`No sessions found matching "${query}"`);
                    return;
                }

                const items = sessions.map(s => ({
                    label: s.sessionFile,
                    description: `${s.messages} messages`,
                    detail: `Last modified: ${s.lastModified} | ${s.projectPath}`,
                    session: s
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    title: `Search Results: ${sessions.length} found`,
                    placeHolder: 'Select a session to open'
                });

                if (selected) {
                    await openChatSession(selected.session.sessionFile, outputChannel);
                }
            } else {
                vscode.window.showErrorMessage(`Search failed: ${result.error}`);
            }
        }),

        // Recover orphaned sessions
        vscode.commands.registerCommand('csm.recoverOrphaned', async () => {
            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!path) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }

            // First detect
            const detectResult = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Detecting orphaned sessions...',
                cancellable: false
            }, async () => {
                return await executor.detectOrphaned(path, false);
            });

            if (!detectResult.success) {
                vscode.window.showErrorMessage(`Detection failed: ${detectResult.error}`);
                return;
            }

            // Show results and ask to recover
            if (detectResult.output.includes('No orphaned sessions found')) {
                vscode.window.showInformationMessage('No orphaned sessions found for this workspace');
                return;
            }

            outputChannel.show();
            outputChannel.appendLine('=== Orphaned Sessions Detected ===');
            outputChannel.appendLine(detectResult.output);

            const recover = await vscode.window.showWarningMessage(
                'Orphaned sessions detected! Do you want to recover them?',
                'Recover', 'Cancel'
            );

            if (recover === 'Recover') {
                const recoverResult = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Recovering orphaned sessions...',
                    cancellable: false
                }, async () => {
                    return await executor.detectOrphaned(path, true);
                });

                if (recoverResult.success) {
                    // Now register them
                    const registerResult = await executor.registerSessions(path, true);
                    if (registerResult.success) {
                        const reload = await vscode.window.showInformationMessage(
                            'Sessions recovered and registered! Reload VS Code to see them.',
                            'Reload Window'
                        );
                        if (reload === 'Reload Window') {
                            await vscode.commands.executeCommand('csm.reloadAndShowChats');
                        }
                    }
                    sessionProvider.refresh();
                } else {
                    vscode.window.showErrorMessage(`Recovery failed: ${recoverResult.error}`);
                }
            }
        }),

        // Inline session preview
        vscode.commands.registerCommand('csm.previewSession', async (item?: import('./sessionProvider').SessionItem) => {
            let sessionId: string | undefined;

            if (item?.sessionInfo) {
                sessionId = item.sessionInfo.sessionFile;
            } else {
                sessionId = await vscode.window.showInputBox({
                    prompt: 'Enter session ID',
                    placeHolder: 'UUID or filename'
                });
            }

            if (!sessionId) {
                return;
            }

            // Show preview in output panel
            await openChatSession(sessionId, outputChannel);
        })
    );

    // Auto-refresh on workspace change
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            sessionProvider.refresh();
        })
    );

    // Initial load
    workspaceProvider.refresh();
    if (vscode.workspace.workspaceFolders?.[0]) {
        sessionProvider.setWorkspacePath(vscode.workspace.workspaceFolders[0].uri.fsPath);
    }
}

async function showWorkspacesWebview(_context: vscode.ExtensionContext) {
    const result = await executor.listWorkspaces();

    const panel = vscode.window.createWebviewPanel(
        'csmWorkspaces',
        'CSM: All Workspaces',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getWorkspacesHtml(result.output);
}

async function showSessionsWebview(_context: vscode.ExtensionContext, path: string) {
    const result = await executor.listSessions(path);

    const panel = vscode.window.createWebviewPanel(
        'csmSessions',
        `CSM: Sessions`,
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getSessionsHtml(path, result.output);
}

async function showHistoryWebview(_context: vscode.ExtensionContext, path: string) {
    const result = await executor.showHistory(path);

    const panel = vscode.window.createWebviewPanel(
        'csmHistory',
        'CSM: Chat History',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getHistoryHtml(path, result.output);
}

function getWorkspacesHtml(output: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        h1 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        pre {
            background: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
        }
        .info {
            color: var(--vscode-textPreformat-foreground);
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <h1>All VS Code Workspaces</h1>
    <p class="info">Workspaces with chat sessions</p>
    <pre>${escapeHtml(output)}</pre>
</body>
</html>`;
}

function getSessionsHtml(path: string, output: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        h1 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .path {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-bottom: 15px;
        }
        pre {
            background: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family);
        }
    </style>
</head>
<body>
    <h1>Chat Sessions</h1>
    <p class="path">${escapeHtml(path)}</p>
    <pre>${escapeHtml(output)}</pre>
</body>
</html>`;
}

function getHistoryHtml(path: string, output: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        h1 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .path {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-bottom: 15px;
        }
        pre {
            background: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family);
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <h1>Chat History Timeline</h1>
    <p class="path">${escapeHtml(path)}</p>
    <pre>${escapeHtml(output)}</pre>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function deactivate() {
    outputChannel?.dispose();
}
