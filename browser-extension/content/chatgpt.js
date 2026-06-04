// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Chasm Browser Extension - ChatGPT Content Script
// Copyright 2025-2026 Nervosys LLC

(() => {
    'use strict';

    // Message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'extractSession':
                extractSession().then(sendResponse);
                return true;

            case 'getSelectionAsMarkdown':
                const markdown = convertToMarkdown(message.text);
                sendResponse({ markdown });
                return true;

            case 'copyToClipboard':
                navigator.clipboard.writeText(message.text);
                sendResponse({ success: true });
                return true;
        }
    });

    // Extract current session from ChatGPT
    async function extractSession() {
        try {
            const url = new URL(window.location.href);
            const sessionId = url.pathname.split('/c/')[1] || url.pathname.split('/g/')[1];

            // Get conversation title
            const titleElement = document.querySelector('title');
            const title = titleElement?.textContent?.replace(' | ChatGPT', '') || 'Untitled Chat';

            // Extract messages
            const messages = extractMessages();

            if (messages.length === 0) {
                return { session: null, error: 'No messages found' };
            }

            const session = {
                id: sessionId || generateId(),
                title: title,
                provider: 'chatgpt',
                source: 'browser-extension',
                url: window.location.href,
                created_at: new Date().toISOString(),
                messages: messages,
                metadata: {
                    model: detectModel(),
                    browser: navigator.userAgent,
                },
            };

            return { session };
        } catch (error) {
            console.error('Chasm: Failed to extract session', error);
            return { session: null, error: error.message };
        }
    }

    // Extract messages from the page
    function extractMessages() {
        const messages = [];

        // Try new ChatGPT UI structure (article elements)
        const articles = document.querySelectorAll('article[data-testid]');
        if (articles.length > 0) {
            articles.forEach((article, index) => {
                const isUser = article.getAttribute('data-testid')?.includes('user');
                const role = isUser ? 'user' : 'assistant';

                const contentDiv = article.querySelector('.markdown, .prose, [class*="markdown"]');
                const content = contentDiv?.innerHTML || article.textContent?.trim();

                if (content) {
                    messages.push({
                        id: `msg-${index}`,
                        role: role,
                        content: htmlToText(content),
                        html: content,
                        timestamp: new Date().toISOString(),
                    });
                }
            });
            return messages;
        }

        // Try older UI structure (turn containers)
        const turns = document.querySelectorAll('[class*="ConversationItem"], [data-message-author-role]');
        turns.forEach((turn, index) => {
            const roleAttr = turn.getAttribute('data-message-author-role');
            const isUser = roleAttr === 'user' || turn.querySelector('[class*="user"]') !== null;
            const role = isUser ? 'user' : 'assistant';

            const contentDiv = turn.querySelector('.markdown, .prose, [class*="markdown"]');
            const content = contentDiv?.innerHTML || turn.textContent?.trim();

            if (content && content.length > 0) {
                messages.push({
                    id: `msg-${index}`,
                    role: role,
                    content: htmlToText(content),
                    html: content,
                    timestamp: new Date().toISOString(),
                });
            }
        });

        // Fallback: try generic message extraction
        if (messages.length === 0) {
            const messageGroups = document.querySelectorAll('[class*="group"], [class*="message"]');
            let currentRole = 'user';

            messageGroups.forEach((group, index) => {
                const text = group.textContent?.trim();
                if (text && text.length > 10) {
                    messages.push({
                        id: `msg-${index}`,
                        role: currentRole,
                        content: text.substring(0, 50000), // Limit content size
                        timestamp: new Date().toISOString(),
                    });
                    currentRole = currentRole === 'user' ? 'assistant' : 'user';
                }
            });
        }

        return messages;
    }

    // Detect current model
    function detectModel() {
        // Look for model selector or indicator
        const modelButton = document.querySelector('[class*="model"], [aria-label*="model"]');
        if (modelButton) {
            const text = modelButton.textContent?.toLowerCase();
            if (text?.includes('gpt-4')) return 'gpt-4';
            if (text?.includes('gpt-4o')) return 'gpt-4o';
            if (text?.includes('gpt-4-turbo')) return 'gpt-4-turbo';
        }

        // Check URL for model hints
        const url = window.location.href;
        if (url.includes('/g/')) return 'gpt-4-gizmo';

        return 'unknown';
    }

    // Convert HTML to plain text
    function htmlToText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Handle code blocks
        temp.querySelectorAll('pre, code').forEach(el => {
            el.textContent = `\`\`\`\n${el.textContent}\n\`\`\``;
        });

        return temp.textContent?.trim() || '';
    }

    // Convert text to markdown
    function convertToMarkdown(text) {
        // Basic markdown conversion
        return text
            .replace(/\n\n+/g, '\n\n')
            .trim();
    }

    // Generate random ID
    function generateId() {
        return 'chatgpt-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // Inject indicator (optional visual feedback)
    function injectIndicator() {
        if (document.getElementById('chasm-indicator')) return;

        const indicator = document.createElement('div');
        indicator.id = 'chasm-indicator';
        indicator.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        background: rgba(147, 51, 234, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-family: system-ui;
        display: none;
        align-items: center;
        gap: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ">
        <span>📋</span>
        <span>Chasm Active</span>
      </div>
    `;
        document.body.appendChild(indicator);
    }

    // Initialize
    injectIndicator();
    console.log('Chasm: ChatGPT content script loaded');
})();
