# CtrlP Print Partner Website: Product Requirements Document (PRD)

**Site:** a standalone website, separate from `meetctrlp.in` (main brand site) and from `app.meetctrlp.in` (Print User web app).
**Suggested domain:** `{{SITE_DOMAIN}}`, default recommendation `shops.meetctrlp.in`.
**Version:** 1.0 (build-ready)
**Audience for this document:** an AI agent or developer that will design and build the site end to end.
**Read order:** Sections 1 to 3 give context and rules. Section 4 is the design system. Section 5 specifies every page section. Sections 6 to 10 cover content rules, quality, analytics, tech and launch.

---

## 0. How to use this document

1. Build exactly the sections in Section 5, in that order. Do not add sections.
2. Use the tokens in Section 4 as the single source of truth for colour, type, spacing and motion.
3. All copy in Section 5 is final unless marked `{{PLACEHOLDER}}`. Do not rewrite it or add claims.
4. Every product visual is a **concept** unless it is a real screenshot of the live Print User app (see 4.9). Concepts carry the Concept tag.
5. Anything marked **[VERIFY]** is a factual claim controlled by the claims registry (Section 6.2). It renders only when `verified` is `true`; otherwise its neutral fallback renders.
6. Prices are **never shown**. The pricing section is a custom-plan section (5.8).
7. When something is ambiguous, choose the simpler option and leave a `TODO(owner)` comment. Do not stop to ask.

**Engineering rules are mandatory.** The site is built with Next.js, TypeScript and Tailwind CSS, must be fully responsive, and must contain no hardcoded values. Read Section 9 before writing any code. Where a pixel value, colour, string or link appears in this PRD, it describes intent; implement it through tokens, content modules and config as Section 9 requires.

---

## 1. Product context

**Company:** MeetCtrlP (a brand; not yet a registered company. Do not add legal suffixes such as Pvt Ltd or Inc anywhere).
**Product:** CtrlP, a QR-based printing workflow that connects people who need prints with local print shops.

**Print User (customer):** scans the shop's QR code, uploads documents, chooses colour or black and white, copies, A4 and page selection per document, sees the price, pays online or at the shop, submits, tracks and collects. No account needed. Their web app lives at `app.meetctrlp.in`.

**Print Shop Partner (the paying customer):** uses desktop software to receive structured orders, validate and accept them, send print jobs to local printers through a local print agent, handle failures, mark orders ready, collect cash if needed and complete orders.

**Money model:** the Print User pays the print job amount to MeetCtrlP, which settles the full amount to the shop. **0% commission on print jobs.** Revenue comes only from the shop's plan, not from a cut of print payments.

**Existing app page (for reference):** `app.meetctrlp.in` shows the tagline "Print it. Pick it. Done.", a "Scan QR code" card, an explainer video, three promises (Safety, Security, No Peek Policy) and an FAQ. This new site must not duplicate the app. It explains the journey and sells the shop side.

---

## 2. Purpose, goals, non-goals

### 2.1 One job for this site

> Help an Indian print shop owner understand how CtrlP works for their counter, trust it, and start a conversation. Help a customer understand how printing works at a CtrlP shop.

The story runs in order: **customer starts the journey, the shop completes it.** About 30% of the page is for customers (short), about 70% is for shop owners.

### 2.2 Goals (priority order)

1. **Shop lead generation:** WhatsApp chats and call requests from print shop owners.
2. **Understanding:** a shop owner can explain CtrlP back to someone else after one scroll.
3. **Trust:** honest copy, privacy promises, no fake proof.
4. **Customer clarity:** a customer understands how a CtrlP print order works and where to start.

### 2.3 Non-goals

- Showing any plan price, rupee-per-day figure or plan name (a feature flag exists but is off; see 5.8).
- Login, sign-up, dashboards or order creation (those live in the apps).
- Testimonials, customer logos, award badges, "trusted by", counts of shops or users, ratings. None exist yet and none may be invented.
- A blog, changelog, careers page or marketplace promotion.

### 2.4 Audience and context (India)

| Audience | Reality to design for |
|---|---|
| **Print shop owners** (small stationery, Xerox and cyber-cafe style shops, busy college-area print shops) | Mostly on a phone, often on mid-range Android and 4G. WhatsApp is the main business channel. Time-poor and cautious about new software and fees. Wants proof it is simple and that money is safe. |
| **Customers** (students, job seekers, office staff, parents) | Mobile first. Needs a quick explanation, then goes to the shop's QR. |

**India-specific rules:** prices in ₹ with Indian number grouping (`en-IN`); phone numbers in `+91` format; WhatsApp is the primary contact channel; plain, short English sentences; light, natural Hinglish only in illustrative microcopy (for example chat bubbles in the problem section), never in headlines. Hindi language toggle is out of scope for v1.

### 2.5 Success metrics

Do not invent baselines; review after two weeks of live traffic.

| Type | Metric |
|---|---|
| Primary | WhatsApp clicks + Request-a-call submissions per 100 visitors |
| Secondary | Reach of the "Plans" section; reach of the FAQ (Print shops tab) |
| Engagement | Journey section completion (all 5 steps viewed) |
| Quality | Mobile Lighthouse Performance ≥ 90 on a throttled 4G profile |

---

## 3. Information architecture

### 3.1 Decision: one page

The site is a **single page with anchor navigation**, because the product is a connected journey and splitting it would break the story. Sections have stable IDs:

`#hero`, `#journey`, `#customers`, `#problem`, `#shops`, `#printers`, `#money`, `#plans`, `#trust`, `#start`, `#faq`, `#contact`.

### 3.2 Relationship to other properties

| Property | Relationship |
|---|---|
| `meetctrlp.in` (main site) | Its "For Print Shops" and "See how printing works" links point here (`/#shops` and `/#journey`). The main site's `/print` and `/print-shops` stub routes should redirect here (301) once this site is live. |
| `app.meetctrlp.in` | Linked from the Customers section and footer. Never describe it as a place to start an order without a shop QR code. |
| This site | Needs its own `/privacy` and `/terms` pages, or links to the main site's pages. |

### 3.3 Header (sticky)

- Left: logo wordmark "CtrlP" with a small "for print shops" label in Caption style. Links to `/`.
- Centre (desktop): **How it works** (`#journey`), **For shops** (`#shops`), **Plans** (`#plans`), **FAQ** (`#faq`).
- Right: a quiet text link **Customer? Open the app →** (`https://app.meetctrlp.in/`) and the primary button **Talk to us** (WhatsApp, 6.1 message).
- Behaviour: transparent over the hero; after 24 px scroll becomes `--color-bg` at 85% opacity with a 12 px backdrop blur and a 1 px bottom border. Height 72 px desktop, 64 px mobile.
- Mobile: wordmark left; **Talk to us** button compact; menu button opens a full-screen sheet with the four links, the customer link and the button. Trap focus; close on Escape and link click.
- Skip link "Skip to content" first.

### 3.4 CTA hierarchy (exact labels)

| Level | Label | Action |
|---|---|---|
| Primary | Talk to us on WhatsApp (header uses short "Talk to us") | `https://wa.me/{{WHATSAPP_NUMBER}}?text=...` |
| Secondary | Request a call | Opens call form (5.12) |
| Hero secondary | See how customers print | Scroll to `#journey` |
| Customer | Open the print app | `https://app.meetctrlp.in/` |
| Contextual | See how it works | Scroll to `#journey` |
| Contact | Contact us | `mailto:{{CONTACT_EMAIL}}` |

---

## 4. Design system

### 4.1 Principles

1. Editorial, minimal, confident. Large type, negative space, one accent colour.
2. Honest product visuals, clearly labelled.
3. Warm, not cold: soft off-white, painterly landscapes, a serif display face.
4. Built for a busy shop owner on a phone: short sentences, big tap targets, fast load.
5. No decorative icon on every sentence; no stock photography; the bento (5.5) is the only card grid and its tiles differ in size and content.

### 4.2 References and how they are used

| Reference | Used for |
|---|---|
| **leedlime.com** | Colour direction (soft off-white plus lime), painterly landscape art, hero product card on a painted background, numbered "three steps" with painted thumbnails, asymmetric feature grid (bento) on a painted field, comparison-style tiles, FAQ accordion, "Talk to a human" row, large closing CTA on a cloud painting, footer |
| **vestris.ai** | Typography behaviour (bracket flourish, statement headlines, deliberate line breaks, one-liners), numbered benefit rows beside one visual, sticky changing visual, big-stat treatment, "automated work, human safety" trust framing, and the **pricing pattern**: pricing is its own destination and the homepage stays quiet; here the pricing section is a custom-plan block, not a tier table |

**Verification notes for the agent:**
- Only `#F8F9F8` is confirmed from Leedlime's metadata (theme-color). The other colours below are proposed. Sample Leedlime's lime and dark text with an eyedropper and adjust to match its mood while keeping the contrast rules.
- The Vestris typeface could not be identified from page source. Inspect `vestris.ai` computed styles. If its font is free or openly licensed and fits, use it; otherwise use the default pair in 4.4. Do not use a paid font without owner approval.
- The Vestris pricing page itself could not be opened when this PRD was written. The pricing layout in 5.8 is therefore based on its homepage navigation pattern and the owner's brief. If the owner shares a screenshot of the Vestris pricing page, align spacing and hierarchy to it.

### 4.3 Colour tokens

```css
:root {
  /* Surfaces */
  --color-bg:            #F8F9F8; /* from Leedlime theme-color */
  --color-surface:       #FFFFFF;
  --color-surface-sunken:#EEF2EC;
  --color-forest:        #0F1A12;

  /* Text */
  --color-ink:           #111611;
  --color-ink-soft:      #4A554A;
  --color-ink-faint:     #667166; /* >= 4.5:1 on --color-bg */
  --color-ink-on-forest: #E9EFE6;

  /* Lines */
  --color-line:          #DCE2DB;
  --color-line-on-forest:#2A3A2E;

  /* Accent: lime */
  --color-lime:          #B8E04A; /* fills only; pair with --color-ink text */
  --color-lime-soft:     #E7F4BE;
  --color-lime-deep:     #3F7A12; /* accent TEXT/links on light (>= 4.5:1) */

  /* Concept-UI status chips (soft bg + dark text) */
  --chip-paid-bg:#DFF3E4;    --chip-paid-fg:#1D5E34;
  --chip-pending-bg:#FBEBCB; --chip-pending-fg:#7A4A05;
  --chip-error-bg:#FADADA;   --chip-error-fg:#8A1F1F;
  --chip-info-bg:#E3ECF8;    --chip-info-fg:#1F4A7A;

  /* Illustration only */
  --color-peach:         #F4C7A8;
}
```

**Colour rules**
- Lime is for the primary button fill, one highlighted word or marker per section at most, art backgrounds and active step indicators. Never lime text on light backgrounds; use `--color-lime-deep`.
- Primary button: lime fill, `--color-ink` text, hover darkens ~6%, focus ring 2 px `--color-ink` with 2 px offset.
- Secondary button: transparent, 1 px `--color-ink` border; hover fills ink.
- On forest: text `--color-ink-on-forest`; primary button stays lime.
- Verify WCAG 2.2 AA for every text and background pair. Light theme only (`color-scheme: light`).

### 4.4 Typography tokens

```css
:root {
  --font-display: "Instrument Serif", "Iowan Old Style", Georgia, serif;
  --font-body:    "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

| Role | Font | Size (fluid) | Line height | Letter spacing | Weight |
|---|---|---|---|---|---|
| Display XL (hero H1) | display | `clamp(3rem, 8.5vw, 7.5rem)` | 0.95 | -0.035em | 400 |
| Display L (section H2) | display | `clamp(2.25rem, 5vw, 4rem)` | 1.02 | -0.025em | 400 |
| Display M (door/tile/closing titles) | display | `clamp(1.75rem, 3.2vw, 2.75rem)` | 1.08 | -0.02em | 400 |
| Stat numeral | display | `clamp(5rem, 16vw, 12rem)` | 0.9 | -0.04em | 400 |
| H3 | body | `clamp(1.25rem, 1.8vw, 1.5rem)` | 1.25 | -0.01em | 600 |
| Body L | body | 1.25rem | 1.55 | 0 | 400 |
| Body | body | 1.0625rem | 1.6 | 0 | 400 |
| Small | body | 0.875rem | 1.5 | 0 | 400 |
| Caption / chip | body | 0.75rem | 1.4 | 0.01em | 500 |
| Eyebrow | body | 0.75rem | 1.2 | 0.14em, uppercase | 600 |

**Type devices**
1. **Emphasis word:** each Display headline sets one key word in the display font's *italic* in `--color-lime-deep` (on forest, `--color-lime`).
2. **Bracket flourish:** short labels as `( Label )` in Eyebrow style. Use only on the hero and the closing block.
3. **Deliberate line breaks** on desktop (`<br class="hidden md:block">`); natural reflow on mobile.
4. Max line length 62ch for body, 18 to 22ch for display headlines.
5. Use tabular numerals (`font-variant-numeric: tabular-nums`) for all ₹ amounts and order IDs in concept UIs.

### 4.5 Layout, spacing, shape

All pixel values below describe design intent. Implement them as tokens in `rem` or fluid expressions (Section 9.4), never as literals in components.

- **Container:** max 1200 px; side padding 20 px (<640), 32 px (≥640), 48 px (≥1024). Full-bleed backgrounds allowed.
- **Grid:** 12 columns, 24 px gap (≥1024); 8 columns, 20 px gap (640 to 1023); 4 columns, 16 px gap (<640).
- **Breakpoints:** sm 640, md 768, lg 1024, xl 1280. Mobile first. Design at 360 px minimum width first, because that is common among Indian Android users.
- **Spacing (px):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Section padding-y `clamp(72px, 11vw, 150px)`.
- **Radius:** sm 10, md 16, lg 24, xl 32, pill 999.
- **Elevation:** `--shadow-card: 0 1px 2px rgba(17,22,17,.06), 0 12px 32px -12px rgba(17,22,17,.16)`.
- **Hairlines:** 1 px `--color-line`.

### 4.6 Painterly art (Leedlime-inspired)

Create a reusable `<Hills />` component and `public/art/*.svg`:
- 3 to 4 overlapping soft hill shapes in `--color-lime-soft`, `#CFE79A` and `--color-lime` at 40% opacity.
- Grain overlay: SVG `feTurbulence` (baseFrequency ~0.8, 2 octaves) at 6% opacity with `mix-blend-mode: multiply`.
- Variants: `bottom` (hero), `panel` (rounded panels and bento field), `sky` (closing block, with two faint cloud shapes), `thumb` (small painted thumbnails for "How to start" steps; each thumb a different crop or palette shift).
- Pure SVG or CSS, under 20 KB each; never block LCP; no photos.

### 4.7 Motion

- Easing `cubic-bezier(0.2, 0.8, 0.2, 1)`. Durations: micro 160 ms, standard 320 ms, scene 600 ms.
- Entrance: opacity 0→1 and translateY 24 px→0 once at 20% in view; stagger siblings 80 ms.
- Motion explains cause and effect (an order moving from phone to desktop), never decorates.
- **`prefers-reduced-motion: reduce`:** disable transforms, looping scenes and the marquee-style effects; show final static states.
- Pause looping scenes off-screen and when the tab is hidden.
- Prefer CSS and IntersectionObserver. Framer Motion is allowed if the JS budget in 7.3 holds.

### 4.8 Iconography

No decorative icon sets. Allowed UI glyphs inside concept screens: check, dot, arrow, plus, minus, chevron, a printer outline. Link arrows "→" nudge 4 px on hover.

### 4.9 Concept tag and visual authenticity

`<ConceptTag />`: pill with a small lime dot and "Concept"; `--color-surface` fill, 1 px `--color-line` border, Caption type, 28 px high, 12 px horizontal padding; top-right inside the visual container, 16 px inset. Every figure with a concept screen has a visually hidden caption: "Concept preview, not a live screenshot."

- **Print User screens:** if real screenshots of the live app at `app.meetctrlp.in` exist for a given screen, use the real screenshot in a phone frame and show a small "Live app" tag instead of "Concept". If not, use the concept component. The owner supplies screenshots; do not fabricate them.
- **Shop desktop screens:** concept until the desktop app ships.
- **Bento exception:** in 5.5, one `ConceptTag` is anchored to the grid's top-right plus a caption "All screens are concept previews." instead of one tag per tile.

### 4.10 Concept components

**`<PhoneConcept screen="upload|configure|pay|track" />`** (frame 280 × 570 px, radius 40, 8 px ink bezel, white screen, notch pill; scales with CSS transform).
**`<DesktopConcept screen="queue|job|payment|routing|failure|pricing|agent" />`** (16:10, radius 16, 1 px border, title bar with three neutral dots and the title "CtrlP for Print Shops").

**Sample data (keep identical everywhere):**

| Item | Value |
|---|---|
| Order IDs | `#CP10482`, `#CP10483` |
| Doc 1 | Resume.pdf · 3 pages · Colour · 1 copy · A4 · All pages · ₹30 |
| Doc 2 | Marksheet.pdf · 4 pages · B&W · 2 copies · A4 · Pages 1, 2, 4 · ₹12 |
| Total | ₹42 |
| Second order | `#CP10483` · ₹74 · Pay at shop |
| Printers | Xerox Printer 01 (Colour, A4, A3) · HP LaserJet (B&W, A4) |
| Sample shop rates | B&W ₹2 per page · Colour ₹10 per page (shown only as "Sample") |

Each first-in-view concept shows a small "Sample data" caption.

---

## 5. Page sections (build in this order)

---

### 5.1 Hero (`#hero`)

**Purpose:** tell a shop owner what they get; give customers a way in.
**Reference:** Vestris (bracket label, statement headline) + Leedlime (product card on a painted background, one CTA row with reassurance microcopy underneath).

**Copy (final)**
- Bracket label: `( For print shops )`
- H1: **Your print shop, run from *one screen.***
- Subhead (Body L): "Customers scan your QR, upload and pay. You accept and print. No WhatsApp files, no confusion."
- Primary CTA: Talk to us on WhatsApp
- Secondary CTA: See how customers print
- Microcopy (Small, `--color-ink-faint`): "We take 0% on every print job. · Works with your existing printers." Each half is a separate **[VERIFY]** claim (`zeroCommission`, `existingPrinters`); render only verified halves.

**Layout, desktop (≥1024)**
- Min-height `min(100svh, 900px)`. 12-col grid. Left: columns 1 to 6. Right: columns 7 to 12.
- Left stack: bracket label → 24 → H1 → 24 → subhead (max 50ch) → 32 → CTA row (gap 12) → 16 → microcopy.
- Right: composition container ~580 × 620 px, vertically centred.
  - `<DesktopConcept screen="queue" />` ~540 px wide, dominant, top-right.
  - `<PhoneConcept screen="pay" />` overlapping the desktop's bottom-left by ~72 px horizontally and ~110 px vertically, tilted -3°, in front.
  - `<ConceptTag />` top-right.
- Background: `--color-bg` with `<Hills variant="bottom" />` behind the lowest ~35%.

**Tablet:** single column; text first, composition ~85% width centred.
**Mobile (<640):** single column. CTAs stack full width (primary first). Composition below: desktop frame ~92% width, phone ~220 px in front, slightly offset right.

**Concept content**
- Desktop `queue`: left list "New orders": `#CP10482 · ₹42 · [Paid]` (selected) and `#CP10483 · ₹74 · [Pay at shop]`; right panel "Print queue": `#CP10482 · Printing…`; top-right "Xerox Printer 01 · Connected".
- Phone `pay`: "Review order" with Doc 1 and Doc 2 rows, total ₹42, buttons "Pay with UPI" and "Pay at shop".

**Motion (6 s loop)**
1. Load: H1 line-by-line reveal; subhead and CTAs fade up; composition fades up 200 ms later.
2. Loop: phone "Pay with UPI" press → a small `#CP10482` chip travels along a curved 600 ms path to the desktop queue → row appears with [Paid] → after 1 s status "Queued" becomes "Printing…" → hold 2 s → reset.
3. Reduced motion: static final frame.

**Acceptance:** H1 and CTAs visible without scrolling at 360 × 740 and 1366 × 768; no horizontal overflow from 320 px; LCP element is the H1 text; hero art is SVG/CSS only.

---

### 5.2 The journey in 5 steps (`#journey`)

**Purpose:** show the whole path from the customer's scan to the shop's print and handover.
**Reference:** Vestris (numbered steps beside a sticky, changing visual) + Leedlime ("Three steps" with a painted panel per step).

**Copy (final)**
- Eyebrow: HOW IT WORKS
- H2: **One order, from QR to *counter.***
- Intro (Body L): "Here is what happens when someone prints at a CtrlP shop. Customers do the first part. You take it from there."

| # | Lane | Title (H3) | Line | Detail |
|---|---|---|---|---|
| 01 | Customer | Scan and upload | Scan the QR on your counter. | The customer opens your shop, uploads their documents and adds as many files as they need. No account. **[VERIFY: noAccount]** |
| 02 | Customer | Choose and pay | Settings and price, clear before paying. | For each document they pick colour or black and white, copies, A4 and pages. They see the price, then pay online or choose to pay at your shop. |
| 03 | Shop | You accept | The order arrives ready to review. | It shows up in your desktop app with every setting and the payment status. You check it and tap Accept. |
| 04 | Shop | It prints | Accepted orders go straight to your printer. | The job goes to the right printer through the CtrlP print agent on your shop computer. You watch it in the print queue. **[VERIFY: autoPrint]** |
| 05 | Both | Ready, collect, done | Mark ready. Hand over. Complete. | The customer sees "Ready for pickup". You collect cash if it was pay-at-shop and mark the order complete. |

Fallback for step 04 detail when unverified: "The job is prepared for your printer and tracked in your print queue."

**Layout, desktop (≥1024)**
- Tall scroll container (~5 × 70vh). Two columns.
- Top of the section (not sticky): eyebrow, H2, intro.
- Left, columns 1 to 5: steps stacked with ~35vh gaps. Each shows number (display font 48 px, `--color-ink-faint`), a lane chip ("Customer", "Shop", "Both"; Caption; lime-soft fill for Customer, forest fill with light text for Shop, outlined for Both), H3, line, detail. Active step full opacity; others 35%. A 2 px vertical progress line fills with lime.
- Right, columns 7 to 12: sticky panel (`top: 12vh; height: 76vh`), radius xl, `<Hills variant="panel" />`, active concept centred, `<ConceptTag />` top-right.
- At the panel's top edge a **two-lane indicator** shows "Customer" and "Shop" as two pill labels; the active lane is highlighted and a thin line animates across when the handoff occurs (between steps 2 and 3).
- Crossfade 320 ms between concepts. Active step = the one nearest viewport centre (IntersectionObserver). No scroll hijacking.

**Layout, mobile:** no sticky. Each step is a block: concept panel (aspect 4:5, hills background) above; then number, lane chip, title, line and detail. 56 px between steps.

**Concepts per step**
- 01: phone `upload` (document card "Resume.pdf · 3 pages", "Add more documents", "Continue").
- 02: phone `configure` then price summary (Colour/B&W toggle, copies stepper, A4, pages "All pages", total ₹42, "Pay with UPI" and "Pay at shop").
- 03: desktop `queue` + detail with "Accept order" button.
- 04: desktop `job` ("Print job: Xerox Printer 01 · Colour · A4 · 1 copy · All pages", then [Printing…] with a thin progress bar).
- 05: phone `track` (checklist ✓ Order submitted, ✓ Shop accepted, ✓ Printing, ● Ready for pickup, ○ Completed) with a small desktop corner showing "Mark ready" → "Complete order".

**Acceptance:** step count is exactly 5; lane chips render correctly; reduced motion swaps concepts instantly.

---

### 5.3 For customers (`#customers`)

**Purpose:** short, clear explanation for people who only want to print. Keep this compact: about 70% the height of a normal section.
**Reference:** Leedlime (split panel with painted background) with Vestris-style short lines.

**Copy (final)**
- Eyebrow: FOR CUSTOMERS
- H2: **Print it. Pick it. *Done.***
- Body: "Printing at a CtrlP shop is quick. Scan the QR on the counter, upload your files, see the price and pay. Then collect your prints when the shop says they're ready."
- Four short lines (Body, with a lime dot each, no icons):
  - No app or account to set up **[VERIFY: noAccount]**
  - Choose colour, copies and pages for each file
  - See the price before you pay
  - Pay with UPI or pay at the shop **[VERIFY: upi]**
- Note (Small): "Look for the CtrlP QR code at the counter of a participating print shop."
- Button (secondary): Open the print app →  (`https://app.meetctrlp.in/`)

**Layout, desktop:** `--color-surface-sunken` full-bleed band. 12-col: text in columns 1 to 6; right columns 7 to 12 hold a rounded panel (radius xl, height ~460 px) with `<Hills variant="panel" />` and a phone (`PhoneConcept screen="track"` or a real app screenshot per 4.9) rising from the panel's bottom edge, with a "Concept" or "Live app" tag.
**Mobile:** text first; panel below (height ~380 px).

---

### 5.4 The counter today (`#problem`)

**Purpose:** name the shop owner's daily friction, respectfully, then show the cleaner alternative.
**Reference:** Vestris (focused narrative band, single transition, warm tone).

**Copy (final)**
- Eyebrow: THE COUNTER TODAY
- H2: **Printing shouldn't take *this much chasing.***
- Four lines (H3 weight 500 with a hairline between; no cards):
  - Files arrive on WhatsApp, in five different chats.
  - "Kaunse pages? Kitni copy?" The same questions, again and again.
  - Settings set by hand, one job at a time.
  - Cash in the drawer and UPI screenshots to match up.
- Closing line (Display M, centred): "Your counter works. It just takes *too many steps.*"

**Layout, desktop:** 12-col. Left columns 1 to 6: eyebrow, H2, the four lines. Right columns 7 to 12: transition visual in a `--color-surface-sunken` panel (radius xl, height 480 px). Closing line sits 96 px below, centred (two lines).
**Mobile:** text, then visual (height 360 px), then closing line.

**Visual (illustrative):**
- State 1 (messy): chat bubbles and file chips scattered, each rotated up to ±4°: "Bhaiya, ye print kar do" / "Colour mein?" / "Haan, 2 copy" / "Kaunse pages?" / "Sirf 1 se 5". File chips "resume_final_v2.pdf" and "marksheet (1).pdf". White bubbles, 1 px border, no real app branding.
- State 2 (clean): one structured order card ("Order #CP10482", Doc 1 and Doc 2 rows, [Paid] chip).
- Transition: on first view, bubbles slide and shrink toward the card centre while fading; the card scales 0.96→1 in 600 ms, once. Reduced motion: show State 2 only.
- Caption: "Illustrative. Not a live screenshot." plus `<ConceptTag />`.

**Rule:** copy must not call shop owners inefficient or imply statistics.

---

### 5.5 What you get as a shop (`#shops`)

**Purpose:** show the desktop software's value in a handful of distinct, scannable ideas.
**Reference:** Leedlime's "Everything you need" asymmetric feature grid on a painted field + Vestris's numbered benefit voice. This is the only section with a bento.

**Copy (final)**
- Eyebrow: FOR PRINT SHOPS
- H2: **Everything your counter needs, *in one place.***
- Intro (Body L): "One desktop app for orders, printing and payments."

**Bento tiles (6, asymmetric; each tile: title in H3, one line in Body, one concept visual):**

| Tile | Size (desktop grid, 6 cols × 3 rows) | Title | Line | Concept |
|---|---|---|---|---|
| A | 3 cols × 2 rows (large) | Orders arrive ready to print | Every file, setting and price in one order. No downloading, no asking again. | `DesktopConcept screen="queue"` |
| B | 3 cols × 1 row (wide) | Accept, and it prints | Tap Accept and the job goes to your printer. **[VERIFY: autoPrint]** | `job`: Accept button → [Printing…] |
| C | 2 cols × 1 row | Know who has paid | Paid online or pay at shop, clear on every order. | `payment`: [Paid] and [Pay at shop] chips |
| D | 2 cols × 1 row | The right printer, every time | Colour jobs to your colour printer, B&W to the other. **[VERIFY: printerRouting]** | `routing`: "Colour A4 → Xerox Printer 01 / B&W A4 → HP LaserJet" |
| E | 2 cols × 1 row | If a print fails, you'll know | Retry it or send it to another printer. **[VERIFY: retry]** | `failure`: "Print failed · Retry · Change printer" |
| F | 6 cols × 1 row (full width strip) | Your prices, your rules | Set your own rates for black and white, colour and paper size. Customers see the price before paying. | `pricing`: B&W ₹2 and Colour ₹10 per page fields, "Sample" caption |

Tile layout is asymmetric on purpose; tiles must not all be the same size. Unverified tiles (B, D, E) render a neutral fallback line ("Part of the CtrlP shop software.") or are omitted if the registry has no fallback; keep a minimum of four tiles, otherwise fall back to a simple numbered list (Vestris style) beside one visual.

**Layout, desktop:** the bento sits on a rounded painted field (`<Hills variant="panel" />`, radius xl, padding 32 px) with tiles as white cards (radius lg, `--shadow-card`, padding 24 px, 16 px gaps). `<ConceptTag />` anchored to the field's top-right and caption "All screens are concept previews."
**Tablet:** 2-column bento, tile A spans both columns, tile F spans both.
**Mobile:** single column, tiles stacked in order A, B, C, D, E, F; each concept visual is cropped to a height of ~200 px with a fade at the bottom.

**Motion:** tiles fade up with an 80 ms stagger. Within tile B, the Accept button press and the [Printing…] chip play once on first view.

---

### 5.6 Printer setup (`#printers`)

**Purpose:** remove the biggest fear: "Will it work with my printer and my computer?"
**Reference:** Leedlime's comparison-tile style (labelled ticks) + Vestris reassurance tone; a simple diagram with no abstract architecture jargon.

**Copy (final)**
- Eyebrow: PRINTER SETUP
- H2: **Works with the printers you *already have.*** **[VERIFY: existingPrinters]**
- Fallback H2 when unverified: **Connects to your shop's *printers.***
- Intro (Body L): "A small CtrlP program runs on your shop computer and talks to your printers. Your printers don't need to be put on the internet."
- Three diagram nodes (labels): "CtrlP" → "Your shop computer" → "Your printers"
- Node captions: "Orders and print jobs" / "CtrlP print agent" / "Colour, B&W, Xerox"
- Reassurance lines (Body, with ticks):
  - ✓ We help set up your printers and the shop QR.
  - ✓ Tell CtrlP which printer does colour, which does black and white, and which sizes you offer.
  - ✓ You see each printer's status: connected, printing, offline.
  Each is a **[VERIFY]** claim (`setupSupport`, `printerRouting`, `printerStatus`). Render only verified ones.
- Note (Small): "Supported printers are confirmed during setup."

**Layout, desktop:** 12-col. Left columns 1 to 5: eyebrow, H2, intro, reassurance lines, note. Right columns 6 to 12: a horizontal diagram in a white card (radius xl, `--shadow-card`): three rounded nodes joined by a 2 px dashed lime-deep connector with small moving dots (CSS animation). Below the diagram, `DesktopConcept screen="agent"` cropped to its bottom half: printer list "Xerox Printer 01 · Connected · Colour · A4 · A3", "HP LaserJet · Connected · B&W · A4", with a capability matrix (✓/✗). `<ConceptTag />` top-right of the card.
**Mobile:** text, then the diagram rotated to a **vertical** flow (nodes stacked, connector vertical), then the cropped concept.
**Reduced motion:** static connector, no moving dots.

---

### 5.7 Money: you keep 100% (`#money`)

**Purpose:** answer "How do I get paid, and what do you take?"
**Reference:** Vestris (large stat beside a plain explanation, like its "~7 hours saved" treatment) + Leedlime comparison tile.

**Copy (final)**
- Eyebrow: PAYMENTS
- Stat numeral (Stat numeral type): **0%**
- Stat caption (H3): "commission on every print job." **[VERIFY: zeroCommission]**
- H2: **The customer pays. You *keep it all.***
- Body: "When a customer pays online, CtrlP confirms the payment before you print, then settles the full amount to you. When they choose pay at shop, you collect at the counter and mark it paid."
- Three mini rows (Body, hairline separated):
  - **Online payment.** Confirmed before you print.
  - **Pay at shop.** Clearly marked on the order so nothing gets missed.
  - **Your plan is the only cost.** We don't take a cut of print payments.
- Fallback line if `zeroCommission` is unverified: remove the stat block and the third row; keep the first two rows.
- Settlement timing is **not stated** unless the owner sets `{{SETTLEMENT_TIMING}}`; when provided, add it as one more row: "**Settlement.** {{SETTLEMENT_TIMING}}".

**Layout, desktop:** `--color-surface` band. 12-col. Left columns 1 to 6: the huge **0%** with caption below, aligned left; lime marker (a 12 px lime dot) before the caption. Right columns 7 to 12: eyebrow, H2, body, rows. A small flow strip under the rows: "Customer pays ₹42 → CtrlP confirms → You receive ₹42" shown as three pills joined by arrows (Caption type; the last pill lime-soft). Mark the figures as "Example".
**Mobile:** stat first, then text and rows, then the flow strip stacked vertically.

---

### 5.8 Plans (`#plans`)

**Purpose:** invite the shop to a conversation without showing prices, so shop owners aren't overwhelmed and the team can keep testing willingness to pay.
**Reference:** Vestris (pricing is quiet and set apart, not a loud tier table) + Leedlime (soft card on a painted field, "Talk to a human" row).

**Copy (final)**
- Eyebrow: PLANS
- H2: **Plans built around *your shop.***
- Body (Body L): "Every shop prints differently. Tell us about your counter and we'll suggest a plan that fits."
- Card title (H3): "Talk to us about your shop"
- Card text: "We'll ask a few simple questions about your shop size and printers, then recommend a plan."
- "Included with every plan" list (Body, with ticks; each is a **[VERIFY]** claim, render only verified ones):
  - Your own shop QR code
  - The CtrlP desktop app
  - Printer connection support
  - Order and payment tracking
  - WhatsApp support
- "Who it's for" row: three plain tags, no names and no prices: `Small shops` · `Busy print and Xerox shops` · `High-volume shops`
- Primary button: Talk to us on WhatsApp
- Secondary button: Request a call
- Microcopy (Small): "No pressure. Just a conversation."

**Layout, desktop:** the section sits on a painted field (`<Hills variant="panel" />`) with generous padding. Centred header (eyebrow, H2, body). Below it, **one large card** (max width 960 px, radius xl, white, `--shadow-card`) with two halves: left half has the card title, text, the "Included" list and the tags row; right half (`--color-surface-sunken` background) holds the two buttons stacked and the microcopy. No tier columns, no toggle, no price anywhere.
**Mobile:** card stacks; buttons full width, WhatsApp first.

**Hidden feature (flag `NEXT_PUBLIC_SHOW_PRICING`, default `false`; do not render when false):** a three-tier layout using this config, for later use only:

```ts
export const plans = [
  { name: "Starter",  perDay: 9,  perMonth: 270, for: "Small shops" },
  { name: "Pro",      perDay: 14, perMonth: 420, for: "Busy print and Xerox shops" },
  { name: "Business", perDay: 19, perMonth: 570, for: "High-volume shops" },
];
```

The agent must not expose these values in the DOM, HTML source, JSON-LD, sitemap or analytics when the flag is `false` (tree-shake or server-side gate the config).

---

### 5.9 Trust and privacy (`#trust`)

**Purpose:** a calm, specific statement of safety, and of who stays in control.
**Reference:** Vestris ("Automated work, human safety": large statement rows, no icons, no security theatre).

**Copy (final)**
- Eyebrow: DESIGNED WITH CARE
- H2: **Your customers' documents are *safe with us.***
- Statement rows (each: label in Eyebrow, title in Display M, line in Body):
  - 01 · **Safety.** "Documents are deleted once printed." (owner-confirmed promise)
  - 02 · **Security.** "Prints are sealed before delivery." (owner-confirmed promise)
  - 03 · **No Peek Policy.** "Our staff will not look at your documents." (owner-confirmed promise)
- Control row (Body L): "**You stay in control.** Every order is yours to review and accept. CtrlP helps with the repetitive steps; you decide what gets printed." 
- Access row (Body): "Each shop sees only its own orders." **[VERIFY: shopOnlyAccess]**
- Link (Small): "Read our Privacy Policy →" (`/privacy`)

**Layout, desktop:** `--color-surface-sunken` band. 12-col. Left columns 1 to 5: eyebrow, H2, the Control and Access rows below it. Right columns 6 to 12: the three statement rows stacked, separated by hairlines, row padding 40 px; the number "01/02/03" in Caption type left; the title large.
**Mobile:** eyebrow, H2, statement rows, then Control and Access rows.
**Rule:** the three promises are owner-confirmed and set `verified: true` in the registry. They are absolute claims: the owner must confirm before launch that the product behaves exactly as stated (see 10.3). If any is later found untrue, flip its flag to `false` and the row disappears.

---

### 5.10 How to start (`#start`)

**Purpose:** show how little the shop has to do.
**Reference:** Leedlime ("Three steps" with a painted thumbnail per step).

**Copy (final)**
- Eyebrow: GET STARTED
- H2: **Three steps to your first *order.***

| # | Title (H3) | Text |
|---|---|---|
| 01 | Talk to us | Message us on WhatsApp or ask for a call. Tell us about your shop and printers. |
| 02 | We set up your shop | Your shop profile, your prices, your QR code and your printer connection. **[VERIFY: setupSupport]** |
| 03 | Start taking orders | Put your QR code on the counter. Customers scan, you accept and print. |

Fallback for 02 when unverified: "Your shop profile, your prices and your QR code."
- Button row: Talk to us on WhatsApp · Request a call

**Layout, desktop:** centred header, then three equal columns. Each column: a painted thumbnail (aspect 4:3, radius lg, `<Hills variant="thumb" />` with a different crop and palette shift per step), number in display font 48 px, H3, text. Thin connecting hairline with small lime dots between the thumbnails.
**Mobile:** vertical stack; thumbnails aspect 16:9.

---

### 5.11 FAQ (`#faq`)

**Purpose:** answer the top questions for both audiences.
**Reference:** Leedlime (accordion, "Talk to a human" row), with a two-tab switch.

**Layout:** header (eyebrow `FAQ`, H2 **Common *questions.***). A two-tab switch (pill style): **Print shops** (default) and **Customers**. Accordion list below: single open at a time, 1 px hairlines, plus/minus glyph on the right, answers animate height at 320 ms. Max width 820 px, centred. Under the list, a row: "Still have questions?" with buttons **Talk to a human** (WhatsApp) and **Contact us**. Use `role="tablist"`, `aria-expanded`, keyboard arrow-key tab navigation. Deep links: `#faq-shops`, `#faq-customers`.

**Print shops tab**

1. **How does printing from CtrlP work on my computer?** "A small CtrlP program runs on your shop computer and sends accepted jobs to your printers. You don't need to download each file." **[VERIFY: autoPrint]**
2. **Which printers work with CtrlP?** "We confirm supported printers during setup. Tell us which printers you use and we'll check them with you."
3. **Do I need new hardware?** "You use your own shop computer and printers." **[VERIFY: existingPrinters]**
4. **How do I get paid?** "Online payments are confirmed before you print, then settled to you in full. For pay at shop, you collect at the counter and mark the order paid."
5. **Do you take a commission?** "No. We take 0% on print jobs. Your plan is the only cost." **[VERIFY: zeroCommission]**
6. **What does CtrlP cost?** "Plans are built around your shop. Talk to us and we'll recommend the right one."
7. **What if a print fails?** "You'll see the failure in your print queue and can retry or send the job to another printer." **[VERIFY: retry]**
8. **Can my staff log in separately?** "Not yet. Right now each shop uses one login." **[VERIFY: singleLogin]**
9. **How are my customers' documents handled?** "Documents are deleted once printed, and our staff do not look at them. See our Privacy Policy."
10. **How long does setup take?** "{{SETUP_TIME_ANSWER}}" (render only when the owner provides it; otherwise omit this question)

**Customers tab** (questions mirror the live app's FAQ)

1. **How do I start printing?** "Scan the CtrlP QR code at the shop counter. It opens that shop so you can upload your documents."
2. **What document formats can I print?** "PDF, JPG, PNG, DOC/DOCX and PPT/PPTX." **[VERIFY: fileFormats]**
3. **What printing options can I choose from?** "Colour or black and white, number of copies, paper size and which pages to print, for each document." **[VERIFY: printOptions]**
4. **How do I upload my documents?** "After scanning the QR, choose your files from your phone or computer. You can add more than one."
5. **Are my documents handled securely?** "Documents are deleted once printed, and our staff will not look at them."
6. **What is the maximum number of files I can upload?** "{{MAX_FILES_ANSWER}}" (omit if not provided)
7. **I have an issue with my order. What now?** "{{ORDER_ISSUE_ANSWER}}" (omit if not provided)
8. **How long will my order take?** "{{ORDER_TIME_ANSWER}}" (omit if not provided)

Questions whose answers contain an unprovided placeholder are not rendered. If a tab ends up with fewer than three questions, hide that tab.

---

### 5.12 Closing CTA and contact (`#contact`)

**Purpose:** convert shop owners; give customers a pointer.
**Reference:** Leedlime (large closing block on a cloud painting) + Vestris (warm closing line, bracket label).

**Copy (final)**
- Bracket label: `( Get in touch )`
- H2: **Ready to take print orders the *easy way?***
- Body: "Message us and we'll help you get your shop set up. No pressure, just a conversation."
- Primary button: Talk to us on WhatsApp
- Secondary button: Request a call
- Customer line (Small): "Just here to print? Scan the QR code at your print shop's counter, or open the print app →" (`https://app.meetctrlp.in/`)

**WhatsApp prefilled message (URL-encoded):** "Hi MeetCtrlP, I run a print shop and I'd like to know more about CtrlP." `{{WHATSAPP_NUMBER}}` must be the verified business number. Do not state support hours.

**Request a call form (modal):** fields: Name (required), Phone (required; validate 10 digits with optional +91), Shop name (optional), City (optional). Nothing else. Submit "Request a call". Success: "Thanks. We'll get back to you soon." Error: "Something went wrong. Please try WhatsApp instead." Notice (Small): "We'll only use your details to respond to this request. See our Privacy Policy." Protection: honeypot plus server-side rate limit (5 per hour per IP) and server-side validation. Never log phone numbers to analytics. Delivery: API route `/api/request-call` emails the owner and appends to a Google Sheet or Notion database via env-configured webhook (choose one; keys in env vars).

**Layout, desktop:** full-bleed block with rounded top corners (radius xl), `--color-forest` background and `<Hills variant="sky">` tinted for dark (hills `#1E3322`, `#2A4A30`, low contrast) with two faint clouds. 12-col: left columns 1 to 7 hold bracket label, H2 and body; right columns 8 to 12 hold the two buttons stacked, then the customer line under a hairline. Lime primary button.
**Mobile:** all stacked; buttons full width.

---

### 5.13 Footer

**Copy (final)**
- Brand: **CtrlP** by MeetCtrlP. "Thoughtful software for everyday work."
- Column Explore: How it works (`#journey`), For shops (`#shops`), Plans (`#plans`), FAQ (`#faq`)
- Column Company: MeetCtrlP (`https://meetctrlp.in/`), Contact (`#contact`), Print app (`https://app.meetctrlp.in/`)
- Column Legal: Privacy Policy (`/privacy`), Terms of Service (`/terms`)
- Bottom line: "© 2026 MeetCtrlP. Made with care."

**Layout:** `--color-bg`, top hairline. Desktop: brand block in columns 1 to 5, three link columns in 7 to 12, bottom bar below a hairline. Mobile: brand block, then a 2-column link grid. No social icons unless real accounts exist; omit any link to a page that does not exist.

---

## 6. Content rules

### 6.1 Claim guardrails

- Never show logos, testimonials, awards, ratings, shop counts, user counts or "as seen on".
- Never write absolute claims beyond the three owner-confirmed promises: no "100% secure", "works with all printers", "instant payouts", "always".
- Printer language is always "your printers" and "supported printers confirmed during setup". Never list brands or models as supported.
- No plan names, daily or monthly prices, or "starting from" amounts anywhere in the DOM (see 5.8).
- Rupee figures appear only inside labelled concept screens and the "Example" flow strip.
- Do not invent contact details, support hours, team size, founding date, addresses or social accounts.
- Tone: plain, warm, direct. Speak to the shop owner as someone running a busy counter. No hype words ("revolutionary", "AI-powered", "game-changing").

### 6.2 Claims registry

Implement `src/content/claims.ts`. Components read from it; an unverified claim renders its `fallback` (or nothing, if `fallback` is `null`).

```ts
export const claims = {
  // Owner-confirmed promises (verified: true by owner instruction)
  promiseDeleted:  { text: "Documents are deleted once printed.", verified: true, fallback: null },
  promiseSealed:   { text: "Prints are sealed before delivery.", verified: true, fallback: null },
  promiseNoPeek:   { text: "Our staff will not look at your documents.", verified: true, fallback: null },
  zeroCommission:  { text: "We take 0% on every print job.", verified: true, fallback: null },

  // Product capabilities: set true only after the shipped product does exactly this
  noAccount:       { text: "No account needed", verified: false, fallback: null },
  upi:             { text: "Pay with UPI or pay at the shop", verified: false, fallback: "Pay online or pay at the shop" },
  fileFormats:     { text: "PDF, JPG, PNG, DOC/DOCX and PPT/PPTX", verified: false, fallback: null },
  printOptions:    { text: "Colour or B&W, copies, paper size and pages", verified: false, fallback: null },
  autoPrint:       { text: "Accepted orders go straight to your printer", verified: false, fallback: "The job is prepared for your printer and tracked in your print queue." },
  printerRouting:  { text: "Colour jobs to the colour printer, B&W to the other", verified: false, fallback: null },
  retry:           { text: "Retry a failed print or change printer", verified: false, fallback: null },
  printerStatus:   { text: "See each printer's status", verified: false, fallback: null },
  existingPrinters:{ text: "Works with the printers you already have", verified: false, fallback: "Connects to your shop's printers." },
  setupSupport:    { text: "We help set up your printers and shop QR", verified: false, fallback: "Your shop profile, your prices and your QR code." },
  shopOnlyAccess:  { text: "Each shop sees only its own orders", verified: false, fallback: null },
  singleLogin:     { text: "Each shop uses one login for now", verified: false, fallback: null },
} as const;
```

The four owner-confirmed entries above are `true` because the owner stated that the promises and the 0% model apply. They are absolute statements; see 10.3.

---

## 7. Quality requirements

### 7.1 Accessibility (WCAG 2.2 AA)

- Semantic landmarks: `header`, `nav`, `main`, `section` with `aria-labelledby`, `footer`. One `h1`; no skipped heading levels.
- Visible focus on every interactive element; touch targets ≥ 44 × 44 px.
- Skip link; full keyboard support for the menu sheet, FAQ tabs and accordion, modal and form.
- Looping scenes pause off-screen and are static under reduced motion.
- Concept visuals: each figure has a text caption; the content they show is available as text or `aria-label`; decorative art is `aria-hidden`.
- Status is never colour only (chips include text).
- Form errors announced with `aria-live="polite"`; all fields labelled.

### 7.2 Responsive behaviour

- Test at 320, 360, 390, 768, 1024, 1280, 1440 and 1920 px. No horizontal scrolling. Concept devices scale via CSS transform or container units.
- Every hover effect has a non-hover equivalent or is decorative only.

### 7.3 Performance budget (Indian mobile networks)

- Test with a throttled "Slow 4G" and mid-range Android profile.
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95. LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- Initial JavaScript ≤ 130 KB gzipped. Lazy-load everything below the hero (journey scene, bento visuals, FAQ, form modal).
- Fonts: two families max, Latin subset, `font-display: swap`, preload only the hero display font.
- Art: SVG or CSS only; total art payload under 140 KB. No autoplay video on this site.

### 7.4 SEO and sharing

- `<title>`: "CtrlP for print shops | QR orders, payments and printing in one place"
- Meta description: "CtrlP gives print shops QR-based orders, clear payments and a simple way to print. See how it works and talk to us."
- `lang="en-IN"`. Canonical `https://{{SITE_DOMAIN}}/`. `theme-color` `#F8F9F8`.
- Open Graph and Twitter card: same title and description; image 1200 × 630 (off-white background, lime hills, "Your print shop, run from one screen." in the display font; no product claims).
- JSON-LD `Organization` with name and URL only; and `FAQPage` generated from verified, rendered FAQ items only.
- `robots.txt` allow all; `sitemap.xml` lists `/`, `/privacy`, `/terms`. Favicon, Apple touch icon, web manifest.

---

## 8. Analytics

Privacy-friendly tool (Plausible, cookieless PostHog or similar). No ad pixels. No personal data in event properties.

| Event | Trigger | Properties |
|---|---|---|
| `nav_click` | Header link | `label` |
| `whatsapp_click` | Any WhatsApp button | `location` (header, hero, plans, start, faq, contact) |
| `request_call_open` | Form opened | `location` |
| `request_call_submit` | Successful submit | none (never contact details) |
| `customer_app_click` | Any link to `app.meetctrlp.in` | `location` |
| `journey_step_view` | Journey step becomes active | `step` (1 to 5) |
| `bento_view` | Bento 50% visible | none |
| `plans_view` | Plans section 50% visible | none |
| `faq_tab` | Tab switched | `tab` |
| `faq_open` | Question opened | `tab`, `index` |
| `section_view` | Any section 50% visible | `id` |

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

`NEXT_PUBLIC_SITE_DOMAIN`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_SHOW_PRICING` (default `false`), plus the lead delivery keys (server-only).

All variables are documented in `.env.example` and validated in `src/config/env.ts`.

### 9.13 Out of scope for v1

CMS integration (the content layer must stay CMS-ready), login, dark mode, a language toggle (copy stays i18n-ready), a blog and a live chat widget.

## 10. Build order, QA and launch

### 10.1 Suggested build order

1. Tokens, fonts, layout shell, header and footer.
2. Concept components with every screen state listed in 4.10 and Section 5; Hills variants.
3. Hero (static composition, then the loop).
4. Static versions of Customers, Problem, Money, Plans, Trust, Start, Contact.
5. Journey sticky scene.
6. Bento, Printers diagram.
7. FAQ tabs and accordion.
8. Request-a-call form and API route; claims registry; plans flag.
9. SEO, analytics, accessibility and performance pass.

### 10.2 Definition of done

- `pnpm typecheck`, `pnpm lint`, `pnpm audit:hardcoded`, `pnpm test`, `pnpm test:e2e` and `pnpm build` all pass with zero violations.
- Dragging the viewport from 320 px to 2560 px shows no broken layout and no horizontal scroll.
- Spot checks need no component edits: change the accent colour token, a nav label, the WhatsApp number and a claim flag, and see each update everywhere it is used.
- Every section matches its layout, copy and acceptance criteria.
- No price, plan name or per-day amount exists in the DOM, page source or JSON-LD while `NEXT_PUBLIC_SHOW_PRICING` is `false`.
- Every concept visual carries the Concept tag (or the bento caption rule); real app screenshots carry "Live app".
- Unverified claims render only fallbacks; placeholders never appear on the page.
- No broken links; no link to a missing page.
- All checks in Section 7 pass, including throttled mobile tests and reduced motion.
- The lead form works end to end with a real submission.

### 10.3 Inputs the owner must supply or confirm before launch

| Input | Used in |
|---|---|
| `{{SITE_DOMAIN}}` | Canonical, OG, sitemap |
| `{{WHATSAPP_NUMBER}}` (verified business number), `{{CONTACT_EMAIL}}` | All CTAs, form delivery |
| Privacy Policy and Terms text (or approval to link the main site's pages) | `/privacy`, `/terms` |
| **Confirmation that the product really does what the three promises and the 0% model say** (documents deleted once printed; prints sealed before delivery; staff do not view documents; 0% commission) | Hero microcopy, Money, Trust, FAQ |
| Flip each capability claim in the registry to `true` as it ships | Journey, bento, printers, FAQ |
| Settlement timing, setup time, max files, order-issue process, order time | Optional FAQ answers and Money row |
| Real screenshots of `app.meetctrlp.in` screens (optional) | Journey, Customers |
| Approval of the proposed colours (after sampling Leedlime) and the font pair (after inspecting Vestris) | Design tokens |
| Screenshot of the Vestris pricing page (optional) | Plans layout refinement |

### 10.4 Post-launch (not v1)

- Replace concept visuals with real recordings as the desktop app ships, removing each Concept tag only when the visual is a real capture.
- Enable the three-tier price layout (`NEXT_PUBLIC_SHOW_PRICING`) once pricing has been validated with real shop owners.
- Hindi language option; real shop stories once they exist and the shops agree to be featured.