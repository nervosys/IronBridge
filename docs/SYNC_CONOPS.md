# IRONBRIDGE Data Synchronization - Concept of Operations (CONOPS)

## Overview

The Chat System Manager (IRONBRIDGE) uses a **hub-and-spoke architecture** where `ironbridge-rust` serves as the **single source of truth** for all data. Both `ironbridge-web` (React web app) and `ironbridge-app` (React Native mobile app) synchronize their state with the backend using:

- **Server-Sent Events (SSE)**: For receiving real-time updates from the server
- **REST API**: For sending data changes to the server

```
                    ┌─────────────────┐
                    │    ironbridge-rust     │
                    │  (Backend API)  │
                    │                 │
                    │  SQLite DB      │
                    │  SSE Publisher  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ ironbridge-web  │   │ ironbridge-app  │   │ ironbridge-app  │
       │ (React)  │   │(iOS/And) │   │(2nd dev) │
       └──────────┘   └──────────┘   └──────────┘
```

## Architecture Components

### 1. ironbridge-rust (Backend Server)

**Role**: Central authority and data persistence layer

- **SQLite Database**: Primary data store for all entities
- **REST API**: CRUD operations for all entity types
- **SSE Publisher**: Real-time event distribution via Server-Sent Events
- **Sync State Manager**: Tracks versions and broadcasts changes

**Endpoints**:
- `GET/POST/PUT/DELETE /api/*` - REST endpoints for data operations
- `GET /sync/subscribe` - SSE endpoint for real-time updates
- `GET /sync/version` - Get current sync version
- `GET /sync/delta?from=N` - Get changes since version N
- `GET /sync/snapshot` - Get full data snapshot
- `POST /sync/event` - Push a single sync event
- `POST /sync/batch` - Push multiple sync events

### 2. ironbridge-shared (Shared Library)

**Role**: Cross-platform synchronization infrastructure

- **SyncService**: SSE client with auto-reconnect + REST API for writes
- **React Hooks**: `useSyncedState`, `useSyncedAgents`, etc.
- **SyncProvider**: React context for sync state
- **Type Definitions**: Shared TypeScript interfaces

### 3. ironbridge-web / ironbridge-app (Frontend Clients)

**Role**: User interfaces that consume and update data

- Wrap app with `<SyncProvider>` for sync context
- Use `useSyncedState()` hooks for real-time data
- Changes are optimistically applied locally and synced

## Data Flow

### Read Operations

```
1. Client connects to WebSocket
2. Server sends current version
3. If client version < server version, server sends delta
4. Client applies delta to local state
5. Subsequent changes arrive as real-time events
```

### Write Operations

```
1. User performs action (e.g., create agent)
2. Local state updated immediately (optimistic update)
3. SyncEvent pushed to server via WebSocket
4. Server validates, persists, assigns version
5. Server broadcasts to all other clients
6. Server sends ACK with new version to sender
```

### Conflict Resolution

```
1. Two clients modify same entity simultaneously
2. Server detects conflict (version mismatch)
3. Server sends Conflict message to affected client
4. Client resolves based on strategy:
   - 'server': Accept server version
   - 'local': Retry with local version
   - 'manual': User decides
```

## Sync Protocol Messages

### Client → Server

| Message Type       | Description                                 |
| ------------------ | ------------------------------------------- |
| `register`         | Client registration with last known version |
| `sync_event`       | Single entity change                        |
| `sync_batch`       | Multiple entity changes                     |
| `request_sync`     | Request delta from specific version         |
| `request_snapshot` | Request full data snapshot                  |
| `resolve_conflict` | Resolve a detected conflict                 |

### Server → Client

| Message Type | Description                                   |
| ------------ | --------------------------------------------- |
| `welcome`    | Acknowledge registration with current version |
| `sync_event` | Broadcast entity change from another client   |
| `sync_batch` | Broadcast multiple changes                    |
| `snapshot`   | Full data snapshot                            |
| `delta`      | Changes since specified version               |
| `conflict`   | Notify of data conflict                       |
| `ack`        | Acknowledge received event with new version   |

## Entity Types

The sync system handles these entity types:

- **workspace**: VS Code workspaces
- **session**: Chat sessions
- **message**: Messages within sessions
- **agent**: AI agents
- **swarm**: Agent swarms
- **provider**: LLM providers
- **settings**: User settings

## Usage Examples

### Wrap App with SyncProvider

```tsx
// ironbridge-web/src/App.tsx
import { SyncProvider } from '@ironbridge/shared';

function App() {
  return (
    <SyncProvider
      baseUrl="http://localhost:8787"
      autoConnect={true}
      conflictResolution="server"
    >
      <Router>
        {/* ... routes */}
      </Router>
    </SyncProvider>
  );
}
```

### Use Synced State Hook

```tsx
// ironbridge-web/src/pages/Agents.tsx
import { useSyncContext, useSyncedAgents } from '@ironbridge/shared';

function AgentsPage() {
  const { isConnected, isSyncing } = useSyncContext();
  const { data: agents, create, update, remove } = useSyncedAgents(
    useSyncContext().sync,
    initialAgents
  );

  const handleCreateAgent = () => {
    create({
      id: uuid(),
      name: 'New Agent',
      // ...
    });
  };

  return (
    <div>
      {!isConnected && <Banner>Offline - changes will sync when reconnected</Banner>}
      {isSyncing && <Spinner />}
      {agents.map(agent => (
        <AgentCard 
          agent={agent}
          onUpdate={(updates) => update(agent.id, updates)}
          onDelete={() => remove(agent.id)}
        />
      ))}
    </div>
  );
}
```

### Subscribe to Sync Events

```tsx
import { useSyncSubscription, useSyncContext } from '@ironbridge/shared';

function NotificationHandler() {
  const { sync } = useSyncContext();

  useSyncSubscription(sync, 'agent', (event) => {
    if (event.operation === 'create') {
      toast(`New agent created: ${event.data.name}`);
    }
  });

  return null;
}
```

## Offline Support

The sync service includes built-in offline support:

1. **Local Cache**: Pending changes stored in localStorage
2. **Auto-Reconnect**: Exponential backoff reconnection
3. **Queue Management**: Changes queued when offline
4. **Batch Sync**: Pending changes sent in batches on reconnect

```tsx
// Check offline status
const { isConnected, pendingCount } = useSyncContext();

if (!isConnected) {
  console.log(`Offline with ${pendingCount} pending changes`);
}
```

## Version Management

Each entity change increments a global version counter:

- **Server Version**: Current authoritative version
- **Client Version**: Last known version from server
- **Event Version**: Version assigned to each sync event

This allows efficient delta synchronization:

```
Client: "I'm at version 42"
Server: "Current version is 50, here are events 43-50"
```

## Error Handling

| Error             | Recovery                       |
| ----------------- | ------------------------------ |
| Connection lost   | Auto-reconnect with backoff    |
| Parse error       | Log and continue               |
| Conflict detected | Apply resolution strategy      |
| Server error      | Retry with exponential backoff |

## Security Considerations

- WebSocket connections can be secured with WSS
- Client IDs should be validated on server
- Consider adding authentication tokens
- Rate limiting for sync events

## Performance Optimizations

1. **Batching**: Multiple changes batched into single messages
2. **Debouncing**: Rapid changes debounced before sending
3. **Delta Sync**: Only changed data transferred
4. **Selective Subscription**: Subscribe to specific entity types

## Future Enhancements

- [ ] Authentication integration
- [ ] Per-entity permissions
- [ ] Conflict merge strategies
- [ ] Sync status indicators in UI
- [ ] Offline-first optimizations
- [ ] WebRTC peer-to-peer sync option
