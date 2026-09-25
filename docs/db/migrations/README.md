# Schema migrations

Canonical schema: [`../printkro_mvp_schema_v3.sql`](../printkro_mvp_schema_v3.sql)

Apply that file on an empty database, then apply numbered files in this folder in order.

`001_shop_user_firebase_auth.sql` adds `shop_users.firebase_uid`, unique phone, and the email-or-phone check. `password_hash` stays but is unused for new Firebase-backed accounts.
