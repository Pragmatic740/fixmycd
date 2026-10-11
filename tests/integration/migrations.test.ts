import { describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '@/db/schema';
import { runMigrations } from '@/db/migrations';
import { recreateDatabase } from '../helpers/pg';

async function withDatabase<T>(name: string, fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const url = await recreateDatabase(name);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

async function columnsOf(sql: postgres.Sql) {
  const rows = await sql<{ table_name: string; column_name: string }[]>`
    select table_name, column_name from information_schema.columns where table_schema = 'public'
  `;
  return new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
}

const drizzleTables = Object.values(schema as Record<string, unknown>).filter((v): v is PgTable => v instanceof PgTable);

describe('migrations', () => {
  it('creates every table and column declared in src/db/schema.ts (no schema drift)', async () => {
    await withDatabase('fixmycd_mig_drift', async (sql) => {
      await runMigrations(sql);
      const existing = await columnsOf(sql);
      const missing: string[] = [];
      for (const table of drizzleTables) {
        const cfg = getTableConfig(table);
        for (const col of cfg.columns) {
          if (!existing.has(`${cfg.name}.${col.name}`)) missing.push(`${cfg.name}.${col.name}`);
        }
      }
      expect(missing).toEqual([]);
    });
  });

  it('is idempotent: running twice succeeds and changes nothing', async () => {
    await withDatabase('fixmycd_mig_twice', async (sql) => {
      await runMigrations(sql);
      const before = await columnsOf(sql);
      await runMigrations(sql);
      expect(await columnsOf(sql)).toEqual(before);
    });
  });

  it('upgrades a database created before the September features (the Oct 2026 outage)', async () => {
    await withDatabase('fixmycd_mig_july', async (sql) => {
      // Shape of the users table as of 24 July 2026 (no status / email_notifications).
      await sql`
        CREATE TABLE "users" (
          "id" text PRIMARY KEY NOT NULL,
          "email" text NOT NULL UNIQUE,
          "display_name" text,
          "password_hash" text,
          "role" text DEFAULT 'viewer' NOT NULL,
          "bio" text,
          "is_synthetic" boolean DEFAULT false NOT NULL,
          "dataset_key" text,
          "disabled_at" timestamp with time zone,
          "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`;
      await sql`INSERT INTO users (id, email, role) VALUES ('u_old', 'old@example.test', 'admin')`;

      await runMigrations(sql);

      const [user] = await sql`SELECT status, email_notifications, role FROM users WHERE id = 'u_old'`;
      expect(user).toEqual({ status: 'approved', email_notifications: true, role: 'admin' });
      const existing = await columnsOf(sql);
      for (const t of ['endorsements', 'share_view_events', 'beta_subscribers']) {
        expect([...existing].some((c) => c.startsWith(`${t}.`))).toBe(true);
      }
    });
  });

  it('rolls back completely when a statement fails', async () => {
    await withDatabase('fixmycd_mig_rollback', async (sql) => {
      // A view squatting on a table name makes a late CREATE INDEX fail.
      await sql`CREATE VIEW "endorsements" AS SELECT 1 AS id`;
      await expect(runMigrations(sql)).rejects.toThrow();
      const existing = await columnsOf(sql);
      expect(existing.has('users.id')).toBe(false);
    });
  });
});
