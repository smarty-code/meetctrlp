# MeetCtrlP Print Shop Partner Desktop MVP

**Owner:** MeetCtrlP Product · **Team:** Product / Design / Engineering · **Status:** Draft · **Target:** MVP Release

---

## 1. Objective Statement

- **Statement:** As a Print Shop Partner, I want to receive, review, configure, execute, monitor, and complete customer print orders from a single desktop application so that I can operate my print shop digitally without manually downloading files, interpreting customer instructions, or managing printer execution outside the platform.
- **Scope:** The MVP covers the complete shop side of the MeetCtrlP print workflow, from authenticated shop/device setup and realtime order reception through local printer execution, payment handling, pickup readiness, completion, history, pricing, printer management, diagnostics, privacy, security, and recovery.

The desktop application is not only an order management interface. It is the **local print execution layer** connecting MeetCtrlP cloud services with the physical printers inside the shop.

---



# 2. The "Why"



### Problem

Traditional print shop workflows require the shop operator to manually:

1. Receive documents through WhatsApp or another communication channel.
2. Download files.
3. Understand customer instructions.
4. Determine printing requirements.
5. Calculate pricing.
6. Select an appropriate printer.
7. Print manually.
8. Track whether printing succeeded.
9. Collect payment.
10. Inform the customer that the order is ready.

This creates operational overhead, introduces human errors, makes order tracking difficult, and prevents MeetCtrlP from reliably controlling the physical print workflow.

### User Value

The Print Shop Partner gets:

- A centralized order queue.
- Clear customer print instructions.
- Automatic document retrieval.
- Structured print configuration.
- Automatic price and payment visibility.
- Printer discovery and capability management.
- Automatic printer selection and routing.
- Local print execution.
- Print progress and failure visibility.
- Retry and recovery workflows.
- Cash payment tracking.
- Ready for pickup and completion states.
- Order history.
- Shop and pricing configuration.
- Device and printer diagnostics.



### Business Value

The desktop application enables MeetCtrlP to provide the operational infrastructure required for a subscription based print shop platform.

It supports:

- Shop subscription value.
- Higher order processing efficiency.
- Reduced operator intervention.
- Reliable order fulfillment.
- Printer integration as a core product differentiator.
- Consistent payment and order state management.
- Scalable multi shop operations.
- Future expansion into advanced printing services.



### Data / Research

The MVP is based on the product workflow and requirements established for MeetCtrlP. Quantitative production benchmarks will be established after pilot shops begin processing real orders.

---



# 3. High-Level Solution & User Flow



## Overview

The Print Shop Partner uses a Windows desktop application connected to MeetCtrlP cloud services.

The application receives orders through a secure realtime connection, retrieves authoritative order state from the backend, validates the requested print configuration, routes print jobs through a local print agent, communicates with locally connected printers, monitors execution, and updates the cloud order state.

### Primary Product Architecture

```text
Customer Web App
       │
       │ Order + Documents + Configuration
       ▼
MeetCtrlP Backend
       │
       │ Realtime Event
       ▼
Windows Desktop App
       │
       ▼
Local Print Agent
       │
       ├── Printer Discovery
       ├── Capability Detection
       ├── Printer Routing
       ├── Print Execution
       └── Print Status
       │
       ▼
Physical Printer
```



### Primary User Flow

```text
Shop Login
    ↓
Device Registration
    ↓
Printer Discovery / Setup
    ↓
Dashboard
    ↓
New Order
    ↓
Orders
    ↓
Order Details
    ↓
Validate Order
    ↓
Accept / Reject
    ↓
Print Readiness Validation
    ↓
Start Printing
    ↓
Print Queue
    ↓
Local Print Agent
    ↓
Printer
    ↓
Print Completed
    ↓
Order Ready
    ↓
Customer Pickup
    ↓
Payment Completion if Cash
    ↓
Order Completed
```



## Six Primary Screens



### Screen 1: Dashboard

Operational overview containing:

- New orders.
- Pending/active orders.
- Printing orders.
- Ready orders.
- Completed orders today.
- Revenue visibility.
- Paid revenue.
- Cash pending.
- Printer health.
- Attention required.
- Failed print jobs.
- Offline printer warnings.
- Recent orders.
- Realtime connection status where relevant.

The Dashboard provides operational visibility and must not duplicate the complete Orders workflow.

---



### Screen 2: Orders

Centralized order management.

The screen uses tabs, filters, and search rather than separate screens.

Supported views:

- All.
- New.
- Active.
- Ready.
- Completed.
- Historical orders.

Features:

- Order search.
- Order ID search.
- Filename search.
- Date filtering.
- Payment filtering.
- Status filtering.
- Order status.
- Payment status.
- Document count.
- Page count.
- Amount.
- Created time.
- Order actions according to state.
- Open Order Details.
- Accept.
- Reject.
- View completed orders.
- Order history.

---



### Screen 3: Order Details

The detailed operational view for a single customer order.

Features:

- Order ID.
- Creation time.
- Customer type.
- Payment status.
- Payment amount.
- Order status.
- Document list.
- Filename.
- File size.
- Page count.
- Document preview.
- B&W / Color configuration.
- Number of copies.
- Paper size.
- Page selection.
- Document availability validation.
- File validation.
- Rendering validation.
- Printer capability validation.
- Print readiness.
- Accept order.
- Reject order.
- Start printing.
- Current print progress.
- Payment details.
- Cash collection state.
- Ready for pickup state.
- Order completion.

The MVP must not introduce a separate Print Preparation screen.

Print preparation is a section within Order Details.

---



### Screen 4: Print Queue

Dedicated physical print execution workspace.

Features:

- Queued jobs.
- Printing jobs.
- Failed jobs.
- Completed jobs.
- Order ID.
- Document.
- Printer.
- Print configuration.
- Job status.
- Print progress.
- Start time.
- Failure reason.
- Retry.
- Printer reassignment where supported.
- Pause/resume where safely supported.
- Cancel where safely supported.
- Print job recovery.
- Print job status synchronization.

Print Job Details appear as a drawer/modal from the Print Queue rather than a separate screen.

---



### Screen 5: Printers

Dedicated printer infrastructure management screen.

Features:

- Printer discovery.
- Printer list.
- Printer connection status.
- Online state.
- Offline state.
- Busy state.
- Error state.
- Printer capability detection.
- B&W capability.
- Color capability.
- Supported paper sizes.
- Printer identifier.
- Default printer.
- Printer routing.
- Connect.
- Disconnect.
- Test print.
- Printer diagnostics.
- Printer configuration.
- Local print agent status.
- Printer assignment/routing preferences.

Printer configuration is managed through contextual panels/drawers rather than separate navigation screens.

---



### Screen 6: Shop & Settings

Configuration and administration workspace.

Sections include:

#### Shop

- Shop profile.
- Shop name.
- Location.
- Contact information.
- Shop operational information.



#### Pricing

- B&W pricing.
- Color pricing.
- Paper size pricing.
- Applicable pricing rules.
- Configurable shop pricing.

All prices must be configuration driven.

No business pricing value may be hardcoded in the desktop application.

#### Services / Capabilities

- Supported printing modes.
- B&W.
- Color.
- Supported paper sizes.
- Other MVP supported capabilities.

Only capabilities supported by the configured shop and printer infrastructure should be exposed.

#### Device

- Device registration.
- Device identifier.
- Device name.
- Connection status.
- Desktop application version.
- Local print agent version.
- Device status.



#### Notifications

- Notification preferences.
- Operational notification configuration.



#### Account

- Account information.
- Authentication state.
- Sign out.



#### Diagnostics

- Backend connectivity.
- Realtime connection.
- Local print agent health.
- Printer discovery health.
- Printer connectivity.
- Synchronization state.
- Application version.
- Agent version.
- Diagnostic logs.
- Log export.

---



## Supporting Flows That Are Not Primary Screens

The following functionality remains part of the MVP but does not require permanent navigation:

### Authentication / Onboarding

```text
Login
  ↓
Device Registration
  ↓
Printer Discovery
  ↓
Initial Configuration
  ↓
Dashboard
```



### Notifications

Notifications are presented through contextual notifications, dashboard attention states, and notification panels.

### Error States

Errors are displayed within the relevant workflow rather than creating separate error screens.

### Print Job Details

Presented as a drawer/modal inside Print Queue.

### Printer Management Details

Presented as a drawer/modal inside Printers.

---



## Scope



### In Scope: P0

- Shop authentication.
- Device authentication and registration.
- Shop profile.
- Pricing configuration.
- Service/capability configuration.
- Printer discovery.
- Printer capability mapping.
- Local print agent.
- Printer connection management.
- Secure realtime order events.
- Order queue.
- Order details.
- Document retrieval.
- Document preview.
- Print configuration visibility.
- Order acceptance.
- Order rejection.
- Print readiness validation.
- Automatic print execution.
- Printer selection/routing.
- Print queue.
- Print status.
- Print failure handling.
- Retry.
- Payment status.
- Online payment status synchronization.
- Cash payment handling.
- Ready for pickup.
- Order completion.
- Order history.
- Dashboard.
- Notifications.
- Diagnostics.
- Recovery/reconnect.
- Privacy/security.
- Auditability.
- Idempotent order and print actions.



### Out of Scope / Deferred

The following are not part of the current Print Shop Partner MVP unless explicitly added later:

- Advanced print configuration.
- Duplex / single sided configuration.
- Pages per sheet.
- Orientation.
- Scaling.
- Collation.
- Binding.
- Stapling.
- Special instructions.
- Advanced finishing.
- Marketplace features.
- College ecosystem.
- B2B printing APIs.
- Home delivery.
- Advanced print services not supported by the MVP.

---



# 4. Functional Requirements (FRD)


| ID    | Trigger / Action               | Expected System Behavior                                                        | Design Area                 | Priority |
| ----- | ------------------------------ | ------------------------------------------------------------------------------- | --------------------------- | -------- |
| FR-01 | Shop logs in                   | Authenticate shop user and establish authorized desktop session                 | Onboarding                  | P0       |
| FR-02 | Device registered              | Associate authorized desktop device with shop                                   | Device                      | P0       |
| FR-03 | App starts                     | Restore valid session and reconnect to backend                                  | Device / Dashboard          | P0       |
| FR-04 | Printer discovery initiated    | Local agent discovers available printers                                        | Printers                    | P0       |
| FR-05 | Printer discovered             | Retrieve/map printer capabilities                                               | Printers                    | P0       |
| FR-06 | Printer selected as default    | Persist printer routing preference                                              | Printers                    | P0       |
| FR-07 | Backend creates order          | Desktop receives realtime order event                                           | Orders / Dashboard          | P0       |
| FR-08 | New order received             | Display order in New Orders state                                               | Orders                      | P0       |
| FR-09 | Operator opens order           | Load authoritative order and document information                               | Order Details               | P0       |
| FR-10 | Document requested             | Retrieve document securely using authorized access                              | Order Details               | P0       |
| FR-11 | Preview requested              | Render/display supported document preview                                       | Order Details               | P0       |
| FR-12 | Order configuration displayed  | Show B&W/Color, copies, paper size, and page selection                          | Order Details               | P0       |
| FR-13 | Order validation begins        | Validate document availability, file validity, rendering and print requirements | Order Details               | P0       |
| FR-14 | Payment status checked         | Display authoritative backend payment state                                     | Order Details               | P0       |
| FR-15 | Operator accepts order         | Backend transitions order to accepted state idempotently                        | Order Details               | P0       |
| FR-16 | Operator rejects order         | Backend records rejection and updates customer order state                      | Order Details               | P0       |
| FR-17 | Start printing                 | Create required print jobs idempotently                                         | Order Details / Print Queue | P0       |
| FR-18 | Print job created              | Add job to local print queue                                                    | Print Queue                 | P0       |
| FR-19 | Printer selected               | Route print job to compatible configured printer                                | Print Queue / Printers      | P0       |
| FR-20 | Print starts                   | Local print agent sends job to printer                                          | Print Queue                 | P0       |
| FR-21 | Print progresses               | Update job progress where printer/OS capabilities allow                         | Print Queue                 | P0       |
| FR-22 | Print succeeds                 | Mark print job completed and update order state                                 | Print Queue                 | P0       |
| FR-23 | Print fails                    | Capture failure state and reason without losing order state                     | Print Queue                 | P0       |
| FR-24 | Retry requested                | Requeue failed print job safely                                                 | Print Queue                 | P0       |
| FR-25 | Printer unavailable            | Attempt configured routing/recovery behavior and surface issue                  | Print Queue / Printers      | P0       |
| FR-26 | Printer changed                | Reassign eligible job to compatible printer                                     | Print Queue                 | P0       |
| FR-27 | Cash payment received          | Operator records cash payment                                                   | Order Details / Dashboard   | P0       |
| FR-28 | Print complete                 | Order becomes Ready for Pickup when all required jobs complete                  | Order Details / Orders      | P0       |
| FR-29 | Customer collects order        | Operator marks order completed                                                  | Order Details / Orders      | P0       |
| FR-30 | Completed order viewed         | Display historical order information                                            | Orders                      | P0       |
| FR-31 | Pricing updated                | Persist shop pricing configuration                                              | Shop & Settings             | P0       |
| FR-32 | Shop capabilities updated      | Persist supported services/capabilities                                         | Shop & Settings             | P0       |
| FR-33 | Device diagnostics opened      | Display connectivity, agent and synchronization health                          | Shop & Settings             | P0       |
| FR-34 | Printer diagnostics opened     | Display printer and connection state                                            | Printers                    | P0       |
| FR-35 | Realtime connection lost       | Show degraded connection state and attempt reconnect                            | Dashboard / Settings        | P0       |
| FR-36 | Desktop reconnects             | Synchronize authoritative backend state                                         | Dashboard / Orders / Queue  | P0       |
| FR-37 | App restarts during print      | Recover known print jobs and reconcile state                                    | Print Queue                 | P0       |
| FR-38 | Duplicate action submitted     | Backend idempotency prevents duplicate state transition/job creation            | All workflows               | P0       |
| FR-39 | Multiple devices access shop   | Concurrency controls prevent conflicting order execution                        | Orders / Print Queue        | P0       |
| FR-40 | Document no longer authorized  | Reject access and display safe error without exposing content                   | Order Details               | P0       |
| FR-41 | Unsupported printer capability | Prevent incompatible print execution                                            | Order Details / Printers    | P0       |
| FR-42 | Test print requested           | Local agent executes test print on selected printer                             | Printers                    | P0       |
| FR-43 | Notification generated         | Surface operational notification to operator                                    | Dashboard / Notifications   | P0       |
| FR-44 | Diagnostic logs exported       | Export logs without document contents or sensitive data                         | Shop & Settings             | P0       |
| FR-45 | App version checked            | Display current desktop and print agent versions                                | Shop & Settings             | P0       |
| FR-46 | Order state changes            | Synchronize state across backend, desktop and customer experience               | All relevant screens        | P0       |




---



## Order State Model

```text
CREATED
   ↓
DOCUMENTS_UPLOADED
   ↓
CONFIGURED
   ↓
PAYMENT_PENDING
   ↓
PAID / CASH_PENDING
   ↓
SUBMITTED
   ↓
SHOP_ACCEPTED
   ↓
PRINTING
   ↓
READY
   ↓
COMPLETED
```

Failure/cancellation states:

```text
PAYMENT_FAILED
SHOP_REJECTED
PRINT_FAILED
CANCELLED
REFUND_PENDING
```

---



## Print Job State Model

```text
CREATED
   ↓
VALIDATING
   ↓
READY
   ↓
QUEUED
   ↓
PRINTING
   ↓
COMPLETED
```

Failure states:

```text
VALIDATION_FAILED
PRINTER_UNAVAILABLE
PRINT_FAILED
CANCELLED
```

Retry:

```text
PRINT_FAILED
    ↓
RETRY_REQUESTED
    ↓
QUEUED
    ↓
PRINTING
```

---



## Order / Print Job Relationship

An order must not be treated as equivalent to a printer job.

```text
Order
 ├── Document 1
 │     └── Print Job(s)
 │
 ├── Document 2
 │     └── Print Job(s)
 │
 └── Document 3
       └── Print Job(s)
```

A print job can have multiple attempts.

This allows:

- Printer failures.
- Retry.
- Printer reassignment.
- Multi document orders.
- Multiple printers.
- Partial execution tracking.

---



## Edge Cases & Handling



### Empty / Zero States

**Orders**

Display an empty state when there are no orders matching the selected filter.

**Print Queue**

Display an empty queue when there are no active jobs.

**Printers**

Display a setup state when no printers have been discovered.

**Dashboard**

Show zero values without treating them as errors.

---



### Error / Offline States

The desktop application must handle:

- Backend unavailable.
- Realtime connection lost.
- Printer offline.
- Printer busy.
- Printer error.
- Print job failure.
- Document retrieval failure.
- Document validation failure.
- Unsupported paper size.
- Unsupported color mode.
- Local print agent unavailable.
- Device authentication expiration.
- Network interruption.
- Application restart.
- Printer reconnection.

Realtime connection loss must not cause the desktop application to assume that the backend state has changed.

The backend remains the source of truth.

---



### Validation & Limits

Validation must cover:

- Supported file types.
- File availability.
- File integrity.
- File rendering.
- Document access authorization.
- Page selection.
- Copy count.
- Paper size.
- Color capability.
- Printer capability.
- Shop capability.
- Payment state.
- Order state.
- Printer availability.

Business values such as prices, supported capabilities, limits and configuration must not be hardcoded into the desktop application.

---



# 5. Tracking & Analytics

Analytics should be implemented through MeetCtrlP's analytics infrastructure, with PostHog as the planned analytics platform.

Sensitive document contents, document filenames where unnecessary, payment secrets, authentication secrets, and printer private data must not be included in analytics events.


| Event Name                 | Trigger                      | Key Properties                                 | Tool             |
| -------------------------- | ---------------------------- | ---------------------------------------------- | ---------------- |
| `desktop_app_started`      | App launches                 | `device_id`, `app_version`                     | PostHog          |
| `dashboard_viewed`         | Dashboard opened             | `shop_id`, `device_id`                         | PostHog          |
| `orders_viewed`            | Orders screen opened         | `shop_id`, `filter`                            | PostHog          |
| `order_opened`             | Order Details opened         | `order_id`, `shop_id`                          | PostHog          |
| `order_accepted`           | Operator accepts order       | `order_id`, `shop_id`                          | PostHog          |
| `order_rejected`           | Operator rejects order       | `order_id`, `shop_id`, `reason_category`       | PostHog          |
| `print_started`            | Print execution starts       | `order_id`, `print_job_id`, `printer_id`       | PostHog          |
| `print_completed`          | Print job succeeds           | `print_job_id`, `printer_id`, `duration_ms`    | PostHog          |
| `print_failed`             | Print job fails              | `print_job_id`, `printer_id`, `error_category` | PostHog          |
| `print_retried`            | Retry initiated              | `print_job_id`, `printer_id`                   | PostHog          |
| `printer_discovered`       | Printer discovered           | `printer_id`, `capability_summary`             | PostHog          |
| `printer_connected`        | Printer becomes connected    | `printer_id`                                   | PostHog          |
| `printer_disconnected`     | Printer becomes disconnected | `printer_id`                                   | PostHog          |
| `printer_test_printed`     | Test print requested         | `printer_id`                                   | PostHog          |
| `cash_payment_recorded`    | Cash payment recorded        | `order_id`, `amount`                           | PostHog          |
| `order_ready`              | Order becomes ready          | `order_id`                                     | PostHog          |
| `order_completed`          | Order completed              | `order_id`                                     | PostHog          |
| `realtime_connection_lost` | Connection lost              | `device_id`, `duration`                        | PostHog          |
| `realtime_reconnected`     | Connection restored          | `device_id`, `downtime_ms`                     | PostHog          |
| `desktop_error`            | Application error            | `error_category`, `app_version`                | PostHog / Sentry |


Application and infrastructure errors should additionally be captured by Sentry.

---



# 6. Success Metrics



## Primary Metric

**Successful order fulfillment rate**

Percentage of submitted shop orders that reach `COMPLETED` without requiring manual intervention outside the MeetCtrlP workflow.

## Secondary Metrics

- Median time from order submission to shop acceptance.
- Median time from acceptance to print start.
- Median print completion time.
- Percentage of orders successfully auto routed to a compatible printer.
- Print retry rate.
- Printer failure rate.
- Orders processed per shop per day.
- Cash payment completion rate.
- Desktop connection uptime.
- Printer availability.
- Percentage of orders completed without operator intervention.
- Average operator handling time per order.



## Guardrails

Monitor:

- Print failure rate.
- Document retrieval failure rate.
- Duplicate print job rate.
- Incorrect print configuration incidents.
- Payment state mismatch.
- Order state mismatch.
- Realtime connection failure.
- Printer discovery failure.
- Desktop crash rate.
- Local print agent crash rate.
- Security incidents.
- Document privacy incidents.
- Support tickets related to printing.

No target threshold should be hardcoded into this PRD until pilot baseline data is available.

---



# 7. Non-Functional Requirements & Dependencies



## Performance

- Desktop UI must remain responsive during printing, document retrieval, printer discovery and synchronization.
- Long running operations must not block the WPF UI thread.
- Realtime events should be processed asynchronously.
- Print execution must be delegated to the local print subsystem.
- Order actions should provide immediate UI feedback while authoritative state is synchronized with the backend.
- Printer discovery must run asynchronously.
- Document preview/rendering must not freeze the application.

---



## Reliability

The application must support:

- Automatic reconnect.
- State reconciliation.
- Print job recovery.
- Application restart recovery.
- Printer reconnection.
- Duplicate event handling.
- Duplicate action protection.
- Backend authoritative state.
- Local queue recovery where required.

Realtime events are triggers, not the source of truth.

---



## Security & Privacy

Day 0 requirements:

- Encryption in transit.
- Encryption at rest where applicable.
- Secure authentication.
- Secure token storage.
- Shop level authorization.
- Device authorization.
- Secure document access.
- Time limited/signed document URLs.
- Temporary local document storage.
- Automatic local cleanup.
- No document contents in logs.
- No document contents in analytics.
- Malware/file scanning.
- Upload limits enforced by backend.
- Limited document retention.
- Auditability.
- Restricted local IPC where applicable.
- No payment secrets in the desktop application.
- No backend secrets or Cashfree merchant secrets in the desktop application.

Sensitive customer documents may contain IDs, certificates, resumes and other private information and therefore require privacy by design.

---



## Desktop Technology

- **Desktop:** C# / WPF.
- **Local Print Agent:** Native Windows/local service layer.
- **Cloud:** MeetCtrlP backend.
- **Authentication:** Firebase.
- **Realtime:** WebSockets / SSE.
- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM.
- **Queue:** Redis + BullMQ.
- **File Storage:** S3 compatible storage.
- **Payments:** Cashfree.
- **Validation:** Zod where applicable across TypeScript services.
- **Monitoring:** Sentry + OpenTelemetry.
- **Analytics:** PostHog.

---



## Backend Dependencies

The desktop application depends on backend services for:

- Authentication.
- Shop authorization.
- Device registration.
- Order state.
- Document authorization.
- Payment state.
- Pricing configuration.
- Shop capability configuration.
- Realtime events.
- Print job creation.
- Print job state.
- Cash payment state.
- Order completion.
- Notifications.
- Audit events.

---



## Local Print Dependencies

The local print subsystem must provide:

- Printer discovery.
- Printer identification.
- Capability detection.
- Printer routing.
- Print job creation.
- Print execution.
- Status monitoring.
- Retry handling.
- Printer error detection where supported.
- Multiple printer management.
- Safe local document handling.
- Cleanup of temporary files.

Printers must not be exposed directly to the public internet.

---



## Application Architecture

```text
WPF Desktop Application
        │
        ├── UI Layer
        ├── Application State
        ├── API Client
        ├── Realtime Client
        ├── Local Cache
        └── Print Agent Client
                    │
                    ▼
             Local Print Agent
                    │
                    ▼
              Windows Printing
                    │
                    ▼
                 Printers
```

---



# 8. Open Questions & Decisions


| Question                                                            | Decision / Answer                                                                | Owner                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| How many primary screens should the desktop MVP have?               | 6 primary screens                                                                | Product                 |
| Should Order Details be a primary navigation item?                  | Yes, but contextual rather than permanent navigation                             | Product / Design        |
| Should Print Preparation be a separate screen?                      | No. It is part of Order Details                                                  | Product / Design        |
| Should Print Job Details be a separate screen?                      | No. Use a drawer/modal inside Print Queue                                        | Product / Design        |
| Should Completed Orders have a separate screen?                     | No. Use Orders tabs/filters                                                      | Product / Design        |
| Should Printer Management have multiple screens?                    | No. Use Printers plus contextual management drawer                               | Product / Design        |
| Is printer integration part of MVP?                                 | Yes. It is a Day 0 MVP requirement                                               | Product / Engineering   |
| Is a local print agent required?                                    | Yes. It is the local execution layer between desktop/cloud and physical printers | Engineering             |
| Should printers be directly exposed to the internet?                | No                                                                               | Engineering / Security  |
| Where is authoritative order state maintained?                      | Backend                                                                          | Engineering             |
| Are realtime events authoritative?                                  | No. They are synchronization triggers; backend state remains authoritative       | Engineering             |
| Can desktop contain payment secrets?                                | No                                                                               | Engineering / Security  |
| Can business pricing be hardcoded?                                  | No. Pricing is configuration driven                                              | Engineering             |
| Can document contents be logged?                                    | No                                                                               | Engineering / Security  |
| Can document contents be included in analytics?                     | No                                                                               | Engineering / Analytics |
| Does the MVP support multiple documents per order?                  | Yes                                                                              | Product / Engineering   |
| Does the MVP support automatic printer routing?                     | Yes                                                                              | Product / Engineering   |
| Does the MVP support printer retry?                                 | Yes                                                                              | Product / Engineering   |
| Does the MVP support cash payment?                                  | Yes                                                                              | Product / Payments      |
| Does the MVP support online payment state synchronization?          | Yes                                                                              | Product / Payments      |
| Does the MVP include advanced print options?                        | No. Deferred                                                                     | Product                 |
| Does the MVP include duplex printing?                               | No. Deferred                                                                     | Product                 |
| Does the MVP include binding/stapling?                              | No. Deferred                                                                     | Product                 |
| Does the MVP include pages per sheet/orientation/scaling/collation? | No. Deferred                                                                     | Product                 |
| Should the application support recovery after restart?              | Yes                                                                              | Engineering             |
| Should multiple shop devices be supported safely?                   | Yes, with concurrency controls                                                   | Engineering             |
| Should the desktop UI block during printing?                        | No                                                                               | Engineering             |
| Should printer discovery happen locally?                            | Yes                                                                              | Engineering             |
| Should local temporary files be cleaned automatically?              | Yes                                                                              | Engineering / Security  |
| Should the app expose diagnostics?                                  | Yes                                                                              | Product / Engineering   |
| Should the app report version and agent version?                    | Yes                                                                              | Product / Engineering   |


---



# MVP Feature Coverage Checklist

The following checklist is the final completeness control for the six screen architecture.

### Shop & Account

- [x] Shop authentication
- [x] Device registration
- [x] Shop profile
- [x] Account management
- [x] Sign out
- [x] Device status
- [x] Application version
- [x] Print agent version



### Shop Configuration

- [x] Pricing configuration
- [x] B&W pricing
- [x] Color pricing
- [x] Paper size configuration
- [x] Service configuration
- [x] Capability configuration



### Orders

- [x] New orders
- [x] Active orders
- [x] Ready orders
- [x] Completed orders
- [x] Order history
- [x] Search
- [x] Filters
- [x] Payment status
- [x] Order status
- [x] Order details
- [x] Order acceptance
- [x] Order rejection



### Documents

- [x] Multiple documents
- [x] Filename
- [x] File size
- [x] Page count
- [x] Preview
- [x] Secure document retrieval
- [x] Document validation
- [x] Rendering validation
- [x] Temporary local storage
- [x] Cleanup
- [x] Privacy controls



### Print Configuration

- [x] B&W
- [x] Color
- [x] Copies
- [x] Paper size
- [x] Page selection
- [x] Print readiness validation



### Printer Integration

- [x] Printer discovery
- [x] Printer connection
- [x] Printer status
- [x] Printer capabilities
- [x] B&W capability
- [x] Color capability
- [x] Paper size capability
- [x] Default printer
- [x] Printer routing
- [x] Test print
- [x] Printer diagnostics
- [x] Multiple printer support
- [x] Local print agent



### Printing

- [x] Print queue
- [x] Queue management
- [x] Automatic print execution
- [x] Print progress
- [x] Print completion
- [x] Print failure
- [x] Retry
- [x] Printer reassignment
- [x] Recovery
- [x] Print job history



### Payments

- [x] Online payment state
- [x] Cash payment
- [x] Cash pending
- [x] Cash collection
- [x] Payment verification
- [x] Payment status
- [x] Payment state synchronization



### Fulfillment

- [x] Ready for pickup
- [x] Order completion
- [x] Completed history
- [x] Order state synchronization



### Realtime & Reliability

- [x] Realtime order events
- [x] Payment events
- [x] Print events
- [x] Notifications
- [x] Reconnect
- [x] State reconciliation
- [x] Offline handling
- [x] Restart recovery
- [x] Idempotency
- [x] Concurrency protection



### Security & Privacy

- [x] Secure authentication
- [x] Shop authorization
- [x] Device authorization
- [x] Secure document access
- [x] Temporary document storage
- [x] Cleanup
- [x] Encryption
- [x] Signed/time limited URLs
- [x] Malware/file scanning
- [x] No document content in logs
- [x] No document content in analytics
- [x] Auditability
- [x] Secure token storage
- [x] No payment secrets in desktop



### Dashboard

- [x] New order count
- [x] Active order count
- [x] Printing count
- [x] Ready count
- [x] Completed count
- [x] Revenue visibility
- [x] Cash pending
- [x] Printer health
- [x] Attention required
- [x] Recent orders
- [x] Operational notifications

---

