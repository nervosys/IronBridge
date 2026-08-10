// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// Chasm Browser Extension - Microsoft Copilot Content Script
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

    // Extract current session from Microsoft Copilot
    async function extractSession() {
        try {
            const url = new URL(window.location.href);
            const sessionId = url.searchParams.get('q') || generateId();

            // Get conversation title
            const title = extractTitle();

            // Extract messages
            const messages = extractMessages();

            if (messages.length === 0) {
                return { session: null, error: 'No messages found' };
            }

            const session = {
                id: sessionId,
                title: title,
                provider: 'copilot',
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

    // Extract title from page
    function extractTitle() {
        // Try specific Copilot title elements
        const titleEl = document.querySelector(
            '[class*="conversation-title"], [class*="chat-title"], [data-testid="title"]'
        );
        if (titleEl?.textContent) return titleEl.textContent.trim();

        // Try first user message as title
        const firstMessage = document.querySelector('[data-content="user"], [class*="user-message"]');
        if (firstMessage?.textContent) {
            const text = firstMessage.textContent.trim();
            return text.length > 50 ? text.substring(0, 47) + '...' : text;
        }

        // Fallback to document title
        return document.title?.replace(' - Microsoft Copilot', '').replace(' | Microsoft Copilot', '') || 'Untitled Chat';
    }

    // Extract messages from the page
    function extractMessages() {
        const messages = [];

        // Copilot uses cib-message-group and cib-message elements
        const messageGroups = document.querySelectorAll(
            'cib-message-group, [class*="message-group"], [data-testid*="message"]'
        );

        if (messageGroups.length > 0) {
            messageGroups.forEach((group, groupIndex) => {
                const isUser = group.getAttribute('source') === 'user' ||
                    group.classList?.contains('user') ||
                    group.querySelector('[class*="user"]') !== null;

                const role = isUser ? 'user' : 'assistant';

                // Find message content within the group
                const messageElements = group.querySelectorAll(
                    'cib-message, [class*="message-content"], [class*="text-message"]'
                );

                messageElements.forEach((msg, msgIndex) => {
                    const contentDiv = msg.querySelector(
                        '[class*="content"], [class*="text"], .ac-textBlock'
                    );

                    const content = contentDiv?.innerHTML || msg.textContent?.trim();

                    if (content && content.length > 0) {
                        messages.push({
                            id: `msg-${groupIndex}-${msgIndex}`,
                            role: role,
                            content: htmlToText(content),
                            html: content,
                            timestamp: new Date().toISOString(),
                        });
                    }
                });
            });
        }

        // Try Adaptive Card structure (used by Copilot for rich responses)
        if (messages.length === 0) {
            const adaptiveCards = document.querySelectorAll('.ac-adaptiveCard, [class*="adaptive-card"]');

            adaptiveCards.forEach((card, index) => {
                const textBlocks = card.querySelectorAll('.ac-textBlock');
                const content = Array.from(textBlocks)
                    .map(tb => tb.textContent)
                    .join('\n');

                if (content && content.length > 0) {
                    messages.push({
                        id: `msg-${index}`,
                        role: index % 2 === 0 ? 'user' : 'assistant',
                        content: content.trim(),
                        timestamp: new Date().toISOString(),
                    });
                }
            });
        }

        // Fallback: parse conversation container
        if (messages.length === 0) {
            const conversationItems = document.querySelectorAll(
                '[class*="turn"], [class*="conversation-item"], [role="listitem"]'
            );

            let currentRole = 'user';
            conversationItems.forEach((item, index) => {
                const text = item.textContent?.trim();
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

    // Detect current model/mode
    function detectModel() {
        // Check for conversation style selector
        const styleSelector = document.querySelector(
            '[class*="tone-selector"], [class*="style-option"], [aria-label*="conversation style"]'
        );

        if (styleSelector) {
            const text = styleSelector.textContent?.toLowerCase();
            if (text?.includes('creative')) return 'copilot-creative';
            if (text?.includes('balanced')) return 'copilot-balanced';
            if (text?.includes('precise')) return 'copilot-precise';
        }

        // Check for Copilot Pro indicator
        const proBadge = document.querySelector('[class*="pro"], [class*="premium"]');
        if (proBadge) return 'copilot-pro';

        // Check URL for mode hints
        if (window.location.pathname.includes('designer')) return 'copilot-designer';
        if (window.location.pathname.includes('notebook')) return 'copilot-notebook';

        return 'copilot'; // Default
    }

    // Convert HTML to plain text
    function htmlToText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Handle code blocks
        temp.querySelectorAll('pre, code, [class*="code"]').forEach(el => {
            el.textContent = `\`\`\`\n${el.textContent}\n\`\`\``;
        });

        // Handle citations/references
        temp.querySelectorAll('[class*="citation"], [class*="reference"], sup').forEach(el => {
            el.textContent = `[${el.textContent}]`;
        });

        // Handle images
        temp.querySelectorAll('img').forEach(el => {
            const alt = el.getAttribute('alt') || 'Image';
            el.textContent = `[${alt}]`;
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
        return 'copilot-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // Initialize
    console.log('Chasm: Microsoft Copilot content script loaded');
})();
