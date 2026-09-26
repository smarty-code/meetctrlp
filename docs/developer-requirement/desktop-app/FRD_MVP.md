Yes. I would challenge the current list rather than simply accept every `[x]` item as P0.

The biggest product question is:

> **What must exist on Day 0 for a shop to receive one customer order, print it correctly, take payment, and complete the order?**

Anything that does not directly support that loop should be questioned.

I’ll go through the current MVP **one by one**, and classify each as:

* **T0:** Required for the first usable MVP
* **T1:** Valuable, but can come after the first working MVP
* **Later:** Explicitly out of MVP scope

---

# 1. Shop & Account

### Shop authentication → **T0**

Required. The desktop must know which shop and user it belongs to.

### Device registration → **T0**

Required because the desktop is a trusted printing device connected to a specific shop.

### Shop profile → **T1**

The basic shop identity is needed, but extensive profile management does not need to block the printing workflow.

### Account management → **T1**

Useful, but not central to printing.

### Sign out → **T0**

Security requirement for a shared shop computer.

### Device status → **T0**

Important because the device is part of the printing infrastructure.

### Application version → **T1**

Useful for support and debugging, but doesn't directly process an order.

### Print Agent version → **T0**

I would keep this T0 because the print agent is a critical part of the MVP architecture. If the agent and desktop versions are incompatible, printing can fail.

---

# 2. Shop Configuration

### Pricing configuration → **T0**

The customer needs a correct price before paying.

### B&W pricing → **T0**

Required for price calculation.

### Color pricing → **T0**

Same reason.

### Paper size pricing → **T0**

If paper size affects price, it must be supported.

### Service configuration → **T1**

I would simplify this for T0.

Don't build a large service-management system.

For MVP, the shop can simply have predefined supported capabilities.

### Capability configuration → **T0**

Important because printer capability determines whether an order can actually be fulfilled.

---

# 3. Orders

### New orders → **T0**

Core workflow.

### Active orders → **T0**

Core workflow.

### Ready orders → **T0**

The shop needs to know which orders are ready for pickup.

### Completed orders → **T0**

Needed for operational closure and history.

### Order history → **T0**

I would keep a basic version.

It doesn't need advanced reporting.

### Search → **T1**

Useful, but a shop with low order volume can initially operate without sophisticated search.

However, basic order ID search is cheap enough that I'd probably implement it early.

### Filters → **T1**

Useful, but not necessary for the first functional loop.

### Payment status → **T0**

Absolutely required.

### Order status → **T0**

Core state management.

### Order details → **T0**

Core workflow.

### Order acceptance → **T0**

Required if the shop must explicitly accept an order.

### Order rejection → **T0**

Required because a shop needs a safe way to reject an order it cannot fulfill.

---

# 4. Documents

### Multiple documents → **T0**

Already part of the user-side MVP.

The desktop must handle the resulting multi-document order correctly.

### Filename → **T0**

The operator needs to identify documents.

### File size → **T1**

Useful for diagnostics, but not essential to printing.

### Page count → **T0**

Critical because printing and pricing depend on pages.

### Preview → **T0**

I would keep it.

The operator needs a way to verify what they are about to print.

### Secure document retrieval → **T0**

Non-negotiable because documents are the core sensitive asset.

### Document validation → **T0**

Required before printing.

### Rendering validation → **T0**

A document that cannot render correctly cannot safely be printed.

### Temporary local storage → **T0**

Required because the local print process needs access to the document.

### Cleanup → **T0**

Especially important because customer documents are private.

### Privacy controls → **T0**

You specifically identified document privacy as a Day 0 requirement.

I strongly agree.

---

# 5. Print Configuration

These are all **T0** because they come directly from the customer's request.

### B&W → **T0**

### Color → **T0**

### Copies → **T0**

### Paper size → **T0**

### Page selection → **T0**

### Print readiness validation → **T0**

There is an important distinction here:

**The customer chooses the print configuration.**

The desktop primarily **validates and executes that configuration**.

It should not become another configuration editor unless there is a legitimate operational exception.

---

# 6. Printer Integration

This is where I would be very strict.

Printer integration is your key differentiator, so I would keep the fundamental infrastructure in **T0**.

### Printer discovery → **T0**

Absolutely.

### Printer connection → **T0**

Absolutely.

### Printer status → **T0**

Required for reliable printing.

### Printer capabilities → **T0**

Required for routing.

### B&W capability → **T0**

Required.

### Color capability → **T0**

Required.

### Paper size capability → **T0**

Required.

### Default printer → **T0**

Useful for deterministic routing.

### Printer routing → **T0**

This is one of the most important features.

The system needs to determine:

> "Which physical printer should execute this job?"

### Test print → **T1**

I would move this out of the critical order workflow.

It's extremely useful during setup and troubleshooting, but a shop can technically process an order without it.

### Printer diagnostics → **T1**

Basic printer health is T0.

A full diagnostic system can be T1.

### Multiple printer support → **T0**

This deserves emphasis.

Even if a shop starts with one printer, the architecture should support multiple printers because color and B&W requirements may require different devices.

### Local print agent → **T0**

Absolutely.

This is effectively the heart of the desktop MVP.

---

# 7. Printing

### Print queue → **T0**

Required once printing is asynchronous.

### Queue management → **T0**

Basic queue management is required.

### Automatic print execution → **T0**

This is the actual value proposition.

### Print progress → **T0**

With one caveat:

Only show progress when the OS/printer provides reliable information.

Don't fake percentages.

### Print completion → **T0**

Required.

### Print failure → **T0**

Absolutely.

### Retry → **T0**

A printer can fail. The shop cannot be forced to restart an entire order.

### Printer reassignment → **T0**

I would keep it T0 **for compatible printers**.

Example:

```text
Color printer failed
       ↓
Compatible color printer exists
       ↓
Move job
       ↓
Retry
```

That's very valuable operationally.

### Recovery → **T0**

Yes.

Printing is a physical process, so crashes and disconnections are inevitable.

### Print job history → **T1**

Basic attempt history should exist for debugging/audit purposes, but a sophisticated historical print analytics system can wait.

---

# 8. Payments

### Online payment state → **T0**

The shop needs to know whether the customer has already paid.

### Cash payment → **T0**

Because you've explicitly decided that customers can choose cash.

### Cash pending → **T0**

Required.

### Cash collection → **T0**

Required to close the order correctly.

### Payment verification → **T0**

Important distinction:

The desktop must **not trust the customer saying "I paid."**

It must use the backend payment state.

### Payment status → **T0**

Core workflow.

### Payment synchronization → **T0**

Required because payment and order state exist across systems.

---

# 9. Fulfillment

### Ready for pickup → **T0**

This is the bridge between printing and customer handover.

### Order completion → **T0**

Required.

### Completed history → **T0**

Basic history, yes.

Advanced history/reporting, no.

---

# 10. Realtime & Reliability

This section needs an important distinction.

### Realtime order events → **T0**

Required for the seamless experience.

The shop should not repeatedly refresh the page.

### Payment events → **T0**

Important for online payment confirmation.

### Print events → **T0**

Required for keeping cloud and desktop state synchronized.

### Notifications → **T0**

But keep them simple.

You don't need a notification center with sophisticated rules.

A shop operator primarily needs:

* New order
* Payment update
* Print failure
* Printer problem

### Reconnect → **T0**

Absolutely.

### State reconciliation → **T0**

This is more important than it looks.

Realtime can fail.

Therefore:

```text
Realtime event
     ↓
UI updates
     ↓
Backend remains source of truth
```

After reconnect:

```text
Reconnect
   ↓
Fetch authoritative state
   ↓
Reconcile local state
```

### Offline handling → **T0**

But don't interpret this as:

> "The whole application must work offline."

That's unnecessary.

It means:

> **The application must gracefully handle connectivity loss without corrupting order or print state.**

### Restart recovery → **T0**

Especially because this is a physical print application.

### Idempotency → **T0**

This is backend infrastructure, but absolutely required.

You never want:

```text
Click Print
   ↓
Network timeout
   ↓
Click again
   ↓
Two physical copies
```

### Concurrency protection → **T0**

If two shop devices exist, both cannot independently accept and print the same order.

---

# 11. Security & Privacy

I would classify almost everything here as **T0**.

### Secure authentication → **T0**

### Shop authorization → **T0**

### Device authorization → **T0**

### Secure document access → **T0**

### Temporary document storage → **T0**

### Cleanup → **T0**

### Encryption → **T0**

### Signed/time-limited URLs → **T0**

### Malware/file scanning → **T0**

This one deserves some nuance.

The **security requirement** is T0.

The exact sophistication of scanning can depend on the backend architecture.

But uploaded documents are untrusted files, so some scanning/protection mechanism should exist before they reach the shop machine.

### No document contents in logs → **T0**

### No document contents in analytics → **T0**

### Auditability → **T0**

At minimum for:

* Order state changes
* Payment state changes
* Print execution
* Print failure
* Cash collection
* Administrative changes

### Secure token storage → **T0**

### No payment secrets in desktop → **T0**

---

# 12. Dashboard

This is where I'd reduce scope.

### New order count → **T0**

Useful operationally.

### Active order count → **T0**

Useful.

### Printing count → **T0**

Useful.

### Ready count → **T0**

Useful.

### Completed count → **T1**

Nice to have, but not essential to processing orders.

Still easy enough to include if the data already exists.

### Revenue visibility → **T1**

I would question this for the first MVP.

The shop needs **order payment status**, but a revenue dashboard is not necessary to print an order.

### Cash pending → **T0**

This is operationally important.

### Printer health → **T0**

Very important because printing is the core physical workflow.

### Attention required → **T0**

Very useful.

Instead of the operator checking five places, the dashboard says:

```text
ATTENTION

2 new orders
1 printer offline
1 print failed
```

### Recent orders → **T1**

Useful but not essential.

### Operational notifications → **T0**

But keep them lightweight.

---

# My final T0 cut

After challenging the entire list, I would define the **true operational T0** like this:

### Core order processing

* Authentication
* Device registration
* New orders
* Active orders
* Ready orders
* Order completion
* Order details
* Multiple documents
* Document retrieval
* Document preview
* Document validation
* Page count
* B&W / Color
* Copies
* Paper size
* Page selection
* Payment status
* Online payment synchronization
* Cash payment
* Order acceptance
* Order rejection

### Core printer infrastructure

* Local print agent
* Printer discovery
* Printer connection
* Printer status
* Printer capabilities
* Multiple printers
* Printer routing
* Default printer
* Print execution
* Print queue
* Print failure
* Retry
* Printer reassignment
* Recovery

### Core reliability

* Realtime events
* Reconnect
* State reconciliation
* Restart recovery
* Idempotency
* Concurrency protection

### Core fulfillment

* Ready for pickup
* Customer pickup/completion
* Basic order history

### Core security

* Authentication
* Authorization
* Secure document access
* Temporary file handling
* Cleanup
* Encryption
* Document privacy
* Secure tokens
* Audit trail
* No sensitive data in logs/analytics

### Core operational visibility

* Dashboard
* New order count
* Active/printing count
* Ready count
* Cash pending
* Printer health
* Attention required
* Basic notifications

---

# What I would move to T1

These are useful, but I don't think they should block the first working MVP:

* Advanced order search
* Advanced filters
* File size display
* Test print
* Advanced printer diagnostics
* Detailed print history
* Completed count
* Revenue dashboard
* Recent order dashboard
* Extensive notification preferences
* Rich account management
* Extensive shop profile management
* Advanced service configuration
* Advanced diagnostic/log export

---

# And these stay Later

These should remain outside the MVP:

* Duplex
* Pages per sheet
* Orientation
* Scaling
* Collation
* Binding
* Stapling
* Special instructions
* Advanced finishing
* Marketplace
* College ecosystem
* B2B API
* Delivery
* Additional print services

---

## One important product correction

There is one thing I would change in our current PRD.

We currently have **"Test print" as P0** and several dashboard/reporting capabilities as if they're equally important as actual printing.

I don't think they are.

The real MVP hierarchy should be:

```text
             T0
              │
      RECEIVE ORDER
              ↓
      UNDERSTAND ORDER
              ↓
      VERIFY PAYMENT
              ↓
      VALIDATE DOCUMENT
              ↓
       ROUTE TO PRINTER
              ↓
        PHYSICALLY PRINT
              ↓
       HANDLE FAILURE
              ↓
       READY FOR PICKUP
              ↓
       COMPLETE ORDER
```

Everything else should support this loop, not compete with it.

That is the standard I would use to decide whether every new feature belongs in **T0, T1, or Later**.
