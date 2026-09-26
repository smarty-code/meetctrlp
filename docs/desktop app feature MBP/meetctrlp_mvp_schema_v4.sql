-- ============================================================
-- MeetCtrlP MVP - Final Consolidated PostgreSQL Relational Schema (v4)
-- ============================================================
-- Platform: MeetCtrlP
-- Target Engine: PostgreSQL 15+
-- Scope: Complete Cloud + Desktop Partner Execution Layer
--
-- Core Architecture:
--   Print User (Guest / Session) -> Shop -> Order -> Documents -> Print Jobs
--                                                        -> Print Agent -> Windows Spooler -> Printer
--
-- Day-0 Architectural Guarantees:
--   1. Realtime cloud-to-desktop event streaming.
--   2. Print Agent acts as trusted local execution layer on Windows.
--   3. Strict separation between Order Business State and Physical Print State.
--   4. Full monetary values represented in minor units (INR paise).
--   5. JSONB print preset & per-job override merge mechanics with full auditability.
--   6. Document privacy zero-retention compliance (tracking presigned downloads and local shredding).
--   7. Full counter payment reconciliation for Cash and Cashfree Online transactions.
--   8. Idempotency and offline sync journals for lossy network recovery.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. ENUMS
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
    'A4',
    'A3'
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

CREATE TYPE document_access_type AS ENUM (
    'DOWNLOADED',
    'PREVIEWED',
    'SPOOLED_TO_PRINTER',
    'SHREDDED'
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
    'A4',
    'A3'
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
    'ORDER_CANCELLED',
    'ORDER_REJECTED'
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
-- 2. SHOPS & PARTNER IDENTITY
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

CREATE TABLE shop_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,

    email VARCHAR(320),
    phone VARCHAR(32),
    firebase_uid TEXT,

    role shop_user_role NOT NULL DEFAULT 'STAFF',
    status shop_user_status NOT NULL DEFAULT 'ACTIVE',

    password_hash TEXT,
    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_shop_users_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_shop_users_identifier
        CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX uq_shop_users_email
    ON shop_users (lower(email))
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX uq_shop_users_phone
    ON shop_users (phone)
    WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX uq_shop_users_firebase_uid
    ON shop_users (firebase_uid)
    WHERE firebase_uid IS NOT NULL;

CREATE INDEX idx_shop_users_shop_status
    ON shop_users (shop_id, status);

-- ============================================================
-- 3. PRINT USERS (GUEST SESSIONS) & QR CODES
-- ============================================================

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
-- 4. SHOP CONFIGURATION, CAPABILITIES & PRICING
-- ============================================================

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

CREATE TABLE shop_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL UNIQUE,

    bw_printing BOOLEAN NOT NULL DEFAULT TRUE,
    color_printing BOOLEAN NOT NULL DEFAULT FALSE,
    a4_printing BOOLEAN NOT NULL DEFAULT TRUE,
    a3_printing BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_shop_capabilities_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE
);

CREATE TABLE shop_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,

    service_type service_type NOT NULL DEFAULT 'DOCUMENT_PRINT',
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

CREATE UNIQUE INDEX uq_shop_pricing_active_rule
    ON shop_pricing (shop_id, service_type, color_mode, paper_size)
    WHERE is_active = TRUE;

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
-- 5. ORDERS & DOCUMENTS
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

    pickup_code VARCHAR(10),
    handover_notes TEXT,

    estimated_ready_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,

    rejection_reason TEXT,
    rejection_category VARCHAR(50),

    accepted_by_user_id UUID,
    completed_by_user_id UUID,

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

    CONSTRAINT fk_orders_accepted_by
        FOREIGN KEY (accepted_by_user_id)
        REFERENCES shop_users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_orders_completed_by
        FOREIGN KEY (completed_by_user_id)
        REFERENCES shop_users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_orders_amounts
        CHECK (
            subtotal_minor_units >= 0
            AND tax_minor_units >= 0
            AND discount_minor_units >= 0
            AND total_minor_units >= 0
        )
);

CREATE INDEX idx_orders_shop_status_created
    ON orders (shop_id, status, created_at DESC);

CREATE INDEX idx_orders_pickup_code
    ON orders (shop_id, pickup_code)
    WHERE status = 'READY';

CREATE TABLE order_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL,

    original_filename VARCHAR(255) NOT NULL,
    storage_key TEXT NOT NULL,
    sha256_hash VARCHAR(64),

    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,

    page_count INTEGER,
    document_index INTEGER NOT NULL,

    status document_status NOT NULL DEFAULT 'UPLOADING',

    local_downloaded_at TIMESTAMPTZ,
    shredded_at TIMESTAMPTZ,

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

CREATE TABLE print_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_document_id UUID NOT NULL UNIQUE,

    color_mode color_mode NOT NULL,
    copies INTEGER NOT NULL DEFAULT 1,
    paper_size paper_size NOT NULL DEFAULT 'A4',

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
-- 6. PAYMENTS & RECONCILIATION
-- ============================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL UNIQUE,

    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'PENDING',

    amount_minor_units BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',

    collected_by_shop_user_id UUID,
    cash_tendered_minor_units BIGINT,
    change_returned_minor_units BIGINT,
    collected_at TIMESTAMPTZ,

    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_payments_collected_by
        FOREIGN KEY (collected_by_shop_user_id)
        REFERENCES shop_users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_payments_amount
        CHECK (amount_minor_units >= 0),

    CONSTRAINT chk_payments_cash_change
        CHECK (
            change_returned_minor_units IS NULL
            OR (cash_tendered_minor_units >= amount_minor_units
                AND change_returned_minor_units = cash_tendered_minor_units - amount_minor_units)
        )
);

CREATE INDEX idx_payments_status_method
    ON payments (status, method);

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
-- 7. PRINT AGENTS & HARDWARE PRINTERS
-- ============================================================

CREATE TABLE print_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,
    device_identifier VARCHAR(255) NOT NULL UNIQUE,

    status print_agent_status NOT NULL DEFAULT 'OFFLINE',

    hostname VARCHAR(150),
    os_version VARCHAR(100),
    app_version VARCHAR(50),
    agent_version VARCHAR(50),

    api_key_hash VARCHAR(128),
    heartbeat_interval_seconds INTEGER NOT NULL DEFAULT 30,

    registered_by_user_id UUID,

    last_seen_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_print_agents_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_print_agents_registered_by
        FOREIGN KEY (registered_by_user_id)
        REFERENCES shop_users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_print_agents_shop_status_liveness
    ON print_agents (shop_id, status, last_seen_at DESC);

-- Print settings validation function
CREATE OR REPLACE FUNCTION is_valid_print_settings(
    settings JSONB,
    allow_partial BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    key_name TEXT;
    required_keys CONSTANT TEXT[] := ARRAY[
        'copies',
        'orientation',
        'paperSize',
        'inputTray',
        'colorMode',
        'printQualityDpi'
    ];
BEGIN
    IF settings IS NULL OR jsonb_typeof(settings) <> 'object' THEN
        RETURN FALSE;
    END IF;

    FOR key_name IN SELECT jsonb_object_keys(settings)
    LOOP
        IF NOT (key_name = ANY(required_keys)) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    IF NOT allow_partial AND NOT (
        SELECT bool_and(settings ? key_name)
        FROM unnest(required_keys) AS key_name
    ) THEN
        RETURN FALSE;
    END IF;

    IF settings ? 'copies' THEN
        IF jsonb_typeof(settings->'copies') <> 'number'
           OR (settings->>'copies')::NUMERIC <> trunc((settings->>'copies')::NUMERIC)
           OR (settings->>'copies')::INTEGER < 1
           OR (settings->>'copies')::INTEGER > 999
        THEN
            RETURN FALSE;
        END IF;
    END IF;

    IF settings ? 'orientation'
       AND settings->>'orientation' NOT IN ('PORTRAIT', 'LANDSCAPE')
    THEN
        RETURN FALSE;
    END IF;

    IF settings ? 'paperSize'
       AND settings->>'paperSize' NOT IN (
           'A4', 'LETTER', 'LEGAL', 'A3', 'EXECUTIVE'
       )
    THEN
        RETURN FALSE;
    END IF;

    IF settings ? 'inputTray'
       AND settings->>'inputTray' NOT IN (
           'AUTO_SELECT', 'MAIN_TRAY', 'BYPASS_TRAY',
           'TRAY_1', 'TRAY_2', 'TRAY_3'
       )
    THEN
        RETURN FALSE;
    END IF;

    IF settings ? 'colorMode'
       AND settings->>'colorMode' NOT IN (
           'COLOR', 'GRAYSCALE', 'MONOCHROME'
       )
    THEN
        RETURN FALSE;
    END IF;

    IF settings ? 'printQualityDpi'
       AND settings->>'printQualityDpi' NOT IN (
           'DRAFT_300DPI', 'STANDARD_600DPI', 'HIGH_1200DPI'
       )
    THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE TABLE printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,
    print_agent_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,
    system_name VARCHAR(255) NOT NULL,

    manufacturer VARCHAR(150),
    model VARCHAR(150),
    driver_name VARCHAR(255),
    port_name VARCHAR(150),

    is_color_capable BOOLEAN NOT NULL DEFAULT FALSE,
    is_duplex_capable BOOLEAN NOT NULL DEFAULT FALSE,

    status printer_status NOT NULL DEFAULT 'OFFLINE',
    status_reason TEXT,

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    default_print_settings JSONB NOT NULL DEFAULT '{
        "copies": 1,
        "orientation": "PORTRAIT",
        "paperSize": "A4",
        "inputTray": "AUTO_SELECT",
        "colorMode": "COLOR",
        "printQualityDpi": "STANDARD_600DPI"
    }'::jsonb,

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
        UNIQUE (print_agent_id, system_name),

    CONSTRAINT chk_printers_default_print_settings
        CHECK (is_valid_print_settings(default_print_settings, FALSE))
);

CREATE INDEX idx_printers_shop_status
    ON printers (shop_id, status);

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

CREATE TABLE printer_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    printer_id UUID NOT NULL,

    previous_status printer_status,
    new_status printer_status NOT NULL,

    error_code VARCHAR(100),
    error_description TEXT,

    active_spool_jobs INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_printer_telemetry_printer
        FOREIGN KEY (printer_id)
        REFERENCES printers(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_printer_telemetry_printer
    ON printer_telemetry_logs (printer_id, created_at DESC);

-- ============================================================
-- 8. PHYSICAL PRINT JOBS (SPOOLER EXECUTION)
-- ============================================================

CREATE TABLE print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL,
    order_document_id UUID NOT NULL,

    printer_id UUID,
    print_agent_id UUID,

    spooler_job_id INTEGER,

    status print_job_status NOT NULL DEFAULT 'QUEUED',

    priority INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,

    pages_total INTEGER NOT NULL DEFAULT 1,
    pages_printed INTEGER NOT NULL DEFAULT 0,

    requested_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    resolved_settings JSONB NOT NULL,

    error_code VARCHAR(100),
    error_message TEXT,

    assigned_at TIMESTAMPTZ,
    spooled_at TIMESTAMPTZ,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    cancelled_by_type VARCHAR(30),
    cancelled_by_id UUID,

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
        CHECK (retry_count >= 0),

    CONSTRAINT chk_print_jobs_pages
        CHECK (pages_printed >= 0 AND pages_total >= 1 AND pages_printed <= pages_total),

    CONSTRAINT chk_print_jobs_requested_overrides
        CHECK (is_valid_print_settings(requested_overrides, TRUE)),

    CONSTRAINT chk_print_jobs_resolved_settings
        CHECK (is_valid_print_settings(resolved_settings, FALSE))
);

CREATE INDEX idx_print_jobs_order
    ON print_jobs (order_id);

CREATE INDEX idx_print_jobs_queue_order
    ON print_jobs (status, priority DESC, queued_at);

CREATE INDEX idx_print_jobs_printer_status
    ON print_jobs (printer_id, status);

-- ============================================================
-- 9. NOTIFICATIONS & AUDIT / ACCESS TRAILS
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
-- 10. REALTIME, IDEMPOTENCY & OFFLINE RECOVERY
-- ============================================================

CREATE TABLE idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,

    shop_id UUID NOT NULL,
    request_path VARCHAR(255) NOT NULL,

    response_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),

    CONSTRAINT fk_idempotency_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_idempotency_expires
    ON idempotency_keys (expires_at);

CREATE TABLE device_sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,
    print_agent_id UUID,

    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,

    watermark_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_device_sync_shop
        FOREIGN KEY (shop_id)
        REFERENCES shops(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_device_sync_agent
        FOREIGN KEY (print_agent_id)
        REFERENCES print_agents(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_device_sync_watermark
    ON device_sync_events (shop_id, watermark_timestamp DESC);

-- ============================================================
-- 11. SUBSCRIPTIONS
-- ============================================================

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
-- 12. HIGH-PERFORMANCE DASHBOARD AGGREGATION VIEW
-- ============================================================

CREATE OR REPLACE VIEW view_shop_daily_dashboard AS
SELECT
    s.id AS shop_id,
    CURRENT_DATE AS report_date,
    COUNT(o.id) FILTER (WHERE o.status = 'SUBMITTED') AS new_orders_count,
    COUNT(o.id) FILTER (WHERE o.status IN ('SHOP_ACCEPTED', 'PRINTING')) AS active_orders_count,
    COUNT(o.id) FILTER (WHERE o.status = 'READY') AS ready_orders_count,
    COUNT(o.id) FILTER (WHERE o.status = 'COMPLETED' AND o.completed_at >= CURRENT_DATE) AS completed_today_count,
    COALESCE(SUM(p.amount_minor_units) FILTER (WHERE p.status = 'PAID' AND p.paid_at >= CURRENT_DATE), 0) AS gross_paid_today_paise,
    COALESCE(SUM(p.amount_minor_units) FILTER (WHERE p.method = 'CASH' AND p.status = 'PENDING' AND o.status IN ('SUBMITTED', 'SHOP_ACCEPTED', 'PRINTING', 'READY')), 0) AS cash_pending_paise
FROM shops s
LEFT JOIN orders o ON o.shop_id = s.id
LEFT JOIN payments p ON p.order_id = o.id
GROUP BY s.id;

-- ============================================================
-- 13. UPDATED_AT TRIGGERS
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
-- END OF MEETCTRLP MVP SCHEMA (v4)
-- ============================================================
