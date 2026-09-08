// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// Research papers (`/api/research`)
// =============================================================================
//
// arXiv search, plus the papers this server has saved.
//
// Saving goes to the server. The bookmark this replaces flipped a field in
// component state and lost it on unmount -- it looked saved, and nothing was.
//
// Note what a Paper does not carry: no citations, views, comments, stars or
// trend score. arXiv reports none of them.

import { apiClient } from './client';

export interface Paper {
    arxivId: string;
    title: string;
    authors: string[];
    /** The abstract, unwrapped -- arXiv hard-wraps it at the source. */
    summary: string;
    categories: string[];
    published: string;
    updated?: string;
    /** The abstract page. */
    url: string;
    pdfUrl?: string;
    comment?: string;
}

export interface PaperResults {
    query: string;
    source: 'arxiv';
    /** arXiv's own count for the query, not this page's length. */
    totalResults: number;
    start: number;
    results: Paper[];
}

function unwrap<T>(response: { data: { success?: boolean; data?: T } }): T {
    return response.data?.data as T;
}

export const research = {
    async search(q: string, limit = 20): Promise<PaperResults> {
        const response = await apiClient.get(
            `/api/research/papers?q=${encodeURIComponent(q)}&limit=${limit}`
        );
        return unwrap<PaperResults>(response);
    },

    async saved(): Promise<Paper[]> {
        const response = await apiClient.get('/api/research/saved');
        return unwrap<Paper[]>(response) ?? [];
    },

    /** Idempotent: saving the same paper twice is not an error. */
    async save(paper: Paper): Promise<void> {
        await apiClient.post('/api/research/saved', { paper });
    },

    async unsave(arxivId: string): Promise<void> {
        await apiClient.delete(`/api/research/saved/${encodeURIComponent(arxivId)}`);
    },
};
