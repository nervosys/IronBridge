// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// Server-proxied completions (`/api/chat/completions`)
// =============================================================================
//
// Distinct from `api/chat.ts`, which calls providers directly from the device
// using keys held on the device. This goes through the IronBridge server, which
// proxies to one OpenAI-compatible endpoint configured with `OPENAI_API_KEY`
// and `OPENAI_BASE_URL`.
//
// It is a proxy, not a router across the provider catalogue: whatever `model`
// is sent goes to that one endpoint, and the server falls back to
// `gpt-4o-mini` when the field is omitted.
//
// With no key configured the server answers 503 naming the variable rather
// than returning a canned reply, so a failure here is a real answer and worth
// showing.

import { apiClient } from './client';

export interface ServerCompletion {
    id?: string;
    model?: string;
    content: string;
    finishReason?: string;
    usage?: Record<string, unknown> | null;
}

/**
 * Send one prompt through the server and return what came back.
 *
 * `model` is omitted from the request when blank, so the server applies its
 * own default rather than this client inventing one.
 */
export async function serverCompletion(
    prompt: string,
    model?: string
): Promise<ServerCompletion> {
    const body: Record<string, unknown> = {
        messages: [{ role: 'user', content: prompt }],
    };
    if (model && model.trim()) body.model = model.trim();

    const response = await apiClient.post('/api/chat/completions', body);
    const data = response.data?.data ?? response.data;
    return {
        ...data,
        content: data?.content ?? data?.message?.content ?? '',
    };
}
