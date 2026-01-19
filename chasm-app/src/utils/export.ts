// Export utilities for sessions, chats, and agent runs
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { Platform, Alert, Share } from 'react-native';
import type { SessionWithMessages, Message } from '../api/sessions';
import type { ChatSession, ChatMessage } from '../api/chat';
import type { AgentRun, AgentSwarm } from '../api/agents';

export type ExportFormat = 'json' | 'markdown' | 'text';

export interface ExportOptions {
    format: ExportFormat;
    includeTimestamps?: boolean;
    includeMetadata?: boolean;
    includeTurnNumbers?: boolean;
}

// =============================================================================
// Session Export (from CSM backend)
// =============================================================================

export function formatSessionAsMarkdown(session: SessionWithMessages, options?: ExportOptions): string {
    const includeTimestamps = options?.includeTimestamps ?? true;
    const includeMetadata = options?.includeMetadata ?? true;

    let md = `# ${session.title || 'Untitled Session'}\n\n`;

    if (includeMetadata) {
        md += `**Provider:** ${session.provider}\n`;
        md += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
        md += `**Updated:** ${new Date(session.updatedAt).toLocaleString()}\n`;
        md += `**Messages:** ${session.messages?.length || 0}\n`;
        if (session.workspaceId) {
            md += `**Workspace:** ${session.workspaceId}\n`;
        }
        md += '\n---\n\n';
    }

    md += '## Conversation\n\n';

    session.messages?.forEach((message, index) => {
        const role = message.role === 'user' ? '👤 **User**' : '🤖 **Assistant**';
        const timestamp = includeTimestamps && message.createdAt
            ? ` *(${new Date(message.createdAt).toLocaleTimeString()})*`
            : '';

        md += `### ${role}${timestamp}\n\n`;
        md += `${message.content || ''}\n\n`;

        // Include tool invocations if any
        if (message.toolInvocations && message.toolInvocations.length > 0) {
            md += '#### Tool Invocations\n\n';
            message.toolInvocations.forEach(tool => {
                md += `- **${tool.toolName}**`;
                if (tool.isComplete) {
                    md += ' ✓';
                }
                md += '\n';
                if (tool.fileChanges && tool.fileChanges.length > 0) {
                    tool.fileChanges.forEach(fc => {
                        md += `  - File: ${fc.filePath || 'unknown'}\n`;
                    });
                }
            });
            md += '\n';
        }
    });

    return md;
}

export function formatSessionAsText(session: SessionWithMessages): string {
    let text = `${session.title || 'Untitled Session'}\n`;
    text += `${'='.repeat(50)}\n\n`;
    text += `Provider: ${session.provider}\n`;
    text += `Date: ${new Date(session.createdAt).toLocaleString()}\n\n`;
    text += `${'='.repeat(50)}\n\n`;

    session.messages?.forEach((message, index) => {
        const role = message.role === 'user' ? 'USER' : 'ASSISTANT';
        text += `[${role}]\n`;
        text += `${message.content || ''}\n\n`;
    });

    return text;
}

// =============================================================================
// Chat Session Export (local chat)
// =============================================================================

export function formatChatAsMarkdown(session: ChatSession, options?: ExportOptions): string {
    const includeTimestamps = options?.includeTimestamps ?? true;
    const includeTurnNumbers = options?.includeTurnNumbers ?? false;

    let md = `# ${session.title || 'Chat Session'}\n\n`;

    md += `**Provider:** ${session.provider.name}\n`;
    md += `**Model:** ${session.provider.model || 'Default'}\n`;
    md += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
    md += `**Messages:** ${session.messages.length}\n`;
    md += '\n---\n\n';

    session.messages.forEach((message, index) => {
        const turnNum = includeTurnNumbers ? `${Math.floor(index / 2) + 1}. ` : '';
        const role = message.role === 'user' ? '👤 **User**' : '🤖 **Assistant**';
        const timestamp = includeTimestamps
            ? ` *(${new Date(message.timestamp).toLocaleTimeString()})*`
            : '';

        md += `### ${turnNum}${role}${timestamp}\n\n`;
        md += `${message.content}\n\n`;

        if (message.tokens) {
            md += `*${message.tokens} tokens*\n\n`;
        }
    });

    return md;
}

export function formatChatAsText(session: ChatSession): string {
    let text = `${session.title || 'Chat Session'}\n`;
    text += `${'='.repeat(50)}\n\n`;
    text += `Provider: ${session.provider.name}\n`;
    text += `Model: ${session.provider.model || 'Default'}\n\n`;
    text += `${'='.repeat(50)}\n\n`;

    session.messages.forEach((message) => {
        const role = message.role === 'user' ? 'USER' : 'ASSISTANT';
        text += `[${role}]\n`;
        text += `${message.content}\n\n`;
    });

    return text;
}

// =============================================================================
// Agent Run Export
// =============================================================================

export function formatAgentRunAsMarkdown(run: AgentRun, options?: ExportOptions): string {
    const includeTimestamps = options?.includeTimestamps ?? true;
    const includeMetadata = options?.includeMetadata ?? true;

    let md = `# ${run.name}\n\n`;

    if (includeMetadata) {
        md += `**Status:** ${run.status}\n`;
        md += `**Started:** ${new Date(run.startedAt).toLocaleString()}\n`;
        if (run.completedAt) {
            md += `**Completed:** ${new Date(run.completedAt).toLocaleString()}\n`;
        }
        md += `**Duration:** ${formatDuration(run.startedAt, run.completedAt)}\n`;
        md += `**Tokens Used:** ${run.tokensUsed.toLocaleString()}\n`;
        if (run.cost !== undefined) {
            md += `**Cost:** $${run.cost.toFixed(4)}\n`;
        }
        md += '\n---\n\n';
    }

    if (run.description) {
        md += `## Description\n\n${run.description}\n\n`;
    }

    // Tasks
    md += '## Tasks\n\n';
    const completedTasks = run.tasks.filter(t => t.status === 'completed').length;
    md += `Progress: ${completedTasks}/${run.tasks.length} completed\n\n`;

    run.tasks.forEach(task => {
        const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
        md += `- ${checkbox} **${task.title}**`;
        if (task.status !== 'pending' && task.status !== 'completed') {
            md += ` *(${task.status})*`;
        }
        md += '\n';
        if (task.description) {
            md += `  ${task.description}\n`;
        }
    });
    md += '\n';

    // Timeline
    md += '## Timeline\n\n';
    run.messages.forEach(message => {
        const time = includeTimestamps
            ? `[${new Date(message.timestamp).toLocaleTimeString()}] `
            : '';
        const type = message.type.charAt(0).toUpperCase() + message.type.slice(1);

        md += `### ${time}${type}\n\n`;
        md += `${message.content}\n\n`;
    });

    return md;
}

// =============================================================================
// Swarm Export
// =============================================================================

export function formatSwarmAsMarkdown(swarm: AgentSwarm, options?: ExportOptions): string {
    let md = `# ${swarm.name}\n\n`;

    md += `**Status:** ${swarm.status}\n`;
    md += `**Agents:** ${swarm.agents.length}\n`;
    md += `**Tasks:** ${swarm.tasks.length}\n`;
    md += `**Created:** ${new Date(swarm.createdAt).toLocaleString()}\n`;
    md += '\n---\n\n';

    if (swarm.goalDescription) {
        md += `## Goal\n\n${swarm.goalDescription}\n\n`;
    }

    // Agents
    md += '## Agents\n\n';
    swarm.agents.forEach(agent => {
        const isCoordinator = swarm.coordinatorAgentId === agent.id;
        md += `### ${agent.name}${isCoordinator ? ' ⭐ (Coordinator)' : ''}\n\n`;
        md += `**Role:** ${agent.role}\n`;
        md += `**Status:** ${agent.status}\n`;
        if (agent.description) {
            md += `\n${agent.description}\n`;
        }
        md += '\n**Capabilities:**\n';
        (agent.capabilities || []).forEach(cap => {
            md += `- ${cap.replace('_', ' ')}\n`;
        });
        md += '\n';
    });

    // Tasks
    md += '## Tasks\n\n';
    swarm.tasks.forEach(task => {
        const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
        md += `- ${checkbox} **${task.title}** *(${task.status})*\n`;
        if (task.description) {
            md += `  ${task.description}\n`;
        }
    });

    return md;
}

// =============================================================================
// Export Actions
// =============================================================================

export async function exportToFile(
    content: string,
    filename: string,
    mimeType: string = 'text/plain'
): Promise<boolean> {
    try {
        if (Platform.OS === 'web') {
            // Web: Create download link
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
            return true;
        }

        // Mobile: Use the new expo-file-system API
        const file = new File(Paths.cache, filename);
        file.create({ overwrite: true });
        file.write(content);

        // Check if sharing is available
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
            await Sharing.shareAsync(file.uri, {
                mimeType,
                dialogTitle: `Export ${filename}`,
            });
            return true;
        } else {
            Alert.alert('Saved', `File saved to: ${file.uri}`);
            return true;
        }
    } catch (error) {
        console.error('Export error:', error);
        Alert.alert('Export Failed', 'Failed to export the file. Please try again.');
        return false;
    }
}

export async function shareContent(
    title: string,
    content: string,
    url?: string
): Promise<boolean> {
    try {
        const result = await Share.share({
            title,
            message: content,
            url,
        });

        return result.action === Share.sharedAction;
    } catch (error) {
        console.error('Share error:', error);
        return false;
    }
}

export function showExportOptions(
    title: string,
    onExport: (format: ExportFormat) => void
): void {
    Alert.alert('Export', `Export "${title}"`, [
        { text: 'Markdown', onPress: () => onExport('markdown') },
        { text: 'JSON', onPress: () => onExport('json') },
        { text: 'Text', onPress: () => onExport('text') },
        { text: 'Cancel', style: 'cancel' },
    ]);
}

// =============================================================================
// Utilities
// =============================================================================

function formatDuration(start: number, end?: number): string {
    const duration = (end || Date.now()) - start;
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}
