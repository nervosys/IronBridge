// CSM Command Executor
// Executes csm CLI commands and parses output

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execPromise = util.promisify(cp.exec);

export interface CsmResult {
    success: boolean;
    output: string;
    error?: string;
}

export interface WorkspaceInfo {
    hash: string;
    projectPath: string;
    sessions: number;
    hasChats: boolean;
}

export interface SessionInfo {
    projectPath: string;
    sessionFile: string;
    lastModified: string;
    messages: number;
}

export class CsmExecutor {
    private binaryPath: string;

    constructor(private outputChannel: vscode.OutputChannel, extensionPath?: string) {
        // First check user configuration
        const configPath = vscode.workspace.getConfiguration('csm').get<string>('binaryPath', '');

        if (configPath && configPath !== 'csm') {
            this.binaryPath = configPath;
        } else {
            // Try to find bundled binary
            this.binaryPath = this.findBundledBinary(extensionPath) || 'csm';
        }

        this.log(`Using CSM binary: ${this.binaryPath}`);

        // Watch for config changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('csm.binaryPath')) {
                const newPath = vscode.workspace.getConfiguration('csm').get<string>('binaryPath', '');
                if (newPath && newPath !== 'csm') {
                    this.binaryPath = newPath;
                }
                this.log(`Binary path updated: ${this.binaryPath}`);
            }
        });
    }

    private findBundledBinary(extensionPath?: string): string | undefined {
        if (!extensionPath) {
            return undefined;
        }

        // Platform-specific binary names
        const platform = process.platform;
        let binaryName: string;

        switch (platform) {
            case 'win32':
                binaryName = 'csm.exe';
                break;
            case 'darwin':
                binaryName = 'csm-darwin';
                break;
            default:
                binaryName = 'csm-linux';
        }

        // Check in bundled binaries folder
        const bundledPath = path.join(extensionPath, 'bin', binaryName);
        if (fs.existsSync(bundledPath)) {
            this.log(`Found bundled binary: ${bundledPath}`);
            return bundledPath;
        }

        // Also check for generic name
        const genericPath = path.join(extensionPath, 'bin', platform === 'win32' ? 'csm.exe' : 'csm');
        if (fs.existsSync(genericPath)) {
            this.log(`Found bundled binary: ${genericPath}`);
            return genericPath;
        }

        this.log(`No bundled binary found in ${path.join(extensionPath, 'bin')}`);
        return undefined;
    }

    private log(message: string) {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }

    async execute(args: string[]): Promise<CsmResult> {
        const command = `"${this.binaryPath}" ${args.join(' ')}`;
        this.log(`Executing: ${command}`);

        try {
            const { stdout, stderr } = await execPromise(command, {
                maxBuffer: 10 * 1024 * 1024  // 10MB buffer for large outputs
            });

            if (stderr) {
                this.log(`stderr: ${stderr}`);
            }

            this.log(`Output: ${stdout.substring(0, 500)}${stdout.length > 500 ? '...' : ''}`);

            return {
                success: true,
                output: stdout
            };
        } catch (error: any) {
            this.log(`Error: ${error.message}`);
            return {
                success: false,
                output: error.stdout || '',
                error: error.message
            };
        }
    }

    async listWorkspaces(): Promise<CsmResult> {
        return this.execute(['list', 'workspaces']);
    }

    async listSessions(projectPath: string): Promise<CsmResult> {
        return this.execute(['list', 'path', `"${projectPath}"`]);
    }

    async findWorkspace(pattern: string): Promise<CsmResult> {
        return this.execute(['find', 'workspace', `"${pattern}"`]);
    }

    async showHistory(projectPath: string): Promise<CsmResult> {
        return this.execute(['show', 'path', `"${projectPath}"`]);
    }

    async fetchHistory(projectPath: string): Promise<CsmResult> {
        return this.execute(['fetch', 'path', `"${projectPath}"`]);
    }

    async mergeHistory(projectPath: string): Promise<CsmResult> {
        return this.execute(['merge', 'path', `"${projectPath}"`]);
    }

    async exportSessions(dest: string, projectPath: string): Promise<CsmResult> {
        return this.execute(['export', 'path', `"${dest}"`, `"${projectPath}"`]);
    }

    async importSessions(src: string, targetPath: string): Promise<CsmResult> {
        return this.execute(['import', 'path', `"${src}"`, `"${targetPath}"`]);
    }

    async moveSessions(sourceHash: string, targetPath: string): Promise<CsmResult> {
        return this.execute(['move', `"${sourceHash}"`, `"${targetPath}"`]);
    }

    async getVersion(): Promise<CsmResult> {
        return this.execute(['--version']);
    }

    // Git operations
    async gitInit(projectPath: string): Promise<CsmResult> {
        return this.execute(['git', 'init', `"${projectPath}"`]);
    }

    async gitAdd(projectPath: string, commitMessage?: string): Promise<CsmResult> {
        const args = ['git', 'add', `"${projectPath}"`];
        if (commitMessage) {
            args.push('--message', `"${commitMessage}"`);
        }
        return this.execute(args);
    }

    async gitStatus(projectPath: string): Promise<CsmResult> {
        return this.execute(['git', 'status', `"${projectPath}"`]);
    }

    async gitSnapshot(projectPath: string, tag?: string): Promise<CsmResult> {
        const args = ['git', 'snapshot', `"${projectPath}"`];
        if (tag) {
            args.push('--tag', `"${tag}"`);
        }
        return this.execute(args);
    }

    // Migration operations
    async createMigration(destPath: string, includeAll: boolean = true): Promise<CsmResult> {
        const args = ['migration', 'create', `"${destPath}"`];
        if (includeAll) {
            args.push('--all');
        }
        return this.execute(args);
    }

    async restoreMigration(srcPath: string, dryRun: boolean = false): Promise<CsmResult> {
        const args = ['migration', 'restore', `"${srcPath}"`];
        if (dryRun) {
            args.push('--dry-run');
        }
        return this.execute(args);
    }

    // Parse workspace list output into structured data
    parseWorkspaceList(output: string): WorkspaceInfo[] {
        const workspaces: WorkspaceInfo[] = [];

        // Join all lines and then split by row delimiter
        const cleanOutput = output.replace(/\r?\n/g, ' ');

        // Match each row in the table
        const rowPattern = /\|\s*([a-f0-9]+\.\.\.)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*(Yes|No)\s*\|/g;
        let match;

        while ((match = rowPattern.exec(cleanOutput)) !== null) {
            workspaces.push({
                hash: match[1].trim(),
                projectPath: match[2].trim(),
                sessions: parseInt(match[3], 10),
                hasChats: match[4] === 'Yes'
            });
        }

        return workspaces;
    }

    // Parse session list output into structured data
    parseSessionList(output: string): SessionInfo[] {
        const sessions: SessionInfo[] = [];

        // Join all lines and then split by row delimiter
        const cleanOutput = output.replace(/\r?\n/g, ' ');

        // Match each row in the table - session file is a UUID.json
        const rowPattern = /\|\s*([^|]+?)\s*\|\s*([a-f0-9-]{36}\.json)\s*\|\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\|\s*(\d+)\s*\|/g;
        let match;

        while ((match = rowPattern.exec(cleanOutput)) !== null) {
            sessions.push({
                projectPath: match[1].trim(),
                sessionFile: match[2],
                lastModified: match[3],
                messages: parseInt(match[4], 10)
            });
        }

        return sessions;
    }
}
