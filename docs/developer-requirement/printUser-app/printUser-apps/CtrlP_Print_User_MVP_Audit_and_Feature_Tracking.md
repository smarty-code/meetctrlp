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
| **01** | **Upload Documents** (`/`) | • QR shop context<br>• Multi-file upload<br>• Supported formats (.pdf, .jpg, .png, .doc, .docx, .ppt, .pptx)<br>• File validation & size limit<br>• Upload progress & retry<br>• Shop Info trigger | ✅ **100% Complete** | • Added Hero section with live shop open/closed sticker.<br>• Added "We Promise" trust pillar card.<br>• Added FAQ accordion and brand footer.<br>• Added client-side 50MB and extension validation.<br>• Moves on to Customize by itself once every file is uploaded (no Continue bar).<br>• Upload button doubles as a combined progress bar. |
| **02** | **Customize Prints** (`/customize`) | • Document selector & carousel<br>• Canvas PDF/Image preview<br>• Copies stepper<br>• Color mode (B&W vs Color)<br>• Paper size (A4)<br>• Page selection ("all" vs "selected" e.g., `1,3,5-8`)<br>• Apply to all files<br>• *Explicitly exclude orientation/duplex* | ✅ **100% Complete** | • Replaced initial `OrientationSelector` with `PageSelectionControl`.<br>• Connected `parsePageSelection` with validation against page count.<br>• Updated dynamic price & page calculation.<br>• Touch-swipe carousel and real PDF canvas rendering. |
| **03** | **Review Order** (`/review`) | • Shop identity summary<br>• Itemized document review list<br>• Filename & specs display<br>• Thumbnail preview<br>• Copies quick adjustment<br>• Delete item with price update<br>• Authoritative price refresh simulation<br>• Edit document navigation | ✅ **100% Complete** | • Restored document filename to card headline.<br>• Added interactive stepper & delete button directly in review list.<br>• Synchronizes draft with Screen 02 via `selectedId` query parameter.<br>• Simulated authoritative price change banner. |
| **04** | **Payment** (`/payment`) | • Order ID & shop summary<br>• Prominent payable amount<br>• UPI / Online payment<br>• Cash at shop option<br>• Payment states (Pending, Processing, Verified, Failed)<br>• Duplicate payment prevention | ✅ **100% Complete** | • Full state machine simulation with retry.<br>• Clear counter collection messaging for Cash-at-Shop.<br>• Stores submitted order into session storage for tracking.<br>• Full shop address display with MapPin icon (no truncation).<br>• Fixed/sticky mobile footer CTA with safe-area support.<br>• Removed redundant "Amount to pay" from order card to consolidate with footer. |
| **05** | **Order Status** (`/order-status`) | • Unified post-submission lifecycle<br>• States: Order Placed, Shop Accepted, Printing, Ready for Pickup, Completed<br>• Failure states: Rejected, Print Failed, Cancelled<br>• Chronological timeline<br>• Item & bill breakdown<br>• Realtime polling fallback | ✅ **100% Complete** | • Consolidated Screen 05 & 06 prompt requirements into one stateful page.<br>• Added interactive Developer Simulator Bar to test every state transition.<br>• Live polling interval with automatic stop on terminal state. |
| **06** | **Shop Information** (Drawer) | • Nested modal opened from Screen 01<br>• Shop name, address, hours, turnaround, supported services<br>• Non-blocking / optional | ✅ **100% Complete** | • Accessible bottom drawer with ESC key and backdrop click dismiss.<br>• Non-intrusive to the main checkout flow. |

---

## 3. Modifications Made During Building (Executed & Reconciled)

1. **Screen 01 UX Enhancements:**
   - Instead of a bare upload box, the landing page includes a trust-building Hero banner, shop availability indicator ("Printing at XYZ • Open"), "We Promise" guarantees (Zero Privacy Leaks, Instant Pickup, Crisp Prints), and an interactive FAQ accordion.
   - Added a floating bottom order indicator that tracks uploaded file count and triggers the configuration transition. Removed on 15 Oct 2026; see item 7.

2. **Screen 02 Scope Alignment (Executed):**
   - **Discrepancy:** The initial implementation included an `OrientationSelector` (Portrait vs Landscape), which was explicitly excluded in Section 6 and Section 17 of the MVP specification. Meanwhile, `PageSelectionControl` was not mounted in the main page.
   - **Resolution (later reversed, Oct 2026: `OrientationSelector` is back in use and `PageSelectionControl` was removed as unused; see item 8):** Replaced `OrientationSelector` with `PageSelectionControl`, wired up `parsePageSelection` and `isPageSelectionValid`, dynamically computed total pages from the selection expression, and enforced that invalid page expressions block proceeding to Review.

3. **Screen 03 Headline Clarity (Executed):**
   - **Discrepancy:** The document review cards replaced the filename with a generic `copies × pages` header.
   - **Resolution:** Displayed the original filename (`document.name`) as the prominent title with the copies, pages, color mode, and selected page ranges as the informative subtitle.

4. **Screen 05 Stateful Consolidation & Testing:**
   - Combined the order received state (Screen 06 prompt) and ongoing tracking states into the unified `/order-status` route.
   - Added a bottom developer testing bar (`TrackingSimulatorBar`) allowing instant manual transition through all 8 lifecycle states (Order Placed, Shop Accepted, Printing, Ready for Pickup, Completed, Rejected, Cancelled, Failed).

5. **Multi-file upload and cart sync (14 Oct 2026):**
   - **Discrepancy:** choosing several files usually left only one in the order. Causes:
     - Files from earlier orders stayed in the guest cart and used up the 10-file limit.
     - Unfinished uploads kept their slots.
     - Compressed PDFs were rejected as having no pages.
     - Customize sometimes showed an old saved list.
     - Review-page deletes and copy changes never reached the server.
   - **Resolution:**
     - The server cart (`GET /api/v1/public/session`) is now the single source of truth on the upload, customize, and review pages.
     - Placing an order clears its documents from the cart, and failed or abandoned uploads are cleaned up.
     - Uploads go through one helper (`src/lib/guest-upload.ts`): 3 at a time, one retry, and gallery photos (HEIC/WebP/…) converted to JPEG.
     - Continue waits for uploads to finish, and review edits are saved before payment.
     - Details: [`apps/server/docs/print-user.md`](../../../../apps/server/docs/print-user.md) and [`apps/printUserWebapp/README.md`](../../../../apps/printUserWebapp/README.md).

6. **Shop hours in 12-hour form (14 Oct 2026):**
   - **Discrepancy:** hours showed as raw 24-hour text (`09:00 – 21:00`), and "today" came from the phone's clock.
   - **Resolution:**
     - The server sends ready-made text computed in shop time: today's hours, a status such as **Open until 9:00 PM**, and a 12-hour label per day.
     - The shop info drawer shows today, the status, and the full week. The home pill and review card use the same text.
     - Late-night hours and 24-hour days display correctly.

7. **Upload page flow and serverless hosting (15 Oct 2026):**
   - **Discrepancy:**
     - After uploading, the shopper had to find and tap the blue **PRINT ORDER** bar to continue.
     - The file list scrolled inside a fixed-height box, hiding some files.
     - The upload button showed only a spinner, with no sense of how much was left.
     - The server will run on Firebase App Hosting (serverless). Cold starts, instance memory, and dropped requests could make the server's file check slow or fail, which would discard uploads that had already reached storage.
   - **Resolution:**
     - The page moves on to Customize by itself once every file is uploaded, and the floating bar is gone.
     - An outlined **Continue with N documents** button appears only when moving on by itself can't happen: the shopper came back from Customize, or some uploads failed.
     - The file list grows with the files.
     - The upload button fills as a progress bar with one size-weighted percentage for all files and a wavy, flat leading edge. It reads **Checking documents…** during the server check.
     - The web app retries the server check up to 3 times on dropped connections, 408, 429, and 5xx.
     - The server reads a file's size before downloading it and doesn't copy the download.
     - Run settings live in `apps/server/apphosting.yaml`: 1 GiB memory, one warm instance.
     - Details: [`apps/printUserWebapp/README.md`](../../../../apps/printUserWebapp/README.md#upload-page) and [`apps/server/docs/deployment.md`](../../../../apps/server/docs/deployment.md).

8. **Upload, cart, order and print-job sync (16 Oct 2026):**
   - **Discrepancy:**
     - Cancel Upload did nothing.
     - After a reload, or with one failed file, the shopper was stuck: the page had no list, no Continue and no retry.
     - Deletes failed silently, so a "deleted" document could still be ordered and billed.
     - There was no Clear all.
     - The cart was tied to the client IP: carts were lost on a network change and shared on a common network.
     - A failed online payment left an orphaned order that could never be paid.
     - Page selections the cart accepted could fail at the printer, and orientation never reached it.
   - **Resolution:**
     - Uploads are abortable.
     - The upload page has a file list with Remove, Retry, Clear all and Continue; it moves on by itself only after a clean batch.
     - Deletes are awaited and undone on failure.
     - The server checks out and empties the cart in one transaction, and its deletes and Clear all never touch an ordered file.
     - The cookie alone identifies the guest.
     - Payment retry pays the same order, and the order page offers **Pay now** and **Cancel order**.
     - One strict page-selection parser is shared by the cart and the printer, and the customer's orientation now prints.
     - The desktop drops jobs the shop cancelled or rescued.
     - The unused `PageSelectionControl` and `lib/page-selection.ts` were removed. A page-selection UI should use `@ctrlp/schemas/page-selection` when it ships. `OrientationSelector` is in use, and orientation is carried to the printer.
     - Details: [`docs/arc/UPLOAD_ORDER_SYNC.md`](../../../arc/UPLOAD_ORDER_SYNC.md); diagnosis and plan: [`CtrlP_Print_User_Upload_Sync_Fix_Plan.md`](./CtrlP_Print_User_Upload_Sync_Fix_Plan.md).

---

## 4. Feature Tracking Checklist

### Screen 01: Upload Documents (`/`)
- [x] Scan QR / Shop resolution (defaults to `mockShop`, supports URL parameters).
- [x] Multi-file selection via native mobile file picker and drag-and-drop.
- [x] Client-side type validation (PDF, JPEG, PNG by MIME type, extension, or file signature). Word and PowerPoint show "not supported yet"; other gallery images are converted to JPEG when the browser can decode them.
- [x] File size validation (max 50MB per file with error badge) and the 10-documents-per-order limit before uploading.
- [x] Real uploads to storage with per-file progress, 3 at a time, one automatic retry, and individual file retry and remove.
- [x] Server file check retried up to 3 times on serverless cold starts, scaling errors, and dropped connections.
- [x] Upload button doubles as a progress bar: one size-weighted percentage for all files, **Checking documents…** during the server check.
- [x] File list grows with the number of files (no fixed-height scroll box).
- [x] Files already in the server cart are listed after a reload or when coming back from Customize.
- [x] Persistent IndexedDB file caching via `file-store.ts`.
- [x] "Shop Info" trigger opening secondary Screen 06 modal.
- [x] Moves on to Screen 02 by itself only after an upload batch that landed in full; a green Continue shows whenever a document is in the cart.
- [x] Cancel Upload stops every upload in flight or queued and deletes their server intents.
- [x] File list with Remove, Retry on failed files, and Clear all (with confirmation), all reflected in the server cart.
- [x] Deletes wait for the server and are undone, with a message, if it refuses.

### Screen 02: Customize Prints (`/customize`)
- [x] Dynamic document carousel with position indicator (e.g., `1 / 3`).
- [x] Real PDF canvas preview (rendered via pdfjs-dist worker) and image preview.
- [x] Number of copies stepper (minimum 1, max 20).
- [x] Print color selection (Black & White ₹3 vs Color ₹10).
- [x] Fixed paper size indicator (A4).
- [ ] Page selection control ("All pages" vs "Selected pages", e.g. `1,3,5-8`). The earlier `PageSelectionControl` was never mounted and was removed in Oct 2026. The server already validates and stores selections with `@ctrlp/schemas/page-selection`.
- [x] Expression validation against total document page count.
- [x] "Apply this setting to all files" action with toast notification.
- [x] Live price and page count calculation in sticky summary bar.
- [x] Add more files action without leaving the customize screen (parallel uploads; Continue waits until they finish).
- [x] Settings for every document saved in one request on Continue.

### Screen 03: Review Order (`/review`)
- [x] Compact shop summary card with location and order context.
- [x] Itemized document cards showing preview thumbnail, file name, copies, pages, color, and line price.
- [x] Quick stepper to update copies, saved to the server and re-quoted.
- [x] Document removal, deleted from the server cart and re-quoted.
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
- [x] Error handling with safe retry mechanism: a failed online payment is retried on the same order.
- [x] Prevention of duplicate payment submissions: a stable idempotency key per cart and method, and recovery after a lost response.
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
- [x] **Pay now** and **Cancel order** for an unpaid order the shop hasn't accepted yet.
- [x] Developer Simulator Bar for manual verification of all states.

### Screen 06: Shop Information Drawer
- [x] Triggered from Screen 01 without interrupting the flow.
- [x] Displays shop name, full address, operating hours, turnaround time, supported printing options, and formats.
- [x] Hours in 12-hour form as the shop saved them: today's hours, live status (e.g. "Opens tomorrow at 9:00 AM"), and the full week, including "Open 24 hours" and late-night days.
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
   - The server runs on Firebase App Hosting, which ends every request after 5 minutes. A live connection must reconnect on its own. The current polling works as is. See [`apps/server/docs/deployment.md`](../../../../apps/server/docs/deployment.md).
5. **Shop Partner Agent Bridge:**
   - Transmit structured print job payload (`{ documentUrl, colorMode, copies, paperSize, pages }`) to the Tauri desktop print agent.
