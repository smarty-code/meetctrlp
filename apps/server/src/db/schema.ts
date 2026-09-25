import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const shopStatusEnum = pgEnum("shop_status", [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "INACTIVE",
]);

export const shopUserRoleEnum = pgEnum("shop_user_role", [
  "OWNER",
  "MANAGER",
  "STAFF",
]);

export const shopUserStatusEnum = pgEnum("shop_user_status", [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
]);

export const shops = pgTable("shops", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  status: shopStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shopUsers = pgTable("shop_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id")
    .notNull()
    .references(() => shops.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  firebaseUid: text("firebase_uid"),
  role: shopUserRoleEnum("role").notNull().default("STAFF"),
  status: shopUserStatusEnum("status").notNull().default("ACTIVE"),
  passwordHash: text("password_hash"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ShopRow = typeof shops.$inferSelect;
export type ShopUserRow = typeof shopUsers.$inferSelect;
