import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!db) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool);
  }

  return db;
}
