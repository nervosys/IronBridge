import { apiClient } from './client';
import { OAuthProviderType, mapChatProviderToOAuth } from './oauth';
import { oauthService } from '../services/oauth';

// Chat Provider Types
export type ChatProviderType =
    | 'openai'
    | 'anthropic'
    | 'azure-openai'
    | 'openrouter'
    | 'groq'
    | 'together'
    | 'google'
    | 'custom';

// Authentication method for providers
export type AuthMethod = 'api-key' | 'oauth';

// Re-export OAuth types for convenience
export type { OAuthProviderType } from './oauth';
export { OAUTH_PROVIDERS, SCOPE_DESCRIPTIONS, mapChatProviderToOAuth } from './oauth';

export interface ChatProvider {
    id: string;
    type: ChatProviderType;
    name: string;
    baseUrl?: string;
    apiKey?: string;
    model: string;
    isEnabled: boolean;
    isDefault?: boolean;
    authMethod?: AuthMethod;
    // OAuth tokens (managed by AuthContext, stored securely)
    oauthProvider?: OAuthProviderType;
    oauthConnected?: boolean;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    model?: string;
    tokens?: number;
    isStreaming?: boolean;
    error?: string;
}

export interface ChatSession {
    id: string;
    title: string;
    provider: ChatProvider;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
}

export interface ChatCompletionRequest {
    provider: ChatProvider;
    messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>;
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
}

export interface ChatCompletionResponse {
    id: string;
    content: string;
    model: string;
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
    finishReason?: string;
}

// Default provider configurations (mobile-compatible only)
export const DEFAULT_PROVIDERS: Omit<ChatProvider, 'apiKey'>[] = [
    {
        id: 'openai-gpt4',
        type: 'openai',
        name: 'OpenAI GPT-4o',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        isEnabled: false,
        authMethod: 'api-key',
        oauthProvider: 'openai',
    },
    {
        id: 'openai-gpt4-mini',
        type: 'openai',
        name: 'OpenAI GPT-4o Mini',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        isEnabled: false,
        authMethod: 'api-key',
        oauthProvider: 'openai',
    },
    {
        id: 'anthropic-claude',
        type: 'anthropic',
        name: 'Claude 3.5 Sonnet',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-5-sonnet-20241022',
        isEnabled: false,
        authMethod: 'api-key',
        oauthProvider: 'anthropic',
    },
    {
        id: 'anthropic-haiku',
        type: 'anthropic',
        name: 'Claude 3.5 Haiku',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-5-haiku-20241022',
        isEnabled: false,
        authMethod: 'api-key',
        oauthProvider: 'anthropic',
    },
    {
        id: 'google-gemini',
        type: 'google',
        name: 'Google Gemini Pro',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-1.5-pro',
        isEnabled: false,
        authMethod: 'api-key',
        oauthProvider: 'google',
    },
    {
        id: 'azure-openai',
        type: 'azure-openai',
        name: 'Azure OpenAI',
        baseUrl: '', // User must configure endpoint
        model: 'gpt-4',
        isEnabled: false,
        authMethod: 'api-key',
        oauthProvider: 'azure',
    },
    {
        id: 'groq-llama',
        type: 'groq',
        name: 'Groq Llama',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
        isEnabled: false,
        authMethod: 'api-key',
    },
    {
        id: 'openrouter',
        type: 'openrouter',
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-3.5-sonnet',
        isEnabled: false,
        authMethod: 'api-key',
    },
    {
        id: 'together-llama',
        type: 'together',
        name: 'Together AI',
        baseUrl: 'https://api.together.xyz/v1',
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        isEnabled: false,
        authMethod: 'api-key',
    },
];

// Generate unique ID
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create a new chat session
export function createChatSession(provider: ChatProvider, title?: string): ChatSession {
    return {
        id: generateId(),
        title: title || 'New Chat',
        provider,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

// Format messages for API request
function formatMessagesForProvider(
    messages: ChatMessage[],
    providerType: ChatProviderType
): Array<{ role: string; content: string }> {
    return messages
        .filter(m => !m.isStreaming && !m.error)
        .map(m => ({
            role: m.role,
            content: m.content,
        }));
}

// Get authorization header for a provider (supports both API key and OAuth)
async function getAuthHeader(provider: ChatProvider): Promise<Record<string, string>> {
    // If OAuth is configured and connected, use OAuth token
    if (provider.authMethod === 'oauth' && provider.oauthProvider && provider.oauthConnected) {
        const token = await oauthService.getAccessToken(provider.oauthProvider);
        if (token) {
            return { 'Authorization': `Bearer ${token}` };
        }
    }

    // Fall back to API key
    if (provider.apiKey) {
        if (provider.type === 'anthropic') {
            return { 'x-api-key': provider.apiKey };
        }
        if (provider.type === 'azure-openai') {
            return { 'api-key': provider.apiKey };
        }
        return { 'Authorization': `Bearer ${provider.apiKey}` };
    }

    return {};
}

// Send chat completion request
export async function sendChatCompletion(
    request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
    const { provider, messages, temperature = 0.7, maxTokens = 4096 } = request;
    const authHeaders = await getAuthHeader(provider);

    // Build request based on provider type
    switch (provider.type) {
        case 'openai':
        case 'groq':
        case 'openrouter':
        case 'together':
        case 'custom': {
            const response = await fetch(`${provider.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                    ...(provider.type === 'openrouter' && {
                        'HTTP-Referer': 'https://github.com/nervosys/ChatSessionManager',
                        'X-Title': 'CSM Mobile App',
                    }),
                },
                body: JSON.stringify({
                    model: provider.model,
                    messages: formatMessagesForProvider(messages as any, provider.type),
                    temperature,
                    max_tokens: maxTokens,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API Error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return {
                id: data.id || generateId(),
                content: data.choices[0]?.message?.content || '',
                model: data.model || provider.model,
                tokens: data.usage ? {
                    prompt: data.usage.prompt_tokens,
                    completion: data.usage.completion_tokens,
                    total: data.usage.total_tokens,
                } : undefined,
                finishReason: data.choices[0]?.finish_reason,
            };
        }

        case 'anthropic': {
            const response = await fetch(`${provider.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: provider.model,
                    messages: formatMessagesForProvider(messages as any, provider.type),
                    max_tokens: maxTokens,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API Error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return {
                id: data.id || generateId(),
                content: data.content[0]?.text || '',
                model: data.model || provider.model,
                tokens: data.usage ? {
                    prompt: data.usage.input_tokens,
                    completion: data.usage.output_tokens,
                    total: data.usage.input_tokens + data.usage.output_tokens,
                } : undefined,
                finishReason: data.stop_reason,
            };
        }

        case 'azure-openai': {
            // Azure OpenAI has a different URL structure
            const response = await fetch(`${provider.baseUrl}/chat/completions?api-version=2024-02-15-preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                },
                body: JSON.stringify({
                    messages: formatMessagesForProvider(messages as any, provider.type),
                    temperature,
                    max_tokens: maxTokens,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API Error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return {
                id: data.id || generateId(),
                content: data.choices[0]?.message?.content || '',
                model: data.model || provider.model,
                tokens: data.usage ? {
                    prompt: data.usage.prompt_tokens,
                    completion: data.usage.completion_tokens,
                    total: data.usage.total_tokens,
                } : undefined,
                finishReason: data.choices[0]?.finish_reason,
            };
        }

        case 'google': {
            // Google Gemini API format
            const geminiMessages = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

            // Use API key in URL for Gemini
            const apiKey = provider.oauthConnected && provider.oauthProvider
                ? await oauthService.getAccessToken(provider.oauthProvider)
                : provider.apiKey;

            const response = await fetch(
                `${provider.baseUrl}/models/${provider.model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: geminiMessages,
                        generationConfig: {
                            temperature,
                            maxOutputTokens: maxTokens,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API Error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];
            return {
                id: generateId(),
                content: candidate?.content?.parts?.[0]?.text || '',
                model: provider.model,
                tokens: data.usageMetadata ? {
                    prompt: data.usageMetadata.promptTokenCount || 0,
                    completion: data.usageMetadata.candidatesTokenCount || 0,
                    total: data.usageMetadata.totalTokenCount || 0,
                } : undefined,
                finishReason: candidate?.finishReason,
            };
        }

        default:
            throw new Error(`Unsupported provider type: ${provider.type}`);
    }
}

// Test provider connection
export async function testProviderConnection(provider: ChatProvider): Promise<boolean> {
    try {
        const testMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: 'Say "Hello" and nothing else.',
            timestamp: Date.now(),
        };

        await sendChatCompletion({
            provider,
            messages: [testMessage],
            maxTokens: 10,
        });

        return true;
    } catch (error) {
        console.error('Provider test failed:', error);
        return false;
    }
}
// =============================================================================
// CSM Introspection (MCP Tools)
// =============================================================================

export interface McpTool {
    name: string;
    description: string | null;
    input_schema: Record<string, unknown>;
}

export interface ToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

export interface ToolCallResult {
    tool: string;
    result: {
        content: Array<{
            type: string;
            text: string;
        }>;
        isError?: boolean;
    };
}

// Fetch available CSM tools
export async function getCsmTools(): Promise<McpTool[]> {
    const { apiClient } = await import('./client');
    try {
        const response = await apiClient.get('/mcp/tools');
        return response.data?.mcp_tools || [];
    } catch (error) {
        console.error('Failed to fetch CSM tools:', error);
        return [];
    }
}

// Get system prompt with CSM context
export async function getCsmSystemPrompt(): Promise<string> {
    const { apiClient } = await import('./client');
    try {
        const response = await apiClient.get('/mcp/system-prompt');
        return response.data?.system_prompt || '';
    } catch (error) {
        console.error('Failed to fetch CSM system prompt:', error);
        return '';
    }
}

// Execute a CSM tool call
export async function callCsmTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const { apiClient } = await import('./client');
    try {
        const response = await apiClient.post('/mcp/call', {
            name,
            arguments: args,
        });
        return response.data;
    } catch (error) {
        console.error('Failed to call CSM tool:', error);
        return {
            tool: name,
            result: {
                content: [{ type: 'text', text: `Error calling tool: ${error}` }],
                isError: true,
            },
        };
    }
}

// Send chat completion with CSM tools support
export async function sendChatCompletionWithTools(
    request: ChatCompletionRequest & { enableCsmTools?: boolean }
): Promise<ChatCompletionResponse & { toolCalls?: Array<{ name: string; arguments: string }> }> {
    const { provider, messages, temperature = 0.7, maxTokens = 4096, enableCsmTools } = request;

    // Get CSM tools if enabled
    let tools: Array<Record<string, unknown>> = [];
    let systemPrompt: string | undefined;

    if (enableCsmTools) {
        const csmTools = await getCsmTools();
        tools = csmTools
            .filter(t => t.name.startsWith('csm_db_')) // Only database tools for chat
            .map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.input_schema,
                },
            }));
        systemPrompt = await getCsmSystemPrompt();
    }

    // Build messages with system prompt if CSM tools enabled
    const finalMessages = systemPrompt
        ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
        : messages;

    // Only OpenAI and Anthropic support tool calling well
    if (!['openai', 'anthropic'].includes(provider.type)) {
        return sendChatCompletion(request);
    }

    if (provider.type === 'openai') {
        const requestBody: Record<string, unknown> = {
            model: provider.model,
            messages: formatMessagesForProvider(finalMessages as any, provider.type),
            temperature,
            max_tokens: maxTokens,
        };

        if (tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = 'auto';
        }

        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${provider.apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const choice = data.choices[0];

        // Check if model wants to call tools
        if (choice?.message?.tool_calls) {
            return {
                id: data.id || generateId(),
                content: choice.message.content || '',
                model: data.model || provider.model,
                toolCalls: choice.message.tool_calls.map((tc: any) => ({
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                })),
                tokens: data.usage ? {
                    prompt: data.usage.prompt_tokens,
                    completion: data.usage.completion_tokens,
                    total: data.usage.total_tokens,
                } : undefined,
                finishReason: choice.finish_reason,
            };
        }

        return {
            id: data.id || generateId(),
            content: choice?.message?.content || '',
            model: data.model || provider.model,
            tokens: data.usage ? {
                prompt: data.usage.prompt_tokens,
                completion: data.usage.completion_tokens,
                total: data.usage.total_tokens,
            } : undefined,
            finishReason: choice?.finish_reason,
        };
    }

    if (provider.type === 'anthropic') {
        const anthropicTools = tools.map(t => ({
            name: (t.function as any).name,
            description: (t.function as any).description,
            input_schema: (t.function as any).parameters,
        }));

        const requestBody: Record<string, unknown> = {
            model: provider.model,
            messages: formatMessagesForProvider(finalMessages as any, provider.type),
            max_tokens: maxTokens,
        };

        if (systemPrompt) {
            requestBody.system = systemPrompt;
        }

        if (anthropicTools.length > 0) {
            requestBody.tools = anthropicTools;
        }

        const response = await fetch(`${provider.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': provider.apiKey || '',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error: ${response.status} - ${error}`);
        }

        const data = await response.json();

        // Check for tool use in content blocks
        const toolUseBlocks = data.content?.filter((c: any) => c.type === 'tool_use') || [];
        const textBlocks = data.content?.filter((c: any) => c.type === 'text') || [];

        if (toolUseBlocks.length > 0) {
            return {
                id: data.id || generateId(),
                content: textBlocks.map((t: any) => t.text).join('\n'),
                model: data.model || provider.model,
                toolCalls: toolUseBlocks.map((tc: any) => ({
                    name: tc.name,
                    arguments: JSON.stringify(tc.input),
                })),
                tokens: data.usage ? {
                    prompt: data.usage.input_tokens,
                    completion: data.usage.output_tokens,
                    total: data.usage.input_tokens + data.usage.output_tokens,
                } : undefined,
                finishReason: data.stop_reason,
            };
        }

        return {
            id: data.id || generateId(),
            content: textBlocks.map((t: any) => t.text).join('\n'),
            model: data.model || provider.model,
            tokens: data.usage ? {
                prompt: data.usage.input_tokens,
                completion: data.usage.output_tokens,
                total: data.usage.input_tokens + data.usage.output_tokens,
            } : undefined,
            finishReason: data.stop_reason,
        };
    }

    // Fallback to regular completion
    return sendChatCompletion(request);
}
