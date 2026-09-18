-- ============================================================
-- PrintKro MVP - Simplified PostgreSQL Schema
-- ============================================================
-- Purpose:
--   Minimal relational schema for the PrintKro MVP.
--
-- Core workflow:
--   Print User -> Shop -> Order -> Documents -> Print Jobs
--                                      -> Print Agent -> Printer
--
-- Important design decisions:
--   1. Print Users are guest users; no account/password is required.
--   2. print_users stores a session identifier and IP address.
--   3. IP address is NOT globally unique. Multiple people can share an IP
--      (NAT, mobile networks, Wi-Fi), so it is useful as a signal, not a
--      secure identity. The session_token_hash is the actual session key.
--   4. Shop users are separated from Print Users.
--   5. Actual files live in object storage; PostgreSQL stores metadata.
--   6. Printer integration is an MVP/day-zero feature.
--   7. Orders are business records; print_jobs are physical execution records.
--   8. Money is stored in minor units (INR paise).
--   9. Advanced printing, marketplace, CRM, inventory, etc. are intentionally
--      excluded from this MVP schema.
--
-- PostgreSQL 15+ recommended.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE shop_status AS ENUM (
    'PENDING',
    'ACTIVE',
    'SUSPENDED',
    'INACTIVE'
);

CREATE TYPE shop_user_role AS ENUM (
    'OWNER',
    'MANAGER',
    'STAFF'
);

CREATE TYPE shop_user_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

CREATE TYPE print_user_status AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'BLOCKED'
);

CREATE TYPE qr_code_status AS ENUM (
    'ACTIVE',
    'DISABLED',
    'EXPIRED'
);

CREATE TYPE service_type AS ENUM (
    'DOCUMENT_PRINT'
);

CREATE TYPE color_mode AS ENUM (
    'BW',
    'COLOR'
);

CREATE TYPE paper_size AS ENUM (
    'A4'
);

CREATE TYPE pricing_unit AS ENUM (
    'PER_PAGE'
);

CREATE TYPE order_status AS ENUM (
    'CREATED',
    'CONFIGURING',
    'PAYMENT_PENDING',
    'SUBMITTED',
    'SHOP_ACCEPTED',
    'PRINTING',
    'READY',
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
    'PRINT_FAILED'
);

CREATE TYPE payment_method AS ENUM (
    'ONLINE',
    'CASH'
);

CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'PARTIALLY_REFUNDED'
);

CREATE TYPE document_status AS ENUM (
    'UPLOADING',
    'UPLOADED',
    'PROCESSING',
    'READY',
    'FAILED',
    'DELETED'
);

CREATE TYPE print_job_status AS ENUM (
    'QUEUED',
    'DISPATCHING',
    'PRINTING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);

CREATE TYPE print_agent_status AS ENUM (
    'ONLINE',
    'OFFLINE',
    'DISABLED'
);

CREATE TYPE printer_status AS ENUM (
    'ONLINE',
    'OFFLINE',
    'PRINTING',
    'ERROR',
    'PAUSED',
    'DISABLED'
);

CREATE TYPE printer_capability_type AS ENUM (
    'BW',
    'COLOR',
    'A4'
);

CREATE TYPE notification_recipient_type AS ENUM (
    'PRINT_USER',
    'SHOP_USER'
);

CREATE TYPE notification_type AS ENUM (
    'NEW_ORDER',
    'PAYMENT_RECEIVED',
    'ORDER_ACCEPTED',
    'PRINT_STARTED',
    'PRINT_FAILED',
    'ORDER_READY',
    'ORDER_CANCELLED'
);

CREATE TYPE subscription_interval AS ENUM (
    'MONTHLY',
    'YEARLY'
);

CREATE TYPE subscription_status AS ENUM (
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'CANCELLED',
    'EXPIRED',
    'SUSPENDED'
);

-- ============================================================
-- SHOPS
-- ============================================================

CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(200) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,

    phone VARCHAR(32),
    email VARCHAR(320),

    address_line_1 TEXT,
    address_line_2 TEXT,
    city VARCHAR(120),
    state VARCHAR(120),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL DEFAULT 'India',

    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),

    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',

    status shop_status NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_shops_latitude
        CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),

    CONSTRAINT chk_shops_longitude
        CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

-- ============================================================
-- SHOP USERS
-- ============================================================
-- Business-side identities: owner, manager, staff.
-- These are completely separate from anonymous Print Users.

CREATE TABLE shop_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,

    email VARCHAR(320),
    phone VARCHAR(32),

    role shop_user_role NOT NULL DEFAULT 'STAFF',
    status shop_user_status NOT NULL DEFAULT 'ACTIVE',

    password_hash TEXT,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_shop_users_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_shop_users_email
    ON shop_users (lower(email))
    WHERE email IS NOT NULL;

CREATE INDEX idx_shop_users_shop_status
    ON shop_users (shop_id, status);

-- ============================================================
-- PRINT USERS
-- ============================================================
-- Anonymous end users.
--
-- IMPORTANT:
--   ip_address is stored for analytics/security/session correlation,
--   but it must NOT be treated as a globally unique user identity.
--
--   session_token_hash is the actual session identifier.
--
--   A returning browser/device can reuse its session token while valid.
--   If you want to associate a new session with an existing print user,
--   the application may use IP + user-agent + other non-sensitive signals,
--   but should not assume IP alone means the same person.

CREATE TABLE print_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_token_hash VARCHAR(128) NOT NULL UNIQUE,

    ip_address INET,
    user_agent TEXT,

    status print_user_status NOT NULL DEFAULT 'ACTIVE',

    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_print_users_ip
    ON print_users (ip_address);

CREATE INDEX idx_print_users_status_expires
    ON print_users (status, expires_at);

-- ============================================================
-- SHOP QR CODES
-- ============================================================

CREATE TABLE shop_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,
    code VARCHAR(255) NOT NULL UNIQUE,

    status qr_code_status NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,

    CONSTRAINT fk_shop_qr_codes_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_shop_qr_codes_shop_status
    ON shop_qr_codes (shop_id, status);

-- ============================================================
-- SHOP SERVICES
-- ============================================================
-- Keep this intentionally small for MVP.
-- More service types can be added later.

CREATE TABLE shop_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,
    service_type service_type NOT NULL,

    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_shop_services_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_shop_service
        UNIQUE (shop_id, service_type)
);

-- ============================================================
-- SHOP CAPABILITIES
-- ============================================================
-- This is the shop-level capability snapshot.
-- Actual printer capabilities are stored separately below.

CREATE TABLE shop_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL UNIQUE,

    bw_printing BOOLEAN NOT NULL DEFAULT TRUE,
    color_printing BOOLEAN NOT NULL DEFAULT FALSE,
    a4_printing BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_shop_capabilities_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE
);

-- ============================================================
-- SHOP PRICING
-- ============================================================
-- Current pricing configuration.
-- Historical order prices are copied into order_items.

CREATE TABLE shop_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,

    service_type service_type NOT NULL,
    color_mode color_mode NOT NULL,
    paper_size paper_size NOT NULL DEFAULT 'A4',

    unit pricing_unit NOT NULL DEFAULT 'PER_PAGE',

    price_minor_units BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_shop_pricing_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_shop_pricing_price
        CHECK (price_minor_units >= 0)
);

CREATE INDEX idx_shop_pricing_lookup
    ON shop_pricing (shop_id, service_type, color_mode, paper_size, is_active);

-- ============================================================
-- SHOP BUSINESS HOURS
-- ============================================================

CREATE TABLE shop_business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,

    day_of_week SMALLINT NOT NULL,
    opens_at TIME,
    closes_at TIME,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_shop_business_hours_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_shop_business_hours_day
        CHECK (day_of_week BETWEEN 0 AND 6),

    CONSTRAINT chk_shop_business_hours_times
        CHECK (
            is_closed = TRUE
            OR (opens_at IS NOT NULL AND closes_at IS NOT NULL)
        ),

    CONSTRAINT uq_shop_business_hours_day
        UNIQUE (shop_id, day_of_week)
);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_number VARCHAR(32) NOT NULL UNIQUE,

    shop_id UUID NOT NULL,
    print_user_id UUID NOT NULL,

    status order_status NOT NULL DEFAULT 'CREATED',

    subtotal_minor_units BIGINT NOT NULL DEFAULT 0,
    tax_minor_units BIGINT NOT NULL DEFAULT 0,
    discount_minor_units BIGINT NOT NULL DEFAULT 0,
    total_minor_units BIGINT NOT NULL DEFAULT 0,

    currency CHAR(3) NOT NULL DEFAULT 'INR',

    estimated_ready_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_orders_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_orders_print_user
        FOREIGN KEY (print_user_id)
        REFERENCES print_users(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_orders_amounts
        CHECK (
            subtotal_minor_units >= 0
            AND tax_minor_units >= 0
            AND discount_minor_units >= 0
            AND total_minor_units >= 0
        )
);

CREATE INDEX idx_orders_shop_created
    ON orders (shop_id, created_at DESC);

CREATE INDEX idx_orders_shop_status
    ON orders (shop_id, status);

CREATE INDEX idx_orders_print_user
    ON orders (print_user_id);

CREATE INDEX idx_orders_status
    ON orders (status);

-- ============================================================
-- ORDER DOCUMENTS
-- ============================================================
-- PostgreSQL stores metadata only.
-- Actual file bytes are stored in object storage.

CREATE TABLE order_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL,

    original_filename VARCHAR(255) NOT NULL,
    storage_key TEXT NOT NULL,

    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,

    page_count INTEGER,

    document_index INTEGER NOT NULL,

    status document_status NOT NULL DEFAULT 'UPLOADING',

    retention_until TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_order_documents_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_order_documents_size
        CHECK (file_size_bytes >= 0),

    CONSTRAINT chk_order_documents_page_count
        CHECK (page_count IS NULL OR page_count > 0),

    CONSTRAINT chk_order_documents_index
        CHECK (document_index >= 0),

    CONSTRAINT uq_order_document_index
        UNIQUE (order_id, document_index)
);

CREATE INDEX idx_order_documents_order
    ON order_documents (order_id);

CREATE INDEX idx_order_documents_retention
    ON order_documents (retention_until)
    WHERE deleted_at IS NULL;

-- ============================================================
-- PRINT CONFIGURATIONS
-- ============================================================
-- One configuration per uploaded document.

CREATE TABLE print_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_document_id UUID NOT NULL UNIQUE,

    color_mode color_mode NOT NULL,
    copies INTEGER NOT NULL DEFAULT 1,
    paper_size paper_size NOT NULL DEFAULT 'A4',

    -- Example: "1,3,5-8".
    -- Application code must parse and validate this against page_count.
    page_selection TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_print_configurations_document
        FOREIGN KEY (order_document_id)
        REFERENCES order_documents(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_print_configurations_copies
        CHECK (copies > 0),

    CONSTRAINT chk_print_configurations_page_selection
        CHECK (
            page_selection IS NULL
            OR length(trim(page_selection)) > 0
        )
);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
-- Billable snapshot.
-- This prevents future price changes from changing old orders.

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL,
    order_document_id UUID,

    item_type service_type NOT NULL DEFAULT 'DOCUMENT_PRINT',

    description TEXT NOT NULL,

    quantity INTEGER NOT NULL DEFAULT 1,

    unit_price_minor_units BIGINT NOT NULL,
    total_price_minor_units BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_order_items_document
        FOREIGN KEY (order_document_id)
        REFERENCES order_documents(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_order_items_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_order_items_prices
        CHECK (
            unit_price_minor_units >= 0
            AND total_price_minor_units >= 0
        )
);

CREATE INDEX idx_order_items_order
    ON order_items (order_id);

-- ============================================================
-- ORDER STATUS HISTORY
-- ============================================================

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL,

    from_status order_status,
    to_status order_status NOT NULL,

    changed_by_type VARCHAR(30) NOT NULL,
    changed_by_id UUID,

    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_order_status_history_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_order_status_history_order
    ON order_status_history (order_id, created_at);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL UNIQUE,

    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'PENDING',

    amount_minor_units BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',

    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_payments_amount
        CHECK (amount_minor_units >= 0)
);

CREATE INDEX idx_payments_status
    ON payments (status);

-- ============================================================
-- PAYMENT TRANSACTIONS
-- ============================================================
-- Keeps gateway-specific information separate from the business
-- payment record.

CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    payment_id UUID NOT NULL,

    provider VARCHAR(100),
    provider_transaction_id VARCHAR(255),

    transaction_type VARCHAR(30) NOT NULL DEFAULT 'PAYMENT',

    status payment_status NOT NULL,

    amount_minor_units BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',

    raw_response JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_payment_transactions_payment
        FOREIGN KEY (payment_id)
        REFERENCES payments(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_payment_transactions_amount
        CHECK (amount_minor_units >= 0)
);

CREATE INDEX idx_payment_transactions_payment
    ON payment_transactions (payment_id);

CREATE INDEX idx_payment_transactions_provider_id
    ON payment_transactions (provider, provider_transaction_id);

-- ============================================================
-- REFUNDS
-- ============================================================

CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    payment_id UUID NOT NULL,

    amount_minor_units BIGINT NOT NULL,

    reason TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    provider_reference VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,

    CONSTRAINT fk_refunds_payment
        FOREIGN KEY (payment_id)
        REFERENCES payments(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_refunds_amount
        CHECK (amount_minor_units > 0)
);

CREATE INDEX idx_refunds_payment
    ON refunds (payment_id);

-- ============================================================
-- PRINT AGENTS
-- ============================================================
-- A Print Agent is the local software running on the shop computer.
--
-- Cloud backend
--       |
--       v
-- Print Agent
--       |
--       v
-- Local printer(s)

CREATE TABLE print_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,

    device_identifier VARCHAR(255) NOT NULL UNIQUE,

    status print_agent_status NOT NULL DEFAULT 'OFFLINE',

    version VARCHAR(50),

    last_seen_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_print_agents_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_print_agents_shop_status
    ON print_agents (shop_id, status);

-- ============================================================
-- PRINTERS
-- ============================================================

CREATE TABLE printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,
    print_agent_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,
    system_name VARCHAR(255) NOT NULL,

    manufacturer VARCHAR(150),
    model VARCHAR(150),

    status printer_status NOT NULL DEFAULT 'OFFLINE',

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    last_seen_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_printers_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_printers_print_agent
        FOREIGN KEY (print_agent_id)
        REFERENCES print_agents(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_printer_agent_system_name
        UNIQUE (print_agent_id, system_name)
);

CREATE INDEX idx_printers_shop_status
    ON printers (shop_id, status);

CREATE INDEX idx_printers_agent
    ON printers (print_agent_id);

-- ============================================================
-- PRINTER CAPABILITIES
-- ============================================================

CREATE TABLE printer_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    printer_id UUID NOT NULL,

    capability_type printer_capability_type NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_printer_capabilities_printer
        FOREIGN KEY (printer_id)
        REFERENCES printers(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_printer_capability
        UNIQUE (printer_id, capability_type)
);

-- ============================================================
-- PRINT JOBS
-- ============================================================
-- A Print Job is the physical execution unit.
-- An Order can have multiple Print Jobs.

CREATE TABLE print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL,
    order_document_id UUID NOT NULL,

    printer_id UUID,
    print_agent_id UUID,

    status print_job_status NOT NULL DEFAULT 'QUEUED',

    priority INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,

    queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_print_jobs_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_print_jobs_document
        FOREIGN KEY (order_document_id)
        REFERENCES order_documents(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_print_jobs_printer
        FOREIGN KEY (printer_id)
        REFERENCES printers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_print_jobs_agent
        FOREIGN KEY (print_agent_id)
        REFERENCES print_agents(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_print_jobs_priority
        CHECK (priority >= 0),

    CONSTRAINT chk_print_jobs_retry_count
        CHECK (retry_count >= 0)
);

CREATE INDEX idx_print_jobs_order
    ON print_jobs (order_id);

CREATE INDEX idx_print_jobs_printer_status
    ON print_jobs (printer_id, status);

CREATE INDEX idx_print_jobs_agent_status
    ON print_jobs (print_agent_id, status);

CREATE INDEX idx_print_jobs_queue
    ON print_jobs (status, priority DESC, queued_at);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    recipient_type notification_recipient_type NOT NULL,
    recipient_id UUID,

    order_id UUID,

    type notification_type NOT NULL,

    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_notifications_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_notifications_recipient
    ON notifications (recipient_type, recipient_id, is_read);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
-- Initial business model: shop subscription.

CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    price_minor_units BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',

    billing_interval subscription_interval NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_subscription_plan_price
        CHECK (price_minor_units >= 0)
);

CREATE TABLE shop_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,
    plan_id UUID NOT NULL,

    status subscription_status NOT NULL DEFAULT 'TRIALING',

    starts_at TIMESTAMPTZ NOT NULL,

    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,

    cancelled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_shop_subscriptions_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_shop_subscriptions_plan
        FOREIGN KEY (plan_id)
        REFERENCES subscription_plans(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_shop_subscription_period
        CHECK (current_period_end > current_period_start)
);

CREATE INDEX idx_shop_subscriptions_shop_status
    ON shop_subscriptions (shop_id, status);

-- ============================================================
-- DOCUMENT ACCESS LOG
-- ============================================================
-- Lightweight privacy/audit trail for document access.

CREATE TABLE document_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    document_id UUID NOT NULL,

    actor_type VARCHAR(30) NOT NULL,
    actor_id UUID,

    access_type VARCHAR(40) NOT NULL,

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_document_access_logs_document
        FOREIGN KEY (document_id)
        REFERENCES order_documents(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_document_access_logs_document
    ON document_access_logs (document_id, created_at);

-- ============================================================
-- AUDIT LOG
-- ============================================================
-- Keep this generic and lightweight for MVP.

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_type VARCHAR(30) NOT NULL,
    actor_id UUID,

    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity
    ON audit_logs (entity_type, entity_id, created_at);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shops_updated_at
BEFORE UPDATE ON shops
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shop_users_updated_at
BEFORE UPDATE ON shop_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_print_users_updated_at
BEFORE UPDATE ON print_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shop_services_updated_at
BEFORE UPDATE ON shop_services
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shop_capabilities_updated_at
BEFORE UPDATE ON shop_capabilities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shop_pricing_updated_at
BEFORE UPDATE ON shop_pricing
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shop_business_hours_updated_at
BEFORE UPDATE ON shop_business_hours
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_documents_updated_at
BEFORE UPDATE ON order_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_print_configurations_updated_at
BEFORE UPDATE ON print_configurations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_print_agents_updated_at
BEFORE UPDATE ON print_agents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_printers_updated_at
BEFORE UPDATE ON printers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_print_jobs_updated_at
BEFORE UPDATE ON print_jobs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_subscription_plans_updated_at
BEFORE UPDATE ON subscription_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shop_subscriptions_updated_at
BEFORE UPDATE ON shop_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- END
-- ============================================================
