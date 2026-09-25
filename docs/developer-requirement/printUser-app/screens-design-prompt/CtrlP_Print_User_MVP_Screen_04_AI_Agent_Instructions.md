# CtrlP.ai Print User Web App
## Screen 04: Payment
### AI Coding Agent Implementation Instructions

**Project:** CtrlP.ai  
**Screen:** Print User Web App, Screen 04  
**Primary target:** Mobile first  
**Secondary targets:** Tablet and desktop  
**User:** Guest Print User  
**Status:** MVP

---

# 1. Objective

Implement **Screen 04: Payment** for the CtrlP.ai Print User web app.

The user reaches this screen after reviewing the order on Screen 03.

The purpose of this screen is to let the guest user choose and complete the payment method for the already reviewed order.

The flow is:

```text
Screen 01
Upload Documents
        ↓
Screen 02
Documents + Preview + Print Configuration
        ↓
Screen 03
Review Order
        ↓
Screen 04
Payment
        ↓
Screen 05
Order Status
```

The screen must feel simple and trustworthy.

The user should understand:

```text
What order am I paying for?
        ↓
How much do I need to pay?
        ↓
How can I pay?
        ↓
What is happening after I choose the payment method?
```

---

# 2. Critical Engineering Rules

## Never hardcode business values

Do not hardcode:

- Order ID
- Shop name
- File names
- Page counts
- Copies
- Prices
- Fees
- Taxes
- Discounts
- Final amount
- Currency
- Payment methods
- Payment provider configuration
- Payment expiry
- Shop capabilities

These values must come from typed application state, backend data, shop configuration or payment provider configuration.

If mock data is required during development, keep it in a dedicated mock/data layer.

Never put mock business values directly inside JSX or presentational components.

---

# 3. Use Constants Properly

Use centralized constants/enums for genuinely static values.

Examples:

```text
PaymentMethod
PaymentStatus
OrderPaymentState
Routes
Analytics event names
UI timeout identifiers
Domain error codes
```

Do not put dynamic business configuration into constants.

For example:

```text
WRONG:
UPI_AMOUNT = 500

RIGHT:
order.pricing.total
```

Similarly:

```text
WRONG:
PAYMENT_METHODS = ["UPI", "CASH"]
```

if payment methods can vary by shop/platform.

Instead, derive enabled payment methods from backend configuration.

Static enum identifiers are acceptable:

```text
ONLINE
CASH
```

Follow the project's existing constant and domain-model conventions.

---

# 4. Existing Design System

Before implementing the screen:

1. Inspect the existing CtrlP design system.
2. Reuse typography tokens.
3. Reuse color tokens.
4. Reuse spacing tokens.
5. Reuse border-radius tokens.
6. Reuse shadow tokens.
7. Reuse button components.
8. Reuse icon components.
9. Reuse responsive breakpoints.
10. Reuse existing card, radio and feedback components where appropriate.

Do not introduce a second visual system.

Do not add random hex colors.

Do not create arbitrary typography values inside the screen.

If a required token does not exist, add it centrally.

---

# 5. Payment Methods for MVP

The MVP supports two payment paths:

## Online Payment

The primary online payment experience is intended for UPI and the configured online payment provider.

The exact provider and available methods must come from platform configuration.

Do not assume the frontend owns payment provider credentials or secrets.

## Cash at Shop

The user can choose to pay at the physical print shop when collecting the printed documents.

The UI must clearly communicate that:

```text
Payment is due at the shop.
```

The cash option must not be treated as an online payment.

---

# 6. Core Screen Features

Screen 04 must provide:

- Order/payment summary
- Final payable amount
- Payment method selection
- Online payment initiation
- Cash at Shop selection
- Payment state
- Loading states
- Failure states
- Retry behavior
- Payment verification handling
- Continue/confirmation transition
- Protection against duplicate payment actions

The screen should not introduce additional printing configuration.

---

# 7. Screen Layout

The mobile composition should be simple and vertically structured.

Conceptually:

```text
┌─────────────────────────────────────┐
│  ←          Payment                │
├─────────────────────────────────────┤
│                                     │
│  Your Order                         │
│  Shop Name                          │
│  Order #XXXXXXXX                    │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Amount to pay                      │
│                                     │
│              ₹XX                    │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Choose payment method              │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  UPI / Online                 │  │
│  │  Pay securely online       ○  │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Cash at Shop                 │  │
│  │  Pay when you collect      ○  │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │       Continue / Pay          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

This is a structural guide only.

Use the existing CtrlP visual design system for the final appearance.

---

# 8. Header

Use the established CtrlP mobile header.

## Back

Behavior:

```text
Screen 04 → Screen 03
```

Preserve the order draft.

If a payment operation has already started, do not blindly abandon a potentially active payment session. Handle the state according to the payment provider/backend contract.

## Title

```text
Payment
```

Use the existing CtrlP typography.

Avoid unnecessary actions in the header.

---

# 9. Order Context

The payment screen should reassure the user that they are paying for the correct order.

Show compact order context:

- Shop name
- Order ID or customer-friendly order reference
- Final amount

Do not show a full duplicate of the Screen 03 document review.

The review screen already handled detailed verification.

---

# 10. Amount Due

The final payable amount should be visually prominent.

Use the authoritative backend pricing result.

Conceptually:

```text
Amount to pay

₹XX
```

Do not calculate the final amount independently in the payment component.

The payment amount must be validated against the backend before payment initiation.

---

# 11. Payment Method Selector

Use a clear selection component.

Each available payment method should be represented as a reusable payment method card.

Conceptually:

```text
PaymentMethodCard
├── Icon
├── Name
├── Description
├── Selection state
└── Optional supporting information
```

Do not duplicate payment selection markup for every method.

---

# 12. Online Payment Option

Display the online payment option only when enabled.

Example conceptual content:

```text
UPI / Online Payment

Pay securely online
```

The exact payment provider name should only be displayed if it is intentionally part of the product experience.

Do not expose technical provider details unnecessarily.

The UI should communicate that payment happens securely.

---

# 13. Cash at Shop Option

Display:

```text
Cash at Shop

Pay when you collect your prints
```

The amount due should be clear.

Example:

```text
Amount due at shop: ₹XX
```

Use the authoritative amount.

Do not imply that cash has already been paid.

---

# 14. Payment Method Availability

Payment methods must be data driven.

Conceptually:

```text
availablePaymentMethods[]
```

The backend/shop configuration determines what the user can select.

Possible future methods might include:

```text
UPI
Card
Net Banking
Wallet
Cash
```

Do not implement future methods unless enabled and supported.

The component architecture must allow additional methods without rewriting the entire payment screen.

---

# 15. Initial State

When the screen first loads:

```text
Order loaded
Payment method not yet confirmed
Payment not started
```

If product requirements specify a default payment method, use a centralized product configuration rather than hardcoding the choice inside the component.

Do not automatically initiate a payment merely because the screen opened.

---

# 16. Online Payment Flow

When the user chooses online payment:

```text
Select Online
      ↓
Continue / Pay
      ↓
Backend creates payment request
      ↓
Payment provider checkout
      ↓
User completes payment
      ↓
Backend verifies payment
      ↓
Payment successful
      ↓
Order submitted/confirmed
      ↓
Screen 05
```

The exact provider flow depends on the payment integration.

The frontend must not assume that a client-side callback alone proves payment success.

---

# 17. Payment Status Model

Support at minimum:

```text
NOT_STARTED
METHOD_SELECTED
INITIATING
PENDING
SUCCESS
FAILED
CANCELLED
VERIFICATION_PENDING
```

Use centralized domain constants/enums.

Do not use arbitrary string literals throughout the UI.

---

# 18. Payment Success

After the backend confirms successful payment:

```text
Payment successful
        ↓
Order submission/confirmation
        ↓
Screen 05
```

The user should not be asked to pay again.

Display a brief confirmation state while transitioning if needed.

Do not treat a browser redirect alone as authoritative.

---

# 19. Payment Verification

A payment may be completed by the provider but still require backend verification.

Example state:

```text
Payment completed
Checking payment status...
```

During verification:

- Do not create another payment attempt.
- Do not show the payment as failed prematurely.
- Poll or receive the backend result according to the architecture.
- Move forward only when the backend confirms the final state.

---

# 20. Payment Failure

If online payment fails:

```text
Payment couldn't be completed.
```

Provide a clear recovery action:

```text
Try again
```

The user should also be able to choose Cash at Shop if that method is still available.

Do not create duplicate payment records when retrying.

---

# 21. Payment Pending

If payment is still pending:

```text
Payment is being confirmed.
Please wait...
```

Do not immediately mark the order as unpaid if the provider has not returned a final state.

The backend remains authoritative.

---

# 22. Payment Cancellation

If the user cancels the online payment:

```text
Payment cancelled
```

Return the user to the payment method selection state where appropriate.

Preserve:

- Order
- Documents
- Configuration
- Price

Do not force the user back to Screen 01.

---

# 23. Cash Selection Flow

If the user selects Cash at Shop:

```text
Select Cash
      ↓
Confirm cash payment method
      ↓
Backend records payment mode as cash pending
      ↓
Order submitted
      ↓
Screen 05
```

The order should enter a state that clearly means:

```text
Payment due at shop
```

Do not mark the order as `PAID`.

---

# 24. Cash Payment State

Conceptually:

```text
CASH_PENDING
```

The customer-facing status should be understandable:

```text
Pay at the shop when you collect your prints.
```

When the shop later records the cash payment, the backend can transition the payment state to paid.

---

# 25. Primary CTA

The primary CTA must change based on the selected payment method and state.

Examples:

Online:

```text
Pay ₹XX
```

Cash:

```text
Continue with Cash
```

However, the exact label should come from the approved product copy.

Do not hardcode the amount inside the button.

Use a reusable button component and dynamically render the formatted amount.

---

# 26. CTA States

The primary CTA should support:

```text
Enabled
Disabled
Loading
Success
Error
```

Examples:

```text
Pay ₹XX
Processing...
Payment successful
Try again
```

Do not allow multiple simultaneous payment initiation requests.

---

# 27. Payment Amount Validation

Before initiating online payment:

```text
Client order draft
        ↓
Backend validation
        ↓
Authoritative payable amount
        ↓
Payment initiation
```

The client must never be able to modify the amount sent to the payment provider.

The server must calculate or verify the amount.

---

# 28. Price Change Before Payment

A price can potentially change between Screen 03 and Screen 04.

If this happens:

```text
Old amount
    ↓
Backend validation
    ↓
New amount
```

Show:

```text
Your order price has been updated.
Please review the new amount before paying.
```

Do not silently charge the new amount.

If the product requires returning to Screen 03 for review, do so.

---

# 29. Order State Dependency

The payment screen must ensure the order is in a payable state.

Conceptually:

```text
REVIEWED
    ↓
PAYMENT_PENDING
```

The user should not be able to initiate payment for:

```text
COMPLETED
CANCELLED
SHOP_REJECTED
PRINT_FAILED
```

or another non-payable state.

The backend must enforce this even if the frontend is bypassed.

---

# 30. Order Submission

Payment and order submission must be handled safely.

For online payment:

```text
Payment verified
        ↓
Order submitted/confirmed
```

For cash:

```text
Cash method selected
        ↓
Order submitted
        ↓
Cash pending
```

Use idempotency to prevent duplicate orders.

---

# 31. Duplicate Submission Protection

Protect against:

- Double tapping the CTA.
- Rapid repeated taps.
- Browser refresh.
- Network retries.
- Slow payment provider response.
- Back/forward navigation.
- Mobile connection changes.

During an active request:

```text
Button → loading
```

Do not create duplicate payment attempts.

Backend idempotency is required for critical payment/order operations.

---

# 32. Back Navigation

Before payment starts:

```text
Screen 04 → Screen 03
```

After an online payment has been initiated, handle Back carefully.

Do not assume:

```text
Back = payment cancelled
```

A payment may already be pending.

The application should retrieve the latest payment state before allowing another attempt.

---

# 33. Browser Refresh

After refresh:

- Restore the guest session.
- Restore the order.
- Retrieve the latest payment state.
- Do not automatically start another payment.
- Do not lose the order.

If payment is pending, show the pending state.

If payment succeeded, do not ask the user to pay again.

---

# 34. Network Failure

Handle temporary network failures.

Example:

```text
We couldn't connect.
Your payment status may still be processing.

Check payment status
```

Do not immediately assume the payment failed just because the browser lost connectivity.

This is especially important after the user has interacted with an external payment provider.

---

# 35. Payment Provider Redirect/Return

If the provider uses a redirect or external checkout:

```text
CtrlP
 ↓
Payment provider
 ↓
User payment
 ↓
Return to CtrlP
 ↓
Backend verification
```

Do not mark success based solely on URL parameters or client-side state.

The backend must verify the payment.

---

# 36. Security

Never expose:

- Payment provider secret keys
- API secrets
- Private credentials
- Internal payment authorization tokens
- Sensitive payment metadata

Payment provider integration secrets belong on the server.

Do not trust:

- Client supplied amount
- Client supplied payment status
- Client supplied order ownership
- Client supplied shop identity

The backend must validate all critical payment information.

---

# 37. Guest Session Security

The user is a guest.

The payment screen must use the existing guest session securely.

Ensure:

```text
Guest session
    ↓
Order
    ↓
Payment
```

is correctly associated.

Never allow one guest session to initiate payment for another session's order.

Do not expose sequential database IDs as authorization credentials.

---

# 38. Accessibility

Implement:

- Semantic controls.
- Accessible payment method selection.
- Clear selected/unselected states.
- Keyboard navigation.
- Visible focus states.
- Accessible loading messages.
- Accessible error messages.
- Accessible payment status updates.
- Appropriate touch targets.
- Sufficient contrast.

Do not rely only on color to indicate selected payment method.

---

# 39. Responsive Design

Mobile is the primary experience.

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
- Payment cards remain readable.
- Amount remains prominent.
- CTA remains easy to reach.
- Long shop/order information wraps safely.
- Error messages do not break layout.

---

# 40. Tablet

On tablet:

- Use available space without making payment controls excessively wide.
- Keep the payment selection hierarchy clear.
- Preserve comfortable touch targets.
- Maintain the same product language as mobile.

---

# 41. Desktop

On desktop, use a sensible maximum content width.

A possible composition:

```text
┌─────────────────────────────────────────────┐
│ Payment                                     │
│                                             │
│ ┌──────────────────────┐ ┌────────────────┐ │
│ │ Order                │ │ Payment        │ │
│ │ Shop                 │ │ Online         │ │
│ │ Order reference      │ │ Cash           │ │
│ │                      │ │                │ │
│ │                      │ │ Amount         │ │
│ └──────────────────────┘ │ Continue       │ │
│                          └────────────────┘ │
└─────────────────────────────────────────────┘
```

This is a structural suggestion, not a fixed layout requirement.

Mobile remains the source of truth.

---

# 42. Sticky Action Area

A sticky bottom action area may be used on mobile.

If used:

- Show the current amount.
- Keep the primary CTA accessible.
- Respect mobile safe-area insets.
- Add sufficient page bottom padding.
- Do not cover payment method cards.
- Do not cover validation/error messages.
- Handle the mobile keyboard correctly.

---

# 43. Loading States

Provide dedicated loading states for:

### Loading order

```text
Loading payment details...
```

### Initiating payment

```text
Starting secure payment...
```

### Verifying payment

```text
Checking payment status...
```

### Submitting cash order

```text
Confirming your order...
```

Do not show a generic full-screen spinner for every small operation.

---

# 44. Error States

Support recoverable errors.

### Order unavailable

```text
We couldn't load your order.
Try again.
```

### Payment initiation failure

```text
We couldn't start the payment.
Try again.
```

### Payment verification failure

```text
We couldn't confirm your payment yet.
Check payment status.
```

### Payment failure

```text
Payment wasn't completed.
Try again or choose another payment method.
```

### Order submission failure after payment

This is a critical state.

Do not ask the user to pay again automatically.

First reconcile payment and order state with the backend.

Example customer-facing message:

```text
Your payment status is being confirmed.
Please wait while we confirm your order.
```

The backend must resolve the final state.

---

# 45. Payment Success but Order Submission Failure

Treat this as a special case.

Possible sequence:

```text
Payment SUCCESS
        ↓
Order submission fails temporarily
```

Never create a second payment attempt automatically.

Use backend reconciliation/idempotency to ensure:

```text
One successful payment
        +
One corresponding order
```

The UI may show:

```text
Payment received
Confirming your order...
```

until the backend resolves the order.

---

# 46. Component Architecture

Use a modular component structure.

Suggested conceptual structure:

```text
PaymentPage
│
├── PaymentHeader
│
├── PaymentOrderSummary
│   ├── ShopIdentity
│   ├── OrderReference
│   └── AmountDue
│
├── PaymentMethodSelector
│   └── PaymentMethodCard
│
├── PaymentStatusFeedback
│
└── PaymentAction
    └── PaymentButton
```

Adapt to the existing project architecture.

Do not implement the entire screen as one monolithic component.

---

# 47. Payment Method Component

Create a reusable payment method component.

Conceptually:

```text
PaymentMethodCard
```

It should receive data such as:

```text
id
label
description
icon
enabled
selected
```

Do not hardcode method-specific layout repeatedly.

This allows future payment methods to be added without rewriting the selector.

---

# 48. Separate UI From Payment Logic

Do not put payment provider logic directly inside presentation components.

Prefer:

```text
Payment UI
    ↓
Payment hook/application logic
    ↓
Payment service
    ↓
Backend API
    ↓
Payment provider
```

The UI should render state.

Payment orchestration belongs in the application/service layer.

---

# 49. State Management

The payment screen should derive its state from the order and payment state.

Conceptually:

```text
Order
├── id
├── shop
├── pricing
└── documents

Payment
├── availableMethods
├── selectedMethod
├── status
└── providerReference
```

Do not maintain duplicate copies of:

```text
total
order ID
payment amount
```

when they already exist in authoritative order state.

---

# 50. Data Driven Design

The screen must be data driven.

Dynamic values include:

```text
shop
order
amount
currency
payment methods
payment descriptions
payment availability
payment state
```

Use typed interfaces.

Do not use `any` as a shortcut.

If API response structures differ from UI models, use explicit adapters/mappers.

---

# 51. API Boundary

Potential backend operations:

```text
Get order
Validate order
Get payment methods
Create payment
Get payment status
Confirm cash payment method
Submit order
Reconcile payment/order
```

Follow the project's actual backend API architecture.

Validate API responses at the boundary.

Never trust client values for critical financial operations.

---

# 52. Analytics

If analytics are already part of the project, use centralized event constants.

Useful events:

```text
payment_viewed
payment_method_selected
payment_started
payment_succeeded
payment_failed
payment_cancelled
payment_retry_clicked
cash_payment_selected
```

Do not send:

```text
Payment credentials
Sensitive payment data
Private document content
Private document URLs
```

Do not log payment secrets or provider tokens.

---

# 53. Performance

The payment screen should remain lightweight.

Avoid:

- Loading unnecessary document previews.
- Re-fetching the entire order for every interaction.
- Unnecessary component rerenders.
- Large image assets.

Screen 03 already handled detailed document review.

Screen 04 only needs enough order information to establish payment context.

---

# 54. No Extra Features

Do not add:

```text
Coupons
Wallet
Saved cards
Order history
Account creation
Delivery
Address management
Advanced printing settings
Printer controls
```

unless separately approved for the MVP.

---

# 55. Screen 04 Responsibilities

## Screen 04 DOES

```text
Show payment amount
Show order context
Show available payment methods
Allow payment method selection
Initiate online payment
Handle cash payment selection
Handle payment states
Verify payment
Handle failures
Protect against duplicate payment attempts
Continue to Screen 05
```

## Screen 04 DOES NOT

```text
Configure documents
Edit print settings
Manage printers
Send printer commands
Create user accounts
Change the final price
Trust client payment status
```

---

# 56. Payment State Machine

Use a centralized state model.

Conceptually:

```text
NOT_STARTED
     ↓
METHOD_SELECTED
     ↓
INITIATING
     ↓
PENDING
     ↓
SUCCESS
```

Failure paths:

```text
INITIATING → FAILED
PENDING → FAILED
PENDING → VERIFICATION_PENDING
```

Cancellation:

```text
PENDING → CANCELLED
```

Cash:

```text
METHOD_SELECTED
     ↓
CASH_PENDING
     ↓
ORDER_SUBMITTED
```

The exact canonical state names must follow the project's shared domain model.

---

# 57. Price and Payment State Relationship

The payment amount must always correspond to the current validated order.

Conceptually:

```text
Order Draft
     ↓
Validate
     ↓
Authoritative Price
     ↓
Payment
```

Never:

```text
Frontend amount
     ↓
Payment provider
```

without backend validation.

---

# 58. User Experience Goal

The payment screen should make the user feel:

```text
My order is correct
        ↓
I know the exact amount
        ↓
I can choose how to pay
        ↓
My payment is secure
        ↓
I know what happens next
```

Avoid unnecessary complexity.

The ideal experience is:

```text
Review
   ↓
Choose payment
   ↓
Pay / choose cash
   ↓
Track order
```

---

# 59. Definition of Done

## Order

- Correct order is loaded.
- Correct shop is displayed.
- Correct final amount is displayed.
- Order reference is displayed where required.

## Payment methods

- Available methods come from configuration.
- Online payment works.
- Cash at Shop works.
- Unsupported methods are not displayed.
- Selection state is accessible.

## Online payment

- Payment initiation works.
- Backend validates amount.
- Provider integration is isolated from UI.
- Payment status is verified server-side.
- Success is handled.
- Failure is recoverable.
- Pending state is handled.
- Cancellation is handled.
- Retry is safe.

## Cash

- Cash method can be selected.
- Amount due is clear.
- Payment is not marked as paid prematurely.
- Order proceeds with the correct cash-pending state.

## Safety

- Duplicate payment initiation is prevented.
- Duplicate order creation is prevented.
- Refresh does not create another payment.
- Network failures are handled.
- Payment success plus order submission failure is reconciled safely.

## Navigation

- Back works before payment starts.
- Screen 05 is reached only after the appropriate payment/order state is established.
- Order draft is preserved.

## Responsive

- Mobile first.
- Common mobile widths supported.
- Tablet supported.
- Desktop supported.
- No horizontal overflow.
- Sticky actions do not hide content.

## Engineering

- No hardcoded business values.
- Dynamic values are data driven.
- Static identifiers use centralized constants/enums.
- Modular components.
- No monolithic page component.
- No duplicated state.
- No unnecessary `any`.
- UI is separated from payment/business logic.
- API responses are validated.
- Backend remains authoritative for price and payment state.
- Payment secrets remain server side.
- Accessibility requirements are met.
- Existing CtrlP design system is reused.

---

# 60. Final Screen 04 Flow

```text
Screen 03
Review Order
      ↓
Screen 04
Payment
      │
      ├── Order context
      │
      ├── Amount due
      │
      ├── Choose payment method
      │
      ├── Online Payment
      │       ↓
      │   Payment Provider
      │       ↓
      │   Backend Verification
      │
      └── Cash at Shop
              ↓
          Cash Pending
              ↓
      Order Submitted
              ↓
          Screen 05
```

The core principle is:

> **Screen 04 should make payment feel like the final simple step before the user's documents move into the shop's printing workflow.**

Keep the implementation modular, data driven, secure, responsive, accessible, and consistent with the existing CtrlP design system.
