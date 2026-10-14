import { sql } from 'drizzle-orm';
import { db, dbClient } from '@/db';

/** Empty every table (keeps the schema). */
export async function truncateAll(): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`
  );
  const tables = Array.from(rows).map((r) => `"${r.tablename}"`);
  if (tables.length) {
    await db.execute(sql.raw(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`));
  }
}

export async function closeDb(): Promise<void> {
  await dbClient.end({ timeout: 5 });
}
