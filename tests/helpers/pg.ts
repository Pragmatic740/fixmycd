import postgres from 'postgres';
import { runMigrations } from '@/db/migrations';

/**
 * TEST_DATABASE_URL points at a Postgres server the tests may create and drop
 * databases on (e.g. postgres://postgres:pg@localhost:5432/postgres).
 */
export function adminUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set — integration tests need a Postgres server.');
  }
  return url;
}

export function urlForDatabase(name: string): string {
  const url = new URL(adminUrl());
  url.pathname = `/${name}`;
  return url.toString();
}

/** Drop and recreate an empty database. */
export async function recreateDatabase(name: string): Promise<string> {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Unsafe database name: ${name}`);
  const admin = postgres(adminUrl(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  return urlForDatabase(name);
}

/** Recreate a database and apply the current migrations to it. */
export async function createMigratedDatabase(name: string): Promise<string> {
  const url = await recreateDatabase(name);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await runMigrations(sql);
  } finally {
    await sql.end();
  }
  return url;
}
