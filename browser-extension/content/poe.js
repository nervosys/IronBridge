// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// Chasm Browser Extension - Poe Content Script
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

    // Extract current session from Poe
    async function extractSession() {
        try {
            const url = new URL(window.location.href);
            const pathParts = url.pathname.split('/');
            const sessionId = pathParts[pathParts.length - 1] || generateId();

            // Get conversation title and bot info
            const { title, botName } = extractTitleAndBot();

            // Extract messages
            const messages = extractMessages();

            if (messages.length === 0) {
                return { session: null, error: 'No messages found' };
            }

            const session = {
                id: sessionId,
                title: title,
                provider: 'poe',
                source: 'browser-extension',
                url: window.location.href,
                created_at: new Date().toISOString(),
                messages: messages,
                metadata: {
                    model: botName || detectBot(),
                    browser: navigator.userAgent,
                },
            };

            return { session };
        } catch (error) {
            console.error('Chasm: Failed to extract session', error);
            return { session: null, error: error.message };
        }
    }

    // Extract title and bot name
    function extractTitleAndBot() {
        // Try to find bot name from header
        const botHeader = document.querySelector(
            '[class*="BotHeader"], [class*="bot-name"], [class*="ChatHeader"]'
        );
        const botName = botHeader?.textContent?.trim();

        // Try conversation title
        const titleEl = document.querySelector('[class*="ConversationTitle"], [class*="chat-title"]');
        let title = titleEl?.textContent?.trim();

        // If no title, use first user message
        if (!title) {
            const firstMessage = document.querySelector('[class*="HumanMessage"], [class*="user-message"]');
            if (firstMessage?.textContent) {
                const text = firstMessage.textContent.trim();
                title = text.length > 50 ? text.substring(0, 47) + '...' : text;
            }
        }

        // Fallback
        if (!title) {
            title = botName ? `Chat with ${botName}` : 'Untitled Chat';
        }

        return { title, botName };
    }

    // Extract messages from the page
    function extractMessages() {
        const messages = [];

        // Poe uses specific message wrapper classes
        const messageWrappers = document.querySelectorAll(
            '[class*="Message_row"], [class*="ChatMessage"], [class*="message-wrapper"]'
        );

        if (messageWrappers.length > 0) {
            messageWrappers.forEach((wrapper, index) => {
                const classList = wrapper.className || '';

                // Detect role from class names
                const isHuman =
                    classList.includes('human') ||
                    classList.includes('Human') ||
                    classList.includes('user') ||
                    wrapper.querySelector('[class*="HumanMessage"]') !== null;

                const role = isHuman ? 'user' : 'assistant';

                // Find the message content
                const contentDiv = wrapper.querySelector(
                    '[class*="Message_text"], [class*="Markdown"], [class*="prose"], [class*="message-content"]'
                );

                const content = contentDiv?.innerHTML || wrapper.textContent?.trim();

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

        // Fallback: try generic message selectors
        if (messages.length === 0) {
            const chatMessages = document.querySelectorAll('[class*="chat"] [class*="message"]');
            let currentRole = 'user';

            chatMessages.forEach((msg, index) => {
                const text = msg.textContent?.trim();
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

        return messages;
    }

    // Detect which bot is being used
    function detectBot() {
        // Check URL for bot name
        const url = new URL(window.location.href);
        const pathMatch = url.pathname.match(/\/(chat|[A-Za-z-_]+Bot|Claude|GPT|Gemini|Llama|Assistant)/i);
        if (pathMatch) return pathMatch[1];

        // Check header for bot indicator
        const botIndicator = document.querySelector(
            '[class*="BotName"], [class*="bot-selector"], [aria-label*="bot"]'
        );

        if (botIndicator) {
            const text = botIndicator.textContent?.toLowerCase();
            if (text?.includes('claude')) return 'Claude-3';
            if (text?.includes('gpt-4')) return 'GPT-4';
            if (text?.includes('gpt')) return 'ChatGPT';
            if (text?.includes('gemini')) return 'Gemini-Pro';
            if (text?.includes('llama')) return 'Llama';
            if (text?.includes('mistral')) return 'Mistral';
            if (text?.includes('assistant')) return 'Assistant';
        }

        return 'poe-bot';
    }

    // Convert HTML to plain text
    function htmlToText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Handle code blocks
        temp.querySelectorAll('pre, code').forEach(el => {
            const lang = el.className?.match(/language-(\w+)/)?.[1] || '';
            el.textContent = `\`\`\`${lang}\n${el.textContent}\n\`\`\``;
        });

        // Handle LaTeX/math
        temp.querySelectorAll('[class*="katex"], [class*="math"]').forEach(el => {
            el.textContent = `$${el.textContent}$`;
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
        return 'poe-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // Initialize
    console.log('Chasm: Poe content script loaded');
})();
