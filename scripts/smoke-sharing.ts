import 'dotenv/config';
import { db } from '../src/db';
import { reports } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { getPublicReport } from '../src/lib/public-report';
import { parseCsv, mapCsvRow, CSV_TEMPLATE } from '../src/lib/csv-import';

async function main() {
  const row = await db.select({ id: reports.id }).from(reports).where(eq(reports.isHidden, false)).limit(1);
  if (!row[0]) throw new Error('no reports to smoke');
  const pub = await getPublicReport(row[0].id);
  if (!pub) throw new Error('public report fetch failed');
  console.log('public report ok', pub.id, pub.title.slice(0, 40));

  const { rows } = parseCsv(CSV_TEMPLATE);
  const mapped = mapCsvRow(rows[0], 0, { datasetKey: 'smoke', useStockPhotos: true });
  if ('error' in mapped && mapped.error) throw new Error(mapped.error);
  console.log('csv template maps ok', (mapped as { title: string }).title);
  console.log('smoke-sharing ok');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
