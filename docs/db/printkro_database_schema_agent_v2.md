# PrintKro MVP — Database Schema & Agent Engineering Documentation

> **Source of truth:** `printkro_mvp_schema_v3.sql`
>
> **Supporting product context:** `printkro_mvp_schema_guide.md` and the PrintKro MVP product-scope documentation.
>
> This document is written for engineers and AI coding agents that will create, read, update, validate, migrate, or reason about data in the PrintKro PostgreSQL database.
>
> **Important:** The SQL schema is authoritative for what actually exists in the database. Product requirements described as future behavior, UI behavior, or application-layer validation are explicitly labeled when they are not enforced by PostgreSQL.

---

## 1. Purpose and mental model

PrintKro is a guest-first print ordering platform connecting a print customer to a physical print shop and its local printers.

The central business flow is:

```text
Customer scans shop QR
        ↓
Guest Print User / Session
        ↓
Create Order
        ↓
Upload one or more Documents
        ↓
Configure each Document
        ↓
Calculate and snapshot price
        ↓
Choose Online or Cash payment
        ↓
Submit Order
        ↓
Shop accepts
        ↓
Create / dispatch Print Jobs
        ↓
Print Agent
        ↓
Physical Printer
        ↓
Order Ready
        ↓
Customer Pickup
        ↓
Order Completed
```

The database intentionally separates four concepts that must not be conflated:

```text
Business identity
    shops / shop_users / print_users

Business transaction
    orders / order_items / payments

Digital files
    order_documents / print_configurations

Physical execution
    print_jobs / print_agents / printers / printer_capabilities
```

That separation is foundational to the architecture.

---

# 2. PostgreSQL assumptions

The SQL recommends PostgreSQL 15+ and enables:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

`pgcrypto` is required by the schema because UUID primary keys use:

```sql
gen_random_uuid()
```

### Agent rule

Do not replace UUID generation with application-generated sequential IDs unless the schema is intentionally changed through a migration.

---

# 3. Global conventions

## 3.1 UUID primary keys

Every main entity uses:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

The UUID is the stable database identity.

Do not use:

- `order_number` as the relational primary key.
- shop slug as the shop identity.
- printer name as the printer identity.
- session IP address as the user identity.

Human-readable identifiers and machine identifiers have separate purposes.

---

## 3.2 Timestamps

The schema generally uses:

```sql
TIMESTAMPTZ
```

for event timestamps.

Examples:

- `created_at`
- `updated_at`
- `paid_at`
- `started_at`
- `completed_at`
- `last_seen_at`

Use UTC-compatible timestamp handling at the application boundary. Shop-local display can be derived using the shop's `timezone`.

---

## 3.3 Money

All monetary amounts are stored as integer **minor units**:

```text
₹1 = 100 paise
₹42 = 4200
```

Examples:

- `price_minor_units`
- `subtotal_minor_units`
- `total_minor_units`
- `amount_minor_units`

### Agent rule

Never store monetary values as PostgreSQL `FLOAT`/`REAL`/`DOUBLE PRECISION`.

Never perform business money arithmetic using binary floating-point values.

---

## 3.4 Current configuration vs historical snapshot

There are two different categories of pricing:

```text
shop_pricing
    = current shop pricing configuration

order_items
    = historical price snapshot used by an order
```

An old order must not change because a shop changes its current price.

---

## 3.5 PostgreSQL constraints are only part of the domain model

The database enforces structural rules such as:

- foreign keys
- non-null requirements
- uniqueness
- numeric ranges
- positive quantities
- valid enum values

The application/service layer must additionally enforce rules such as:

- valid page-range syntax
- page selections being within `page_count`
- valid order status transitions
- payment authorization
- whether a selected printer can actually execute the requested configuration
- whether a shop is allowed to accept a particular order
- whether a print agent is authorized to receive a job
- secure document authorization
- session ownership

Do not assume that a successful SQL `INSERT` means the business operation is valid.

---

# 4. High-level entity relationship

```text
                           ┌─────────────────┐
                           │      shops      │
                           └────────┬────────┘
                                    │
             ┌──────────────────────┼─────────────────────────┐
             │          │           │          │              │
             ▼          ▼           ▼          ▼              ▼
        shop_users   shop_qr   shop_services  pricing    business_hours
                                      │
                              shop_capabilities

                                    │
                         ┌──────────┴──────────┐
                         │                     │
                         ▼                     ▼
                  print_agents            orders
                         │                     │
                         ▼             ┌───────┼───────────────┐
                      printers          │       │       │       │
                         │              ▼       ▼       ▼       ▼
                         ▼           documents items  payment  history
                printer_capabilities    │               │
                                        ▼               ├── transactions
                               print_configurations     └── refunds
                                        │
                                        ▼
                                    print_jobs
                                        │
                                  ┌─────┴─────┐
                                  ▼           ▼
                              printer     print_agent

print_users ───────────────────────────────► orders

orders ────────────────────────────────────► notifications

shops ─────────────────────────────────────► shop_subscriptions
                                                  │
                                                  ▼
                                          subscription_plans

order_documents ──────────────────────────► document_access_logs

all important entities / actors ──────────► audit_logs
```

---

# 5. Type system / ENUMs

ENUMs intentionally restrict important state values to known values.

## 5.1 `shop_status`

Values:

| Value | Meaning |
|---|---|
| `PENDING` | Shop exists but has not yet been activated for normal operation. |
| `ACTIVE` | Shop is operational. |
| `SUSPENDED` | Shop is temporarily prevented from normal operation. |
| `INACTIVE` | Shop is disabled/inactive without necessarily being a disciplinary suspension. |

### Agent guidance

Do not invent string values such as `"active"` or `"disabled"` in application code. Use the database enum values exactly.

---

## 5.2 `shop_user_role`

| Value | Meaning |
|---|---|
| `OWNER` | Primary business owner of the shop. |
| `MANAGER` | Operational manager with elevated shop permissions. |
| `STAFF` | Shop employee/operator. |

Authorization is application-layer behavior; the enum only stores the role.

---

## 5.3 `shop_user_status`

| Value | Meaning |
|---|---|
| `ACTIVE` | User may operate normally, subject to authorization. |
| `INACTIVE` | User is disabled/inactive. |
| `SUSPENDED` | User is temporarily blocked. |

---

## 5.4 `print_user_status`

| Value | Meaning |
|---|---|
| `ACTIVE` | Guest session identity is currently valid. |
| `EXPIRED` | Guest session has passed its expiration. |
| `BLOCKED` | Guest identity/session has been blocked. |

---

## 5.5 `qr_code_status`

| Value | Meaning |
|---|---|
| `ACTIVE` | QR code can be used. |
| `DISABLED` | QR code has been manually disabled. |
| `EXPIRED` | QR code is no longer valid due to expiration. |

---

## 5.6 `service_type`

Current MVP value:

```text
DOCUMENT_PRINT
```

This is deliberately narrow.

Future services such as scanning, lamination, binding, photo printing, etc. are not represented by the current enum.

### Agent rule

Do not add arbitrary service strings without a schema migration.

---

## 5.7 `color_mode`

| Value | Meaning |
|---|---|
| `BW` | Black-and-white printing. |
| `COLOR` | Color printing. |

---

## 5.8 `paper_size`

Current MVP value:

```text
A4
```

Double-sided printing, A3, custom media, etc. are not currently represented by this enum.

---

## 5.9 `pricing_unit`

Current MVP value:

```text
PER_PAGE
```

This means pricing is expressed per printed page/unit according to the configured print service.

---

## 5.10 `order_status`

| Value | Meaning |
|---|---|
| `CREATED` | Order record exists and initial creation has occurred. |
| `CONFIGURING` | Customer is configuring documents/print options. |
| `PAYMENT_PENDING` | Payment is required or still pending. |
| `SUBMITTED` | Customer has submitted the order to the shop. |
| `SHOP_ACCEPTED` | Shop has accepted the order for execution. |
| `PRINTING` | One or more physical print jobs are being executed. |
| `READY` | Printing is complete and the order is ready for customer pickup. |
| `COMPLETED` | Customer handover/order completion is finished. |
| `CANCELLED` | Order was cancelled. |
| `REJECTED` | Shop/system rejected the order. |
| `PRINT_FAILED` | Printing failed at the order level. |

### Important

The enum does **not** itself enforce which transition is legal.

For example, PostgreSQL will allow an application to update:

```text
COMPLETED → CREATED
```

unless the application prevents it.

A service/domain layer must own the order state machine.

---

## 5.11 `payment_method`

| Value | Meaning |
|---|---|
| `ONLINE` | Payment is performed through an online payment flow. |
| `CASH` | Customer pays the shop in cash. |

---

## 5.12 `payment_status`

| Value | Meaning |
|---|---|
| `PENDING` | Payment has not been confirmed. |
| `PAID` | Payment is confirmed as paid. |
| `FAILED` | Payment attempt failed. |
| `REFUNDED` | Payment amount has been refunded. |
| `PARTIALLY_REFUNDED` | Part of the payment has been refunded. |

---

## 5.13 `document_status`

| Value | Meaning |
|---|---|
| `UPLOADING` | File upload is in progress or not yet finalized. |
| `UPLOADED` | File bytes have been successfully stored. |
| `PROCESSING` | File is being inspected/rendered/page-counted/validated. |
| `READY` | Document is valid and ready for printing. |
| `FAILED` | Document processing/validation failed. |
| `DELETED` | Document is logically/operationally deleted and should no longer be treated as available. |

---

## 5.14 `print_job_status`

| Value | Meaning |
|---|---|
| `QUEUED` | Job is waiting for execution. |
| `DISPATCHING` | Job is being handed from backend/queue to the local execution layer. |
| `PRINTING` | Physical printer execution has started. |
| `COMPLETED` | Job finished successfully. |
| `FAILED` | Job execution failed. |
| `CANCELLED` | Job will not be executed. |

---

## 5.15 `print_agent_status`

| Value | Meaning |
|---|---|
| `ONLINE` | Agent is currently connected/available. |
| `OFFLINE` | Agent is not currently connected. |
| `DISABLED` | Agent is administratively disabled. |

`last_seen_at` is the supporting heartbeat timestamp; `status` is the current interpreted state.

---

## 5.16 `printer_status`

| Value | Meaning |
|---|---|
| `ONLINE` | Printer is available. |
| `OFFLINE` | Printer is unavailable/not connected. |
| `PRINTING` | Printer is actively printing. |
| `ERROR` | Printer reports an error. |
| `PAUSED` | Printer is paused. |
| `DISABLED` | Printer is disabled from PrintKro use. |

---

## 5.17 `printer_capability_type`

| Value | Meaning |
|---|---|
| `BW` | Printer can perform black-and-white printing. |
| `COLOR` | Printer can perform color printing. |
| `A4` | Printer can print on A4 paper. |

This is a deliberately simple capability model for the MVP.

---

## 5.18 `notification_recipient_type`

| Value | Meaning |
|---|---|
| `PRINT_USER` | Notification belongs to a guest print user. |
| `SHOP_USER` | Notification belongs to a shop-side user. |

`recipient_id` is polymorphic: its UUID refers to a row in the table represented by `recipient_type`.

Because PostgreSQL does not have a normal foreign key for this polymorphic pattern, application authorization must validate the relationship.

---

## 5.19 `notification_type`

| Value | Meaning |
|---|---|
| `NEW_ORDER` | New order requires shop attention. |
| `PAYMENT_RECEIVED` | Payment has been received/confirmed. |
| `ORDER_ACCEPTED` | Shop accepted the order. |
| `PRINT_STARTED` | Printing has started. |
| `PRINT_FAILED` | Printing failed. |
| `ORDER_READY` | Order is ready for pickup. |
| `ORDER_CANCELLED` | Order was cancelled. |

---

## 5.20 `subscription_interval`

| Value | Meaning |
|---|---|
| `MONTHLY` | Subscription billing interval is monthly. |
| `YEARLY` | Subscription billing interval is yearly. |

---

## 5.21 `subscription_status`

| Value | Meaning |
|---|---|
| `TRIALING` | Shop is in a trial period. |
| `ACTIVE` | Subscription is active. |
| `PAST_DUE` | Required subscription payment is overdue. |
| `CANCELLED` | Subscription has been cancelled. |
| `EXPIRED` | Subscription period has ended and access is no longer active. |
| `SUSPENDED` | Subscription has been suspended. |

---

# 6. Table-by-table documentation

# 6.1 `shops`

## Purpose

`shops` is the root entity for a PrintKro print-shop partner.

Almost every shop-side entity ultimately belongs to a shop.

A shop represents the physical business/location through which customers place print orders.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | Stable database identity for the shop. |
| `name` | `VARCHAR(200)` | No | — | Human-readable shop/business name shown in dashboards and customer-facing contexts. |
| `slug` | `VARCHAR(120)` | No | — | Stable URL-friendly identifier for shop routes/links. Unique globally. |
| `phone` | `VARCHAR(32)` | Yes | — | Shop contact phone number. |
| `email` | `VARCHAR(320)` | Yes | — | Shop contact email address. |
| `address_line_1` | `TEXT` | Yes | — | Primary street/address line. |
| `address_line_2` | `TEXT` | Yes | — | Optional secondary address information. |
| `city` | `VARCHAR(120)` | Yes | — | Shop city. |
| `state` | `VARCHAR(120)` | Yes | — | Shop state/province. |
| `postal_code` | `VARCHAR(20)` | Yes | — | Postal/PIN code. |
| `country` | `VARCHAR(100)` | No | `'India'` | Country associated with the shop address. |
| `latitude` | `NUMERIC(9,6)` | Yes | — | Geographic latitude used for location-aware features and future marketplace functionality. |
| `longitude` | `NUMERIC(9,6)` | Yes | — | Geographic longitude. |
| `timezone` | `VARCHAR(64)` | No | `'Asia/Kolkata'` | Timezone used for shop-local business operations and display. |
| `status` | `shop_status` | No | `'PENDING'` | Current shop lifecycle state. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last update timestamp; trigger-maintained. |

### Constraints

`chk_shops_latitude`:

```text
latitude is NULL OR latitude ∈ [-90, 90]
```

`chk_shops_longitude`:

```text
longitude is NULL OR longitude ∈ [-180, 180]
```

`slug` is unique.

### Relationships

One shop can have:

```text
many shop_users
many shop_qr_codes
many shop_services
one shop_capabilities row
many shop_pricing rows
many shop_business_hours rows
many print_agents
many printers
many orders
many subscriptions over its lifetime
```

### Delete behavior

Child entities that belong directly to a shop generally use `ON DELETE CASCADE`.

Orders deliberately use `ON DELETE RESTRICT`.

This means a shop with historical orders should not be casually deleted.

### Agent guidance

Do not physically delete a shop as a normal "disable shop" operation. Use `status`.

---

# 6.2 `shop_users`

## Purpose

Authenticated business-side users operating a shop.

This is intentionally separate from `print_users`.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Stable identity of the shop-side user. |
| `shop_id` | `UUID` | No | — | Shop to which the user belongs. |
| `name` | `VARCHAR(150)` | No | — | Human-readable staff/owner name. |
| `email` | `VARCHAR(320)` | Yes | — | Login/contact email. |
| `phone` | `VARCHAR(32)` | Yes | — | Contact phone. |
| `role` | `shop_user_role` | No | `STAFF` | Authorization role. |
| `status` | `shop_user_status` | No | `ACTIVE` | Account lifecycle state. |
| `password_hash` | `TEXT` | Yes | — | Password hash when password authentication is used. Never store plaintext passwords. |
| `last_login_at` | `TIMESTAMPTZ` | Yes | — | Last successful login timestamp. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last modification time; trigger-maintained. |

### Constraints/indexes

A unique functional index exists:

```sql
UNIQUE INDEX uq_shop_users_email
ON shop_users (lower(email))
WHERE email IS NOT NULL
```

This makes email uniqueness case-insensitive.

### Important semantic point

`shop_users.email` is globally unique, not merely unique within a shop, because the unique index does not include `shop_id`.

### Agent guidance

Authorization must always check both:

```text
authenticated shop_user
+
target shop
```

Do not trust a client-provided `shop_id`.

---

# 6.3 `print_users`

## Purpose

Anonymous/guest customer identity.

The customer does not need a traditional account/password for the MVP.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Stable internal identity for the guest session record. |
| `session_token_hash` | `VARCHAR(128)` | No | — | Hash of the secret session token used to authenticate the guest session. Unique. |
| `ip_address` | `INET` | Yes | — | Supporting security/analytics/session-correlation signal. |
| `user_agent` | `TEXT` | Yes | — | Browser/device user-agent information. |
| `status` | `print_user_status` | No | `ACTIVE` | Guest session lifecycle state. |
| `first_seen_at` | `TIMESTAMPTZ` | No | `now()` | First observed time. |
| `last_seen_at` | `TIMESTAMPTZ` | No | `now()` | Last activity/observation time. |
| `expires_at` | `TIMESTAMPTZ` | No | — | Session expiration boundary. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Database record creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last modification time; trigger-maintained. |

### Critical security rule

`session_token_hash` is the actual session credential identity.

`ip_address` is **not** the identity.

Multiple customers may share an IP because of NAT, Wi-Fi, carrier networks, offices, colleges, etc.

### Indexes

- `idx_print_users_ip` supports lookup by IP.
- `idx_print_users_status_expires` supports session expiry/cleanup.

### Agent guidance

A normal request should authenticate the guest by presenting the raw session token and comparing its securely computed hash with `session_token_hash`.

Never store the raw token if a hash is sufficient.

Never expose `session_token_hash` to the browser.

---

# 6.4 `shop_qr_codes`

## Purpose

Associates a scannable QR entry point with a specific shop.

A QR is an entry mechanism, not a user identity.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | QR record identity. |
| `shop_id` | `UUID` | No | — | Shop reached by the QR. |
| `code` | `VARCHAR(255)` | No | — | QR code's application-facing identifier/token. Globally unique. |
| `status` | `qr_code_status` | No | `ACTIVE` | Whether the QR can currently be used. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `expires_at` | `TIMESTAMPTZ` | Yes | — | Optional QR expiration time. |

### Relationship

```text
shop 1 ──── N shop_qr_codes
```

### Agent guidance

When resolving a QR:

1. Find QR by `code`.
2. Check QR status.
3. Check `expires_at` if present.
4. Resolve the associated shop.
5. Check whether the shop is operational.
6. Create/reuse a guest session.

Do not treat possession of a QR code as proof of staff authorization.

---

# 6.5 `shop_services`

## Purpose

Declares which PrintKro service types a shop has enabled.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Service configuration identity. |
| `shop_id` | `UUID` | No | — | Owning shop. |
| `service_type` | `service_type` | No | — | Service being enabled/disabled. |
| `is_enabled` | `BOOLEAN` | No | `TRUE` | Whether the shop currently offers the service. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last modification timestamp. |

### Constraint

Unique:

```text
(shop_id, service_type)
```

Therefore a shop cannot have duplicate rows for the same service.

---

# 6.6 `shop_capabilities`

## Purpose

A compact shop-level capability snapshot.

This answers:

> "What can this shop generally support?"

Actual physical printer capabilities are represented separately in `printer_capabilities`.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Configuration row identity. |
| `shop_id` | `UUID` | No | — | Shop. Unique, so one capability snapshot per shop. |
| `bw_printing` | `BOOLEAN` | No | `TRUE` | Whether shop-level B&W printing is offered. |
| `color_printing` | `BOOLEAN` | No | `FALSE` | Whether shop-level color printing is offered. |
| `a4_printing` | `BOOLEAN` | No | `TRUE` | Whether shop-level A4 printing is offered. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last modification time. |

### Important distinction

```text
shop_capabilities
    = business-level supported capability

printer_capabilities
    = physical printer-level capability
```

A shop may advertise color printing only when at least one usable printer can satisfy it. The schema does not automatically enforce this consistency.

---

# 6.7 `shop_pricing`

## Purpose

Current pricing configuration for a shop.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Pricing-row identity. |
| `shop_id` | `UUID` | No | — | Shop whose price is configured. |
| `service_type` | `service_type` | No | — | Service being priced. |
| `color_mode` | `color_mode` | No | — | B&W vs color pricing dimension. |
| `paper_size` | `paper_size` | No | `A4` | Paper-size pricing dimension. |
| `unit` | `pricing_unit` | No | `PER_PAGE` | Unit to which price applies. |
| `price_minor_units` | `BIGINT` | No | — | Current price in minor currency units. |
| `currency` | `CHAR(3)` | No | `INR` | ISO-like currency code for the price. |
| `is_active` | `BOOLEAN` | No | `TRUE` | Whether this pricing row is currently usable. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last update time. |

### Constraint

`price_minor_units >= 0`.

### Important design rule

Changing this table must not alter the price of an existing order.

The price used by an order must be copied into `order_items`.

### Important schema limitation

There is no unique constraint preventing duplicate active pricing rows for the same:

```text
shop + service + color + paper + unit
```

Therefore the pricing service must either:

- maintain uniqueness at the application layer, or
- introduce a migration adding the appropriate unique/partial unique constraint.

Do not silently assume PostgreSQL prevents duplicate active prices.

---

# 6.8 `shop_business_hours`

## Purpose

Stores a shop's recurring weekly operating schedule.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Schedule-row identity. |
| `shop_id` | `UUID` | No | — | Shop owning the schedule. |
| `day_of_week` | `SMALLINT` | No | — | Day index from 0 through 6. |
| `opens_at` | `TIME` | Yes | — | Opening time. |
| `closes_at` | `TIME` | Yes | — | Closing time. |
| `is_closed` | `BOOLEAN` | No | `FALSE` | Whether shop is closed that day. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last modification time. |

### Constraints

`day_of_week` must be 0–6.

If `is_closed = false`, both opening and closing times must be present.

Unique:

```text
(shop_id, day_of_week)
```

### Important limitation

The schema does not prohibit:

```text
opens_at >= closes_at
```

So overnight hours are not modeled explicitly.

Application code must decide whether:

- same-day hours only are supported, or
- overnight hours need special interpretation.

---

# 6.9 `orders`

## Purpose

The central business transaction.

An order means:

> A particular guest customer requested a print service from a particular shop.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Internal order identity. |
| `order_number` | `VARCHAR(32)` | No | — | Human-facing order identifier. Globally unique. |
| `shop_id` | `UUID` | No | — | Shop fulfilling the order. |
| `print_user_id` | `UUID` | No | — | Guest customer/session associated with the order. |
| `status` | `order_status` | No | `CREATED` | Current order lifecycle state. |
| `subtotal_minor_units` | `BIGINT` | No | `0` | Sum of billable item amounts before tax/discount. |
| `tax_minor_units` | `BIGINT` | No | `0` | Tax amount. |
| `discount_minor_units` | `BIGINT` | No | `0` | Discount amount. |
| `total_minor_units` | `BIGINT` | No | `0` | Final amount due/charged. |
| `currency` | `CHAR(3)` | No | `INR` | Currency for order totals. |
| `estimated_ready_at` | `TIMESTAMPTZ` | Yes | — | Estimated time the order will be ready. |
| `accepted_at` | `TIMESTAMPTZ` | Yes | — | Time shop accepted order. |
| `completed_at` | `TIMESTAMPTZ` | Yes | — | Time order was completed. |
| `cancelled_at` | `TIMESTAMPTZ` | Yes | — | Time order was cancelled. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Order creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last modification time. |

### Constraints

All order monetary fields must be non-negative.

Foreign keys:

```text
orders.shop_id → shops.id
orders.print_user_id → print_users.id
```

Both use `ON DELETE RESTRICT`.

### Why `order_number` exists separately from `id`

`id` is a machine identity.

`order_number` is safe and convenient to show to customers/support staff.

### Important application invariant

The following should normally be true:

```text
total = subtotal + tax - discount
```

The database does **not** enforce this formula.

The order service must calculate and validate it transactionally.

---

# 6.10 `order_documents`

## Purpose

Metadata for uploaded customer documents.

**Actual file bytes are not stored in PostgreSQL.**

They live in object storage.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Document identity. |
| `order_id` | `UUID` | No | — | Order containing the document. |
| `original_filename` | `VARCHAR(255)` | No | — | Filename supplied/displayed to the user. |
| `storage_key` | `TEXT` | No | — | Object-storage key/path for the actual file. |
| `mime_type` | `VARCHAR(100)` | No | — | MIME type associated with the uploaded file. |
| `file_size_bytes` | `BIGINT` | No | — | Size of stored file in bytes. |
| `page_count` | `INTEGER` | Yes | — | Detected page count once processing succeeds. |
| `document_index` | `INTEGER` | No | — | Ordering of documents inside the order. |
| `status` | `document_status` | No | `UPLOADING` | Document processing/storage lifecycle state. |
| `retention_until` | `TIMESTAMPTZ` | Yes | — | Time after which the file is eligible for retention cleanup. |
| `deleted_at` | `TIMESTAMPTZ` | Yes | — | Timestamp at which document was marked deleted. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last update time. |

### Constraints

- `file_size_bytes >= 0`
- `page_count` is either NULL or greater than zero
- `document_index >= 0`
- unique `(order_id, document_index)`

### Why `document_index` exists

Customers upload multiple files. The system needs deterministic ordering.

Example:

```text
0 → Resume.pdf
1 → Marksheet.pdf
2 → Photo.jpg
```

### Why `storage_key` exists

The database should not contain large binary document payloads.

`storage_key` connects relational metadata to object storage.

### Privacy rule

A valid `storage_key` does not mean a client should be allowed to download the object.

Authorization must happen before generating a temporary/signed object-storage URL.

---

# 6.11 `print_configurations`

## Purpose

Stores the customer's requested print configuration for exactly one uploaded document.

There is a one-to-one relationship between:

```text
order_documents
    ↕
print_configurations
```

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Configuration identity. |
| `order_document_id` | `UUID` | No | — | Document being configured. Unique, creating one-to-one semantics. |
| `color_mode` | `color_mode` | No | — | Requested B&W or color mode. |
| `copies` | `INTEGER` | No | `1` | Number of copies. |
| `paper_size` | `paper_size` | No | `A4` | Requested paper size. |
| `page_selection` | `TEXT` | Yes | — | Optional textual page range expression such as `1,3,5-8`. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last update time. |

### Constraints

`copies > 0`.

`page_selection` may be NULL, but if present it must contain non-whitespace content.

### Critical application-level rule

The database does **not** parse:

```text
1,3,5-8
```

The application must:

1. Parse the expression.
2. Validate syntax.
3. Expand/normalize ranges.
4. Ensure pages are positive.
5. Ensure every selected page is `<= page_count`.
6. Reject duplicates/invalid ranges according to product rules.
7. Calculate billable page count.

### MVP scope

The schema intentionally does not include:

- printer-level orientation is now supported through the printer preset/job override layer
- duplex remains unsupported in MVP (simplex only)
- scaling
- pages per sheet
- collation
- binding
- stapling
- special instructions

Do not create fake fields for these in application models unless they are explicitly introduced later.

---

# 6.12 `order_items`

## Purpose

Represents the billable line-item snapshot for an order.

This is where historical pricing is preserved.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Line-item identity. |
| `order_id` | `UUID` | No | — | Parent order. |
| `order_document_id` | `UUID` | Yes | — | Document associated with the billable item. Nullable so the item can survive document deletion. |
| `item_type` | `service_type` | No | `DOCUMENT_PRINT` | Type of billable service. |
| `description` | `TEXT` | No | — | Human-readable line-item description. |
| `quantity` | `INTEGER` | No | `1` | Billable quantity. |
| `unit_price_minor_units` | `BIGINT` | No | — | Price per unit at order time. |
| `total_price_minor_units` | `BIGINT` | No | — | Total line-item price snapshot. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |

### Constraints

- `quantity > 0`
- unit price >= 0
- total price >= 0

### Why `order_document_id` is nullable

The billing record should not become structurally dependent on retaining the document forever.

Its foreign key uses:

```text
ON DELETE SET NULL
```

### Important pricing invariant

Normally:

```text
total_price_minor_units
=
quantity × unit_price_minor_units
```

The database does not enforce this arithmetic.

The order-pricing service must enforce it.

---

# 6.13 `order_status_history`

## Purpose

Audit/history of order state changes.

`orders.status` tells you the current state.

`order_status_history` tells you how the order got there.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | History-event identity. |
| `order_id` | `UUID` | No | — | Order whose status changed. |
| `from_status` | `order_status` | Yes | — | Previous status. NULL is appropriate for the first event. |
| `to_status` | `order_status` | No | — | New status. |
| `changed_by_type` | `VARCHAR(30)` | No | — | Type of actor that caused the change. |
| `changed_by_id` | `UUID` | Yes | — | Actor identifier when available. |
| `reason` | `TEXT` | Yes | — | Optional explanation for the transition. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Time of transition. |

### Important design detail

`changed_by_type` + `changed_by_id` is polymorphic.

Possible actor types might be represented by application conventions such as:

```text
PRINT_USER
SHOP_USER
ADMIN
SYSTEM
PRINT_AGENT
```

Only the schema's string length is enforced. There is no actor-type enum or foreign key.

Therefore application code must standardize and validate these values.

### Agent rule

Whenever changing `orders.status`, create the corresponding history row in the same database transaction.

Do not update current status in one transaction and history in a later asynchronous operation.

---

# 6.14 `payments`

## Purpose

Business-level payment record for an order.

The table represents the payment concept, not provider-specific implementation details.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Payment identity. |
| `order_id` | `UUID` | No | — | Order being paid. Unique, so one primary payment record per order. |
| `method` | `payment_method` | No | — | Online or cash. |
| `status` | `payment_status` | No | `PENDING` | Current payment state. |
| `amount_minor_units` | `BIGINT` | No | — | Payment amount in minor units. |
| `currency` | `CHAR(3)` | No | `INR` | Payment currency. |
| `paid_at` | `TIMESTAMPTZ` | Yes | — | Time payment was confirmed paid. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last update time. |

### Relationship

One order has at most one `payments` row in the current schema.

### Important rule

For online payments, gateway/webhook processing should update the business payment state idempotently.

For cash:

```text
PENDING → PAID
```

should generally happen when the shop confirms cash receipt.

---

# 6.15 `payment_transactions`

## Purpose

Stores provider-specific payment transaction attempts/events separately from the business payment record.

This separation allows the payment provider to change without redesigning the order/payment domain.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Transaction record identity. |
| `payment_id` | `UUID` | No | — | Parent business payment. |
| `provider` | `VARCHAR(100)` | Yes | — | Payment provider name. |
| `provider_transaction_id` | `VARCHAR(255)` | Yes | — | Provider-side transaction identifier. |
| `transaction_type` | `VARCHAR(30)` | No | `PAYMENT` | Type of gateway transaction/event. |
| `status` | `payment_status` | No | — | Provider transaction status represented using payment status enum. |
| `amount_minor_units` | `BIGINT` | No | — | Amount represented by this transaction. |
| `currency` | `CHAR(3)` | No | `INR` | Currency. |
| `raw_response` | `JSONB` | Yes | — | Provider response payload retained for debugging/audit. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Transaction creation time. |

### Important security consideration

`raw_response` may contain sensitive provider metadata.

Do not blindly expose it through customer-facing APIs.

### Idempotency limitation

The schema has an index on:

```text
(provider, provider_transaction_id)
```

but it is not declared UNIQUE.

Therefore duplicate provider transaction records are technically possible.

The payment integration layer must implement idempotency explicitly, or the schema should later add a unique constraint if provider semantics allow it.

---

# 6.16 `refunds`

## Purpose

Represents a refund against a business payment.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Refund identity. |
| `payment_id` | `UUID` | No | — | Payment being refunded. |
| `amount_minor_units` | `BIGINT` | No | — | Refund amount. Must be greater than zero. |
| `reason` | `TEXT` | Yes | — | Human/system explanation. |
| `status` | `VARCHAR(30)` | No | `PENDING` | Refund processing state. |
| `provider_reference` | `VARCHAR(255)` | Yes | — | Provider-side refund identifier. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `completed_at` | `TIMESTAMPTZ` | Yes | — | Completion time. |

### Important limitation

`status` is a free-form `VARCHAR`, unlike `payment_status`.

Application code must define the allowed refund states.

### Important invariant

Total successful refunds should never exceed the paid amount.

The current database schema does not enforce this.

---

# 6.17 `print_agents`

## Purpose

Represents the PrintKro local software installed on a shop computer.

This is a **Day-0 MVP entity** because printer automation is a core part of PrintKro.

Architecture:

```text
PrintKro Cloud
      ↓
Print Agent
      ↓
Local operating system / printer subsystem
      ↓
Physical printer
```

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Agent identity. |
| `shop_id` | `UUID` | No | — | Shop owning the agent. |
| `name` | `VARCHAR(150)` | No | — | Human-readable agent/device name. |
| `device_identifier` | `VARCHAR(255)` | No | — | Stable device identifier; globally unique. |
| `status` | `print_agent_status` | No | `OFFLINE` | Current interpreted agent status. |
| `version` | `VARCHAR(50)` | Yes | — | Installed PrintKro Agent software version. |
| `last_seen_at` | `TIMESTAMPTZ` | Yes | — | Last successful heartbeat/connection. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last modification time. |

### Relationship

```text
shop 1 ──── N print_agents
print_agent 1 ──── N printers
```

### Agent guidance

`device_identifier` is not the same as the database UUID.

- `id` identifies the database record.
- `device_identifier` identifies the installation/device from the agent's perspective.

---

# 6.18 `printers`

## Purpose

Represents a physical printer discovered/configured by a Print Agent.

A printer has a **persistent default print preset**. That preset is the baseline configuration for jobs routed to the printer.

The key rule is:

```text
default preset + per-job overrides = resolved job settings
```

Applying an override must **never mutate the stored printer preset**.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Stable PrintKro identity of the physical printer record. |
| `shop_id` | `UUID` | No | — | Shop that owns/uses the printer. |
| `print_agent_id` | `UUID` | No | — | Local Print Agent responsible for communicating with the printer. |
| `name` | `VARCHAR(150)` | No | — | Human-friendly printer name shown in the shop UI. |
| `system_name` | `VARCHAR(255)` | No | — | Printer name exposed by the local OS/printing subsystem; used with the agent to address the physical queue. |
| `manufacturer` | `VARCHAR(150)` | Yes | — | Detected/manually configured manufacturer. |
| `model` | `VARCHAR(150)` | Yes | — | Detected/manually configured model. |
| `status` | `printer_status` | No | `OFFLINE` | Current operational status observed by the Print Agent. |
| `is_default` | `BOOLEAN` | No | `FALSE` | Whether this is the shop's default printer for routing when no explicit printer is selected. This is separate from the print-settings preset. |
| `default_print_settings` | `JSONB` | No | Standard preset object | Persistent default print preset applied to jobs unless a job supplies an override for a field. |
| `last_seen_at` | `TIMESTAMPTZ` | Yes | — | Last time the printer was observed/heartbeat-reported by the Print Agent. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Record creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last database modification time; maintained by the existing `updated_at` trigger. |

### `default_print_settings`

The MVP preset contains exactly six settings:

```json
{
  "copies": 1,
  "orientation": "PORTRAIT",
  "paperSize": "A4",
  "inputTray": "AUTO_SELECT",
  "colorMode": "COLOR",
  "printQualityDpi": "STANDARD_600DPI"
}
```

Supported values:

| Field | Allowed values | Notes |
|---|---|---|
| `copies` | `1`–`999` | Total copies requested. |
| `orientation` | `PORTRAIT`, `LANDSCAPE` | Page orientation. |
| `paperSize` | `A4`, `LETTER`, `LEGAL`, `A3`, `EXECUTIVE` | `CUSTOM` is intentionally excluded from this MVP because custom dimensions require width/height/unit semantics. |
| `inputTray` | `AUTO_SELECT`, `MAIN_TRAY`, `BYPASS_TRAY`, `TRAY_1`, `TRAY_2`, `TRAY_3` | Logical tray selection. The Print Agent maps this logical value to the actual OS/driver tray. |
| `colorMode` | `COLOR`, `GRAYSCALE`, `MONOCHROME` | Execution-level color instruction. |
| `printQualityDpi` | `DRAFT_300DPI`, `STANDARD_600DPI`, `HIGH_1200DPI` | Requested raster/quality tier. Actual driver support must be checked by the agent. |

**Duplex is intentionally absent.** The MVP is simplex-only, so storing `duplex: SIMPLEX` would carry no useful information.

### Why JSONB instead of six printer columns?

These settings form one cohesive configuration object and are an execution contract rather than relational entities.

JSONB gives the system:

- one atomic preset object;
- a direct mapping to the API contract;
- simple partial overrides;
- room to add a future setting without immediately restructuring the printer table.

The database still validates the allowed keys and values through `is_valid_print_settings()`.

### Preset immutability rule

A job must not do this:

```text
printer.default_print_settings.colorMode = COLOR
```

Instead:

```text
resolved = default_print_settings || requested_overrides
```

Then store `resolved` on the job.

Changing the printer preset affects **future jobs only**.

### Important tenant/integrity rule

The schema does not enforce that `printers.shop_id` equals `print_agents.shop_id`.

The Print Agent registration/service layer must validate this invariant.

### Unique constraint

```text
(print_agent_id, system_name)
```

This prevents the same agent from registering the same OS printer queue twice.

# 6.19 `printer_capabilities`

## Purpose

Stores individual capabilities of a physical printer.

This is modeled as a many-to-many-like capability list:

```text
printer
   ├── BW
   ├── COLOR
   └── A4
```

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Capability-row identity. |
| `printer_id` | `UUID` | No | — | Printer possessing the capability. |
| `capability_type` | `printer_capability_type` | No | — | Specific capability. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | When capability was recorded. |

### Constraint

Unique:

```text
(printer_id, capability_type)
```

A printer cannot have the same capability twice.

### Agent guidance

The routing service should evaluate requested configuration against these capabilities before assigning a print job.

Example:

```text
requested:
COLOR + A4

printer capabilities:
BW + A4

=> incompatible
```

---

# 6.20 `print_jobs`

## Purpose

Represents the **physical execution unit**.

An order is a business transaction. A print job is an instruction to physically print one document.

A print job stores both:

1. the **partial overrides requested for this job**, and
2. the **fully resolved settings actually used for execution**.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Stable print-job identity. |
| `order_id` | `UUID` | No | — | Parent business order. |
| `order_document_id` | `UUID` | No | — | Document being printed. |
| `printer_id` | `UUID` | Yes | — | Selected printer. Nullable while routing/assignment is pending; `SET NULL` preserves history if the printer is deleted. |
| `print_agent_id` | `UUID` | Yes | — | Agent responsible for execution. Nullable before assignment; `SET NULL` preserves history. |
| `status` | `print_job_status` | No | `QUEUED` | Physical execution lifecycle. |
| `priority` | `INTEGER` | No | `0` | Queue priority. Higher values are considered first by the queue index. |
| `retry_count` | `INTEGER` | No | `0` | Number of retry attempts. |
| `requested_overrides` | `JSONB` | No | `{}` | Only settings explicitly supplied for this job. Unspecified fields inherit the printer preset. |
| `resolved_settings` | `JSONB` | No | — | Complete execution snapshot after merging the printer preset with job overrides. |
| `queued_at` | `TIMESTAMPTZ` | No | `now()` | Time the job entered the queue. |
| `started_at` | `TIMESTAMPTZ` | Yes | — | Time physical execution began. |
| `completed_at` | `TIMESTAMPTZ` | Yes | — | Successful completion time. |
| `failed_at` | `TIMESTAMPTZ` | Yes | — | Failure time. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Database creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last database modification time. |

### Override semantics

If the printer preset is:

```json
{
  "copies": 1,
  "orientation": "PORTRAIT",
  "paperSize": "A4",
  "inputTray": "AUTO_SELECT",
  "colorMode": "GRAYSCALE",
  "printQualityDpi": "DRAFT_300DPI"
}
```

and the job sends:

```json
{
  "copies": 3,
  "colorMode": "COLOR"
}
```

the resolved configuration is:

```json
{
  "copies": 3,
  "orientation": "PORTRAIT",
  "paperSize": "A4",
  "inputTray": "AUTO_SELECT",
  "colorMode": "COLOR",
  "printQualityDpi": "DRAFT_300DPI"
}
```

The stored printer preset remains unchanged.

### Why store both objects?

`requested_overrides` answers:

> What did this API request explicitly ask to change?

`resolved_settings` answers:

> What exact settings did the system instruct the Print Agent to execute?

This distinction is important for debugging, auditing, retries, and reproducibility.

### Historical snapshot rule

Suppose:

```text
Monday:
Printer preset = GRAYSCALE + A4 + 1 copy

Tuesday:
Job 101 is created
resolved_settings = GRAYSCALE + A4 + 1 copy

Wednesday:
Printer preset is changed to COLOR + A4 + 2 copies
```

Job 101 must still retain its original `resolved_settings`.

Never reconstruct historical execution settings by reading the printer's current preset.

### Delete behavior

Order/document references use `RESTRICT`.

Printer/agent references use `SET NULL`.

This preserves the physical execution record even if hardware or an agent registration is later removed.

### Important consistency rules

The database does not enforce that:

```text
print_jobs.order_id
```

belongs to the same order as:

```text
print_jobs.order_document_id
```

Application code must prevent cross-order document/job associations.

Likewise, the application must ensure the selected printer and agent belong to the same shop as the order.

### Queue index

```text
(status, priority DESC, queued_at)
```

supports priority-first queue selection with FIFO behavior within equal priority.

# 6.21 `notifications`

## Purpose

Stores user-visible notification records for print users and shop users.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Notification identity. |
| `recipient_type` | `notification_recipient_type` | No | — | Identifies whether recipient is a print user or shop user. |
| `recipient_id` | `UUID` | Yes | — | Recipient UUID. Polymorphic. |
| `order_id` | `UUID` | Yes | — | Optional order associated with the notification. |
| `type` | `notification_type` | No | — | Notification event category. |
| `title` | `VARCHAR(255)` | No | — | Short notification title. |
| `message` | `TEXT` | No | — | Notification body. |
| `is_read` | `BOOLEAN` | No | `FALSE` | Whether recipient has read it. |
| `read_at` | `TIMESTAMPTZ` | Yes | — | When it was marked read. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |

### Important limitation

`recipient_id` has no foreign key because it is polymorphic.

Application code must ensure:

```text
recipient_type = PRINT_USER → recipient_id exists in print_users
recipient_type = SHOP_USER  → recipient_id exists in shop_users
```

### Order deletion behavior

The optional `order_id` uses:

```text
ON DELETE SET NULL
```

Notifications can therefore survive an order deletion.

---

# 6.22 `subscription_plans`

## Purpose

Defines plans sold to shop partners.

The current business model is shop subscription.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Plan identity. |
| `name` | `VARCHAR(100)` | No | — | Human-readable plan name. Unique. |
| `description` | `TEXT` | Yes | — | Plan description. |
| `price_minor_units` | `BIGINT` | No | — | Recurring plan price in minor units. |
| `currency` | `CHAR(3)` | No | `INR` | Plan currency. |
| `billing_interval` | `subscription_interval` | No | — | Monthly or yearly. |
| `is_active` | `BOOLEAN` | No | `TRUE` | Whether plan can currently be offered. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last modification time. |

### Constraint

Price must be non-negative.

### Important rule

Deactivating a plan should normally use:

```text
is_active = false
```

rather than deleting a plan referenced by historical subscriptions.

---

# 6.23 `shop_subscriptions`

## Purpose

Associates a shop with a subscription plan and records its billing period/lifecycle.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Subscription identity. |
| `shop_id` | `UUID` | No | — | Shop receiving the subscription. |
| `plan_id` | `UUID` | No | — | Plan subscribed to. |
| `status` | `subscription_status` | No | `TRIALING` | Subscription lifecycle state. |
| `starts_at` | `TIMESTAMPTZ` | No | — | Original subscription start time. |
| `current_period_start` | `TIMESTAMPTZ` | No | — | Start of current billing period. |
| `current_period_end` | `TIMESTAMPTZ` | No | — | End of current billing period. |
| `cancelled_at` | `TIMESTAMPTZ` | Yes | — | Time cancellation occurred. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Last update time. |

### Constraint

```text
current_period_end > current_period_start
```

### Important schema limitation

There is no unique constraint enforcing one active subscription per shop.

If the product requires exactly one active subscription at a time, the subscription service must enforce that transactionally, or the schema should later add a partial unique index.

### Important billing rule

Changing a plan should not silently mutate historical billing records. The application should create/update subscription records according to its billing policy.

---

# 6.24 `document_access_logs`

## Purpose

Privacy/audit trail for document access.

This is especially important because PrintKro handles potentially sensitive customer documents.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Access-log identity. |
| `document_id` | `UUID` | No | — | Document that was accessed. |
| `actor_type` | `VARCHAR(30)` | No | — | Type of actor accessing the document. |
| `actor_id` | `UUID` | Yes | — | Actor identity when available. |
| `access_type` | `VARCHAR(40)` | No | — | Access operation type, such as preview/download/processing access. |
| `ip_address` | `INET` | Yes | — | Source IP for the access event. |
| `user_agent` | `TEXT` | Yes | — | Client user-agent when relevant. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Access timestamp. |

### Delete behavior

Uses `ON DELETE CASCADE` from document.

Therefore deleting a document also deletes its access log records.

### Privacy note

If regulatory/business requirements require immutable access records after document deletion, this cascade behavior would need to be reconsidered.

---

# 6.25 `audit_logs`

## Purpose

Generic lightweight platform audit log.

Use it for significant administrative/business mutations where a general event record is useful.

### Columns

| Column | Type | Null | Default | Purpose |
|---|---|---:|---|---|
| `id` | `UUID` | No | UUID generation | Audit event identity. |
| `actor_type` | `VARCHAR(30)` | No | — | Type of actor performing the action. |
| `actor_id` | `UUID` | Yes | — | Actor identifier when available. |
| `action` | `VARCHAR(100)` | No | — | Action performed. |
| `entity_type` | `VARCHAR(100)` | No | — | Entity/table/domain object affected. |
| `entity_id` | `UUID` | No | — | Affected entity identifier. |
| `metadata` | `JSONB` | No | `{}` | Structured context about the action. |
| `ip_address` | `INET` | Yes | — | Source IP where relevant. |
| `user_agent` | `TEXT` | Yes | — | Client information where relevant. |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Event timestamp. |

### Why JSONB metadata exists

Different actions need different context.

For example:

```json
{
  "old_status": "ACTIVE",
  "new_status": "SUSPENDED",
  "reason": "billing"
}
```

The generic audit table avoids adding dozens of nullable columns for every possible audit event.

### Agent rule

Do not put secrets, passwords, session tokens, private document contents, or payment credentials into `metadata`.

---

# 7. Index documentation

Indexes exist to support expected access patterns. They are not business rules unless explicitly unique.

## Shop/user/session indexes

### `uq_shop_users_email`

Case-insensitive unique email for shop users.

### `idx_shop_users_shop_status`

Efficiently retrieve active/inactive users for a shop.

### `idx_print_users_ip`

Supports IP-based security/analytics queries.

### `idx_print_users_status_expires`

Supports finding expired sessions for cleanup.

---

## QR/service/pricing indexes

### `idx_shop_qr_codes_shop_status`

Find active QR codes for a shop.

### `idx_shop_pricing_lookup`

Supports pricing lookup by:

```text
shop
service
color
paper
active state
```

---

## Order indexes

### `idx_orders_shop_created`

Primary dashboard query:

```text
orders for a shop ordered by newest first
```

### `idx_orders_shop_status`

Find orders in a shop by current status.

### `idx_orders_print_user`

Find a guest user's orders.

### `idx_orders_status`

Find orders globally by status for operational workers/admin tooling.

---

## Document indexes

### `idx_order_documents_order`

Retrieve all documents for an order.

### `idx_order_documents_retention`

Partial index for retention cleanup:

```text
retention_until
WHERE deleted_at IS NULL
```

This is particularly important for privacy cleanup workers.

---

## Payment indexes

### `idx_payments_status`

Find pending/failed/etc. payments.

### `idx_payment_transactions_payment`

Retrieve all provider transaction records for a payment.

### `idx_payment_transactions_provider_id`

Lookup provider transaction IDs.

Again, this index is **not unique**.

---

## Printer/agent indexes

### `idx_print_agents_shop_status`

Find operational agents for a shop.

### `idx_printers_shop_status`

Find usable printers by shop and status.

### `idx_printers_agent`

Find printers managed by a particular Print Agent.

---

## Print-job indexes

### `idx_print_jobs_order`

Retrieve all physical jobs for an order.

### `idx_print_jobs_printer_status`

Find jobs assigned to a printer by state.

### `idx_print_jobs_agent_status`

Find jobs assigned to an agent by state.

### `idx_print_jobs_queue`

Supports queue workers selecting by:

```text
status
priority DESC
queued_at
```

---

## Notification indexes

### `idx_notifications_recipient`

Supports unread notification retrieval for a recipient.

---

## Subscription index

### `idx_shop_subscriptions_shop_status`

Find current subscription state for a shop.

---

## Privacy/audit indexes

### `idx_document_access_logs_document`

Retrieve access history for a document.

### `idx_audit_logs_entity`

Retrieve audit history for an entity.

---

# 8. Foreign-key delete semantics

The delete behavior is a major part of the schema design.

## `CASCADE`

Used where child records are conceptually owned by a parent and should disappear with it.

Examples:

```text
shop → shop_users
shop → QR codes
shop → services
shop → capabilities
shop → pricing
shop → business hours

order → order_documents
order → order_items
order → order_status_history

payment → payment_transactions

printer → printer_capabilities
```

## `RESTRICT`

Used where deletion would destroy important business history.

Examples:

```text
shop → orders
print_user → orders
order → payments
order → print_jobs
payment → refunds
shop → subscriptions
```

## `SET NULL`

Used where the historical record should survive even if the referenced object is removed.

Examples:

```text
order_item → document
print_job → printer
print_job → print_agent
notification → order
```

### Agent rule

Never infer that `ON DELETE CASCADE` means the application should routinely delete records.

Business deletion policy is separate from database cascade mechanics.

---

# 9. Updated-at trigger system

The schema defines:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
```

The function sets:

```sql
NEW.updated_at = now();
```

before an update.

Triggers exist for:

```text
shops
shop_users
print_users
shop_services
shop_capabilities
shop_pricing
shop_business_hours
orders
order_documents
print_configurations
payments
print_agents
printers
print_jobs
subscription_plans
shop_subscriptions
```

## Why this matters

Application code does not need to manually calculate `updated_at` for these tables.

### Agent rule

Do not rely on `updated_at` as a domain event timestamp.

It only means the row was updated.

For important business events use explicit fields/history tables such as:

- `accepted_at`
- `completed_at`
- `cancelled_at`
- `paid_at`
- `order_status_history`
- audit logs

---

# 9.5 Printer Presets, Job Overrides, and Resolved Configuration

This is the central printer-configuration contract for the PrintKro MVP.

## 9.5.1 Three configuration layers

```text
Printer
  │
  └── default_print_settings
          │
          │ shallow merge
          ▼
      requested_overrides
          │
          ▼
      resolved_settings
          │
          ▼
      Print Agent
          │
          ▼
      OS / Driver
          │
          ▼
      Physical Printer
```

### Layer 1 — Printer default preset

Stored on:

```text
printers.default_print_settings
```

It is persistent configuration owned by the shop/printer.

### Layer 2 — Per-job override

Stored on:

```text
print_jobs.requested_overrides
```

It contains only fields explicitly supplied for that job.

An empty object means:

```json
{}
```

and therefore the job inherits the entire printer preset.

### Layer 3 — Resolved execution configuration

Stored on:

```text
print_jobs.resolved_settings
```

It must contain all six supported settings.

The resolution operation is:

```text
resolved_settings =
    default_print_settings
    || requested_overrides
```

where the right-hand object wins for duplicate keys.

---

## 9.5.2 Canonical API JSON Schema

The API contract should use this logical schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PrintSettings",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "copies": {
      "type": "integer",
      "minimum": 1,
      "maximum": 999
    },
    "orientation": {
      "type": "string",
      "enum": ["PORTRAIT", "LANDSCAPE"]
    },
    "paperSize": {
      "type": "string",
      "enum": ["A4", "LETTER", "LEGAL", "A3", "EXECUTIVE"]
    },
    "inputTray": {
      "type": "string",
      "enum": [
        "AUTO_SELECT",
        "MAIN_TRAY",
        "BYPASS_TRAY",
        "TRAY_1",
        "TRAY_2",
        "TRAY_3"
      ]
    },
    "colorMode": {
      "type": "string",
      "enum": ["COLOR", "GRAYSCALE", "MONOCHROME"]
    },
    "printQualityDpi": {
      "type": "string",
      "enum": [
        "DRAFT_300DPI",
        "STANDARD_600DPI",
        "HIGH_1200DPI"
      ]
    }
  }
}
```

For a printer preset, all six properties are required.

For a job override object, zero or more of the six properties may be supplied.

The API should therefore use two logical schemas:

```text
PrinterPresetSettings
    required = all six fields

JobPrintOverrides
    required = none
```

Both use the same property definitions and reject unknown fields.

---

## 9.5.3 Preset API

### Create/update a printer preset

Conceptually:

```http
PUT /api/printers/{printerId}/preset
```

Request:

```json
{
  "copies": 1,
  "orientation": "PORTRAIT",
  "paperSize": "A4",
  "inputTray": "AUTO_SELECT",
  "colorMode": "GRAYSCALE",
  "printQualityDpi": "DRAFT_300DPI"
}
```

The server should:

1. Authenticate the shop user/service.
2. Verify the printer belongs to the shop.
3. Validate the complete six-field preset schema.
4. Validate the requested values against known printer capabilities where applicable.
5. Persist the complete object to `printers.default_print_settings`.
6. Leave all existing `print_jobs.resolved_settings` unchanged.

### Read a printer preset

Conceptually:

```http
GET /api/printers/{printerId}/preset
```

Response:

```json
{
  "printerId": "prn_302",
  "defaultSettings": {
    "copies": 1,
    "orientation": "PORTRAIT",
    "paperSize": "A4",
    "inputTray": "AUTO_SELECT",
    "colorMode": "GRAYSCALE",
    "printQualityDpi": "DRAFT_300DPI"
  }
}
```

There is no separate preset table in the MVP because each printer has exactly one persistent default preset.

---

## 9.5.4 Job API

A print-job creation request may include:

```json
{
  "jobId": "job_98421",
  "fileUrl": "https://storage.example.com/docs/report.pdf",
  "overrides": {
    "copies": 3,
    "colorMode": "COLOR",
    "printQualityDpi": "HIGH_1200DPI"
  }
}
```

Only the supplied keys are overrides.

The server resolves:

```text
preset || overrides
```

and persists both objects.

Example persisted job state:

```json
{
  "requested_overrides": {
    "copies": 3,
    "colorMode": "COLOR",
    "printQualityDpi": "HIGH_1200DPI"
  },
  "resolved_settings": {
    "copies": 3,
    "orientation": "PORTRAIT",
    "paperSize": "A4",
    "inputTray": "AUTO_SELECT",
    "colorMode": "COLOR",
    "printQualityDpi": "HIGH_1200DPI"
  }
}
```

---

## 9.5.5 Do not use the printer preset as a replacement for customer order configuration

There are two related but different concepts:

```text
Customer/order configuration
    What the customer paid for and requested.

Printer preset
    How this physical printer should print by default.

Job override
    Per-job execution settings that take precedence over the printer preset.
```

For fields that are explicitly selected by the customer and are part of the order's pricing/configuration—especially copies, color mode, and paper size—the print-job creation service should convert those requirements into explicit job overrides.

This prevents a shop's generic printer preset from silently changing a customer's paid request.

Example:

```text
Customer order:
COLOR + A4 + 2 copies

Printer default:
GRAYSCALE + A4 + 1 copy

Generated job overrides:
{
  "copies": 2,
  "paperSize": "A4",
  "colorMode": "COLOR"
}
```

The printer preset still remains:

```text
GRAYSCALE + A4 + 1 copy
```

This is the safest interpretation of "default preset + per-job override" in a paid print-order system.

---

## 9.5.6 Validation order

The server/agent should validate in this order:

```text
1. JSON shape
       ↓
2. Allowed enum/value validation
       ↓
3. Printer capability validation
       ↓
4. Document/order compatibility
       ↓
5. Pricing/payment/business-state validation
       ↓
6. Resolve and persist job settings
       ↓
7. Dispatch to Print Agent
```

Do not dispatch a job before all required validations pass.

---

## 9.5.7 Capability mapping

The database stores coarse capabilities:

```text
BW
COLOR
A4
A3
```

The Print Agent is responsible for translating generic PrintKro settings into local driver-specific instructions.

For example:

```text
PrintKro:
inputTray = BYPASS_TRAY

        ↓

Windows/Linux print subsystem:
driver-specific tray identifier
```

The agent must not assume that `TRAY_1` has the same native identifier on every printer.

This abstraction is important for universal printer support.

---

## 9.5.8 Quality setting semantics

`printQualityDpi` is a requested quality tier, not a guarantee that every physical printer can produce exactly that DPI.

The agent should:

1. inspect supported driver/printer settings;
2. map the requested tier to the closest supported native setting;
3. reject the job when the requested quality is mandatory and no compatible setting exists; or
4. apply a documented fallback only if the product policy explicitly allows it.

The selected execution behavior should be observable in agent logs.

---

## 9.5.9 Orientation semantics

Orientation is a logical document setting:

```text
PORTRAIT
LANDSCAPE
```

The agent maps it to the native print subsystem.

Do not store printer-specific driver option names in PostgreSQL.

---

## 9.5.10 Unsupported features intentionally removed

The following are not part of this MVP preset contract:

```text
duplex
pages per sheet
scaling
collation
binding
stapling
custom paper dimensions
photo-specific modes
```

The schema should not add fields for these until there is a concrete product requirement and an implementation strategy across supported operating systems/drivers.


# 10. Core business workflows mapped to the schema

# 10.1 QR → guest session

```text
shop_qr_codes
      ↓
shops
      ↓
print_users
```

Recommended application sequence:

1. Resolve QR code.
2. Validate QR status/expiration.
3. Validate shop status.
4. Create or reuse guest session.
5. Associate future orders with `print_users.id`.

The QR itself does not become the order owner.

---

# 10.2 Create an order

```text
print_users
      ↓
orders
      ↓
order_documents
      ↓
print_configurations
      ↓
order_items
```

At creation:

```text
orders.status = CREATED
```

As the customer configures documents:

```text
CONFIGURING
```

---

# 10.3 Upload a document

Recommended lifecycle:

```text
order_documents.status = UPLOADING
        ↓
object storage upload
        ↓
UPLOADED
        ↓
PROCESSING
        ↓
READY
```

Failure:

```text
PROCESSING → FAILED
```

The application should not allow a print job to execute an unusable document.

---

# 10.4 Calculate pricing

Pricing lookup:

```text
shop_pricing
```

Price snapshot:

```text
order_items
```

Example:

```text
Current shop price:
COLOR + A4 + DOCUMENT_PRINT = 100 paise/page

Document:
10 selected pages
2 copies

Billable quantity:
20

Order item:
unit_price = 100
quantity = 20
total = 2000
```

The exact interpretation of `quantity` must remain consistent across the pricing service.

---

# 10.5 Payment

Business payment:

```text
payments
```

Provider-specific attempts:

```text
payment_transactions
```

Refund:

```text
refunds
```

The business order should use `payments.status` as the primary payment state.

Provider response payloads should not be used directly as the business state without validation.

---

# 10.6 Shop accepts an order

Recommended transaction:

```text
BEGIN

lock/check order

validate:
  order status = SUBMITTED
  documents are READY
  payment condition is satisfied
  shop is active
  requested configuration can be fulfilled

UPDATE orders
SET status = SHOP_ACCEPTED,
    accepted_at = now()

INSERT order_status_history

COMMIT
```

Do not mark the order accepted before the validation succeeds.

---

# 10.7 Generate physical print jobs

After acceptance:

```text
orders
   ↓
order_documents
   ↓
print_configurations
   ↓
print_jobs
   ↓
printer
   ↓
print_agent
```

A single order can generate multiple physical jobs.

The routing layer chooses a printer based on:

- printer status
- agent status
- printer capabilities
- requested color
- requested paper
- shop ownership
- operational availability

The schema stores the selected printer/agent, but the routing decision belongs to the application.

---

# 10.8 Print Agent execution

Conceptually:

```text
print_jobs.status = QUEUED
        ↓
DISPATCHING
        ↓
Print Agent receives job
        ↓
PRINTING
        ↓
COMPLETED
```

Failure:

```text
PRINTING → FAILED
```

The Print Agent should never be trusted solely because it has a database UUID. It needs authenticated communication and authorization.

---

# 10.9 Order-level print completion

If an order has multiple print jobs:

```text
Job A → COMPLETED
Job B → COMPLETED
Job C → COMPLETED
```

then the application can transition:

```text
orders.status
PRINTING → READY
```

The database does not automatically calculate this.

The order orchestration service must inspect all jobs.

---

# 10.10 Customer pickup

When the shop hands the printed material to the customer:

```text
READY → COMPLETED
```

Set:

```text
completed_at = now()
```

If cash is still pending, the shop should record cash payment before treating the business transaction as fully settled according to the product's payment policy.

---

# 11. Order state-machine guidance

The current enum permits these states:

```text
CREATED
CONFIGURING
PAYMENT_PENDING
SUBMITTED
SHOP_ACCEPTED
PRINTING
READY
COMPLETED
CANCELLED
REJECTED
PRINT_FAILED
```

A sensible MVP transition model is:

```text
CREATED
  ↓
CONFIGURING
  ↓
PAYMENT_PENDING
  ↓
SUBMITTED
  ↓
SHOP_ACCEPTED
  ↓
PRINTING
  ↓
READY
  ↓
COMPLETED
```

Possible terminal/failure branches:

```text
PAYMENT_PENDING → CANCELLED
SUBMITTED → REJECTED
SHOP_ACCEPTED → PRINT_FAILED
PRINTING → PRINT_FAILED
```

However, the exact transition graph is **application policy**, not a PostgreSQL constraint.

### Agent rule

Centralize transitions in one domain/service component.

Do not let arbitrary controllers perform unrestricted:

```sql
UPDATE orders SET status = ...
```

---

# 12. Document lifecycle and retention

The intended privacy lifecycle is:

```text
UPLOAD
  ↓
UPLOADED
  ↓
PROCESSING
  ↓
READY
  ↓
PRINT
  ↓
ORDER COMPLETED
  ↓
retention_until reached
  ↓
delete object storage file
  ↓
mark document DELETED
  ↓
set deleted_at
```

## Important

`retention_until` does not automatically delete anything.

A background retention worker must:

1. Find documents where `retention_until <= now()`.
2. Confirm `deleted_at IS NULL`.
3. Delete the object from object storage.
4. Mark database record as deleted.
5. Record relevant audit information if required.
6. Make the operation idempotent.

The partial index:

```text
(retention_until)
WHERE deleted_at IS NULL
```

exists specifically to support this cleanup workload.

---

# 13. Security model

## 13.1 Guest access

Guest users are authenticated through their session token.

Authorization should ensure:

```text
session → print_user → order → document
```

A guest must not be able to access another guest's order by changing a UUID in the URL.

---

## 13.2 Shop access

A shop user must be authorized against the shop:

```text
shop_user.shop_id
        =
order.shop_id
```

Do not authorize a shop user simply because they know an order UUID.

---

## 13.3 Document access

Documents are sensitive.

Recommended architecture:

```text
client
  ↓
authorized backend endpoint
  ↓
authorization check
  ↓
temporary signed object-storage URL
  ↓
object storage
```

Avoid permanent public document URLs.

---

## 13.4 Print Agent security

The Print Agent is a privileged execution component.

A compromised agent could potentially print arbitrary files if the backend trusts it too much.

The agent protocol should therefore include:

- authenticated agent identity
- short-lived credentials or rotated credentials
- shop scoping
- authorized job retrieval
- server-side validation
- replay/idempotency protection
- TLS
- agent version reporting

These requirements are not represented completely by the relational schema.

---

# 14. Multi-tenant isolation

PrintKro is effectively multi-tenant at the shop level.

For shop-side queries, the primary security boundary is:

```text
shop_id
```

Example:

```sql
SELECT *
FROM orders
WHERE shop_id = :authenticated_shop_id;
```

Never use:

```sql
SELECT *
FROM orders
WHERE id = :order_id;
```

alone for a shop-facing request.

The same principle applies to:

- documents
- print jobs
- printers
- agents
- pricing
- subscriptions
- shop users

### Future option

PostgreSQL Row Level Security could be introduced later, but the current SQL does not configure RLS.

---

# 15. Transaction boundaries

## 15.1 Create order

The following should normally be one transaction:

```text
create order
create documents metadata
create configurations
create order items
write initial status history
```

Object storage upload can be coordinated with a pending/processing state because database transactions cannot atomically include external object storage.

---

## 15.2 Accept order

Use one transaction for:

```text
validate
update order status
set accepted_at
insert status history
```

---

## 15.3 Payment webhook

A payment webhook must be idempotent.

Typical flow:

```text
receive webhook
    ↓
verify provider signature
    ↓
identify provider transaction
    ↓
check whether event/transaction was already processed
    ↓
insert/update payment transaction
    ↓
update business payment
    ↓
possibly update order
    ↓
commit
```

Do not make "webhook received" synonymous with "payment trusted".

---

## 15.4 Print job assignment

Assignment should be transactional enough to avoid two workers claiming the same work.

A production queue worker will likely need PostgreSQL locking patterns such as:

```text
SELECT ... FOR UPDATE SKIP LOCKED
```

or another explicit queue/lease strategy.

The schema provides indexes for queue access but does not itself implement job claiming.

---

# 16. Concurrency rules

## Order updates

Two actors may act simultaneously:

```text
Shop clicks Accept
Customer cancels
```

The service layer must use transactional state checks.

Do not assume the status seen by a UI is still current when the write occurs.

---

## Payment + order

A payment webhook can arrive while a customer request is processing.

Payment state changes must be idempotent and concurrency-safe.

---

## Print jobs

Multiple agents/workers must not execute the same job twice.

The print dispatch protocol needs a claim/lease/idempotency strategy.

The current `print_jobs` schema has `status`, timestamps, and retry count but does not contain a dedicated lease token or execution-attempt identifier.

If exactly-once physical execution is required, additional protocol/application controls are needed.

---

# 17. Important schema limitations agents must know

These are not necessarily bugs; they are places where the application layer currently carries responsibility.

## 17.1 Order totals

The database checks only that amounts are non-negative.

It does not enforce:

```text
subtotal + tax - discount = total
```

---

## 17.2 Order item arithmetic

The database does not enforce:

```text
quantity × unit_price = total_price
```

---

## 17.3 Page-selection validity

The database only checks that a page-selection string is non-empty when present.

It does not validate:

```text
1,3,5-8
```

against `page_count`.

---

## 17.4 Order state transitions

Any enum value can technically be written.

The service layer must enforce legal transitions.

---

## 17.5 Cross-entity consistency

The database does not fully enforce:

```text
printer.shop_id = print_agent.shop_id
```

or:

```text
print_job.order_id = order_document.order_id
```

These must be validated in application logic or strengthened with future composite constraints.

---

## 17.6 Active pricing uniqueness

Multiple active pricing rows can theoretically exist for the same configuration.

The pricing service must avoid ambiguous prices.

---

## 17.7 Active subscription uniqueness

Multiple subscriptions can exist for one shop.

If only one subscription may be active at a time, the subscription service must enforce it.

---

## 17.8 Polymorphic actors

These fields are polymorphic and therefore not backed by ordinary foreign keys:

```text
order_status_history.changed_by_type
order_status_history.changed_by_id

notifications.recipient_type
notifications.recipient_id

document_access_logs.actor_type
document_access_logs.actor_id

audit_logs.actor_type
audit_logs.actor_id
```

Use a shared actor convention in application code.

---

## 17.9 Refund status

Refund status is a free-form `VARCHAR`.

Standardize its values in one application module.

---

# 18. API/domain model guidance

The database model should not be copied blindly into public API DTOs.

For example, do not expose:

```text
session_token_hash
password_hash
raw payment responses
internal storage keys
internal audit metadata
```

Public APIs should expose only what the caller is authorized to see.

A customer order response might contain:

```text
order_number
status
documents
print configuration
pricing summary
payment status
estimated ready time
```

A shop response may additionally include:

```text
print jobs
printer assignment
agent status
operational failure information
```

An admin response may include broader operational/audit information.

---

# 19. Suggested service/module ownership

A clean application architecture can map database domains to services/modules:

```text
shops/
  shops
  shop_users
  shop_qr_codes
  shop_services
  shop_capabilities
  shop_pricing
  shop_business_hours

guest/
  print_users

orders/
  orders
  order_documents
  print_configurations
  order_items
  order_status_history

payments/
  payments
  payment_transactions
  refunds

printing/
  print_agents
  printers
  printer_capabilities
  print_jobs

notifications/
  notifications

subscriptions/
  subscription_plans
  shop_subscriptions

security/
  document_access_logs
  audit_logs
```

This keeps business rules close to the domain that owns them.

---

# 20. Agent implementation rules

When an AI coding agent works with this database, it should follow these rules.

## Rule 1 — Never invent columns

If a requested feature needs a field that does not exist:

1. State that the field is absent.
2. Determine whether it belongs in application state or persistent schema.
3. If persistent, propose a migration.
4. Do not silently store it inside an unrelated field.

---

## Rule 2 — Never use IP as guest identity

Use:

```text
session_token_hash
```

for guest authentication.

Use IP only as supporting metadata/security information.

---

## Rule 3 — Never store files in PostgreSQL

`order_documents` stores metadata.

The binary file belongs in object storage.

---

## Rule 4 — Never use floating-point money

Use:

```text
BIGINT minor units
```

---

## Rule 5 — Never use current pricing to reconstruct historical orders

Use:

```text
shop_pricing
```

for current configuration.

Use:

```text
order_items
```

for historical billing.

---

## Rule 6 — Never equate an order with a print job

```text
order = business transaction
print_job = physical execution
```

One order can have multiple jobs.

---

## Rule 7 — Printer presets are defaults, not mutable job state

A job must never mutate:

```text
printers.default_print_settings
```

Always resolve into a separate job snapshot:

```text
resolved_settings =
    printer.default_print_settings
    || print_jobs.requested_overrides
```

---

## Rule 8 — Preserve the resolved print configuration

Once a print job is created, `resolved_settings` is the historical execution contract.

Do not rebuild it from the current printer preset during retry, status polling, reporting, or auditing.

---

## Rule 9 — Keep overrides partial

`requested_overrides` should contain only fields the caller explicitly supplied.

Do not copy the complete preset into `requested_overrides`.

Correct:

```json
{
  "copies": 3
}
```

Incorrect:

```json
{
  "copies": 3,
  "orientation": "PORTRAIT",
  "paperSize": "A4",
  "inputTray": "AUTO_SELECT",
  "colorMode": "COLOR",
  "printQualityDpi": "STANDARD_600DPI"
}
```

The latter loses the distinction between defaults and explicit overrides.

---

## Rule 10 — Validate capabilities before dispatch

A valid JSON configuration can still be physically impossible.

For example:

```text
requested colorMode = COLOR
printer capabilities = BW + A4
```

must not be dispatched.

---

## Rule 7 — Never assume a printer is capable because it exists

Check:

```text
printer.status
print_agent.status
printer_capabilities
shop_capabilities
requested print configuration
```

---

## Rule 8 — Record important state transitions

Whenever order status changes, update:

```text
orders.status
```

and insert:

```text
order_status_history
```

in the same transaction.

---

## Rule 9 — Protect tenant boundaries

Every shop-facing query must be scoped to the authenticated shop.

---

## Rule 10 — Treat external systems as unreliable

Payment providers, object storage, Print Agents, and physical printers can fail.

Database state should reflect verified outcomes, not assumptions.

---

# 21. What belongs in PostgreSQL vs outside PostgreSQL

| Responsibility | PostgreSQL | Application / Worker | External System |
|---|:---:|:---:|:---:|
| Shop records | ✓ | | |
| Guest sessions | ✓ | ✓ authentication | |
| Order state | ✓ | ✓ transition rules | |
| Page parsing | | ✓ | |
| File bytes | | | ✓ object storage |
| File metadata | ✓ | ✓ processing | |
| Price configuration | ✓ | ✓ calculation | |
| Payment business state | ✓ | ✓ | payment provider |
| Payment webhook verification | | ✓ | payment provider |
| Print routing | | ✓ | |
| Print queue persistence | ✓ | ✓ | |
| Printer communication | | ✓ Print Agent | local OS/printer |
| Printer physical execution | | | ✓ hardware |
| Notifications | ✓ | ✓ delivery | email/push/etc. if added |
| Subscription state | ✓ | ✓ billing logic | payment provider if used |
| Audit records | ✓ | ✓ event creation | |
| Document retention metadata | ✓ | ✓ cleanup worker | object storage |

---

# 22. MVP scope reflected by the schema

The schema currently supports:

### Customer side

- QR-based entry
- Guest sessions
- Multiple documents
- Document metadata
- Document processing state
- B&W/color
- Copies
- A4
- Page selection
- Price calculation/snapshot
- Online/cash payment
- Order tracking

### Shop side

- Shop identity
- Staff accounts
- Shop capabilities
- Services
- Pricing
- Business hours
- Print Agent registration
- Printer registration
- Printer capabilities
- Print queue/jobs
- Print failure state
- Notifications

### Platform side

- Subscription plans
- Shop subscriptions
- Audit logs
- Document access logs

---

# 23. Features deliberately not represented in the current MVP schema

Do not assume these exist merely because they may appear in future product discussions:

- Customer accounts/passwords
- Customer order history as a dedicated profile feature
- Duplex/single-sided configuration
- A3 paper in the current `paper_size` enum
- Pages-per-sheet
- Orientation
- Scaling
- Collation
- Binding
- Stapling
- Special print instructions
- Inventory management
- Toner tracking
- Paper stock tracking
- Marketplace discovery
- Home delivery
- CRM
- Loyalty
- Promotions
- Advanced printer telemetry
- Detailed print-attempt history
- Dedicated printer leasing/ownership accounting

Adding any of these should be treated as a deliberate schema/product change.

---

# 24. Recommended end-to-end example

Assume:

```text
Shop:
ABC Xerox

Customer:
Guest session

Documents:
Resume.pdf — 3 pages
Marksheet.pdf — 4 pages

Configuration:
Resume:
  COLOR
  A4
  1 copy
  pages 1-3

Marksheet:
  BW
  A4
  2 copies
  pages 1,2,4
```

The relational state should conceptually look like:

```text
shops
└── ABC Xerox
      │
      ├── shop_qr_codes
      ├── shop_capabilities
      ├── shop_pricing
      └── print_agents
             │
             ├── printers
             │    ├── BW
             │    └── COLOR + A4
             │
             └── ...

print_users
└── Guest session
      │
      └── orders
           │
           ├── order_documents
           │    ├── Resume.pdf
           │    │      └── print_configurations
           │    │
           │    └── Marksheet.pdf
           │           └── print_configurations
           │
           ├── order_items
           │    ├── Resume line item
           │    └── Marksheet line item
           │
           ├── payments
           │
           ├── order_status_history
           │
           └── print_jobs
                ├── Resume → Color/A4 printer
                └── Marksheet → BW/A4 printer
```

The key point is that **pricing, customer intent, document metadata, and physical execution remain separate records**.

---

# 25. Final mental model for an AI coding agent

When reasoning about any feature, start from this chain:

```text
WHO?
  ↓
print_user / shop_user

WHICH SHOP?
  ↓
shops

WHAT WAS ORDERED?
  ↓
orders
  ↓
order_items

WHICH FILE?
  ↓
order_documents

HOW SHOULD IT BE PRINTED?
  ↓
print_configurations

HOW MUCH DOES IT COST?
  ↓
shop_pricing → order_items snapshot

WAS IT PAID?
  ↓
payments
  ↓
payment_transactions / refunds

HOW DID THE ORDER PROGRESS?
  ↓
order_status_history

HOW IS IT PHYSICALLY PRINTED?
  ↓
print_jobs
  ↓
printers
  ↓
print_agents

WHAT CAN THE PRINTER DO?
  ↓
printer_capabilities

WHAT CAN THE SHOP OFFER?
  ↓
shop_capabilities / shop_services

WHO WAS NOTIFIED?
  ↓
notifications

WHO DID WHAT?
  ↓
audit_logs / document_access_logs

HOW LONG SHOULD FILES EXIST?
  ↓
retention_until / deleted_at
```

If a proposed implementation does not fit cleanly into one of these responsibilities, stop and determine whether the feature is actually a new domain concept rather than forcing it into an existing table.

---

# 26. Schema change protocol

When changing this schema, an agent should follow:

```text
1. Identify the domain.
2. Identify whether the information is transient or persistent.
3. Check whether an existing field already represents it.
4. Check existing FK/delete semantics.
5. Check whether historical records need snapshots.
6. Check tenant isolation.
7. Check privacy/security implications.
8. Check indexes needed by the expected query.
9. Check whether the new rule belongs in PostgreSQL or application code.
10. Write a migration.
11. Update this documentation.
12. Update application/domain types.
13. Update tests.
```

Never edit production schema manually without a migration history.

---

# 27. Non-negotiable architectural principles

The following principles should be treated as part of the PrintKro database contract:

1. **Guest customer identity is session-based, not IP-based.**
2. **Shop users and Print Users are different domains.**
3. **Orders are business transactions.**
4. **Print jobs are physical execution units.**
5. **Documents are metadata in PostgreSQL and bytes in object storage.**
6. **Historical prices belong to order snapshots, not current shop pricing.**
7. **Money is represented in integer minor units.**
8. **Printer integration is a Day-0 MVP capability.**
9. **Print Agents are the bridge between cloud and local printer infrastructure.**
10. **Printer capability must be checked before dispatch.**
11. **Important order transitions require history records.**
12. **External payment and printing systems must be treated as failure-prone.**
13. **Shop data must be tenant-isolated.**
14. **Sensitive document access must be authorized and auditable.**
15. **Retention cleanup must remove actual object-storage files, not merely database metadata.**
16. **Schema constraints and application business rules are complementary, not interchangeable.**

---

# 28. Source-of-truth hierarchy

When there is a conflict between documents, use this hierarchy:

```text
1. Actual PostgreSQL SQL schema
       ↓
2. Explicit product requirement
       ↓
3. Schema documentation
       ↓
4. General implementation convention
```

The SQL is the authoritative representation of what exists today.

If the product requirement requires something the SQL does not support, that is a **schema change requirement**, not permission to pretend the field already exists.



---

# Appendix A — Exact schema inventory

## Tables

1. `shops`
2. `shop_users`
3. `print_users`
4. `shop_qr_codes`
5. `shop_services`
6. `shop_capabilities`
7. `shop_pricing`
8. `shop_business_hours`
9. `orders`
10. `order_documents`
11. `print_configurations`
12. `order_items`
13. `order_status_history`
14. `payments`
15. `payment_transactions`
16. `refunds`
17. `print_agents`
18. `printers`
19. `printer_capabilities`
20. `print_jobs`
21. `notifications`
22. `subscription_plans`
23. `shop_subscriptions`
24. `document_access_logs`
25. `audit_logs`

## ENUM types

1. `shop_status`
2. `shop_user_role`
3. `shop_user_status`
4. `print_user_status`
5. `qr_code_status`
6. `service_type`
7. `color_mode`
8. `paper_size`
9. `pricing_unit`
10. `order_status`
11. `payment_method`
12. `payment_status`
13. `document_status`
14. `print_job_status`
15. `print_agent_status`
16. `printer_status`
17. `printer_capability_type`
18. `notification_recipient_type`
19. `notification_type`
20. `subscription_interval`
21. `subscription_status`

## Indexes

1. `uq_shop_users_email`
2. `idx_shop_users_shop_status`
3. `idx_print_users_ip`
4. `idx_print_users_status_expires`
5. `idx_shop_qr_codes_shop_status`
6. `idx_shop_pricing_lookup`
7. `idx_orders_shop_created`
8. `idx_orders_shop_status`
9. `idx_orders_print_user`
10. `idx_orders_status`
11. `idx_order_documents_order`
12. `idx_order_documents_retention`
13. `idx_order_items_order`
14. `idx_order_status_history_order`
15. `idx_payments_status`
16. `idx_payment_transactions_payment`
17. `idx_payment_transactions_provider_id`
18. `idx_refunds_payment`
19. `idx_print_agents_shop_status`
20. `idx_printers_shop_status`
21. `idx_printers_agent`
22. `idx_print_jobs_order`
23. `idx_print_jobs_printer_status`
24. `idx_print_jobs_agent_status`
25. `idx_print_jobs_queue`
26. `idx_notifications_recipient`
27. `idx_shop_subscriptions_shop_status`
28. `idx_document_access_logs_document`
29. `idx_audit_logs_entity`

## `updated_at` triggers

1. `trg_shops_updated_at`
2. `trg_shop_users_updated_at`
3. `trg_print_users_updated_at`
4. `trg_shop_services_updated_at`
5. `trg_shop_capabilities_updated_at`
6. `trg_shop_pricing_updated_at`
7. `trg_shop_business_hours_updated_at`
8. `trg_orders_updated_at`
9. `trg_order_documents_updated_at`
10. `trg_print_configurations_updated_at`
11. `trg_payments_updated_at`
12. `trg_print_agents_updated_at`
13. `trg_printers_updated_at`
14. `trg_print_jobs_updated_at`
15. `trg_subscription_plans_updated_at`
16. `trg_shop_subscriptions_updated_at`


## Appendix B — Exact SQL coverage note

This document is intentionally organized around the actual objects in `printkro_mvp_schema_v3.sql`. The field-level sections explain the purpose and engineering meaning of each column in every table, including the printer preset and job-resolution fields. The ENUM, constraint, index, trigger, relationship, delete-behavior, workflow, security, concurrency, API-contract, and implementation sections explain how those fields should be used.

Where the SQL does not enforce a business rule, this document explicitly identifies the rule as application/service-layer responsibility rather than presenting it as a PostgreSQL guarantee.
