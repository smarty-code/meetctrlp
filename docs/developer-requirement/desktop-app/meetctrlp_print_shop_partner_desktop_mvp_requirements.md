# MeetCtrlP Print Shop Partner Desktop App

## MVP Screen Map, Functional Requirements, Dependencies, and Engineering Specification

**Document status:** MVP engineering specification\
**Audience:** Desktop, backend, platform, QA, DevOps engineers\
**Primary user:** Print Shop Partner\
**Platform:** Windows desktop application\
**Primary desktop technology:** C# + WPF\
**Product:** MeetCtrlP\
**Scope:** Print Shop Partner MVP, with printer integration as a Day 0
core capability

------------------------------------------------------------------------

# 1. Purpose

This document defines the product flow, screens, functionality,
technical dependencies, system behavior, and engineering requirements
for the MeetCtrlP Print Shop Partner desktop application.

The purpose is to give the engineering team a sufficiently precise
implementation contract before development begins.

The desktop application is not only an order dashboard. It is the local
execution layer that connects cloud print orders to physical printers
inside a print shop.

The central MVP workflow is:

``` text
Cloud Order
    ↓
Desktop App
    ↓
Validate Order
    ↓
Accept Order
    ↓
Create / Receive Print Job
    ↓
Local Print Agent
    ↓
Select / Route Printer
    ↓
Execute Print
    ↓
Receive Print Status
    ↓
Mark Order Ready
    ↓
Customer Pickup
    ↓
Complete Order
```

The desktop application must therefore be designed around both:

1.  Order management
2.  Reliable local print execution

------------------------------------------------------------------------

# 2. Product Principles

## 2.1 Printer integration is an MVP requirement

Printer integration is not a later phase feature.

The first production version must support the core workflow of receiving
a cloud order and executing the requested print job through a printer
connected to the shop computer.

## 2.2 The desktop application is the local execution layer

The cloud platform should manage orders, pricing, payment, files,
business state, and orchestration.

The Windows application should handle local machine and printer
responsibilities.

``` text
Cloud
  ├── Authentication
  ├── Orders
  ├── Payments
  ├── Files
  ├── Pricing
  └── Business state
          ↓
Desktop App
  ├── Local session
  ├── Printer discovery
  ├── Printer capabilities
  ├── Print queue
  ├── Print execution
  ├── Local printer status
  └── Recovery / retry
          ↓
Physical Printer
```

## 2.3 Do not rely on the cloud to directly control a local printer

The preferred architecture is:

``` text
MeetCtrlP Cloud
       ↓
Secure realtime connection
       ↓
Windows Desktop App
       ↓
Local print subsystem
       ↓
Printer / Xerox machine
```

The printer should not need to expose itself directly to the public
internet.

## 2.4 Order state and print state are separate concepts

The system must not treat an order as completed merely because the print
command was submitted.

Example:

``` text
Order state:
SHOP_ACCEPTED

Print state:
PRINTING
```

Only after successful print completion and shop handover should the
order become completed.

## 2.5 No hardcoded business values

Do not hardcode:

-   Prices
-   Shop information
-   Printer names
-   Printer capabilities
-   Order IDs
-   Payment amounts
-   Status values in UI logic
-   API URLs
-   Feature flags
-   Timeouts where configuration is appropriate

Use typed constants, configuration, server supplied data, and
enums/value objects where appropriate.

------------------------------------------------------------------------

# 3. MVP Print User Contract

The desktop application must support the print options exposed by the
Print User MVP.

The current Print User MVP supports:

-   Multiple document upload
-   File validation
-   File preview
-   Page count
-   Black and white
-   Color
-   Copies
-   Paper size
-   Page selection
-   Dynamic pricing
-   Online payment
-   Cash payment
-   Order submission
-   Order tracking

The following are explicitly outside the current Print User MVP:

-   Double sided printing
-   Advanced layout options
-   Pages per sheet
-   Orientation controls
-   Scaling controls
-   Collation
-   Binding
-   Stapling
-   Special instructions

The desktop application must not assume these excluded features are
available for MVP orders.

------------------------------------------------------------------------

# 4. Desktop Application Screen Map

The MVP desktop application is intentionally reduced to **six primary
user-facing screens**. This is a navigation simplification, not a
functional reduction. All previously identified MVP capabilities remain
available, but related capabilities are grouped into the screen where
an operator naturally needs them.

Authentication and first-time device/shop setup are onboarding flows,
not permanent primary navigation destinations. Notifications, print job
details, printer configuration, payment details, diagnostics, and error
states are contextual panels, drawers, dialogs, or states within the six
primary screens.

| # | Primary screen | Core responsibility |
|---|---|---|
| 1 | Dashboard | Operational overview, attention items, shop and printer health |
| 2 | Orders | All order management, including new, active, ready, completed, and history |
| 3 | Order Details | Complete customer request, documents, payment, validation, and print preparation |
| 4 | Print Queue | Local print execution, queue monitoring, failures, retries, and job control |
| 5 | Printers | Printer discovery, registration, capability mapping, routing, status, and diagnostics |
| 6 | Shop & Settings | Shop profile, pricing, services, device, notifications, account, application settings, and diagnostics |

### Onboarding flows outside the primary navigation

The following flows still exist and are required for MVP, but they are
not counted as permanent screens:

- Authentication / sign in
- Session restoration
- Initial shop connection
- Device registration / activation
- Initial printer discovery and setup

### Contextual UI that must not become additional primary screens

- Order acceptance / rejection: Order Details
- Print preparation / validation: Order Details
- Payment details: Order Details
- Print job details: Print Queue drawer/panel
- Completed order history: Orders tab/filter
- Printer management details: Printers drawer/panel
- Notifications: Dashboard attention area and notification panel, with additional settings in Shop & Settings
- Error and recovery states: contextual to the affected screen
- Diagnostics: Printers or Shop & Settings depending on the diagnostic target

The engineering implementation may use WPF pages, navigation views,
drawers, dialogs, or nested views. The six-screen model is a product
navigation contract, not a restriction on the internal component
architecture.

------------------------------------------------------------------------

# 5. Screen 1: Dashboard

## Purpose

The Dashboard is the operational home screen. It gives the shop operator
an immediate view of work requiring attention, current printing activity,
financial status, and printer health.

## Primary sections

### Order overview

- New orders
- Pending / active orders
- Printing orders
- Ready for pickup
- Completed today
- Orders requiring attention

### Payment overview

- Paid orders
- Cash pending
- Today's revenue
- Payment issues where applicable

### Printer overview

- Total connected printers
- Online / connected
- Busy / printing
- Offline
- Error / attention required
- Realtime printer status where supported

### Attention required

Examples include:

- New order waiting for shop action
- Payment pending
- Printer offline
- Printer error
- Print failed
- Realtime connection lost
- Device or print-agent problem

### Recent activity / recent orders

- Recent order ID
- Time
- Document count
- Status
- Amount
- Payment status
- Shortcut to Order Details

### Notifications

The Dashboard may expose a notification panel or attention feed. It
must not require a separate primary Notifications screen.

## Actions

- Open Orders
- Open Order Details
- Open Print Queue
- Open Printers
- Open relevant settings/diagnostics
- Dismiss or acknowledge supported attention items

## Requirements

1. Dashboard data must come from backend and local printer state, as
   appropriate.
2. Do not hardcode counts, prices, shop information, printer names, or
   status values.
3. Dashboard should update through realtime events where applicable.
4. A disconnected realtime connection must be visible and recoverable.
5. The dashboard must remain responsive while printing or printer
   discovery is running.
6. Dashboard metrics must respect the authenticated shop and device
   authorization context.

------------------------------------------------------------------------

# 6. Screen 2: Orders

## Purpose

Orders is the single order-management destination. It replaces separate
New Orders, Active Orders, Ready Orders, and Completed / History screens.

The operator should be able to find any order and move into Order Details
without changing primary navigation.

## Tabs / views

- All
- New
- Active
- Ready
- Completed

The exact presentation may be tabs, segmented controls, or server-backed
filters. It must not create separate primary navigation destinations.

## Filters and search

- Search by order ID
- Search by document filename where supported
- Date filter
- Payment status filter
- Order status filter
- Print status filter where applicable

## Order row / card

Each order should expose, as appropriate:

- Order ID
- Created time
- Document count
- Total pages
- Copies / print volume summary
- Amount
- Payment status
- Order status
- Print status
- Attention / warning state

## Actions

### New order

- Open Order Details
- Accept
- Reject

### Active order

- Open Order Details
- View printing / queue status

### Ready order

- Open Order Details
- Confirm customer pickup / complete order when permitted

### Completed order

- View order
- View relevant payment and print history

## Requirements

1. New orders must arrive through realtime events or recover through
   synchronization after reconnect.
2. The list must support loading, empty, error, and offline/reconnecting
   states.
3. Accept, reject, pickup/ready, and completion operations must be
   idempotent.
4. Two desktop devices must not both successfully perform a conflicting
   state transition.
5. The backend is authoritative for order state.
6. The desktop must never display an operation as successful until the
   authoritative backend result is known.
7. Completed history must be searchable and filterable according to MVP
   requirements.

------------------------------------------------------------------------

# 7. Screen 3: Order Details

## Purpose

Order Details is the central verification and preparation point between
the customer's request and physical printing.

It combines the former Order Details, Print Preparation / Validation,
and payment-detail responsibilities without removing any functionality.

## Order information

- Order ID
- Created time
- Customer-facing order reference where applicable
- Order status
- Payment status
- Total amount
- Relevant timestamps

## Document list

For every document:

- Filename
- Page count
- File size where available
- Preview
- Requested color mode
- Copies
- Paper size
- Selected page range

The desktop must not introduce MVP options that the Print User did not
request or that are outside the current MVP contract.

## Payment information

### Online payment

- Paid / payment state
- Relevant payment reference where permitted

### Cash payment

- Pay at shop / cash pending state
- Cash collected state
- Action to mark cash as collected when authorized

Payment state must come from the backend and must not be inferred from
the desktop UI.

## Order actions

Depending on authoritative order state:

- Accept order
- Reject order
- Start print preparation
- Start printing
- View current print status
- Mark ready for pickup when the required print conditions are met
- Mark customer pickup / complete order when permitted
- Retry an eligible operation

## Print readiness section

The print preparation workflow is a section within Order Details.

### Validation checklist

The application must validate:

- Order exists
- Order belongs to the authorized shop
- Order is in a printable state
- Documents are available
- Files are readable
- File rendering succeeds
- Requested printer capability exists
- Color requirement is supported
- Paper size is supported
- Page range is valid
- Copy count is valid
- Print configuration is internally consistent
- A compatible printer is available

### Ready state

``` text
Ready to print
Printer: <resolved printer>
[Start Printing]
```

### Not ready state

``` text
Cannot print this order
Reason: <authoritative validation reason>
[Retry Validation] [Select Printer]
```

## Printer selection / routing

The operator may select a compatible printer from the available printer
set when manual selection is supported. Automatic routing should be the
default where a valid routing rule exists.

The printer selection must respect:

- Requested color mode
- Requested paper size
- Shop printer capability mapping
- Current printer availability
- Configured routing/default-printer rules

## Requirements

1. Document metadata comes from the backend.
2. Document access uses authorized, time-limited mechanisms where
   possible.
3. The application must not expose another shop's documents.
4. Document access/download must be auditable.
5. Temporary files must have a defined cleanup policy.
6. Validation must complete before physical print execution.
7. Validation failure must not create a false print-completed state.
8. Accept/reject/start-print/ready/complete operations must be
   idempotent.
9. The backend remains authoritative for order state and payment state.

------------------------------------------------------------------------

# 8. Screen 4: Print Queue

## Purpose

Print Queue is the physical print-execution workspace. It answers a
different question from Orders:

> Orders: What did the customer request?
>
> Print Queue: What is physically happening on the printers?

## Queue views

- All
- Queued
- Preparing / validating
- Printing
- Paused where supported
- Failed
- Completed
- Cancelled

## Queue item

Each print job should show:

- Print job ID
- Parent order ID
- Document
- Printer
- Copies
- Pages / page range
- Color mode
- Paper size
- Created / queued time
- Started time where available
- Current state
- Progress where reliably available
- Error information where failed
- Retry count / attempt information where relevant

## Actions

Depending on authoritative job state and printer support:

- Pause
- Resume
- Retry
- Cancel
- Change printer where safe
- Open job details
- Open parent order

## Print Job Details drawer / panel

Print Job Details is not a separate primary screen.

It must provide:

- Print job ID
- Parent order ID
- Document
- Printer
- Print configuration
- Current state
- Started time
- Progress where available
- Error information
- Retry count
- Attempt history where applicable
- Retry action
- Change-printer action where safe

## Print execution rules

1. Each print job must have a unique ID.
2. A print job may have multiple execution attempts.
3. A retry must preserve the parent print job identity while creating a
   distinct attempt record.
4. Duplicate physical execution must be prevented through idempotency,
   local state, and backend coordination.
5. Queue state must survive normal application restart sufficiently to
   recover safely.
6. Important print transitions must be synchronized with the backend.
7. Printer and Windows APIs must be treated as potentially incomplete
   sources of page-level progress.
8. If reliable page progress is unavailable, display a generic
   `PRINTING` state rather than inventing progress.

------------------------------------------------------------------------

# 9. Screen 5: Printers

## Purpose

Printers is a dedicated MVP screen because printer integration is a core
MeetCtrlP differentiator and a Day 0 requirement.

It provides the operational control surface for the local print agent
and Windows printing subsystem.

## Printer list

Each printer should show, where available:

- MeetCtrlP printer identifier
- Local Windows printer identifier/name
- Display name
- Connection status
- Current printer status
- Supported color modes
- Supported paper sizes
- Default / primary designation
- Current print job
- Last seen / health information

## Printer states

The exact internal enum should be centralized, but the UI must support
at least:

``` text
CONNECTED / ONLINE
BUSY / PRINTING
OFFLINE
ERROR
UNKNOWN
```

## Printer actions

- Discover printers
- Refresh / rescan
- Register / connect
- Disconnect
- Remove mapping
- Set primary/default printer
- Configure capabilities
- View status
- Test print
- Open diagnostics

## Printer management drawer / panel

Detailed printer configuration belongs inside the Printers screen.

It should support:

- Printer identity
- Connection information
- Supported B&W / Color capabilities
- Supported paper sizes
- Capability mapping override where required
- Default / primary designation
- Routing preferences
- Test print
- Disconnect/remove
- Diagnostics

## Discovery

Printer discovery must be performed locally through the Windows printing
subsystem and/or supported local printer protocols.

The implementation must not assume a specific printer manufacturer.

## Requirements

1. Printer discovery is local.
2. Printer identifiers must be stable where possible.
3. Printer display names must not be treated as globally unique.
4. Local printer mappings must be persisted securely.
5. Capabilities must be normalized into MeetCtrlP's domain model.
6. The backend should receive the printer/device representation needed
   for operational visibility.
7. Availability changes must be detected and propagated to the queue,
   dashboard, and backend where applicable.
8. Printer operations must not block the WPF UI thread.

------------------------------------------------------------------------

# 10. Screen 6: Shop & Settings

## Purpose

Shop & Settings combines low-frequency configuration areas that do not
need permanent primary navigation. It must retain all MVP shop,
pricing, device, account, notification, application, and diagnostic
capabilities from the earlier screen model.

## Navigation within the screen

The screen may use tabs or a secondary settings navigation such as:

- Shop
- Pricing
- Services / Capabilities
- Device
- Notifications
- Account
- Application Settings
- Diagnostics
- About / Version

## Shop profile

- Shop name
- Shop address/location
- Contact information where required
- Shop status / operational configuration where supported

Shop information must be backend-driven and must not be hardcoded.

## Pricing configuration

Pricing must support the pricing model exposed by the MVP, including
configuration for supported print combinations such as:

- B&W
- Color
- Supported paper sizes
- Per-page pricing
- Copy-related pricing rules where applicable

Actual values must be configuration data, not constants embedded in the
UI.

The backend remains authoritative for customer-facing price
calculation. Desktop configuration changes must be validated and
persisted through the backend.

## Services / capabilities

The shop must be able to configure the capabilities that it actually
supports, within the MVP scope.

Examples:

- B&W printing
- Color printing
- Supported paper sizes

Capabilities must remain consistent with the actual printer capability
mapping. The system must not advertise a capability that cannot be
fulfilled unless the configuration explicitly allows it and the backend
handles the resulting routing/validation behavior.

## Device

- Device name
- Device ID
- Shop association
- Connection state
- Desktop application version
- Local print-agent version
- Registration / activation state

## Notifications

Notifications are a panel/configuration area, not a separate primary
screen.

Capabilities include:

- View unread operational notifications
- New-order notifications
- Print-failure notifications
- Printer health notifications
- Payment-related notifications
- Connection/system notifications
- Read/acknowledge where supported
- Notification preference configuration where supported

## Account

- Authenticated user information
- Shop membership context
- Sign out
- Session/account status

## Application settings

- Application behavior settings that are part of MVP
- Startup/background behavior where configurable
- Notification preferences
- Realtime/reconnect preferences where appropriate
- Safe local settings

Business-critical state must not be stored only as local application
settings.

## Diagnostics

- Backend connectivity
- Realtime connection
- Device registration state
- Print-agent status
- Printer subsystem status
- Last synchronization
- Application version
- Print-agent version
- Diagnostic information/log export where supported

Diagnostics must never include document contents, authentication
secrets, payment secrets, or other sensitive values.

## About / version

- Desktop application version
- Print-agent version
- Relevant component versions
- Support information

------------------------------------------------------------------------

# 11. Cross-Screen Error and Recovery Behavior

Error and recovery states are not a seventh screen. They must be
implemented contextually across the six primary screens and onboarding
flows.

## Authentication errors

- Invalid credentials
- Session expired
- Unauthorized shop access
- Authentication service unavailable

## Network / realtime errors

- Disconnected
- Reconnecting
- Reconnected
- Backend unavailable
- Realtime unavailable
- Synchronization required

The application must clearly distinguish stale/offline state from an
authoritative successful state.

## Order errors

- Order no longer available
- Order already accepted by another device
- Order state changed
- Payment state changed
- Document unavailable
- Document access expired

## Print errors

- File download failure
- File rendering failure
- Unsupported configuration
- No compatible printer
- Printer unavailable
- Printer offline
- Windows spooler failure
- Driver failure
- Print job failure
- Duplicate execution protection triggered

## Recovery actions

Depending on the error:

- Retry
- Reconnect
- Refresh authoritative state
- Rescan printers
- Select another printer
- Retry print job
- Re-authenticate
- Open diagnostics
- Contact support where required

No error state should silently discard an order or print job.

------------------------------------------------------------------------

# 12. Feature-to-Screen Coverage Matrix

This matrix is the MVP coverage check. Every previously identified
Print Shop Partner MVP capability must map to one of the six screens or
an onboarding/contextual flow.

| MVP capability | Primary location |
|---|---|
| Shop login/authentication | Onboarding flow |
| Session restoration | Onboarding / application shell |
| Shop authorization | Onboarding / application shell |
| Device registration | Onboarding + Shop & Settings |
| Device status | Dashboard + Shop & Settings |
| Shop profile | Shop & Settings |
| Pricing configuration | Shop & Settings |
| Service/capability configuration | Shop & Settings |
| New orders | Orders + Dashboard |
| Active orders | Orders |
| Ready orders | Orders + Dashboard |
| Completed orders | Orders |
| Order history | Orders |
| Order search | Orders |
| Order filters | Orders |
| Order details | Order Details |
| Document list | Order Details |
| Document preview | Order Details |
| Document metadata | Order Details |
| B&W configuration display | Order Details + Print Queue |
| Color configuration display | Order Details + Print Queue |
| Copies configuration display | Order Details + Print Queue |
| Paper size configuration display | Order Details + Print Queue |
| Page selection display | Order Details + Print Queue |
| Payment status | Dashboard + Orders + Order Details |
| Online payment state | Order Details |
| Cash pending state | Dashboard + Orders + Order Details |
| Cash collection / mark paid | Order Details |
| Accept order | Orders / Order Details |
| Reject order | Orders / Order Details |
| Print readiness validation | Order Details |
| Automatic printer routing | Order Details + Printers |
| Manual printer selection | Order Details |
| Print queue | Print Queue |
| Print execution | Print Queue + local print agent |
| Print status | Print Queue + Dashboard + Order Details |
| Print failure handling | Print Queue |
| Retry print | Print Queue |
| Change printer | Print Queue / Order Details where safe |
| Pause/resume where supported | Print Queue |
| Cancel where supported | Print Queue |
| Print job details | Print Queue drawer |
| Print attempts / audit trail | Print Queue drawer + backend history |
| Printer discovery | Printers |
| Printer registration | Printers |
| Printer connection status | Printers + Dashboard |
| Printer capability mapping | Printers |
| Printer routing preferences | Printers |
| Default printer | Printers |
| Test print | Printers |
| Printer diagnostics | Printers + Shop & Settings |
| Local print agent status | Printers + Shop & Settings |
| Realtime order events | Application shell + Dashboard / Orders |
| Realtime print events | Print Queue + Dashboard |
| Notifications | Dashboard + Shop & Settings |
| Error handling | Contextual across all screens |
| Recovery / reconnect | Application shell + contextual screens |
| Diagnostics | Shop & Settings + Printers |
| Account | Shop & Settings |
| Sign out | Shop & Settings / application shell |
| Application version | Shop & Settings |
| Print-agent version | Shop & Settings |
| Operational dashboard | Dashboard |

The matrix must be maintained when additional MVP features are added.
A feature is not considered implemented merely because an API exists;
the operator must have the required workflow and state visibility in the
desktop application.

------------------------------------------------------------------------

# 13. Screen Navigation and Interaction Rules

The primary navigation should remain stable:

``` text
Dashboard
Orders
Print Queue
Printers
Shop & Settings
```

Order Details is a contextual destination opened from Orders, Dashboard,
notifications, or relevant queue actions.

Recommended interaction model:

``` text
Dashboard
   ├── Orders
   │      └── Order Details
   │              └── Start Printing
   │                      └── Print Queue
   │                              └── Job Details drawer
   │
   ├── Print Queue
   │      └── Job Details drawer
   │
   ├── Printers
   │      └── Printer Details drawer
   │
   └── Shop & Settings
          ├── Shop
          ├── Pricing
          ├── Services
          ├── Device
          ├── Notifications
          ├── Account
          └── Diagnostics
```

The goal is to minimize navigation complexity without hiding operational
capabilities.

------------------------------------------------------------------------

# 19. Core Order State Machine

The backend must own the authoritative order state.

Recommended MVP states:

``` text
CREATED
DOCUMENTS_UPLOADED
CONFIGURED
PAYMENT_PENDING
PAID
CASH_PENDING
SUBMITTED
SHOP_ACCEPTED
PRINTING
READY
COMPLETED
```

Failure/cancellation states:

``` text
PAYMENT_FAILED
SHOP_REJECTED
PRINT_FAILED
CANCELLED
REFUND_PENDING
```

The exact state transition contract must be defined in the API.

The desktop must not directly mutate arbitrary state.

For example, it must not send:

``` text
status = COMPLETED
```

without going through an authorized backend transition.

------------------------------------------------------------------------

# 20. Print Job State Machine

Print execution needs a separate state machine.

``` text
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

Failure paths:

``` text
VALIDATION_FAILED
PRINTER_UNAVAILABLE
PRINT_FAILED
CANCELLED
```

Retry:

``` text
PRINT_FAILED
↓
RETRY_REQUESTED
↓
QUEUED
↓
PRINTING
```

Every execution attempt should have its own identifier.

------------------------------------------------------------------------

# 21. Order vs Print Job Relationship

One order may contain multiple documents.

Therefore the data model should not assume:

``` text
Order = Printer Job
```

Instead:

``` text
Order
 ├── Order Item / Document 1
 │       └── Print Job
 ├── Order Item / Document 2
 │       └── Print Job
 └── Order Item / Document 3
         └── Print Job
```

This is important for failure recovery.

For example:

-   Document 1 prints successfully.
-   Document 2 fails.
-   Document 3 has not started.

The system must preserve this partial execution state rather than
marking the entire order as failed without context.

------------------------------------------------------------------------

# 22. Recommended Desktop Architecture

Use a layered WPF architecture.

``` text
Presentation
    ↓
Application / ViewModels
    ↓
Domain
    ↓
Infrastructure
    ├── API Client
    ├── Realtime Client
    ├── File Service
    ├── Print Service
    ├── Windows Printer Integration
    ├── Local Storage
    └── Logging / Telemetry
```

Recommended conceptual layers:

## Presentation

WPF + XAML

Responsibilities:

-   Views
-   Controls
-   Navigation
-   Visual states

## Application

Responsibilities:

-   Use cases
-   Commands
-   ViewModels
-   Workflow orchestration

## Domain

Responsibilities:

-   Order models
-   Print job models
-   Printer capability models
-   State transitions
-   Business rules that belong locally

## Infrastructure

Responsibilities:

-   HTTP
-   WebSocket/SSE
-   Firebase integration
-   Windows printing
-   File handling
-   Local persistence
-   Sentry/OpenTelemetry

------------------------------------------------------------------------

# 23. Suggested C# Project Structure

``` text
apps/
  desktop/
    MeetCtrlP.Desktop/
      Views/
      ViewModels/
      Controls/
      Resources/
      Navigation/

    MeetCtrlP.Application/
      Orders/
      Printing/
      Printers/
      Payments/
      Notifications/
      Authentication/

    MeetCtrlP.Domain/
      Orders/
      PrintJobs/
      Printers/
      Payments/
      Shops/

    MeetCtrlP.Infrastructure/
      Api/
      Realtime/
      Printing/
      Windows/
      Storage/
      Firebase/
      Logging/
```

The exact solution structure can be adjusted by the engineering team,
but responsibilities should remain separated.

------------------------------------------------------------------------

# 24. Local Print Agent

The print execution component should be treated as a first-class
subsystem.

## Responsibilities

-   Discover printers
-   Read printer capabilities
-   Receive print jobs
-   Download required document securely
-   Validate local print parameters
-   Submit jobs to Windows printing
-   Monitor job state
-   Report status
-   Handle retry
-   Clean temporary files
-   Recover from application restart where possible

## Security

The print agent must not expose an unauthenticated local network API.

If local IPC is required, use a controlled mechanism such as:

-   Named pipes
-   Secure local IPC
-   Restricted localhost communication

The exact mechanism is an engineering decision.

------------------------------------------------------------------------

# 25. Windows Printing Integration

The application must integrate with the Windows printing subsystem
rather than assuming a particular printer vendor.

The implementation should investigate:

-   Installed Windows printers
-   Printer queues
-   Printer properties
-   Print ticket/configuration
-   Job submission
-   Job status
-   Cancellation
-   Driver limitations

The engineering team must explicitly document which printer capabilities
are reliably available through Windows APIs and which require
manufacturer-specific integration.

------------------------------------------------------------------------

# 26. Printer Routing

MVP should support basic printer selection.

Example routing requirements:

``` text
Requested:
A4 + Color

Available:
Printer A: A4 + B&W
Printer B: A4 + Color
Printer C: A3 + Color

Selected:
Printer B
```

Routing should be capability based, not name based.

A future routing engine can optimize for:

-   Printer availability
-   Queue length
-   Speed
-   Cost
-   Paper availability
-   Printer health

These advanced optimization rules are not required for MVP.

------------------------------------------------------------------------

# 27. Realtime Architecture

Use WebSockets or SSE for cloud-to-desktop events.

Important realtime events:

``` text
ORDER_CREATED
ORDER_UPDATED
PAYMENT_UPDATED
ORDER_CANCELLED
PRINT_COMMAND_CREATED
SHOP_NOTIFICATION
```

The desktop should acknowledge receipt where required.

Important principle:

**Realtime messages are triggers, not the ultimate source of truth.**

After receiving an event, the desktop should fetch authoritative data
when necessary.

------------------------------------------------------------------------

# 28. Offline and Reconnection Behavior

The desktop application will operate in real-world shops where internet
reliability may vary.

## If realtime connection is lost

Show:

``` text
Offline / Reconnecting
```

The application should:

-   Attempt reconnection
-   Preserve safe local state
-   Avoid accepting new cloud orders while authoritative backend state
    cannot be confirmed
-   Continue monitoring local printer state where possible
-   Synchronize after reconnection

## Important

Do not implement uncontrolled offline order acceptance in MVP unless the
backend contract explicitly supports it.

Payment and order state require server authority.

------------------------------------------------------------------------

# 29. File Handling

Documents are sensitive and should be treated as temporary execution
assets.

Recommended lifecycle:

``` text
Secure download
     ↓
Temporary local file
     ↓
Print
     ↓
Verify print job completion
     ↓
Secure cleanup
```

Requirements:

-   Use authorized temporary URLs or equivalent access mechanism.
-   Do not permanently store customer files unless required.
-   Use a dedicated temporary directory.
-   Remove temporary files after successful completion or defined
    failure cleanup.
-   Retry cleanup if immediate deletion fails.
-   Never log document contents.
-   Never log sensitive document URLs unnecessarily.

------------------------------------------------------------------------

# 30. Document Privacy Requirements

Privacy is a Day 0 requirement.

The desktop must enforce:

-   Shop-level authorization
-   User/session authorization
-   Secure document download
-   Limited document lifetime
-   Local temporary storage
-   Cleanup after use
-   No document contents in logs
-   No unnecessary document copies
-   Auditability of document access

The platform should define a server-side document retention policy
separately from local temporary-file cleanup.

------------------------------------------------------------------------

# 31. Payment Handling

The desktop is not the payment authority.

Payment authority remains the backend/payment gateway.

For online orders:

``` text
Customer
 ↓
Cashfree
 ↓
Backend verifies payment
 ↓
Order becomes PAID
 ↓
Desktop receives updated state
```

The desktop must never mark an online payment as successful solely
because the customer claims to have paid.

For cash orders:

``` text
Order = CASH_PENDING
 ↓
Shop prints according to configured workflow
 ↓
Customer pays
 ↓
Shop marks cash received
 ↓
Backend records payment event
```

------------------------------------------------------------------------

# 32. Cashfree Dependency

Cashfree is integrated at the backend/platform payment layer.

The desktop should consume payment status through the backend.

The desktop should not contain merchant secrets.

Never put:

-   Cashfree secret keys
-   Server credentials
-   Backend signing secrets

inside the desktop client.

------------------------------------------------------------------------

# 33. Authentication Dependency

Firebase Authentication is the authentication provider.

The backend must still authorize:

-   User
-   Shop
-   Device
-   Role
-   Requested resource

Firebase authentication alone should not be treated as authorization.

Recommended conceptual flow:

``` text
Firebase login
      ↓
Firebase token
      ↓
Backend validation
      ↓
Shop membership / role
      ↓
Desktop session
```

------------------------------------------------------------------------

# 34. API Requirements

Backend can initially use NestJS.

NestJS is preferable for this architecture because the platform has:

-   Multiple domains
-   Payment integration
-   WebSockets
-   Queue processing
-   Authentication/authorization
-   File handling
-   Order state management
-   Printer orchestration

Suggested modules:

``` text
AuthModule
ShopModule
DeviceModule
OrderModule
DocumentModule
PrintJobModule
PrinterModule
PaymentModule
SubscriptionModule
NotificationModule
RealtimeModule
```

------------------------------------------------------------------------

# 35. Database

PostgreSQL is the system of record.

Drizzle ORM is the database access layer.

Core entities:

``` text
users
shops
shop_members
devices
printers
printer_capabilities
shop_pricing
orders
order_items
documents
print_configurations
print_jobs
print_attempts
payments
settlements
subscriptions
notifications
audit_logs
```

The exact schema will be defined separately.

------------------------------------------------------------------------

# 36. Queue

Redis + BullMQ should handle asynchronous workloads such as:

-   Document processing
-   File preparation
-   Print job orchestration
-   Notifications
-   Cleanup
-   Retry processing
-   Background reconciliation

The desktop should not be directly coupled to BullMQ.

The backend owns queue management.

------------------------------------------------------------------------

# 37. File Storage

Use S3-compatible object storage.

Documents should be stored separately from PostgreSQL.

PostgreSQL stores metadata.

Object storage stores document content.

``` text
PostgreSQL
    └── document metadata

S3
    └── document object
```

Use generated object keys rather than user-controlled filenames as
storage identifiers.

------------------------------------------------------------------------

# 38. Validation

Use Zod for shared validation where appropriate.

The system should validate at multiple boundaries:

``` text
User Web
   ↓
API
   ↓
Database
   ↓
Desktop
   ↓
Local Printer
```

Never rely solely on frontend validation.

------------------------------------------------------------------------

# 39. Monorepo

Use:

-   pnpm
-   Turborepo
-   TypeScript for web/backend/shared packages
-   C# solution for desktop

Suggested conceptual structure:

``` text
apps/
  web/
  api/
  admin/

packages/
  shared-types/
  validation/
  api-client/
  config/

apps/
  desktop/
```

The desktop remains C#/WPF and should consume the backend API contract
rather than attempting to execute TypeScript application code.

If API schemas are generated, the C# client can consume an OpenAPI
generated client or an explicitly maintained contract.

------------------------------------------------------------------------

# 40. Realtime Contract

Realtime events should contain enough information to identify the event
but should not become a second database.

Example:

``` json
{
  "event": "ORDER_CREATED",
  "eventId": "evt_xxx",
  "shopId": "shop_xxx",
  "orderId": "order_xxx",
  "timestamp": "..."
}
```

The desktop can then fetch the current order from the API.

This reduces stale-event problems.

------------------------------------------------------------------------

# 41. Idempotency

Idempotency is mandatory for critical actions.

At minimum:

-   Accept order
-   Reject order
-   Create print job
-   Start print attempt
-   Retry print
-   Mark ready
-   Mark cash paid
-   Complete order

The backend must prevent duplicate state transitions.

Example:

If the desktop sends an accept request twice because the network timed
out, the backend should not create two acceptance operations.

------------------------------------------------------------------------

# 42. Concurrency

Multiple desktop installations can belong to one shop.

Therefore:

``` text
Computer A
Computer B
```

may see the same order.

The backend must prevent both from claiming the order simultaneously.

Use server-side transactional state transitions or equivalent
concurrency control.

------------------------------------------------------------------------

# 43. Observability

Use:

-   Sentry
-   OpenTelemetry

Track:

### Application errors

-   Desktop crashes
-   API errors
-   Printer integration failures

### Business events

-   Order accepted
-   Print started
-   Print completed
-   Print failed
-   Retry
-   Order completed

### Performance

-   Order-to-print latency
-   File download duration
-   Print preparation duration
-   Printer execution duration
-   Realtime connection uptime

Do not send document contents or sensitive personal data to telemetry.

------------------------------------------------------------------------

# 44. Logging

Logs must be structured.

Example:

``` text
event=print_job_started
order_id=...
print_job_id=...
printer_id=...
shop_id=...
```

Avoid:

``` text
document_content=...
customer_document=...
payment_secret=...
firebase_token=...
```

Sensitive credentials and tokens must never be logged.

------------------------------------------------------------------------

# 45. Security Requirements

The desktop application must:

-   Use HTTPS/TLS
-   Validate backend certificates through normal OS/network security
-   Store tokens securely
-   Avoid secrets embedded in binaries
-   Restrict local IPC
-   Validate downloaded files
-   Limit temporary file access
-   Clean temporary files
-   Enforce authorization
-   Use signed/authorized file URLs
-   Avoid sensitive logging
-   Support application updates securely

------------------------------------------------------------------------

# 46. Auto Start and Background Operation

For a real print shop, the application should be able to run
continuously.

MVP should support:

-   Start with Windows
-   Minimize to tray
-   Continue print monitoring while the main window is closed
-   Reconnect automatically
-   Notify the user about important failures

The engineering team should separate the UI lifecycle from the print
execution lifecycle so closing the window does not accidentally
terminate active print processing.

------------------------------------------------------------------------

# 47. Application Update Strategy

The desktop app will need a controlled update mechanism.

Requirements:

-   Version reporting
-   Update availability detection
-   Secure package verification
-   Controlled installation
-   Rollback/recovery strategy where practical

Printer integration is sensitive to client version compatibility, so the
backend should know the installed desktop/agent version.

------------------------------------------------------------------------

# 48. Performance Requirements

The desktop application should remain responsive while:

-   Downloading files
-   Rendering documents
-   Printing
-   Monitoring printers
-   Receiving realtime events
-   Synchronizing order data

No blocking printer or network operation should run on the WPF UI
thread.

Use asynchronous operations appropriately.

------------------------------------------------------------------------

# 49. UX Requirements

The application is primarily for shop operators, so optimize for speed.

Important principles:

-   New order should be visible immediately.
-   Payment status should be obvious.
-   Print status should be obvious.
-   Printer errors should be actionable.
-   Avoid unnecessary confirmation dialogs.
-   Use keyboard-friendly workflows where useful.
-   Use large enough targets for shop operators.
-   Do not overload the dashboard with analytics.
-   Keep printing as the primary workflow.

------------------------------------------------------------------------

# 50. MVP Acceptance Criteria

The MVP should be considered functionally complete when this end-to-end
scenario works reliably:

``` text
1. Shop computer starts.
2. MeetCtrlP desktop app starts.
3. User is authenticated.
4. Shop and device are recognized.
5. Printer is discovered and connected.
6. Customer uploads a document.
7. Customer selects B&W/color.
8. Customer selects copies.
9. Customer selects paper size.
10. Customer selects page range.
11. Customer submits order.
12. Payment is verified or cash payment is recorded as pending.
13. Desktop receives the new order in realtime.
14. Operator opens the order.
15. Desktop validates the order.
16. Operator accepts it.
17. System selects a compatible printer.
18. Desktop securely obtains the required document.
19. Print job is submitted to Windows printing.
20. Printer begins execution.
21. Desktop reports printing status.
22. Successful print execution is recorded.
23. Order becomes ready.
24. Customer is notified that the order is ready.
25. Operator hands over documents.
26. Cash payment is recorded if applicable.
27. Order becomes completed.
28. Temporary local document data is cleaned up.
29. Backend retains the required audit trail.
```

------------------------------------------------------------------------

# 51. Critical Failure Scenarios

Engineering and QA must explicitly test:

## Network failure before acceptance

The order must remain safely on the server.

## Network failure during printing

The local print job must not be duplicated accidentally after reconnect.

## Printer disconnects

Order should become an actionable printer failure, not completed.

## Printer job fails

Operator can retry safely.

## Application closes during printing

The system should recover or reconcile the print job state after
restart.

## Two computers accept the same order

Only one should succeed.

## Payment webhook arrives late

Desktop should eventually receive the correct authoritative payment
state.

## File download fails

Print must not start with a partial/corrupt file.

## Customer cancels

Desktop must respect the authoritative cancellation state.

------------------------------------------------------------------------

# 52. MVP vs Later Phase

## MVP

### Order

-   Realtime order reception
-   Order details
-   Accept/reject
-   Order state
-   Payment state

### Printing

-   Printer discovery
-   Printer registration
-   Capability mapping
-   Printer routing
-   Automatic print execution
-   Queue
-   Print status
-   Retry
-   Failure handling

### Shop

-   Pricing
-   Basic capability configuration
-   Shop configuration

### Operations

-   Dashboard
-   Notifications
-   Order history
-   Diagnostics

### Security

-   Firebase authentication
-   Authorization
-   Secure file access
-   Temporary local storage
-   Cleanup
-   Audit trail

------------------------------------------------------------------------

## Post MVP

-   Double sided printing
-   Advanced print layouts
-   Pages per sheet
-   Orientation
-   Scaling
-   Collation
-   Binding
-   Stapling
-   Advanced printer telemetry
-   Toner monitoring
-   Paper inventory
-   Intelligent printer optimization
-   Employee performance
-   CRM
-   Loyalty
-   Promotions
-   Accounting integrations
-   Marketplace
-   College network
-   B2B print API
-   Home delivery

------------------------------------------------------------------------

# 53. Technical Stack

  -----------------------------------------------------------------------
  Layer                               Technology
  ----------------------------------- -----------------------------------
  Monorepo                            pnpm + Turborepo

  Language                            TypeScript + C#

  User Web                            Next.js + React

  Desktop                             C# / WPF

  API                                 NestJS preferred for MVP

  Database                            PostgreSQL

  ORM                                 Drizzle ORM

  Realtime                            WebSockets / SSE

  Queue                               Redis + BullMQ

  File Storage                        S3-compatible storage

  Payments                            Cashfree

  Authentication                      Firebase Authentication

  Validation                          Zod

  UI                                  Tailwind CSS + shadcn/ui for
                                      web/admin; WPF-native component
                                      system for desktop

  Deployment                          Docker + managed cloud
                                      infrastructure

  Monitoring                          Sentry + OpenTelemetry
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 54. Important Technology Boundary

Tailwind CSS and shadcn/ui apply to the web-based applications.

The WPF desktop application should use an appropriate WPF
component/design system rather than attempting to force
Tailwind/shadcn/ui into the native desktop layer.

The desktop should maintain visual consistency with the product design
system through:

-   Typography
-   Spacing
-   Color tokens
-   Component behavior
-   Icons
-   Interaction patterns

but the implementation remains native WPF.

------------------------------------------------------------------------

# 55. Recommended Implementation Order

Engineering should not build screens in arbitrary order.

Recommended sequence:

## Phase 1: Foundation

1.  WPF application shell
2.  Authentication
3.  Device registration
4.  Shop association
5.  API client
6.  Realtime client
7.  Local secure storage
8.  Logging and telemetry

## Phase 2: Printer Foundation

9.  Windows printer discovery
10. Printer registration
11. Printer capability detection
12. Test print
13. Printer status monitoring
14. Local print service

## Phase 3: Orders

15. Dashboard
16. New orders
17. Order details
18. Order acceptance/rejection
19. Payment status

## Phase 4: Print Execution

20. Print preparation
21. Print job creation
22. Printer routing
23. Print queue
24. Print execution
25. Print status
26. Failure handling
27. Retry

## Phase 5: Completion

28. Ready for pickup
29. Cash payment confirmation
30. Order completion
31. History

## Phase 6: Configuration

32. Pricing
33. Shop capabilities
34. Printer preferences
35. Settings

## Phase 7: Hardening

36. Offline/reconnection
37. Recovery
38. Security hardening
39. Observability
40. QA automation
41. Installer/update process

------------------------------------------------------------------------

# 56. Engineering Dependencies

The desktop team cannot independently complete the application without
backend contracts.

The following dependencies must be finalized before or during
implementation.

## Backend API contract

Required:

-   Authentication
-   Shop
-   Device
-   Orders
-   Documents
-   Print jobs
-   Printers
-   Payments
-   Notifications

## Realtime contract

Required events:

-   New order
-   Order update
-   Payment update
-   Cancellation
-   Print command
-   System notification

## File contract

Required:

-   Secure document access
-   Temporary download URL
-   Document metadata
-   File expiration/retention behavior

## Payment contract

Required:

-   Payment status
-   Cash status
-   Refund status
-   Settlement status

## Printer contract

Required:

-   Printer identity
-   Capability model
-   Job creation
-   Job status
-   Failure states
-   Retry semantics

------------------------------------------------------------------------

# 57. Definition of Done for Each Feature

A feature is not complete when its UI works.

For desktop features, Definition of Done should include:

-   UI implementation
-   API integration
-   Loading state
-   Empty state
-   Error state
-   Offline/reconnect behavior where applicable
-   Authorization
-   Logging
-   Telemetry
-   Unit tests
-   Integration tests where applicable
-   No hardcoded business data
-   Accessibility/keyboard behavior where applicable
-   Security review for document/payment functionality

------------------------------------------------------------------------

# 58. Final Product Direction

The Shop Partner desktop application should be treated as:

> **MeetCtrlP's local print execution platform.**

The dashboard is important, but it is not the primary differentiator.

The differentiating workflow is:

``` text
Customer Order
      ↓
Cloud
      ↓
Shop Desktop
      ↓
Print Validation
      ↓
Printer Routing
      ↓
Windows Print System
      ↓
Physical Printer
      ↓
Print Status
      ↓
Customer Ready Notification
```

The MVP should therefore be engineered around **reliable print
execution, printer integration, order state integrity, secure document
handling, and recovery from real-world printer/network failures**.

The UI should make this workflow simple for the shop operator rather
than turning the application into a generic business dashboard.
