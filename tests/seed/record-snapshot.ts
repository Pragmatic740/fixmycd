/**
 * Records tests/fixtures/seed-snapshot.json from the current seed scripts.
 * Only re-record when a seed change is intentional:
 *   TEST_DATABASE_URL=postgres://... npx tsx tests/seed/record-snapshot.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { createMigratedDatabase } from '../helpers/pg';
import { runSeeds } from '../helpers/run-seeds';
import { takeSeedSnapshot } from '../helpers/seed-snapshot';

async function main() {
  const url = await createMigratedDatabase('fixmycd_seed_record');
  runSeeds(url);
  const sql = postgres(url, { max: 1 });
  const snapshot = await takeSeedSnapshot(sql);
  await sql.end();

  const out = path.resolve(__dirname, '../fixtures/seed-snapshot.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(snapshot, null, 1) + '\n');
  const counts = Object.fromEntries(Object.entries(snapshot).map(([t, s]) => [t, s.count]));
  console.log('Recorded seed snapshot:', counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
