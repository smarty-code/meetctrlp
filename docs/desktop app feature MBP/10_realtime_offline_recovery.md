# Section 10: Realtime Architecture, Offline Queue & Disaster Recovery

## 1. Product Requirements & MVP Scope

Based on `FRD_MVP.md` and `meetctrlp_print_shop_partner_desktop_mvp_requirements.md`:

| Feature | Scope | Rationale / Day-0 Requirement |
|---------|-------|-------------------------------|
| **Realtime Order Ingestion** | **T0** | Orders must pop up on desktop in sub-second latency without manual polling. |
| **Offline Resilience** | **T0** | Indian shop internet connections drop frequently. App must not freeze, crash, or drop active prints. |
| **Reconnection Catch-Up** | **T0** | On reconnect, Firestore automatically replays all queued mutations and re-synchronizes state seamlessly. |
| **Idempotent Dispatch** | **T0** | Guarantees duplicate clicks or network retries never cause double prints or double charges. |
| **State Consistency** | **T0** | Cloud Firestore is the authoritative source for business state; desktop is authoritative for physical spool state. |

---

## 2. Data Points & Storage Matrix (Cloud Firestore Native Offline vs Server Idempotency)

Offline resilience is provided natively by the **Firestore SDK's built-in local persistence cache**. Server-side deduplication is handled by an idempotency key registry in **Cloud Firestore**:

| Data Point | Origin / Capture Source | Client Capture Method | Transport / DTO Format | Destination Storage | Storage Format & Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Idempotency Key** | Client UUID Generator | `Guid.NewGuid().ToString()` | HTTP Header `Idempotency-Key` | **Cloud Firestore** | `/idempotencyKeys/{key}` document |
| **Offline Mutation Queue** | Operator Action Trigger | Firestore SDK local cache | Firestore SDK internal LevelDB | **Firestore SDK Cache** | Managed automatically by SDK; no custom code required |
| **Pending Write Count** | Firestore SDK listener | `ListenerRegistration` / `waitForPendingWrites` | In-process observable counter | **Client RAM** | Bound to Offline Banner pending-actions counter |
| **Network State** | Firestore SDK / OS monitor | `enableNetwork()` / `disableNetwork()` | In-process event | **Client RAM** | Controls "Online / Offline" status banner |
| **Realtime Order Stream** | Cloud Firestore `onSnapshot` | Firestore SDK listener on `orders` subcollection | Firestore snapshot payload | **Cloud Firestore** | `shops/{shopId}/orders/{orderId}` documents |

---

## 3. How Firestore Native Offline Persistence Works

The Firestore SDK eliminates the need for any custom SQLite offline journal. Here is how the three scenarios are handled transparently:

### Scenario A — Online (Normal Operation)
- `onSnapshot` listeners receive realtime order updates with sub-second latency directly from Firestore's persistent connection.
- All writes (`set`, `update`, `runTransaction`) are committed immediately to the cloud and reflected locally.

### Scenario B — Offline (Internet Disconnected)
- The Firestore SDK detects the network loss automatically.
- `onSnapshot` listeners **continue to fire** using the local LevelDB cache — the UI remains fully interactive.
- Any writes (`set`, `update`, `runTransaction`) are **accepted by the SDK immediately** and queued in the local cache. The UI can optimistically reflect these mutations without any custom code.
- No data is lost. The app does **not** freeze, crash, or block operator workflows.

### Scenario C — Reconnection (Internet Restored)
- The Firestore SDK detects network restoration automatically.
- All queued local mutations are **replayed and synchronized** to the cloud in order, without any custom drain loop or catch-up logic.
- `onSnapshot` listeners automatically reconcile the local cache with the authoritative cloud state and fire with any diff.
- The desktop app receives a `waitForPendingWrites()` resolved promise (or equivalent) signaling that all pending mutations are committed — at which point the Status Banner switches to "Online – All Synced".

> [!IMPORTANT]
> The entire custom SQLite offline journal (`local_mutation_journal`) and all associated drain-loop logic from previous designs **are removed**. Firestore's built-in offline persistence subsystem handles this completely. This also means there are **zero schema migrations** required for the offline store — the SDK manages its own internal LevelDB/SQLite cache.

---

## 4. Technical Build Specification

### 4.1 Enabling Firestore Offline Persistence (Server-side / Node.js Admin SDK)

The Firebase Admin SDK (used in `apps/server`) does not use local persistence — it always connects directly to Firestore. Offline persistence is configured on the **client-side** Firestore SDK. For the desktop app's backend communication, the Admin SDK is used as normal:

```typescript
// apps/server — Firebase Admin SDK (always online, no local cache needed)
import { getFirebaseFirestore } from "@ctrlp/firebase";
import { FieldValue } from "firebase-admin/firestore";

const db = getFirebaseFirestore();
```

### 4.2 Enabling Firestore Offline Persistence (Client-side Web / Electron SDK)

If the desktop app embeds a web renderer or uses a JavaScript Firestore client directly, enable persistent local cache:

```typescript
// Firestore client SDK — enable persistent local cache (LevelDB under the hood)
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { firebaseApp } from "./firebaseApp";

const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(), // optional: multi-tab support
  }),
});

export { db };
```

> [!NOTE]
> For the C# WPF desktop app communicating via `apps/server` REST/WebSocket proxy, offline resilience at the **transport layer** is handled by the Firestore Admin SDK on the server side. The desktop app's local resilience relies on the Firestore `onSnapshot` listener reconnecting automatically and the server queuing any mutations submitted via the HTTP API using the idempotency key mechanism described in §4.4.

### 4.3 Realtime Order Listener (TypeScript — apps/server or embedded web layer)

```typescript
import { getFirebaseFirestore } from "@ctrlp/firebase";

const db = getFirebaseFirestore();

/**
 * Subscribe to all SUBMITTED orders for a shop.
 * Firestore's onSnapshot automatically reconnects on network restoration.
 */
function subscribeToNewOrders(shopId: string, onUpdate: (orders: FirebaseFirestore.QueryDocumentSnapshot[]) => void) {
  return db
    .collection("shops")
    .doc(shopId)
    .collection("orders")
    .where("status", "==", "SUBMITTED")
    .onSnapshot(
      (snapshot) => {
        onUpdate(snapshot.docs);
      },
      (error) => {
        // Firestore SDK handles reconnection internally; log for diagnostics only
        console.error("Firestore listener error (will auto-retry):", error);
      }
    );
}
```

### 4.4 Idempotent Server Verification Rule (Firestore)

Server-side idempotency keys are stored in the `/idempotencyKeys/{key}` Firestore collection to prevent duplicate processing of retried requests:

```typescript
import { getFirebaseFirestore } from "@ctrlp/firebase";
import { FieldValue } from "firebase-admin/firestore";

const db = getFirebaseFirestore();

export async function handleIdempotentRequest(
  req: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (!idempotencyKey) return handler();

  const keyRef = db.doc(`idempotencyKeys/${idempotencyKey}`);
  const keySnap = await keyRef.get();

  if (keySnap.exists) {
    // Return the cached response for this idempotency key
    const cached = keySnap.data()!;
    return new Response(JSON.stringify(cached.responseBody), {
      status: cached.responseCode,
      headers: { "Content-Type": "application/json", "X-Cache": "IDEMPOTENT_HIT" },
    });
  }

  // Process the request for the first time
  const response = await handler();
  const body = await response.clone().json();

  // Persist the idempotency record to Firestore
  await keyRef.set({
    key: idempotencyKey,
    shopId: (req as any).shopId ?? null,
    requestPath: req.url,
    responseCode: response.status,
    responseBody: body,
    createdAt: FieldValue.serverTimestamp(),
    // TTL field — a Cloud Function or TTL policy will delete docs after 24 hours
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return response;
}
```

> [!TIP]
> Enable Firestore **TTL policies** on the `idempotencyKeys` collection using the `expiresAt` field to automatically purge expired keys after 24 hours without any cron job. Configure this in the Firebase console under Firestore → TTL.

---

## 5. End-to-End Offline Buffering & Reconnection Catch-Up Flow

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Shop Operator
    participant UI as Desktop UI
    participant FS as Cloud Firestore
    participant SDK as Firestore SDK (Local Cache)
    participant Net as Network Monitor
    participant Server as MeetCtrlP Server (apps/server)

    %% 1. Internet connection drops
    Net->>UI: 1. Network Interface Down / Ping timeout
    SDK->>UI: 2. Firestore SDK fires offline event
    UI->>UI: 3. Set Status Banner to "Offline - Working Locally"

    %% 2. Operator performs actions while offline
    Operator->>UI: 4. Accepts Order #1042
    UI->>SDK: 5. Write → orders/{orderId}: { status: 'SHOP_ACCEPTED' }
    SDK->>SDK: 6. Queue mutation in local LevelDB cache (auto, no custom code)
    SDK->>UI: 7. onSnapshot fires with optimistic local data (UI updates instantly)
    Operator->>UI: 8. Collects Cash ₹45 for Order #1041
    UI->>SDK: 9. Write → orders/{orderId}: { paymentStatus: 'CASH_COLLECTED' }
    SDK->>SDK: 10. Queue mutation in local LevelDB cache
    UI->>UI: 11. Update Offline Banner: "Offline • 2 writes pending"

    %% 3. Internet restored — Firestore SDK handles everything automatically
    Net->>SDK: 12. Network Restored
    SDK->>FS: 13. Firestore SDK automatically replays all queued mutations
    FS-->>SDK: 14. Mutations committed; cloud confirms writes
    SDK->>UI: 15. onSnapshot fires with authoritative cloud state (reconciliation)
    SDK->>UI: 16. waitForPendingWrites() resolves → "All Synced"
    UI->>UI: 17. Set Status Banner to "Online - All Synced"
```

---

## 6. Screen UI & Interaction Design

- **Status Banner Strip (`ShellWindow.xaml`):**
  - **Online:** Green dot `● Realtime Connected (Firestore Listener Active)`.
  - **Offline:** Red bar `✕ Internet Disconnected • Working in Offline Mode • 2 Writes Pending`.
  - **Reconnecting / Syncing:** Amber bar with spinner `◌ Internet Restored • Firestore Syncing pending writes...`.

---

## 7. Firestore Collection Blueprint

### 7.1 Idempotency Keys Collection — `/idempotencyKeys/{key}`

```typescript
// Document path: /idempotencyKeys/{idempotencyKey}
interface IdempotencyKeyDocument {
  key: string;               // The UUID idempotency key (also the document ID)
  shopId: string | null;     // Shop context for this request
  requestPath: string;       // e.g. "/api/v1/orders/1042/accept"
  responseCode: number;      // HTTP status code of the cached response
  responseBody: object;      // JSON body of the cached response
  createdAt: Timestamp;      // FieldValue.serverTimestamp()
  expiresAt: Date;           // createdAt + 24 hours (used by Firestore TTL policy)
}
```

### 7.2 Write an Idempotency Key

```typescript
import { getFirebaseFirestore } from "@ctrlp/firebase";
import { FieldValue } from "firebase-admin/firestore";

const db = getFirebaseFirestore();

await db.doc(`idempotencyKeys/${idempotencyKey}`).set({
  key: idempotencyKey,
  shopId,
  requestPath,
  responseCode: 200,
  responseBody: { orderId, status: "SHOP_ACCEPTED" },
  createdAt: FieldValue.serverTimestamp(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
});
```

### 7.3 Read / Check an Idempotency Key

```typescript
const keySnap = await db.doc(`idempotencyKeys/${idempotencyKey}`).get();

if (keySnap.exists) {
  const cached = keySnap.data()!;
  // Return cached.responseBody with cached.responseCode
}
```
