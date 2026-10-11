import type postgres from 'postgres';

/**
 * Columns whose values legitimately differ between seed runs: wall-clock
 * timestamps and bcrypt hashes (random salt). Everything else the seed
 * scripts write must stay byte-for-byte identical.
 */
const VOLATILE_COLUMNS = new Set(['password_hash']);
const isVolatile = (column: string) => VOLATILE_COLUMNS.has(column) || column.endsWith('_at');

/** Tables the seed scripts never write; created by the app at runtime. */
const RUNTIME_TABLES = new Set(['sessions', 'rate_limits']);

export type SeedSnapshot = Record<string, { count: number; rows: Record<string, unknown>[] }>;

export async function takeSeedSnapshot(sql: postgres.Sql): Promise<SeedSnapshot> {
  const tables = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;

  const snapshot: SeedSnapshot = {};
  for (const { table_name } of tables) {
    if (RUNTIME_TABLES.has(table_name)) continue;
    const columns = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = ${table_name}
      order by column_name
    `;
    const kept = columns.map((c) => c.column_name).filter((c) => !isVolatile(c));
    const rows = await sql.unsafe(
      `select ${kept.map((c) => `"${c}"`).join(', ')} from "${table_name}" order by "id"`
    );
    snapshot[table_name] = {
      count: rows.length,
      rows: rows.map((r) => ({ ...r })),
    };
  }
  return snapshot;
}

/**
 * Compare a fresh snapshot against the recorded fixture. Columns that are new
 * since the fixture was recorded are ignored; every recorded column and row
 * must match exactly.
 */
export function diffSeedSnapshots(expected: SeedSnapshot, actual: SeedSnapshot): string[] {
  const problems: string[] = [];
  for (const [table, exp] of Object.entries(expected)) {
    const act = actual[table];
    if (!act) {
      problems.push(`${table}: table missing`);
      continue;
    }
    if (act.count !== exp.count) {
      problems.push(`${table}: expected ${exp.count} rows, got ${act.count}`);
      continue;
    }
    for (let i = 0; i < exp.rows.length; i++) {
      const e = exp.rows[i];
      const a = act.rows[i];
      for (const col of Object.keys(e)) {
        if (JSON.stringify(e[col]) !== JSON.stringify(a[col])) {
          problems.push(`${table}[id=${String(e.id)}].${col}: expected ${JSON.stringify(e[col])}, got ${JSON.stringify(a[col])}`);
          if (problems.length > 25) return problems;
        }
      }
    }
  }
  for (const table of Object.keys(actual)) {
    if (!expected[table] && actual[table].count > 0) {
      problems.push(`${table}: unexpected seeded rows (${actual[table].count})`);
    }
  }
  return problems;
}
