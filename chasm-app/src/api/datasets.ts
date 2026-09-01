// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// Local dataset store (`/api/datasets`)
// =============================================================================
//
// Datasets the user uploads and the server holds.
//
// Not the same thing chasm-web's Developer page calls a dataset: that one is a
// remote HuggingFace catalogue you download *from*. The data flows the other
// way, so the two are separate features rather than one endpoint trying to be
// both.
//
// `entryCount` and `sizeBytes` are the server's measurements of what it
// actually stored. They are not sent up and would be ignored if they were --
// the fixtures these replaced reported sizes and sample counts for data that
// did not exist.

import { apiClient } from './client';

export type DatasetType = 'conversations' | 'documents' | 'qa' | 'custom';

export interface Dataset {
    id: string;
    name: string;
    type: DatasetType;
    format: string;
    entryCount: number;
    sizeBytes: number;
    createdAt: number;
    updatedAt: number;
}

export interface DatasetEntryPage {
    datasetId: string;
    /** The dataset's whole record count, not this page's length. */
    total: number;
    limit: number;
    offset: number;
    entries: unknown[];
}

function unwrap<T>(response: { data: { success?: boolean; data?: T } }): T {
    return response.data?.data as T;
}

export const datasets = {
    async list(): Promise<Dataset[]> {
        const response = await apiClient.get('/api/datasets');
        return unwrap<Dataset[]>(response) ?? [];
    },

    async get(id: string): Promise<Dataset> {
        const response = await apiClient.get(`/api/datasets/${encodeURIComponent(id)}`);
        return unwrap<Dataset>(response);
    },

    /**
     * Upload a dataset.
     *
     * At most 50,000 entries per request: the server parses the body into
     * memory and writes it in one transaction, and has no streaming import.
     */
    async create(input: {
        name: string;
        type?: DatasetType;
        format?: string;
        entries: unknown[];
    }): Promise<Dataset> {
        const response = await apiClient.post('/api/datasets', input);
        return unwrap<Dataset>(response);
    },

    /**
     * A page of records, in upload order.
     *
     * An unknown dataset is a 404 rather than an empty page, so an empty
     * `entries` here genuinely means this page is past the end.
     */
    async entries(id: string, limit = 50, offset = 0): Promise<DatasetEntryPage> {
        const response = await apiClient.get(
            `/api/datasets/${encodeURIComponent(id)}/entries?limit=${limit}&offset=${offset}`
        );
        return unwrap<DatasetEntryPage>(response);
    },

    async remove(id: string): Promise<void> {
        await apiClient.delete(`/api/datasets/${encodeURIComponent(id)}`);
    },
};
