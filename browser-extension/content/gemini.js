// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Chasm Browser Extension - Gemini Content Script
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

    // Extract current session from Gemini
    async function extractSession() {
        try {
            const url = new URL(window.location.href);
            const sessionId = url.searchParams.get('c') || generateId();

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
                provider: 'gemini',
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
        // Try conversation title element
        const titleEl = document.querySelector('[class*="conversation-title"], [class*="chat-title"]');
        if (titleEl?.textContent) return titleEl.textContent.trim();

        // Try first user message as title
        const firstMessage = document.querySelector('[class*="user-message"], [data-message-author="user"]');
        if (firstMessage?.textContent) {
            const text = firstMessage.textContent.trim();
            return text.length > 50 ? text.substring(0, 47) + '...' : text;
        }

        // Fallback to document title
        return document.title?.replace(' - Google Gemini', '') || 'Untitled Chat';
    }

    // Extract messages from the page
    function extractMessages() {
        const messages = [];

        // Gemini uses turn-based structure
        const turns = document.querySelectorAll(
            '[class*="conversation-turn"], [class*="message-row"], [data-turn-index]'
        );

        if (turns.length > 0) {
            turns.forEach((turn, index) => {
                const classList = turn.className || '';
                const dataAttrs = JSON.stringify(turn.dataset);

                // Detect role
                const isUser =
                    classList.includes('user') ||
                    dataAttrs.includes('user') ||
                    turn.querySelector('[class*="user-avatar"]') !== null;

                const role = isUser ? 'user' : 'assistant';

                // Find content
                const contentDiv = turn.querySelector(
                    '[class*="response-content"], [class*="message-content"], [class*="markdown"]'
                );

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
        }

        // Try alternative selectors for Gemini's varying UI
        if (messages.length === 0) {
            // Look for message bubbles
            const bubbles = document.querySelectorAll('[class*="bubble"], [class*="chat-message"]');
            let currentRole = 'user';

            bubbles.forEach((bubble, index) => {
                const text = bubble.textContent?.trim();
                if (text && text.length > 2) {
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

        // Try mat-list-item elements (Material Design components)
        if (messages.length === 0) {
            const matItems = document.querySelectorAll('mat-list-item, [role="listitem"]');
            let currentRole = 'user';

            matItems.forEach((item, index) => {
                const text = item.textContent?.trim();
                if (text && text.length > 10) {
                    messages.push({
                        id: `msg-${index}`,
                        role: currentRole,
                        content: text,
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
        const modelSelector = document.querySelector(
            '[class*="model-selector"], [aria-label*="model"], [class*="model-picker"]'
        );

        if (modelSelector) {
            const text = modelSelector.textContent?.toLowerCase();
            if (text?.includes('ultra')) return 'gemini-ultra';
            if (text?.includes('pro')) return 'gemini-pro';
            if (text?.includes('flash')) return 'gemini-flash';
            if (text?.includes('advanced')) return 'gemini-advanced';
        }

        // Check URL for hints
        if (window.location.pathname.includes('advanced')) {
            return 'gemini-advanced';
        }

        return 'gemini-pro'; // Default
    }

    // Convert HTML to plain text
    function htmlToText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Handle code blocks
        temp.querySelectorAll('pre, code, [class*="code-block"]').forEach(el => {
            el.textContent = `\`\`\`\n${el.textContent}\n\`\`\``;
        });

        // Handle images/charts
        temp.querySelectorAll('img, [class*="chart"], [class*="image"]').forEach(el => {
            el.textContent = '[Image/Chart]';
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
        return 'gemini-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // Initialize
    console.log('Chasm: Gemini content script loaded');
})();
