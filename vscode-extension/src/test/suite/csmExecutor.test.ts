// CSM Executor Unit Tests

import * as assert from 'assert';
import { CsmExecutor, WorkspaceInfo, SessionInfo } from '../../csmExecutor';

// Mock VS Code OutputChannel
class MockOutputChannel {
    private lines: string[] = [];

    appendLine(message: string): void {
        this.lines.push(message);
    }

    getLines(): string[] {
        return this.lines;
    }

    clear(): void {
        this.lines = [];
    }
}

// Mock vscode module for testing
const mockVscode = {
    workspace: {
        getConfiguration: (_section: string) => ({
            get: (_key: string, defaultValue: string) => defaultValue
        }),
        onDidChangeConfiguration: () => ({ dispose: () => { } })
    }
};

// Replace vscode module with mock for testing
(global as any).vscode = mockVscode;

suite('CsmExecutor Test Suite', () => {

    suite('parseWorkspaceList', () => {
        let executor: CsmExecutor;
        let mockChannel: MockOutputChannel;

        setup(() => {
            mockChannel = new MockOutputChannel();
            executor = new CsmExecutor(mockChannel as any);
        });

        test('parses empty output', () => {
            const result = executor.parseWorkspaceList('');
            assert.strictEqual(result.length, 0);
        });

        test('parses single workspace row', () => {
            const output = `
.-------------------.-------------------------------.----------.-----------.
| Hash              | Project Path                  | Sessions | Has Chats |
:-------------------+-------------------------------+----------+-----------:
| abc123def...      | /home/user/myproject          | 5        | Yes       |
'-------------------'-------------------------------'----------'-----------'
`;
            const result = executor.parseWorkspaceList(output);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].hash, 'abc123def...');
            assert.strictEqual(result[0].projectPath, '/home/user/myproject');
            assert.strictEqual(result[0].sessions, 5);
            assert.strictEqual(result[0].hasChats, true);
        });

        test('parses multiple workspace rows', () => {
            const output = `
.-------------------.-------------------------------.----------.-----------.
| Hash              | Project Path                  | Sessions | Has Chats |
:-------------------+-------------------------------+----------+-----------:
| abc123def...      | /home/user/project1           | 3        | Yes       |
| 987654321...      | /home/user/project2           | 0        | No        |
| fedcba987...      | C:\\Users\\test\\project3      | 10       | Yes       |
'-------------------'-------------------------------'----------'-----------'
`;
            const result = executor.parseWorkspaceList(output);
            assert.strictEqual(result.length, 3);

            assert.strictEqual(result[0].projectPath, '/home/user/project1');
            assert.strictEqual(result[0].sessions, 3);
            assert.strictEqual(result[0].hasChats, true);

            assert.strictEqual(result[1].projectPath, '/home/user/project2');
            assert.strictEqual(result[1].sessions, 0);
            assert.strictEqual(result[1].hasChats, false);

            assert.strictEqual(result[2].projectPath, 'C:\\Users\\test\\project3');
            assert.strictEqual(result[2].sessions, 10);
        });

        test('handles paths with spaces', () => {
            const output = `| abc123def...      | /home/user/my project name    | 2        | Yes       |`;
            const result = executor.parseWorkspaceList(output);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].projectPath, '/home/user/my project name');
        });

        test('ignores header and separator lines', () => {
            const output = `
| Hash              | Project Path                  | Sessions | Has Chats |
:-------------------+-------------------------------+----------+-----------:
| abc123def...      | /test                         | 1        | Yes       |
`;
            const result = executor.parseWorkspaceList(output);
            assert.strictEqual(result.length, 1);
        });
    });

    suite('parseSessionList', () => {
        let executor: CsmExecutor;
        let mockChannel: MockOutputChannel;

        setup(() => {
            mockChannel = new MockOutputChannel();
            executor = new CsmExecutor(mockChannel as any);
        });

        test('parses empty output', () => {
            const result = executor.parseSessionList('');
            assert.strictEqual(result.length, 0);
        });

        test('parses single session row', () => {
            const output = `
| Project Path  | Session File                         | Last Modified    | Messages |
| /test/project | a1b2c3d4-e5f6-7890-abcd-ef1234567890.json | 2024-12-06 14:30 | 42       |
`;
            const result = executor.parseSessionList(output);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].projectPath, '/test/project');
            assert.strictEqual(result[0].sessionFile, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.json');
            assert.strictEqual(result[0].lastModified, '2024-12-06 14:30');
            assert.strictEqual(result[0].messages, 42);
        });

        test('parses multiple session rows', () => {
            const output = `
| /project1 | 11111111-1111-1111-1111-111111111111.json | 2024-12-01 10:00 | 10  |
| /project2 | 22222222-2222-2222-2222-222222222222.json | 2024-12-05 15:45 | 100 |
| /project3 | 33333333-3333-3333-3333-333333333333.json | 2024-12-06 09:15 | 5   |
`;
            const result = executor.parseSessionList(output);
            assert.strictEqual(result.length, 3);

            assert.strictEqual(result[0].messages, 10);
            assert.strictEqual(result[1].messages, 100);
            assert.strictEqual(result[2].messages, 5);
        });

        test('handles Windows paths', () => {
            const output = `| C:\\Users\\test\\project | abcd1234-5678-90ab-cdef-123456789abc.json | 2024-12-06 12:00 | 25 |`;
            const result = executor.parseSessionList(output);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].projectPath, 'C:\\Users\\test\\project');
        });
    });

    suite('WorkspaceInfo interface', () => {
        test('has correct properties', () => {
            const workspace: WorkspaceInfo = {
                hash: 'abc123...',
                projectPath: '/test',
                sessions: 5,
                hasChats: true
            };

            assert.strictEqual(typeof workspace.hash, 'string');
            assert.strictEqual(typeof workspace.projectPath, 'string');
            assert.strictEqual(typeof workspace.sessions, 'number');
            assert.strictEqual(typeof workspace.hasChats, 'boolean');
        });
    });

    suite('SessionInfo interface', () => {
        test('has correct properties', () => {
            const session: SessionInfo = {
                projectPath: '/test',
                sessionFile: 'test.json',
                lastModified: '2024-12-06 12:00',
                messages: 10
            };

            assert.strictEqual(typeof session.projectPath, 'string');
            assert.strictEqual(typeof session.sessionFile, 'string');
            assert.strictEqual(typeof session.lastModified, 'string');
            assert.strictEqual(typeof session.messages, 'number');
        });
    });
});
