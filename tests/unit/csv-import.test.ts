import { describe, expect, it } from 'vitest';
import { parseCsv, mapCsvRow } from '@/lib/csv-import';

describe('CSV import mapping', () => {
  const csv = `title,latitude,longitude,condition,state
Bridge A,41.5,-93.6,F,IA
Missing coords,bad,bad,P,IA
`;

  it('maps a valid row and derives severity from condition', () => {
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(2);
    const ok = mapCsvRow(rows[0], 0, { datasetKey: 'test', useStockPhotos: false });
    expect('error' in ok && ok.error).toBeFalsy();
    expect((ok as { severity: number }).severity).toBe(5);
  });

  it('rejects a row with invalid coordinates', () => {
    const { rows } = parseCsv(csv);
    const bad = mapCsvRow(rows[1], 1, { datasetKey: 'test', useStockPhotos: false });
    expect('error' in bad).toBe(true);
  });
});
