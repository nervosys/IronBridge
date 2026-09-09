// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// Export is the app's one lossy operation: whatever these formatters drop is
// gone from the file the user keeps.

import { describe, expect, it } from 'vitest';
import type { SessionWithMessages } from '@ironbridge/shared';
import {
  formatSessionAsMarkdown,
  formatSessionAsText,
} from '../src/utils/export';

const CREATED = Date.UTC(2026, 0, 15, 9, 30, 0);
const UPDATED = Date.UTC(2026, 0, 15, 10, 0, 0);

function makeSession(overrides: Partial<SessionWithMessages> = {}): SessionWithMessages {
  return {
    id: 'sess-1',
    workspaceId: 'ws-7',
    provider: 'copilot',
    title: 'Recovering a lost session',
    messageCount: 2,
    createdAt: CREATED,
    updatedAt: UPDATED,
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'How do I recover an orphaned session?',
        createdAt: CREATED,
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'Run `ironbridge detect orphaned`.',
        createdAt: UPDATED,
      },
    ],
    ...overrides,
  };
}

describe('formatSessionAsMarkdown', () => {
  it('writes a title, metadata and both turns', () => {
    const md = formatSessionAsMarkdown(makeSession());

    expect(md.startsWith('# Recovering a lost session\n\n')).toBe(true);
    expect(md).toContain('**Provider:** copilot');
    expect(md).toContain('**Messages:** 2');
    expect(md).toContain('**Workspace:** ws-7');
    expect(md).toContain('## Conversation');
    expect(md).toContain('👤 **User**');
    expect(md).toContain('🤖 **Assistant**');
    expect(md).toContain('How do I recover an orphaned session?');
    expect(md).toContain('Run `ironbridge detect orphaned`.');
  });

  it('omits metadata when asked to', () => {
    const md = formatSessionAsMarkdown(makeSession(), { format: 'markdown', includeMetadata: false });

    expect(md).not.toContain('**Provider:**');
    expect(md).not.toContain('---');
    expect(md).toContain('## Conversation');
  });

  it('omits per-message timestamps when asked to', () => {
    const withTimes = formatSessionAsMarkdown(makeSession(), { format: 'markdown', includeTimestamps: true });
    const without = formatSessionAsMarkdown(makeSession(), { format: 'markdown', includeTimestamps: false });

    expect(withTimes).toMatch(/### 👤 \*\*User\*\* \*\(.+\)\*/);
    expect(without).toContain('### 👤 **User**\n');
    expect(without).not.toMatch(/### 👤 \*\*User\*\* \*\(/);
  });

  it('omits the workspace line when the session has no workspace', () => {
    const md = formatSessionAsMarkdown(makeSession({ workspaceId: null }));

    expect(md).not.toContain('**Workspace:**');
  });

  it('falls back to a placeholder title', () => {
    const md = formatSessionAsMarkdown(makeSession({ title: '' }));

    expect(md.startsWith('# Untitled Session')).toBe(true);
  });

  it('records tool invocations, their completion and their file changes', () => {
    const session = makeSession();
    session.messages[1].toolInvocations = [
      {
        toolName: 'edit_file',
        isComplete: true,
        fileChanges: [{ filePath: 'src/main.rs' } as never, { filePath: 'src/lib.rs' } as never],
      },
      { toolName: 'run_command', isComplete: false },
    ];

    const md = formatSessionAsMarkdown(session);

    expect(md).toContain('#### Tool Invocations');
    expect(md).toContain('- **edit_file** ✓');
    expect(md).toContain('  - File: src/main.rs');
    expect(md).toContain('  - File: src/lib.rs');
    // An incomplete invocation is listed without the check, not hidden: a run
    // that died halfway is exactly what someone exports a session to look at.
    expect(md).toContain('- **run_command**');
    expect(md).not.toContain('- **run_command** ✓');
  });

  it('handles a session with no messages', () => {
    const md = formatSessionAsMarkdown(makeSession({ messages: [], messageCount: 0 }));

    expect(md).toContain('**Messages:** 0');
    expect(md).toContain('## Conversation');
    expect(md).not.toContain('👤');
  });

  it('keeps empty message content from becoming "undefined"', () => {
    const session = makeSession();
    session.messages[0].content = '';
    const md = formatSessionAsMarkdown(session);

    expect(md).not.toContain('undefined');
  });
});

describe('formatSessionAsText', () => {
  it('labels each turn and keeps the content', () => {
    const text = formatSessionAsText(makeSession());

    expect(text.startsWith('Recovering a lost session\n')).toBe(true);
    expect(text).toContain('='.repeat(50));
    expect(text).toContain('Provider: copilot');
    expect(text).toContain('[USER]');
    expect(text).toContain('[ASSISTANT]');
    expect(text).toContain('Run `ironbridge detect orphaned`.');
  });

  it('carries no markdown decoration', () => {
    const text = formatSessionAsText(makeSession());

    expect(text).not.toContain('##');
    expect(text).not.toContain('👤');
  });
});
