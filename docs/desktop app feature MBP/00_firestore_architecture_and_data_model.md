# Section 00: Cloud Firestore Architecture & Real-Time Data Model

## 1. Executive Summary & Why Cloud Firestore

MeetCtrlP is transitioning its core transactional and execution database from relational PostgreSQL to **Google Cloud Firestore**. 

### Why the Shift to Firestore?
Commercial print shops operate in an intense, fast-paced environment. Customers arrive, scan a QR code, upload PDFs, and expect instant printing. Traditional relational databases paired with custom WebSocket / Server-Sent Events (SSE) servers introduce:
- Synchronization lag between customer mobile web browsers, cloud servers, and local Windows print computers.
- Fragile WebSocket connection state management, custom reconnection watermarking, and manual heartbeat ping-pong protocols.
- Complex table joins (`orders` $\bowtie$ `order_documents` $\bowtie$ `print_configurations` $\bowtie$ `order_items` $\bowtie$ `payments` $\bowtie$ `print_jobs`) for a single order card render.

**Cloud Firestore resolves these problems natively:**
1. **Sub-second Real-Time Synchronization:** Cloud Firestore provides native streaming listeners (`onSnapshot` / snapshot streams). When a customer clicks "Place Order" or pays via UPI, Firestore pushes the document update directly to the Windows Desktop App in under **200 milliseconds**.
2. **Native Offline Capability:** Firestore SDKs include built-in local cache engines (LevelDB/SQLite). If the shop loses internet connectivity, the desktop app continues reading orders and queueing mutations. The moment internet is restored, Firestore synchronizes changes automatically without custom replay queues.
3. **Atomic Document Model (No Expensive Joins):** An order's items, document metadata, print settings, and payment details are encapsulated in a single, atomic document with subcollections. One single snapshot read delivers the entire order state to the UI.
4. **Seamless Integration with Firebase Auth & Railway S3:** Identity, real-time database, and object storage work cohesively under unified security rules and service accounts.

---

## 2. Global System Topology

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MEETCTRLP FIRESTORE TOPOLOGY                                   │
├─────────────────────────┬─────────────────────────┬────────────────────────┬─────────────────────┤
│   1. FIREBASE AUTH      │  2. CLOUD FIRESTORE     │  3. RAILWAY S3 STORAGE │ 4. CLIENT DESKTOP   │
│   (Identity & Sessions) │  (Real-Time Database)   │  (PDF Object Storage)  │ (WPF .NET 8 / Agent)│
├─────────────────────────┼─────────────────────────┼────────────────────────┼─────────────────────┤
│ • Password Checks       │ • Shops & Configurations│ • Raw PDF files        │ • Realtime Listener │
│ • Firebase UID (UID)    │ • Real-time Orders      │ • Presigned PUT URLs   │ • Local Spooler API │
│ • ID Tokens (JWT)       │ • Embedded Order Items  │ • Presigned GET URLs   │ • Win32 Hardware WMI│
│ • Refresh Tokens        │ • Print Jobs (Physical) │ • 15-min signed TTL    │ • PDFium Previewer  │
│ • Phone Mapping Emails  │ • Discovered Printers   │                        │ • Local Zero-Shred  │
│   ({num}@phone.meet... )│ • Cashier Payments      │                        │ • Serilog Logs      │
│                         │ • Device Telemetry      │                        │                     │
└─────────────────────────┴─────────────────────────┴────────────────────────┴─────────────────────┘
```

> **Client Boundary:** The Windows desktop application interacts with Firestore either via the official Google Cloud Firestore C# / gRPC SDK or via authenticated REST / WebSocket streaming brokered by `apps/server`. S3 upload/download URLs and Firebase Admin privileges remain securely governed by the backend.

---

## 3. Firestore Document Hierarchy & Collection Structure

Firestore organizes data into **Root Collections** and scoped **Subcollections**. This guarantees strict shop isolation (multi-tenancy) and hyper-efficient queries:

```text
/shops/{shopId}                                   <-- Root Collection: Shops
    ├── /users/{userId}                           <-- Subcollection: Staff & Operators
    ├── /agents/{agentId}                         <-- Subcollection: Registered Desktop PCs
    ├── /printers/{printerId}                     <-- Subcollection: Discovered Hardware
    │       └── /telemetry/{telemetryId}          <-- Subcollection: Hardware Logs (Jams, Errors)
    └── /orders/{orderId}                         <-- Subcollection: Real-Time Order Stream
            ├── /printJobs/{jobId}                <-- Subcollection: Physical Spooler Jobs
            └── /statusHistory/{historyId}        <-- Subcollection: State Transition Audit Trail

/printUsers/{printUserId}                         <-- Root Collection: Anonymous Customer Sessions
/subscriptions/{subscriptionId}                   <-- Root Collection: Shop SaaS Subscriptions
/accessLogs/{logId}                               <-- Root Collection: Compliance & Shredding Trails
/idempotencyKeys/{key}                            <-- Root Collection: Distributed Lock / Idempotency
```

---

## 4. Comprehensive Schema Definitions

All monetary amounts are strictly maintained as **integer minor units (INR paise)** (`100 = ₹1.00`). All dates are stored as native Firestore `Timestamp` objects.

### 4.1 Root Collection: `/shops/{shopId}`
Represents the print shop's business entity, operational hours, capabilities, and active pricing rules.

```json
{
  "id": "shop_9b1deb4d",
  "name": "PrintWorld Xerox & Cyber Cafe",
  "slug": "printworld-xerox-katwaria-sarai",
  "phone": "+919876543210",
  "email": "printworld@example.com",
  "status": "ACTIVE", // PENDING | ACTIVE | SUSPENDED | INACTIVE
  "address": {
    "line1": "Shop #4, Near IIT Flyover",
    "line2": "Katwaria Sarai",
    "city": "New Delhi",
    "state": "Delhi",
    "postalCode": "110016",
    "country": "India",
    "geoPoint": { "latitude": 28.5412, "longitude": 77.1895 }
  },
  "capabilities": {
    "bwPrinting": true,
    "colorPrinting": true,
    "a4Printing": true,
    "a3Printing": false
  },
  "pricing": {
    "currency": "INR",
    "unit": "PER_PAGE",
    "bwA4PricePaise": 200,      // ₹2.00 per page
    "colorA4PricePaise": 1000,  // ₹10.00 per page
    "colorA3PricePaise": 2500,  // ₹25.00 per page
    "updatedAt": "Timestamp"
  },
  "businessHours": [
    { "dayOfWeek": 1, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
    { "dayOfWeek": 2, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
    { "dayOfWeek": 3, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
    { "dayOfWeek": 4, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
    { "dayOfWeek": 5, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
    { "dayOfWeek": 6, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
    { "dayOfWeek": 0, "opensAt": "10:00", "closesAt": "18:00", "isClosed": false }
  ],
  "stats": {
    "totalOrdersToday": 42,
    "grossRevenueTodayPaise": 185000,
    "cashInDrawerTodayPaise": 44000
  },
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

---

### 4.2 Subcollection: `/shops/{shopId}/users/{userId}`
Staff and owner accounts belonging to the shop, linked to Firebase Authentication.

```json
{
  "id": "usr_7a18b4",
  "shopId": "shop_9b1deb4d",
  "firebaseUid": "firebase_auth_uid_xyz789", // Joined to Firebase Auth
  "name": "Ramesh Kumar",
  "phone": "+919876543210",
  "email": "ramesh@printworld.com",
  "role": "OWNER", // OWNER | MANAGER | STAFF
  "status": "ACTIVE", // ACTIVE | INACTIVE | SUSPENDED
  "lastLoginAt": "Timestamp",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

---

### 4.3 Subcollection: `/shops/{shopId}/agents/{agentId}`
Represents the local Windows desktop computer acting as the physical print controller.

```json
{
  "id": "agent_win_01",
  "shopId": "shop_9b1deb4d",
  "name": "Front Desk Billing PC",
  "deviceIdentifier": "MC-WIN-98A72FBC", // MachineGuid + Motherboard SHA-256
  "hostname": "DESKTOP-PRINT-01",
  "osVersion": "Microsoft Windows 11 Pro 10.0.22631",
  "appVersion": "1.0.0",
  "agentVersion": "1.0.0",
  "status": "ONLINE", // ONLINE | OFFLINE | DISABLED
  "heartbeatIntervalSeconds": 30,
  "registeredByUserId": "usr_7a18b4",
  "lastSeenAt": "Timestamp",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

---

### 4.4 Subcollection: `/shops/{shopId}/printers/{printerId}`
Represents physical printing hardware discovered on the Windows host.

```json
{
  "id": "prn_canon_ir2006",
  "shopId": "shop_9b1deb4d",
  "agentId": "agent_win_01",
  "name": "Canon iR2006 Multifunction",
  "systemName": "Canon iR2006 UFR II",
  "driverName": "Canon UFR II Driver v4.2",
  "portName": "USB001",
  "status": "ONLINE", // ONLINE | OFFLINE | PRINTING | ERROR | PAUSED
  "statusReason": null,
  "isDefault": true,
  "isColorCapable": false,
  "isDuplexCapable": false,
  "supportedPaperSizes": ["A4", "A3"],
  "defaultPrintSettings": {
    "copies": 1,
    "orientation": "PORTRAIT",
    "paperSize": "A4",
    "inputTray": "AUTO_SELECT",
    "colorMode": "COLOR",
    "printQualityDpi": "STANDARD_600DPI"
  },
  "activeJobsCount": 0,
  "lastSeenAt": "Timestamp",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

---

### 4.5 Subcollection: `/shops/{shopId}/orders/{orderId}` (The Real-Time Core)
The primary real-time document streamed directly into the desktop WPF UI. Documents and pricing items are denormalized inside this document to guarantee single-read atomic retrieval and historical immutability.

```json
{
  "id": "ord_8821",
  "orderNumber": "ORD-8821",
  "shopId": "shop_9b1deb4d",
  "printUserId": "pusr_anonymous_session_44",
  "status": "SUBMITTED", // SUBMITTED | SHOP_ACCEPTED | PRINTING | READY | COMPLETED | REJECTED | CANCELLED
  "pickupCode": "8821",
  
  "amounts": {
    "currency": "INR",
    "subtotalPaise": 4500,  // ₹45.00
    "taxPaise": 0,
    "discountPaise": 0,
    "totalPaise": 4500
  },

  "payment": {
    "method": "CASH",       // CASH | ONLINE
    "status": "PENDING",    // PENDING | PAID | FAILED | REFUNDED
    "amountPaise": 4500,
    "paidAt": null,
    "cashTenderedPaise": null,
    "changeReturnedPaise": null,
    "collectedByUserId": null,
    "collectedAt": null,
    "providerTransactionId": null
  },

  "documents": [
    {
      "id": "doc_01",
      "originalFilename": "Project_Presentation.pdf",
      "storageKey": "uploads/shop_9b1deb4d/ord_8821/doc_01.pdf",
      "mimeType": "application/pdf",
      "fileSizeBytes": 2457600,
      "pageCount": 18,
      "sha256Hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      "status": "UPLOADED",
      "config": {
        "colorMode": "BW",
        "copies": 2,
        "paperSize": "A4",
        "pageSelection": "1-18",
        "billablePages": 18
      },
      "shreddedAt": null
    }
  ],

  "items": [
    {
      "description": "A4 B&W Document Print (18 pages × 2 copies)",
      "quantity": 36,
      "unitPricePaise": 125,
      "totalPricePaise": 4500
    }
  ],

  "rejection": {
    "rejectedAt": null,
    "reason": null,
    "category": null
  },

  "lifecycle": {
    "createdAt": "Timestamp",
    "acceptedAt": null,
    "readyAt": null,
    "completedAt": null,
    "cancelledAt": null,
    "acceptedByUserId": null,
    "completedByUserId": null
  },

  "updatedAt": "Timestamp"
}
```

---

### 4.6 Subcollection: `/shops/{shopId}/orders/{orderId}/printJobs/{jobId}`
Represents physical execution tracking by the local Windows Print Agent.

```json
{
  "id": "job_301",
  "orderId": "ord_8821",
  "documentId": "doc_01",
  "printerId": "prn_canon_ir2006",
  "agentId": "agent_win_01",
  "spoolerJobId": 142,
  "status": "PRINTING", // QUEUED | DISPATCHING | PRINTING | COMPLETED | FAILED | CANCELLED
  "priority": 0,
  "retryCount": 0,
  "pagesTotal": 36,
  "pagesPrinted": 14,
  "requestedOverrides": {
    "copies": 2,
    "colorMode": "GRAYSCALE"
  },
  "resolvedSettings": {
    "copies": 2,
    "orientation": "PORTRAIT",
    "paperSize": "A4",
    "inputTray": "AUTO_SELECT",
    "colorMode": "GRAYSCALE",
    "printQualityDpi": "STANDARD_600DPI"
  },
  "errorCode": null,
  "errorMessage": null,
  "spooledAt": "Timestamp",
  "startedAt": "Timestamp",
  "completedAt": null,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

---

## 5. The New Real-Time Data Flow & Working with Firestore

### 5.1 Real-Time Subscription (WPF Desktop App)
Instead of polling or relying on WebSocket relays, the desktop application sets up a direct, persistent Firestore Snapshot Listener:

```csharp
// C# / WPF Desktop Real-Time Subscription
public void StartOrderStream(string shopId)
{
    var ordersRef = _firestoreDb.Collection("shops")
                                .Document(shopId)
                                .Collection("orders");

    // Listen only to active orders (New, Printing, Ready)
    var query = ordersRef.WhereIn("status", new[] { "SUBMITTED", "SHOP_ACCEPTED", "PRINTING", "READY" })
                         .OrderByDescending("lifecycle.createdAt");

    query.Listen(snapshot =>
    {
        foreach (var change in snapshot.Changes)
        {
            var orderDoc = change.Document;
            var order = orderDoc.ConvertTo<OrderModel>();

            App.Current.Dispatcher.Invoke(() =>
            {
                switch (change.ChangeType)
                {
                    case DocumentChange.Type.Added:
                        NewOrders.Insert(0, order);
                        SystemSounds.Asterisk.Play(); // Audible alert on order arrival!
                        break;

                    case DocumentChange.Type.Modified:
                        UpdateExistingOrderCard(order);
                        break;

                    case DocumentChange.Type.Removed:
                        RemoveOrderFromQueue(order.Id);
                        break;
                }
            });
        }
    });
}
```

### 5.2 Atomic Operations & Transactions (`runTransaction`)
When state changes involve critical business rules (e.g. accepting an order before customer can cancel, or collecting cash), Firestore transactions guarantee atomicity:

```typescript
// Node.js / apps/server: Atomic Order Acceptance
export async function acceptOrder(shopId: string, orderId: string, staffId: string) {
  const db = getFirebaseFirestore();
  const orderRef = db.doc(`shops/${shopId}/orders/${orderId}`);

  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(orderRef);
    if (!doc.exists) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const orderData = doc.data()!;
    if (orderData.status !== "SUBMITTED") {
      throw new Error(`CANNOT_ACCEPT_ORDER_IN_STATUS_${orderData.status}`);
    }

    transaction.update(orderRef, {
      status: "SHOP_ACCEPTED",
      "lifecycle.acceptedAt": FieldValue.serverTimestamp(),
      "lifecycle.acceptedByUserId": staffId,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Also add to audit subcollection
    const auditRef = orderRef.collection("statusHistory").doc();
    transaction.set(auditRef, {
      fromStatus: "SUBMITTED",
      toStatus: "SHOP_ACCEPTED",
      changedByUserId: staffId,
      timestamp: FieldValue.serverTimestamp()
    });

    return { success: true };
  });
}
```

---

## 6. Firestore Security Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: Verify user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper: Verify user belongs to the shop
    function isShopStaff(shopId) {
      return isAuthenticated() && (
        request.auth.token.shopId == shopId ||
        exists(/databases/$(database)/documents/shops/$(shopId)/users/$(request.auth.uid))
      );
    }

    // Shops Collection
    match /shops/{shopId} {
      allow read: if true; // Public shop profile for customers
      allow write: if isShopStaff(shopId);

      match /users/{userId} {
        allow read, write: if isShopStaff(shopId);
      }

      match /agents/{agentId} {
        allow read, write: if isShopStaff(shopId);
      }

      match /printers/{printerId} {
        allow read, write: if isShopStaff(shopId);
      }

      match /orders/{orderId} {
        allow read: if isShopStaff(shopId) || (isAuthenticated() && resource.data.printUserId == request.auth.uid);
        allow create: if true; // Customers can submit new orders
        allow update, delete: if isShopStaff(shopId);

        match /printJobs/{jobId} {
          allow read, write: if isShopStaff(shopId);
        }

        match /statusHistory/{historyId} {
          allow read: if isShopStaff(shopId);
          allow write: if isShopStaff(shopId);
        }
      }
    }

    // Print Users
    match /printUsers/{userId} {
      allow read, write: if true;
    }
  }
}
```
