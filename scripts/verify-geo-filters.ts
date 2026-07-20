import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db';
import { getAnalyticsSummary, parseAnalyticsFilters } from '../src/lib/analytics';

async function main() {
  const locStats = await db.execute(sql`
    select
      count(*)::int as total_locs,
      count(state_province)::int as with_state,
      count(city)::int as with_city,
      count(*) filter (where dataset_key = 'nbi-bridges-2026v14')::int as nbi_reports
    from reports r
    left join report_locations rl on rl.report_id = r.id
  `);
  console.log('location coverage:', locStats[0]);

  const sampleStates = await db.execute(sql`
    select state_province, count(*)::int as c
    from report_locations
    where state_province is not null
    group by state_province
    order by c desc
    limit 10
  `);
  console.log('top states:', sampleStates);

  const sampleCities = await db.execute(sql`
    select city, count(*)::int as c
    from report_locations
    where city is not null and city <> ''
    group by city
    order by c desc
    limit 10
  `);
  console.log('top cities:', sampleCities);

  const cases = [
    'state=FL&datePreset=year',
    'state=fl&datePreset=year',
    'state=Florida&datePreset=year',
    'city=New York&datePreset=year',
    'city=new york&datePreset=year',
    'city=Chicago&datePreset=year',
    'state=IA&datasetKey=nbi-bridges-2026v14&datePreset=year',
    'city=Hollywood&datasetKey=nbi-bridges-2026v14&datePreset=year',
  ];

  for (const q of cases) {
    const filters = parseAnalyticsFilters(new URLSearchParams(q));
    const summary = await getAnalyticsSummary(filters);
    console.log(`${q} => total=${summary.totalReports}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
