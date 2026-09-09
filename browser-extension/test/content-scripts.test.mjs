// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// The six content scripts are DOM scrapers: they read a provider's chat page
// through CSS selectors that the provider is free to change without notice.
// That makes them the most breakable code in the extension and the least
// likely to announce it — a selector miss returns an empty conversation, not an
// error. Each fixture below is built from the selector path the script actually
// takes, so a rename on either side fails here.

import { describe, expect, it } from 'vitest';
import { loadContentScript } from './harness.mjs';

const providers = [
  {
    name: 'claude',
    file: 'content/claude.js',
    url: 'https://claude.ai/chat/abc123',
    expectedId: 'abc123',
    expectedTitle: 'Recovering a lost session',
    expectedModel: 'claude-3-opus',
    html: `<!doctype html><html><head><title>Recovering a lost session - Claude</title></head><body>
      <h1 class="conversation-title">Recovering a lost session</h1>
      <div class="model-name">Claude Opus 4</div>
      <div data-testid="chat-message" class="human-turn">
        <div class="prose">How do I recover an orphaned session?</div>
      </div>
      <div data-testid="chat-message" class="assistant-turn">
        <div class="prose">Run <code>ironbridge detect orphaned</code> against the project.</div>
      </div>
    </body></html>`,
  },
  {
    name: 'chatgpt',
    file: 'content/chatgpt.js',
    url: 'https://chatgpt.com/c/xyz789',
    expectedId: 'xyz789',
    html: `<!doctype html><html><head><title>Recovering a lost session</title></head><body>
      <article data-testid="conversation-turn-user">
        <div class="markdown">How do I recover an orphaned session?</div>
      </article>
      <article data-testid="conversation-turn-assistant">
        <div class="markdown">Run <code>ironbridge detect orphaned</code> against the project.</div>
      </article>
    </body></html>`,
  },
  {
    name: 'copilot',
    file: 'content/copilot.js',
    url: 'https://copilot.microsoft.com/chats/chat-42',
    html: `<!doctype html><html><head><title>Copilot</title></head><body>
      <cib-message-group source="user">
        <cib-message><div class="content">How do I recover an orphaned session?</div></cib-message>
      </cib-message-group>
      <cib-message-group source="bot">
        <cib-message><div class="content">Run <code>ironbridge detect orphaned</code>.</div></cib-message>
      </cib-message-group>
    </body></html>`,
  },
  {
    name: 'gemini',
    file: 'content/gemini.js',
    url: 'https://gemini.google.com/app/session-7',
    html: `<!doctype html><html><head><title>Gemini</title></head><body>
      <div class="conversation-turn user-turn">
        <div class="message-content">How do I recover an orphaned session?</div>
      </div>
      <div class="conversation-turn model-turn">
        <div class="response-content">Run <code>ironbridge detect orphaned</code>.</div>
      </div>
    </body></html>`,
  },
  {
    name: 'perplexity',
    file: 'content/perplexity.js',
    url: 'https://www.perplexity.ai/search/thread-9',
    html: `<!doctype html><html><head><title>Perplexity</title></head><body>
      <div class="QueryBlock">
        <div class="Query">How do I recover an orphaned session?</div>
        <div class="Answer">Run <code>ironbridge detect orphaned</code>.</div>
      </div>
    </body></html>`,
  },
  {
    name: 'poe',
    file: 'content/poe.js',
    url: 'https://poe.com/chat/chat-11',
    html: `<!doctype html><html><head><title>Poe</title></head><body>
      <div class="ChatMessage HumanMessage_row">
        <div class="Message_text">How do I recover an orphaned session?</div>
      </div>
      <div class="ChatMessage BotMessage_row">
        <div class="Message_text">Run <code>ironbridge detect orphaned</code>.</div>
      </div>
    </body></html>`,
  },
];

describe.each(providers)('$name content script', (provider) => {
  it('extracts the conversation as a user/assistant pair', async () => {
    const { send } = loadContentScript(provider.file, { html: provider.html, url: provider.url });
    const { session, error } = await send({ action: 'extractSession' });

    expect(error).toBeUndefined();
    expect(session).not.toBeNull();
    expect(session.provider).toBe(provider.name);
    expect(session.source).toBe('browser-extension');
    expect(session.url).toBe(provider.url);

    expect(session.messages).toHaveLength(2);
    expect(session.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(session.messages[0].content).toContain('orphaned session');
    expect(session.messages[1].content).toContain('ironbridge detect orphaned');

    // Every message needs an id and a timestamp: the harvest database keys on
    // the first and orders by the second.
    for (const message of session.messages) {
      expect(message.id).toBeTruthy();
      expect(Number.isNaN(Date.parse(message.timestamp))).toBe(false);
    }
  });

  it('reports an empty page rather than inventing a session', async () => {
    const { send } = loadContentScript(provider.file, {
      html: '<!doctype html><html><head><title>Empty</title></head><body></body></html>',
      url: provider.url,
    });
    const result = await send({ action: 'extractSession' });

    expect(result.session).toBeNull();
    expect(result.error).toBe('No messages found');
  });

  it('answers getSelectionAsMarkdown', async () => {
    const { send } = loadContentScript(provider.file, { html: provider.html, url: provider.url });
    const { markdown } = await send({
      action: 'getSelectionAsMarkdown',
      text: 'first paragraph\n\n\n\nsecond paragraph\n',
    });

    // Runs of blank lines collapse to one, and the result is trimmed.
    expect(markdown).toBe('first paragraph\n\nsecond paragraph');
  });

  it('renders code blocks as fenced text', async () => {
    const { send } = loadContentScript(provider.file, { html: provider.html, url: provider.url });
    const { session } = await send({ action: 'extractSession' });
    const assistant = session.messages.at(-1);

    // htmlToText fences <code> and <pre>, so a command survives the round trip
    // as a command rather than as a run-on sentence.
    expect(assistant.content).toContain('```');
    expect(assistant.content).toMatch(/```\s*ironbridge detect orphaned\s*```/);
  });
});

describe('claude content script specifics', () => {
  const claude = providers[0];

  it('takes the session id from the URL and the title from the page', async () => {
    const { send } = loadContentScript(claude.file, { html: claude.html, url: claude.url });
    const { session } = await send({ action: 'extractSession' });

    expect(session.id).toBe(claude.expectedId);
    expect(session.title).toBe(claude.expectedTitle);
  });

  it('reads the model out of the UI instead of guessing', async () => {
    const { send } = loadContentScript(claude.file, { html: claude.html, url: claude.url });
    const { session } = await send({ action: 'extractSession' });

    expect(session.metadata.model).toBe(claude.expectedModel);
  });

  it('falls back to a generated id when the URL carries none', async () => {
    const { send } = loadContentScript(claude.file, { html: claude.html, url: 'https://claude.ai/' });
    const { session } = await send({ action: 'extractSession' });

    expect(session.id).toMatch(/^claude-/);
  });
});

describe('chatgpt content script specifics', () => {
  const chatgpt = providers[1];

  it('reads the role from data-testid, not from document order', async () => {
    // Assistant first: a script that alternated roles by position would label
    // this backwards.
    const html = `<!doctype html><html><head><title>Reversed</title></head><body>
      <article data-testid="conversation-turn-assistant">
        <div class="markdown">I answered first.</div>
      </article>
      <article data-testid="conversation-turn-user">
        <div class="markdown">And I asked second.</div>
      </article>
    </body></html>`;
    const { send } = loadContentScript(chatgpt.file, { html, url: chatgpt.url });
    const { session } = await send({ action: 'extractSession' });

    expect(session.messages.map((m) => m.role)).toEqual(['assistant', 'user']);
  });
});
