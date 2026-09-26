# MeetCtrlP Desktop App MVP — Blueprint & Specification Master Index

This directory contains the comprehensive technical specification, architectural blueprints, functional requirements, and the **finalized Google Cloud Firestore real-time NoSQL data model** for the **MeetCtrlP Print Shop Partner Desktop Application (MVP)**.

It reflects the strategic transition from relational PostgreSQL to **Google Cloud Firestore**, enabling native sub-second real-time streaming, built-in offline synchronization, and single-document atomic operations.

---

## 1. The Cloud Firestore Architecture & Topology

MeetCtrlP operates on a unified, high-performance real-time data topology:

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

---

## 2. Core Firestore Deliverables & Migration Tools

| Document / Asset | Description | Target Environment |
| :--- | :--- | :--- |
| [**00_firestore_architecture_and_data_model.md**](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/00_firestore_architecture_and_data_model.md) | **Master Architectural Manifesto**: Firestore collection hierarchy, real-time snapshot listeners, atomic transactions (`runTransaction`), and embedded document models. | Architecture & Engineering |
| [**migration_guide_postgres_to_firestore.md**](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/migration_guide_postgres_to_firestore.md) | **Step-by-Step Migration Guide**: Table-to-collection mapping, data types translation, query patterns, and production Node.js migration script. | Database Migration |
| [**firestore_schema_blueprint.json**](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/firestore_schema_blueprint.json) | **Machine-Readable JSON Schema**: Formal schema specifications for all collections, subcollections, fields, types, and constraints. | API Validation & Schemas |
| [**firestore.rules**](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/firestore.rules) | **Production Security Rules**: Shop multi-tenancy isolation, staff role permissions, customer read access, and immutable audit logs. | Firebase Cloud Deployment |
| [**firestore.indexes.json**](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/firestore.indexes.json) | **Composite Indexes**: Optimized multi-field indexing for real-time order streams, pickup codes, and active print queues. | Firebase Cloud Deployment |
| [**meetctrlp_mvp_schema_v4.sql**](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/meetctrlp_mvp_schema_v4.sql) | **Legacy Relational Baseline**: Retained for reference during migration execution and validation benchmarking. | Reference Baseline |

---

## 3. Section-by-Section Functional & Technical Specifications

Each document details the functional scope, real-time Firestore data points, end-to-end data flows, and client UI consumption:

| # | Specification Document | Key Focus Areas & Real-Time Data Flow | Firestore Path |
|---|------------------------|----------------------------------------|----------------|
| **01** | [`01_shop_account_device_auth.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/01_shop_account_device_auth.md) | Shop login, Firebase Auth REST broker, Hardware fingerprinting, DPAPI tokens, and live agent heartbeats. | `/shops/{id}/users`, `/shops/{id}/agents` |
| **02** | [`02_shop_config_pricing.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/02_shop_config_pricing.md) | Minor units (INR paise), B&W vs Color rates, A4/A3 size pricing, shop capabilities, and immutable order pricing snapshots. | Embedded in `/shops/{id}.pricing` |
| **03** | [`03_orders_lifecycle_and_queues.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/03_orders_lifecycle_and_queues.md) | Sub-second order streaming, audio chimes, Order State Machine, and atomic transactions for acceptance and rejection. | `/shops/{id}/orders/{id}` |
| **04** | [`04_documents_rendering_and_privacy.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/04_documents_rendering_and_privacy.md) | S3 presigned downloads, PDFium previewing, sandboxed local storage, post-print zero-fill shredding, and compliance logs. | Embedded `documents[]`, `/accessLogs` |
| **05** | [`05_print_configuration_presets.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/05_print_configuration_presets.md) | Page range syntax (`1,3,5-8`), printer presets, per-job overrides merge engine, and immutable execution snapshots. | Embedded `config{}`, `resolvedSettings{}` |
| **06** | [`06_printer_discovery_routing.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/06_printer_discovery_routing.md) | Win32 Spooler discovery, WMI status polling, capability matching matrix, intelligent routing, and telemetry logging. | `/shops/{id}/printers/{id}` |
| **07** | [`07_print_agent_execution.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/07_print_agent_execution.md) | Native Windows Spooler execution, PrintTicket mapping, Spooler notifications (`PagesPrinted`), retries, and cancellation. | `/shops/{id}/orders/{id}/printJobs/{id}` |
| **08** | [`08_payments_cash_reconciliation.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/08_payments_cash_reconciliation.md) | Counter cash collection dialog (tendered vs change returned), Cashfree online payment verification, and daily drawer revenue balancing. | Embedded `/orders/{id}.payment` |
| **09** | [`09_fulfillment_pickup.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/09_fulfillment_pickup.md) | Ready for pickup state, customer SMS/WhatsApp notification triggers, pickup verification codes, counter handover, and order completion. | Embedded `pickupCode`, `lifecycle` |
| **10** | [`10_realtime_offline_recovery.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/10_realtime_offline_recovery.md) | Native Firestore offline caching, automatic reconnect synchronization, and distributed idempotency locks. | Firestore Local Cache, `/idempotencyKeys` |
| **11** | [`11_dashboard_diagnostics.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/11_dashboard_diagnostics.md) | Reactive WPF dashboard counters, attention-required anomaly detection, diagnostic test-sheet execution, and Serilog rolling file retention. | Embedded `/shops/{id}.stats` |
| **12** | [`12_desktop_ui_architecture.md`](file:///c:/Users/smart/workspace/meetctrlp/docs/desktop%20app%20feature%20MBP/12_desktop_ui_architecture.md) | WPF MVVM structure, 6 Primary screens, Design System adherence (flat, no drop shadows, 12px radius, brand green `#16A34A`). | UI Presentation Mapping |
