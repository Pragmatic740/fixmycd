import 'dotenv/config';
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function main() {
  const r = await db.execute(sql`select count(*)::int as c from reports`);
  console.log('reports count:', r);
  const cols = await db.execute(sql`
    select column_name from information_schema.columns
    where table_name = 'reports' and column_name in ('infrastructure_class','dataset_key','is_synthetic','occurred_at')
    order by column_name
  `);
  console.log('analytics cols:', cols);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
