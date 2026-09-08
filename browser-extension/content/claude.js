// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// IronBridge Browser Extension - Claude Content Script
// Copyright 2025-2026 Nervosys LLC

(() => {
    'use strict';

    // Message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'extractSession':
                extractSession().then(sendResponse);
                return true;

            case 'getSelectionAsMarkdown': {
                const markdown = convertToMarkdown(message.text);
                sendResponse({ markdown });
                return true;
            }

            case 'copyToClipboard':
                navigator.clipboard.writeText(message.text);
                sendResponse({ success: true });
                return true;
        }
    });

    // Extract current session from Claude
    async function extractSession() {
        try {
            const url = new URL(window.location.href);
            const pathParts = url.pathname.split('/');
            const sessionId = pathParts[pathParts.length - 1] || generateId();

            // Get conversation title
            const titleElement = document.querySelector('[class*="conversation-title"], h1, title');
            const title = titleElement?.textContent?.replace(' - Claude', '') || 'Untitled Chat';

            // Extract messages
            const messages = extractMessages();

            if (messages.length === 0) {
                return { session: null, error: 'No messages found' };
            }

            const session = {
                id: sessionId,
                title: title.trim(),
                provider: 'claude',
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
            console.error('IronBridge: Failed to extract session', error);
            return { session: null, error: error.message };
        }
    }

    // Extract messages from the page
    function extractMessages() {
        const messages = [];

        // Claude uses a turn-based structure with human/assistant markers
        const messageContainers = document.querySelectorAll('[class*="message"], [class*="turn"], [data-testid*="message"]');

        if (messageContainers.length > 0) {
            messageContainers.forEach((container, index) => {
                const classList = container.className || '';
                const dataAttrs = JSON.stringify(container.dataset);

                // Detect role from class names or structure
                const isHuman =
                    classList.includes('human') ||
                    classList.includes('user') ||
                    dataAttrs.includes('human') ||
                    container.querySelector('[class*="human-icon"], [class*="user-icon"]') !== null;

                const role = isHuman ? 'user' : 'assistant';

                // Find the content area
                const contentDiv = container.querySelector(
                    '[class*="prose"], [class*="markdown"], [class*="message-content"], [class*="text-message"]'
                );

                const content = contentDiv?.innerHTML || container.textContent?.trim();

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
        }

        // Fallback: parse alternating blocks
        if (messages.length === 0) {
            const blocks = document.querySelectorAll('[class*="block"], [class*="response"]');
            let currentRole = 'user';

            blocks.forEach((block, index) => {
                const text = block.textContent?.trim();
                if (text && text.length > 5) {
                    messages.push({
                        id: `msg-${index}`,
                        role: currentRole,
                        content: text.substring(0, 50000),
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
        // Look for model indicator in the UI
        const modelIndicator = document.querySelector(
            '[class*="model-name"], [class*="model-selector"], [aria-label*="model"]'
        );

        if (modelIndicator) {
            const text = modelIndicator.textContent?.toLowerCase();
            if (text?.includes('opus')) return 'claude-3-opus';
            if (text?.includes('sonnet')) return 'claude-3-sonnet';
            if (text?.includes('haiku')) return 'claude-3-haiku';
            if (text?.includes('claude-4')) return 'claude-4';
        }

        // Check for Pro/Free badge
        const badge = document.querySelector('[class*="badge"], [class*="plan"]');
        if (badge?.textContent?.includes('Pro')) {
            return 'claude-3-opus'; // Pro users likely using Opus
        }

        return 'claude-3-sonnet'; // Default assumption
    }

    // Convert HTML to plain text
    function htmlToText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Handle code blocks
        temp.querySelectorAll('pre, code').forEach(el => {
            el.textContent = `\`\`\`\n${el.textContent}\n\`\`\``;
        });

        // Handle artifacts/rendered content
        temp.querySelectorAll('[class*="artifact"], [class*="rendered"]').forEach(el => {
            el.textContent = `[Artifact: ${el.getAttribute('data-type') || 'content'}]`;
        });

        return temp.textContent?.trim() || '';
    }

    // Convert text to markdown
    function convertToMarkdown(text) {
        return text
            .replace(/\n\n+/g, '\n\n')
            .trim();
    }

    // Generate random ID
    function generateId() {
        return 'claude-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // Initialize
    console.log('IronBridge: Claude content script loaded');
})();
