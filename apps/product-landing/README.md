# CtrlP print partner site (`product-landing`)

Single-page site for print shop owners, built from [`docs/prd.md`](docs/prd.md).
Next.js (App Router, static), TypeScript strict, Tailwind CSS v4.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in the three required values
pnpm --filter product-landing dev
```

Required: `NEXT_PUBLIC_SITE_DOMAIN`, `NEXT_PUBLIC_WHATSAPP_NUMBER` (91 + 10 digits),
`NEXT_PUBLIC_CONTACT_EMAIL`. `next.config.ts` validates them, so `build`, `dev` and `start`
fail with a clear message when one is missing. The request-a-call form needs a delivery
channel: `LEAD_WEBHOOK_URL`, or `RESEND_API_KEY` + `LEAD_NOTIFICATION_EMAIL` + `LEAD_FROM_EMAIL`.
Without one the form shows its "try WhatsApp" error.

## Scripts

| Script | What it does |
|---|---|
| `dev` / `build` / `start` | Next.js on port 3002 |
| `typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| `lint` | ESLint, including `react/jsx-no-literals` and bans on hex colours and px style values |
| `audit:hardcoded` | Fails on colours, arbitrary Tailwind values, URLs, phone numbers, emails, ₹ amounts or `process.env` outside their homes |
| `test` | Vitest: claims, link builders, validation, FAQ rules, pricing gate, en-IN formatting, rate limit |
| `format` | Prettier with Tailwind class sorting |

## Where things live

| Change | Edit |
|---|---|
| Colours, type scale, spacing, radii, motion | `src/styles/tokens.css` (the only file with raw values) |
| Any visible copy | `src/content/*.ts` (`copy.ts`, `steps.ts`, `tiles.ts`, `faq.ts`, `nav.ts`, `meta.ts`, `concepts.ts`) |
| Sample orders, ₹ amounts, printer names | `src/content/sampleData.ts` |
| URLs and business values | `src/config/site.ts`, `src/config/routes.ts`, env |
| Feature flags | `src/config/flags.ts` (`NEXT_PUBLIC_SHOW_PRICING`) |
| Analytics events | `src/config/analytics.ts`, sent through `track()` in `src/lib/track.ts` |

### Flipping a claim

Every product capability lives in `src/content/claims.ts`. Set `verified: true` only once the
shipped product does exactly what the sentence says; until then the copy shows its fallback or
is left out (and unverified FAQ items leave the FAQPage JSON-LD too).

### Owner answers

`src/content/ownerInputs.ts` holds optional answers (settlement timing, setup time, max files,
order issues, order time). While `null`, the related FAQ item or Money row is not rendered.

### Pricing

Prices live in `src/content/pricing.server.ts` (server-only) and render only when
`NEXT_PUBLIC_SHOW_PRICING=true`. With the flag off they are absent from the HTML and bundles.

### Adding a section

1. Add its ID to `sectionIds` in `src/config/routes.ts`.
2. Put its copy in `src/content/`.
3. Create `src/components/sections/<Name>.tsx` using `Section`, `Container` and `SectionHeader`.
4. Add it to `src/app/page.tsx` in PRD order.
