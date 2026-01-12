// =============================================================================
// CSM App - Local LLM Service
// =============================================================================
// Handles both LAN-based LLM servers (Ollama, LM Studio) and on-device inference
// via llama.rn

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

// Check if llama.rn native module is available (won't be in Expo Go)
const LLAMA_RN_AVAILABLE = !!NativeModules.RNLlama;

// Storage keys
const LOCAL_LLM_CONFIG_KEY = 'csm_local_llm_config';
const ON_DEVICE_MODELS_KEY = 'csm_on_device_models';

// =============================================================================
// Types
// =============================================================================

export type LocalLlmProviderType =
    | 'ollama'
    | 'lmstudio'
    | 'llamacpp'
    | 'jan'
    | 'gpt4all'
    | 'localai'
    | 'vllm'
    | 'koboldcpp'
    | 'textgenwebui'
    | 'custom';

export interface LocalLlmProvider {
    id: string;
    type: LocalLlmProviderType;
    name: string;
    host: string;
    port: number;
    apiPath: string; // e.g., '/v1' or '/api'
    isEnabled: boolean;
    models: string[];
    lastHealthCheck?: number;
    isHealthy?: boolean;
}

export interface LocalLlmConfig {
    providers: LocalLlmProvider[];
    defaultProviderId?: string;
    autoDiscover: boolean;
    discoveryTimeout: number;
}

export interface OnDeviceModel {
    id: string;
    name: string;
    filename: string;
    path: string;
    size: number; // bytes
    quantization: string; // e.g., 'Q4_K_M', 'Q8_0'
    parameters: string; // e.g., '7B', '3B'
    downloadUrl?: string;
    downloadProgress?: number;
    isDownloaded: boolean;
    isLoaded: boolean;
    lastUsed?: number;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface CompletionParams {
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    stop?: string[];
    stream?: boolean;
}

export interface CompletionResult {
    content: string;
    model: string;
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
    timings?: {
        promptMs: number;
        predictedMs: number;
        tokensPerSecond: number;
    };
}

// =============================================================================
// Default Provider Configurations
// =============================================================================

export const DEFAULT_LOCAL_PROVIDERS: Omit<LocalLlmProvider, 'id'>[] = [
    {
        type: 'ollama',
        name: 'Ollama',
        host: '192.168.1.100', // User must configure
        port: 11434,
        apiPath: '/api',
        isEnabled: false,
        models: [],
    },
    {
        type: 'lmstudio',
        name: 'LM Studio',
        host: '192.168.1.100',
        port: 1234,
        apiPath: '/v1',
        isEnabled: false,
        models: [],
    },
    {
        type: 'llamacpp',
        name: 'llama.cpp Server',
        host: '192.168.1.100',
        port: 8080,
        apiPath: '/v1',
        isEnabled: false,
        models: [],
    },
    {
        type: 'jan',
        name: 'Jan',
        host: '192.168.1.100',
        port: 1337,
        apiPath: '/v1',
        isEnabled: false,
        models: [],
    },
    {
        type: 'gpt4all',
        name: 'GPT4All',
        host: '192.168.1.100',
        port: 4891,
        apiPath: '/v1',
        isEnabled: false,
        models: [],
    },
    {
        type: 'localai',
        name: 'LocalAI',
        host: '192.168.1.100',
        port: 8080,
        apiPath: '/v1',
        isEnabled: false,
        models: [],
    },
    {
        type: 'vllm',
        name: 'vLLM',
        host: '192.168.1.100',
        port: 8000,
        apiPath: '/v1',
        isEnabled: false,
        models: [],
    },
];

// =============================================================================
// Recommended On-Device Models
// =============================================================================

export const RECOMMENDED_MODELS: Omit<OnDeviceModel, 'path' | 'isDownloaded' | 'isLoaded'>[] = [
    {
        id: 'llama-3.2-1b-q4',
        name: 'Llama 3.2 1B',
        filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        size: 750_000_000, // ~750MB
        quantization: 'Q4_K_M',
        parameters: '1B',
        downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    },
    {
        id: 'llama-3.2-3b-q4',
        name: 'Llama 3.2 3B',
        filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        size: 2_000_000_000, // ~2GB
        quantization: 'Q4_K_M',
        parameters: '3B',
        downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    },
    {
        id: 'phi-3-mini-q4',
        name: 'Phi-3 Mini 3.8B',
        filename: 'Phi-3-mini-4k-instruct-Q4_K_M.gguf',
        size: 2_300_000_000, // ~2.3GB
        quantization: 'Q4_K_M',
        parameters: '3.8B',
        downloadUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    },
    {
        id: 'qwen2.5-1.5b-q4',
        name: 'Qwen 2.5 1.5B',
        filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
        size: 1_100_000_000, // ~1.1GB
        quantization: 'Q4_K_M',
        parameters: '1.5B',
        downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    },
    {
        id: 'gemma-2-2b-q4',
        name: 'Gemma 2 2B',
        filename: 'gemma-2-2b-it-Q4_K_M.gguf',
        size: 1_600_000_000, // ~1.6GB
        quantization: 'Q4_K_M',
        parameters: '2B',
        downloadUrl: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    },
    {
        id: 'smollm2-1.7b-q4',
        name: 'SmolLM2 1.7B',
        filename: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
        size: 1_100_000_000, // ~1.1GB
        quantization: 'Q4_K_M',
        parameters: '1.7B',
        downloadUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf',
    },
];

// =============================================================================
// Local LLM Service
// =============================================================================

class LocalLlmService {
    private config: LocalLlmConfig | null = null;
    private onDeviceModels: OnDeviceModel[] = [];
    private llamaContext: any = null; // llama.rn context
    private isLlamaRnAvailable: boolean = false;

    constructor() {
        this.checkLlamaRnAvailability();
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    private async checkLlamaRnAvailability(): Promise<void> {
        // Use native module check instead of dynamic import
        this.isLlamaRnAvailable = LLAMA_RN_AVAILABLE;
        console.log('[LocalLLM] llama.rn available:', this.isLlamaRnAvailable);
    }

    async initialize(): Promise<void> {
        await this.loadConfig();
        await this.loadOnDeviceModels();
    }

    // =========================================================================
    // Configuration Management
    // =========================================================================

    async loadConfig(): Promise<LocalLlmConfig> {
        try {
            const saved = await AsyncStorage.getItem(LOCAL_LLM_CONFIG_KEY);
            if (saved) {
                this.config = JSON.parse(saved);
            } else {
                this.config = this.getDefaultConfig();
            }
        } catch (error) {
            console.error('[LocalLLM] Failed to load config:', error);
            this.config = this.getDefaultConfig();
        }
        return this.config!;
    }

    async saveConfig(config: LocalLlmConfig): Promise<void> {
        this.config = config;
        try {
            await AsyncStorage.setItem(LOCAL_LLM_CONFIG_KEY, JSON.stringify(config));
        } catch (error) {
            console.error('[LocalLLM] Failed to save config:', error);
        }
    }

    getDefaultConfig(): LocalLlmConfig {
        return {
            providers: DEFAULT_LOCAL_PROVIDERS.map((p, i) => ({
                ...p,
                id: `${p.type}-${i}`,
            })),
            autoDiscover: true,
            discoveryTimeout: 3000,
        };
    }

    getConfig(): LocalLlmConfig | null {
        return this.config;
    }

    // =========================================================================
    // Provider Management
    // =========================================================================

    async addProvider(provider: Omit<LocalLlmProvider, 'id'>): Promise<LocalLlmProvider> {
        const newProvider: LocalLlmProvider = {
            ...provider,
            id: `${provider.type}-${Date.now()}`,
        };

        if (!this.config) await this.loadConfig();
        this.config!.providers.push(newProvider);
        await this.saveConfig(this.config!);

        return newProvider;
    }

    async updateProvider(id: string, updates: Partial<LocalLlmProvider>): Promise<void> {
        if (!this.config) await this.loadConfig();

        const index = this.config!.providers.findIndex(p => p.id === id);
        if (index !== -1) {
            this.config!.providers[index] = { ...this.config!.providers[index], ...updates };
            await this.saveConfig(this.config!);
        }
    }

    async removeProvider(id: string): Promise<void> {
        if (!this.config) await this.loadConfig();

        this.config!.providers = this.config!.providers.filter(p => p.id !== id);
        await this.saveConfig(this.config!);
    }

    // =========================================================================
    // Health Checks & Discovery
    // =========================================================================

    async checkProviderHealth(provider: LocalLlmProvider): Promise<boolean> {
        const url = this.getBaseUrl(provider);
        const timeout = this.config?.discoveryTimeout ?? 3000;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            // Try different health endpoints based on provider type
            const healthEndpoints = this.getHealthEndpoints(provider);

            for (const endpoint of healthEndpoints) {
                try {
                    const response = await fetch(`${url}${endpoint}`, {
                        method: 'GET',
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        await this.updateProvider(provider.id, {
                            isHealthy: true,
                            lastHealthCheck: Date.now(),
                        });
                        return true;
                    }
                } catch {
                    // Try next endpoint
                }
            }

            clearTimeout(timeoutId);
        } catch (error) {
            console.log(`[LocalLLM] Health check failed for ${provider.name}:`, error);
        }

        await this.updateProvider(provider.id, {
            isHealthy: false,
            lastHealthCheck: Date.now(),
        });
        return false;
    }

    private getHealthEndpoints(provider: LocalLlmProvider): string[] {
        switch (provider.type) {
            case 'ollama':
                return ['/api/tags', '/api/version', '/'];
            case 'lmstudio':
            case 'llamacpp':
            case 'jan':
            case 'gpt4all':
            case 'localai':
            case 'vllm':
                return ['/v1/models', '/health', '/'];
            default:
                return ['/v1/models', '/health', '/'];
        }
    }

    async discoverModels(provider: LocalLlmProvider): Promise<string[]> {
        const url = this.getBaseUrl(provider);
        const models: string[] = [];

        try {
            if (provider.type === 'ollama') {
                // Ollama uses /api/tags
                const response = await fetch(`${url}/api/tags`);
                if (response.ok) {
                    const data = await response.json();
                    models.push(...(data.models?.map((m: any) => m.name) ?? []));
                }
            } else {
                // OpenAI-compatible endpoints use /v1/models
                const response = await fetch(`${url}${provider.apiPath}/models`);
                if (response.ok) {
                    const data = await response.json();
                    models.push(...(data.data?.map((m: any) => m.id) ?? []));
                }
            }

            await this.updateProvider(provider.id, { models });
        } catch (error) {
            console.log(`[LocalLLM] Model discovery failed for ${provider.name}:`, error);
        }

        return models;
    }

    async checkAllProviders(): Promise<Map<string, boolean>> {
        if (!this.config) await this.loadConfig();

        const results = new Map<string, boolean>();
        const checks = this.config!.providers
            .filter(p => p.isEnabled)
            .map(async (p) => {
                const healthy = await this.checkProviderHealth(p);
                results.set(p.id, healthy);
                if (healthy) {
                    await this.discoverModels(p);
                }
            });

        await Promise.all(checks);
        return results;
    }

    // =========================================================================
    // Chat Completion (LAN Providers)
    // =========================================================================

    async sendCompletion(
        providerId: string,
        params: CompletionParams,
        onToken?: (token: string) => void
    ): Promise<CompletionResult> {
        if (!this.config) await this.loadConfig();

        const provider = this.config!.providers.find(p => p.id === providerId);
        if (!provider) {
            throw new Error(`Provider not found: ${providerId}`);
        }

        if (provider.type === 'ollama') {
            return this.sendOllamaCompletion(provider, params, onToken);
        } else {
            return this.sendOpenAICompatibleCompletion(provider, params, onToken);
        }
    }

    private async sendOllamaCompletion(
        provider: LocalLlmProvider,
        params: CompletionParams,
        onToken?: (token: string) => void
    ): Promise<CompletionResult> {
        const url = `${this.getBaseUrl(provider)}/api/chat`;
        const model = provider.models[0] || 'llama3.2';

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: params.messages,
                stream: params.stream ?? !!onToken,
                options: {
                    temperature: params.temperature ?? 0.7,
                    num_predict: params.maxTokens ?? 2048,
                    top_p: params.topP ?? 0.9,
                    top_k: params.topK ?? 40,
                    stop: params.stop,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama error: ${response.status} - ${error}`);
        }

        if (params.stream && onToken && response.body) {
            return this.handleOllamaStream(response, model, onToken);
        }

        const data = await response.json();
        return {
            content: data.message?.content ?? '',
            model: data.model ?? model,
            tokens: {
                prompt: data.prompt_eval_count ?? 0,
                completion: data.eval_count ?? 0,
                total: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            },
            timings: data.eval_duration ? {
                promptMs: (data.prompt_eval_duration ?? 0) / 1_000_000,
                predictedMs: data.eval_duration / 1_000_000,
                tokensPerSecond: data.eval_count / (data.eval_duration / 1_000_000_000),
            } : undefined,
        };
    }

    private async handleOllamaStream(
        response: Response,
        model: string,
        onToken: (token: string) => void
    ): Promise<CompletionResult> {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let lastData: any = null;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.message?.content) {
                            onToken(data.message.content);
                            fullContent += data.message.content;
                        }
                        lastData = data;
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return {
            content: fullContent,
            model: lastData?.model ?? model,
            tokens: lastData ? {
                prompt: lastData.prompt_eval_count ?? 0,
                completion: lastData.eval_count ?? 0,
                total: (lastData.prompt_eval_count ?? 0) + (lastData.eval_count ?? 0),
            } : undefined,
        };
    }

    private async sendOpenAICompatibleCompletion(
        provider: LocalLlmProvider,
        params: CompletionParams,
        onToken?: (token: string) => void
    ): Promise<CompletionResult> {
        const url = `${this.getBaseUrl(provider)}${provider.apiPath}/chat/completions`;
        const model = provider.models[0] || 'default';

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: params.messages,
                temperature: params.temperature ?? 0.7,
                max_tokens: params.maxTokens ?? 2048,
                top_p: params.topP ?? 0.9,
                stop: params.stop,
                stream: params.stream ?? !!onToken,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error: ${response.status} - ${error}`);
        }

        if (params.stream && onToken && response.body) {
            return this.handleOpenAIStream(response, model, onToken);
        }

        const data = await response.json();
        return {
            content: data.choices?.[0]?.message?.content ?? '',
            model: data.model ?? model,
            tokens: data.usage ? {
                prompt: data.usage.prompt_tokens,
                completion: data.usage.completion_tokens,
                total: data.usage.total_tokens,
            } : undefined,
        };
    }

    private async handleOpenAIStream(
        response: Response,
        model: string,
        onToken: (token: string) => void
    ): Promise<CompletionResult> {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

                for (const line of lines) {
                    const jsonStr = line.slice(6);
                    if (jsonStr === '[DONE]') continue;

                    try {
                        const data = JSON.parse(jsonStr);
                        const content = data.choices?.[0]?.delta?.content;
                        if (content) {
                            onToken(content);
                            fullContent += content;
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return {
            content: fullContent,
            model,
        };
    }

    // =========================================================================
    // On-Device Models (llama.rn)
    // =========================================================================

    isOnDeviceAvailable(): boolean {
        return this.isLlamaRnAvailable && Platform.OS !== 'web';
    }

    async loadOnDeviceModels(): Promise<OnDeviceModel[]> {
        try {
            const saved = await AsyncStorage.getItem(ON_DEVICE_MODELS_KEY);
            if (saved) {
                this.onDeviceModels = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[LocalLLM] Failed to load on-device models:', error);
        }
        return this.onDeviceModels;
    }

    async saveOnDeviceModels(): Promise<void> {
        try {
            await AsyncStorage.setItem(ON_DEVICE_MODELS_KEY, JSON.stringify(this.onDeviceModels));
        } catch (error) {
            console.error('[LocalLLM] Failed to save on-device models:', error);
        }
    }

    getOnDeviceModels(): OnDeviceModel[] {
        return this.onDeviceModels;
    }

    getRecommendedModels(): typeof RECOMMENDED_MODELS {
        return RECOMMENDED_MODELS;
    }

    async loadModel(modelId: string): Promise<boolean> {
        if (!this.isLlamaRnAvailable) {
            throw new Error('llama.rn not available');
        }

        const model = this.onDeviceModels.find(m => m.id === modelId);
        if (!model || !model.isDownloaded) {
            throw new Error('Model not found or not downloaded');
        }

        try {
            // Check if llama.rn is available
            if (!LLAMA_RN_AVAILABLE) {
                throw new Error('On-device inference not available (requires native build)');
            }

            // Unload any existing model
            if (this.llamaContext) {
                await this.llamaContext.release();
                this.llamaContext = null;
            }

            const llamaRn = require('llama.rn');
            this.llamaContext = await llamaRn.initLlama({
                model: model.path,
                use_mlock: true,
                n_ctx: 2048,
                n_gpu_layers: Platform.OS === 'ios' ? 99 : 0, // Metal on iOS
            });

            model.isLoaded = true;
            model.lastUsed = Date.now();
            await this.saveOnDeviceModels();

            console.log('[LocalLLM] Model loaded:', model.name);
            return true;
        } catch (error) {
            console.error('[LocalLLM] Failed to load model:', error);
            throw error;
        }
    }

    async unloadModel(): Promise<void> {
        if (this.llamaContext) {
            await this.llamaContext.release();
            this.llamaContext = null;
        }

        this.onDeviceModels.forEach(m => m.isLoaded = false);
        await this.saveOnDeviceModels();
    }

    async sendOnDeviceCompletion(
        params: CompletionParams,
        onToken?: (token: string) => void
    ): Promise<CompletionResult> {
        if (!this.llamaContext) {
            throw new Error('No model loaded');
        }

        const stopWords = params.stop ?? [
            '</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>',
            '<|im_end|>', '<|EOT|>', '<|END_OF_TURN_TOKEN|>',
            '<|end_of_turn|>', '<|endoftext|>'
        ];

        try {
            const result = await this.llamaContext.completion(
                {
                    messages: params.messages,
                    n_predict: params.maxTokens ?? 512,
                    temperature: params.temperature ?? 0.7,
                    top_p: params.topP ?? 0.9,
                    top_k: params.topK ?? 40,
                    stop: stopWords,
                },
                onToken ? (data: any) => {
                    if (data.token) {
                        onToken(data.token);
                    }
                } : undefined
            );

            return {
                content: result.text ?? '',
                model: 'on-device',
                tokens: {
                    prompt: result.timings?.prompt_n ?? 0,
                    completion: result.timings?.predicted_n ?? 0,
                    total: (result.timings?.prompt_n ?? 0) + (result.timings?.predicted_n ?? 0),
                },
                timings: result.timings ? {
                    promptMs: result.timings.prompt_ms ?? 0,
                    predictedMs: result.timings.predicted_ms ?? 0,
                    tokensPerSecond: result.timings.predicted_per_second ?? 0,
                } : undefined,
            };
        } catch (error) {
            console.error('[LocalLLM] On-device completion failed:', error);
            throw error;
        }
    }

    // =========================================================================
    // Utility Methods
    // =========================================================================

    private getBaseUrl(provider: LocalLlmProvider): string {
        return `http://${provider.host}:${provider.port}`;
    }

    formatSize(bytes: number): string {
        if (bytes >= 1_000_000_000) {
            return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
        }
        if (bytes >= 1_000_000) {
            return `${(bytes / 1_000_000).toFixed(1)} MB`;
        }
        return `${(bytes / 1_000).toFixed(1)} KB`;
    }
}

// Export singleton
export const localLlmService = new LocalLlmService();
