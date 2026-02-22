// Chasm VS Code Extension - Main Entry Point
// Universal AI chat session manager

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import { ChasmExecutor } from './chasmExecutor';
import { WorkspaceProvider, WorkspaceItem } from './workspaceProvider';
import { SessionProvider } from './sessionProvider';
import { ChasmChatPanel } from './chatPanel';
import { SessionRecorder } from './sessionRecorder';
import { createApiClient } from './apiClient';

let executor: ChasmExecutor;
let workspaceProvider: WorkspaceProvider;
let sessionProvider: SessionProvider;
let sessionRecorder: SessionRecorder | undefined;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;
let serverTerminal: vscode.Terminal | undefined;

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
/**
 * Parse a JSONL event-sourced session file into a session data object.
 * JSONL format uses kind: 0 (initial state), 1 (delta update), 2 (array splice).
 *
 * Handles corrupt files where multiple JSON objects are concatenated on a
 * single line (VS Code bug observed in large sessions). In that case, the
 * parser truncates at the first complete JSON boundary and re-parses.
 */
function parseJsonlSessionFile(content: string): any {
    const lines = content.split('\n').filter(line => line.trim());
    let sessionData: any = { requests: [], version: 3 };

    for (const line of lines) {
        try {
            const event = JSON.parse(line);
            applyJsonlEvent(event, sessionData);
        } catch (e: any) {
            // Attempt recovery: if parse fails partway through a line that is
            // very large, the line may contain multiple concatenated JSON objects
            // (a known VS Code JSONL corruption pattern). Try to parse just the
            // first complete JSON object by finding the closing '}}' boundary.
            if (line.length > 1000) {
                const recovered = tryRecoverCorruptJsonlLine(line);
                if (recovered) {
                    applyJsonlEvent(recovered, sessionData);
                }
            }
        }
    }

    return sessionData;
}

/** Apply a parsed JSONL event (kind 0/1/2) to session data in-place. */
function applyJsonlEvent(event: any, sessionData: any): void {
    const kind = event.kind ?? 0;

    if (kind === 0 && event.v) {
        // Initial state — overwrite
        Object.assign(sessionData, event.v, { requests: event.v.requests || [] });
    } else if (kind === 1 && event.k && event.v !== undefined) {
        // Delta update
        const keys: (string | number)[] = event.k;
        if (keys.length === 1 && keys[0] === 'customTitle') {
            sessionData.customTitle = event.v;
        } else if (keys.length >= 2 && keys[0] === 'requests') {
            const idx = keys[1] as number;
            if (sessionData.requests[idx]) {
                let target = sessionData.requests[idx];
                for (let i = 2; i < keys.length - 1; i++) {
                    target = target[keys[i]];
                }
                if (keys.length > 2) {
                    target[keys[keys.length - 1]] = event.v;
                } else {
                    sessionData.requests[idx] = event.v;
                }
            }
        }
    } else if (kind === 2 && event.k && Array.isArray(event.v)) {
        // Array splice
        const keys: (string | number)[] = event.k;
        if (keys.length === 1 && keys[0] === 'requests') {
            const spliceIndex = event.i ?? sessionData.requests.length;
            sessionData.requests.splice(spliceIndex, 0, ...event.v);
        } else if (keys.length >= 2 && keys[0] === 'requests') {
            const reqIdx = keys[1] as number;
            if (sessionData.requests[reqIdx]) {
                let target = sessionData.requests[reqIdx];
                for (let i = 2; i < keys.length; i++) {
                    target = target[keys[i]];
                }
                if (Array.isArray(target)) {
                    const spliceIdx = event.i ?? target.length;
                    target.splice(spliceIdx, 0, ...event.v);
                }
            }
        }
    }
}

/**
 * Try to recover a parseable JSON object from a corrupt JSONL line that has
 * multiple JSON objects concatenated (e.g., `{"kind":0,...}{"kind":1,...}`).
 *
 * Strategy: find the boundary where `}{` appears (outside of a JSON string),
 * and parse just the first object.  Falls back to trying `JSON.parse` on
 * incrementally shorter substrings guided by `}{` positions.
 */
function tryRecoverCorruptJsonlLine(line: string): any | null {
    // Quick scan from the end for `}{` which separates concatenated objects
    // Search backward through last ~200 chars of the line
    for (let scanPos = line.length - 2; scanPos > Math.max(0, line.length - 500); scanPos--) {
        if (line[scanPos] === '}' && line[scanPos + 1] === '{') {
            try {
                const candidate = line.substring(0, scanPos + 1);
                return JSON.parse(candidate);
            } catch {
                // Not the right boundary, keep looking
            }
        }
    }
    return null;
}

async function openChatSession(sessionId: string, output: vscode.OutputChannel): Promise<void> {
    // Strip .json or .jsonl extension if present
    const pureSessionId = sessionId.replace(/\.(json|jsonl)$/i, '');
    const shortId = pureSessionId.substring(0, 8);

    let sessionData: any = null;
    let foundSessionPath = '';

    // Use progress indicator since large files can take time
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Loading session ${shortId}...`,
        cancellable: false
    }, async (progress) => {
        try {
            const appDataPath = process.env.APPDATA || '';
            const workspaceStoragePath = path.join(appDataPath, 'Code', 'User', 'workspaceStorage');

            if (!fs.existsSync(workspaceStoragePath)) {
                return;
            }

            const workspaceDirs = fs.readdirSync(workspaceStoragePath);

            // Phase 1: Collect ALL candidate files with sizes (no reading yet)
            interface CandidateFile {
                filePath: string;
                ext: string;
                size: number;
            }
            const candidates: CandidateFile[] = [];

            progress.report({ message: 'Searching workspace storage...' });

            for (const wsDir of workspaceDirs) {
                const chatSessionsDir = path.join(workspaceStoragePath, wsDir, 'chatSessions');
                for (const ext of ['.jsonl', '.json', '.backup']) {
                    const sessionFile = path.join(chatSessionsDir, `${pureSessionId}${ext}`);
                    try {
                        const stat = fs.statSync(sessionFile);
                        candidates.push({ filePath: sessionFile, ext, size: stat.size });
                    } catch {
                        // File doesn't exist
                    }
                }
            }

            if (candidates.length === 0) {
                return;
            }

            // Phase 2: Sort by size ascending — try smaller files first to avoid
            // blocking on huge files (e.g. 185MB .jsonl) when a smaller alternative exists
            candidates.sort((a, b) => a.size - b.size);

            const MAX_AUTO_SIZE = 50 * 1024 * 1024; // 50MB auto-load threshold
            output.appendLine(`[openChatSession] Found ${candidates.length} candidate files for ${shortId}`);
            for (const c of candidates) {
                output.appendLine(`  ${path.basename(c.filePath)} (${(c.size / 1024 / 1024).toFixed(1)}MB)`);
            }

            // Phase 3: Try reading candidates under the size threshold
            for (const candidate of candidates) {
                if (candidate.size > MAX_AUTO_SIZE) {
                    output.appendLine(`[openChatSession] Deferring ${path.basename(candidate.filePath)} (${(candidate.size / 1024 / 1024).toFixed(0)}MB exceeds ${MAX_AUTO_SIZE / 1024 / 1024}MB auto-load limit)`);
                    continue;
                }

                progress.report({ message: `Reading ${path.basename(candidate.filePath)} (${(candidate.size / 1024 / 1024).toFixed(1)}MB)...` });

                try {
                    const content = await fs.promises.readFile(candidate.filePath, 'utf-8');
                    let parsed: any;
                    if (candidate.ext === '.jsonl') {
                        parsed = parseJsonlSessionFile(content);
                    } else {
                        parsed = JSON.parse(content);
                    }

                    if (parsed?.requests?.length > 0) {
                        sessionData = parsed;
                        foundSessionPath = candidate.filePath;
                        output.appendLine(`[openChatSession] Loaded ${path.basename(candidate.filePath)} with ${parsed.requests.length} requests`);
                        break;
                    } else if (!sessionData) {
                        // Keep first result even if empty, as fallback
                        sessionData = parsed;
                        foundSessionPath = candidate.filePath;
                    }
                } catch (e) {
                    output.appendLine(`[openChatSession] Error reading ${path.basename(candidate.filePath)}: ${e}`);
                }
            }

            // Phase 4: If no small file had content, offer to load large files
            if (!sessionData?.requests?.length) {
                const largeCandidates = candidates.filter(c => c.size > MAX_AUTO_SIZE);
                if (largeCandidates.length > 0) {
                    const sizes = largeCandidates.map(c =>
                        `${path.basename(c.filePath)} (${(c.size / 1024 / 1024).toFixed(0)}MB)`
                    ).join(', ');

                    const choice = await vscode.window.showWarningMessage(
                        `Session files are very large: ${sizes}. Loading may take a while. Proceed?`,
                        'Load',
                        'Cancel'
                    );

                    if (choice === 'Load') {
                        // Pick largest file (most likely to have all content)
                        const target = largeCandidates[largeCandidates.length - 1];
                        progress.report({ message: `Reading large file (${(target.size / 1024 / 1024).toFixed(0)}MB)...` });

                        try {
                            const content = await fs.promises.readFile(target.filePath, 'utf-8');
                            if (target.ext === '.jsonl') {
                                sessionData = parseJsonlSessionFile(content);
                            } else {
                                sessionData = JSON.parse(content);
                            }
                            foundSessionPath = target.filePath;
                            output.appendLine(`[openChatSession] Loaded large file ${path.basename(target.filePath)} with ${sessionData?.requests?.length || 0} requests`);
                        } catch (e) {
                            output.appendLine(`[openChatSession] Error reading large file: ${e}`);
                            vscode.window.showErrorMessage(`Failed to load large session file: ${e}`);
                        }
                    }
                }
            }
        } catch (e) {
            output.appendLine(`[openChatSession] Error: ${e}`);
        }
    });

    if (!sessionData) {
        vscode.window.showErrorMessage(`Session not found: ${shortId}...`);
        return;
    }

    if (!sessionData.requests?.length) {
        vscode.window.showInformationMessage(`Session ${shortId}... is empty (0 messages).`);
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
            description: 'Display conversation in Chasm Output panel',
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

// ── Auto-sharding for oversized JSONL session files ──────────────────────────

const SHARD_TARGET_SIZE = 10 * 1024 * 1024; // 10MB target per shard
const OVERSIZED_THRESHOLD = 20 * 1024 * 1024; // Files above 20MB trigger sharding

/**
 * Scan all VS Code workspace storage directories for oversized session JSONL
 * files and automatically shard them so VS Code can load them.
 *
 * Non-destructive: the original file is preserved as `.jsonl.oversized`.
 * New shard files are created alongside with deterministic UUIDs, and
 * VS Code's session index in state.vscdb is updated for each shard.
 */
async function autoShardOversizedSessions(output: vscode.OutputChannel): Promise<void> {
    const appDataPath = process.env.APPDATA || '';
    const workspaceStoragePath = path.join(appDataPath, 'Code', 'User', 'workspaceStorage');

    if (!fs.existsSync(workspaceStoragePath)) {
        return;
    }

    let workspaceDirs: string[];
    try {
        workspaceDirs = fs.readdirSync(workspaceStoragePath);
    } catch {
        return;
    }

    for (const wsDir of workspaceDirs) {
        const chatSessionsDir = path.join(workspaceStoragePath, wsDir, 'chatSessions');
        if (!fs.existsSync(chatSessionsDir)) {
            continue;
        }

        let files: string[];
        try {
            files = fs.readdirSync(chatSessionsDir);
        } catch {
            continue;
        }

        for (const file of files) {
            // Only process primary session JSONL files (UUID.jsonl)
            if (!file.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.jsonl$/)) {
                continue;
            }

            const filePath = path.join(chatSessionsDir, file);
            let stat: fs.Stats;
            try {
                stat = fs.statSync(filePath);
            } catch {
                continue;
            }

            if (stat.size <= OVERSIZED_THRESHOLD) {
                continue;
            }

            // Already sharded? (backup exists)
            const backupPath = filePath + '.oversized';
            if (fs.existsSync(backupPath)) {
                continue;
            }

            output.appendLine(`[autoShard] Found oversized session: ${file} (${(stat.size / 1024 / 1024).toFixed(0)}MB)`);
            try {
                await shardSessionFile(filePath, wsDir, chatSessionsDir, output);
            } catch (e) {
                output.appendLine(`[autoShard] Error sharding ${file}: ${e}`);
            }
        }
    }
}

/**
 * Shard a single oversized JSONL session file into multiple smaller files.
 *
 * 1. Parses the JSONL events to reconstruct the full session
 * 2. Splits the requests into size-bounded shards (target ~10MB each)
 * 3. Writes each shard as a new JSONL file with a deterministic UUID
 * 4. Copies the original to .jsonl.oversized (non-destructive backup)
 * 5. Replaces the original with the last (most recent) shard
 * 6. Updates VS Code's session index in state.vscdb
 */
async function shardSessionFile(
    filePath: string,
    workspaceHash: string,
    chatSessionsDir: string,
    output: vscode.OutputChannel
): Promise<void> {
    const fileName = path.basename(filePath);
    const sessionId = fileName.replace('.jsonl', '');
    const shortId = sessionId.substring(0, 8);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Sharding oversized session ${shortId}...`,
        cancellable: false
    }, async (progress) => {
        // Step 1: Read and parse the full JSONL
        progress.report({ message: 'Reading session file (this may take a moment)...' });
        let sessionData: any;
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            sessionData = parseJsonlSessionFile(content);
        } catch (e) {
            output.appendLine(`[autoShard] Failed to read/parse ${fileName}: ${e}`);
            return;
        }

        const requests = sessionData.requests || [];
        if (requests.length === 0) {
            output.appendLine(`[autoShard] ${fileName} has no requests, skipping`);
            return;
        }

        output.appendLine(`[autoShard] Parsed ${requests.length} requests from ${fileName}`);

        // Step 2: Split requests into size-bounded shards
        const shards: { requests: any[]; startIdx: number; endIdx: number }[] = [];
        let currentRequests: any[] = [];
        let currentSize = 0;
        let startIdx = 0;

        for (let i = 0; i < requests.length; i++) {
            const reqSize = Buffer.byteLength(JSON.stringify(requests[i]), 'utf-8');

            // Start a new shard if adding this request would exceed the target
            if (currentSize + reqSize > SHARD_TARGET_SIZE && currentRequests.length > 0) {
                shards.push({ requests: currentRequests, startIdx, endIdx: i - 1 });
                currentRequests = [];
                currentSize = 0;
                startIdx = i;
            }

            currentRequests.push(requests[i]);
            currentSize += reqSize;
        }
        if (currentRequests.length > 0) {
            shards.push({ requests: currentRequests, startIdx, endIdx: requests.length - 1 });
        }

        output.appendLine(`[autoShard] Splitting into ${shards.length} shards`);

        // Step 3: Write shard files with deterministic UUIDs
        const title = sessionData.customTitle || 'Untitled';
        const shardMeta: { uuid: string; title: string; lastTimestamp: number; created: number }[] = [];

        for (let i = 0; i < shards.length; i++) {
            const shard = shards[i];

            // Deterministic UUID from original session ID + shard index
            const hash = crypto.createHash('md5').update(`${sessionId}-shard-${i}`).digest('hex');
            const shardUuid = [
                hash.substring(0, 8),
                hash.substring(8, 12),
                hash.substring(12, 16),
                hash.substring(16, 20),
                hash.substring(20, 32)
            ].join('-');

            const shardTitle = shards.length > 1
                ? `${title} (Part ${i + 1}/${shards.length})`
                : title;

            const shardData = {
                version: sessionData.version || 3,
                sessionId: shardUuid,
                creationDate: sessionData.creationDate || Date.now(),
                customTitle: shardTitle,
                initialLocation: 'panel',
                requests: shard.requests,
            };

            const jsonlLine = JSON.stringify({ kind: 0, v: shardData }) + '\n';
            const shardPath = path.join(chatSessionsDir, `${shardUuid}.jsonl`);

            progress.report({ message: `Writing shard ${i + 1}/${shards.length}...` });
            await fs.promises.writeFile(shardPath, jsonlLine, 'utf-8');

            const lastReq = shard.requests[shard.requests.length - 1];
            const firstReq = shard.requests[0];
            shardMeta.push({
                uuid: shardUuid,
                title: shardTitle,
                lastTimestamp: lastReq?.timestamp || Date.now(),
                created: firstReq?.timestamp || sessionData.creationDate || Date.now(),
            });

            const sizeMB = (Buffer.byteLength(jsonlLine, 'utf-8') / 1024 / 1024).toFixed(1);
            output.appendLine(`[autoShard]   Part ${i + 1}: ${shardUuid} — ${shard.requests.length} requests (${sizeMB}MB)`);
        }

        // Step 4: Non-destructive backup of the original
        progress.report({ message: 'Backing up original...' });
        const backupPath = filePath + '.oversized';
        await fs.promises.copyFile(filePath, backupPath);
        output.appendLine(`[autoShard] Backed up original → ${path.basename(backupPath)}`);

        // Step 5: Replace original with last (most recent) shard so the
        // original session entry in VS Code loads the newest messages
        const lastShard = shards[shards.length - 1];
        const latestData = {
            version: sessionData.version || 3,
            sessionId: sessionId,
            creationDate: sessionData.creationDate || Date.now(),
            customTitle: shards.length > 1 ? `${title} (Latest — Part ${shards.length}/${shards.length})` : title,
            initialLocation: 'panel',
            requests: lastShard.requests,
        };
        const latestJsonl = JSON.stringify({ kind: 0, v: latestData }) + '\n';
        await fs.promises.writeFile(filePath, latestJsonl, 'utf-8');
        const latestMB = (Buffer.byteLength(latestJsonl, 'utf-8') / 1024 / 1024).toFixed(1);
        output.appendLine(`[autoShard] Replaced original with latest shard (${lastShard.requests.length} requests, ${latestMB}MB)`);

        // Step 6: Update VS Code's session index to include the new shards
        progress.report({ message: 'Updating session index...' });
        try {
            await updateSessionIndex(workspaceHash, sessionId, shardMeta, output);
        } catch (e) {
            output.appendLine(`[autoShard] Warning: could not update session index: ${e}`);
            output.appendLine('[autoShard] Shard files were created; they will appear after manual index update.');
        }

        // Step 7: Notify user
        const choice = await vscode.window.showInformationMessage(
            `Sharded oversized session "${title}" into ${shards.length} loadable parts (original preserved as .oversized). Reload VS Code to see them.`,
            'Reload Window'
        );
        if (choice === 'Reload Window') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    });
}

/**
 * Update the VS Code Chat session index stored in state.vscdb so that
 * newly-created shard files appear in the native Chat History picker.
 *
 * Uses the sqlite3 CLI via stdin to avoid shell-escaping issues with
 * large JSON payloads.
 */
async function updateSessionIndex(
    workspaceHash: string,
    originalSessionId: string,
    shardMeta: { uuid: string; title: string; lastTimestamp: number; created: number }[],
    output: vscode.OutputChannel
): Promise<void> {
    const dbPath = path.join(
        process.env.APPDATA || '',
        'Code', 'User', 'workspaceStorage', workspaceHash, 'state.vscdb'
    );

    if (!fs.existsSync(dbPath)) {
        output.appendLine(`[autoShard] state.vscdb not found: ${dbPath}`);
        return;
    }

    // Read current index
    const readResult = spawnSync('sqlite3', [dbPath, "SELECT value FROM ItemTable WHERE key = 'chat.ChatSessionStore.index';"], {
        encoding: 'utf-8',
        timeout: 15000,
    });

    if (readResult.status !== 0 || !readResult.stdout?.trim()) {
        output.appendLine(`[autoShard] Could not read session index: ${readResult.stderr || 'empty result'}`);
        return;
    }

    let index: any;
    try {
        index = JSON.parse(readResult.stdout.trim());
    } catch (e) {
        output.appendLine(`[autoShard] Could not parse session index: ${e}`);
        return;
    }

    // Mark any broken .recovered entries as empty so they don't mislead users
    const recoveredKey = `${originalSessionId}.recovered`;
    if (index.entries[recoveredKey] && !index.entries[recoveredKey].isEmpty) {
        index.entries[recoveredKey].isEmpty = true;
        output.appendLine(`[autoShard] Marked broken recovered session as empty: ${recoveredKey}`);
    }

    // Add shard entries
    for (const entry of shardMeta) {
        index.entries[entry.uuid] = {
            sessionId: entry.uuid,
            title: entry.title,
            lastMessageDate: entry.lastTimestamp,
            timing: {
                created: entry.created,
                lastRequestStarted: entry.lastTimestamp,
                lastRequestEnded: entry.lastTimestamp,
            },
            lastResponseState: 1,
            initialLocation: 'panel',
            isEmpty: false,
            isImported: false,
            hasPendingEdits: false,
            isExternal: false,
        };
    }

    // Write updated index via stdin to avoid shell-escaping issues
    const updatedJson = JSON.stringify(index).replace(/'/g, "''");
    const sql = `UPDATE ItemTable SET value = '${updatedJson}' WHERE key = 'chat.ChatSessionStore.index';\n`;

    const writeResult = spawnSync('sqlite3', [dbPath], {
        input: sql,
        encoding: 'utf-8',
        timeout: 15000,
    });

    if (writeResult.status !== 0) {
        output.appendLine(`[autoShard] sqlite3 write error: ${writeResult.stderr}`);
        throw new Error(`sqlite3 exit code ${writeResult.status}`);
    }

    output.appendLine(`[autoShard] Updated session index with ${shardMeta.length} shard entries`);
}

export function activate(context: vscode.ExtensionContext) {
    // Create output channel
    outputChannel = vscode.window.createOutputChannel('Chasm');
    outputChannel.appendLine('Chasm activated');

    // Check if we should show chats after reload (triggered by chasm.reloadAndShowChats)
    const showChatsAfterReload = context.globalState.get<boolean>('chasm.showChatsAfterReload', false);
    if (showChatsAfterReload) {
        context.globalState.update('chasm.showChatsAfterReload', false);
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
    executor = new ChasmExecutor(outputChannel, context.extensionPath);

    // Auto-shard oversized JSONL session files (deferred to avoid blocking startup)
    setTimeout(() => {
        autoShardOversizedSessions(outputChannel).catch(err => {
            outputChannel.appendLine(`[autoShard] Unexpected error: ${err}`);
        });
    }, 3000);

    // Initialize tree providers
    workspaceProvider = new WorkspaceProvider(executor);
    sessionProvider = new SessionProvider(executor, outputChannel);

    // Initialize real-time session recorder
    const recordingEnabled = vscode.workspace.getConfiguration('chasm').get<boolean>('recording.enabled', false);
    const apiBaseUrl = vscode.workspace.getConfiguration('chasm').get<string>('api.baseUrl', 'http://localhost:3000');

    if (recordingEnabled) {
        const apiClient = createApiClient({ baseUrl: apiBaseUrl }, outputChannel);
        sessionRecorder = new SessionRecorder(apiClient, outputChannel);
        sessionRecorder.start().then(() => {
            outputChannel.appendLine('Session recorder started');
        }).catch(err => {
            outputChannel.appendLine(`Failed to start session recorder: ${err.message}`);
        });
        context.subscriptions.push({ dispose: () => sessionRecorder?.dispose() });
    }

    // Register tree views
    const workspaceTreeView = vscode.window.createTreeView('chasm.workspaces', {
        treeDataProvider: workspaceProvider,
        showCollapseAll: true
    });

    const sessionTreeView = vscode.window.createTreeView('chasm.sessions', {
        treeDataProvider: sessionProvider,
        showCollapseAll: true
    });

    context.subscriptions.push(workspaceTreeView, sessionTreeView);

    // ── Status Bar ─────────────────────────────────────────────────────
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusBarItem.command = 'chasm.doctor';
    statusBarItem.text = '$(heart) Chasm';
    statusBarItem.tooltip = 'Chasm — Click to run health check';
    const statusBarEnabled = vscode.workspace.getConfiguration('chasm').get<boolean>('statusBar.enabled', true);
    if (statusBarEnabled) {
        statusBarItem.show();
    }
    context.subscriptions.push(statusBarItem);

    // Run startup health check if enabled
    const runDoctorOnStartup = vscode.workspace.getConfiguration('chasm').get<boolean>('doctor.runOnStartup', false);
    if (runDoctorOnStartup) {
        updateStatusBarWithHealth();
    }

    // Auto-start API server if configured
    const autoStartServer = vscode.workspace.getConfiguration('chasm').get<boolean>('api.autoStart', false);
    if (autoStartServer) {
        startApiServer();
    }

    // Register commands
    context.subscriptions.push(
        // Open Chasm Chat Panel - unified chat interface
        vscode.commands.registerCommand('chasm.openChat', () => {
            ChasmChatPanel.createOrShow(context.extensionUri, executor, outputChannel);
        }),

        vscode.commands.registerCommand('chasm.refresh', () => {
            workspaceProvider.refresh();
            sessionProvider.refresh();
        }),

        // Reload window and open chat history picker (for use after chasm register)
        vscode.commands.registerCommand('chasm.reloadAndShowChats', async () => {
            // Store intent to show chats after reload
            await context.globalState.update('chasm.showChatsAfterReload', true);
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }),

        // Click handler for workspace items - single click shows sessions
        vscode.commands.registerCommand('chasm.selectWorkspace', async (item: WorkspaceItem) => {
            if (!item || !item.projectPath) {
                return;
            }
            workspaceProvider.setSelectedWorkspace(item.workspaceInfo);
            sessionProvider.setWorkspacePath(item.projectPath);
        }),

        // Click handler for session items - show dropdown menu
        vscode.commands.registerCommand('chasm.selectSession', async (item: import('./sessionProvider').SessionItem) => {
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
        vscode.commands.registerCommand('chasm.loadSession', async (item: import('./sessionProvider').SessionItem) => {
            if (!item || !item.sessionInfo) {
                return;
            }
            await openChatSession(item.sessionInfo.sessionFile, outputChannel);
        }),

        // Repair oversized session files by compacting them
        vscode.commands.registerCommand('chasm.repairSession', async (item?: import('./sessionProvider').SessionItem) => {
            const sessionFile = item?.sessionInfo?.sessionFile;
            if (!sessionFile) {
                vscode.window.showWarningMessage('No session selected');
                return;
            }

            const pureSessionId = sessionFile.replace(/\.(json|jsonl)$/i, '');
            const shortId = pureSessionId.substring(0, 8);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Repairing session ${shortId}...`,
                cancellable: false
            }, async (progress) => {
                try {
                    const appDataPath = process.env.APPDATA || '';
                    const workspaceStoragePath = path.join(appDataPath, 'Code', 'User', 'workspaceStorage');
                    if (!fs.existsSync(workspaceStoragePath)) {
                        vscode.window.showErrorMessage('Workspace storage not found');
                        return;
                    }

                    const workspaceDirs = fs.readdirSync(workspaceStoragePath);

                    // Find all matching files with sizes
                    interface FileInfo { filePath: string; ext: string; size: number; }
                    const allFiles: FileInfo[] = [];

                    for (const wsDir of workspaceDirs) {
                        const chatSessionsDir = path.join(workspaceStoragePath, wsDir, 'chatSessions');
                        for (const ext of ['.jsonl', '.json', '.backup']) {
                            const fp = path.join(chatSessionsDir, `${pureSessionId}${ext}`);
                            try {
                                const stat = fs.statSync(fp);
                                allFiles.push({ filePath: fp, ext, size: stat.size });
                            } catch { /* not found */ }
                        }
                    }

                    if (allFiles.length === 0) {
                        vscode.window.showErrorMessage('No session files found');
                        return;
                    }

                    // Find oversized .jsonl files that need repair
                    const MAX_HEALTHY_SIZE = 20 * 1024 * 1024; // 20MB
                    const oversized = allFiles.filter(f => f.ext === '.jsonl' && f.size > MAX_HEALTHY_SIZE);

                    if (oversized.length === 0) {
                        vscode.window.showInformationMessage(`Session ${shortId} files are already within healthy size limits.`);
                        return;
                    }

                    // Find smallest file with content to use as source
                    const sortedBySize = [...allFiles].sort((a, b) => a.size - b.size);
                    let source: FileInfo | null = null;
                    let sessionData: any = null;

                    for (const fi of sortedBySize) {
                        if (fi.size > 100 * 1024 * 1024) { break; } // skip > 100MB
                        progress.report({ message: `Reading ${path.basename(fi.filePath)}...` });
                        try {
                            const content = await fs.promises.readFile(fi.filePath, 'utf-8');
                            let parsed: any;
                            if (fi.ext === '.jsonl') {
                                parsed = parseJsonlSessionFile(content);
                            } else {
                                parsed = JSON.parse(content);
                            }
                            if (parsed?.requests?.length > 0) {
                                source = fi;
                                sessionData = parsed;
                                break;
                            }
                        } catch (e) {
                            outputChannel.appendLine(`[repairSession] Error reading ${path.basename(fi.filePath)}: ${e}`);
                        }
                    }

                    if (!sessionData?.requests?.length) {
                        vscode.window.showErrorMessage(`Could not find session data in any file under 100MB. Manual repair needed.`);
                        return;
                    }

                    outputChannel.appendLine(`[repairSession] Using ${path.basename(source!.filePath)} as source (${sessionData.requests.length} requests)`);

                    // Build a compact JSONL file: single kind:0 event with all session data
                    const compactData = {
                        version: sessionData.version || 3,
                        requests: sessionData.requests,
                        ...(sessionData.customTitle && { customTitle: sessionData.customTitle }),
                        ...(sessionData.creationDate && { creationDate: sessionData.creationDate }),
                        ...(sessionData.sessionId && { sessionId: sessionData.sessionId }),
                    };
                    const compactJsonl = JSON.stringify({ kind: 0, v: compactData }) + '\n';
                    const compactSizeMB = (Buffer.byteLength(compactJsonl, 'utf-8') / 1024 / 1024).toFixed(1);

                    // Replace each oversized .jsonl file
                    let repaired = 0;
                    for (const target of oversized) {
                        const oldSizeMB = (target.size / 1024 / 1024).toFixed(0);
                        progress.report({ message: `Compacting ${path.basename(target.filePath)} (${oldSizeMB}MB → ${compactSizeMB}MB)...` });

                        // Backup original
                        const backupPath = target.filePath + '.bloated';
                        try {
                            await fs.promises.rename(target.filePath, backupPath);
                            await fs.promises.writeFile(target.filePath, compactJsonl, 'utf-8');
                            outputChannel.appendLine(`[repairSession] Compacted ${path.basename(target.filePath)}: ${oldSizeMB}MB → ${compactSizeMB}MB (backup: ${path.basename(backupPath)})`);
                            repaired++;
                        } catch (e) {
                            outputChannel.appendLine(`[repairSession] Failed to compact ${path.basename(target.filePath)}: ${e}`);
                            // Try to restore backup if write failed
                            try { await fs.promises.rename(backupPath, target.filePath); } catch { /* best effort */ }
                        }
                    }

                    if (repaired > 0) {
                        const reload = await vscode.window.showInformationMessage(
                            `Repaired ${repaired} oversized session file(s). Reload VS Code to see the session in Chat history.`,
                            'Reload Window'
                        );
                        if (reload === 'Reload Window') {
                            await vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                    }
                } catch (e) {
                    outputChannel.appendLine(`[repairSession] Error: ${e}`);
                    vscode.window.showErrorMessage(`Repair failed: ${e}`);
                }
            });
        }),

        // Context menu: Merge sessions
        vscode.commands.registerCommand('chasm.mergeSessionsForWorkspace', async (item?: import('./sessionProvider').SessionItem | WorkspaceItem) => {
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
        vscode.commands.registerCommand('chasm.fetchSessionsForWorkspace', async (item?: import('./sessionProvider').SessionItem | WorkspaceItem) => {
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
        vscode.commands.registerCommand('chasm.copySessionId', async (item: import('./sessionProvider').SessionItem) => {
            if (!item || !item.sessionInfo) {
                return;
            }
            await vscode.env.clipboard.writeText(item.sessionInfo.sessionFile);
            vscode.window.showInformationMessage('Session ID copied to clipboard');
        }),

        // Context menu: View session details
        vscode.commands.registerCommand('chasm.viewSessionDetails', async (item: import('./sessionProvider').SessionItem) => {
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

        vscode.commands.registerCommand('chasm.showWorkspaces', async () => {
            await showWorkspacesWebview(context);
        }),

        vscode.commands.registerCommand('chasm.showSessions', async (item?: WorkspaceItem) => {
            const path = item?.projectPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (path) {
                sessionProvider.setWorkspacePath(path);
                await showSessionsWebview(context, path);
            } else {
                vscode.window.showWarningMessage('No workspace selected');
            }
        }),

        vscode.commands.registerCommand('chasm.showHistory', async () => {
            const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (path) {
                await showHistoryWebview(context, path);
            } else {
                vscode.window.showWarningMessage('No workspace folder open');
            }
        }),

        vscode.commands.registerCommand('chasm.findWorkspace', async () => {
            const pattern = await vscode.window.showInputBox({
                prompt: 'Enter search pattern',
                placeHolder: 'e.g., my_project'
            });
            if (pattern) {
                workspaceProvider.setFilter(pattern);
            }
        }),

        vscode.commands.registerCommand('chasm.exportSessions', async (item?: WorkspaceItem) => {
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

        vscode.commands.registerCommand('chasm.importSessions', async () => {
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

        vscode.commands.registerCommand('chasm.fetchHistory', async (item?: WorkspaceItem) => {
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

        vscode.commands.registerCommand('chasm.mergeHistory', async () => {
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

        vscode.commands.registerCommand('chasm.launchTui', async () => {
            const terminal = vscode.window.createTerminal({
                name: 'Chasm TUI',
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            });
            const binaryPath = vscode.workspace.getConfiguration('chasm').get('binaryPath', 'Chasm');
            terminal.sendText(`"${binaryPath}" tui`);
            terminal.show();
        }),

        vscode.commands.registerCommand('chasm.moveSessions', async (item?: WorkspaceItem) => {
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

        vscode.commands.registerCommand('chasm.gitInit', async () => {
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

        vscode.commands.registerCommand('chasm.gitAdd', async () => {
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

        vscode.commands.registerCommand('chasm.gitStatus', async () => {
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

        vscode.commands.registerCommand('chasm.gitSnapshot', async () => {
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

        vscode.commands.registerCommand('chasm.createMigration', async () => {
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

        vscode.commands.registerCommand('chasm.restoreMigration', async () => {
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

        vscode.commands.registerCommand('chasm.showVersion', async () => {
            const result = await executor.getVersion();
            if (result.success) {
                vscode.window.showInformationMessage(`Chasm: ${result.output.trim()}`);
            } else {
                vscode.window.showErrorMessage(`Failed to get version: ${result.error}`);
            }
        }),

        // One-click harvest from workspace
        vscode.commands.registerCommand('chasm.harvest', async () => {
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
        vscode.commands.registerCommand('chasm.harvestScan', async () => {
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
        vscode.commands.registerCommand('chasm.searchSessions', async () => {
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
        vscode.commands.registerCommand('chasm.recoverOrphaned', async () => {
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
                    const registerResult = await executor.registerAll(path, true);
                    if (registerResult.success) {
                        const reload = await vscode.window.showInformationMessage(
                            'Sessions recovered and registered! Reload VS Code to see them.',
                            'Reload Window'
                        );
                        if (reload === 'Reload Window') {
                            await vscode.commands.executeCommand('chasm.reloadAndShowChats');
                        }
                    }
                    sessionProvider.refresh();
                } else {
                    vscode.window.showErrorMessage(`Recovery failed: ${recoverResult.error}`);
                }
            }
        }),

        // Inline session preview
        vscode.commands.registerCommand('chasm.previewSession', async (item?: import('./sessionProvider').SessionItem) => {
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
        }),

        // Toggle real-time session recording
        vscode.commands.registerCommand('chasm.toggleRecording', async () => {
            const config = vscode.workspace.getConfiguration('chasm');
            const currentState = config.get<boolean>('recording.enabled', false);

            if (currentState) {
                // Stop recording
                if (sessionRecorder) {
                    sessionRecorder.stop();
                    outputChannel.appendLine('Session recording stopped');
                }
                await config.update('recording.enabled', false, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Session recording disabled');
            } else {
                // Start recording
                await config.update('recording.enabled', true, vscode.ConfigurationTarget.Global);
                const apiBaseUrl = config.get<string>('api.baseUrl', 'http://localhost:3000');
                const apiClient = createApiClient({ baseUrl: apiBaseUrl }, outputChannel);
                sessionRecorder = new SessionRecorder(apiClient, outputChannel);
                try {
                    await sessionRecorder.start();
                    outputChannel.appendLine('Session recording started');
                    vscode.window.showInformationMessage('Session recording enabled');
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to start recording: ${(err as Error).message}`);
                }
            }
        }),

        // Show recording status
        vscode.commands.registerCommand('chasm.recordingStatus', async () => {
            if (!sessionRecorder) {
                vscode.window.showInformationMessage('Session recording is not active');
                return;
            }

            const isConnected = sessionRecorder.isConnected;
            const bufferSize = sessionRecorder.bufferSize;
            const watchedPaths = sessionRecorder.watchedPaths;

            outputChannel.show();
            outputChannel.appendLine('=== Session Recording Status ===');
            outputChannel.appendLine(`Connected: ${isConnected ? 'Yes' : 'No'}`);
            outputChannel.appendLine(`Buffered events: ${bufferSize}`);
            outputChannel.appendLine(`Watched paths: ${watchedPaths.length}`);
            for (const p of watchedPaths) {
                outputChannel.appendLine(`  - ${p}`);
            }
        }),

        // ── Doctor / Health Check commands ─────────────────────────────

        // Run health check
        vscode.commands.registerCommand('chasm.doctor', async () => {
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Running health check...',
                cancellable: false
            }, async () => {
                return await executor.doctor(true);
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Chasm Health Check ===');
                outputChannel.appendLine(result.output);

                // Check if issues were found
                const hasIssues = result.output.includes('issues') || result.output.includes('WARN') || result.output.includes('ERROR');
                if (hasIssues) {
                    const fix = await vscode.window.showWarningMessage(
                        'Health check found issues. Would you like to auto-fix them?',
                        'Fix All', 'Preview Repairs', 'Dismiss'
                    );
                    if (fix === 'Fix All') {
                        await vscode.commands.executeCommand('chasm.doctorFix');
                    } else if (fix === 'Preview Repairs') {
                        await vscode.commands.executeCommand('chasm.doctorDryRun');
                    }
                } else {
                    vscode.window.showInformationMessage('Health check passed — no issues found!');
                }
                updateStatusBarWithHealth();
            } else {
                vscode.window.showErrorMessage(`Health check failed: ${result.error}`);
            }
        }),

        // Fix all session issues
        vscode.commands.registerCommand('chasm.doctorFix', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'This will auto-fix all detected session issues (compact JSONL, inject compat fields, rebuild indexes). Continue?',
                'Fix All', 'Cancel'
            );
            if (confirm !== 'Fix All') {
                return;
            }

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Fixing session issues...',
                cancellable: false
            }, async () => {
                return await executor.doctorFix();
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Auto-Fix Results ===');
                outputChannel.appendLine(result.output);

                const reload = await vscode.window.showInformationMessage(
                    'Session issues fixed! Reload VS Code to see updates.',
                    'Reload Window', 'Later'
                );
                if (reload === 'Reload Window') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                updateStatusBarWithHealth();
            } else {
                vscode.window.showErrorMessage(`Fix failed: ${result.error}`);
            }
        }),

        // Preview repairs (dry run)
        vscode.commands.registerCommand('chasm.doctorDryRun', async () => {
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Scanning for repairable issues...',
                cancellable: false
            }, async () => {
                return await executor.registerRepairDryRun();
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Repair Preview (Dry Run) ===');
                outputChannel.appendLine(result.output);
                vscode.window.showInformationMessage('Preview complete — see Output panel for details');
            } else {
                vscode.window.showErrorMessage(`Preview failed: ${result.error}`);
            }
        }),

        // ── Register / Repair commands ─────────────────────────────────

        // Repair all sessions
        vscode.commands.registerCommand('chasm.registerRepair', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Repair all sessions across all workspaces? This will compact JSONL files and rebuild indexes.',
                'Repair All', 'Cancel'
            );
            if (confirm !== 'Repair All') {
                return;
            }

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Repairing sessions...',
                cancellable: false
            }, async () => {
                return await executor.registerRepair(true, true);
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Repair Results ===');
                outputChannel.appendLine(result.output);

                const reload = await vscode.window.showInformationMessage(
                    'Sessions repaired! Reload VS Code to see updates.',
                    'Reload Window', 'Later'
                );
                if (reload === 'Reload Window') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                workspaceProvider.refresh();
                sessionProvider.refresh();
            } else {
                vscode.window.showErrorMessage(`Repair failed: ${result.error}`);
            }
        }),

        // Recursive repair
        vscode.commands.registerCommand('chasm.registerRepairRecursive', async () => {
            const scanPath = await vscode.window.showInputBox({
                prompt: 'Enter root directory to recursively scan for workspaces',
                placeHolder: 'e.g., C:\\Users\\you\\dev',
                value: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
            });
            if (!scanPath) {
                return;
            }

            const depthStr = await vscode.window.showInputBox({
                prompt: 'Max directory depth (leave empty for unlimited)',
                placeHolder: 'e.g., 3'
            });
            const depth = depthStr ? parseInt(depthStr, 10) : undefined;

            // First do a dry run
            const preview = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Scanning for workspaces...',
                cancellable: false
            }, async () => {
                return await executor.registerRepairRecursive(scanPath, depth, true);
            });

            if (!preview.success) {
                vscode.window.showErrorMessage(`Scan failed: ${preview.error}`);
                return;
            }

            outputChannel.show();
            outputChannel.appendLine('');
            outputChannel.appendLine('=== Recursive Scan Preview ===');
            outputChannel.appendLine(preview.output);

            const proceed = await vscode.window.showWarningMessage(
                'Scan complete — see Output panel for details. Proceed with repairs?',
                'Repair All', 'Cancel'
            );
            if (proceed !== 'Repair All') {
                return;
            }

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Repairing sessions recursively...',
                cancellable: false
            }, async () => {
                return await executor.registerRepairRecursive(scanPath, depth, false, true);
            });

            if (result.success) {
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Recursive Repair Results ===');
                outputChannel.appendLine(result.output);
                vscode.window.showInformationMessage('Recursive repair complete — see Output panel');
                workspaceProvider.refresh();
            } else {
                vscode.window.showErrorMessage(`Recursive repair failed: ${result.error}`);
            }
        }),

        // ── API Server commands ────────────────────────────────────────

        // Start API server
        vscode.commands.registerCommand('chasm.startServer', async () => {
            startApiServer();
        }),

        // Stop API server
        vscode.commands.registerCommand('chasm.stopServer', async () => {
            stopApiServer();
        }),

        // ── Recover commands ───────────────────────────────────────────

        // Scan for recoverable sessions
        vscode.commands.registerCommand('chasm.recoverScan', async () => {
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Scanning for recoverable sessions...',
                cancellable: false
            }, async () => {
                return await executor.recoverScan();
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Recoverable Sessions ===');
                outputChannel.appendLine(result.output);
            } else {
                vscode.window.showErrorMessage(`Scan failed: ${result.error}`);
            }
        }),

        // List orphaned sessions
        vscode.commands.registerCommand('chasm.recoverOrphans', async () => {
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Listing orphaned sessions...',
                cancellable: false
            }, async () => {
                return await executor.recoverOrphans();
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Orphaned Sessions ===');
                outputChannel.appendLine(result.output);
            } else {
                vscode.window.showErrorMessage(`Failed: ${result.error}`);
            }
        }),

        // ── Sync commands ──────────────────────────────────────────────

        // Sync pull (backup to database)
        vscode.commands.registerCommand('chasm.syncPull', async () => {
            const dryRunFirst = await vscode.window.showWarningMessage(
                'Pull sessions from provider workspaces into the harvest database (backup)?',
                'Preview First', 'Pull Now', 'Cancel'
            );
            if (dryRunFirst === 'Cancel' || !dryRunFirst) {
                return;
            }

            if (dryRunFirst === 'Preview First') {
                const preview = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Previewing sync pull...',
                    cancellable: false
                }, async () => {
                    return await executor.syncPull(undefined, undefined, true);
                });

                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Sync Pull Preview ===');
                outputChannel.appendLine(preview.output);

                const proceed = await vscode.window.showInformationMessage(
                    'See Output panel for preview. Proceed?',
                    'Pull Now', 'Cancel'
                );
                if (proceed !== 'Pull Now') {
                    return;
                }
            }

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Syncing sessions (pull)...',
                cancellable: false
            }, async () => {
                return await executor.syncPull();
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Sync Pull Results ===');
                outputChannel.appendLine(result.output);
                vscode.window.showInformationMessage('Sync pull complete');
            } else {
                vscode.window.showErrorMessage(`Sync pull failed: ${result.error}`);
            }
        }),

        // Sync push (restore from database)
        vscode.commands.registerCommand('chasm.syncPush', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Push sessions from the harvest database to provider workspaces (restore)? This may overwrite existing session files.',
                'Push', 'Cancel'
            );
            if (confirm !== 'Push') {
                return;
            }

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Syncing sessions (push)...',
                cancellable: false
            }, async () => {
                return await executor.syncPush();
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Sync Push Results ===');
                outputChannel.appendLine(result.output);

                const reload = await vscode.window.showInformationMessage(
                    'Sync push complete! Reload VS Code to see restored sessions.',
                    'Reload Window', 'Later'
                );
                if (reload === 'Reload Window') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            } else {
                vscode.window.showErrorMessage(`Sync push failed: ${result.error}`);
            }
        }),

        // ── Upgrade format ─────────────────────────────────────────────

        vscode.commands.registerCommand('chasm.upgradeFormat', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Upgrade session files to the current provider format (JSON → JSONL for VS Code 1.109+)?',
                'Upgrade', 'Cancel'
            );
            if (confirm !== 'Upgrade') {
                return;
            }

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Upgrading session format...',
                cancellable: false
            }, async () => {
                return await executor.recoverUpgrade();
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine('=== Format Upgrade Results ===');
                outputChannel.appendLine(result.output);
                vscode.window.showInformationMessage('Session format upgrade complete');
            } else {
                vscode.window.showErrorMessage(`Upgrade failed: ${result.error}`);
            }
        }),

        // ── Harvest DB search ──────────────────────────────────────────

        vscode.commands.registerCommand('chasm.harvestSearch', async () => {
            const query = await vscode.window.showInputBox({
                prompt: 'Full-text search across all harvested sessions',
                placeHolder: 'Enter search query',
                title: 'Harvest Database Search'
            });

            if (!query) {
                return;
            }

            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Searching harvest DB for "${query}"...`,
                cancellable: false
            }, async () => {
                return await executor.harvestSearch(query);
            });

            if (result.success) {
                outputChannel.show();
                outputChannel.appendLine('');
                outputChannel.appendLine(`=== Harvest Search: "${query}" ===`);
                outputChannel.appendLine(result.output);
            } else {
                vscode.window.showErrorMessage(`Search failed: ${result.error}`);
            }
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
        'chasmWorkspaces',
        'Chasm: All Workspaces',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getWorkspacesHtml(result.output);
}

async function showSessionsWebview(_context: vscode.ExtensionContext, path: string) {
    const result = await executor.listSessions(path);

    const panel = vscode.window.createWebviewPanel(
        'chasmSessions',
        'Chasm: Sessions',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getSessionsHtml(path, result.output);
}

async function showHistoryWebview(_context: vscode.ExtensionContext, path: string) {
    const result = await executor.showHistory(path);

    const panel = vscode.window.createWebviewPanel(
        'chasmHistory',
        'Chasm: Chat History',
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

// ── Status Bar Helper ──────────────────────────────────────────────

async function updateStatusBarWithHealth(): Promise<void> {
    try {
        const result = await executor.doctor();
        if (result.success) {
            // Parse output for issue count
            const issueMatch = result.output.match(/(\d+)\s+issues?\s+in\s+(\d+)/i);
            if (issueMatch) {
                const issues = parseInt(issueMatch[1], 10);
                const workspaces = parseInt(issueMatch[2], 10);
                statusBarItem.text = `$(warning) Chasm: ${issues} issues`;
                statusBarItem.tooltip = `${issues} session issues in ${workspaces} workspaces — click to run health check`;
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            } else {
                statusBarItem.text = '$(heart) Chasm';
                statusBarItem.tooltip = 'All sessions healthy — click to run health check';
                statusBarItem.backgroundColor = undefined;
            }
        }
    } catch {
        // Silently fail — status bar will show default
    }
}

// ── Server Management ──────────────────────────────────────────────

function startApiServer(): void {
    if (serverTerminal) {
        vscode.window.showInformationMessage('Chasm API server is already running');
        serverTerminal.show();
        return;
    }

    const binaryPath = vscode.workspace.getConfiguration('chasm').get('binaryPath', 'chasm');
    serverTerminal = vscode.window.createTerminal({
        name: 'Chasm API Server',
        hideFromUser: false
    });
    serverTerminal.sendText(`"${binaryPath}" api serve`);
    serverTerminal.show(true);

    // Listen for terminal close
    vscode.window.onDidCloseTerminal((terminal) => {
        if (terminal === serverTerminal) {
            serverTerminal = undefined;
            statusBarItem.text = '$(heart) Chasm';
            outputChannel.appendLine('Chasm API server stopped');
        }
    });

    statusBarItem.text = '$(server-process) Chasm';
    statusBarItem.tooltip = 'API server running — click to run health check';
    outputChannel.appendLine('Chasm API server started');
    vscode.window.showInformationMessage('Chasm API server started');
}

function stopApiServer(): void {
    if (!serverTerminal) {
        vscode.window.showInformationMessage('No API server is running');
        return;
    }

    serverTerminal.dispose();
    serverTerminal = undefined;
    statusBarItem.text = '$(heart) Chasm';
    outputChannel.appendLine('Chasm API server stopped');
    vscode.window.showInformationMessage('Chasm API server stopped');
}

export function deactivate() {
    outputChannel?.dispose();
    statusBarItem?.dispose();
    if (serverTerminal) {
        serverTerminal.dispose();
        serverTerminal = undefined;
    }
}
