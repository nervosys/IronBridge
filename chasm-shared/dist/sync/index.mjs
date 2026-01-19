// src/sync/index.ts
var SyncService = class {
  constructor(config) {
    this.eventSource = null;
    this.eventHandlers = /* @__PURE__ */ new Map();
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.isSyncInProgress = false;
    this.config = {
      reconnectInterval: 5e3,
      maxRetries: 10,
      batchSize: 50,
      conflictResolution: "server",
      enableOfflineSupport: true,
      onConnect: () => {
      },
      onDisconnect: () => {
      },
      onSyncStart: () => {
      },
      onSyncComplete: () => {
      },
      onSyncError: () => {
      },
      onConflict: () => {
      },
      ...config
    };
    this.state = {
      lastSyncTime: 0,
      version: 0,
      pendingChanges: [],
      conflicts: [],
      isOnline: false,
      isSyncing: false
    };
    if (this.config.enableOfflineSupport) {
      this.loadCachedState();
    }
  }
  // =========================================================================
  // Connection Management (SSE)
  // =========================================================================
  connect() {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }
    const sseUrl = `${this.config.baseUrl}/sync/subscribe`;
    try {
      this.eventSource = new EventSource(sseUrl);
      this.eventSource.onopen = () => {
        this.state.isOnline = true;
        this.reconnectAttempts = 0;
        this.config.onConnect();
        this.syncPendingChanges();
      };
      this.eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error("Failed to parse SSE message:", err);
        }
      };
      this.eventSource.onerror = () => {
        this.state.isOnline = false;
        this.config.onDisconnect();
        this.eventSource?.close();
        this.eventSource = null;
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error("Failed to connect:", err);
      this.scheduleReconnect();
    }
  }
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.state.isOnline = false;
  }
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.config.maxRetries) {
      console.error("Max reconnect attempts reached");
      return;
    }
    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, Math.min(delay, 3e4));
  }
  // =========================================================================
  // REST API Methods
  // =========================================================================
  async apiRequest(endpoint, method = "GET", body) {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : void 0
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "API request failed");
    }
    return result.data;
  }
  // =========================================================================
  // Message Handling (SSE)
  // =========================================================================
  handleMessage(message) {
    switch (message.type) {
      case "welcome":
        if (message.version > this.state.version) {
          this.requestSync();
        }
        break;
      case "sync_event":
        if (message.event) {
          this.handleSyncEvent(message.event);
        }
        break;
      case "ack":
        if (message.version) {
          this.state.version = message.version;
          this.saveCachedState();
        }
        break;
    }
  }
  handleSyncEvent(event) {
    if (event.clientId === this.config.clientId) {
      return;
    }
    if (event.version > this.state.version) {
      this.state.version = event.version;
    }
    this.emit(event.type, event);
    this.emit("*", event);
  }
  handleSnapshot(snapshot) {
    this.state.version = snapshot.version;
    this.state.lastSyncTime = snapshot.timestamp;
    snapshot.workspaces.forEach((ws) => {
      this.emit("workspace", {
        id: `snapshot-ws-${ws.id}`,
        type: "workspace",
        operation: "sync",
        entityId: ws.id,
        data: ws,
        timestamp: snapshot.timestamp,
        clientId: "server",
        version: snapshot.version
      });
    });
    snapshot.sessions.forEach((session) => {
      this.emit("session", {
        id: `snapshot-session-${session.id}`,
        type: "session",
        operation: "sync",
        entityId: session.id,
        data: session,
        timestamp: snapshot.timestamp,
        clientId: "server",
        version: snapshot.version
      });
    });
    snapshot.agents.forEach((agent) => {
      this.emit("agent", {
        id: `snapshot-agent-${agent.id}`,
        type: "agent",
        operation: "sync",
        entityId: agent.id,
        data: agent,
        timestamp: snapshot.timestamp,
        clientId: "server",
        version: snapshot.version
      });
    });
    this.saveCachedState();
    this.config.onSyncComplete({
      created: [],
      updated: [],
      deleted: [],
      timestamp: snapshot.timestamp,
      fromVersion: 0,
      toVersion: snapshot.version
    });
  }
  handleDelta(delta) {
    this.state.version = delta.toVersion;
    this.state.lastSyncTime = delta.timestamp;
    [...delta.created, ...delta.updated, ...delta.deleted].forEach((event) => {
      this.emit(event.type, event);
    });
    this.saveCachedState();
    this.config.onSyncComplete(delta);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _handleConflict(conflict) {
    if (this.config.conflictResolution !== "manual") {
      conflict.resolution = this.config.conflictResolution;
      conflict.resolved = true;
    } else {
      this.state.conflicts.push(conflict);
      this.config.onConflict(conflict);
    }
  }
  // =========================================================================
  // Event Subscription
  // =========================================================================
  subscribe(entityType, handler) {
    if (!this.eventHandlers.has(entityType)) {
      this.eventHandlers.set(entityType, /* @__PURE__ */ new Set());
    }
    this.eventHandlers.get(entityType).add(handler);
    return () => {
      this.eventHandlers.get(entityType)?.delete(handler);
    };
  }
  emit(entityType, event) {
    this.eventHandlers.get(entityType)?.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error("Error in sync event handler:", err);
      }
    });
  }
  // =========================================================================
  // Data Operations (via REST API)
  // =========================================================================
  async push(entityType, operation, entityId, data) {
    const event = {
      id: `${this.config.clientId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: entityType,
      operation,
      entityId,
      data,
      timestamp: Date.now(),
      clientId: this.config.clientId,
      version: this.state.version + 1
    };
    if (this.state.isOnline) {
      try {
        const result = await this.apiRequest(
          "/sync/event",
          "POST",
          event
        );
        this.state.version = result.version;
        this.saveCachedState();
      } catch (err) {
        console.error("Failed to push sync event:", err);
        if (this.config.enableOfflineSupport) {
          this.state.pendingChanges.push(event);
          this.saveCachedState();
        }
        throw err;
      }
    } else if (this.config.enableOfflineSupport) {
      this.state.pendingChanges.push(event);
      this.saveCachedState();
    }
  }
  async syncPendingChanges() {
    if (this.isSyncInProgress || this.state.pendingChanges.length === 0) {
      return;
    }
    this.isSyncInProgress = true;
    this.state.isSyncing = true;
    this.config.onSyncStart();
    try {
      while (this.state.pendingChanges.length > 0) {
        const batch = this.state.pendingChanges.splice(0, this.config.batchSize);
        const result = await this.apiRequest(
          "/sync/batch",
          "POST",
          { events: batch }
        );
        this.state.version = result.version;
      }
      this.saveCachedState();
    } catch (err) {
      console.error("Failed to sync pending changes:", err);
      this.config.onSyncError(err);
    } finally {
      this.isSyncInProgress = false;
      this.state.isSyncing = false;
    }
  }
  async requestSync() {
    try {
      const delta = await this.apiRequest(
        `/sync/delta?from=${this.state.version}`
      );
      this.handleDelta(delta);
    } catch (err) {
      console.error("Failed to request sync delta:", err);
      this.config.onSyncError(err);
    }
  }
  async requestSnapshot() {
    try {
      const snapshot = await this.apiRequest("/sync/snapshot");
      this.handleSnapshot(snapshot);
      return snapshot;
    } catch (err) {
      console.error("Failed to request snapshot:", err);
      this.config.onSyncError(err);
      throw err;
    }
  }
  // =========================================================================
  // Conflict Resolution
  // =========================================================================
  resolveConflict(conflictId, resolution) {
    const conflict = this.state.conflicts.find((c) => c.id === conflictId);
    if (!conflict) {
      return;
    }
    conflict.resolution = resolution;
    conflict.resolved = true;
    this.state.conflicts = this.state.conflicts.filter((c) => c.id !== conflictId);
  }
  // =========================================================================
  // State Management
  // =========================================================================
  getState() {
    return { ...this.state };
  }
  isConnected() {
    return this.state.isOnline;
  }
  getVersion() {
    return this.state.version;
  }
  getPendingChanges() {
    return [...this.state.pendingChanges];
  }
  getConflicts() {
    return [...this.state.conflicts];
  }
  // =========================================================================
  // Cache Management
  // =========================================================================
  loadCachedState() {
    try {
      const cached = localStorage?.getItem(`csm-sync-state-${this.config.clientId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.state.version = parsed.version || 0;
        this.state.lastSyncTime = parsed.lastSyncTime || 0;
        this.state.pendingChanges = parsed.pendingChanges || [];
      }
    } catch (err) {
      console.debug("Could not load cached sync state:", err);
    }
  }
  saveCachedState() {
    try {
      localStorage?.setItem(
        `csm-sync-state-${this.config.clientId}`,
        JSON.stringify({
          version: this.state.version,
          lastSyncTime: this.state.lastSyncTime,
          pendingChanges: this.state.pendingChanges
        })
      );
    } catch (err) {
      console.debug("Could not save cached sync state:", err);
    }
  }
  clearCache() {
    try {
      localStorage?.removeItem(`csm-sync-state-${this.config.clientId}`);
    } catch (err) {
      console.debug("Could not clear cached sync state:", err);
    }
    this.state = {
      lastSyncTime: 0,
      version: 0,
      pendingChanges: [],
      conflicts: [],
      isOnline: this.state.isOnline,
      isSyncing: false
    };
  }
};
var defaultSyncService = null;
function createSyncService(config) {
  return new SyncService(config);
}
function getDefaultSyncService() {
  return defaultSyncService;
}
function initDefaultSyncService(config) {
  if (!defaultSyncService) {
    defaultSyncService = new SyncService(config);
  }
  return defaultSyncService;
}
function generateClientId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  const platform = typeof window !== "undefined" ? "web" : "native";
  return `${platform}-${timestamp}-${random}`;
}

export { SyncService, createSyncService, generateClientId, getDefaultSyncService, initDefaultSyncService };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map