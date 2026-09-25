import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { appConfig } from "@/src/config/app";
import * as schema from "@/src/db/schema";

const globalForDb = globalThis as unknown as {
  postgres?: ReturnType<typeof postgres>;
};

function createSql() {
  if (!appConfig.databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  return postgres(appConfig.databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

function getSql() {
  globalForDb.postgres ??= createSql();
  return globalForDb.postgres;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}
