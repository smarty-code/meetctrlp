# @ctrlp/schemas

Zod schemas for HTTP request and response validation. Domain TypeScript types live in `@ctrlp/types`; this package is the runtime contract.

## Auth

Import from `@ctrlp/schemas` or `@ctrlp/schemas/auth`.

- `registerRequestSchema` — shop owner sign-up. Requires `name`, `shopName`, `password`, and at least one of `email` or `phone`. Rejects the reserved Firebase phone-mapping domain `phone.meetctrlp.app`.
- `loginRequestSchema` — `{ identifier, password }`. `identifier` is an email or a phone number.
- `refreshRequestSchema` — `{ refreshToken }`.
- `authSessionResponseSchema` / `authMeResponseSchema` — documented response shapes for clients.

Parse untrusted JSON with these schemas in server route handlers before calling services.

## Print user

- `printUserUploadIntentRequestSchema` — `{ originalFilename, mimeType, fileSizeBytes }`, up to 50 MB.
- `printUserPrintConfigurationSchema` — settings for one cart document.
- `printUserBatchConfigurationSchema` — `{ documents: [{ documentId, ...settings }] }`, 1 to 10 entries, saved in one write.
- `printUserSubmitOrderRequestSchema` — `{ paymentMethod, idempotencyKey, expectedTotalPaise? }`.

The guest flow is described in [`apps/server/docs/print-user.md`](../../../apps/server/docs/print-user.md).

## Shop hours

`updateShopHoursRequestSchema` validates the seven-day schedule. `src/business-hours.ts` holds the rules that the server and the shop desktop app both use, so the two can't disagree.

- **Storage:** times are stored as 24-hour `HH:mm` and shown to people in 12-hour form. `parseTimeInput` accepts `"9:30 PM"`, `"9 pm"`, `"09:05 a.m."`, or `"21:30"`. `formatTime12h` turns `"21:30"` into `"9:30 PM"`.
- **Day types:** a day is closed, open 24 hours (`isOpen24Hours`), or open from `opensAt` to `closesAt`.
- **Past midnight:** a closing time earlier than the opening time means the shop closes after midnight. Until that closing time, the previous day's hours keep the shop open.
- **Invalid days:** `businessHourProblem` rejects only a day whose opening and closing times are equal. A closed day always drops the 24-hour flag.
- **Time zone:** `shopClock` converts an instant to the shop's weekday and minute in `SHOP_TIME_ZONE` (Asia/Kolkata). `isOpenAt` and `describeOpenStatus` work on that.
- **Display text:** `summarizeBusinessHours` returns `{ openNow, openStatusLabel, todayHoursLabel, isOpen24x7 }`, which the server sends to the desktop and customer apps.

Example status labels: `"Open until 9:00 PM"`, `"Open 24 hours"`, `"Opens at 9:00 AM"`, `"Opens tomorrow at 9:00 AM"`, `"Opens Monday at 9:00 AM"`, `"Closed"`.

## Tests

```powershell
pnpm --filter @ctrlp/schemas test
```

This runs `src/business-hours.test.ts` with Node's built-in test runner. The schema validation rules are tested in `apps/print-shop/src/lib/hours.test.ts` (Vitest). Test files are excluded from `tsc` because this package has no Node types.
