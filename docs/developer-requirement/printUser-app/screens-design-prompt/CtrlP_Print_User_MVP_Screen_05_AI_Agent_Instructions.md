# CtrlP.ai Print User Web App
## Screen 05: Order Confirmation & Tracking
### AI Coding Agent Implementation Instructions

**Project:** CtrlP.ai  
**Screen:** Print User Web App, Screen 05  
**Primary target:** Mobile first  
**Secondary targets:** Tablet and desktop  
**User:** Guest Print User  
**Status:** MVP

---

# 1. Objective

Implement **Screen 05: Order Confirmation & Tracking** for the CtrlP.ai Print User web app.

This is the screen the guest user reaches after the payment/order submission flow on Screen 04.

The screen must give the user immediate confidence that:

1. Their order was successfully received.
2. Their payment state is clear.
3. Their order is connected to the correct print shop.
4. They know what happens next.
5. They can track the printing progress.
6. They know when and where to collect the printed documents.

The screen is therefore both:

```text
Order Confirmation
+
Order Status / Tracking
```

Do not treat it as a static success page.

The shop can change the order state after submission, so the screen must support live or refreshed status updates.

---

# 2. User Flow

The primary MVP journey is:

```text
Screen 01
Upload Documents
        ↓
Screen 02
Configure Documents
        ↓
Screen 03
Review Order
        ↓
Screen 04
Payment
        ↓
Screen 05
Order Confirmation & Tracking
```

After reaching Screen 05:

```text
Order received
      ↓
Shop accepts order
      ↓
Printing
      ↓
Ready for collection
```

If the shop rejects or an operational failure occurs, the screen must represent that state appropriately.

---

# 3. Critical Engineering Rules

## Never hardcode business values

Do not hardcode:

- Shop name
- Shop address
- Order ID
- Order reference
- Order status
- Payment status
- Payment amount
- Number of documents
- Page count
- Estimated completion time
- Collection instructions
- Shop contact information
- Status timestamps
- Printer status
- Failure reason
- Currency
- Any dynamic message based on backend state

All dynamic values must come from typed application state or backend data.

If mock data is required during development, put it in a dedicated mock/data layer.

Never put mock business values directly into JSX.

---

# 4. Constants and Enums

Use centralized constants or domain enums for static identifiers.

Examples:

```text
OrderStatus
PaymentStatus
OrderTimelineState
CollectionState
Routes
Analytics event names
Error codes
```

Possible order state identifiers may include:

```text
SUBMITTED
ACCEPTED
PRINTING
READY
COMPLETED
REJECTED
CANCELLED
FAILED
```

Use the project's actual shared domain model if it already exists.

Do not scatter string literals such as:

```text
"printing"
"ready"
"accepted"
```

throughout the components.

Dynamic content should still come from state/configuration rather than constants.

---

# 5. Existing Design System

Before implementation:

1. Inspect the existing CtrlP design system.
2. Reuse typography tokens.
3. Reuse color tokens.
4. Reuse spacing tokens.
5. Reuse border-radius tokens.
6. Reuse shadow tokens.
7. Reuse button components.
8. Reuse icon components.
9. Reuse status indicators.
10. Reuse responsive breakpoints.

Do not create a second design system.

Do not introduce arbitrary colors or typography values.

If a required design token does not exist, add it centrally.

---

# 6. Core Screen Responsibilities

Screen 05 must provide:

- Order confirmation
- Order reference
- Shop information
- Payment status
- Order total
- Current order status
- Visual order progress
- Relevant status message
- Estimated completion information when available
- Collection information
- Refresh/realtime status updates
- Failure/rejection state
- Recovery/support action where appropriate

The screen should answer:

```text
Did my order go through?
Is my payment okay?
What is happening now?
When will my prints be ready?
Where do I collect them?
```

---

# 7. Recommended Mobile Layout

Conceptually:

```text
┌─────────────────────────────────────┐
│  Order Status                       │
├─────────────────────────────────────┤
│                                     │
│              ✓                      │
│                                     │
│       Order received                │
│       Your order is confirmed       │
│                                     │
│       Order #XXXXXX                 │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Printing at                        │
│  Shop Name                          │
│  Shop location                     │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Order progress                     │
│                                     │
│  ✓ Order received                   │
│  │                                  │
│  ✓ Shop accepted                    │
│  │                                  │
│  ● Printing                         │
│  │                                  │
│  ○ Ready for collection             │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Estimated ready time               │
│  Dynamic value                      │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Payment                            │
│  Paid online / Pay at shop          │
│  ₹XX                                │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Collection                         │
│  Shop address                       │
│  Collection instructions            │
│                                     │
└─────────────────────────────────────┘
```

This is a structural guide only.

Use the existing CtrlP design system for the actual visual design.

---

# 8. Confirmation State

Immediately after successful order creation, show a strong confirmation state.

Example:

```text
Order received
```

Supporting copy:

```text
Your print order has been sent to the shop.
```

Do not claim:

```text
Printing started
```

unless the backend actually reports that the shop has started printing.

The confirmation message must correspond to the actual order state.

---

# 9. Order Reference

Display a customer-friendly order reference.

Example:

```text
Order #XXXXXX
```

The actual reference must come from the backend.

Do not expose internal database identifiers if the product has a separate customer-facing reference.

Provide a convenient copy action if supported by the design system.

If a copy action exists:

```text
Copy order number
```

should provide accessible feedback.

---

# 10. Shop Information

Show the shop associated with the order.

At minimum:

- Shop name
- Relevant location/address

Optional information can include:

- Contact action
- Directions
- Shop operating status

Only show fields that are available and approved for the MVP.

The shop identity must come from the order/backend relationship.

Do not infer the shop from the browser location.

---

# 11. Order Progress

The most important part of Screen 05 is the order progress.

Use a reusable status/timeline component.

Conceptually:

```text
OrderTimeline
├── Order received
├── Shop accepted
├── Printing
└── Ready for collection
```

The timeline should visually distinguish:

```text
Completed
Current
Upcoming
Failed
```

Do not communicate status using color alone.

Use icons, labels and supporting text.

---

# 12. Status State Machine

The UI should support the backend order lifecycle.

Conceptually:

```text
SUBMITTED
    ↓
ACCEPTED
    ↓
PRINTING
    ↓
READY
    ↓
COMPLETED
```

Alternative terminal/error states:

```text
REJECTED
CANCELLED
FAILED
```

The exact canonical states must come from the project's shared domain model.

Do not invent frontend-only states that conflict with backend order states.

---

# 13. Submitted State

When:

```text
OrderStatus = SUBMITTED
```

Display:

```text
Order received
```

Supporting information should communicate:

```text
Your order is waiting for the shop to accept it.
```

Do not show Printing as active yet.

---

# 14. Accepted State

When:

```text
OrderStatus = ACCEPTED
```

Display:

```text
Shop accepted your order
```

Supporting information can communicate:

```text
Your documents are queued for printing.
```

The UI should make Printing the next expected step.

---

# 15. Printing State

When:

```text
OrderStatus = PRINTING
```

Display:

```text
Printing your documents
```

This is the primary active state during the printing process.

If the backend provides meaningful progress information, it may be displayed.

Do not invent a percentage.

Never show:

```text
73% complete
```

unless the backend actually provides a reliable progress value.

---

# 16. Ready State

When:

```text
OrderStatus = READY
```

Display a strong ready state:

```text
Your prints are ready
```

Supporting information:

```text
Collect them from the shop.
```

This is a high-priority state and should be visually prominent.

If the shop provides collection instructions, display them.

---

# 17. Completed State

If the backend records that the customer has collected the order:

```text
Order completed
```

Display the completed state.

Do not imply that the order is still waiting for collection.

---

# 18. Rejected State

If the shop rejects the order:

```text
Order couldn't be accepted
```

Display the reason only if the backend provides a customer-safe reason.

Do not expose:

- Internal error messages
- Stack traces
- Internal shop notes
- Printer diagnostics

Provide the appropriate recovery action.

Possible action:

```text
Contact shop
```

or another product-approved recovery path.

---

# 19. Failed State

If printing or order processing fails:

```text
We couldn't complete your print order.
```

The message should be specific when safe.

For example:

```text
The shop was unable to complete this order.
```

Do not reveal internal printer errors.

The backend must determine the actual failure state.

---

# 20. Cancelled State

If the order is cancelled:

```text
Order cancelled
```

Show the applicable customer-facing explanation.

Do not allow the user to accidentally restart a cancelled order through the same CTA.

---

# 21. Payment Status

Screen 05 must clearly display the payment state.

For online payment:

```text
Paid online
```

For cash:

```text
Pay at shop
```

If cash is still pending:

```text
Payment due at shop
```

Never display:

```text
Paid
```

unless the backend confirms the payment.

---

# 22. Payment and Order State Must Be Independent

Do not assume:

```text
Order status = payment status
```

They are separate domains.

Example:

```text
Order:
PRINTING

Payment:
PAID
```

Another valid state:

```text
Order:
READY

Payment:
CASH_PENDING
```

The UI must represent these independently.

---

# 23. Order Total

Show the final authoritative order amount.

Example:

```text
Total
₹XX
```

Use the backend order pricing.

Do not recalculate the total on Screen 05.

Use centralized currency formatting.

Conceptually:

```text
formatCurrency(amount, currency, locale)
```

---

# 24. Document Summary

Do not reproduce the entire Screen 03 review.

A compact summary can show:

```text
4 documents
12 pages
```

or the equivalent data available from the backend.

If the product requires it, allow the user to expand a compact order summary.

The screen's primary purpose is status tracking, not document configuration.

---

# 25. Estimated Completion

If the shop/backend provides an estimated completion time, display it.

Examples:

```text
Estimated ready time
Today, 3:30 PM
```

or:

```text
Ready in approximately 15 minutes
```

The value must come from backend/shop data.

Never invent an estimate on the client.

If no reliable estimate exists:

```text
The shop hasn't provided an estimated ready time yet.
```

Do not show fake precision.

---

# 26. Collection Information

When the order is accepted or ready, show relevant collection information.

Possible fields:

- Shop name
- Address
- Collection instructions
- Shop contact
- Directions action

Only display available and approved information.

For example:

```text
Collect your prints from
Shop Name
Shop Address
```

---

# 27. Ready for Collection CTA

When:

```text
OrderStatus = READY
```

the screen may provide relevant actions.

Examples:

```text
View shop location
Contact shop
```

Do not add unrelated CTAs.

If a product-approved collection confirmation exists, it can be implemented according to the backend workflow.

Do not let the user falsely mark an order as collected unless the business workflow explicitly supports customer confirmation.

---

# 28. Live Updates

Screen 05 must support status updates because the shop can change the order state after submission.

Preferred architecture:

```text
Backend
   ↓
Realtime event / WebSocket
   ↓
Client state update
   ↓
Screen 05
```

If realtime infrastructure is not available at the implementation stage, provide a safe polling/refetch mechanism.

Do not require the user to manually refresh the entire browser.

---

# 29. Realtime Event Handling

Only update the relevant order.

Conceptually:

```text
order.status.updated
```

should update the active order state.

Validate:

- Order identity
- Event type
- Current state
- Event payload

Do not blindly trust client-side event data.

---

# 30. Polling Fallback

If polling is used:

- Use a sensible interval from centralized configuration.
- Stop polling after a terminal state.
- Stop polling when the page is not active where appropriate.
- Avoid overlapping requests.
- Back off on repeated failures.
- Do not use aggressive polling.

Do not hardcode the interval inside the component.

---

# 31. Terminal States

Polling/realtime tracking should stop or become passive when the order reaches an appropriate terminal state.

Examples:

```text
COMPLETED
CANCELLED
REJECTED
```

Do not continue unnecessary network activity indefinitely.

---

# 32. Refresh Behavior

If the user refreshes the page:

1. Restore the guest session.
2. Retrieve the latest order.
3. Retrieve the latest payment state.
4. Render the current status.
5. Resume realtime/polling if necessary.

Never rely solely on local browser state for order status.

---

# 33. Browser Back

The user may navigate back to previous screens.

However, after the order has been submitted:

```text
Screen 05
```

should remain the authoritative tracking destination.

Do not accidentally allow the user to create another order by navigating backwards and resubmitting the previous payment flow.

The backend must protect against duplicate order creation.

---

# 34. Guest Session

The user does not have an account.

Screen 05 must work using the existing guest session/order access mechanism.

Do not add:

- Login
- Signup
- Profile
- Account creation
- Order history

The current order should remain accessible through the guest session and customer-facing order reference according to the platform's security model.

---

# 35. Order Access Security

Do not use only a sequential order ID to authorize access.

The backend must ensure that the guest session is allowed to view the order.

Never expose:

- Internal database credentials
- Private document URLs
- Payment secrets
- Internal shop notes
- Printer diagnostics

---

# 36. Document Privacy

Documents may contain sensitive information.

Screen 05 should not unnecessarily display document contents.

If document thumbnails are shown:

- Use controlled private assets.
- Do not expose public storage URLs.
- Do not send document content to analytics.
- Do not log document contents.
- Use appropriate authorization.

The screen should prioritize status over document content.

---

# 37. Loading States

Implement dedicated loading states.

### Initial order loading

```text
Loading your order...
```

### Status refresh

Do not replace the entire screen with a full-screen spinner.

Use subtle updating feedback.

### Realtime connection

If necessary:

```text
Updating order status...
```

Do not expose technical WebSocket terminology to users.

---

# 38. Error States

### Order loading failure

```text
We couldn't load your order.
Try again.
```

### Temporary status update failure

Preserve the last known valid state and show:

```text
Couldn't refresh status.
Try again.
```

Do not reset the order to an unknown state just because one network request failed.

### Order no longer accessible

Show a clear customer-facing message.

Do not expose raw API errors.

---

# 39. Stale Status Handling

If the realtime connection is interrupted:

- Keep the last known status.
- Indicate that the status may be updating.
- Retry the connection.
- Refetch when appropriate.

Never regress the UI from:

```text
PRINTING
```

back to:

```text
SUBMITTED
```

because an old event arrived.

Use timestamps/versioning or backend ordering where available.

---

# 40. Status Transition Validation

The frontend should not blindly accept impossible transitions.

Example:

```text
READY
   ↓
SUBMITTED
```

should not visually move the user backwards unless the backend explicitly indicates a valid correction.

The backend remains authoritative, but the client should protect its UI state from stale events.

---

# 41. Accessibility

Implement:

- Semantic HTML.
- Accessible status timeline.
- Accessible current-state indication.
- Screen reader announcements for important status changes.
- Accessible copy-order action.
- Accessible contact/directions actions.
- Keyboard navigation.
- Visible focus states.
- Sufficient contrast.
- Touch-friendly controls.

Important status changes should be announced without repeatedly interrupting the user.

Do not rely only on color.

---

# 42. Responsive Design

Mobile is the primary target.

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

- No horizontal overflow.
- Status timeline remains readable.
- Order reference wraps safely.
- Shop information does not break layout.
- Long addresses wrap correctly.
- CTAs remain accessible.
- Status messages do not overlap.
- Sticky elements do not hide content.

---

# 43. Tablet

On tablet:

- Maintain the same status hierarchy.
- Use available width intelligently.
- Keep tracking content readable.
- Avoid excessive stretching.

---

# 44. Desktop

Use a sensible maximum content width.

A desktop layout may use:

```text
┌─────────────────────────────────────────────┐
│ Order Status                                │
│                                             │
│ ┌────────────────────────┐ ┌──────────────┐ │
│ │ Order progress         │ │ Order        │ │
│ │                        │ │ summary      │ │
│ │ Received ✓             │ │ Shop         │ │
│ │ Accepted ✓             │ │ Amount       │ │
│ │ Printing ●             │ │ Payment      │ │
│ │ Ready ○                │ │ Collection   │ │
│ └────────────────────────┘ └──────────────┘ │
└─────────────────────────────────────────────┘
```

This is a structural suggestion, not a fixed implementation.

Mobile remains the source of truth.

---

# 45. Sticky Elements

Avoid unnecessary sticky UI on Screen 05.

If a persistent status/CTA element is used:

- Respect safe-area insets.
- Do not cover the timeline.
- Do not cover error messages.
- Do not obstruct collection information.

The user should be able to comfortably scroll through the entire order state.

---

# 46. Component Architecture

Use a modular architecture.

Suggested conceptual structure:

```text
OrderTrackingPage
│
├── OrderStatusHeader
│   ├── StatusIcon
│   ├── StatusTitle
│   ├── StatusDescription
│   └── OrderReference
│
├── ShopSummary
│
├── OrderTimeline
│   └── OrderTimelineItem
│
├── OrderEstimate
│
├── PaymentSummary
│
├── OrderSummary
│
├── CollectionInformation
│
└── OrderActions
    ├── ContactShopButton
    └── DirectionsButton
```

Adapt this to the existing project architecture.

Do not create one large page component.

---

# 47. Status Configuration

Keep status presentation configuration separate from the main component.

Conceptually:

```text
orderStatusPresentation
```

may define:

```text
label
description
icon
visual state
timeline position
```

Do not hardcode large conditional UI blocks such as:

```text
if status === "PRINTING"
...
if status === "READY"
...
```

throughout the page.

Use a centralized mapping or strategy appropriate to the existing architecture.

Business state remains separate from presentation configuration.

---

# 48. Separate UI From Tracking Logic

Prefer:

```text
Tracking UI
     ↓
Order tracking hook/application layer
     ↓
Order service
     ↓
Backend API / realtime transport
```

The UI should render the current state.

Realtime connection, polling, reconciliation and API operations should not be embedded throughout presentational components.

---

# 49. State Management

The active order should be the source of truth.

Derive:

- Status
- Payment state
- Total
- Shop
- Estimate
- Collection information
- Document summary

from the order/application state.

Avoid duplicate state such as:

```text
localOrderStatus
localPaymentStatus
localOrderTotal
```

if these can be derived from the canonical order state.

---

# 50. API Boundary

Potential operations include:

```text
Get order
Get order status
Subscribe to order events
Refresh order
Get shop information
```

Follow the project's existing API architecture.

Validate external data at the boundary.

Do not trust client supplied:

```text
Order status
Payment status
Order ownership
Payment amount
Shop identity
```

---

# 51. Realtime and Consistency

If WebSockets are used:

```text
Connect
   ↓
Authenticate guest session
   ↓
Subscribe to active order
   ↓
Receive event
   ↓
Validate event
   ↓
Update canonical state
```

If the connection reconnects:

```text
Reconnect
   ↓
Fetch latest order
   ↓
Reconcile state
   ↓
Resume subscription
```

Do not assume no events were missed during disconnection.

---

# 52. Analytics

If analytics are already part of the project, use centralized event constants.

Useful events:

```text
order_tracking_viewed
order_status_changed
order_ready
order_tracking_refresh
order_reference_copied
contact_shop_clicked
directions_clicked
```

Do not include:

```text
Document contents
Private document URLs
Payment credentials
Sensitive personal information
Internal printer data
```

---

# 53. Performance

Screen 05 should remain lightweight.

Avoid:

- Full document downloads.
- Repeated complete page reloads.
- Unnecessary API requests.
- Aggressive polling.
- Unnecessary realtime subscriptions.
- Large image assets.

Only subscribe to or poll the active order.

---

# 54. Error Recovery

Prefer preserving useful information.

If status refresh fails:

```text
Last known valid order state
+
Retry
```

rather than:

```text
Blank page
```

If realtime disconnects:

```text
Continue showing last known state
+
Reconnect automatically
```

The user should not lose access to the order simply because connectivity is temporarily unavailable.

---

# 55. No Extra Features

Do not add:

```text
Order history
Account creation
Saved orders
Reviews
Ratings
Coupons
Marketplace
Reordering
Advanced printing settings
Printer controls
Document editing
```

unless separately approved for the MVP.

---

# 56. Screen 05 Responsibilities

## Screen 05 DOES

```text
Confirm order
Show order reference
Show shop
Show order status
Show status timeline
Show payment status
Show total
Show estimated ready time when available
Show collection information
Receive status updates
Handle status failures
Handle rejection/failure/cancellation
Provide appropriate shop actions
```

## Screen 05 DOES NOT

```text
Configure documents
Change print settings
Change price
Initiate a new payment
Send printer commands
Manage printers
Create accounts
```

---

# 57. Important Business State Separation

The implementation must distinguish:

```text
Order state
Payment state
Printing state
Collection state
```

Do not combine them into a single boolean such as:

```text
isCompleted
```

A real order can be:

```text
Order: READY
Payment: CASH_PENDING
Collection: NOT_COLLECTED
```

These states must remain independently representable.

---

# 58. Customer-Facing Language

Use simple language.

Prefer:

```text
Order received
Shop accepted your order
Printing your documents
Your prints are ready
Pay at the shop
Payment received
```

Avoid technical terms such as:

```text
Webhook
Socket
Payment intent
Transaction state
Printer daemon
Queue worker
API error
```

Technical implementation details must never leak into the customer-facing UI.

---

# 59. Definition of Done

## Confirmation

- Order confirmation is clearly displayed.
- Customer-facing order reference is displayed.
- Correct shop is displayed.
- Correct total is displayed.

## Tracking

- Current order state is accurate.
- Timeline is visible.
- Completed/current/upcoming states are distinguishable.
- Status updates are supported.
- Stale events do not regress the UI.

## Payment

- Online payment state is accurate.
- Cash payment state is accurate.
- Paid is shown only after backend confirmation.
- Cash pending remains clearly marked.

## Estimate

- Estimated completion is displayed when available.
- No fake estimates are generated.
- Missing estimates are handled gracefully.

## Collection

- Shop collection information is displayed.
- Ready state clearly tells the user what to do next.
- Approved contact/directions actions work if provided.

## Realtime

- Realtime updates work where infrastructure is available.
- Reconnection is handled.
- Latest state is fetched after reconnect.
- Polling fallback works if required.
- Polling stops for terminal states.

## Failure

- Rejected state works.
- Failed state works.
- Cancelled state works.
- Network errors preserve the last known valid state.
- Raw backend errors are never exposed.

## Guest experience

- No login required.
- Guest session remains associated with the order.
- Refresh preserves access.
- Duplicate order creation is prevented.

## Responsive

- Mobile first.
- Common mobile widths supported.
- Tablet supported.
- Desktop supported.
- No horizontal overflow.
- Long addresses and order references are handled safely.

## Engineering

- No hardcoded business values.
- Dynamic values are data driven.
- Static identifiers use centralized constants/enums.
- Modular components.
- No monolithic page component.
- No unnecessary duplicate state.
- No unnecessary `any`.
- UI is separated from tracking/business logic.
- API responses are validated.
- Backend remains authoritative.
- Realtime events are validated.
- Document privacy is maintained.
- Payment information is handled securely.
- Accessibility requirements are met.
- Existing CtrlP design system is reused.

---

# 60. Final Screen 05 Flow

```text
Screen 04
Payment
      ↓
Backend confirms order
      ↓
Screen 05
Order Confirmation & Tracking
      │
      ├── Order received
      │
      ├── Shop accepted
      │
      ├── Printing
      │
      └── Ready for collection
                ↓
          Customer collects
                ↓
             Completed
```

Error path:

```text
Order submitted
      ↓
Shop rejects / processing fails
      ↓
Customer-facing failure state
      ↓
Appropriate recovery/support action
```

The core principle is:

> **Screen 05 should eliminate uncertainty after the user submits the order. The user should always know the current state of their print job, the payment state, what happens next, and when they can collect their documents.**

Keep the implementation modular, data driven, secure, responsive, accessible, realtime-aware, and consistent with the existing CtrlP design system.
