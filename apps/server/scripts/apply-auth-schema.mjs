import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separator);
      let value = trimmed.slice(separator + 1);
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional local env file.
  }
}

loadEnvFile(resolve(here, "../.env.local"));
loadEnvFile(resolve(here, "../.env"));

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(url, {
  ssl: "require",
  connect_timeout: 20,
  max: 1,
});

async function tableExists(name) {
  const rows = await sql`
    select to_regclass(${"public." + name}) as value
  `;
  return Boolean(rows[0]?.value);
}

async function runSqlFile(relativePath) {
  const path = resolve(root, relativePath);
  const text = readFileSync(path, "utf8");
  await sql.unsafe(text);
  console.log("applied", relativePath);
}

try {
  const hasShops = await tableExists("shops");
  const hasShopUsers = await tableExists("shop_users");
  console.log({ hasShops, hasShopUsers });

  if (!hasShops || !hasShopUsers) {
    await runSqlFile("docs/db/printkro_mvp_schema_v3.sql");
  }

  await runSqlFile("docs/db/migrations/001_shop_user_firebase_auth.sql");

  const cols = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'shop_users'
    order by ordinal_position
  `;
  console.log("shop_users columns:", cols.map((row) => row.column_name).join(", "));
} finally {
  await sql.end({ timeout: 5 });
}
