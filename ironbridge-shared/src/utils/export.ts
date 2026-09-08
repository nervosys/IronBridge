// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// Session Export Utilities
// =============================================================================
// Export sessions to various formats: JSON, Markdown, PDF

import type { Session, Message, SessionWithMessages } from '../types';
import { formatDate, formatTime } from './index';

// =============================================================================
// Export Format Types
// =============================================================================

export type ExportFormat = 'json' | 'markdown' | 'pdf' | 'html';

export interface SessionExportOptions {
    format: ExportFormat;
    includeMetadata?: boolean;
    includeTimestamps?: boolean;
    includeToolInvocations?: boolean;
    includeFileChanges?: boolean;
    title?: string;
    author?: string;
}

export interface ExportResult {
    content: string;
    mimeType: string;
    filename: string;
    blob?: Blob;
}

// =============================================================================
// JSON Export
// =============================================================================

export function exportToJson(
    session: SessionWithMessages,
    options: Partial<SessionExportOptions> = {}
): ExportResult {
    const { includeMetadata = true } = options;

    const exportData = {
        exportedAt: new Date().toISOString(),
        format: 'ironbridge-session-v1',
        session: {
            id: session.id,
            title: session.title,
            provider: session.provider,
            model: session.model,
            messageCount: session.messageCount,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            ...(includeMetadata && session.metadata ? { metadata: session.metadata } : {}),
        },
        messages: session.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            model: msg.model,
            createdAt: msg.createdAt,
            ...(options.includeToolInvocations && msg.toolInvocations?.length
                ? { toolInvocations: msg.toolInvocations }
                : {}),
            ...(includeMetadata && msg.metadata ? { metadata: msg.metadata } : {}),
        })),
    };

    const content = JSON.stringify(exportData, null, 2);
    const filename = sanitizeFilename(`${session.title || 'session'}-${session.id.slice(0, 8)}.json`);

    return {
        content,
        mimeType: 'application/json',
        filename,
        blob: new Blob([content], { type: 'application/json' }),
    };
}

// =============================================================================
// Markdown Export
// =============================================================================

export function exportToMarkdown(
    session: SessionWithMessages,
    options: Partial<SessionExportOptions> = {}
): ExportResult {
    const { includeTimestamps = true, includeToolInvocations = false, title, author } = options;

    const lines: string[] = [];

    // Header
    lines.push(`# ${title || session.title || 'Chat Session'}`);
    lines.push('');

    // Metadata block
    lines.push('---');
    lines.push(`provider: ${session.provider}`);
    if (session.model) lines.push(`model: ${session.model}`);
    lines.push(`messages: ${session.messageCount}`);
    lines.push(`created: ${formatDate(session.createdAt)}`);
    lines.push(`updated: ${formatDate(session.updatedAt)}`);
    if (author) lines.push(`author: ${author}`);
    lines.push(`exported: ${formatDate(new Date())}`);
    lines.push('---');
    lines.push('');

    // Messages
    for (const message of session.messages) {
        const roleIcon = message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️';
        const roleLabel = message.role.charAt(0).toUpperCase() + message.role.slice(1);

        if (includeTimestamps) {
            lines.push(`## ${roleIcon} ${roleLabel} (${formatTime(message.createdAt)})`);
        } else {
            lines.push(`## ${roleIcon} ${roleLabel}`);
        }
        lines.push('');
        lines.push(message.content);
        lines.push('');

        // Tool invocations
        if (includeToolInvocations && message.toolInvocations?.length) {
            lines.push('<details>');
            lines.push('<summary>Tool Invocations</summary>');
            lines.push('');
            for (const tool of message.toolInvocations) {
                lines.push(`- **${tool.toolName}** (${tool.status || 'complete'})`);
                if (tool.invocationMessage) {
                    const msg = typeof tool.invocationMessage === 'string'
                        ? tool.invocationMessage
                        : tool.invocationMessage.value || JSON.stringify(tool.invocationMessage);
                    lines.push(`  - ${msg.slice(0, 200)}${msg.length > 200 ? '...' : ''}`);
                }
            }
            lines.push('');
            lines.push('</details>');
            lines.push('');
        }
    }

    // Footer
    lines.push('---');
    lines.push(`*Exported from IronBridge on ${formatDate(new Date())}*`);

    const content = lines.join('\n');
    const filename = sanitizeFilename(`${session.title || 'session'}-${session.id.slice(0, 8)}.md`);

    return {
        content,
        mimeType: 'text/markdown',
        filename,
        blob: new Blob([content], { type: 'text/markdown' }),
    };
}

// =============================================================================
// HTML Export
// =============================================================================

export function exportToHtml(
    session: SessionWithMessages,
    options: Partial<SessionExportOptions> = {}
): ExportResult {
    const { includeTimestamps = true, title } = options;

    const escapedTitle = escapeHtml(title || session.title || 'Chat Session');

    const messageHtml = session.messages.map((msg) => {
        const roleClass = msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system';
        const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        const timestamp = includeTimestamps ? `<span class="timestamp">${formatTime(msg.createdAt)}</span>` : '';

        return `
            <div class="message ${roleClass}">
                <div class="message-header">
                    <span class="role">${roleLabel}</span>
                    ${timestamp}
                </div>
                <div class="message-content">${formatMessageContent(msg.content)}</div>
            </div>
        `;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedTitle}</title>
    <style>
        :root {
            --bg: #1a1a2e;
            --card: #16213e;
            --text: #eee;
            --muted: #888;
            --user-bg: #0f3460;
            --assistant-bg: #1a1a2e;
            --system-bg: #2d2d44;
            --border: #333;
            --accent: #e94560;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            padding: 2rem;
            max-width: 900px;
            margin: 0 auto;
        }
        h1 { margin-bottom: 0.5rem; }
        .meta { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }
        .message {
            background: var(--card);
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1rem;
            border: 1px solid var(--border);
        }
        .message.user { background: var(--user-bg); }
        .message.assistant { background: var(--assistant-bg); }
        .message.system { background: var(--system-bg); }
        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
        }
        .role { font-weight: 600; color: var(--accent); }
        .timestamp { color: var(--muted); }
        .message-content { white-space: pre-wrap; word-wrap: break-word; }
        pre {
            background: #0d0d0d;
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            margin: 0.5rem 0;
        }
        code { font-family: 'Fira Code', 'Consolas', monospace; font-size: 0.9rem; }
        .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid var(--border);
            color: var(--muted);
            font-size: 0.875rem;
            text-align: center;
        }
    </style>
</head>
<body>
    <h1>${escapedTitle}</h1>
    <div class="meta">
        <div>Provider: ${escapeHtml(session.provider)} ${session.model ? `• Model: ${escapeHtml(session.model)}` : ''}</div>
        <div>Messages: ${session.messageCount} • Created: ${formatDate(session.createdAt)}</div>
    </div>
    <div class="messages">
        ${messageHtml}
    </div>
    <div class="footer">
        Exported from IronBridge on ${formatDate(new Date())}
    </div>
</body>
</html>`;

    const filename = sanitizeFilename(`${session.title || 'session'}-${session.id.slice(0, 8)}.html`);

    return {
        content: html,
        mimeType: 'text/html',
        filename,
        blob: new Blob([html], { type: 'text/html' }),
    };
}

// =============================================================================
// PDF Export (via HTML)
// =============================================================================

export function exportToPdf(
    session: SessionWithMessages,
    options: Partial<SessionExportOptions> = {}
): ExportResult {
    // Generate HTML first, then user can print to PDF
    // For actual PDF generation, we'd need a library like jsPDF or server-side rendering
    const htmlResult = exportToHtml(session, options);

    // Add print-specific styles
    const printStyles = `
        <style media="print">
            body { background: white; color: black; padding: 1rem; }
            .message { background: #f5f5f5; border: 1px solid #ddd; }
            .message.user { background: #e3f2fd; }
            .message.assistant { background: #f5f5f5; }
            pre { background: #f0f0f0; }
            .role { color: #d32f2f; }
        </style>
    `;

    const content = htmlResult.content.replace('</head>', `${printStyles}</head>`);
    const filename = sanitizeFilename(`${session.title || 'session'}-${session.id.slice(0, 8)}.pdf.html`);

    return {
        content,
        mimeType: 'text/html',
        filename,
        blob: new Blob([content], { type: 'text/html' }),
    };
}

// =============================================================================
// Export Dispatcher
// =============================================================================

export function exportSession(
    session: SessionWithMessages,
    options: SessionExportOptions
): ExportResult {
    switch (options.format) {
        case 'json':
            return exportToJson(session, options);
        case 'markdown':
            return exportToMarkdown(session, options);
        case 'html':
            return exportToHtml(session, options);
        case 'pdf':
            return exportToPdf(session, options);
        default:
            throw new Error(`Unsupported export format: ${options.format}`);
    }
}

// =============================================================================
// Download Helper
// =============================================================================

export function downloadExport(result: ExportResult): void {
    const blob = result.blob || new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =============================================================================
// Utility Functions
// =============================================================================

function sanitizeFilename(filename: string): string {
    return filename
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 200);
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMessageContent(content: string): string {
    // Basic markdown-like formatting for code blocks
    return escapeHtml(content)
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}
