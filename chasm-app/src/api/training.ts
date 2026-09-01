// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// Fine-tuning jobs (`/api/training`)
// =============================================================================
//
// Chasm does not train anything. It hands one of the stored datasets to the
// provider configured on the server and reports that provider's status back.
//
// Note what a TrainingJob does not carry: no progress, no ETA, no accuracy, no
// F1. A fine-tuning API reports none of them. The screen this replaces drew a
// progress bar from a `progress` field and rendered accuracy and F1 beside it,
// all from a literal.

import { apiClient } from './client';

export interface TrainingJob {
    id: string;
    /** The provider's own id, so the job can be found in their dashboard. */
    providerJobId: string;
    datasetId: string;
    datasetName: string;
    baseModel: string;
    status: 'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    fineTunedModel?: string;
    trainedTokens?: number;
    error?: string;
    createdAt: number;
    updatedAt: number;
    finishedAt?: number;
    /**
     * Present when the provider could not be reached, so `status` is the last
     * one read rather than the current one. Worth showing: otherwise a stale
     * status looks exactly like a fresh one.
     */
    refreshError?: string;
}

function unwrap<T>(response: { data: { success?: boolean; data?: T } }): T {
    return response.data?.data as T;
}

export const training = {
    async jobs(): Promise<TrainingJob[]> {
        const response = await apiClient.get('/api/training/jobs');
        return unwrap<TrainingJob[]>(response) ?? [];
    },

    async cancel(id: string): Promise<void> {
        await apiClient.delete(`/api/training/jobs/${encodeURIComponent(id)}`);
    },
};
