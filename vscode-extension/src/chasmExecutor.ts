// Chasm Command Executor
// Executes chasm CLI commands and parses output

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execPromise = util.promisify(cp.exec);

export interface ChasmResult {
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

export interface DoctorIssue {
    workspace: string;
    issueCount: number;
    details: string;
}

export class ChasmExecutor {
    private binaryPath: string;

    constructor(private outputChannel: vscode.OutputChannel, extensionPath?: string) {
        // First check user configuration
        const configPath = vscode.workspace.getConfiguration('chasm').get<string>('binaryPath', '');

        if (configPath && configPath !== 'chasm') {
            this.binaryPath = configPath;
        } else {
            // Try to find bundled binary
            this.binaryPath = this.findBundledBinary(extensionPath) || 'chasm';
        }

        this.log(`Using Chasm binary: ${this.binaryPath}`);

        // Watch for config changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('chasm.binaryPath')) {
                const newPath = vscode.workspace.getConfiguration('chasm').get<string>('binaryPath', '');
                if (newPath && newPath !== 'chasm') {
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
                binaryName = 'chasm.exe';
                break;
            case 'darwin':
                binaryName = 'chasm-darwin';
                break;
            default:
                binaryName = 'chasm-linux';
        }

        // Check in bundled binaries folder
        const bundledPath = path.join(extensionPath, 'bin', binaryName);
        if (fs.existsSync(bundledPath)) {
            this.log(`Found bundled binary: ${bundledPath}`);
            return bundledPath;
        }

        // Also check for generic name
        const genericPath = path.join(extensionPath, 'bin', platform === 'win32' ? 'chasm.exe' : 'chasm');
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

    async execute(args: string[]): Promise<ChasmResult> {
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

    // ── Core listing commands ──────────────────────────────────────────

    async listWorkspaces(): Promise<ChasmResult> {
        return this.execute(['list', 'workspaces']);
    }

    async listSessions(projectPath: string): Promise<ChasmResult> {
        return this.execute(['list', 'path', `"${projectPath}"`]);
    }

    async findWorkspace(pattern: string): Promise<ChasmResult> {
        return this.execute(['find', 'workspace', `"${pattern}"`]);
    }

    async showHistory(projectPath: string): Promise<ChasmResult> {
        return this.execute(['show', 'path', `"${projectPath}"`]);
    }

    // ── Session operations ─────────────────────────────────────────────

    async fetchHistory(projectPath: string): Promise<ChasmResult> {
        return this.execute(['fetch', 'path', `"${projectPath}"`]);
    }

    async mergeHistory(projectPath: string): Promise<ChasmResult> {
        return this.execute(['merge', 'path', `"${projectPath}"`]);
    }

    async exportSessions(dest: string, projectPath: string): Promise<ChasmResult> {
        return this.execute(['export', 'path', `"${dest}"`, `"${projectPath}"`]);
    }

    async importSessions(src: string, targetPath: string): Promise<ChasmResult> {
        return this.execute(['import', 'path', `"${src}"`, `"${targetPath}"`]);
    }

    async moveSessions(sourceHash: string, targetPath: string): Promise<ChasmResult> {
        return this.execute(['move', `"${sourceHash}"`, `"${targetPath}"`]);
    }

    async searchSessions(query: string, projectPath?: string): Promise<ChasmResult> {
        const args = ['find', 'session', `"${query}"`];
        if (projectPath) {
            args.push('--path', `"${projectPath}"`);
        }
        return this.execute(args);
    }

    // ── Harvest commands ───────────────────────────────────────────────

    async harvestSessions(projectPath?: string): Promise<ChasmResult> {
        const args = ['harvest', 'run'];
        if (projectPath) {
            args.push('--path', `"${projectPath}"`);
        }
        return this.execute(args);
    }

    async harvestScan(): Promise<ChasmResult> {
        return this.execute(['harvest', 'scan']);
    }

    async harvestStatus(): Promise<ChasmResult> {
        return this.execute(['harvest', 'status']);
    }

    async harvestSearch(query: string): Promise<ChasmResult> {
        return this.execute(['harvest', 'search', `"${query}"`]);
    }

    // ── Doctor / Health checks ─────────────────────────────────────────

    async doctor(full: boolean = false): Promise<ChasmResult> {
        const args = ['doctor'];
        if (full) {
            args.push('--full');
        }
        return this.execute(args);
    }

    async doctorFix(): Promise<ChasmResult> {
        return this.execute(['doctor', '--fix']);
    }

    async doctorJson(): Promise<ChasmResult> {
        return this.execute(['doctor', '--format', 'json']);
    }

    // ── Register / Repair commands ─────────────────────────────────────

    async registerAll(projectPath: string, force: boolean = false): Promise<ChasmResult> {
        const args = ['register', 'all', '--path', `"${projectPath}"`];
        if (force) {
            args.push('--force');
        }
        return this.execute(args);
    }

    async registerRepair(all: boolean = true, force: boolean = false): Promise<ChasmResult> {
        const args = ['register', 'repair'];
        if (all) {
            args.push('--all');
        }
        if (force) {
            args.push('--force');
        }
        return this.execute(args);
    }

    async registerRepairRecursive(
        scanPath: string,
        depth?: number,
        dryRun: boolean = false,
        force: boolean = false
    ): Promise<ChasmResult> {
        const args = ['register', 'repair', '--recursive', '--path', `"${scanPath}"`];
        if (depth !== undefined) {
            args.push('--depth', depth.toString());
        }
        if (dryRun) {
            args.push('--dry-run');
        }
        if (force) {
            args.push('--force');
        }
        return this.execute(args);
    }

    async registerRepairDryRun(): Promise<ChasmResult> {
        return this.execute(['register', 'repair', '--all', '--dry-run']);
    }

    // ── Detect / Recover commands ──────────────────────────────────────

    async detectOrphaned(projectPath: string, recover: boolean = false): Promise<ChasmResult> {
        const args = ['detect', 'orphaned', `"${projectPath}"`];
        if (recover) {
            args.push('--recover');
        }
        return this.execute(args);
    }

    async recoverScan(): Promise<ChasmResult> {
        return this.execute(['recover', 'scan']);
    }

    async recoverOrphans(): Promise<ChasmResult> {
        return this.execute(['recover', 'orphans']);
    }

    async recoverJsonl(): Promise<ChasmResult> {
        return this.execute(['recover', 'jsonl']);
    }

    async recoverStatus(): Promise<ChasmResult> {
        return this.execute(['recover', 'status']);
    }

    async recoverUpgrade(): Promise<ChasmResult> {
        return this.execute(['recover', 'upgrade']);
    }

    // ── Sync commands ──────────────────────────────────────────────────

    async syncPull(provider?: string, workspace?: string, dryRun: boolean = false): Promise<ChasmResult> {
        const args = ['sync', '--pull'];
        if (provider) {
            args.push('--provider', `"${provider}"`);
        }
        if (workspace) {
            args.push('--workspace', `"${workspace}"`);
        }
        if (dryRun) {
            args.push('--dry-run');
        }
        return this.execute(args);
    }

    async syncPush(provider?: string, workspace?: string, dryRun: boolean = false): Promise<ChasmResult> {
        const args = ['sync', '--push'];
        if (provider) {
            args.push('--provider', `"${provider}"`);
        }
        if (workspace) {
            args.push('--workspace', `"${workspace}"`);
        }
        if (dryRun) {
            args.push('--dry-run');
        }
        return this.execute(args);
    }

    // ── API Server commands ────────────────────────────────────────────

    async apiServe(): Promise<ChasmResult> {
        return this.execute(['api', 'serve']);
    }

    // ── Git operations ─────────────────────────────────────────────────

    async gitInit(projectPath: string): Promise<ChasmResult> {
        return this.execute(['git', 'init', `"${projectPath}"`]);
    }

    async gitAdd(projectPath: string, commitMessage?: string): Promise<ChasmResult> {
        const args = ['git', 'add', `"${projectPath}"`];
        if (commitMessage) {
            args.push('--message', `"${commitMessage}"`);
        }
        return this.execute(args);
    }

    async gitStatus(projectPath: string): Promise<ChasmResult> {
        return this.execute(['git', 'status', `"${projectPath}"`]);
    }

    async gitSnapshot(projectPath: string, tag?: string): Promise<ChasmResult> {
        const args = ['git', 'snapshot', `"${projectPath}"`];
        if (tag) {
            args.push('--tag', `"${tag}"`);
        }
        return this.execute(args);
    }

    // ── Migration operations ───────────────────────────────────────────

    async createMigration(destPath: string, includeAll: boolean = true): Promise<ChasmResult> {
        const args = ['migration', 'create', `"${destPath}"`];
        if (includeAll) {
            args.push('--all');
        }
        return this.execute(args);
    }

    async restoreMigration(srcPath: string, dryRun: boolean = false): Promise<ChasmResult> {
        const args = ['migration', 'restore', `"${srcPath}"`];
        if (dryRun) {
            args.push('--dry-run');
        }
        return this.execute(args);
    }

    // ── Provider operations ────────────────────────────────────────────

    async listProviders(): Promise<ChasmResult> {
        return this.execute(['provider', 'list']);
    }

    async listAllSessions(): Promise<ChasmResult> {
        return this.execute(['list', 'sessions']);
    }

    // ── Version ────────────────────────────────────────────────────────

    async getVersion(): Promise<ChasmResult> {
        return this.execute(['--version']);
    }

    // ── Output parsers ─────────────────────────────────────────────────

    parseWorkspaceList(output: string): WorkspaceInfo[] {
        const workspaces: WorkspaceInfo[] = [];
        const cleanOutput = output.replace(/\r?\n/g, ' ');
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

    parseSessionList(output: string): SessionInfo[] {
        const sessions: SessionInfo[] = [];
        const cleanOutput = output.replace(/\r?\n/g, ' ');
        const rowPattern = /\|\s*([^|]+?)\s*\|\s*([a-f0-9-]{36}\.jsonl?)\s*\|\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\|\s*(\d+)\s*\|/g;
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
