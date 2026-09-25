# CtrlP.ai Print User Web App
## Screen 03: Review Order
### AI Coding Agent Implementation Instructions

**Project:** CtrlP.ai  
**Screen:** Print User Web App, Screen 03  
**Primary target:** Mobile first  
**Secondary targets:** Tablet and desktop  
**User:** Guest Print User  
**Status:** MVP

## 1. Objective

Implement **Screen 03: Review Order** for the CtrlP.ai Print User web app.

The user reaches this screen after completing document configuration on Screen 02.

The purpose is to give the user one final, clear opportunity to verify exactly what they are ordering and how much it will cost before moving to payment.

The flow is:

```text
Screen 01: Upload Documents
        ↓
Screen 02: Documents + Preview + Print Configuration
        ↓
Screen 03: Review Order
        ↓
Screen 04: Payment
```

This is a review and confirmation screen, not another configuration screen.

---

## 2. Critical Engineering Rules

### Never hardcode business values

Do not hardcode:

- Shop name or address
- File names
- Page counts
- Copies
- Prices
- Fees
- Taxes
- Discounts
- Order totals
- Currency
- Payment methods
- Processing times
- Document counts
- Shop capabilities

Dynamic values must come from typed application state, backend data, or shop configuration.

If mock data is needed before backend integration, keep it in a dedicated mock/data layer. Never place mock business data directly inside JSX or presentation components.

### Use constants correctly

Use centralized constants or enums for genuinely static values such as:

- Route identifiers
- Domain status identifiers
- Payment method identifiers
- Color mode identifiers
- Paper size identifiers
- UI limits
- Analytics event names

Do not put dynamic shop pricing into constants.

For example:

```text
WRONG:
COLOR_PRICE = 10

RIGHT:
shop.pricing.color
```

Use the existing project conventions for constant files and domain enums.

---

## 3. Existing Design System

Before implementation:

1. Inspect the existing CtrlP design system.
2. Reuse the existing typography.
3. Reuse color tokens.
4. Reuse spacing tokens.
5. Reuse border-radius tokens.
6. Reuse shadow tokens.
7. Reuse button components.
8. Reuse icon components.
9. Reuse responsive breakpoints.
10. Reuse existing card/surface primitives.

Do not create a second design system.

Do not add arbitrary hex values, font sizes, radii, shadows, or spacing directly inside the screen.

If a required token does not exist, add it centrally.

---

## 4. Core Screen Features

Screen 03 must provide:

### Shop summary

- Shop identity
- Relevant shop context
- Optional shop information access if already supported by the product

### Order summary

For every document:

- Thumbnail/preview
- File name
- Page count
- Selected pages when applicable
- Number of copies
- Color mode
- Paper size
- Individual price

### Editing

- Edit document configuration
- Return to Screen 02 without losing the order draft

### Pricing

- Print charges
- Applicable fees
- Applicable taxes
- Applicable discounts
- Final payable amount

Only display pricing rows that actually apply.

### Confirmation

- Clear review state
- Continue to Payment CTA

---

## 5. Layout

Use a clean mobile-first vertical layout.

Conceptually:

```text
┌─────────────────────────────────────┐
│  ←       Review Order               │
├─────────────────────────────────────┤
│                                     │
│  Shop                               │
│  Shop Name                          │
│  Shop context                       │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Your Documents                     │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Thumbnail                     │  │
│  │ File name                     │  │
│  │ 4 pages · 2 copies            │  │
│  │ B&W · A4                      │  │
│  │ Pages 1,3-4                   │  │
│  │                         Edit  │  │
│  │                         ₹XX   │  │
│  └───────────────────────────────┘  │
│                                     │
│  Another document                  │
│                                     │
├─────────────────────────────────────┤
│  Price Summary                      │
│                                     │
│  Print charges               ₹XX    │
│  Fees                        ₹XX    │
│  Tax                         ₹XX    │
│  ─────────────────────────────────  │
│  Total                       ₹XX    │
│                                     │
│  ┌───────────────────────────────┐  │
│  │       Continue to Payment     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

This is a structural guide, not a request to reproduce the ASCII layout literally.

Mobile remains the source of truth.

---

## 6. Header

Use the established CtrlP mobile header.

### Back button

Behavior:

```text
Screen 03 → Screen 02
```

Preserve all order data and configuration.

### Title

```text
Review Order
```

Use the existing CtrlP typography.

Do not add unnecessary actions.

---

## 7. Shop Summary

Show enough information for the user to confirm the selected shop.

Possible fields:

- Shop name
- Location/address

Only render fields supplied by the backend/shop configuration.

The section should remain compact because the user already entered through a shop-specific QR code.

---

## 8. Documents Section

Use a reusable document review card for every document.

Conceptual structure:

```text
DocumentReviewCard
├── DocumentThumbnail
├── DocumentIdentity
├── PageSummary
├── PrintConfigurationSummary
├── DocumentPrice
└── EditDocumentButton
```

The card must clearly communicate:

> These are the exact settings that will be used for this document.

---

## 9. Document Thumbnail

Display a small preview/thumbnail when available.

Requirements:

- Preserve aspect ratio.
- Use optimized thumbnail assets.
- Do not load full-resolution documents unnecessarily.
- Provide loading state.
- Provide fallback/error state.

The thumbnail is for recognition, not full document viewing.

---

## 10. File Name

Display the actual file name from document data.

Handle long names safely.

Do not allow:

- Horizontal overflow
- Broken card layout
- Overlapping price/action elements

Use wrapping or controlled truncation.

---

## 11. Page Information

Show the authoritative page count.

Examples:

```text
8 pages
```

For selected pages:

```text
Pages 1, 3, 5-8
```

Do not expose internal arrays or identifiers.

The backend remains authoritative for page metadata.

---

## 12. Copies

Display the configured number of copies.

Example:

```text
2 copies
```

Do not provide the primary copies editor here.

Editing remains on Screen 02.

---

## 13. Color Mode

Display:

```text
B&W
```

or:

```text
Color
```

Use human-readable labels.

Do not display internal identifiers such as `bw`, `mono`, or internal enum names.

---

## 14. Paper Size

Display the configured paper size.

For MVP this is expected to be:

```text
A4
```

Keep the component data driven so future supported sizes can be introduced without rewriting the review component.

---

## 15. Page Selection Summary

If all pages are selected:

```text
All pages
```

If specific pages are selected:

```text
Pages 1, 3, 5-8
```

Use a formatting utility rather than manually constructing strings in JSX.

---

## 16. Per Document Price

Show the authoritative calculated price for each document where appropriate.

Example:

```text
₹24
```

Never trust a price calculated only on the client.

The backend pricing result is authoritative.

---

## 17. Edit Document

Each document should have an Edit action.

Behavior:

```text
Screen 03
   ↓
Edit
   ↓
Screen 02
   ↓
Open/select relevant document
   ↓
User changes configuration
   ↓
Recalculate
   ↓
Return to Screen 03
```

Preserve all other document configurations.

Do not lose the guest session or uploaded files.

After editing, Screen 03 must render the latest order draft rather than an outdated local copy.

---

## 18. Price Summary

Provide a dedicated summary section.

Conceptually:

```text
Print charges
Applicable fees
Applicable taxes
Applicable discounts
--------------------
Total
```

Only show applicable rows.

The final total should have the strongest visual hierarchy in this section.

---

## 19. Pricing Model

Represent pricing as structured data.

Conceptually:

```text
PriceSummary
├── currency
├── printCharges
├── fees[]
├── taxes[]
├── discounts[]
└── total
```

Follow the project's existing domain model if one already exists.

Do not duplicate pricing logic between components.

---

## 20. Pricing Validation

Before proceeding to Payment:

1. Confirm the order draft still exists.
2. Confirm all documents are valid.
3. Confirm every document has valid configuration.
4. Confirm pricing is available.
5. Validate or refresh the price with the backend.
6. Use the latest authoritative amount.

If the price has changed:

```text
Price changed
      ↓
Show updated amount
      ↓
Require review before continuing
```

Never silently send the user to payment with an outdated amount.

---

## 21. Continue to Payment

The primary CTA should clearly indicate the next step.

Preferred label:

```text
Continue to Payment
```

Use the approved product copy if different.

Do not call this button `Pay Now`.

Payment method selection belongs to Screen 04.

---

## 22. Continue Validation

Only proceed when:

```text
At least one valid document exists
AND
Every document has valid configuration
AND
Pricing is available
AND
Order draft is valid
```

If validation fails:

- Keep the user on Screen 03.
- Explain what requires attention.
- Identify the affected document where possible.
- Provide an Edit action.

Do not silently disable the CTA without explaining why.

---

## 23. Order Draft

Screen 03 must consume the same order draft created during the previous steps.

Conceptually:

```text
Guest Session
      ↓
Order Draft
├── Shop
├── Documents
├── Configurations
├── Pricing
└── Metadata
```

Do not create a separate disconnected representation of the order just for this screen.

---

## 24. Guest Session

No login or signup is required.

Do not introduce:

- Account creation
- Login
- Profile
- Order history

The existing guest session must own the current order and document references.

Do not expose internal session IDs to the user.

---

## 25. Navigation

### Back

```text
Screen 03 → Screen 02
```

Preserve all valid work.

### Continue

```text
Screen 03 → Screen 04
```

after backend validation succeeds.

Do not allow accidental duplicate submissions from rapid taps.

---

## 26. Loading States

Implement explicit loading states.

### Loading order

```text
Loading your order...
```

### Validating price

```text
Checking final price...
```

### Updating after edit

Refresh only the necessary data where practical.

Do not blank the entire interface for small updates.

---

## 27. Error States

Implement recoverable errors.

### Order loading failure

```text
We couldn't load your order.

Try again.
```

### Pricing failure

```text
We couldn't confirm the current price.

Try again.
```

### Document failure

Identify the affected document and provide an appropriate recovery action:

```text
Edit
Remove
Retry
```

### Session expiration

Explain that the session has expired and provide the appropriate recovery path.

Never expose stack traces or raw API errors.

---

## 28. Price Change State

Handle the case where the price changes between Screen 02 and Screen 03.

Example:

```text
Screen 02
₹40

        ↓

Backend validation

        ↓

Screen 03
₹44
```

Clearly communicate:

```text
The price was updated.
Please review the new total before continuing.
```

Do not silently alter the payable amount.

---

## 29. Remove Document

Document removal primarily belongs to Screen 02.

Do not make Remove a dominant action on the review screen.

If product requirements later expose Remove here, it must:

1. Require appropriate confirmation.
2. Update the order draft.
3. Recalculate pricing.
4. Update the document list.
5. Prevent proceeding if no valid documents remain.

The default Screen 03 interaction should emphasize:

```text
Review
Edit
Continue
```

---

## 30. Currency Formatting

Do not manually concatenate currency symbols throughout components.

Use a centralized formatting utility.

Conceptually:

```text
formatCurrency(amount, currency, locale)
```

For the current India MVP, INR is expected.

Keep this configurable for future localization.

---

## 31. Responsive Design

Mobile is the primary target.

The screen must work at common mobile widths:

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
- Long file names must wrap/truncate safely.
- Page ranges must remain readable.
- Prices must never overlap actions.
- Touch targets must remain comfortable.
- Bottom actions must not hide content.

Do not simply scale the mobile page to desktop.

---

## 32. Tablet

On tablet:

- Use the additional horizontal space intelligently.
- Maintain readable line lengths.
- Keep document cards visually balanced.
- Preserve the mobile information hierarchy.

Do not stretch content across the entire viewport.

---

## 33. Desktop

Use a sensible maximum content width.

A wider layout may use:

```text
Documents                Price Summary
────────────────────     ──────────────
Document 1               Print charges
Document 2               Fees
Document 3               Taxes
                         Total
                         Continue
```

A two-column layout is acceptable if it improves usability and matches the existing design system.

Do not force a desktop layout if it harms consistency.

---

## 34. Sticky Action Area

A sticky bottom action area may be used on mobile.

If implemented:

- Keep final amount visible.
- Keep Continue CTA accessible.
- Respect safe-area insets.
- Add enough page bottom padding.
- Never cover document content.
- Never cover validation/error messages.
- Handle the mobile keyboard correctly.

---

## 35. Accessibility

Implement:

- Semantic HTML.
- Accessible back button.
- Accessible Edit controls.
- Keyboard navigation.
- Visible focus states.
- Screen reader-friendly document summaries.
- Accessible price labels.
- Accessible status messages.
- Sufficient contrast.
- Appropriate mobile touch targets.

Do not rely only on color to communicate important states.

---

## 36. Component Architecture

Use a modular approach.

Suggested conceptual structure:

```text
ReviewOrderPage
│
├── ReviewOrderHeader
│
├── ShopSummary
│
├── OrderDocuments
│   └── DocumentReviewCard
│       ├── DocumentThumbnail
│       ├── DocumentIdentity
│       ├── PageSummary
│       ├── PrintConfigurationSummary
│       ├── DocumentPrice
│       └── EditDocumentButton
│
├── PriceSummary
│   ├── PrintCharges
│   ├── Fees
│   ├── Taxes
│   ├── Discounts
│   └── Total
│
└── ReviewOrderAction
    └── ContinueToPaymentButton
```

Adapt this to the existing project structure.

Do not build the entire screen as one large React component.

---

## 37. Separate UI From Business Logic

Do not put complex pricing, validation, formatting, or API logic directly into JSX.

Prefer:

```text
UI components
      ↓
Application state/hooks
      ↓
Domain logic
      ↓
API/service layer
```

Centralize reusable logic such as:

```text
validateOrderDraft()
formatPageSelection()
formatCurrency()
refreshOrderPricing()
buildDocumentSummary()
```

Do not duplicate the same logic across multiple components.

---

## 38. State Management

The order draft should be the source of truth.

Derive from it:

- Document summaries
- Page totals
- Configuration summaries
- Individual prices
- Order total
- Validation state

Avoid maintaining manually synchronized duplicate state.

For example, do not separately store a `pageTotal` state if it can be derived from the order draft.

---

## 39. API Boundary

The frontend may need operations such as:

```text
Get order draft
Validate order
Refresh pricing
Get document metadata
```

Follow the project's backend/API architecture.

Validate external data at the boundary.

Never trust client supplied:

```text
Price
Payment state
Shop identity
Document ownership
Page count
Order ownership
```

---

## 40. Idempotency

Protect the transition to Payment against duplicate actions.

Handle:

- Double tap
- Rapid repeated tap
- Network retry
- Browser refresh
- Request timeout

Use backend idempotency mechanisms where required.

Disable or transition the CTA to a loading state while a submission is being processed.

---

## 41. Security and Privacy

Documents may contain sensitive information.

Never:

- Log document contents.
- Send document contents to analytics.
- Expose private storage URLs.
- Put sensitive document information into query parameters.
- Trust client pricing.
- Allow cross-session document access.

Only show document data belonging to the active guest session/order.

---

## 42. Analytics

If analytics are already part of the project, use centralized event constants.

Useful events:

```text
review_order_viewed
review_order_edit_clicked
review_order_price_changed
review_order_continue_clicked
review_order_validation_failed
```

Never include:

```text
Document contents
Document text
Private document URLs
Sensitive personal information
```

---

## 43. Performance

Screen 03 may contain several documents.

Implement:

- Optimized thumbnails.
- Lazy loading where appropriate.
- Minimal API requests.
- Avoid unnecessary rerenders.
- Memoize expensive derived values where useful.
- Avoid loading full documents when thumbnails are sufficient.
- Reuse cached metadata when safe.

Do not introduce premature optimization that makes the implementation difficult to maintain.

---

## 44. Error Recovery

Prefer local recovery.

For example:

```text
Document 2 preview failed
```

should not automatically invalidate the entire order if the document remains otherwise valid.

Likewise:

```text
Price refresh failed
```

should preserve the order draft and provide retry behavior.

Do not make the user restart the entire flow unless absolutely necessary.

---

## 45. Features Explicitly Out of Scope

Do not add:

```text
Coupons
Wishlist
Marketplace
Delivery selection
Saved addresses
Login
Signup
Loyalty
Advanced printing options
Printer selection
Printer controls
```

These do not belong to Screen 03 MVP.

---

## 46. Screen 03 Responsibilities

### Screen 03 DOES

```text
Show shop
Show all documents
Show thumbnails
Show page count
Show selected pages
Show copies
Show color mode
Show paper size
Show individual prices
Show total pricing
Allow editing
Validate the order
Continue to Payment
```

### Screen 03 DOES NOT

```text
Configure documents directly
Process payment
Send printer commands
Manage printer hardware
Create an account
```

Configuration remains on Screen 02.

Payment remains on Screen 04.

Printer integration remains on the Shop Partner side.

---

## 47. UX Goal

The screen must answer:

```text
What am I printing?
How will each document be printed?
How many copies/pages am I ordering?
How much does it cost?
What happens when I continue?
```

The user should never have to guess.

This should feel like a final confirmation screen, not a technical form.

---

## 48. Visual Hierarchy

Recommended hierarchy:

```text
1. Final total
2. Continue to Payment
3. Documents
4. Document configuration summary
5. Individual prices
6. Shop information
7. Secondary metadata
```

The final amount and CTA should be visually prominent.

Do not allow secondary metadata to compete with them.

---

## 49. Definition of Done

### Documents

- Every valid document appears.
- Correct file name appears.
- Correct page count appears.
- Correct thumbnail appears where available.
- Selected pages are represented accurately.
- Copies are accurate.
- Color mode is accurate.
- Paper size is accurate.
- Individual price is accurate.

### Editing

- Edit returns to Screen 02.
- Correct document is selected where practical.
- Existing configuration is preserved.
- Updated configuration appears when returning.
- Price is recalculated.

### Pricing

- Price summary is data driven.
- Backend result is authoritative.
- Currency formatting is centralized.
- Fees/taxes/discounts appear only when applicable.
- Price changes are handled explicitly.

### Navigation

- Back works.
- Continue works.
- Duplicate submission is prevented.
- Order draft is preserved.

### States

- Loading state exists.
- Price validation state exists.
- Error state exists.
- Empty/invalid state exists.
- Session expiration is handled.

### Responsive

- Mobile first.
- Common mobile widths supported.
- Tablet supported.
- Desktop supported.
- No horizontal overflow.
- Sticky actions do not hide content.

### Engineering

- No hardcoded business values.
- Dynamic values are data driven.
- Static identifiers use centralized constants/enums.
- Modular components.
- No monolithic page component.
- No duplicated state.
- No unnecessary `any`.
- API/service logic separated from presentation.
- Validation exists at appropriate boundaries.
- Backend remains authoritative for critical values.
- Accessibility requirements are met.
- Document privacy is maintained.
- Existing CtrlP design system is reused.

---

## 50. Final Screen 03 Flow

```text
Screen 02
Documents configured
        ↓
Screen 03
Review Order
        │
        ├── Shop summary
        │
        ├── Document 1
        │     ├── Thumbnail
        │     ├── Pages
        │     ├── Copies
        │     ├── Color
        │     ├── A4
        │     ├── Selected pages
        │     └── Price
        │
        ├── Document 2
        │     └── ...
        │
        ├── Price Summary
        │
        └── Continue to Payment
                    ↓
                Screen 04
```

The core principle is:

> **Screen 03 should give the guest user complete confidence that the order they are about to pay for is exactly the order they intended to print.**

Keep the implementation modular, data driven, responsive, accessible, secure, and consistent with the existing CtrlP design system.
