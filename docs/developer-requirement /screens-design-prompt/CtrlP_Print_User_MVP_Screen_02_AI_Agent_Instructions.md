# CtrlP.ai Print User Web App
## Screen 02: Documents + Preview + Print Configuration
### AI Coding Agent Implementation Instructions

**Project:** CtrlP.ai  
**Screen:** Print User Web App, Screen 02  
**Primary target:** Mobile first  
**Secondary target:** Tablet and desktop responsive  
**User:** Guest Print User  
**Status:** MVP

---

# 1. Objective

Implement **Screen 02 of the CtrlP.ai Print User web app**.

This screen is the combined:

```text
Document List
+
Document Preview
+
Per Document Print Configuration
```

There must NOT be a separate "Documents Added" page.

The user arrives here after successfully uploading one or more files on Screen 01.

The supplied screenshots are **layout and interaction references**. Use them to understand the intended composition, positioning, hierarchy, spacing, document carousel, configuration cards, sticky action area and overall interaction model.

Do not copy the reference product's branding, colors or typography.

CtrlP's existing design system is the source of truth for:

```text
Colors
Typography
Icons
Spacing tokens
Border radius
Shadows
Button styles
Component states
```

The screenshots are the source of truth for the **general layout, information hierarchy and interaction composition**.

---

# 2. Critical Instructions

## Do not write hardcoded UI

Do NOT hardcode:

- Prices
- File names
- Page counts
- Number of copies
- Number of files
- Shop capabilities
- Supported options
- Order totals
- Document metadata
- Configuration values
- API URLs
- User/session identifiers

Use typed data models and props/state.

Mock data is allowed during UI development, but it must live in a dedicated mock/data layer and must not be embedded directly inside presentational components.

Bad:

```text
<h2>File 1</h2>
<span>₹3/page</span>
```

Good conceptual approach:

```text
DocumentCard(document)
PriceDisplay(price)
PrintConfiguration(documentConfiguration)
```

The exact implementation is the responsibility of the coding agent, but the architecture must remain data driven.

---

# 3. Follow the Existing Design System

Before creating visual components:

1. Inspect the existing CtrlP design tokens.
2. Reuse the existing font.
3. Reuse existing color variables.
4. Reuse existing spacing tokens.
5. Reuse existing border radius tokens.
6. Reuse existing shadow definitions.
7. Reuse existing button/input primitives.
8. Reuse the existing icon system.

Do not introduce a second design system for this screen.

Do not create random hex colors inside components.

Do not create arbitrary font sizes throughout the page.

If a required design token does not exist, add it centrally to the design system rather than hardcoding it inside the screen.

---

# 4. Reference Screenshots

The supplied screenshots show the intended visual composition for this screen.

Relevant visual structure:

```text
Top navigation
       ↓
Add Files action
       ↓
Document preview / document carousel
       ↓
Selected document indicator
       ↓
Copies configuration
       ↓
Color configuration
       ↓
Additional configuration
       ↓
Apply configuration to all files
       ↓
Order total
       ↓
Primary CTA
```

The screenshots show some controls that are **NOT part of the CtrlP MVP**.

Do not blindly copy every control from the screenshots.

The CtrlP MVP feature scope takes priority.

---

# 5. MVP Configuration Scope

Screen 02 must support:

## Required

### Document

- Document selector
- Document preview
- File name
- Number of pages
- File size where useful
- Add more files
- Remove document
- Document processing/validation state

### Print configuration

- Number of copies
- Color: B&W / Color
- Paper size: A4
- Page selection: All pages / Selected pages
- Apply current settings to all files

### Order information

- Total print pages
- Estimated/current price
- Primary Continue action

---

# 6. Explicitly DO NOT Implement

The reference screenshots show additional printing controls.

They are intentionally excluded from the CtrlP MVP.

Do NOT implement:

```text
Single sided / Double sided
Orientation
Portrait / Landscape
Pages per sheet
Scaling
Collation
Binding
Stapling
Lamination
Special instructions
Free form print instructions
```

This is important.

Even though the screenshots show **Print Orientation**, it must NOT appear in the CtrlP MVP.

The MVP configuration is:

```text
Copies
Color
Paper Size
Page Selection
```

---

# 7. Screen Layout

The page should visually follow the reference composition.

Conceptually:

```text
┌──────────────────────────────────────────┐
│  ←                         + Add files   │
│                                          │
│      ┌────────────────────────────┐      │
│      │                            │      │
│      │      DOCUMENT PREVIEW      │      │
│      │                            │      │
│      └────────────────────────────┘      │
│                                          │
│              ●  1 / N  ○ ○               │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Number of copies              − 1 +│  │
│  │ File name · N pages                │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Choose print color                 │  │
│  │                                    │  │
│  │ [ Color ]       [ B&W ]            │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Paper size                         │  │
│  │                                    │  │
│  │ [ A4 ]                             │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Page selection                     │  │
│  │                                    │  │
│  │ [ All pages ] [ Selected pages ]   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Apply this setting to all files  Apply │
│                                          │
│  Total N pages                  ₹XX      │
│  ┌────────────────────────────────────┐  │
│  │             Continue               │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

This is a structural guide, not a request to reproduce this ASCII representation.

---

# 8. Top Navigation

Use the established CtrlP mobile header pattern.

## Left

Back button.

Behavior:

```text
Tap → return to Screen 01
```

Configuration must not be silently lost when navigating backward.

## Right

Use an **Add files** action.

The reference uses a rounded outlined action.

Follow the CtrlP design system for the actual colors, typography and icon.

Behavior:

```text
Tap Add files
      ↓
Native file picker
      ↓
Upload additional documents
      ↓
New documents become available in selector
```

Adding files must not reset the configurations of existing documents.

---

# 9. Document Preview Area

This is the visual focal point of Screen 02.

The reference places the selected document prominently near the top.

Implement:

- Large selected document preview
- Preview container
- Document aspect ratio preservation
- Appropriate whitespace around the document
- Preview loading state
- Preview error state
- Page navigation where required
- Clear selected-document relationship

The preview should feel like a physical document/page rather than a generic image card.

Do not distort document proportions.

---

# 10. Multiple Document Selector

The reference uses a horizontal carousel-like composition where the current document is centered and neighboring documents can partially appear.

Use this interaction model where practical.

Conceptually:

```text
        previous
           ↓
     ┌───────────┐
     │           │
     └───────────┘
       SELECTED
     ┌───────────┐
     │ DOCUMENT  │
     └───────────┘
           ↓
         next
```

The selected document should be visually emphasized.

Neighboring previews may be partially visible to communicate that more documents exist.

## Requirements

- Swipe on mobile where appropriate.
- Tap neighboring document to select.
- Keyboard accessible on larger devices.
- Current position indicator.
- Current document index.
- Total document count.

Example:

```text
1 / 5
```

This means:

```text
selected document index / total uploaded documents
```

Do not hardcode the values.

---

# 11. Document State

Each document can have:

```text
Uploading
Processing
Ready
Configuration incomplete
Configured
Error
```

The user should not be able to configure a document that has not finished processing sufficiently to provide required metadata.

Show an appropriate loading state while processing.

---

# 12. Document Information

Immediately around the configuration section, clearly identify the selected document.

Show:

```text
File name
Number of pages
```

Optionally show:

```text
File size
```

Do not overload the UI with technical metadata.

The user needs to understand:

> "These settings apply to this document."

---

# 13. Copies Control

Use a compact quantity control inspired by the reference.

Structure:

```text
Number of copies

File name · N pages

                 −   1   +
```

## Behavior

- Default value: 1.
- Minus decreases quantity.
- Plus increases quantity.
- Minimum: 1.
- Maximum: backend/product configured.
- Prevent invalid values.
- Update price immediately after a valid change.

If direct numeric entry is supported, validate it before committing.

Do not allow:

```text
0
negative
non numeric
excessive values
```

---

# 14. Color Selection

Use a visually prominent two-option selection component.

Options:

```text
Color
B&W
```

Each option should communicate the pricing supplied by the shop where appropriate.

Example:

```text
Color
₹X/page

B&W
₹Y/page
```

Do not hardcode the prices.

The backend/shop configuration supplies the price.

## Selected state

The selected option must be visually obvious using the existing CtrlP design tokens.

Do not rely only on color to communicate selection.

Use appropriate:

```text
Border
Background
Icon
Check indicator
Typography
```

---

# 15. Color Icons

The reference uses recognizable visual symbols for color and B&W.

Use appropriate CtrlP iconography or a reusable print color icon.

Do not copy proprietary reference artwork.

The icon should communicate:

```text
Color printing
Black and white printing
```

Icons must come from the shared icon system or an approved reusable asset.

---

# 16. Paper Size

MVP supports:

```text
A4
```

The UI should still be implemented using a configurable option model because future versions may support:

```text
A3
A5
Letter
Legal
```

Do not build the component in a way that assumes A4 will always be the only possible value.

Only show paper sizes supported by the selected shop.

For the current MVP, the expected available option is A4.

---

# 17. Page Selection

Page selection is an MVP feature.

Provide:

```text
All pages
Selected pages
```

When the user selects:

```text
Selected pages
```

provide an appropriate input for page selection.

Support expressions such as:

```text
1,3,5-8
```

Validate against the actual page count.

Examples:

For a 10 page document:

```text
1,3,5-8
```

is valid.

```text
1,11
```

is invalid.

## Validation

Handle:

- Empty selection
- Page number greater than document page count
- Invalid syntax
- Duplicate pages
- Reversed ranges
- Non numeric input

Normalize the resulting page list before sending it to the backend.

The backend must validate again.

---

# 18. Apply Settings to All Files

The reference has an "Apply this setting to all files" interaction.

CtrlP should retain this interaction.

Place it below the document configuration controls.

Conceptually:

```text
Apply this setting to all files             Apply
```

Behavior:

1. Take the current document's valid configuration.
2. Apply it to all compatible uploaded documents.
3. Recalculate the order.
4. Update all document configuration states.
5. Keep the user on Screen 02.
6. Allow individual documents to be changed afterward.

Do not permanently link the configurations.

"Apply to all" means copy the current configuration, not create a shared mutable configuration.

---

# 19. Price Calculation

Screen 02 should provide immediate pricing feedback.

The price should be based on:

```text
Document page selection
×
Copies
×
Color mode
×
Paper size
+
Applicable configured fees
```

The exact pricing rules belong to the backend.

The frontend may show optimistic/intermediate values for UX, but the backend must remain authoritative.

Whenever configuration changes:

```text
Configuration changed
        ↓
Recalculate
        ↓
Update displayed total
```

Avoid excessive requests by using appropriate debouncing/caching where necessary.

---

# 20. Bottom Summary and Primary Action

The bottom of the screen should have a strong summary area inspired by the reference.

Show:

```text
Total N pages

₹XX
```

Then the primary CTA:

```text
Continue
```

The exact wording should follow the approved CtrlP product flow.

Since this screen precedes Review Order, do not call this action "Pay".

The next destination is:

```text
Screen 03 — Review Order
```

The CTA should remain easy to reach on mobile.

A sticky bottom action area is recommended if it does not obstruct configuration controls.

Ensure the page has sufficient bottom padding.

---

# 21. Sticky Bottom Behavior

On mobile:

```text
Content scrolls
        ↓
Bottom summary remains accessible
```

However:

- It must not cover the current control.
- It must not hide validation errors.
- It must respect mobile safe areas.
- It must account for browser viewport changes.
- It must work correctly with the on-screen keyboard.

Use CSS environment safe-area support where appropriate.

---

# 22. Loading States

Implement explicit loading states.

## Preview loading

Show a lightweight skeleton/placeholder while preview data loads.

## Document processing

Show:

```text
Processing document...
```

Do not display broken images.

## Price loading

If price recalculation is asynchronous:

```text
Updating price...
```

Avoid causing the entire screen to flicker.

---

# 23. Error States

Implement recoverable errors.

### Preview failure

```text
Unable to preview this document.
Try again.
```

The user should still be able to retry or remove the document.

### Configuration failure

Explain which setting is invalid.

### Price calculation failure

Do not show a stale price as if it were current.

Provide retry behavior.

### Upload additional file failure

Do not affect existing valid documents.

### Document processing failure

Identify the affected document and allow:

```text
Retry
Remove
```

Do not force the user to restart the entire order.

---

# 24. Empty/Invalid State

Normally Screen 02 is reached only after at least one successful upload.

Nevertheless, implement a safe empty state.

If no usable documents exist:

```text
No documents yet

Add a document to continue.
```

The Continue action must be disabled.

Do not allow navigation to Review Order without a valid configured document.

---

# 25. Navigation Rules

## Back

Before reaching Screen 03:

```text
Screen 02 → Screen 01
```

Preserve:

- Uploaded files
- Valid document metadata
- Existing configuration
- Guest session

## Continue

Only allow:

```text
Screen 02 → Screen 03
```

when:

```text
All documents valid
AND
All documents configured
AND
Price successfully calculated/validated
```

If something is incomplete, clearly identify the affected document or field.

---

# 26. Responsive Requirements

Mobile is the primary target.

The layout must also work on:

```text
360px
375px
390px
412px
430px
```

and larger widths.

## Tablet

The configuration area may use more horizontal space.

## Desktop

Do not simply stretch the mobile layout across the entire viewport.

Use a sensible maximum content width.

The desktop composition can transition to a wider two column layout if appropriate:

```text
┌─────────────────────────────────────────────┐
│                                             │
│       Preview          Configuration        │
│                                             │
└─────────────────────────────────────────────┘
```

But the mobile composition remains the primary reference.

No horizontal overflow is permitted.

---

# 27. Component Architecture

Use a modular component architecture.

Suggested conceptual structure:

```text
PrintConfigurationPage
│
├── PrintPageHeader
│   ├── BackButton
│   └── AddFilesButton
│
├── DocumentPreviewSection
│   ├── DocumentPreview
│   ├── DocumentCarousel
│   └── DocumentPositionIndicator
│
├── DocumentConfiguration
│   ├── CopiesControl
│   ├── ColorSelector
│   ├── PaperSizeSelector
│   └── PageSelectionControl
│
├── ApplyToAllControl
│
└── OrderSummaryBar
    ├── TotalPages
    ├── TotalPrice
    └── ContinueButton
```

These are conceptual boundaries.

Adapt them to the project's existing component architecture.

Do not create a monolithic page component.

---

# 28. State Architecture

Keep document state separate from UI presentation.

Conceptually:

```text
Guest Session
    ↓
Order Draft
    ↓
Documents[]
    ↓
DocumentConfiguration[]
    ↓
Pricing
```

Each document should have an independent configuration.

Example conceptual model:

```text
Document
├── id
├── name
├── pageCount
├── size
├── preview
├── processingStatus
└── configuration
    ├── copies
    ├── colorMode
    ├── paperSize
    └── pageSelection
```

Do not duplicate the same state in multiple unrelated components.

---

# 29. Data Driven Design

All screen content that can vary must come from data.

Examples:

```text
documents
shop capabilities
available colors
available paper sizes
pricing
page count
copies
selected pages
order totals
```

Use typed interfaces.

Do not use untyped `any` as a shortcut.

If API data differs from UI data, create an explicit mapping/adapter layer.

---

# 30. API Boundary

The UI should not directly assume backend implementation details.

Create a clear data/service boundary for:

```text
Document processing
Document preview
Pricing
Order draft
Shop capabilities
```

Validate external data at the boundary.

Use Zod as specified by the project stack.

Do not trust client supplied:

```text
Price
Shop capability
Document authorization
Final page count
Payment status
```

---

# 31. Security

Documents are potentially sensitive.

Never:

- Put private document URLs into public HTML.
- Log document contents.
- Store sensitive document information in analytics events.
- Expose storage credentials.
- Trust a client supplied price.
- Trust a client supplied page count.
- Allow one guest session to access another session's documents.

Use controlled document access and short lived/signed preview URLs where appropriate.

---

# 32. Accessibility

All interactive elements must be accessible.

Requirements:

- Semantic buttons
- Keyboard navigation
- Visible focus states
- Accessible labels for icon-only controls
- Screen reader labels for document position
- Accessible selected/unselected states
- Accessible accordion/input behavior where applicable
- Sufficient contrast
- Touch targets appropriate for mobile

For the document carousel, do not make swipe the only way to change documents.

---

# 33. Performance

This screen may contain multiple document previews, so performance matters.

Implement:

- Lazy loading where appropriate
- Preview thumbnail optimization
- Avoid rendering unnecessary full document previews simultaneously
- Memoize expensive derived UI where useful
- Avoid unnecessary global state updates
- Debounce page selection/pricing requests when appropriate
- Avoid downloading the same preview repeatedly
- Clean up object URLs/resources when applicable

Do not sacrifice document correctness for aggressive optimization.

---

# 34. Print Configuration Must Be Structured

Never represent configuration as a free text sentence.

Use structured data.

Conceptually:

```json
{
  "documentId": "doc_123",
  "copies": 2,
  "colorMode": "bw",
  "paperSize": "A4",
  "pageSelection": {
    "mode": "selected",
    "pages": [1, 3, 5, 6]
  }
}
```

This structure must be usable by the backend and eventually by the Shop Partner printer pipeline.

---

# 35. No Unnecessary Features

Do not add:

```text
Login
Signup
Profile
Cart marketplace
Coupons
Wishlist
Delivery
Printer selection
Advanced printing settings
```

These do not belong to Screen 02 MVP.

The screen has one job:

> **Let the user verify their documents and define exactly how each document should be printed.**

---

# 36. Visual Implementation Rules

When comparing the implementation against the reference screenshots, pay close attention to:

```text
Document preview size
Preview positioning
Partial neighboring documents
Position indicator
Configuration card spacing
Card proportions
Copies control placement
Color selector proportions
Selected state treatment
Vertical spacing
Bottom summary placement
CTA size
Top Add Files placement
Overall density
```

Do not blindly reproduce the reference's exact colors or typography.

Use the CtrlP design system for those.

---

# 37. Do Not Use Orientation

This deserves explicit emphasis.

The reference screenshots contain:

```text
Portrait
Landscape
```

CtrlP MVP does **not** contain this feature.

Do not implement it.

The document's natural orientation should be handled by the document rendering/printing pipeline without exposing an orientation choice to the MVP user.

---

# 38. Screen 02 Completion Criteria

Screen 02 is complete when the user can:

```text
See all uploaded documents
        ↓
Select a document
        ↓
Preview the document
        ↓
See page count
        ↓
Set copies
        ↓
Choose B&W or Color
        ↓
Choose A4
        ↓
Choose all pages or selected pages
        ↓
Apply configuration to all files if desired
        ↓
See updated page count and price
        ↓
Continue to Review Order
```

No document should reach Screen 03 without valid configuration.

---

# 39. Definition of Done for the AI Coding Agent

Before considering implementation complete, verify:

### Functional

- Multiple documents work.
- Document switching works.
- Preview works.
- Add files works.
- Remove document works.
- Copies work.
- Color selection works.
- A4 is handled through configurable paper-size data.
- Page selection works and validates correctly.
- Apply-to-all works.
- Individual configuration can be changed after Apply-to-all.
- Price updates correctly.
- Continue validation works.
- Back navigation preserves state.

### UX

- Mobile first.
- Responsive on tablet and desktop.
- No horizontal scrolling.
- Sticky bottom CTA does not hide content.
- Loading states exist.
- Error states exist.
- Empty states exist.
- Touch interactions are comfortable.
- Document carousel is usable without relying only on swipe.

### Engineering

- No hardcoded business values.
- No hardcoded pricing.
- No hardcoded document data inside components.
- Modular React components.
- Typed data models.
- Zod validation at boundaries.
- Existing design tokens reused.
- No duplicated state.
- No `any` used as a shortcut.
- API/service logic separated from presentation.
- Proper error handling.
- Proper cleanup of temporary resources.
- Accessible interactive components.
- Private documents remain protected.

---

# 40. Final Product Intent

Screen 02 should feel like a **simple, visual print configuration workspace**, not a settings form.

The user should immediately understand:

```text
This is my document
        ↓
I can see it
        ↓
I can choose how many copies
        ↓
I can choose B&W or Color
        ↓
I can choose A4
        ↓
I can choose which pages
        ↓
I can repeat the same setting for all files
        ↓
I know what it will cost
        ↓
I can continue
```

The reference screenshots provide the desired interaction and layout inspiration.

CtrlP's design system provides the visual language.

CtrlP's MVP requirements provide the actual functionality.

The implementation must combine all three without introducing unnecessary features.
