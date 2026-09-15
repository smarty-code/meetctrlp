# CtrlP.ai Print User Web App
## Screen 06: Order Tracking, Order Received State

**Project:** CtrlP.ai  
**Screen:** 06  
**Primary target:** Mobile first  
**Secondary targets:** Tablet and desktop  
**User:** Guest Print User  
**Status:** MVP

## 1. Purpose

Screen 06 is the first state of the shared **Order Tracking** screen.

Screens 06, 07 and 08 must use the same underlying screen and reusable components. Only the order state, status presentation, messaging, progress and available actions should change.

```text
Screen 06
Order Received / Waiting for Shop
        ↓
Screen 07
Printing
        ↓
Screen 08
Ready for Collection
```

Do not build three duplicated pages.

Screen 06 represents the state where the order has successfully been submitted and the shop has not yet accepted it.

The primary user message is:

> Your order has been received and is waiting for the shop to accept it.

Do not claim that printing has started until the backend reports the printing state.

---

## 2. Core User Questions

The screen must immediately answer:

```text
Did my order go through?
Which shop received it?
What is happening now?
What am I waiting for?
What happens next?
```

The experience should reassure the user rather than make them feel that the application is stuck.

---

## 3. Critical Engineering Rules

### Never hardcode business values

Never hardcode:

* Shop name
* Shop address
* Order ID
* Customer order reference
* Payment amount
* Payment status
* Number of documents
* Number of pages
* Order status
* Estimated completion time
* Order timestamps
* Collection information
* Shop contact information
* Rejection/failure reason

All dynamic values must come from typed application state or backend data.

If mock data is required during development, keep it in the dedicated mock/data layer. Never place mock business values directly inside JSX.

### Use centralized constants

Use constants or enums for static identifiers such as:

```text
OrderStatus
PaymentStatus
TrackingState
CollectionState
Routes
AnalyticsEvent
ErrorCode
```

Do not scatter status strings throughout components.

Use the existing shared domain model if one already exists.

### No hardcoded business logic in UI

Do not put pricing, order state transitions, API calls, polling or realtime orchestration directly into presentational components.

---

## 4. Existing Design System

Before implementation:

1. Inspect the existing CtrlP design system.
2. Reuse typography tokens.
3. Reuse color tokens.
4. Reuse spacing tokens.
5. Reuse radius tokens.
6. Reuse shadows.
7. Reuse buttons.
8. Reuse icons.
9. Reuse status indicators.
10. Reuse existing breakpoints.

Do not create a second design system.

Do not introduce arbitrary hex values, font sizes, spacing or radii.

---

## 5. Screen 06 State

Screen 06 represents:

```text
Order submitted
+
Order accepted by backend
+
Shop has not yet accepted the order
```

The canonical backend state may be named `SUBMITTED`, but use the project's actual domain enum rather than assuming the string.

---

## 6. Mobile First Layout

Use a clean vertical mobile layout.

Conceptual structure:

```text
┌─────────────────────────────────────┐
│              Order Status           │
│                                     │
│                 ✓                   │
│                                     │
│          Order received             │
│                                     │
│  Your order has been sent to the    │
│  print shop.                        │
│                                     │
│          Order #XXXXXX              │
├─────────────────────────────────────┤
│  Printing at                        │
│  Shop Name                          │
│  Shop Location                      │
├─────────────────────────────────────┤
│  ORDER PROGRESS                     │
│                                     │
│  ✓ Order received                   │
│  │                                  │
│  ○ Shop accepted                    │
│  │                                  │
│  ○ Printing                         │
│  │                                  │
│  ○ Ready for collection             │
├─────────────────────────────────────┤
│  Waiting for shop                   │
│  The shop will start processing     │
│  your order after accepting it.     │
├─────────────────────────────────────┤
│  Payment                            │
│  Paid online / Pay at shop          │
│  ₹XX                                │
└─────────────────────────────────────┘
```

This is a structural guide only. Use the established CtrlP design system for the actual UI.

---

## 7. Header

Use the existing CtrlP order/tracking header.

Provide:

* Appropriate page title
* Back navigation where supported by the existing flow

Be careful with Back after order submission. It must not allow duplicate payment or duplicate order creation.

---

## 8. Confirmation Area

The top section should provide strong confirmation.

Example:

```text
Order received
```

Supporting copy:

```text
Your order has been sent to the shop.
```

Then clearly explain:

```text
Waiting for the shop to accept your order.
```

Do not show Printing as active in this state.

---

## 9. Status Indicator

Use the existing CtrlP visual language.

A status icon or approved illustration may be used.

If animation is introduced:

* Respect reduced motion preferences.
* Do not make animation necessary to understand the state.
* Avoid continuous resource-heavy animation.

---

## 10. Order Reference

Display the customer-facing order reference.

Example:

```text
Order #XXXXXX
```

The value must come from backend order data.

If a copy action exists in the product design system, provide an accessible copy action with confirmation feedback.

Do not expose internal database identifiers unless the product intentionally uses them as customer-facing references.

---

## 11. Shop Summary

Show the shop associated with the order.

At minimum:

```text
Printing at
Shop Name
Shop Location
```

The shop must come from the order/backend relationship.

Do not determine the shop from:

* Browser location
* GPS
* Device location
* Client-side assumptions

The QR/session/order relationship determines the shop.

---

## 12. Order Progress Timeline

The timeline is the main tracking element.

Use a reusable component:

```text
OrderTimeline
└── OrderTimelineItem
```

For Screen 06:

```text
Order received       Completed
Shop accepted        Upcoming
Printing             Upcoming
Ready for collection Upcoming
```

Clearly distinguish:

```text
Completed
Current
Upcoming
Failed
```

Do not rely on color alone.

Use icons, labels and structure.

---

## 13. Current State Message

The current state should communicate:

```text
Waiting for shop
```

Example:

```text
Waiting for the shop to accept your order.
```

Do not invent an acceptance time.

If the backend supplies an expected time, display it as data.

---

## 14. Customer Has No Acceptance Action

The customer does not accept the shop's order.

The shop partner application controls acceptance.

Do not provide customer controls such as:

```text
Accept order
Reject order
Start printing
```

Screen 06 is primarily a read-only tracking state.

---

## 15. Automatic State Updates

When the shop accepts the order, Screen 06 should transition automatically to the next state.

Preferred architecture:

```text
Shop Partner App
       ↓
Central Backend
       ↓
Realtime Event
       ↓
Guest Order State
       ↓
Shared Order Tracking Screen
```

The user should not have to refresh the browser.

---

## 16. Realtime

If WebSockets are available, subscribe to updates for the active order.

Conceptually:

```text
order.status.updated
```

Validate:

* Order identity
* Event type
* Payload schema
* Timestamp/version where available
* State transition

Do not blindly trust incoming event data.

---

## 17. Polling Fallback

If realtime is unavailable or disconnected, use a safe polling/refetch mechanism.

The polling interval must come from centralized configuration.

Never hardcode something such as:

```text
setInterval(..., 5000)
```

inside the component.

Polling must:

* Avoid overlapping requests.
* Back off after repeated failures.
* Pause when appropriate.
* Stop for terminal states.
* Only check the active order.

---

## 18. Reconnection

When realtime disconnects:

```text
Keep last known state
        ↓
Reconnect
        ↓
Fetch latest order
        ↓
Reconcile state
        ↓
Resume subscription
```

Do not reset the order to an earlier state.

---

## 19. Stale Event Protection

A delayed event must not make the UI regress.

For example:

```text
PRINTING
```

must not become:

```text
SUBMITTED
```

because an older event arrived late.

Use backend timestamps, versions or sequence numbers where available.

The backend remains authoritative.

---

## 20. Payment Summary

Display a compact payment state.

Online payment:

```text
Paid online
₹XX
```

Cash:

```text
Pay at shop
₹XX
```

If cash has not been collected:

```text
Payment due at shop
```

Never mark cash as paid until the backend confirms it.

---

## 21. Payment and Order State Are Separate

Do not assume order status equals payment status.

Valid example:

```text
Order: SUBMITTED
Payment: PAID
```

Another valid example:

```text
Order: SUBMITTED
Payment: CASH_PENDING
```

Keep these states independently represented in the data model and UI.

---

## 22. Compact Order Summary

Do not duplicate the full Screen 03 review.

A compact summary may show:

```text
X documents
Y pages
Total ₹XX
```

All values must come from the canonical order.

Screen 06 is a tracking screen, not a configuration screen.

---

## 23. Estimated Completion

Only display an estimated ready time if the backend/shop supplies a reliable estimate.

Examples:

```text
Estimated ready time
Today, 3:30 PM
```

or:

```text
Ready in approximately 15 minutes
```

Do not invent an estimate.

If no estimate exists, either omit the section or use approved product copy indicating that the shop has not provided an estimate.

Do not show fake precision.

---

## 24. Shop Actions

Only show actions already approved and supported by the platform.

Possible actions:

```text
Copy order reference
Contact shop
View shop location
```

Do not add:

```text
Edit documents
Change print settings
Pay again
Start printing
Cancel order
```

unless separately approved and supported by the business workflow.

---

## 25. Loading State

When the screen initially loads:

```text
Loading your order...
```

Use existing skeleton/loading components where possible.

Do not display fake order information while loading.

---

## 26. Refreshing State

When checking for a status update, preserve the current screen.

Use subtle feedback such as:

```text
Updating order status...
```

Do not replace the entire page with a blocking spinner for a small refresh.

---

## 27. Network Failure

If a status request fails:

* Preserve the last known valid order state.
* Retry according to the application's retry strategy.
* Show a recoverable message.

Example:

```text
Couldn't update the order status.
We'll keep trying.
```

Do not tell the user that the order failed simply because the network failed.

---

## 28. Order Not Found

If the backend confirms that the order does not exist or is no longer accessible:

Show a customer-friendly error state.

Never expose:

```text
404
Database IDs
Stack traces
Raw API responses
Internal authorization details
```

---

## 29. Guest Session

No login or signup is required.

Screen 06 must continue to work using the existing guest session.

Do not add:

* Login
* Signup
* Profile
* Account creation
* Order history

The active order must remain associated with the guest session.

---

## 30. Order Access Security

Do not authorize access using only a sequential order number.

The backend must verify that the guest session can access the order.

Do not expose private document storage URLs.

---

## 31. Document Privacy

The tracking screen should minimize document exposure.

Prefer showing document counts rather than document contents.

If thumbnails are later required:

* Use protected resources.
* Do not expose public storage URLs.
* Do not send document content to analytics.
* Do not log document contents.

Document privacy is a day-one requirement.

---

## 32. Status State Architecture

Build one reusable tracking screen.

Conceptually:

```text
OrderTrackingPage
        ↓
OrderTrackingView
        ↓
Current Order State
        ↓
Status Presentation
```

Possible states:

```text
SUBMITTED → Order Received
ACCEPTED  → Shop Accepted
PRINTING  → Printing
READY     → Ready for Collection
```

Error/terminal states may include:

```text
REJECTED
FAILED
CANCELLED
COMPLETED
```

Use the project's actual domain states.

---

## 33. Screens 06, 07 and 08 Must Share Components

Do not create:

```text
Screen06.tsx
Screen07.tsx
Screen08.tsx
```

with duplicated tracking UI.

Instead create reusable components such as:

```text
OrderTrackingPage
OrderStatusHero
OrderTimeline
OrderTimelineItem
ShopSummary
PaymentSummary
OrderEstimate
CompactOrderSummary
OrderActions
```

The current state determines the presentation.

This is an important architectural requirement.

---

## 34. Status Presentation Configuration

Keep status-specific presentation mapping centralized.

Conceptually:

```text
orderStatusPresentation
```

can contain:

```text
label
description
icon
visual state
timeline position
```

Do not scatter large status conditionals throughout JSX.

Business state must remain separate from presentation configuration.

---

## 35. Separate UI From Tracking Logic

Prefer:

```text
Tracking UI
      ↓
Tracking hook/application layer
      ↓
Order service
      ↓
Backend API
      ↓
Realtime transport
```

The UI should render state.

It should not own:

* WebSocket lifecycle
* Polling orchestration
* Order reconciliation
* API retry strategy
* Authentication
* Business state transitions

---

## 36. State Management

The canonical active order is the source of truth.

Derive:

```text
Order status
Payment status
Shop
Order reference
Total
Estimate
Document count
Page count
```

from canonical order state.

Avoid duplicate state such as:

```text
localStatus
localPaymentStatus
localTotal
```

when these values already exist in the canonical state.

---

## 37. API Boundary

Potential operations:

```text
Get active order
Get order status
Subscribe to order updates
Refresh order
Get shop information
```

Follow the existing CtrlP backend architecture.

Validate API responses at the boundary.

The backend is authoritative for:

```text
Order status
Payment status
Order ownership
Shop identity
Order total
Estimated completion
```

---

## 38. Type Safety

Use TypeScript throughout.

Do not use `any` as a shortcut.

Use explicit types for:

```text
Order
OrderStatus
Payment
Shop
OrderEstimate
TrackingEvent
```

Reuse shared domain types when available.

---

## 39. Validation

Use the project's established schema validation approach.

Zod is the preferred validation library in the CtrlP stack.

Validate:

* API responses
* Realtime events
* Order state
* Payment state
* Required order fields

Do not allow malformed external data directly into UI components.

---

## 40. Analytics

If analytics are already part of the project, use centralized event constants.

Useful events:

```text
order_tracking_viewed
order_submitted_state_viewed
order_status_changed
order_reference_copied
contact_shop_clicked
shop_location_clicked
tracking_refresh_failed
```

Never send:

```text
Document contents
Document text
Private document URLs
Payment credentials
Sensitive personal information
Internal printer information
```

---

## 41. Performance

Keep the screen lightweight.

Avoid:

* Full document downloads
* Unnecessary previews
* Full page refetches for every small update
* Aggressive polling
* Multiple realtime subscriptions
* Large animations

Only subscribe to the active order.

---

## 42. Responsive Requirements

Mobile is the source of truth.

Support common mobile widths:

```text
360px
375px
390px
412px
430px
```

Also support tablet and desktop.

Requirements:

* No horizontal overflow.
* Order reference wraps safely.
* Long addresses wrap correctly.
* Timeline remains readable.
* Status message remains prominent.
* Actions remain touch friendly.
* No content is hidden behind sticky elements.

---

## 43. Tablet

On tablet:

* Maintain the mobile information hierarchy.
* Use available space intelligently.
* Keep tracking content readable.
* Avoid excessive stretching.
* Preserve comfortable touch targets.

---

## 44. Desktop

Use a sensible maximum content width.

A two-column structure may be used:

```text
┌─────────────────────────────────────────────┐
│ Order Status                                │
│                                             │
│ ┌────────────────────────┐ ┌──────────────┐ │
│ │ Status + Timeline      │ │ Order        │ │
│ │                        │ │ Summary      │ │
│ │ Order received ✓       │ │ Shop         │ │
│ │ Shop accepted ○        │ │ Payment      │ │
│ │ Printing ○             │ │ Total        │ │
│ │ Ready ○                │ │              │ │
│ └────────────────────────┘ └──────────────┘ │
└─────────────────────────────────────────────┘
```

This is a structural guide, not a fixed implementation.

Mobile remains the source of truth.

---

## 45. Accessibility

Implement:

* Semantic HTML
* Accessible status timeline
* Clear current-state indication
* Accessible copy-order action
* Accessible shop actions
* Keyboard navigation
* Visible focus states
* Screen reader-friendly status updates
* Sufficient contrast
* Appropriate touch targets

Do not rely only on color.

Important status changes should be announced accessibly without repeatedly interrupting the user.

---

## 46. Reduced Motion

If animations are used:

* Respect `prefers-reduced-motion`.
* Do not make animation necessary for understanding.
* Provide an equivalent static state.

---

## 47. Security

Never expose:

* Payment secrets
* API secrets
* Private storage credentials
* Internal printer information
* Internal shop notes
* Sensitive document information

Never trust client supplied:

```text
Order status
Payment status
Order total
Shop identity
Order ownership
```

---

## 48. No Extra Features

Do not add:

```text
Login
Signup
Order history
Marketplace
Coupons
Reviews
Ratings
Reorder
Document editing
Advanced printing
Printer controls
Delivery
```

unless separately approved for the MVP.

---

## 49. Screen 06 Responsibilities

### Screen 06 DOES

```text
Confirm order receipt
Show order reference
Show shop
Show submitted/current state
Show progress timeline
Show payment state
Show total
Show estimate when available
Receive live order updates
Handle network/realtime failures
Provide approved shop actions
Transition automatically to the next tracking state
```

### Screen 06 DOES NOT

```text
Configure documents
Change print settings
Change price
Accept/reject the order
Start printing
Manage printer
Create account
Initiate another payment
Create another order
```

---

## 50. Transition to Screen 07

When the backend changes the order to the printing state:

```text
Screen 06
Order Received
      ↓
Backend state update
      ↓
Shared OrderTrackingPage
      ↓
Screen 07 state
Printing
```

Do not navigate to a completely separate duplicated implementation.

If the product uses a single tracking route, update the state in place.

---

## 51. Transition Safety

Before applying a state update:

1. Validate the event.
2. Confirm it belongs to the active order.
3. Validate the state.
4. Check event ordering/version where available.
5. Update canonical order state.
6. Re-render the tracking UI.

Do not mutate visual state independently from canonical order state.

---

## 52. Definition of Done

### Confirmation

* Order received state is immediately understandable.
* Correct order reference is displayed.
* Correct shop is displayed.
* Correct payment state is displayed.
* Correct total is displayed.

### Tracking

* Order received is completed in the timeline.
* Shop accepted is upcoming.
* Printing is upcoming.
* Ready for collection is upcoming.
* Current state is visually obvious.
* State updates automatically.

### Realtime

* Active order subscription works where available.
* Events are validated.
* Reconnection works.
* Latest state is fetched after reconnect.
* Stale events cannot regress state.
* Polling fallback exists where required.

### Payment

* Online paid state is accurate.
* Cash pending state is accurate.
* No false paid status.
* Payment state remains separate from order state.

### Estimate

* Estimate appears only when supplied.
* No fake estimate is generated.
* Missing estimate is handled gracefully.

### Errors

* Loading state exists.
* Network failure is recoverable.
* Refresh failure preserves the last known valid state.
* Invalid order access is handled safely.
* Raw backend errors are never exposed.

### Guest experience

* No login required.
* Guest session remains associated with the order.
* Refresh preserves access.
* Duplicate order creation is prevented.

### Responsive

* Mobile first.
* Common mobile widths supported.
* Tablet supported.
* Desktop supported.
* No horizontal overflow.
* Long content is handled safely.

### Engineering

* No hardcoded business values.
* Dynamic values are data driven.
* Static identifiers use centralized constants/enums.
* Modular components.
* Screens 06, 07 and 08 share the same tracking architecture.
* No duplicated tracking UI.
* No monolithic page component.
* No unnecessary duplicate state.
* No unnecessary `any`.
* UI is separated from tracking/business logic.
* API responses are validated.
* Realtime events are validated.
* Backend remains authoritative.
* Document privacy is maintained.
* Accessibility requirements are met.
* Existing CtrlP design system is reused.

---

## 53. Final State Model

```text
                 SCREEN 06

              Order received
                    ✓
                    │
                    │
             Waiting for shop
                    │
                    ↓
             Shop accepts order
                    │
                    ↓
                PRINTING
                    │
                    ↓
          READY FOR COLLECTION
```

The core principle is:

> **Screen 06 should reassure the guest that the order was successfully submitted to the correct print shop and is safely waiting for acceptance. The user should never have to guess whether the order went through or whether they need to do anything else.**

Build Screen 06 as the **Order Received state of the shared Order Tracking screen** so Screen 07 and Screen 08 can reuse the same architecture.
