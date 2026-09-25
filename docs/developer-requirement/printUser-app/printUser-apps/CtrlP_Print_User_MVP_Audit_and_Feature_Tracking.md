# CtrlP.ai Print User Web App — MVP Feature Audit & Tracking Specification

**Document Purpose:** Complete audit, architectural layering breakdown, feature discrepancy analysis, and tracking checklist for the Guest Print User Web App MVP.  
**Audience:** Product Owner, Lead Engineer, Frontend & Backend Engineers.  
**Authoritative Sources:**
- `docs/developer-requirement /CtrlP_Print_User_MVP_Updated_Screen_Feature_Spec.md`
- `docs/developer-requirement /CtrlP_Print_User_MVP_Developer_Requirements.md`
- `docs/developer-requirement /screens-design-prompt/` (Screens 02 to 06)
- Shared Design System: `docs/design-system/DESIGN copy.md` and `@ctrlp/ui`

---

## 1. Architectural Layers Breakdown

The Print User Web App is engineered with a strict 5-layer architecture to ensure separation of concerns, adherence to the shared design system, and compliance with the rule that the backend is authoritative for security and pricing.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Presentation Layer (Mobile-First UI)                     │
│    • Next.js App Router (Turbopack, React 19, TypeScript)    │
│    • Flat visual language (@ctrlp/ui tokens, no gradients)  │
│    • Fluid responsive layouts (Mobile viewport 360-430px)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. Workflow & State Machine Layer                           │
│    • 5-step primary journey + 1 nested modal flow           │
│    • Custom hooks: useReviewOrder, usePayment, useTracking  │
│    • Safe-back navigation & order draft lifecycle           │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. Domain & Business Logic Layer                            │
│    • Page selection parser (e.g., "1,3,5-8" validation)     │
│    • Pricing engine (BW @ ₹3, Color @ ₹10, Copies)          │
│    • Order lifecycle state machine (SUBMITTED → COMPLETED)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 4. Client Persistence & File Cache Layer                    │
│    • SessionStorage (ctrlp-configured-documents, draft)     │
│    • IndexedDB & Memory Object URLs (file-store.ts)         │
│    • Unpredictable guest session identification             │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 5. Backend Contract & Hardware Bridge Layer                 │
│    • Authoritative price refresh & Zod validation           │
│    • Online UPI & Cash-at-Shop payment verification         │
│    • Realtime WebSocket with polling fallback               │
│    • Windows Print Agent Bridge (Day-0 physical printer)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive Screen-by-Screen Audit

| # | Screen / Route | Planned Spec Features | Implemented State | Modifications / Gap Resolutions |
|---|---|---|---|---|
| **01** | **Upload Documents** (`/`) | • QR shop context<br>• Multi-file upload<br>• Supported formats (.pdf, .jpg, .png, .doc, .docx, .ppt, .pptx)<br>• File validation & size limit<br>• Upload progress & retry<br>• Shop Info trigger | ✅ **100% Complete** | • Added Hero section with live shop open/closed sticker.<br>• Added "We Promise" trust pillar card.<br>• Added FAQ accordion and brand footer.<br>• Added client-side 50MB and extension validation. |
| **02** | **Customize Prints** (`/customize`) | • Document selector & carousel<br>• Canvas PDF/Image preview<br>• Copies stepper<br>• Color mode (B&W vs Color)<br>• Paper size (A4)<br>• Page selection ("all" vs "selected" e.g., `1,3,5-8`)<br>• Apply to all files<br>• *Explicitly exclude orientation/duplex* | ✅ **100% Complete** | • Replaced initial `OrientationSelector` with `PageSelectionControl`.<br>• Connected `parsePageSelection` with validation against page count.<br>• Updated dynamic price & page calculation.<br>• Touch-swipe carousel and real PDF canvas rendering. |
| **03** | **Review Order** (`/review`) | • Shop identity summary<br>• Itemized document review list<br>• Filename & specs display<br>• Thumbnail preview<br>• Copies quick adjustment<br>• Delete item with price update<br>• Authoritative price refresh simulation<br>• Edit document navigation | ✅ **100% Complete** | • Restored document filename to card headline.<br>• Added interactive stepper & delete button directly in review list.<br>• Synchronizes draft with Screen 02 via `selectedId` query parameter.<br>• Simulated authoritative price change banner. |
| **04** | **Payment** (`/payment`) | • Order ID & shop summary<br>• Prominent payable amount<br>• UPI / Online payment<br>• Cash at shop option<br>• Payment states (Pending, Processing, Verified, Failed)<br>• Duplicate payment prevention | ✅ **100% Complete** | • Full state machine simulation with retry.<br>• Clear counter collection messaging for Cash-at-Shop.<br>• Stores submitted order into session storage for tracking.<br>• Full shop address display with MapPin icon (no truncation).<br>• Fixed/sticky mobile footer CTA with safe-area support.<br>• Removed redundant "Amount to pay" from order card to consolidate with footer. |
| **05** | **Order Status** (`/order-status`) | • Unified post-submission lifecycle<br>• States: Order Placed, Shop Accepted, Printing, Ready for Pickup, Completed<br>• Failure states: Rejected, Print Failed, Cancelled<br>• Chronological timeline<br>• Item & bill breakdown<br>• Realtime polling fallback | ✅ **100% Complete** | • Consolidated Screen 05 & 06 prompt requirements into one stateful page.<br>• Added interactive Developer Simulator Bar to test every state transition.<br>• Live polling interval with automatic stop on terminal state. |
| **06** | **Shop Information** (Drawer) | • Nested modal opened from Screen 01<br>• Shop name, address, hours, turnaround, supported services<br>• Non-blocking / optional | ✅ **100% Complete** | • Accessible bottom drawer with ESC key and backdrop click dismiss.<br>• Non-intrusive to the main checkout flow. |

---

## 3. Modifications Made During Building (Executed & Reconciled)

1. **Screen 01 UX Enhancements:**
   - Instead of a bare upload box, the landing page includes a trust-building Hero banner, shop availability indicator ("Printing at XYZ • Open"), "We Promise" guarantees (Zero Privacy Leaks, Instant Pickup, Crisp Prints), and an interactive FAQ accordion.
   - Added a floating bottom order indicator that tracks uploaded file count and triggers the configuration transition.

2. **Screen 02 Scope Alignment (Executed):**
   - **Discrepancy:** The initial implementation included an `OrientationSelector` (Portrait vs Landscape), which was explicitly excluded in Section 6 and Section 17 of the MVP specification. Meanwhile, `PageSelectionControl` was not mounted in the main page.
   - **Resolution:** Replaced `OrientationSelector` with `PageSelectionControl`, wired up `parsePageSelection` and `isPageSelectionValid`, dynamically computed total pages from the selection expression, and enforced that invalid page expressions block proceeding to Review.

3. **Screen 03 Headline Clarity (Executed):**
   - **Discrepancy:** The document review cards replaced the filename with a generic `copies × pages` header.
   - **Resolution:** Displayed the original filename (`document.name`) as the prominent title with the copies, pages, color mode, and selected page ranges as the informative subtitle.

4. **Screen 05 Stateful Consolidation & Testing:**
   - Combined the order received state (Screen 06 prompt) and ongoing tracking states into the unified `/order-status` route.
   - Added a bottom developer testing bar (`TrackingSimulatorBar`) allowing instant manual transition through all 8 lifecycle states (Order Placed, Shop Accepted, Printing, Ready for Pickup, Completed, Rejected, Cancelled, Failed).

---

## 4. Feature Tracking Checklist

### Screen 01: Upload Documents (`/`)
- [x] Scan QR / Shop resolution (defaults to `mockShop`, supports URL parameters).
- [x] Multi-file selection via native mobile file picker and drag-and-drop.
- [x] Client-side MIME validation (.pdf, .jpg, .jpeg, .png, .doc, .docx, .ppt, .pptx).
- [x] File size validation (max 50MB per file with error badge).
- [x] Realistic upload progress simulation with individual file retry and remove.
- [x] Persistent IndexedDB file caching via `file-store.ts`.
- [x] "Shop Info" trigger opening secondary Screen 06 modal.
- [x] Floating bottom bar triggering transition to Screen 02.

### Screen 02: Customize Prints (`/customize`)
- [x] Dynamic document carousel with position indicator (e.g., `1 / 3`).
- [x] Real PDF canvas preview (rendered via pdfjs-dist worker) and image preview.
- [x] Number of copies stepper (minimum 1, max 20).
- [x] Print color selection (Black & White ₹3 vs Color ₹10).
- [x] Fixed paper size indicator (A4).
- [x] Page selection control ("All pages" vs "Selected pages" with expression parsing e.g. `1,3,5-8`).
- [x] Expression validation against total document page count.
- [x] "Apply this setting to all files" action with toast notification.
- [x] Live price and page count calculation in sticky summary bar.
- [x] Add more files action without leaving the customize screen.

### Screen 03: Review Order (`/review`)
- [x] Compact shop summary card with location and order context.
- [x] Itemized document cards showing preview thumbnail, file name, copies, pages, color, and line price.
- [x] Quick stepper to update copies with instant subtotal and total recalculation.
- [x] Document removal with automatic total recalculation.
- [x] Click-to-edit returning to Screen 02 with `selectedId` focused.
- [x] Authoritative price refresh simulation (detects price changes and shows alert banner).
- [x] Empty state handling when all documents are removed.
- [x] Primary "Continue to Payment" CTA.

### Screen 04: Payment (`/payment`)
- [x] Order summary with Order ID, shop name, item count, and copies.
- [x] Prominent payable amount display in INR.
- [x] Payment method selection: "UPI / Online Payment" and "Cash at Shop".
- [x] Clear instructions for Cash-at-Shop ("Pay when you collect your prints at the counter").
- [x] Dynamic payment state machine (Initiated → Processing → Verification → Success / Failed).
- [x] Error handling with safe retry mechanism.
- [x] Prevention of duplicate payment submissions.
- [x] Redirection to Screen 05 with order identifier.

### Screen 05: Order Status & Tracking (`/order-status`)
- [x] Persistent order tracking screen with Order Reference ID and copy-to-clipboard button.
- [x] Chronological vertical progress timeline matching post-submission states:
  - State A: Order received / Waiting for shop
  - State B: Shop accepted
  - State C: Printing in progress
  - State D: Ready for collection (shows pickup instructions and payment due / paid status)
  - State E: Completed
  - Failure states: Shop rejected, Printer failed, Order cancelled
- [x] Itemized document summary with mini thumbnails and specs.
- [x] Bill details breakdown (Total charges, payment method, payment status).
- [x] Shop details accordion with pickup counter instructions.
- [x] Background polling with exponential backoff and automatic stop on terminal state.
- [x] Manual refresh button with animated spinner.
- [x] "New Order" action to restart customer journey.
- [x] Developer Simulator Bar for manual verification of all states.

### Screen 06: Shop Information Drawer
- [x] Triggered from Screen 01 without interrupting the flow.
- [x] Displays shop name, full address, operating hours, turnaround time, supported printing options, and formats.
- [x] Keyboard accessibility (ESC to close) and backdrop tap to dismiss.

---

## 5. Day-0 Backend & Hardware Integration Prerequisites

Before production deployment with physical hardware, the following backend contracts must be bound:

1. **Authoritative Pricing API (`POST /api/orders/calculate-pricing`):**
   - Replace client-side mock pricing in `order-repository.ts` with server-calculated price response.
2. **Object Storage Upload Initiation (`POST /api/documents/upload-intent`):**
   - Provide pre-signed S3/R2 upload URLs for direct client-to-storage uploads.
3. **Payment Gateway Webhook (`POST /api/payments/webhook`):**
   - Handle provider callbacks (Razorpay/Cashfree/PhonePe UPI) to mark order as `PAID`.
4. **WebSocket Status Gateway (`WS /api/orders/:id/tracking`):**
   - Connect `use-order-tracking.ts` to live WebSocket events emitted by the Shop Partner Desktop App.
5. **Shop Partner Agent Bridge:**
   - Transmit structured print job payload (`{ documentUrl, colorMode, copies, paperSize, pages }`) to the Tauri desktop print agent.
