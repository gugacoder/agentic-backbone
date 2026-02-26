# Evolution API — Instance Management

Reference document based on production patterns extracted from **wa-man** (WhatsApp Manager), a mobile-first PWA that manages Evolution API instances with robustness. These patterns inform how the agentic-backbone should interact with Evolution API for WhatsApp connectivity.

---

## Architecture Overview

Evolution API is a self-hosted WhatsApp gateway. Each **instance** represents one WhatsApp session (one phone number). The API exposes REST endpoints for instance lifecycle, messaging, and webhook configuration.

```
Agent (backbone)
  ↓ HTTP
Evolution API (:8080)
  ↓ WebSocket
WhatsApp Web
  ↓
WhatsApp Network
```

The backbone interacts with Evolution API via the `evolution` connector (`context/shared/connectors/evolution/`). It is stateless HTTP — no persistent connections, no WebSocket subscriptions from the backbone side. The **Evolution API itself** manages the WhatsApp WebSocket session.

---

## Instance States

Evolution API reports three connection states:

| State | Meaning |
|---|---|
| `open` | Connected to WhatsApp, ready to send/receive |
| `connecting` | Attempting to establish WhatsApp connection |
| `close` | Disconnected — no active WhatsApp session |

```
          create
            ↓
close ←→ connecting → open
  ↑                     ↓
  └─────── logout ──────┘
  └─── disconnect ──────┘
  └──── ws failure ─────┘
```

### State Transitions

| From | To | Trigger |
|---|---|---|
| `close` | `connecting` | Instance created or `connect` called |
| `connecting` | `open` | QR scanned + WhatsApp handshake OK |
| `connecting` | `close` | QR expired (5 attempts, 60s each) or network failure |
| `open` | `close` | Logout, phone disconnected, WhatsApp server disconnect |
| `open` | `connecting` | Transient reconnection attempt |

---

## Instance Lifecycle

### Creation

```
POST /instance/create
{
  "instanceName": "my-instance",
  "integration": "WHATSAPP-BAILEYS",
  "qrcode": true
}
```

After creation, the instance starts in `close` state. A QR code must be scanned to establish the WhatsApp session.

### QR Code Connection Flow

This is the critical onboarding path — and the most fragile.

```
1. POST /instance/connect/{name}     → returns base64 QR code
2. User scans QR with WhatsApp app
3. Poll GET /instance/connectionState/{name} every 2s
4. Wait for state: "open"
5. If timeout or state stays "close" → retry from step 1
```

**Constraints learned from wa-man:**

| Parameter | Value | Rationale |
|---|---|---|
| QR expiry | ~60 seconds | WhatsApp invalidates QR after this window |
| Max QR attempts | 5 | After 5 expired QRs, stop and surface error |
| Poll interval | 2 seconds | Fast enough to detect connection, slow enough to not hammer API |
| Success condition | `state === "open"` | Only `open` means the session is fully established |

### Restart

```
PUT /instance/restart/{name}
```

Useful for recovering from stale connections. Does not require re-scanning QR if the session data is still valid in Evolution's store.

### Deletion

```
DELETE /instance/delete/{name}
```

Removes the instance and its session data permanently.

### Logout (Disconnect Without Delete)

```
DELETE /instance/logout/{name}
```

Disconnects the WhatsApp session but preserves the instance configuration. Re-connection requires a new QR scan.

---

## Health Monitoring

### The Centralized Probe Pattern

wa-man implements a **single backend probe** that checks Evolution API health on a fixed interval, rather than having each client poll independently.

```
Backend (BFF)                  Evolution API
    │                              │
    ├── GET /instance/list ───────►│  (every 10s)
    │◄──── 200 OK ────────────────┤
    │                              │
    ├── record: online, 45ms ──►  (in-memory state)
    │                              │
    │  ... 10s later ...           │
    │                              │
    ├── GET /instance/list ───────►│  (timeout: 5s)
    │◄──── ECONNREFUSED ─────────┤
    │                              │
    ├── record: offline ────────►  (in-memory state)
    ├── create notification ────►  (MongoDB)
```

**Health state machine:**

| From | To | Action |
|---|---|---|
| `unknown` | `online` | Startup — silent, no notification |
| `online` | `offline` | Create `evolution_offline` notification |
| `offline` | `online` | Create `evolution_online` notification |

**Key parameters:**

| Parameter | Value |
|---|---|
| Probe interval | 10 seconds |
| Request timeout | 5 seconds |
| States | `online`, `offline`, `unknown` |

**Health record shape:**

```typescript
{
  status: "online" | "offline" | "unknown";
  lastCheck: string;       // ISO timestamp
  lastOnline: string | null;
  lastOffline: string | null;
  responseTime: number | null;  // ms
}
```

### Per-Instance Connection Monitoring

Beyond Evolution API availability, each instance has its own connection state. wa-man polls all instances and detects four anomaly types:

| Anomaly | Detection | Threshold |
|---|---|---|
| **Instance offline** | `open` → `close` transition | Immediate |
| **Connection failure** | `connecting` → `close` transition | Immediate |
| **Instability** | 3+ reconnection cycles within a window | 3 reconnections in 5 minutes |
| **Prolonged offline** | Instance in `close` state beyond threshold | 5 minutes continuous |

**Instability detection algorithm:**

```
reconnectCount = 0
windowStart = now

on stateChange(instance):
  if transition is close → open:
    if (now - windowStart) > 5min:
      reconnectCount = 1
      windowStart = now
    else:
      reconnectCount++

    if reconnectCount >= 3:
      emit("connection_unstable", instance)
```

---

## Polling Strategy

wa-man uses **adaptive polling** — different refresh intervals based on context:

| Context | Interval | Rationale |
|---|---|---|
| QR connection | 2 seconds | Fast detection of scan success |
| Monitor dashboard | 10 seconds | Near-real-time status awareness |
| Instance list | 30 seconds | Less urgent, reduces API load |
| Health probe (backend) | 10 seconds | Single centralized check |

**Optimization: backend probe deduplicates.** Instead of N browser tabs each polling Evolution API, one backend probe runs the check and all clients read the cached result via `/api/health`.

---

## Error Handling Patterns

### API Error Typing

wa-man wraps all Evolution API calls in a typed error handler:

```typescript
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) { ... }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.message ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
```

### Retry Strategy

| Operation | Retries | Rationale |
|---|---|---|
| Queries (GET) | 2 | Transient network issues, API restarts |
| Mutations (POST/PUT/DELETE) | 1 | Idempotency not guaranteed for all endpoints |
| Health probe | 0 (continuous) | Runs on interval, natural retry via next tick |

### Timeout

All Evolution API calls use `AbortSignal.timeout(15_000)` (15 seconds). This prevents hanging requests from blocking the system.

---

## Notification Pipeline

wa-man implements a **three-layer notification system** for state changes:

```
State Change Detected
  │
  ├─► Layer 1: In-App Toast (immediate, visible users only)
  │     └─ Haptic feedback for critical alerts
  │
  ├─► Layer 2: Push Notification (backgrounded app only)
  │     └─ Respects user permission + preferences
  │
  └─► Layer 3: Persistent Storage (always)
        └─ MongoDB for notification center UI
```

### Visibility-Aware Delivery

Notifications adapt based on whether the user is actively looking at the app:

| App State | Toast | Push | Persist |
|---|---|---|---|
| Visible (foreground) | Yes | No | Yes |
| Hidden (background) | No | Yes | Yes |

This prevents duplicate alerts — no push notification pops up while the user is already seeing the toast in-app.

### Notification Types

| Type | Trigger | Severity |
|---|---|---|
| `instance_disconnected` | `open` → `close` | High |
| `connection_failure` | `connecting` → `close` | High |
| `connection_unstable` | 3+ reconnections in 5min | Warning |
| `offline_prolonged` | Offline > 5 minutes | Critical |
| `evolution_offline` | Evolution API unreachable | Critical |
| `evolution_online` | Evolution API recovered | Info |

---

## Lessons for the Backbone

### What the backbone already has

The existing `evolution` connector (`context/shared/connectors/evolution/`) provides:
- `query(endpoint)` — GET requests with 15s timeout
- `mutate(endpoint, body)` — POST requests with 15s timeout
- Shell wrappers (`query.sh`, `mutate.sh`) with read/write guards
- `.env`-based configuration per adapter instance

This is sufficient for **stateless operations** (send message, check status, list groups).

### What's missing for robust instance management

| Gap | wa-man Solution | Backbone Opportunity |
|---|---|---|
| **No health monitoring** | Centralized 10s probe with state machine | Heartbeat agent could probe `/instance/connectionState/{name}` |
| **No reconnection logic** | QR polling, restart endpoint | Agent skill: detect offline → call restart → verify recovery |
| **No instability detection** | Reconnect counting with time window | Track state transitions in MEMORY.md or SQLite |
| **No notification on disconnect** | Multi-layer notification pipeline | Adapter events → SSE hub → connected clients |
| **No multi-instance awareness** | Instance list polling + per-instance monitoring | Agent discovers instances via `/instance/list` |

### Recommended Patterns for Agent-Driven Management

Since the backbone uses an **agent-centric architecture** (agents reason and act, the system just supervises), Evolution instance management should follow the same pattern:

1. **Health as heartbeat concern** — The heartbeat prompt already supports skip-if-empty and deduplication. An Evolution-aware agent can check connection state on each heartbeat tick and act only when something changes.

2. **State tracking in agent memory** — Rather than building a dedicated state machine in TypeScript, the agent can maintain connection history in its `MEMORY.md`:
   ```
   ## Evolution Instance Status
   - evolution: open (last checked 2026-02-14T10:30:00Z)
   - Last offline: 2026-02-14T09:15:00Z (duration: 3min, auto-recovered)
   - Reconnections today: 1
   ```

3. **Recovery as agent skill** — A skill that wraps the recovery sequence:
   ```
   1. Check connectionState → if close:
   2. Call restart endpoint
   3. Wait 10s, re-check
   4. If still close: log failure, notify via adapter
   5. If open: log recovery, clear alert state
   ```

4. **Proactive alerts via adapter** — When the agent detects prolonged offline (>5min), it can use outbound adapters to notify operators via the same channel infrastructure used for other agent communications.

---

## Evolution API Reference (Quick)

### Instance Management

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/instance/list` | List all instances |
| GET | `/instance/connectionState/{name}` | Connection state |
| GET | `/instance/connect/{name}` | Get QR code (triggers connection) |
| POST | `/instance/create` | Create new instance |
| PUT | `/instance/restart/{name}` | Restart instance |
| DELETE | `/instance/delete/{name}` | Delete instance permanently |
| DELETE | `/instance/logout/{name}` | Disconnect without deleting |

### Messaging

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/message/sendText/{name}` | Send text message |
| POST | `/message/sendMedia/{name}` | Send image/video/document |
| POST | `/message/sendAudio/{name}` | Send voice note (PTT) |

### Configuration

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/settings/find/{name}` | Get instance settings |
| POST | `/settings/set/{name}` | Update instance settings |
| POST | `/webhook/set/{name}` | Configure webhook |
| GET | `/group/fetchAllGroups/{name}` | List WhatsApp groups |

### Instance Settings

```json
{
  "rejectCall": false,
  "msgCall": "",
  "groupsIgnore": false,
  "alwaysOnline": true,
  "readMessages": false,
  "readStatus": false,
  "syncFullHistory": false
}
```

### Number Format

International format without `+`, spaces, or dashes:
- Brazil: `5511999999999` (55=country, 11=area, 9 digits)
- Groups: `120363xxxxx@g.us`

### Authentication

All requests require the `apikey` header:
```
apikey: <EVOLUTION_API_KEY>
```

---

## Source Reference (wa-man)

| Concern | File |
|---|---|
| Instance CRUD service | `src/services/instance.service.ts` |
| QR connection hook | `src/hooks/use-qr-connection.ts` |
| State change detection | `src/hooks/use-state-change-detection.ts` |
| Monitor notifications (instability, prolonged offline) | `src/hooks/use-monitor-notifications.ts` |
| Health probe (backend) | `server/index.ts` |
| Push notifications | `src/hooks/use-push-notifications.ts` |
| Notification builders | `src/lib/notifications/local-notifications.ts` |
| API error wrapper | `src/lib/api-error.ts` |
| Query client (retry config) | `src/lib/query-client.ts` |
| Visibility tracking | `src/hooks/use-visibility.ts` |
| Evolution types | `src/types/evolution.ts` |
