# CtrlP.ai MVP — Print User Web App
## Updated Screen and Feature Specification

**User:** Guest Print User  
**Experience:** Mobile first web app  
**Entry:** Shop specific QR code  
**MVP principle:** Keep the journey short by combining related functionality and treating order progress as states rather than separate screens.

## 1. Final MVP Screen Structure

The Print User MVP has **5 primary screens** and **1 optional nested screen**.

| # | Screen | Type |
|---|---|---|
| 01 | Upload Documents | Primary |
| 02 | Documents + Preview + Print Configuration | Primary |
| 03 | Review Order | Primary |
| 04 | Payment | Primary |
| 05 | Order Status | Primary, stateful |
| 06 | Shop Information | Secondary/nested |

### Primary journey

```text
Scan Shop QR
    ↓
01 Upload Documents
    ↓
02 Documents + Preview + Print Configuration
    ↓
03 Review Order
    ↓
04 Payment
    ↓
05 Order Status
```

### Important consolidation decisions

There is **no separate Documents Added screen**.

Document list, document preview and per document print configuration are all part of Screen 02.

There are **no separate confirmation, printing, ready and completion screens**.

They are states of Screen 05.

Shop Information is not part of the mandatory journey. It is opened from Screen 01 when the user wants more information.

---

# 2. Mobile First Requirement

The user normally reaches the app immediately after scanning a QR code with a phone.

Therefore:

- Mobile viewport is the primary target.
- Touch is the primary interaction model.
- Primary actions must be easy to reach.
- File selection and upload must work naturally on mobile.
- The flow should require minimal typing.
- Important information should not be hidden behind unnecessary navigation.
- Desktop responsiveness is secondary to the mobile experience.

---

# 3. Screen 01 — Upload Documents

## Purpose

Immediately let the guest user start the printing process after scanning the shop QR.

The main purpose of this screen is document upload.

## Features

### Shop context

- Resolve the shop from the QR code.
- Associate the shop with the guest session.
- Provide a small **Shop Info** action leading to Screen 06.
- Do not make shop details the primary content.

### Upload

- Upload one or multiple files.
- Add files from the device.
- Show upload progress.
- Show successful uploads.
- Show failed uploads.
- Retry failed uploads.
- Continue when required uploads are valid.

### MVP supported formats

- PDF
- JPG/JPEG
- PNG
- DOC
- DOCX
- PPT
- PPTX

The backend is authoritative for supported formats and limits.

### Upload validation

- File type/MIME type
- File size
- Maximum file count
- File integrity
- Password protected documents
- Page count
- Rendering/processing compatibility

### Error behavior

A failed file must not remove successfully uploaded files.

Example:

```text
Resume.pdf       Uploaded
Marksheet.pdf    Upload failed   [Retry]
Photo.jpg        Uploaded
```

## Not on this screen

- Per document print settings
- Payment
- Final order submission

---

# 4. Screen 02 — Documents + Preview + Print Configuration

## Purpose

This screen combines the previously proposed Document Added and Print Configuration screens.

The user can select a document, preview it and configure its printing without moving to another screen.

This is the main configuration screen of the MVP.

## Document selector

Features:

- Show all uploaded documents.
- Select the document being configured.
- Show document position, such as `1/3`.
- Indicate configured/not configured status.
- Add more files.

## Document information

For the selected document show:

- File name
- Number of pages
- File size where useful
- Validation/processing state

## Document preview

Features:

- Preview selected document.
- Navigate pages where applicable.
- Keep the preview clearly associated with the selected document.

## Print configuration

Each document has its own configuration.

### Color

- Black & White
- Color

### Copies

- Increase/decrease quantity.
- Minimum quantity: 1.
- Maximum quantity controlled by backend/product rules.

### Paper size

MVP:

- A4

Only options enabled by the shop should be displayed.

### Page selection

- All pages
- Selected pages

Selected pages can use expressions such as:

```text
1,3,5-8
```

The selection must be validated against the document page count.

## Apply to all files

Provide:

**Apply this setting to all files**

This copies the current configuration to all uploaded documents.

The user can still select any individual document and change its configuration afterward.

## Configuration completion

Every uploaded document must have a valid configuration before proceeding.

Possible states:

```text
Not configured
Configured
Configuration error
```

## Explicitly excluded from MVP

Do not show:

- Single/double sided
- Pages per sheet
- Orientation
- Scaling
- Collation
- Binding
- Stapling
- Lamination
- Special instructions
- Free form printing instructions

---

# 5. Screen 03 — Review Order

## Purpose

Final safety checkpoint before payment.

The user must be able to verify exactly what will be ordered.

## Features

Show:

- Shop identity
- Every document
- Filename
- Page count or selected pages
- B&W/Color
- Copies
- A4
- Item price
- Total documents
- Total selected/print pages
- Total copies
- Applicable fees/taxes if configured
- Final payable amount

Example:

```text
Resume.pdf
B&W · A4 · 1 copy
3 pages
₹6

Marksheet.pdf
Color · A4 · 2 copies
Pages 1,2,4
₹40

Total
₹46
```

### Edit

The user can return to Screen 02 and change document configuration.

### Price authority

The backend calculated price is authoritative.

The frontend must never be trusted as the final source of the payable amount.

## Primary action

**Continue to Payment**

---

# 6. Screen 04 — Payment

## Purpose

Allow the user to choose how the order will be paid.

## Payment methods

### Online payment

Configured online payment provider, with UPI as the primary target for the MVP.

### Cash at Shop

User pays when collecting the printed documents.

Only payment methods enabled by the shop/platform should be displayed.

## Features

- Total amount
- Payment method selection
- Online payment initiation
- Cash selection
- Payment status
- Error handling
- Safe retry

## Online payment states

```text
Not started
↓
Initiated
↓
Processing
↓
Successful
```

Failure:

```text
Failed
```

Possible verification state:

```text
Pending verification
```

Payment provider webhook/server verification is authoritative. A client callback alone must never mark an order as paid.

## Cash

Show clearly:

```text
Pay at Shop
Amount due: ₹XX
Pay when collecting your prints
```

---

# 7. Screen 05 — Order Status

## Purpose

One persistent screen for the complete post submission lifecycle.

The following are **states of this screen**, not separate screens:

- Order Placed
- Shop Accepted
- Printing
- Ready for Pickup
- Completed
- Relevant failure states

## State A — Order Placed

Show:

- Order ID
- Shop
- Total amount
- Payment method
- Payment state
- Progress timeline

```text
✓ Order placed
○ Printing
○ Ready for pickup
○ Completed
```

Message:

> Your order has been sent to the shop.

## State B — Shop Accepted / Printing

```text
✓ Order placed
✓ Shop accepted
● Printing
○ Ready for pickup
○ Completed
```

Message:

> Your documents are being printed.

## State C — Ready for Pickup

```text
✓ Order placed
✓ Shop accepted
✓ Printing
● Ready for pickup
○ Completed
```

Message:

> Your order is ready. You can collect your prints from the shop.

For cash orders:

```text
Payment due at shop: ₹XX
```

For online orders:

```text
Payment: Paid
```

## State D — Completed

```text
✓ Order placed
✓ Shop accepted
✓ Printing
✓ Ready for pickup
✓ Completed
```

Show:

- Order ID
- Final amount
- Payment method
- Completion status
- Completion time where available

## Failure states

The same screen can represent:

- Shop rejected
- Print failed
- Cancelled
- Refund pending
- Payment verification pending where relevant

Customer facing printer errors should be understandable and should not expose unnecessary technical details.

Example:

> There was a problem while printing your order. The shop is handling it.

## Realtime

Preferred:

- WebSockets

Fallback:

- Polling/re-fetching

The backend order state is authoritative.

The frontend must handle reconnects, missed events, refreshes and stale data.

---

# 8. Screen 06 — Shop Information

## Purpose

Optional secondary screen opened from Screen 01.

It is not required to place an order.

## Possible information

- Shop name
- Address
- Open/closed status
- Opening/closing time
- Estimated processing time
- Available services
- Supported printing options

The backend controls which information is available.

## UX rule

The user must never need to open this screen to complete an order.

---

# 9. Feature Distribution

| Feature | Screen |
|---|---|
| QR shop context | 01 |
| Guest session | 01 → 05 |
| Upload files | 01 |
| Multiple upload | 01 |
| Upload validation | 01 |
| Upload progress | 01 |
| File name | 02 |
| Page count | 02 |
| File size | 02 |
| Document preview | 02 |
| Add files | 01, 02 |
| Remove document | 02 |
| Document selector | 02 |
| Per document configuration | 02 |
| Copies | 02 |
| B&W / Color | 02 |
| A4 | 02 |
| Page selection | 02 |
| Apply setting to all | 02 |
| Price calculation | 02 → 03 |
| Order summary | 03 |
| Final review | 03 |
| Edit configuration | 03 → 02 |
| Online payment | 04 |
| Cash at shop | 04 |
| Payment verification | 04 |
| Order submission | 04 → 05 |
| Order ID | 05 |
| Order confirmation | 05, Order Placed state |
| Shop accepted | 05 |
| Printing | 05 |
| Ready for pickup | 05 |
| Completed | 05 |
| Failure states | 04, 05 |
| Shop information | 06 |

---

# 10. Guest Session

No account creation or login is required.

The guest session associates:

- Shop
- Guest session ID
- Active order
- Uploaded documents
- Document configurations
- Payment state
- Order ID after submission

Use an opaque, unpredictable session identifier. Do not rely on exposed sequential database IDs for authorization.

Where technically feasible, refresh/reload should restore:

- Guest session
- Active order
- Uploaded document metadata
- Configurations
- Current workflow step

Guest session expiration is a backend policy and must be handled gracefully.

---

# 11. Order State Model

The canonical state must be shared between frontend and backend.

Conceptual states:

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

The canonical enums should live in a shared domain package.

---

# 12. Backend Dependencies

The frontend requires contracts for:

### Shop

- QR/shop lookup
- Active/inactive state
- Capabilities
- Pricing
- Payment methods

### Guest session

- Create
- Retrieve
- Expire

### Documents

- Upload initialization
- Object storage upload
- Processing status
- Page count
- Validation
- Preview access
- Delete

### Print configuration

- Color mode
- Copies
- Paper size
- Page selection

### Pricing

- Calculate/validate price
- Item breakdown
- Currency
- Fees/taxes if applicable

### Payment

- Create payment
- Payment status
- Verification
- Webhook result
- Retry/idempotency

### Order

- Retrieve
- Submit
- Status
- Failure/rejection state

### Realtime

- WebSocket authentication
- Order status events
- Reconnection
- Fallback fetching

---

# 13. Printer Integration Dependency

Printer integration is a **Day 0 MVP capability on the Shop Partner side**.

The Print User web app does not directly communicate with a physical printer.

```text
Print User Web App
        ↓
CtrlP.ai Backend
        ↓
Structured Print Order
        ↓
Shop Partner Application
        ↓
Print Agent
        ↓
Windows Printing Subsystem
        ↓
Physical Printer
```

The Print User depends on reliable status updates such as:

- Submitted
- Shop accepted
- Print queued
- Printing
- Ready
- Print failed
- Completed

Technical printer details should remain hidden from the customer.

---

# 14. Document Privacy

Privacy is a Day 0 requirement.

The frontend must never expose public document URLs.

Requirements:

- HTTPS/TLS
- Encrypted object storage
- Controlled document access
- Short lived/signed URLs where appropriate
- Authorization checks
- Access logging
- Upload limits
- File validation/scanning where applicable
- Automatic deletion after configured retention period
- No document contents in analytics/logs

Document names may also contain personal information and should be handled carefully.

---

# 15. Technology Context

### Web

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
- S3 compatible object storage
- WebSockets

### Monorepo

- pnpm
- Turborepo

### Shop print system

- Tauri 2
- React
- TypeScript
- Rust
- Windows printing subsystem

---

# 16. Engineering Rules

The backend is authoritative for:

- Final price
- Payment success
- Shop capabilities
- Document authorization
- Order state
- Print state

The frontend is responsible for UX validation and presentation, not security authority.

Print requirements must be structured data, not natural language.

Conceptual configuration:

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

Use shared TypeScript domain types and Zod validation at application/API boundaries.

---

# 17. Out of Scope for MVP

### Printing

- Double sided
- Pages per sheet
- Orientation
- Scaling
- Collation
- Advanced layout

### Finishing

- Binding
- Stapling
- Lamination

### Instructions

- Special instructions
- Free form print instructions

### User account

- Registration
- Login
- Profile
- Order history
- Reordering
- Saved preferences

### Platform expansion

- Marketplace
- Home delivery
- College network
- B2B printing
- Print API
- Loyalty
- Promotions

---

# 18. Final MVP Screen Definition

## Primary

**01. Upload Documents**

Upload and validate one or more files.

**02. Documents + Preview + Print Configuration**

Select documents, preview the selected document and configure each document.

**03. Review Order**

Review every configuration and the authoritative calculated price.

**04. Payment**

Choose online payment or cash at shop.

**05. Order Status**

One stateful screen covering:

```text
Order Placed
↓
Shop Accepted
↓
Printing
↓
Ready for Pickup
↓
Completed
```

Relevant payment, rejection, print failure, cancellation and refund states are also represented here.

## Secondary

**06. Shop Information**

Optional nested information screen.

---

# 19. Definition of Done

A guest user must be able to:

```text
Scan shop QR
    ↓
Upload multiple supported documents
    ↓
See validation and document information
    ↓
Preview documents
    ↓
Configure each document
    ↓
Select B&W or Color
    ↓
Select copies
    ↓
Select A4
    ↓
Select all or specific pages
    ↓
Apply settings to all files when desired
    ↓
See calculated price
    ↓
Review order
    ↓
Choose online payment or cash at shop
    ↓
Submit order
    ↓
Receive order ID
    ↓
Track Placed → Printing → Ready → Completed
```

The resulting structured order must reach the Shop Partner system so that the Day 0 printer integration can execute the print job and return reliable status to the guest user.
