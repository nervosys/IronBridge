export type RootStackParamList = {
    // Tab screens
    Main: undefined;

    // Stack screens
    Workspaces: undefined;
    WorkspaceSessions: {
        workspaceId: string;
        workspaceName: string;
    };
    Sessions: undefined;
    SessionDetail: {
        sessionId: string;
        sessionTitle: string;
    };
    Search: undefined;
    Settings: undefined;

    // Chat screens
    Chat: undefined;
    ChatProviders: undefined;
    ChatHistory: undefined;

    // Agents screens
    Agents: undefined;
    AgentRunDetail: {
        runId: string;
    };
    SwarmDetail: {
        swarmId: string;
    };
};

export type TabParamList = {
    WorkspacesTab: undefined;
    SessionsTab: undefined;
    ChatTab: undefined;
    AgentsTab: undefined;
    SearchTab: undefined;
    SettingsTab: undefined;
};
