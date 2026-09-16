# CtrlP.ai Print User Web App — MVP Feature Audit & Tracking Specification

**Document Purpose:** Authoritative audit, architectural layering breakdown, feature discrepancy analysis, and tracking checklist for the Guest Print User Web App MVP.  
**Audience:** Product Owner, Lead Engineer, Frontend & Backend Engineers.  
**Authoritative Sources:**
- `docs/developer-requirement /CtrlP_Print_User_MVP_Updated_Screen_Feature_Spec.md`
- `docs/developer-requirement /CtrlP_Print_User_MVP_Developer_Requirements.md`
- `docs/developer-requirement /screens-design-prompt/` (Screens 02 to 06)
- Shared Design System: `docs/design-system/DESIGN copy.md` and `@ctrlp/ui`

---

## 1. Updated MVP Screen Structure & Flow

Based on iterative UX testing and the latest consolidation decisions, the Guest Print User MVP is structured as **4 Primary Screens** and **1 Optional Nested Sheet**.

### Journey Architecture

```text
Scan Shop QR
    ↓
01 Upload Documents (/)
    ↓
02 Documents + Preview + Print Configuration (/customize)
    ↓
03 Review Order & Direct Payment Checkout (/review)
    ↓  (Pay Online / Confirm Order)
04 Order Status & Lifecycle Tracking (/order-status)
```

*(Note: The legacy `/payment` route now automatically redirects to `/review`.)*

| # | Screen / Route | Type | Primary Responsibilities |
|---|---|---|---|
| **01** | **Upload Documents** (`/`) | Primary | Resolve shop QR, multi-file upload, MIME/size validation, upload progress, quick shop info trigger. |
| **02** | **Documents + Preview + Print Configuration** (`/customize`) | Primary | Carousel preview (PDF canvas / images), copies stepper, color mode (B&W/Color), paper size (A4), page selection expressions (`1,3,5-8`), apply-to-all. |
| **03** | **Review Order & Direct Payment Checkout** (`/review`) | Primary | Combined review and payment: itemized document list with live copy adjust/delete, authoritative price breakdown, 2-column payment method selection (UPI vs Cash), sticky checkout CTA. |
| **04** | **Order Status & Lifecycle Tracking** (`/order-status`) | Primary, stateful | Persistent post-submission tracking: Order Received, Shop Accepted, Printing, Ready for Pickup, Completed, and Failure states. |
| **05** | **Shop Information** (Drawer) | Secondary / nested | Optional slide-up drawer opened from Screen 01 with shop address, operating hours, turnaround time, and supported capabilities. |

---

## 2. Architectural Layers Breakdown

The application maintains a strict 5-layer architecture ensuring modularity, data integrity, and compliance with the rule that the backend remains authoritative for pricing and order states.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Presentation Layer (Mobile-First UI)                     │
│    • Next.js App Router (Turbopack, React 19, TypeScript)    │
│    • Flat visual language (@ctrlp/ui tokens, no gradients)  │
│    • Sticky mobile action bars with safe-area insets        │
│    • Fluid responsive layouts (Mobile 360-430px → Desktop)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. Workflow & State Machine Layer                           │
│    • 4-step streamlined journey + 1 nested modal            │
│    • Custom hooks: useReviewOrder, useOrderTracking         │
│    • Safe-back navigation & session draft preservation      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. Domain & Business Logic Layer                            │
│    • Page selection parser & validator (e.g. "1,3,5-8")     │
│    • Authoritative pricing engine (BW @ ₹3, Color @ ₹10)    │
│    • Order lifecycle state machine (SUBMITTED → COMPLETED)  │
│    • Payment state machine (INITIATING → SUCCESS / FAILED)  │
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

## 3. Comprehensive Screen-by-Screen Audit

| # | Screen / Route | Planned Features | Implemented State | Architectural & Design Decisions |
|---|---|---|---|---|
| **01** | **Upload Documents** (`/`) | • QR shop context<br>• Multi-file upload<br>• File format & size validation<br>• Upload progress & retry<br>• Shop info modal trigger | ✅ **100% Complete** | • Hero section with real-time shop status badge ("Printing at XYZ • Open").<br>• "We Promise" trust pillars (Privacy, Speed, Quality).<br>• FAQ accordion and promotional brand footer.<br>• Client-side 50MB file size limit and MIME extension validation with retry badges.<br>• Floating bottom indicator triggering configuration transition. |
| **02** | **Customize Prints** (`/customize`) | • Document selector & carousel<br>• PDF canvas rendering & page nav<br>• Copies stepper (1-20)<br>• B&W vs Color selection<br>• Paper size (A4)<br>• Page selection expressions<br>• Apply to all files | ✅ **100% Complete** | • Replaced initial orientation selector with `PageSelectionControl` per MVP spec.<br>• Wired up `parsePageSelection` and `isPageSelectionValid` against total document pages.<br>• Real PDF canvas preview powered by pdfjs-dist worker.<br>• Sticky summary bar showing live page and price recalculations. |
| **03** | **Review Order & Payment Checkout** (`/review`) | • Shop summary with location<br>• Itemized document review list<br>• Inline copy adjust & item delete<br>• Price summary breakdown<br>• Payment method selection<br>• Direct order checkout CTA | ✅ **100% Complete** | • **Major Consolidation:** Combined Review and Payment into a single frictionless page.<br>• Redesigned Shop Summary Card with shop icon, status badge, and full address.<br>• Compact 2-column payment method selector (`grid-cols-2`) for "UPI / Online" vs "Cash at Shop".<br>• In-flight and payment failure feedback banner.<br>• Fixed sticky mobile footer CTA with safe-area insets (`fixed inset-x-0 bottom-0 z-30`). |
| **—** | **Payment Route** (`/payment`) | • Legacy standalone payment screen | 🔀 **Redirected** | • Redirects automatically to `/review` to preserve a consolidated 4-step funnel. |
| **04** | **Order Status & Lifecycle Tracking** (`/order-status`) | • Unified post-submission tracking<br>• States: Order Received, Shop Accepted, Printing, Ready, Completed<br>• Failure states: Rejected, Print Failed, Cancelled<br>• Vertical timeline<br>• Item details & bill breakdown | ✅ **100% Complete** | • Consolidated Screen 05 & 06 prompt requirements into one stateful page.<br>• Header displays prominent Order ID with 1-tap copy button (removed redundant "NEW ORDER" button and document count subline).<br>• Mini canvas thumbnails for printed files in the Item Details section.<br>• Shop accordion with pickup counter instructions.<br>• Interactive Developer Simulator Bar for manual verification of all 8 lifecycle states. |
| **05** | **Shop Information** (Drawer) | • Nested modal opened from Screen 01<br>• Shop name, address, hours, turnaround, supported services | ✅ **100% Complete** | • Accessible slide-up drawer with backdrop blur, click-outside dismissal, and ESC key support. Does not interrupt primary checkout. |

---

## 4. Key Plan Modifications Executed in Codebase

1. **Consolidated Review & Payment (Screens 03 & 04):**
   - *Previous Plan:* Screen 03 was strictly Review with a "Continue to Payment" button navigating to a separate `/payment` page.
   - *Current Implementation:* Integrated payment method selection (`PaymentMethodSelector`) and direct payment submission into `/review`. The sticky footer dynamically reflects the chosen payment path:
     - **UPI / Online Selected:** "Pay ₹XX →" with 256-bit encrypted checkout text.
     - **Cash at Shop Selected:** "Confirm Order • Pay at Shop" with amount due at shop indicator.
   - Submitting triggers payment processing and routes directly to `/order-status?orderId=...`. The standalone `/payment` route redirects to `/review`.

2. **Payment Methods 2-Column Grid Layout:**
   - Transformed the stacked payment cards into a responsive 2-column grid (`grid grid-cols-2 gap-2.5 sm:gap-3`), featuring dedicated icons, status tags ("Instant Confirmation", "Pay at Counter"), and circular selection indicators.

3. **Shop Summary Card Modernization:**
   - Refactored `ShopSummaryCard` to display the store icon, shop name, operational status ("Open Now" with green pulse badge or operating hours), and multi-line address with map pin icon.

4. **Tracking Header Simplification:**
   - Cleaned up `TrackingHeader` on `/order-status`:
     - Removed the "NEW ORDER" text button from the header action bar (home navigation is handled by the left back arrow `<ArrowLeft />`).
     - Removed the `{totalDocuments} documents` subline below `ORDER #<ID>`, eliminating visual clutter.

5. **Sticky Mobile Action Bars & Safe-Area Padding:**
   - Both Screen 02 and Screen 03 sticky footers use `fixed inset-x-0 bottom-0 z-30` with `backdrop-blur-xs`, `bg-paper/95`, and `pb-[calc(0.875rem+env(safe-area-inset-bottom))]` ensuring CTA buttons are never obscured by browser chrome or mobile home bars.

---

## 5. Feature Tracking Checklist

### Screen 01: Upload Documents (`/`)
- [x] QR code shop context resolution (defaults to `mockShop`, accepts URL parameters).
- [x] Multi-file selection via native mobile file picker and drag-and-drop.
- [x] Client-side MIME validation (.pdf, .jpg, .jpeg, .png, .doc, .docx, .ppt, .pptx).
- [x] File size validation (max 50MB per file with error badge).
- [x] Realistic upload progress simulation with individual file retry and remove.
- [x] Persistent IndexedDB file caching via `file-store.ts`.
- [x] "Shop Info" trigger opening secondary Screen 05 modal.
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

### Screen 03: Review Order & Payment Checkout (`/review`)
- [x] Compact shop summary card with location, status, and operating hours.
- [x] Itemized document cards showing preview thumbnail, file name, copies, pages, color, and line price.
- [x] Quick stepper to update copies with instant subtotal and total recalculation.
- [x] Document removal with automatic total recalculation.
- [x] Click-to-edit returning to Screen 02 with `selectedId` focused.
- [x] Structured price breakdown (print charges, fees, taxes, discounts, total).
- [x] Authoritative price refresh simulation (detects price changes and shows alert banner).
- [x] Compact 2-column payment method selector (UPI/Online vs Cash at Shop).
- [x] In-flight payment processing feedback and retry banner.
- [x] Fixed mobile sticky bottom CTA with safe-area support.
- [x] Automatic order placement and redirection to `/order-status`.

### Screen 04: Order Status & Tracking (`/order-status`)
- [x] Persistent order tracking screen with Order Reference ID and 1-tap copy button.
- [x] Streamlined header (no redundant "NEW ORDER" button or document count subline).
- [x] Chronological vertical progress timeline matching post-submission states:
  - State A: Order received / Waiting for shop
  - State B: Shop accepted
  - State C: Printing in progress
  - State D: Ready for collection (pickup counter instructions and payment status)
  - State E: Completed
  - Failure states: Shop rejected, Printer failed, Order cancelled
- [x] Itemized document summary with mini PDF canvas previews and line-item specs.
- [x] Total order bill details (Item total, payment status, cash counter instructions).
- [x] Print shop details accordion with instant counter collection directions.
- [x] Background polling with exponential backoff and automatic stop on terminal state.
- [x] Manual refresh button with animated spinner.
- [x] Left back arrow to return home.
- [x] Developer Simulator Bar for manual verification of all 8 lifecycle states.

### Screen 05: Shop Information Drawer
- [x] Triggered from Screen 01 without interrupting the checkout flow.
- [x] Displays shop name, full address, operating hours, turnaround time, supported printing options, and formats.
- [x] Keyboard accessibility (ESC to close) and backdrop tap to dismiss.

---

## 6. Day-0 Backend & Hardware Integration Prerequisites

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
