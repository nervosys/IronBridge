// Chasm Browser Extension - Perplexity Content Script
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

    // Extract current session from Perplexity
    async function extractSession() {
        try {
            const url = new URL(window.location.href);
            const threadId = url.pathname.split('/').pop() || generateId();

            // Get conversation title
            const title = extractTitle();

            // Extract messages (Perplexity calls them queries and answers)
            const messages = extractMessages();

            if (messages.length === 0) {
                return { session: null, error: 'No messages found' };
            }

            const session = {
                id: threadId,
                title: title,
                provider: 'perplexity',
                source: 'browser-extension',
                url: window.location.href,
                created_at: new Date().toISOString(),
                messages: messages,
                metadata: {
                    model: detectModel(),
                    browser: navigator.userAgent,
                    sources: extractSources(),
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
        // Try thread title
        const titleEl = document.querySelector(
            '[class*="ThreadTitle"], [class*="thread-title"], h1[class*="title"]'
        );
        if (titleEl?.textContent) return titleEl.textContent.trim();

        // Try first query as title
        const firstQuery = document.querySelector('[class*="Query"], [class*="user-query"]');
        if (firstQuery?.textContent) {
            const text = firstQuery.textContent.trim();
            return text.length > 50 ? text.substring(0, 47) + '...' : text;
        }

        // Fallback to document title
        return document.title?.replace(' - Perplexity', '').replace(' | Perplexity', '') || 'Untitled Search';
    }

    // Extract messages from the page
    function extractMessages() {
        const messages = [];

        // Perplexity uses a query-answer format
        const queryBlocks = document.querySelectorAll(
            '[class*="QueryBlock"], [class*="query-container"], [data-testid*="query"]'
        );

        queryBlocks.forEach((block, index) => {
            // Extract user query
            const queryEl = block.querySelector('[class*="Query"], [class*="user-message"]');
            if (queryEl?.textContent) {
                messages.push({
                    id: `query-${index}`,
                    role: 'user',
                    content: queryEl.textContent.trim(),
                    timestamp: new Date().toISOString(),
                });
            }

            // Extract answer
            const answerEl = block.querySelector(
                '[class*="Answer"], [class*="response"], [class*="prose"]'
            );
            if (answerEl?.innerHTML) {
                messages.push({
                    id: `answer-${index}`,
                    role: 'assistant',
                    content: htmlToText(answerEl.innerHTML),
                    html: answerEl.innerHTML,
                    timestamp: new Date().toISOString(),
                });
            }
        });

        // Fallback: try separate query and answer containers
        if (messages.length === 0) {
            const queries = document.querySelectorAll('[class*="SearchInput"], [class*="query"]');
            const answers = document.querySelectorAll('[class*="AnswerCard"], [class*="response-card"]');

            queries.forEach((query, index) => {
                const queryText = query.textContent?.trim();
                if (queryText) {
                    messages.push({
                        id: `query-${index}`,
                        role: 'user',
                        content: queryText,
                        timestamp: new Date().toISOString(),
                    });
                }

                // Get corresponding answer
                if (answers[index]) {
                    const answerContent = answers[index].innerHTML;
                    messages.push({
                        id: `answer-${index}`,
                        role: 'assistant',
                        content: htmlToText(answerContent),
                        html: answerContent,
                        timestamp: new Date().toISOString(),
                    });
                }
            });
        }

        // Another fallback for simpler page structure
        if (messages.length === 0) {
            const turns = document.querySelectorAll('[class*="turn"], [class*="message"]');
            let currentRole = 'user';

            turns.forEach((turn, index) => {
                const text = turn.textContent?.trim();
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

    // Extract sources/citations
    function extractSources() {
        const sources = [];

        const sourceElements = document.querySelectorAll(
            '[class*="Source"], [class*="citation"], [class*="reference"]'
        );

        sourceElements.forEach((el, index) => {
            const link = el.querySelector('a');
            const title = el.textContent?.trim();

            if (link || title) {
                sources.push({
                    index: index + 1,
                    title: title?.substring(0, 200) || `Source ${index + 1}`,
                    url: link?.href || null,
                });
            }
        });

        return sources;
    }

    // Detect current model
    function detectModel() {
        // Check for model selector or indicator
        const modelSelector = document.querySelector(
            '[class*="ModelSelector"], [class*="model-picker"], [aria-label*="model"]'
        );

        if (modelSelector) {
            const text = modelSelector.textContent?.toLowerCase();
            if (text?.includes('pro')) return 'perplexity-pro';
            if (text?.includes('gpt-4')) return 'gpt-4';
            if (text?.includes('claude')) return 'claude';
            if (text?.includes('sonar')) return 'perplexity-sonar';
        }

        // Check for Pro badge
        const proBadge = document.querySelector('[class*="pro-badge"], [class*="premium"]');
        if (proBadge) return 'perplexity-pro';

        return 'perplexity'; // Default
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

        // Handle citations (numbered references)
        temp.querySelectorAll('[class*="citation"], sup, [data-citation]').forEach(el => {
            const num = el.textContent?.match(/\d+/)?.[0] || '';
            el.textContent = `[${num}]`;
        });

        // Handle links with source indicators
        temp.querySelectorAll('a[class*="source"]').forEach(el => {
            const text = el.textContent;
            el.textContent = `[${text}](${el.href})`;
        });

        // Handle images
        temp.querySelectorAll('img').forEach(el => {
            el.textContent = '[Image]';
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
        return 'perplexity-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // Initialize
    console.log('Chasm: Perplexity content script loaded');
})();
