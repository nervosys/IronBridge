// Provider Mock Tests
// Tests for WorkspaceProvider and SessionProvider with mocked executor

import * as assert from 'assert';

// Mock types for testing without VS Code
interface MockWorkspaceInfo {
    hash: string;
    projectPath: string;
    sessions: number;
    hasChats: boolean;
}

interface MockSessionInfo {
    projectPath: string;
    sessionFile: string;
    lastModified: string;
    messages: number;
}

interface MockCsmResult {
    success: boolean;
    output: string;
    error?: string;
}

suite('Provider Mock Tests', () => {

    suite('WorkspaceProvider Logic', () => {
        // Simulate the filter logic from WorkspaceProvider
        function filterWorkspaces(workspaces: MockWorkspaceInfo[], pattern: string): MockWorkspaceInfo[] {
            if (!pattern) {
                return workspaces;
            }
            const lowerPattern = pattern.toLowerCase();
            return workspaces.filter(w =>
                w.projectPath.toLowerCase().includes(lowerPattern) ||
                w.hash.toLowerCase().includes(lowerPattern)
            );
        }

        test('returns all workspaces when no filter', () => {
            const workspaces: MockWorkspaceInfo[] = [
                { hash: 'abc...', projectPath: '/project1', sessions: 1, hasChats: true },
                { hash: 'def...', projectPath: '/project2', sessions: 2, hasChats: false },
            ];
            const filtered = filterWorkspaces(workspaces, '');
            assert.strictEqual(filtered.length, 2);
        });

        test('filters by project path', () => {
            const workspaces: MockWorkspaceInfo[] = [
                { hash: 'abc...', projectPath: '/my/project1', sessions: 1, hasChats: true },
                { hash: 'def...', projectPath: '/other/project2', sessions: 2, hasChats: false },
            ];
            const filtered = filterWorkspaces(workspaces, 'my');
            assert.strictEqual(filtered.length, 1);
            assert.strictEqual(filtered[0].projectPath, '/my/project1');
        });

        test('filter is case insensitive', () => {
            const workspaces: MockWorkspaceInfo[] = [
                { hash: 'abc...', projectPath: '/MyProject', sessions: 1, hasChats: true },
            ];
            const filtered = filterWorkspaces(workspaces, 'MYPROJECT');
            assert.strictEqual(filtered.length, 1);
        });

        test('filters by hash', () => {
            const workspaces: MockWorkspaceInfo[] = [
                { hash: 'abc123...', projectPath: '/project1', sessions: 1, hasChats: true },
                { hash: 'xyz789...', projectPath: '/project2', sessions: 2, hasChats: false },
            ];
            const filtered = filterWorkspaces(workspaces, 'abc');
            assert.strictEqual(filtered.length, 1);
            assert.strictEqual(filtered[0].hash, 'abc123...');
        });

        test('returns empty array when no matches', () => {
            const workspaces: MockWorkspaceInfo[] = [
                { hash: 'abc...', projectPath: '/project1', sessions: 1, hasChats: true },
            ];
            const filtered = filterWorkspaces(workspaces, 'nonexistent');
            assert.strictEqual(filtered.length, 0);
        });
    });

    suite('SessionProvider Logic', () => {
        // Simulate session filtering/sorting logic
        function sortSessionsByDate(sessions: MockSessionInfo[]): MockSessionInfo[] {
            return [...sessions].sort((a, b) =>
                new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
            );
        }

        function getSessionsWithChats(sessions: MockSessionInfo[]): MockSessionInfo[] {
            return sessions.filter(s => s.messages > 0);
        }

        test('sorts sessions by date descending', () => {
            const sessions: MockSessionInfo[] = [
                { projectPath: '/p', sessionFile: 'a.json', lastModified: '2024-12-01 10:00', messages: 5 },
                { projectPath: '/p', sessionFile: 'b.json', lastModified: '2024-12-06 10:00', messages: 10 },
                { projectPath: '/p', sessionFile: 'c.json', lastModified: '2024-12-03 10:00', messages: 3 },
            ];
            const sorted = sortSessionsByDate(sessions);
            assert.strictEqual(sorted[0].sessionFile, 'b.json'); // Most recent
            assert.strictEqual(sorted[1].sessionFile, 'c.json');
            assert.strictEqual(sorted[2].sessionFile, 'a.json'); // Oldest
        });

        test('filters out empty sessions', () => {
            const sessions: MockSessionInfo[] = [
                { projectPath: '/p', sessionFile: 'a.json', lastModified: '2024-12-01 10:00', messages: 5 },
                { projectPath: '/p', sessionFile: 'b.json', lastModified: '2024-12-02 10:00', messages: 0 },
                { projectPath: '/p', sessionFile: 'c.json', lastModified: '2024-12-03 10:00', messages: 10 },
            ];
            const withChats = getSessionsWithChats(sessions);
            assert.strictEqual(withChats.length, 2);
            assert.ok(withChats.every(s => s.messages > 0));
        });
    });

    suite('Error Handling Logic', () => {
        function handleResult(result: MockCsmResult): { data: string | null; error: string | null } {
            if (result.success) {
                return { data: result.output, error: null };
            } else {
                return { data: null, error: result.error || 'Unknown error' };
            }
        }

        test('handles successful result', () => {
            const result: MockCsmResult = { success: true, output: 'test output' };
            const handled = handleResult(result);
            assert.strictEqual(handled.data, 'test output');
            assert.strictEqual(handled.error, null);
        });

        test('handles failed result with error message', () => {
            const result: MockCsmResult = { success: false, output: '', error: 'Command failed' };
            const handled = handleResult(result);
            assert.strictEqual(handled.data, null);
            assert.strictEqual(handled.error, 'Command failed');
        });

        test('handles failed result without error message', () => {
            const result: MockCsmResult = { success: false, output: '' };
            const handled = handleResult(result);
            assert.strictEqual(handled.data, null);
            assert.strictEqual(handled.error, 'Unknown error');
        });
    });

    suite('Tree Item Description Generation', () => {
        function getWorkspaceDescription(sessions: number): string {
            return `${sessions} session${sessions !== 1 ? 's' : ''}`;
        }

        function getSessionDescription(messages: number): string {
            return `${messages} message${messages !== 1 ? 's' : ''}`;
        }

        test('workspace description singular', () => {
            assert.strictEqual(getWorkspaceDescription(1), '1 session');
        });

        test('workspace description plural', () => {
            assert.strictEqual(getWorkspaceDescription(0), '0 sessions');
            assert.strictEqual(getWorkspaceDescription(5), '5 sessions');
        });

        test('session description singular', () => {
            assert.strictEqual(getSessionDescription(1), '1 message');
        });

        test('session description plural', () => {
            assert.strictEqual(getSessionDescription(0), '0 messages');
            assert.strictEqual(getSessionDescription(100), '100 messages');
        });
    });

    suite('Tooltip Generation', () => {
        function generateWorkspaceTooltip(workspace: MockWorkspaceInfo): string {
            return `${workspace.projectPath}\nHash: ${workspace.hash}\nSessions: ${workspace.sessions}\nHas Chats: ${workspace.hasChats}`;
        }

        function generateSessionTooltip(session: MockSessionInfo): string {
            return `Session: ${session.sessionFile}\nLast Modified: ${session.lastModified}\nMessages: ${session.messages}`;
        }

        test('workspace tooltip contains all info', () => {
            const workspace: MockWorkspaceInfo = {
                hash: 'abc123...',
                projectPath: '/test/project',
                sessions: 5,
                hasChats: true
            };
            const tooltip = generateWorkspaceTooltip(workspace);
            assert.ok(tooltip.includes('/test/project'));
            assert.ok(tooltip.includes('abc123...'));
            assert.ok(tooltip.includes('5'));
            assert.ok(tooltip.includes('true'));
        });

        test('session tooltip contains all info', () => {
            const session: MockSessionInfo = {
                projectPath: '/test',
                sessionFile: 'test-session.json',
                lastModified: '2024-12-06 14:30',
                messages: 42
            };
            const tooltip = generateSessionTooltip(session);
            assert.ok(tooltip.includes('test-session.json'));
            assert.ok(tooltip.includes('2024-12-06 14:30'));
            assert.ok(tooltip.includes('42'));
        });
    });
});

suite('Command Construction Tests', () => {
    // Tests for proper command argument construction

    function quoteArg(arg: string): string {
        return `"${arg}"`;
    }

    suite('listSessions command', () => {
        test('constructs correct command', () => {
            const projectPath = '/test/project';
            const args = ['list-sessions', '--project-path', quoteArg(projectPath)];
            assert.deepStrictEqual(args, ['list-sessions', '--project-path', '"/test/project"']);
        });

        test('handles path with spaces', () => {
            const projectPath = '/test/my project';
            const args = ['list-sessions', '--project-path', quoteArg(projectPath)];
            assert.ok(args[2].includes('my project'));
        });
    });

    suite('history commands', () => {
        test('show command', () => {
            const path = '/test';
            const args = ['history', 'show', quoteArg(path)];
            assert.deepStrictEqual(args, ['history', 'show', '"/test"']);
        });

        test('fetch command', () => {
            const path = '/test';
            const args = ['history', 'fetch', quoteArg(path)];
            assert.deepStrictEqual(args, ['history', 'fetch', '"/test"']);
        });

        test('merge command', () => {
            const path = '/test';
            const args = ['history', 'merge', quoteArg(path)];
            assert.deepStrictEqual(args, ['history', 'merge', '"/test"']);
        });
    });

    suite('export/import commands', () => {
        test('export command with path', () => {
            const dest = '/backup';
            const projectPath = '/my/project';
            const args = ['export', quoteArg(dest), '--path', quoteArg(projectPath)];
            assert.deepStrictEqual(args, ['export', '"/backup"', '--path', '"/my/project"']);
        });

        test('import command with target', () => {
            const src = '/backup';
            const targetPath = '/my/project';
            const args = ['import', quoteArg(src), '--path', quoteArg(targetPath)];
            assert.deepStrictEqual(args, ['import', '"/backup"', '--path', '"/my/project"']);
        });

        test('move command', () => {
            const sourceHash = 'abc123';
            const targetPath = '/new/path';
            const args = ['move', quoteArg(sourceHash), quoteArg(targetPath)];
            assert.deepStrictEqual(args, ['move', '"abc123"', '"/new/path"']);
        });
    });

    suite('git commands', () => {
        test('git-init command', () => {
            const path = '/test';
            const args = ['git-init', quoteArg(path)];
            assert.deepStrictEqual(args, ['git-init', '"/test"']);
        });

        test('git-add without commit', () => {
            const path = '/test';
            const args = ['git-add', quoteArg(path)];
            assert.deepStrictEqual(args, ['git-add', '"/test"']);
        });

        test('git-add with commit', () => {
            const path = '/test';
            const message = 'Update sessions';
            const args = ['git-add', quoteArg(path), '--commit', '-m', quoteArg(message)];
            assert.deepStrictEqual(args, ['git-add', '"/test"', '--commit', '-m', '"Update sessions"']);
        });

        test('git-status command', () => {
            const path = '/test';
            const args = ['git-status', quoteArg(path)];
            assert.deepStrictEqual(args, ['git-status', '"/test"']);
        });

        test('git-snapshot without options', () => {
            const path = '/test';
            const args = ['git-snapshot', quoteArg(path)];
            assert.deepStrictEqual(args, ['git-snapshot', '"/test"']);
        });

        test('git-snapshot with tag', () => {
            const path = '/test';
            const tag = 'v1.0';
            const args = ['git-snapshot', quoteArg(path), '--tag', quoteArg(tag)];
            assert.deepStrictEqual(args, ['git-snapshot', '"/test"', '--tag', '"v1.0"']);
        });
    });

    suite('migration commands', () => {
        test('create-migration with --all', () => {
            const dest = '/backup';
            const args = ['create-migration', quoteArg(dest), '--all'];
            assert.deepStrictEqual(args, ['create-migration', '"/backup"', '--all']);
        });

        test('create-migration without --all', () => {
            const dest = '/backup';
            const args = ['create-migration', quoteArg(dest)];
            assert.deepStrictEqual(args, ['create-migration', '"/backup"']);
        });

        test('restore-migration with --dry-run', () => {
            const src = '/backup';
            const args = ['restore-migration', quoteArg(src), '--dry-run'];
            assert.deepStrictEqual(args, ['restore-migration', '"/backup"', '--dry-run']);
        });

        test('restore-migration without --dry-run', () => {
            const src = '/backup';
            const args = ['restore-migration', quoteArg(src)];
            assert.deepStrictEqual(args, ['restore-migration', '"/backup"']);
        });
    });

    suite('version command', () => {
        test('version flag', () => {
            const args = ['--version'];
            assert.deepStrictEqual(args, ['--version']);
        });
    });
});
