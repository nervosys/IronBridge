// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type RootStackParamList = {
    // Tab screens
    Main: undefined;

    // Stack screens
    Overview: undefined;
    Workspaces: undefined;
    WorkspaceSessions: {
        workspaceId: string;
        workspaceName: string;
    };
    Sessions: undefined;
    SessionDetail: {
        sessionId: string;
        sessionTitle?: string;
    };
    Search: undefined;
    Settings: undefined;

    // Chat screens
    Chat: undefined;
    ChatProviders: undefined;
    ChatHistory: undefined;

    // OAuth screens
    OAuthLogin: undefined;

    // Agents screens
    Agents: undefined;
    AgentRunDetail: {
        runId: string;
    };
    SwarmDetail: {
        swarmId: string;
    };

    // More menu screens (feature parity with csm-web)
    More: undefined;
    Comparison: undefined;
    Harvest: undefined;
    Providers: undefined;
    Protocols: undefined;
    Accounts: undefined;
    Developer: undefined;
    Research: undefined;
    SWE: undefined;
    LocalLlmSettings: undefined;
    AgentInbox: undefined;
};

export type TabParamList = {
    OverviewTab: undefined;
    WorkspacesTab: undefined;
    SessionsTab: undefined;
    ChatTab: undefined;
    AgentsTab: undefined;
    SearchTab: undefined;
    SettingsTab: undefined;
    MoreTab: undefined;
};
