// Unit Tests for Parsing Logic
// These tests can run without VS Code extension host

import * as assert from 'assert';

suite('Parsing Logic Unit Tests', () => {

    suite('Workspace List Parsing', () => {
        // Regex pattern used in parseWorkspaceList
        const workspacePattern = /\|\s*([a-f0-9]+\.\.\.)\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(Yes|No)\s*\|/;

        test('matches valid workspace line', () => {
            const line = '| abc123def...      | /home/user/project           | 5        | Yes       |';
            const match = line.match(workspacePattern);
            assert.ok(match, 'Should match valid workspace line');
            assert.strictEqual(match![1], 'abc123def...');
            assert.strictEqual(match![2].trim(), '/home/user/project');
            assert.strictEqual(match![3], '5');
            assert.strictEqual(match![4], 'Yes');
        });

        test('does not match header line', () => {
            const line = '| Hash              | Project Path                  | Sessions | Has Chats |';
            const match = line.match(workspacePattern);
            assert.ok(!match, 'Should not match header line');
        });

        test('does not match separator line', () => {
            const line = ':-------------------+-------------------------------+----------+-----------:';
            const match = line.match(workspacePattern);
            assert.ok(!match, 'Should not match separator line');
        });

        test('handles paths with various characters', () => {
            const testCases = [
                '/simple/path',
                '/path with spaces',
                'C:\\Windows\\Path',
                '/path/with-dashes_and_underscores',
                '/path/with.dots',
            ];

            for (const testPath of testCases) {
                const line = `| abc123def...      | ${testPath.padEnd(30)} | 1        | Yes       |`;
                const match = line.match(workspacePattern);
                assert.ok(match, `Should match path: ${testPath}`);
            }
        });

        test('parses session count correctly', () => {
            const testCases = [
                { line: '| abc123def...      | /test                          | 0        | No        |', expected: 0 },
                { line: '| abc123def...      | /test                          | 1        | Yes       |', expected: 1 },
                { line: '| abc123def...      | /test                          | 999      | Yes       |', expected: 999 },
            ];

            for (const { line, expected } of testCases) {
                const match = line.match(workspacePattern);
                assert.ok(match);
                assert.strictEqual(parseInt(match![3], 10), expected);
            }
        });

        test('parses hasChats flag correctly', () => {
            const yesLine = '| abc123def...      | /test                          | 1        | Yes       |';
            const noLine = '| abc123def...      | /test                          | 0        | No        |';

            const yesMatch = yesLine.match(workspacePattern);
            const noMatch = noLine.match(workspacePattern);

            assert.strictEqual(yesMatch![4], 'Yes');
            assert.strictEqual(noMatch![4], 'No');
        });
    });

    suite('Session List Parsing', () => {
        // Regex pattern used in parseSessionList
        const sessionPattern = /\|\s*(.+?)\s*\|\s*([a-f0-9-]+\.json)\s*\|\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\|\s*(\d+)\s*\|/;

        test('matches valid session line', () => {
            const line = '| /test/project | a1b2c3d4-e5f6-7890-abcd-ef1234567890.json | 2024-12-06 14:30 | 42       |';
            const match = line.match(sessionPattern);
            assert.ok(match, 'Should match valid session line');
            assert.strictEqual(match![1].trim(), '/test/project');
            assert.strictEqual(match![2], 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.json');
            assert.strictEqual(match![3], '2024-12-06 14:30');
            assert.strictEqual(match![4], '42');
        });

        test('validates UUID format in session filename', () => {
            const validUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.json';
            const line = `| /test | ${validUUID} | 2024-12-06 14:30 | 10 |`;
            const match = line.match(sessionPattern);
            assert.ok(match, 'Should match valid UUID format');
        });

        test('validates date format', () => {
            const validDates = [
                '2024-01-01 00:00',
                '2024-12-31 23:59',
                '2025-06-15 12:30',
            ];

            for (const date of validDates) {
                const line = `| /test | a1b2c3d4-e5f6-7890-abcd-ef1234567890.json | ${date} | 10 |`;
                const match = line.match(sessionPattern);
                assert.ok(match, `Should match date: ${date}`);
                assert.strictEqual(match![3], date);
            }
        });

        test('parses message count correctly', () => {
            const testCases = [
                { count: '0', expected: 0 },
                { count: '1', expected: 1 },
                { count: '100', expected: 100 },
                { count: '9999', expected: 9999 },
            ];

            for (const { count, expected } of testCases) {
                const line = `| /test | a1b2c3d4-e5f6-7890-abcd-ef1234567890.json | 2024-12-06 14:30 | ${count} |`;
                const match = line.match(sessionPattern);
                assert.ok(match);
                assert.strictEqual(parseInt(match![4], 10), expected);
            }
        });
    });

    suite('Icon Selection Logic', () => {
        function getSessionIcon(messageCount: number): string {
            if (messageCount > 100) {
                return 'comment-discussion';
            } else if (messageCount > 10) {
                return 'comment';
            } else {
                return 'comment-draft';
            }
        }

        test('returns comment-discussion for > 100 messages', () => {
            assert.strictEqual(getSessionIcon(101), 'comment-discussion');
            assert.strictEqual(getSessionIcon(500), 'comment-discussion');
            assert.strictEqual(getSessionIcon(1000), 'comment-discussion');
        });

        test('returns comment for 11-100 messages', () => {
            assert.strictEqual(getSessionIcon(11), 'comment');
            assert.strictEqual(getSessionIcon(50), 'comment');
            assert.strictEqual(getSessionIcon(100), 'comment');
        });

        test('returns comment-draft for <= 10 messages', () => {
            assert.strictEqual(getSessionIcon(0), 'comment-draft');
            assert.strictEqual(getSessionIcon(1), 'comment-draft');
            assert.strictEqual(getSessionIcon(10), 'comment-draft');
        });

        test('boundary cases', () => {
            assert.strictEqual(getSessionIcon(10), 'comment-draft');
            assert.strictEqual(getSessionIcon(11), 'comment');
            assert.strictEqual(getSessionIcon(100), 'comment');
            assert.strictEqual(getSessionIcon(101), 'comment-discussion');
        });
    });

    suite('Context Value Logic', () => {
        function getWorkspaceContextValue(hasChats: boolean): string {
            return hasChats ? 'workspaceWithChats' : 'workspace';
        }

        test('returns workspaceWithChats when hasChats is true', () => {
            assert.strictEqual(getWorkspaceContextValue(true), 'workspaceWithChats');
        });

        test('returns workspace when hasChats is false', () => {
            assert.strictEqual(getWorkspaceContextValue(false), 'workspace');
        });
    });

    suite('HTML Escaping', () => {
        function escapeHtml(text: string): string {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        test('escapes ampersand', () => {
            assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
        });

        test('escapes less than', () => {
            assert.strictEqual(escapeHtml('a < b'), 'a &lt; b');
        });

        test('escapes greater than', () => {
            assert.strictEqual(escapeHtml('a > b'), 'a &gt; b');
        });

        test('escapes double quotes', () => {
            assert.strictEqual(escapeHtml('a "b" c'), 'a &quot;b&quot; c');
        });

        test('escapes single quotes', () => {
            assert.strictEqual(escapeHtml("a 'b' c"), 'a &#039;b&#039; c');
        });

        test('handles multiple special characters', () => {
            const input = '<script>alert("XSS & \'test\'")</script>';
            const expected = '&lt;script&gt;alert(&quot;XSS &amp; &#039;test&#039;&quot;)&lt;/script&gt;';
            assert.strictEqual(escapeHtml(input), expected);
        });

        test('handles empty string', () => {
            assert.strictEqual(escapeHtml(''), '');
        });

        test('handles string without special characters', () => {
            const input = 'Hello World 123';
            assert.strictEqual(escapeHtml(input), input);
        });
    });

    suite('Command Argument Construction', () => {
        function buildCommand(binaryPath: string, args: string[]): string {
            return `"${binaryPath}" ${args.join(' ')}`;
        }

        test('builds simple command', () => {
            const cmd = buildCommand('csm', ['ls']);
            assert.strictEqual(cmd, '"csm" ls');
        });

        test('builds command with quoted path', () => {
            const cmd = buildCommand('csm', ['find', '"my project"']);
            assert.strictEqual(cmd, '"csm" find "my project"');
        });

        test('builds complex command', () => {
            const cmd = buildCommand('csm', ['history', 'merge', '"/path/to/project"', '--force']);
            assert.strictEqual(cmd, '"csm" history merge "/path/to/project" --force');
        });

        test('handles empty args', () => {
            const cmd = buildCommand('csm', []);
            assert.strictEqual(cmd, '"csm" ');
        });

        test('handles path with spaces', () => {
            const cmd = buildCommand('C:\\Program Files\\csm\\csm.exe', ['ls']);
            assert.strictEqual(cmd, '"C:\\Program Files\\csm\\csm.exe" ls');
        });
    });
});
