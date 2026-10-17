# MeetCtrlP Main Website: Product Requirements Document (PRD)

**Route:** `meetctrlp.in/`
**Version:** 1.0 (build-ready)
**Audience for this document:** an AI agent (or developer) that will design and build the site end to end.
**Read order:** Sections 1 to 3 give context and rules. Section 4 is the design system. Section 5 specifies every page section. Sections 6 to 10 cover content rules, quality, tech, analytics and launch.

---

## 0. How to use this document

1. Build exactly the sections in Section 5, in that order. Do not add sections.
2. Use the tokens in Section 4 as the single source of truth for colour, type, spacing and motion. Do not invent new values without a reason.
3. All copy in Section 5 is final unless marked `{{PLACEHOLDER}}`. Do not rewrite it or add claims.
4. Every product visual is a **concept** (not a live screenshot) and must carry the Concept tag (Section 4.9).
5. Anything marked **[VERIFY]** is a factual claim about the product that must be controlled through the claims registry (Section 6.2). It renders only when its `verified` flag is `true`.
6. When something is ambiguous, choose the simpler option and leave a short `TODO(owner)` comment in code. Do not stop to ask.

**Engineering rules are mandatory.** The site is built with Next.js, TypeScript and Tailwind CSS, must be fully responsive, and must contain no hardcoded values. Read Section 9 before writing any code. Where a pixel value, colour, string or link appears in this PRD, it describes intent; implement it through tokens, content modules and config as Section 9 requires.

---

## 1. Product context

**Company:** MeetCtrlP (brand, not yet a registered company; do not add legal suffixes like Pvt Ltd or Inc anywhere).
**Product:** CtrlP, a QR-based printing workflow that connects people who need prints with local print shops.

**How CtrlP works (for context only):**
- **Print User** (guest, no account): scans a shop-specific QR code, uploads documents, chooses colour or black and white, copies, A4 and page selection per document, sees the price, pays online or at the shop, submits, tracks and collects.
- **Print Shop Partner:** uses desktop software to receive structured orders, validate and accept them, send jobs to local printers through a local print agent, handle failures, mark orders ready, collect cash if needed and complete.
- **Platform:** shop management, orders, payments, subscriptions.

The Print User app lives at `app.meetctrlp.in/`. It is only entered through a shop's QR code. The main website must never create an order or link into the app without a shop context.

---

## 2. Purpose, goals, non-goals

### 2.1 One job for this page

> Help a visitor understand CtrlP in about 30 seconds, believe the team is serious, and take them to the right next door (Print User info or Print Shop info).

### 2.2 Goals (in priority order)

1. **Clarity:** a first-time visitor can say what CtrlP does after the hero plus one scroll.
2. **Credibility:** the page looks crafted and honest. No fake proof, no unbuilt features presented as live.
3. **Routing:** visitors reach the Print User page or Print Shop page in one click.
4. **Shop lead capture:** print shop owners can start a WhatsApp chat or request a call.

### 2.3 Non-goals (do not build on this page)

- Pricing or plans (shop pricing is not validated yet; it will live on the Print Shop page).
- FAQ (lives on the persona pages).
- A feature bento grid (reserved for the Print Shop page).
- Full onboarding detail, printer compatibility lists, security whitepaper.
- Changelog content (route exists behind a flag; see 3.1).
- Marketplace, B2B, API, institutional printing or any "future roadmap" section.
- Testimonials, customer logos, award badges, "trusted by" claims, user counts. None exist yet and none may be invented.

### 2.4 Audience

| Audience | What they need from this page |
|---|---|
| Curious visitors and people who scanned a link | Understand the product, know how a print order starts (the shop's QR code) |
| Print shop owners | See that the shop gets structured orders and a desktop workflow, then talk to the team |
| Collaborators and evaluators | Feel that the team builds polished, careful products |

### 2.5 Success metrics

Do not invent baselines. Instrument the events in Section 8 and review after two weeks of live traffic.

| Type | Metric |
|---|---|
| Primary | WhatsApp clicks + Request-a-call submissions per 100 visitors |
| Secondary | Click-through to the Print Shop page; click-through to the Print User page |
| Engagement | Reaching the how-it-works section; reaching the closing CTA |
| Quality | Lighthouse Performance ≥ 90 mobile; LCP < 2.5 s; CLS < 0.1 |

---

## 3. Information architecture

### 3.1 Routes

| Route | Status in this PRD | Notes |
|---|---|---|
| `/` | **Build now** | This document |
| `/print` | Stub only | Print User page (separate PRD). Until built, render a minimal "Coming soon" page that explains the QR flow in two sentences, with a WhatsApp link. |
| `/print-shops` | Stub only | Print Shop page (separate PRD). Until built, render a minimal "Coming soon" page with the WhatsApp CTA and the Request-a-call form. |
| `/journey` | Behind flag `NEXT_PUBLIC_SHOW_JOURNEY` (default `false`) | Hide the nav link and footer link when false. Enable only after the first real shipped update exists. |
| `/privacy` | **Required before launch** | Plain-language privacy policy (owner supplies text). |
| `/terms` | **Required before launch** | Terms of service (owner supplies text). |

Never link to a route that does not exist. Stubs count as existing.

### 3.2 Header (sticky)

- Left: logo wordmark "MeetCtrlP" (text wordmark for now; link to `/`).
- Centre (desktop): **Product** (scrolls to `#how-it-works`), **For Print Shops** (`/print-shops`), **Journey** (`/journey`, flagged).
- Right: primary button **Explore CtrlP** (scrolls to `#how-it-works`).
- Behaviour: transparent over the hero; after 24 px of scroll becomes `--color-bg` at 85% opacity with a 12 px backdrop blur and a 1 px bottom border `--color-line`. Height 72 px desktop, 64 px mobile.
- Mobile: wordmark left, button right-aligned compact, plus a menu button that opens a full-screen sheet with the three links and the primary button. Trap focus in the sheet; close on Escape and on link click.
- Skip link "Skip to content" as the first focusable element.

### 3.3 CTA hierarchy (use these exact labels; do not invent new ones)

| Level | Label | Action |
|---|---|---|
| Primary | Explore CtrlP | Scroll to `#how-it-works` |
| Secondary | For Print Shops | Go to `/print-shops` |
| Contextual | See how printing works | Go to `/print` |
| Contextual | Discover CtrlP for Print Shops | Go to `/print-shops` |
| Conversion | Talk to us on WhatsApp | `https://wa.me/{{WHATSAPP_NUMBER}}?text=...` (prefilled, see 5.8) |
| Conversion | Request a call | Opens the call request form (5.8) |
| Contact | Contact us | `mailto:{{CONTACT_EMAIL}}` |

---

## 4. Design system

### 4.1 Design principles

1. **Editorial, minimal, confident.** Large type, deliberate negative space, one accent colour.
2. **Honest product visuals.** Concept visuals are well made and clearly labelled.
3. **Warm, not cold.** Soft off-white, painterly landscape art, a serif display face. The mood is "thoughtful and human".
4. **No decoration for decoration's sake.** No icon on every sentence, no gradient blobs, no stock photos, no repeated rows of identical cards.

### 4.2 References and how they are used

| Reference | Used for |
|---|---|
| **leedlime.com** | Colour direction (soft off-white plus lime green), painterly landscape backgrounds, numbered step structure, founder-note format, closing CTA block, footer layout |
| **vestris.ai** | Typography behaviour (large statement headlines, bracketed flourish, deliberate line breaks, short warm one-liners), narrative pacing, sticky visual with changing content, "human stays in control" trust framing, minimal nav with one CTA, pricing kept off the homepage |

**Verification note for the agent:** only the base background `#F8F9F8` is confirmed from Leedlime's page metadata (theme-color). The other colour values below are proposed. Before finalising, open leedlime.com, sample its lime and dark text colours with an eyedropper, and adjust the proposed values to match its mood while keeping the contrast ratios in 4.3. The Vestris typeface could not be identified from the page source. Inspect `vestris.ai` computed styles. If its font is free or openly licensed and fits, use it. Otherwise use the default pair in 4.4. Do not use a paid font without owner approval.

### 4.3 Colour tokens

```css
:root {
  /* Surfaces */
  --color-bg:            #F8F9F8; /* page background (from Leedlime theme-color) */
  --color-surface:       #FFFFFF; /* cards, device frames */
  --color-surface-sunken:#EEF2EC; /* alternate bands, input fills */
  --color-forest:        #0F1A12; /* dark panels, closing block */

  /* Text */
  --color-ink:           #111611; /* primary text */
  --color-ink-soft:      #4A554A; /* secondary text */
  --color-ink-faint:     #667166; /* captions, metadata (>= 4.5:1 on bg) */
  --color-ink-on-forest: #E9EFE6;

  /* Lines */
  --color-line:          #DCE2DB;
  --color-line-on-forest:#2A3A2E;

  /* Accent: lime */
  --color-lime:          #B8E04A; /* fills: primary button, highlights. Always pair with --color-ink text */
  --color-lime-soft:     #E7F4BE; /* tints, hover backgrounds, art */
  --color-lime-deep:     #3F7A12; /* accent TEXT and links on light backgrounds (>= 4.5:1) */

  /* Concept-UI status chips (soft background + dark text) */
  --chip-paid-bg:#DFF3E4;    --chip-paid-fg:#1D5E34;
  --chip-pending-bg:#FBEBCB; --chip-pending-fg:#7A4A05;
  --chip-error-bg:#FADADA;   --chip-error-fg:#8A1F1F;
  --chip-info-bg:#E3ECF8;    --chip-info-fg:#1F4A7A;

  /* Illustration only (never used in UI) */
  --color-peach:         #F4C7A8;
}
```

**Colour rules**
- Lime is used for: the primary button fill, one highlighted word or marker per section at most, art backgrounds, active step indicators. Never use lime as text on a light background; use `--color-lime-deep`.
- Primary button: fill `--color-lime`, text `--color-ink`, hover fill darkens ~6%, focus ring 2 px `--color-ink` with 2 px offset.
- Secondary button: transparent, 1 px `--color-ink` border, text `--color-ink`; hover fills `--color-ink` with `--color-bg` text.
- On `--color-forest`: text is `--color-ink-on-forest`, primary button remains lime.
- Verify WCAG 2.2 AA contrast for every text/background pair. Fix by darkening text, not by changing the layout.
- Dark mode: **not in v1.** Set `color-scheme: light`.

### 4.4 Typography tokens

Fonts (default pair, load via `next/font` with `display: swap`, subset to Latin):

```css
:root {
  --font-display: "Instrument Serif", "Iowan Old Style", Georgia, serif;
  --font-body:    "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

| Role | Font | Size (fluid) | Line height | Letter spacing | Weight |
|---|---|---|---|---|---|
| Display XL (hero H1) | display | `clamp(3.25rem, 9vw, 8rem)` | 0.95 | -0.035em | 400 |
| Display L (section H2) | display | `clamp(2.25rem, 5vw, 4rem)` | 1.02 | -0.025em | 400 |
| Display M (door titles, closing) | display | `clamp(1.75rem, 3.2vw, 2.75rem)` | 1.08 | -0.02em | 400 |
| H3 (step and row titles) | body | `clamp(1.25rem, 1.8vw, 1.5rem)` | 1.25 | -0.01em | 600 |
| Body L (hero subhead, lead paragraphs) | body | 1.25rem | 1.55 | 0 | 400 |
| Body | body | 1.0625rem | 1.6 | 0 | 400 |
| Small | body | 0.875rem | 1.5 | 0 | 400 |
| Caption / chip text | body | 0.75rem | 1.4 | 0.01em | 500 |
| Eyebrow | body | 0.75rem | 1.2 | 0.14em, uppercase | 600 |

**Type devices (use consistently):**
1. **Emphasis word:** in each Display headline, exactly one key word is set in the display font's *italic* in `--color-lime-deep` (on forest: `--color-lime`). Example: Printing, *rethought.*
2. **Bracket flourish:** short labels wrapped in parentheses with spaces, e.g. `( Meet CtrlP )`, set in Eyebrow style. Use only on the hero and the closing block, not elsewhere.
3. **Deliberate line breaks:** Display headlines break manually at meaningful phrases on desktop (`<br class="hidden md:block">`), and reflow naturally on mobile.
4. Max line length: 62ch for body, 18ch to 22ch for display headlines.

### 4.5 Layout, spacing, shape

All pixel values below describe design intent. Implement them as tokens in `rem` or fluid expressions (Section 9.4), never as literals in components.

- **Container:** max width 1200 px, horizontal padding 24 px (mobile), 32 px (≥640), 48 px (≥1024). Full-bleed backgrounds are allowed; content stays in the container.
- **Grid:** 12 columns, 24 px gap (≥1024); 8 columns, 20 px gap (640 to 1023); 4 columns, 16 px gap (<640).
- **Breakpoints:** sm 640, md 768, lg 1024, xl 1280. Design mobile first.
- **Spacing scale (px):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Section vertical padding: `clamp(80px, 12vw, 160px)`.
- **Radius:** sm 10, md 16, lg 24, xl 32, pill 999.
- **Elevation:** `--shadow-card: 0 1px 2px rgba(17,22,17,.06), 0 12px 32px -12px rgba(17,22,17,.16)`. Device frames use `--shadow-card`; flat panels use only a 1 px `--color-line` border.
- **Hairlines:** 1 px `--color-line`.

### 4.6 Painterly art (Leedlime-inspired backgrounds)

Create a reusable `<Hills />` component and a static `public/art/hills.svg`:
- 3 to 4 overlapping soft hill shapes (cubic bezier paths) in `--color-lime-soft`, `#CFE79A`, and `--color-lime` at 40% opacity, back to front.
- A grain overlay: SVG `feTurbulence` (baseFrequency ~0.8, 2 octaves) at 6% opacity with `mix-blend-mode: multiply`.
- Variants: `bottom` (hills anchored to the section bottom, ~35% height), `panel` (hills inside a rounded panel), `sky` (a soft lime-to-bg vertical gradient with 2 faint cloud shapes) for the closing block.
- Must be pure SVG or CSS, under 20 KB each, and never block LCP. No photos.

### 4.7 Motion

- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`. Durations: micro 160 ms, standard 320 ms, scene 600 ms.
- Entrance pattern: opacity 0→1 and translateY 24 px→0, triggered once when 20% of the element is in view; stagger siblings by 80 ms.
- Motion must explain cause and effect (an order moving from phone to desktop), not decorate.
- **`prefers-reduced-motion: reduce`:** disable all transforms, marquee scrolling and looping scenes. Show the final static state of every animated visual.
- Pause any looping animation when the tab is hidden or the element is off-screen.
- Libraries: CSS and IntersectionObserver first. Framer Motion is allowed for the how-it-works scene if it keeps the initial JS under the budget in 7.3.

### 4.8 Iconography and imagery

- No icon sets for decoration. Allowed UI glyphs inside concept screens only: check, dot, arrow, plus, minus, chevron.
- Arrow glyph on links: "→", nudges 4 px right on hover.
- No stock photography. Imagery is limited to concept UI, painterly art and the founder illustration.

### 4.9 Concept tag (required component)

`<ConceptTag />`: a pill with a small lime dot and the text "Concept". Style: `--color-surface` fill, 1 px `--color-line` border, Caption type, 28 px high, 12 px horizontal padding. Position: top-right inside the visual's container, 16 px from the edges. Every figure containing a concept screen must also have a visually hidden caption: "Concept preview, not a live screenshot." Do not remove or hide the tag on any breakpoint.

### 4.10 Concept device components

Build two reusable, pure-HTML/CSS (no images) components so the visuals stay sharp and editable:

**`<PhoneConcept screen="upload|review|track" />`**
- Frame: 280 × 570 px at desktop scale, radius 40, 8 px `--color-ink` bezel, white screen, notch pill. Scales down with CSS transform on small screens.
- Screen contents are specified per state in Section 5.

**`<DesktopConcept screen="queue|job" />`**
- Frame: 16:10, radius 16, 1 px border, title bar with three neutral dots and the title "CtrlP for Print Shops".
- Screen contents are specified per state in Section 5.

Sample data used inside concepts (keep consistent everywhere):

| Item | Value |
|---|---|
| Order ID | `#CP10482` and `#CP10483` |
| Doc 1 | Resume.pdf · 3 pages · Colour · 1 copy · A4 · All pages · ₹30 |
| Doc 2 | Marksheet.pdf · 4 pages · Black & white · 2 copies · A4 · Pages 1, 2, 4 · ₹12 |
| Total | ₹42 |
| Printer | Xerox Printer 01 · Connected |
| Second order | `#CP10483` · ₹74 · Pay at shop |

These are sample values for illustration only; a small caption inside the first concept in view reads "Sample data".

---

## 5. Page sections (build in this order)

Section IDs: `#hero`, `#facts`, `#problem`, `#how-it-works`, `#doors`, `#trust`, `#founder`, `#contact`, then the footer.

---

### 5.1 Hero (`#hero`)

**Purpose:** state what CtrlP is and show the two sides of the product at once.
**Reference:** Vestris (statement headline, bracket flourish, product visuals beside text) + Leedlime (one clear CTA row with reassurance text under it, product card in the hero).

**Copy (final)**
- Bracket label: `( Meet CtrlP )`
- H1: **Printing, *rethought.*** (italic lime-deep on "rethought.")
- Subhead (Body L): "CtrlP connects people who need prints with the shops that make them happen. A simpler way to send documents, manage print jobs and bring the entire process together."
- Primary CTA: Explore CtrlP
- Secondary CTA: For Print Shops
- Microcopy (Small, `--color-ink-faint`): "Built for the everyday work of getting documents printed."

**Layout, desktop (≥1024)**
- Section min-height: `min(100svh, 920px)`, content vertically centred below the sticky header.
- 12-col grid. Left: columns 1 to 6. Right: columns 7 to 12.
- Left stack (top to bottom): bracket label → 24 px → H1 → 24 px → subhead (max 52ch) → 32 px → CTA row (gap 12 px) → 16 px → microcopy.
- Right: a composition container ~560 × 640 px, aligned to the right edge and vertically centred.
  - `<DesktopConcept screen="queue" />` at 520 px wide, placed top-right of the container.
  - `<PhoneConcept screen="review" />` overlapping the desktop's bottom-left by ~64 px horizontally and 120 px vertically, slightly above it in z-order, with a 3° counter-tilt (phone rotated -3°) for depth.
  - `<ConceptTag />` top-right of the container.
- Background: `--color-bg` with `<Hills variant="bottom" />` behind the lower ~35% of the section; the concept composition sits above the hills.

**Layout, tablet (640 to 1023):** single column. Text block first, then the composition scaled to ~85% width, centred.
**Layout, mobile (<640):** single column. H1 uses the smallest clamp size. CTAs stack full width (primary first). Composition below, phone at ~240 px wide in front, desktop frame at ~85% width behind and offset right.

**Concept screen content**
- Phone `review`: header "Review order"; two document rows (Doc 1 and Doc 2 from 4.10 with chips: Colour/B&W, copies, pages); price lines ₹30 and ₹12; divider; "Total ₹42"; primary button "Confirm & Pay"; small text "Pay at shop" underneath.
- Desktop `queue`: left list "New orders" with `#CP10482 · ₹42 · [Paid]` (selected) and `#CP10483 · ₹74 · [Pay at shop]`; right panel "Print queue" with `#CP10482 · Printing…`; top-right a status line "Xerox Printer 01 · Connected".

**Motion (hero scene, 6 s loop, pauses off-screen)**
1. On load: H1 reveals line by line (stagger 80 ms); subhead and CTAs fade up; composition fades up 200 ms after the text.
2. Loop: (a) "Confirm & Pay" button on the phone gets a press state; (b) a small order chip "#CP10482" travels from the phone to the desktop queue along a 600 ms curved path; (c) the queue row appears with a [Paid] chip; (d) after 1 s its status switches from "Queued" to "Printing…"; (e) hold 2 s; reset.
3. Reduced motion: show frame (d) statically.

**Acceptance criteria**
- H1 is visible without scrolling at 1366 × 768 and at 390 × 844.
- Composition never overflows horizontally at any width from 320 px.
- LCP element is the H1 text, not an image. Hero art is SVG/CSS.
- Concept tag is visible.

---

### 5.2 Fact strip (`#facts`)

**Purpose:** quick, true product facts that replace a "trusted by" badge marquee.
**Reference:** Leedlime's logo marquee position and behaviour (below the hero), with truthful content.
**Hard rule:** no logos, awards, ratings, customer names or numbers of users.

**Content (each item is a [VERIFY] claim; render only verified items):**
1. Upload PDF, DOCX, PPTX, JPG or PNG
2. No account needed
3. Colour or black & white
4. Choose copies and pages
5. See the price before you pay
6. Pay online or at the shop
7. Track your order

**Layout:** full-bleed strip, 72 px high, top and bottom hairlines `--color-line`. Items in a single horizontal track, each separated by a 6 px `--color-lime` dot. Item type: Body, weight 500, `--color-ink-soft`. Track duplicated for a seamless loop; speed ~40 s per cycle (linear); left and right edges fade with a 64 px mask gradient; pauses on hover and keyboard focus. Mobile: same, 56 px high.
**Reduced motion:** no scrolling. Items wrap centred on up to two lines.
**Accessibility:** the track is `aria-hidden="true"` for the duplicate copy. The visible copy is a normal `<ul>`.

---

### 5.3 Problem to solution (`#problem`)

**Purpose:** show the familiar messy workflow and the cleaner CtrlP order, with respect for how shops work today.
**Reference:** Vestris (single focused narrative band, one transition, warm tone).

**Copy (final)**
- Eyebrow: THE WAY WE PRINT TODAY
- H2: **A simple print job shouldn't take *so much work.***
- Body: "A customer sends a document on WhatsApp. The shop downloads it, checks the instructions, works out the settings and starts printing. It works, but too much depends on manual steps and repeated explanations."
- Closing line (Display M, centred, below the band): "The problem isn't printing. It's everything *around it.*"

**Layout, desktop:** container with 12-col grid; left columns 1 to 5 hold eyebrow, H2 and body; right columns 7 to 12 hold the transition visual, 480 px high, in a `--color-surface-sunken` panel (radius xl, no border). The closing line sits 96 px below, centred, max width 20ch per line (two lines).
**Layout, mobile:** text first, then the visual (360 px high), then the closing line.

**Visual (illustrative, not a screenshot):**
- *State 1 (messy):* four chat bubbles and two file chips scattered with slight random rotation (±4°): "Please print this, colour" / "How many copies?" / "2, and only pages 1 to 5" / "sorry, send again"; file chips "resume_final_v2.pdf" and "marksheet (1).pdf". Bubbles in white with a 1 px border; no real app branding or logos.
- *State 2 (clean):* a single structured order card, white, `--shadow-card`, containing "Order #CP10482", two document rows (Doc 1 and Doc 2), and a [Paid] chip.
- *Transition:* on scroll into view, bubbles and chips slide and shrink toward the card's centre while fading, and the clean card scales up from 0.96 to 1. Duration 600 ms, triggered once. Reduced motion: show State 2 only, with the messy state omitted.
- Caption under the visual (Caption type): "Illustrative. Not a live screenshot." plus `<ConceptTag />`.

**Acceptance:** no text implies shop owners are inefficient; both states are legible at 320 px.

---

### 5.4 How it works, 3 steps (`#how-it-works`)

**Purpose:** the product demonstration. Explain the order journey in three beats.
**Reference:** Leedlime (numbered steps with a visual per step) + Vestris (sticky visual that changes while text scrolls).

**Copy (final)**
- Eyebrow: HOW IT WORKS
- H2: **One order. A *clearer* way forward.**
- Intro (Body L): "From the first upload to the final print, CtrlP is designed to make each step easier to understand."

| # | Title (H3) | Line (Body, `--color-ink`) | Detail (Body, `--color-ink-soft`) |
|---|---|---|---|
| 01 | Upload and configure | Your documents, your settings. | Scan the shop's QR code and upload your files. For each one, choose colour or black and white, copies, paper size and pages. See the price before you pay. |
| 02 | The shop takes it from here | Orders arrive structured. | The shop reviews the order in its desktop software, accepts it, and sends the job to a connected printer. **[VERIFY: automated printer execution]** |
| 03 | Collect | Ready when you are. | Follow your order's progress and pick up your prints when the shop marks them ready. |

- Closing links under the steps: "See how printing works →" (`/print`) and "See the shop experience →" (`/print-shops`).

**Layout, desktop (≥1024):**
- The section is a tall scroll container (about 3 × 85vh) with a two-column grid.
- Left, columns 1 to 5: H2 and intro at the top (not sticky), then the three steps stacked with 40vh spacing between them. Each step shows its number ("01" in display font, 48 px, `--color-ink-faint`), title, line and detail. The active step is full opacity; inactive steps are 35% opacity. A 2 px vertical progress line at the left of the steps fills with `--color-lime` as you scroll.
- Right, columns 7 to 12: a sticky panel (`position: sticky; top: 12vh; height: 76vh`), radius xl, containing `<Hills variant="panel" />`, with the active concept centred inside. `<ConceptTag />` top-right.
- The concept crossfades (320 ms) when the active step changes. Active step is the one whose centre is nearest the viewport centre (IntersectionObserver).

**Layout, mobile (<1024):** no sticky behaviour. Each step is a vertical block: concept panel (aspect 4:5, rounded, hills background) above, then number, title, line and detail. Steps separated by 64 px.

**Concept states**
- **Step 01 (phone `upload`):** screen title "Your documents"; a document card "Resume.pdf · 3 pages · 120 KB" with a remove "×"; settings below it: toggle [Colour | B&W] (Colour selected), copies stepper "− 1 +", paper "A4", pages "All pages" with a small "Selected pages" option; button "Continue".
- **Step 02 (desktop `job`):** left list "New orders" with `#CP10482 · ₹42 · [Paid]` selected; right "Print job": Printer "Xerox Printer 01 · Connected", then "Colour · A4 · 1 copy · All pages"; button "Accept order". On entering the step: the button presses, becomes a [Printing…] chip, and a thin progress bar fills.
- **Step 03 (phone `track`):** "Order #CP10482"; checklist: ✓ Order submitted, ✓ Shop accepted, ✓ Printing, ● Ready for pickup, ○ Completed; chip [Paid]. On entering the step: "Ready for pickup" dot fills lime.

**Acceptance criteria**
- Concept states match the sample data in 4.10.
- Works with keyboard scrolling; no scroll hijacking (do not use scroll-jacking libraries; sticky plus IntersectionObserver only).
- Reduced motion: crossfade replaced by instant swap; progress line static.

---

### 5.5 Two doors (`#doors`)

**Purpose:** route visitors to the persona pages, which replace the old Differentiator, For Print Shops and part of the Contact sections.
**Reference:** Vestris (large confident panels, restrained copy) with Leedlime colour and art.

**Copy (final)**
- Eyebrow: TWO WAYS IN
- H2: **Two ways in. *One* connected workflow.**

*Door A: people printing*
- Label (Eyebrow): FOR PEOPLE PRINTING
- Title (Display M): "Got something to *print?*"
- Body: "Scan the QR code at a participating print shop, upload your documents and send your order. No account needed." **[VERIFY: no account needed]**
- Link button (secondary): See how printing works →
- Note (Small): "CtrlP orders start from a shop's QR code, so look for it at the counter."

*Door B: print shops*
- Label (Eyebrow): FOR PRINT SHOPS
- Title (Display M): "Run a print *shop?*"
- Body: "Receive structured orders, manage print jobs in one place and connect supported printers through the desktop app." **[VERIFY: printer integration wording stays "supported printers"]**
- Primary button: Discover CtrlP for Print Shops
- Text link: Talk to us →

**Layout, desktop:** two equal panels (6 cols each), gap 24 px, min-height 560 px, radius xl.
- Panel A: `--color-surface` with a 1 px `--color-line` border. `<Hills variant="panel" />` fills the lower 45%. A cropped `<PhoneConcept screen="upload" />` rises from the bottom edge, bottom 40% hidden by the panel edge, right-aligned.
- Panel B: `--color-forest` with `--color-ink-on-forest` text. A cropped `<DesktopConcept screen="queue" />` rises from the bottom edge, right-aligned. Lime accents only: the primary button and the emphasised word.
- Text sits top-left in both (padding 40 px).
- Each panel carries a small `<ConceptTag />` (on forest: forest-tinted variant with `--color-line-on-forest` border).
- Hover (desktop): panel translates up 4 px, shadow `--shadow-card`, the concept art translates up 8 px. 320 ms.

**Layout, mobile:** panels stacked, each min-height 520 px, concept art below the text and cropped at the panel bottom.

**Acceptance:** the two destinations are unambiguous within 3 seconds of reading; Door A never starts an order.

---

### 5.6 Trust strip (`#trust`)

**Purpose:** a calm, honest statement of control and care. This section is intentionally understated.
**Reference:** Vestris ("a human reviews every step" framing, numbered rows, no security theatre).

**Copy (final)**
- Eyebrow: DESIGNED WITH CARE
- H2: **You stay in control. Your documents are *protected.***
- Row 01: **The shop reviews every order.** "Automation handles repetitive steps. Shops accept each order and stay in charge of fulfilment."
- Row 02: **Controlled access.** "Access to documents is limited to the people and systems needed to fulfil the order." **[VERIFY]**
- Row 03: **Secure handling.** "Files are protected in transit and at rest, with access governed by permissions." **[VERIFY]**
- *Retention row:* do **not** render. Reserved text: "Documents are deleted according to our published retention policy." Enable only once the retention policy exists, is published at `/privacy` and the deletion behaviour is implemented.

**Layout, desktop:** `--color-surface-sunken` full-bleed band. 12-col grid: left columns 1 to 5 hold eyebrow and H2; right columns 7 to 12 hold the rows as a stacked list separated by 1 px `--color-line` hairlines. Each row: number "01/02/03" in Caption type on the left (48 px column), title in H3, text in Body `--color-ink-soft`. Row padding 32 px vertical. No icons, no cards, no padlocks.
**Layout, mobile:** eyebrow and H2, then the rows stacked.
**Rule:** unverified rows are removed from the DOM, not hidden with CSS. If fewer than two rows are verified, hide the entire section.

---

### 5.7 Founder note (`#founder`)

**Purpose:** a human, honest moment.
**Reference:** Leedlime (founder quote with portrait) adapted with an illustration instead of a photo.
**Hard rules:** do not invent a founder story, founding date, team size, hometown, previous employer or customer anecdote.

**Copy (final)**
- Eyebrow: WHY WE'RE BUILDING THIS
- H2: **We believe everyday software can be *better.***
- Body: "Print shops are part of how people study, work and get things done. Yet the process around a simple print job can still involve a lot of unnecessary manual work. We're starting with printing, learning from the people who use it and building around the realities of their work."
- Closing line (Display M): "One real problem at a time."
- Signature (Small): `{{FOUNDER_NAME}}, Founder, MeetCtrlP`
- Optional link (rendered only if `/journey` is enabled): Follow our journey →

**Layout, desktop:** 12-col grid. Left columns 1 to 5: illustration card (aspect 4:5, radius xl, `--color-lime-soft` background, `<Hills variant="panel" />` behind the figure). Right columns 7 to 12: eyebrow, H2, body (max 52ch), closing line, signature.
**Layout, mobile:** illustration card (aspect 4:5, max 360 px wide) first, then text.

**Illustration spec**
- Style: flat, hand-drawn look, soft grain, 2 px `--color-ink` outlines with slight imperfection, limited palette (`--color-ink`, `--color-lime`, `--color-lime-soft`, `--color-forest`, `--color-bg`, `--color-peach`).
- Scene: a person at a desk with a laptop and a small desktop printer; a few sticky notes; a plant; a window with soft hills outside. Simple, faceless or minimal features so it does not resemble a specific real person.
- Format: SVG preferred (under 60 KB); fallback WebP at 960 × 1200.
- Alt text: "Illustration of a person working at a desk with a laptop and a small printer."
- Image-generation prompt if needed: "Flat hand-drawn illustration, soft paper grain, a person with a minimal face at a wooden desk with a laptop and a small desktop printer, sticky notes, a potted plant, window showing soft rolling green hills, limited palette of near-black ink outlines, lime green, pale lime, deep forest green and off-white, calm and warm mood, no text, 4:5 vertical."

---

### 5.8 Closing CTA and contact (`#contact`)

**Purpose:** convert print shop owners and handle general enquiries.
**Reference:** Leedlime (large closing block on a soft landscape) + Vestris (warm closing line).

**Copy (final)**
- Bracket label: `( Get in touch )`
- H2 (on forest or sky art): **Have a question, an idea or a shop to bring on *board?***
- Body: "We would love to hear from you. Whether you run a print shop, want to learn more about CtrlP or have an idea worth discussing, get in touch."
- Block 1 label: **For print shop owners**. Text: "Interested in using CtrlP at your shop? Talk to us about your setup, supported printers and onboarding."
  - Primary button: Talk to us on WhatsApp
  - Secondary button: Request a call
- Block 2 label: **For general enquiries**. Text: "Have a question about MeetCtrlP or want to discuss a collaboration?"
  - Text link: Contact us →

**WhatsApp prefilled message:** "Hi MeetCtrlP, I run a print shop and I'd like to know more about CtrlP." (URL-encode it.) `{{WHATSAPP_NUMBER}}` must be the verified business number. Do not state support hours.

**Request a call form (modal or inline expand):**
- Fields: Name (required), Phone (required, validate 10 digits for India with optional +91), Shop name (optional). Nothing else.
- Submit button: Request a call. Success message: "Thanks. We'll get back to you soon." Error message: "Something went wrong. Please try WhatsApp instead."
- Notice (Small): "We'll only use your details to respond to this request. See our Privacy Policy." (link to `/privacy`)
- Protection: honeypot field and server-side rate limit (5 per hour per IP). Validate on the server. Never log phone numbers to analytics.
- Delivery: API route `/api/request-call` sends the lead to the owner by email (Resend or similar) and appends it to a Google Sheet or Notion database via env-configured webhook. Pick one with minimal setup; keep keys in environment variables.

**Layout, desktop:** full-bleed block with rounded top corners (radius xl), `--color-forest` background and `<Hills variant="sky">` tinted for dark (hills in `#1E3322` and `#2A4A30` at low contrast). 12-col grid: left columns 1 to 6 hold bracket label, H2 and body; right columns 8 to 12 hold two stacked blocks, separated by a hairline `--color-line-on-forest`. Block 1 is more prominent (larger padding, lime primary button).
**Layout, mobile:** text first, then blocks stacked; buttons full width.

---

### 5.9 Footer

**Copy (final)**
- Brand: **MeetCtrlP**. "Thoughtful software for everyday work."
- Column Product: CtrlP (`/#how-it-works`), Print User (`/print`), For Print Shops (`/print-shops`)
- Column Company: Our Journey (`/journey`, flagged), Contact (`/#contact`)
- Column Legal: Privacy Policy (`/privacy`), Terms of Service (`/terms`)
- Bottom line: "© 2026 MeetCtrlP. Made with care."
- Note under the Print User link (Small, `--color-ink-faint`): "Printing starts at a participating shop's QR code."

**Layout:** on `--color-bg`, top hairline. Desktop: brand block in columns 1 to 5, three link columns in 7 to 12, bottom bar below with a hairline. Mobile: brand block, then link columns in a 2-column grid. Omit any link to a page that does not exist. No social icons unless real accounts exist.

---

## 6. Content rules

### 6.1 Claim guardrails

- Never write: "your files are never stored", "files are deleted immediately after printing", "100% secure", "works with all printers", or any absolute claim.
- Never show: customer logos, testimonials, awards, ratings, user counts, shop counts, "as seen on" lines.
- Never imply that marketplace, B2B, API, institutional printing or advanced finishing services exist.
- Printer integration wording is always "supported printers" and "connected printer".
- Pricing amounts never appear on this page. Rupee figures appear only inside labelled concept screens as sample data.
- Contact details are real or absent. Do not invent phone numbers, addresses, team sizes, founding dates or support hours.
- Tone: thoughtful, modern, confident without boasting, human. No hype words ("revolutionary", "game-changing", "AI-powered").

### 6.2 Claims registry

Implement `src/content/claims.ts`:

```ts
export const claims = {
  fileFormats:     { text: "Upload PDF, DOCX, PPTX, JPG or PNG", verified: false },
  noAccount:       { text: "No account needed",                  verified: false },
  colourOrBw:      { text: "Colour or black & white",            verified: false },
  copiesAndPages:  { text: "Choose copies and pages",            verified: false },
  priceBeforePay:  { text: "See the price before you pay",       verified: false },
  payOnlineOrShop: { text: "Pay online or at the shop",          verified: false },
  trackOrder:      { text: "Track your order",                   verified: false },
  autoPrint:       { text: "...sends the job to a connected printer.", verified: false },
  controlledAccess:{ text: "Access to documents is limited...",  verified: false },
  secureHandling:  { text: "Files are protected in transit and at rest...", verified: false },
  retention:       { text: "Documents are deleted according to our published retention policy.", verified: false },
} as const;
```

Rendering rules: components read from this registry; unverified claims are not rendered. For the one inline claim in step 02, render a neutral fallback sentence when unverified: "The shop reviews the order in its desktop software and accepts it." The owner flips each `verified` flag to `true` after confirming that the shipped product does what the sentence says. The default for every flag at first deploy is `false`.

---

## 7. Quality requirements

### 7.1 Accessibility (WCAG 2.2 AA)

- Semantic landmarks: `header`, `nav`, `main`, `section` with `aria-labelledby`, `footer`. One `h1`. Heading levels do not skip.
- Visible focus on every interactive element; minimum target size 44 × 44 px on touch.
- Skip link. Full keyboard navigation of the menu sheet, form and modal.
- Marquee pauses on hover and focus and is static under reduced motion. Looping scenes pause when off-screen.
- Concept visuals: each figure has a text caption (visually hidden allowed) and the content they show is also available as readable text or `aria-label`; decorative art is `aria-hidden`.
- Colour is never the only carrier of meaning (status chips include text).
- Form errors are announced (`aria-live="polite"`), fields have labels.

### 7.2 Responsive behaviour

- Test at 320, 375, 390, 768, 1024, 1280, 1440 and 1920 px widths.
- No horizontal scrolling at any width. Concept devices scale with CSS `transform` or container query units, not fixed overflow.
- Touch: all hover effects have non-hover equivalents or are decorative only.

### 7.3 Performance budget

- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95.
- LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- Initial JavaScript ≤ 150 KB gzipped. Lazy-load the how-it-works scene, form modal and illustration below the fold.
- Fonts: at most 2 families, Latin subset, `font-display: swap`, preload the display font used in the hero.
- Art: SVG or CSS only; total art payload under 120 KB.

### 7.4 SEO and sharing

- `<title>`: "MeetCtrlP | CtrlP, a simpler way to print"
- Meta description: "CtrlP connects people who need prints with the local shops that make them happen. A simpler way to send documents and manage print jobs."
- Canonical: `https://meetctrlp.in/`. `theme-color`: `#F8F9F8`. `lang="en-IN"`.
- Open Graph and Twitter card: title as above, same description, image 1200 × 630 (off-white background, lime hills, wordmark and "Printing, rethought." set in the display font; no product claims). Owner may replace with a custom image.
- JSON-LD `Organization` with name and URL only. Do not add address, phone or social profiles unless real.
- `robots.txt` allows all; `sitemap.xml` lists `/`, `/print`, `/print-shops`, `/privacy`, `/terms` (and `/journey` only when enabled).
- Add a favicon (lime dot or "C" mark on forest), Apple touch icon and web manifest.

---

## 8. Analytics

Use a privacy-friendly tool (Plausible, PostHog with cookieless mode, or similar). No third-party ad pixels. No personal data in event properties.

| Event | Trigger | Properties |
|---|---|---|
| `nav_click` | Header link click | `label` |
| `cta_explore_click` | Primary CTA click | `location` (header, hero) |
| `cta_print_shops_click` | Any link to `/print-shops` | `location` |
| `door_user_click` | Door A link | none |
| `door_shop_click` | Door B primary link | none |
| `how_it_works_step_view` | A step becomes active | `step` (1 to 3) |
| `whatsapp_click` | WhatsApp button | `location` |
| `request_call_open` | Form opened | none |
| `request_call_submit` | Successful submit | none (never the contact details) |
| `section_view` | Section reaches 50% visibility | `id` |

---

## 9. Engineering requirements (mandatory)

These rules override convenience. If a design value, copy line or link in this PRD conflicts with a rule here, keep the PRD's intent and implement it the way this section requires.

### 9.1 Stack

| Layer | Requirement |
|---|---|
| Framework | **Next.js**, App Router, latest stable release. Server Components by default. Pages are statically generated. |
| Language | **TypeScript** in strict mode (see 9.6). |
| Styling | **Tailwind CSS**, latest stable major, mobile-first, driven only by design tokens (see 9.4 and 9.7). |
| Runtime and tooling | Node LTS (pin in `.nvmrc`), pnpm, ESLint, Prettier, Husky with lint-staged. |
| Hosting | Vercel. |
| Allowed helpers | `clsx` with `tailwind-merge` (a single `cn()` helper), `class-variance-authority`, `zod`, `framer-motion` (optional, lazy-loaded), the chosen analytics client. |
| Not allowed without owner approval | Component kits that bring their own theme (MUI, Chakra, Ant), CSS-in-JS runtimes, jQuery, moment, large icon packs, any UI library that duplicates what Tailwind and the components here already do. |

### 9.2 Rule 1: the site is fully responsive

1. **Mobile first.** Write base styles for the smallest screen, then layer up with `sm`, `md`, `lg`, `xl`. Start designing at 360 px width.
2. **Fluid, not fixed.** Use `rem`, `%`, `fr`, `minmax()`, `clamp()`, `min()`, `max()`, `aspect-ratio`, `gap` and flex or grid. No fixed pixel widths or heights on layout containers. Fixed sizes are allowed only for hairlines and for the intrinsic size of an icon or device frame, and even then through a token (9.4).
3. **Fluid type and spacing.** Type sizes and section padding come from `clamp()` tokens, so text scales smoothly between breakpoints without jumps.
4. **Container queries for components.** Concept devices, bento tiles, cards and the journey panel respond to the width of their container (`@container`), not only the viewport, so they work wherever they are placed.
5. **Modern viewport units.** Use `svh`, `dvh` and `lvh` instead of `vh` so mobile browser toolbars do not break full-height sections. Respect safe areas (`env(safe-area-inset-*)`) for sticky headers and bottom elements.
6. **No horizontal scroll** at any width from 320 px to 2560 px. Long words, tables and code wrap or scroll inside their own container.
7. **Images and art** scale to their container, declare intrinsic dimensions (or `aspect-ratio`) to avoid layout shift, and use `next/image` with accurate `sizes` for any raster file. SVG art scales with `viewBox`.
8. **Touch and pointer.** Tap targets are at least 44 × 44 px. Hover-only behaviour has a touch equivalent. Use the `hover` variant only where `(hover: hover)` applies.
9. **Resilience.** The layout survives 200% browser zoom, user font-size increases, landscape phones, tablets in both orientations, and very wide desktop screens (content stays in its container; backgrounds may go full-bleed).
10. **Responsive behaviour is defined once.** Breakpoints live in a single configuration (see 9.3). Components never invent their own breakpoint values.

### 9.3 Rule 2: nothing is hardcoded

Every value has exactly one home. Components read from it. Changing the value in its home changes the site everywhere with **no component edits**.

| Kind of value | Single source of truth | How components use it |
|---|---|---|
| Colours | CSS variables in `src/styles/tokens.css`, mapped into the Tailwind theme | Semantic classes such as `bg-bg`, `text-ink`, `bg-lime`. **No** hex, rgb or hsl values in TSX or in any CSS file except `tokens.css`. **No** default Tailwind palette (`bg-green-500`) and **no** arbitrary colour (`bg-[#B8E04A]`). |
| Typography | Font variables and fluid `clamp()` size tokens in the theme | Classes such as `text-display-xl`, `text-body`. No inline font sizes. |
| Spacing, radius, shadow, durations, easings, z-index layers, container width | Theme tokens | Theme classes only. **No arbitrary values** such as `w-[537px]`, `mt-[13px]`, `rounded-[18px]`, `z-[9999]`. |
| Breakpoints | One `breakpoints` object in the Tailwind theme, imported wherever JavaScript needs it | Tailwind prefixes in CSS; a shared constant in JS (prefer CSS-only responsiveness so JS rarely needs it). |
| Text and microcopy (including `aria-label`, alt text, button labels, error messages) | Typed modules in `src/content/` | Components receive text through props or import it from `src/content`. **No string literals of visible or accessible text in JSX.** |
| Lists of things (nav links, journey steps, bento tiles, FAQ items, footer links, fact items) | Typed arrays of objects in `src/content/` | Rendered with `.map()`. Adding, removing or reordering an item requires **zero component changes**. |
| Links, routes and external URLs | `src/config/routes.ts` and `src/config/site.ts` (URLs built from env values) | Helper functions such as `whatsappLink(message)` and `mailtoLink()`. No URL strings inside components. |
| Business values (WhatsApp number, contact email, domain, app URL, plan data, sample data for concept screens) | Environment variables and typed config modules; private data in a `server-only` module | Imported through the config layer. Sample orders, rupee amounts and printer names live in one `sampleData` module. |
| Feature flags | `src/config/flags.ts`, read from env and validated | Components check a flag; they never read `process.env` directly. |
| Product claims | The claims registry (`src/content/claims.ts`) | Components render a claim or its fallback through one helper. |
| Analytics event names and properties | `src/config/analytics.ts` (a constant object) | A single `track(event, props)` wrapper. No event name strings in components. |
| Images and art | A typed asset manifest (path, alt key, intrinsic size) | `next/image` or the art components read from the manifest. |
| Year, dates, number and currency formatting | Computed at render with `Intl` (`en-IN` locale) from a `format` helper | No typed-in years or formatted amounts. |

**Allowed literals:** `0`, `1`, `100%`, array indexes, CSS keywords, HTML or ARIA semantic attribute values, and design-system hairlines expressed through a token (`--hairline`).

**"Dynamic" here means** single source of truth and configuration-driven rendering. It does not mean fetching everything from a server at runtime. Pages stay statically generated.

**CMS-ready, not CMS-built.** Access all content through a thin layer (`getContent()` or equivalent) so a CMS can replace the files later without changing any component.

**Environment variables** are validated at build and start by a `zod` schema in `src/config/env.ts`. A missing or malformed required value fails the build. Only non-secret values use the `NEXT_PUBLIC_` prefix. Secrets and private business data stay server-only (use the `server-only` package).

**Enforcement (the build must fail on violations):**
- ESLint: `react/jsx-no-literals` (strict, allowing only whitespace and punctuation), `eslint-plugin-tailwindcss` with `no-arbitrary-value` and `no-custom-classname`, `no-restricted-syntax` rules that ban hex colour literals and numeric pixel values in `style` props, `jsx-a11y`, and `@typescript-eslint` strict rules.
- A script `pnpm audit:hardcoded` (run in CI) that scans `src/` and fails on: colour literals outside `tokens.css`; arbitrary Tailwind values; `http(s)://` URLs outside `src/config`; phone-number or email patterns outside config; `₹` amounts outside the `sampleData` module; `process.env` access outside `src/config`.

### 9.4 Design tokens implementation

- `src/styles/tokens.css` holds every token from Section 4 as CSS variables. It is the only file that may contain raw colour, size or timing values.
- The Tailwind theme maps those variables to semantic names (colours, fluid type, spacing, radius, shadows, durations, easings, z-index layers, breakpoints, container widths). Use the theme mechanism of the Tailwind major version in use (`@theme` in CSS for v4, `theme.extend` for v3).
- Token names are semantic (`ink`, `bg`, `surface`, `lime`, `chip-paid-bg`), never descriptive of a value (`green-light`).
- Every pixel figure written in this PRD describes **design intent**. Implement it as a token in `rem` or a fluid expression, not as a literal in a component.
- Example mapping (illustrative):

```css
/* tokens.css (only place raw values may appear) */
:root {
  --color-bg: #F8F9F8;
  --color-ink: #111611;
  --space-section: clamp(4.5rem, 11vw, 9.5rem);
  --radius-xl: 2rem;
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --duration-standard: 320ms;
}
```

```css
/* Tailwind v4 theme mapping (adapt for v3) */
@theme {
  --color-bg: var(--color-bg);
  --color-ink: var(--color-ink);
  --spacing-section: var(--space-section);
  --radius-xl: var(--radius-xl);
  --ease-standard: var(--ease-standard);
}
```

### 9.5 Project structure and code organisation

```
src/
  app/                 layout.tsx, page.tsx, api/, privacy/, terms/, sitemap.ts, robots.ts, manifest.ts,
                       error.tsx, not-found.tsx, loading.tsx
  components/
    ui/                Button, Chip, ConceptTag, Accordion, Tabs, Modal, Marquee (generic, reusable)
    layout/            Header, Footer, Container, Section
    sections/          one file per page section, named after it (Hero.tsx, Journey.tsx, ...)
    concepts/          PhoneConcept, DesktopConcept, Hills (presentational, data-driven)
  content/             copy, claims, nav, faq, steps, tiles, sampleData (typed, no JSX)
  config/              env.ts, site.ts, routes.ts, flags.ts, analytics.ts
  lib/                 cn.ts, links.ts, format.ts (Intl en-IN), validation.ts (zod), hooks/
  styles/              tokens.css, globals.css
  types/               shared types
tests/                 unit and e2e
scripts/               audit-hardcoded.ts
```

- Server Components by default. Add `"use client"` only to interactive leaves (mobile menu, tabs, accordion, journey scroll scene, call form, looping hero scene).
- One component per file, named exports (default exports only for Next.js pages and layouts), absolute imports with the `@/` alias, no deep relative paths.
- Keep components under about 200 lines. Split by responsibility. No business logic in JSX; move it to `lib/`.
- Sections are **data-driven**: a section component takes typed content as props (or imports one content module) and renders it with `.map()`.
- Variants use discriminated unions or `cva`, not boolean prop piles. Use `as const` and `satisfies` for config objects.
- Compose small components instead of long prop lists. Avoid prop drilling beyond two levels; use composition.
- No dead code, commented-out code or `console.log` in committed code.

### 9.6 TypeScript rules

- `tsconfig`: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`.
- No `any`. No `@ts-ignore`; if a suppression is unavoidable use `@ts-expect-error` with a written reason.
- Use `import type` for type-only imports. Prefer `type` aliases and `const` objects over `enum`.
- Define every external boundary with a `zod` schema (env, form input, API request and response) and infer types from the schema.
- Public component props are explicitly typed and documented with short TSDoc where the intent is not obvious.

### 9.7 Tailwind rules

- Mobile-first utilities only; add `sm:`, `md:`, `lg:`, `xl:` to enhance.
- Use only theme-backed utilities (9.3). Arbitrary values are forbidden except for genuinely one-off CSS properties that have no token, and then only with a code comment justifying it and owner-visible in review.
- Conditional classes through `cn()`. Repeated class patterns become components or `cva` variants, not `@apply` chains.
- Order classes automatically with `prettier-plugin-tailwindcss`.
- Prefer logical properties (`ms-`, `me-`, `ps-`, `pe-`) where direction could matter later.
- Use `motion-safe:` and `motion-reduce:` variants, `focus-visible:` for focus rings, `min-h-dvh` and friends for viewport sizing, and container-query utilities for component-level responsiveness.
- Dark mode is disabled for v1 (`color-scheme: light`).

### 9.8 Next.js practices

- Use the Metadata API (`generateMetadata` or the `metadata` export) fed from `src/config/site.ts` and `src/content`. Do not hand-write `<head>` tags.
- Fonts through `next/font` (self-hosted, subset, `display: swap`, size-adjusted fallbacks). Images through `next/image` with accurate `sizes`; set `priority` only on a real LCP image.
- Analytics through `next/script` with `afterInteractive`, loaded behind one wrapper.
- Lazy-load heavy, below-the-fold client components with `next/dynamic`. Use `ssr: false` only when truly required.
- Route handlers: validate input with `zod`, apply rate limiting and a honeypot, return typed JSON with correct status codes, never leak internals in errors.
- Provide `error.tsx`, `not-found.tsx` and `loading.tsx` with on-brand, accessible fallbacks.
- `next.config`: `reactStrictMode: true`, `poweredByHeader: false`, security headers (CSP with nonce via middleware, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`, HSTS), and the bundle analyzer behind an env switch.
- Generate `sitemap.xml`, `robots.txt` and the web manifest from code (`sitemap.ts`, `robots.ts`, `manifest.ts`) using config values.
- No secrets in client bundles. Private config uses `server-only`.

### 9.9 State, forms, i18n readiness

- No global state library. Local state and URL state only (for example, the FAQ tab lives in the URL hash).
- Forms: native elements with `zod` validation on both client and server, accessible error messaging, progressive enhancement (the form works without JavaScript through a standard POST to the route handler where practical).
- Make copy **i18n-ready** even though v1 ships in English: content modules are keyed objects, numbers and currency use `Intl.NumberFormat("en-IN")`, and no sentence is built by concatenating fragments.

### 9.10 Accessibility and performance practices (supplements Section 7)

- `eslint-plugin-jsx-a11y` enabled. `axe-core` runs inside the end-to-end tests.
- A `useReducedMotion` hook (or CSS-only equivalent) gates all animation. Looping scenes pause off-screen through IntersectionObserver.
- Reserve space for every image, device frame and embed to prevent layout shift. Below-the-fold sections may use `content-visibility: auto` with an intrinsic size hint.
- Keep client JavaScript small: prefer CSS for animation and layout, split routes and components, and check the bundle analyzer before release.

### 9.11 Quality gates and tooling

- **Scripts (all must exist):** `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `test`, `test:e2e`, `audit:hardcoded`, `analyze`.
- **Pre-commit:** Husky and lint-staged run ESLint, Prettier and type checks on changed files. Commit messages follow Conventional Commits (commitlint).
- **CI (GitHub Actions or equivalent) runs on every pull request:** install, `typecheck`, `lint`, `audit:hardcoded`, `test`, `build`, Playwright e2e, and Lighthouse CI against the budgets in Section 7.3. Any failure blocks the merge.
- **Unit tests (Vitest and Testing Library):** claims registry and fallback rendering; link builders (WhatsApp, mailto); phone and form validation schemas; FAQ items with missing placeholder answers are not rendered; gated data (for example prices, when its flag is off) is absent from rendered output; `format` helpers for `en-IN`.
- **End-to-end tests (Playwright) at 360, 768 and 1280 px widths:** no horizontal overflow, primary CTA visible above the fold, full keyboard navigation of the menu, tabs, accordion and modal, reduced-motion behaviour, form success and error states, axe violations equal zero.
- **Dependencies:** pin versions, enable Dependabot or Renovate, review additions against the "not allowed" list in 9.1.
- **Repository hygiene:** `.env.example` listing every variable (no values), `.nvmrc`, `.editorconfig`, and a `README` that explains setup, scripts, how to edit content, how to flip flags and claims, and how to add a new section.

### 9.12 Environment variables

`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_SHOW_JOURNEY` (default `false`), plus the lead delivery keys (server-only).

All variables are documented in `.env.example` and validated in `src/config/env.ts`.

### 9.13 Out of scope for v1

CMS integration (the content layer must stay CMS-ready), login, dark mode, a language toggle (copy stays i18n-ready), a blog and a live chat widget.

## 10. Build order, QA and launch

### 10.1 Suggested build order

1. Tokens, fonts, layout shell, header, footer.
2. Concept components (ConceptTag, PhoneConcept, DesktopConcept, Hills) with all screen states from 4.10 and Section 5.
3. Hero with static concept composition, then its loop animation.
4. Fact strip, Problem band, Doors, Trust, Founder, Contact (static first).
5. How-it-works sticky scene.
6. Request-a-call form and API route.
7. Stub routes (`/print`, `/print-shops`, `/privacy`, `/terms`), flags, claims registry.
8. SEO, analytics, accessibility and performance pass.

### 10.2 Definition of done

- `pnpm typecheck`, `pnpm lint`, `pnpm audit:hardcoded`, `pnpm test`, `pnpm test:e2e` and `pnpm build` all pass with zero violations.
- Dragging the viewport from 320 px to 2560 px shows no broken layout and no horizontal scroll.
- Spot checks need no component edits: change the accent colour token, a nav label, the WhatsApp number and a claim flag, and see each update everywhere it is used.
- Every section matches its layout, copy and acceptance criteria.
- Zero unverified claims render (all `claims` flags default to `false` and the page still reads well without them).
- Every concept visual shows the Concept tag.
- No broken links; no link to an unbuilt route that lacks a stub.
- All checks in Section 7 pass, including reduced-motion testing.
- Lead form tested end to end with a real submission and email/sheet delivery.

### 10.3 Inputs the owner must supply before launch

| Input | Used in |
|---|---|
| `{{WHATSAPP_NUMBER}}` (verified business number) | Contact CTA |
| `{{CONTACT_EMAIL}}` | "Contact us", form delivery |
| `{{FOUNDER_NAME}}` | Founder signature |
| Privacy Policy and Terms text | `/privacy`, `/terms` |
| Confirmation of each claim in the claims registry | Fact strip, step 02, trust rows |
| Retention policy (period and deletion behaviour) | Optional trust row |
| Final illustration (or approval to generate one) | Founder section |
| Approval of the proposed colour values after sampling Leedlime | Design tokens |
| Approval of the font pair after inspecting Vestris | Typography |

### 10.4 Post-launch (not in v1)

- Replace concept visuals with real screenshots or recordings as the product ships; remove the Concept tag per visual only when the visual is a real capture.
- Enable `/journey` and add the first real changelog entry.
- Add the Print Shop page's bento, pricing and FAQ (separate PRD).
- Optional interactive hero demo: a visitor drops any PDF and sees a simulated order card built from its filename and size only, processed entirely in the browser and never uploaded. Must be labelled Concept.