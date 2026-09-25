# CtrlP.ai MVP — Print User Web App
## Developer Requirements & Dependency Specification

**Document status:** MVP implementation specification  
**Audience:** Frontend, backend, platform, payment, and QA engineers  
**Primary client:** Mobile-first web app  
**User type:** Guest Print User  
**Authentication model:** No account creation or login  
**Entry point:** Shop-specific QR code

---

## 1. Purpose

CtrlP.ai lets a customer at a participating print/Xerox shop scan the shop's QR code, upload one or more documents, configure the required printing options, review the calculated price, choose online or cash payment, submit the order, and track its status until the documents are ready.

The Print User experience must replace the unstructured WhatsApp workflow with a structured print-order workflow.

The user should not need to communicate printing instructions manually to the shop. The selected options must become structured order data that the shop system and print execution system can consume.

---

## 2. MVP Scope

### Included

1. Shop-specific QR entry
2. Guest session
3. Shop context resolution from QR
4. Multiple document upload
5. Supported file validation
6. File upload progress
7. Page count detection
8. File size display
9. Document preview
10. Document removal
11. Per-document print configuration
12. Black & white or color
13. Copy quantity
14. A4 paper size
15. Page selection
16. Dynamic price calculation
17. Order summary
18. Order review
19. Online payment
20. Cash-at-shop payment
21. Order submission
22. Order confirmation
23. Order status tracking
24. Realtime status updates where available
25. Error and failure states
26. Privacy-conscious document lifecycle

### Explicitly excluded from MVP

1. User account creation
2. User login
3. User profile
4. Order history
5. Reordering
6. Double-sided printing
7. Pages per sheet
8. Orientation selection
9. Scaling controls
10. Collation
11. Binding
12. Stapling
13. Lamination
14. Special instructions
15. Free-form printing instructions
16. Marketplace/shop discovery
17. Home delivery
18. Saved printing preferences
19. Loyalty
20. Promotions
21. Advanced print services

These may be introduced after MVP.

---

# 3. Technology Context

The Print User web app is part of a larger CtrlP.ai system.

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zod

### Backend

- Next.js
- TypeScript
- PostgreSQL
- Drizzle ORM
- Redis
- BullMQ
- S3-compatible object storage
- WebSockets

### Monorepo

- pnpm
- Turborepo

### Shop print execution

The shop-side system uses:

- Tauri 2
- React
- TypeScript
- Rust
- Windows printing subsystem

The Print User web app does not directly communicate with the physical printer.

The Print User creates a structured print order. The backend and shop-side print system are responsible for execution.

---

# 4. Core User Journey

The complete MVP journey is:

```text
Scan Shop QR
    ↓
Upload Documents
    ↓
Review Uploaded Documents
    ↓
Configure Documents
    ↓
Review Order
    ↓
Choose Payment
    ↓
Payment / Cash Selection
    ↓
Submit Order
    ↓
Order Confirmation
    ↓
Track Order
    ↓
Ready for Pickup
```

The experience must be mobile-first because the majority of users are expected to scan the QR code from a phone.

---

# 5. Screen Inventory

The MVP contains the following primary screens:

| # | Screen | Purpose |
|---|---|---|
| 01 | Shop Entry / Upload | Immediately start document upload after QR scan |
| 02 | Document Upload | Add one or multiple documents |
| 03 | Document List | Review uploaded files |
| 04 | Document Configuration | Configure printing for each document |
| 05 | Order Summary | See all configured documents and calculated price |
| 06 | Order Review | Final verification before payment/order submission |
| 07 | Payment Selection | Select online payment or cash at shop |
| 08 | Online Payment | Complete online payment |
| 09 | Order Confirmation | Confirm that the order was successfully submitted |
| 10 | Order Tracking | Track order and print status |

Some screens may be implemented as route-level screens while others may be modal/sheet states on mobile. The logical separation should remain clear even if the final UI combines some steps.

---

# 6. Global UX Rules

### Guest experience

The user must never be required to create an account.

A temporary guest session must identify the current order and allow the user to continue through the flow.

### Shop context

The shop is determined by the QR code.

The shop identifier must remain associated with the guest session and order.

### Back navigation

The user can go backward before final order submission.

Going backward must not silently discard uploaded files or configurations.

### Refresh/reload

Where technically feasible, the current guest order should survive an accidental page refresh.

The client should restore the active guest session and current order state.

### Expiration

Guest sessions and incomplete orders should have a server-defined expiration policy.

The frontend must handle an expired session gracefully and ask the user to start a new order.

### No hidden assumptions

The UI must display only printing options supported by the MVP and the shop configuration.

---

# 7. Screen 01 — Shop Entry / Upload

## Purpose

This is the landing point after scanning the shop QR.

The user should immediately be presented with the ability to upload documents.

Do not make shop information the primary content.

### Primary UI

- Upload Documents CTA
- Drag/drop support where relevant, primarily for desktop
- Supported file format information
- Optional shop information entry point

### Shop information

Shop details may be accessible through an info control.

The primary screen does not need to prominently display:

- full location
- operating hours
- estimated processing time
- complete service list

These are secondary information.

### Dependencies

- Valid shop QR token/identifier
- Shop lookup API
- Active shop status
- Shop configuration

### Required behavior

If the QR refers to an invalid shop:

Show an error explaining that the shop link is invalid.

If the shop is inactive:

Do not allow order creation.

If the shop is temporarily unavailable:

Show the configured availability message and prevent or appropriately restrict new orders according to backend policy.

---

# 8. Screen 02 — Document Upload

## Purpose

Allow the guest user to upload one or more printable documents.

### Supported MVP formats

- PDF
- JPG/JPEG
- PNG
- DOC
- DOCX
- PPT
- PPTX

The backend should remain authoritative about accepted formats.

### UI

- Upload button
- File picker
- Multiple file selection
- Upload progress
- Upload success/failure state
- Add another document
- Continue

### Per-file information

After upload, each file should expose:

- File name
- File size
- Page count
- Preview
- Remove

### Validation

Validation must occur both client-side and server-side.

Client-side validation is for immediate UX.

Server-side validation is authoritative.

### Validate

- File extension/type
- MIME type where available
- Maximum file size
- Maximum number of files
- File integrity
- PDF password protection
- Page count
- Rendering compatibility

Maximum values must be configurable rather than hardcoded into UI assumptions.

### Upload failure

A failed file must not invalidate successfully uploaded files.

Example:

```text
Resume.pdf       Uploaded
Marksheet.pdf    Upload failed [Retry]
Photo.jpg        Uploaded
```

### Dependencies

- Guest session
- Object storage
- Upload API
- File validation service
- Document processing service

---

# 9. Screen 03 — Document List

## Purpose

Give the user a clear view of all uploaded files before configuration.

### Document card

Each card should contain:

- Filename
- Page count
- File size
- Preview action
- Remove action
- Configure action/status

Example:

```text
Resume.pdf
3 pages · 1.2 MB

[Preview] [Configure]
```

### Multiple documents

The user can configure each document independently.

The system must not assume that one configuration applies to all documents.

### Completion rule

The user can continue only when all uploaded documents have valid configurations.

If a document is not configured, show a clear state such as:

`Configuration required`

---

# 10. Screen 04 — Document Configuration

## Purpose

Configure how each document should be printed.

This is the central Print User MVP screen.

Each uploaded document has its own configuration.

## MVP options

### Color

- Black & White
- Color

One must be selected.

### Copies

- Integer quantity
- Minimum quantity: 1
- Maximum quantity must be configurable

### Paper size

MVP default:

- A4

If the backend later supports additional MVP paper sizes, the frontend should render only those enabled for the shop.

### Page selection

Options:

- All pages
- Selected pages

For selected pages, support page expressions such as:

```text
1,3,5-8
```

The frontend must validate the expression against the document's page count.

Invalid examples:

- 0
- Negative pages
- Page numbers greater than total pages
- Malformed ranges

### Configuration example

```text
Resume.pdf
3 pages

Color
○ Black & White
● Color

Copies
− 1 +

Paper
● A4

Pages
● All pages
○ Selected pages
```

### Explicitly not present

Do not show:

- Single/double sided
- Pages per sheet
- Orientation
- Scaling
- Collation
- Binding
- Stapling
- Special instructions

---

# 11. Document Configuration Data

The frontend should submit structured configuration rather than natural-language instructions.

Example conceptual payload:

```json
{
  "documentId": "doc_123",
  "colorMode": "color",
  "copies": 2,
  "paperSize": "A4",
  "pageSelection": {
    "mode": "selected",
    "pages": [1, 3, 5, 6]
  }
}
```

The backend must remain authoritative for valid enum values and limits.

Zod should be used to validate API payloads at the application boundary.

---

# 12. Screen 05 — Order Summary

## Purpose

Show the user the complete configured order and current price.

### Display

For each document:

- Filename
- Page count
- Selected pages
- Color mode
- Copies
- Paper size
- Calculated item price

### Example

```text
Resume.pdf
3 pages
Color · 1 copy · A4
₹30

Marksheet.pdf
3 selected pages
B&W · 2 copies · A4
₹12

----------------

Total
₹42
```

### Pricing

The client must not calculate the authoritative final price independently.

The backend pricing service must calculate or validate the final amount.

The client may display an estimated/intermediate calculation for responsiveness, but the server response is authoritative.

---

# 13. Pricing Dependencies

Pricing depends on the selected shop.

Conceptually:

```text
Shop
 ↓
Shop pricing configuration
 ↓
Pricing engine
 ↓
Order item prices
 ↓
Order total
```

The pricing API should return enough information for the frontend to explain the amount.

Example conceptual response:

```json
{
  "currency": "INR",
  "items": [
    {
      "documentId": "doc_123",
      "amount": 30
    }
  ],
  "subtotal": 42,
  "total": 42
}
```

Any tax, platform fee, payment fee, or other charge must be explicitly returned by the backend rather than inferred by the frontend.

---

# 14. Screen 06 — Order Review

## Purpose

Final safety checkpoint before payment/order submission.

The user must be able to verify exactly what will be sent to the shop.

### Display

- Shop identity
- Documents
- Printing configurations
- Total amount
- Payment choice if already selected

### User actions

- Edit document
- Change configuration
- Continue to payment

### Important rule

No irreversible print execution should happen from this screen.

Submitting the order must create a controlled backend order state.

---

# 15. Screen 07 — Payment Selection

## Purpose

Let the user choose the payment method.

### Options

#### Online Payment

Pay before the shop processes the order.

#### Cash at Shop

Pay when collecting the printed documents.

### Online

Show:

`Pay ₹42 online`

### Cash

Show:

`Pay ₹42 at the shop`

The exact cash workflow is controlled by backend/shop policy.

### Dependency

The payment options must come from backend configuration where possible.

If a shop does not support a payment method, it should not be displayed.

---

# 16. Screen 08 — Online Payment

## Purpose

Complete online payment.

The application must not assume that opening a payment interface means payment succeeded.

### Payment states

```text
Payment initiated
↓
Processing
↓
Success
```

Failure:

```text
Payment initiated
↓
Failed
```

Possible additional state:

```text
Payment initiated
↓
Pending verification
```

### Critical rule

The backend payment provider webhook/server verification is authoritative.

The client must never mark an order as paid solely because a frontend callback says success.

### On success

The frontend retrieves the authoritative order/payment state and moves to confirmation.

### On failure

The user should be allowed to retry without accidentally creating duplicate orders or charges.

---

# 17. Screen 09 — Order Confirmation

## Purpose

Confirm successful order creation.

### Display

- Order ID
- Shop
- Documents
- Total
- Payment status
- Current order status
- Pickup instruction

Example:

```text
Order submitted

#PK10482

Payment
Paid online

Status
Waiting for shop confirmation

[Track Order]
```

For cash:

```text
Payment
Pay at shop
```

### Important

The order ID must be generated by the backend.

Do not use a client-generated order ID as the authoritative identifier.

---

# 18. Screen 10 — Order Tracking

## Purpose

Allow a guest user to track the order without creating an account.

### MVP status timeline

```text
✓ Order submitted

✓ Shop accepted

● Printing

○ Ready for pickup

○ Completed
```

Possible failure states:

```text
Order rejected
Print failed
Order cancelled
Payment failed
Refund pending
```

### Realtime updates

WebSockets should be used where practical.

The frontend should also support fallback polling/re-fetching.

The UI must always reconcile with the authoritative backend order state.

### Example

When shop accepts:

```text
Order submitted
✓ Shop accepted
● Printing
```

When printing completes:

```text
Order submitted
✓ Shop accepted
✓ Printing
✓ Ready for pickup
```

---

# 19. Order State Model

The frontend should understand the backend order state machine.

Recommended conceptual states:

```text
CREATED
DOCUMENTS_UPLOADED
CONFIGURED
REVIEWED
PAYMENT_PENDING
PAID
CASH_PENDING
SUBMITTED
SHOP_ACCEPTED
PRINT_QUEUED
PRINTING
READY
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

The exact canonical enum should be defined centrally in the shared domain package so frontend and backend do not maintain different state definitions.

---

# 20. Guest Session Requirements

Because users do not create accounts, guest session management is critical.

### Session should associate

- Shop
- Guest session ID
- Active order
- Uploaded documents
- Configurations
- Payment state
- Order ID after submission

### Session security

The guest identifier must not provide unrestricted access to other orders.

Use an opaque, unpredictable session/order access token.

Do not expose sequential database IDs as the only authorization mechanism.

### Recovery

If a user refreshes the page:

1. Restore the guest session.
2. Retrieve the active order.
3. Restore the current workflow state.
4. Restore document metadata.
5. Continue from the appropriate screen.

### Post-submission

The user should be able to access tracking for the current order through the guest session/order access mechanism.

---

# 21. Document Storage Lifecycle

Documents are sensitive and privacy must be considered from Day 0.

### Lifecycle

```text
Upload
 ↓
Encrypted object storage
 ↓
Validation/processing
 ↓
Print job preparation
 ↓
Shop print execution
 ↓
Order completion
 ↓
Configured retention period
 ↓
Automatic deletion
```

### Requirements

- TLS for network communication
- Encryption at rest
- Restricted object access
- Short-lived/signed access URLs
- Per-shop authorization
- No public document URLs
- Access logging
- Secure service-to-service authorization
- Malware/file scanning where applicable
- Maximum upload limits
- Automatic deletion according to configured retention policy

The retention period must be a product/backend configuration, not a frontend constant.

---

# 22. Shop Dependency

The Print User web app depends on the selected shop being configured in the platform.

Required shop data includes, at minimum:

- Shop ID
- Shop display name
- Active/inactive state
- Supported file formats
- Supported print options
- Pricing configuration
- Payment methods
- Operational availability

The frontend should not hardcode individual shop capabilities.

---

# 23. Printer Integration Dependency

The Print User app does not directly control a printer.

The workflow is:

```text
Print User Web App
        ↓
Backend
        ↓
Structured Print Order
        ↓
Shop Partner System
        ↓
Print Agent
        ↓
Windows Printing Subsystem
        ↓
Physical Printer
```

The Print User app needs only the resulting order/print status.

Relevant states include:

- Submitted
- Accepted
- Print queued
- Printing
- Ready
- Print failed

If printing fails, the user should receive a meaningful status without exposing unnecessary technical printer details.

Example:

> Printing could not be completed. The shop is handling the issue.

---

# 24. Error and Edge Cases

## Invalid QR

Show:

> This shop link is invalid or no longer available.

Provide a clear restart path.

## Shop unavailable

Do not silently accept a new order if the backend says new orders are unavailable.

## Upload failure

Allow retry without forcing the user to re-upload successful files.

## Unsupported file

Clearly identify the file and reason.

## Corrupted file

Ask the user to replace it.

## Password-protected file

Ask the user to upload an unlocked version.

## Page count failure

Do not allow configuration until page count is known or the backend explicitly supports the file.

## Price calculation failure

Do not allow payment/order submission until the authoritative price is available.

## Price changes

If the price changes after configuration, show the new amount before payment and require the user to confirm.

## Payment failure

Allow retry.

Do not create duplicate orders unnecessarily.

## Payment success but browser closes

When the user returns, retrieve order/payment state from the backend.

## Payment webhook delay

Show a temporary payment verification state rather than incorrectly marking the payment as failed.

## Shop rejection

Show that the shop could not accept the order and provide the configured next step.

## Print failure

Show that printing encountered a problem and that the shop is handling it.

## Network loss

Preserve local UI state where safe and retry/re-fetch when connectivity returns.

---

# 25. Navigation Rules

Recommended flow:

```text
/print/[shopId]

      ↓

/print/[shopId]/documents

      ↓

/print/[shopId]/configure

      ↓

/print/[shopId]/summary

      ↓

/print/[shopId]/review

      ↓

/print/[shopId]/payment

      ↓

/print/[shopId]/payment/process

      ↓

/order/[orderId]/confirmation

      ↓

/order/[orderId]/tracking
```

The exact URL structure may differ, but the logical separation should remain.

The active guest session must be validated on every order-sensitive route.

---

# 26. Backend API Dependencies

The frontend requires APIs conceptually equivalent to:

### Shop

```text
GET /shops/{shopId}
```

Returns shop configuration required for the user flow.

### Guest session

```text
POST /guest-sessions
```

Creates a guest session associated with the shop.

### Upload initialization

```text
POST /guest-sessions/{sessionId}/documents
```

Creates a document upload.

### Document processing

```text
GET /documents/{documentId}
```

Returns processing state, metadata and validation results.

### Document removal

```text
DELETE /documents/{documentId}
```

### Document configuration

```text
PUT /documents/{documentId}/print-configuration
```

### Pricing

```text
POST /orders/{orderId}/price
```

or an equivalent pricing endpoint.

### Order review

```text
GET /orders/{orderId}
```

### Payment creation

```text
POST /orders/{orderId}/payments
```

### Payment status

```text
GET /orders/{orderId}/payment
```

### Order submission

```text
POST /orders/{orderId}/submit
```

### Order status

```text
GET /orders/{orderId}
```

### Realtime

WebSocket subscription for order status changes.

These are interface requirements, not mandates for the exact REST URL design. Engineering can choose the final API convention.

---

# 27. Shared Type Requirements

Because the system uses TypeScript and a monorepo, shared domain types should be centralized.

Recommended shared concepts:

```text
Shop
ShopCapabilities
ShopPricing
GuestSession
Document
DocumentValidation
PrintConfiguration
Order
OrderItem
PriceBreakdown
Payment
OrderStatus
PaymentStatus
PrintStatus
```

Frontend and backend should not independently redefine these enums.

---

# 28. Validation Architecture

Zod should validate:

### Client

- Form input
- Copies
- Page ranges
- Configuration values

### API boundary

- Request payloads
- Query parameters
- Backend responses where appropriate

### Server

The server remains authoritative for:

- Shop capabilities
- Pricing
- Document validity
- Payment state
- Order state
- Authorization

Client validation is a UX layer, not a security boundary.

---

# 29. Acceptance Criteria

## QR entry

- Scanning a valid shop QR opens the Print User flow.
- The correct shop is associated with the guest session.
- Invalid/inactive shop identifiers are handled safely.

## Upload

- Multiple supported files can be uploaded.
- Invalid files are rejected with a useful reason.
- Upload progress is visible.
- Failed files can be retried.
- Successful uploads remain intact when another upload fails.

## Configuration

- Every document can be configured independently.
- B&W/color works.
- Copy quantity works.
- A4 is selectable/confirmed according to shop capability.
- All pages or selected pages can be chosen.
- Invalid page ranges cannot be submitted.

## Pricing

- Price is retrieved/calculated using backend shop pricing.
- User sees the total before payment.
- Backend remains authoritative.

## Review

- All documents and configurations are visible.
- User can edit before submitting.
- No print job is executed merely by opening the review screen.

## Payment

- Online payment can be initiated.
- Payment success is verified server-side.
- Payment failure is recoverable.
- Cash payment is recorded correctly.

## Submission

- Successful submission produces a backend order ID.
- Duplicate submission is prevented.
- The order enters the correct state.

## Tracking

- User can see the current order state.
- Status changes appear without requiring a new account.
- Realtime updates work where available.
- Fallback re-fetch/polling handles missed realtime events.

## Privacy

- Documents are never publicly accessible.
- Unauthorized users cannot retrieve another user's documents.
- Document access uses controlled authorization.
- Automatic deletion follows the configured retention policy.

---

# 30. Non-Functional Requirements

### Mobile first

The primary target is smartphone use after QR scanning.

### Performance

The initial application shell should load quickly on typical mobile networks.

Large document uploads must not block the entire UI.

### Reliability

Upload, payment and order submission must be designed as retryable operations.

Critical operations must be idempotent where appropriate.

### Security

Never trust client-provided:

- Price
- Shop capability
- Payment status
- Order status
- Document authorization
- User identity

### Accessibility

Use semantic HTML, keyboard support where applicable, readable contrast, visible focus states, accessible form labels and appropriate error messaging.

### Observability

Frontend errors and important workflow events should be observable without logging document contents or sensitive payment data.

---

# 31. Analytics Events

MVP analytics should capture funnel behavior without collecting unnecessary document content.

Recommended events:

```text
shop_qr_opened
guest_session_created
upload_started
document_uploaded
document_upload_failed
document_removed
document_previewed
configuration_started
configuration_completed
price_viewed
order_reviewed
payment_method_selected
payment_started
payment_succeeded
payment_failed
order_submitted
order_tracking_viewed
order_ready
order_completed
```

Useful metadata:

- Shop ID
- Session ID
- Order ID after creation
- Timestamp
- Device/platform
- File count
- Total page count where appropriate
- Selected payment method
- Error category

Do not log document contents, document names, payment credentials, or sensitive personal information unless there is a specific approved requirement.

---

# 32. Dependencies Before Frontend Implementation

The frontend team should not begin against undefined backend behavior.

The following contracts should be finalized first:

### Shop contract

- Shop identifier format
- Shop lookup response
- Active/inactive behavior
- Available payment methods
- Supported print capabilities

### Upload contract

- Maximum file size
- Maximum number of files
- Accepted MIME types
- Upload mechanism
- Storage upload flow
- Processing states
- Failure states

### Document contract

- Page count response
- Preview mechanism
- Validation states
- Document deletion behavior

### Print configuration contract

- Color enum
- Copy limits
- Paper size enum
- Page selection representation

### Pricing contract

- Price calculation API
- Currency
- Price breakdown
- Tax/fee representation
- Price validity/versioning

### Payment contract

- Payment provider
- Payment initialization
- Return/callback behavior
- Webhook verification
- Payment states
- Retry/idempotency rules

### Order contract

- Order state machine
- Order ID format
- Submission behavior
- Cancellation/rejection behavior
- Print failure behavior

### Realtime contract

- WebSocket connection/authentication
- Event names
- Payload format
- Reconnection behavior
- Fallback polling interval

---

# 33. Recommended Implementation Order

Build the Print User app in vertical slices rather than building every screen independently.

### Phase 1 — Entry and session

1. QR/shop resolution
2. Guest session
3. Shop capability retrieval

### Phase 2 — Documents

4. Upload
5. Validation
6. Processing
7. Document list
8. Preview
9. Remove

### Phase 3 — Print configuration

10. Per-document configuration
11. Page selection validation
12. Configuration persistence

### Phase 4 — Pricing and review

13. Pricing
14. Summary
15. Review

### Phase 5 — Payment

16. Payment selection
17. Online payment
18. Cash flow
19. Payment verification

### Phase 6 — Order

20. Submission
21. Confirmation
22. Tracking

### Phase 7 — Realtime and failure hardening

23. WebSocket status updates
24. Retry behavior
25. Network recovery
26. Payment recovery
27. Print failure states

### Phase 8 — Privacy and production hardening

28. Access control
29. Document lifecycle
30. Automatic deletion
31. Logging/observability
32. Security testing
33. Load/performance testing

---

# 34. Definition of Done

The Print User MVP is ready when a guest user can:

```text
Scan a shop QR
      ↓
Upload multiple supported documents
      ↓
See validation/page information
      ↓
Preview/remove documents
      ↓
Configure every document
      ↓
Select B&W or Color
      ↓
Select copies
      ↓
Select A4
      ↓
Select all or specific pages
      ↓
Receive authoritative price
      ↓
Review the complete order
      ↓
Pay online OR choose cash at shop
      ↓
Submit successfully
      ↓
Receive an order ID
      ↓
Track the order
      ↓
See when it is ready
```

At the same time, the resulting structured order must be available to the Shop Partner system so that it can be accepted and passed into the Day 0 printer integration.

The Print User app is **not complete** merely because an order reaches the shop dashboard. The end-to-end MVP is complete only when the structured print request can flow through the system and its status can return to the guest user.

---

# 35. Product Principle

The engineering team should use this principle when making implementation decisions:

> **The Print User should describe what they want printed. The system should translate that request into a structured print job. The user should not need to understand the underlying printer technology.**

The user experience should therefore remain simple even though the backend and shop-side print system may be technically complex.

