-- PrintKro MVP — shop_users Firebase Auth join
-- Apply after printkro_mvp_schema_v3.sql (or on an existing v3 database).
-- Idempotent.

ALTER TABLE shop_users
    ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_users_firebase_uid
    ON shop_users (firebase_uid)
    WHERE firebase_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_users_phone
    ON shop_users (phone)
    WHERE phone IS NOT NULL;

ALTER TABLE shop_users
    DROP CONSTRAINT IF EXISTS chk_shop_users_identifier;

ALTER TABLE shop_users
    ADD CONSTRAINT chk_shop_users_identifier
    CHECK (email IS NOT NULL OR phone IS NOT NULL);

COMMENT ON COLUMN shop_users.firebase_uid IS
    'Firebase Authentication uid. Passwords are stored in Firebase, not in password_hash.';

COMMENT ON COLUMN shop_users.password_hash IS
    'Unused for new shop-owner accounts. Firebase Authentication owns the password.';
