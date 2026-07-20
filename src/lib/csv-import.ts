import crypto from 'crypto';

export type CsvImportRow = Record<string, string>;

const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1477959858617-67f85b34b5ad?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
];

function normKey(k: string) {
  return k.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

const ALIASES: Record<string, string> = {
  title: 'title',
  roadcarried: 'roadCarried',
  features: 'features',
  latitude: 'latitude',
  lat: 'latitude',
  latdd: 'latitude',
  longitude: 'longitude',
  lng: 'longitude',
  lon: 'longitude',
  longdd: 'longitude',
  severity: 'severity',
  condition: 'condition',
  description: 'description',
  state: 'state',
  stateprovince: 'state',
  city: 'city',
  county: 'county',
  postalcode: 'postalCode',
  zip: 'postalCode',
  congressionaldistrict: 'congressionalDistrict',
  condist: 'congressionalDistrict',
  infrastructureclass: 'infrastructureClass',
  category: 'infrastructureClass',
  infrastructuretype: 'infrastructureType',
  subcategory: 'infrastructureType',
  failuretype: 'failureType',
  estimatedcost: 'estimatedCost',
  repaircost: 'estimatedCost',
  assetname: 'assetName',
  nbiid: 'assetName',
  status: 'status',
  occurredat: 'occurredAt',
  imageurl: 'imageUrl',
  datasetkey: 'datasetKey',
  externalid: 'externalId',
  location: 'location',
};

export function parseCsv(text: string): { headers: string[]; rows: CsvImportRow[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const rawHeaders = splitCsvLine(lines[0]);
  const headers = rawHeaders.map((h) => ALIASES[normKey(h)] || h.trim());
  const rows: CsvImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: CsvImportRow = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function mapCsvRow(
  row: CsvImportRow,
  index: number,
  opts: { datasetKey: string; useStockPhotos: boolean }
) {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: `Row ${index + 1}: invalid latitude/longitude` };
  }

  let title = row.title?.trim();
  if (!title && (row.roadCarried || row.features)) {
    title = `${row.roadCarried || 'Route'} over ${row.features || 'feature'}`;
  }
  if (!title) return { error: `Row ${index + 1}: missing title` };

  let severity = row.severity ? parseInt(row.severity, 10) : NaN;
  const condition = (row.condition || '').toUpperCase();
  if (!Number.isFinite(severity)) {
    if (condition === 'F') severity = 5;
    else if (condition === 'P') severity = 4;
    else severity = 3;
  }
  severity = Math.min(5, Math.max(1, severity));

  const cost = row.estimatedCost ? Number(row.estimatedCost) : null;
  const externalId = row.externalId || `${opts.datasetKey}_${index}_${lat}_${lng}`;
  const idHash = crypto.createHash('sha1').update(`csv:${opts.datasetKey}:${externalId}`).digest('hex').slice(0, 20);
  const reportId = `rpt_${idHash}`;
  const locId = `loc_${idHash}`;

  const imageUrl = row.imageUrl
    ? row.imageUrl
    : opts.useStockPhotos
      ? STOCK_IMAGES[index % STOCK_IMAGES.length]
      : null;

  const description = [
    row.description,
    row.location ? `Location: ${row.location}` : '',
    condition ? `Condition: ${condition}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    reportId,
    locId,
    title,
    description: description || title,
    latitude: lat,
    longitude: lng,
    severity,
    status: row.status || 'submitted',
    infrastructureClass: row.infrastructureClass || 'Transportation',
    infrastructureType: row.infrastructureType || 'Bridge',
    failureType: row.failureType || (condition === 'F' ? 'Structural Failure' : 'Deferred Maintenance'),
    estimatedCostLow: cost != null && Number.isFinite(cost) ? Math.round(cost * 0.85) : null,
    estimatedCostHigh: cost != null && Number.isFinite(cost) ? Math.round(cost * 1.15) : null,
    assetName: row.assetName || null,
    state: row.state || null,
    city: row.city || null,
    county: row.county || null,
    postalCode: row.postalCode || null,
    congressionalDistrict: row.congressionalDistrict || null,
    addressLine: row.location || null,
    imageUrl,
    datasetKey: opts.datasetKey,
    occurredAt: row.occurredAt ? new Date(row.occurredAt) : new Date(),
  };
}

export const CSV_TEMPLATE = `title,latitude,longitude,severity,condition,state,city,county,estimatedCost,congressionalDistrict,infrastructureClass,infrastructureType,failureType,assetName,description,externalId,imageUrl
Sample bridge,41.5868,-93.6250,5,F,IA,Des Moines,Polk,2500000,IA-03,Transportation,Bridge,Structural Failure,NBI 12345,Example row without requiring a photo,ext-1,
`;
