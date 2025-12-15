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
};

export type TabParamList = {
    WorkspacesTab: undefined;
    SessionsTab: undefined;
    SearchTab: undefined;
    SettingsTab: undefined;
};
