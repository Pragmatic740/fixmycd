/**
 * Optional: overwrite NBI report imageUrl with Google Street View Static API URLs.
 *
 * Requires GOOGLE_MAPS_API_KEY with Street View Static API enabled.
 *
 * Usage:
 *   npx tsx scripts/enrich-nbi-streetview.ts
 *   npx tsx scripts/enrich-nbi-streetview.ts --dry-run
 *   npx tsx scripts/enrich-nbi-streetview.ts --limit=20
 */
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { reports } from '../src/db/schema';

dotenv.config();

const DATASET = 'nbi-bridges-2026v14';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg.split('=')[1], 10)) : undefined;

function streetViewUrl(lat: number, lng: number, key: string) {
  const params = new URLSearchParams({
    size: '800x600',
    location: `${lat},${lng}`,
    key,
  });
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

async function main() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error('Set GOOGLE_MAPS_API_KEY to run Street View enrichment');
  }

  let rows = await db
    .select({
      id: reports.id,
      latitude: reports.latitude,
      longitude: reports.longitude,
      imageUrl: reports.imageUrl,
    })
    .from(reports)
    .where(eq(reports.datasetKey, DATASET));

  if (LIMIT) rows = rows.slice(0, LIMIT);
  console.log(`Enriching ${rows.length} NBI reports with Street View URLs…`);

  let updated = 0;
  for (const row of rows) {
    const url = streetViewUrl(row.latitude, row.longitude, key);
    if (dryRun) {
      if (updated < 3) console.log(`  would set ${row.id} -> ${url.slice(0, 80)}…`);
    } else {
      await db.update(reports).set({ imageUrl: url }).where(eq(reports.id, row.id));
    }
    updated++;
    if (updated % 100 === 0) console.log(`  ${updated}/${rows.length}`);
  }

  console.log(`Done. ${dryRun ? 'would update' : 'updated'}=${updated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
