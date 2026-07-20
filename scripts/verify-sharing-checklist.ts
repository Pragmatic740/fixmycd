import assert from 'assert';
import { parseCsv, mapCsvRow } from '../src/lib/csv-import';
import { normalizeStateFilter } from '../src/lib/analytics';

function main() {
  assert.equal(normalizeStateFilter('florida'), 'FL');

  const csv = `title,latitude,longitude,condition,state
Bridge A,41.5,-93.6,F,IA
Missing coords,bad,bad,P,IA
`;
  const { rows } = parseCsv(csv);
  assert.equal(rows.length, 2);
  const ok = mapCsvRow(rows[0], 0, { datasetKey: 'test', useStockPhotos: false });
  assert.ok(!('error' in ok && ok.error));
  assert.equal((ok as { severity: number }).severity, 5);
  const bad = mapCsvRow(rows[1], 1, { datasetKey: 'test', useStockPhotos: false });
  assert.ok('error' in bad);

  console.log('sharing checklist unit checks passed');
}

main();
