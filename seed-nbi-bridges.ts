/**
 * Idempotent NBI bridge inventory seed.
 * Never deletes non-NBI data.
 *
 * Usage:
 *   npx tsx seed-nbi-bridges.ts
 *   npx tsx seed-nbi-bridges.ts --replace-nbi
 *   npx tsx seed-nbi-bridges.ts --limit=100
 *   npx tsx seed-nbi-bridges.ts --dry-run
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';
import { db } from './src/db';
import {
  users,
  reports,
  reportLocations,
  reportStatusHistory,
  upvotes,
  comments,
  flags,
  reportServiceAreas,
} from './src/db/schema';

dotenv.config();

const DATASET = 'nbi-bridges-2026v14';
const PASSWORD = 'password123';
const passwordHash = bcrypt.hashSync(PASSWORD, 10);
const BATCH = 40;
const JSON_PATH = path.join(process.cwd(), 'data', 'nbi-bridges-2026v14.json');

const BRIDGE_IMAGE_POOL = [
  'https://images.unsplash.com/photo-1477959858617-67f85b34b5ad?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1515165562835-c4c2e6c0b4d2?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1465447142348-e9952c393450?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?auto=format&fit=crop&w=800&q=80',
];

const STATUSES = ['submitted', 'in_review', 'accepted', 'in_progress'] as const;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const replaceNbi = args.includes('--replace-nbi');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg.split('=')[1], 10)) : undefined;

type NbiBridge = {
  objectId: number | null;
  nbiId: string;
  congressionalDistrict: string | null;
  routeNo: string | null;
  features: string | null;
  roadCarried: string | null;
  location: string | null;
  yearBuilt: number | null;
  fc: string | null;
  lastWork: number;
  condition: string;
  latitude: number;
  longitude: number;
  cdRank: number | null;
  repairCost: number | null;
  mapsUrl: string | null;
};

type NbiPayload = {
  datasetKey: string;
  count: number;
  bridges: NbiBridge[];
};

function detId(prefix: string, key: string) {
  const hash = crypto.createHash('sha1').update(`${DATASET}:${key}`).digest('hex').slice(0, 20);
  return `${prefix}_${hash}`;
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function rand(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function stateFromCd(cd: string | null): string | null {
  if (!cd) return null;
  const m = cd.match(/^([A-Z]{2})-/);
  return m ? m[1] : null;
}

async function insertChunks<T extends Record<string, unknown>>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  label: string
) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await db.insert(table).values(chunk as never);
    if (i > 0 && i % (BATCH * 5) === 0) {
      console.log(`  ${label}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
    }
  }
}

async function clearNbiOnly() {
  console.log(`Replacing NBI dataset ${DATASET}…`);
  if (dryRun) return;

  const demoReports = await db.select({ id: reports.id }).from(reports).where(eq(reports.datasetKey, DATASET));
  const reportIds = demoReports.map((r) => r.id);
  for (let i = 0; i < reportIds.length; i += BATCH) {
    const chunk = reportIds.slice(i, i + BATCH);
    await db.delete(upvotes).where(inArray(upvotes.reportId, chunk));
    await db.delete(comments).where(inArray(comments.reportId, chunk));
    await db.delete(reportStatusHistory).where(inArray(reportStatusHistory.reportId, chunk));
    await db.delete(reportLocations).where(inArray(reportLocations.reportId, chunk));
    await db.delete(reportServiceAreas).where(inArray(reportServiceAreas.reportId, chunk));
    await db.delete(flags).where(inArray(flags.targetId, chunk));
    await db.delete(reports).where(inArray(reports.id, chunk));
  }

  const nbiUsers = await db.select({ id: users.id }).from(users).where(eq(users.datasetKey, DATASET));
  if (nbiUsers.length) {
    await db.delete(users).where(inArray(users.id, nbiUsers.map((u) => u.id)));
  }
}

async function ensureReporters(): Promise<string[]> {
  const ids: string[] = [];
  const newUsers = [];
  for (let i = 0; i < 8; i++) {
    const id = detId('user', `reporter_${i}`);
    ids.push(id);
    newUsers.push({
      id,
      email: `nbi.reporter${i + 1}@fixmydistrict.app`,
      displayName: `NBI Reporter ${i + 1}`,
      passwordHash,
      role: 'submitter' as const,
      bio: 'Synthetic NBI bridge inventory reporter',
      isSynthetic: true,
      datasetKey: DATASET,
      createdAt: new Date(Date.now() - (8 - i) * 86400000 * 30),
    });
  }

  if (!dryRun) {
    const existing = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
    const have = new Set(existing.map((u) => u.id));
    await insertChunks(
      users,
      newUsers.filter((u) => !have.has(u.id)),
      'nbi users'
    );
  }
  return ids;
}

async function seed() {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(
      `Missing ${JSON_PATH}. Run: npm run nbi:convert`
    );
  }

  const payload = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) as NbiPayload;
  let bridges = payload.bridges;
  if (LIMIT) bridges = bridges.slice(0, LIMIT);

  console.log(
    `Seeding ${DATASET} (${bridges.length} bridges)${dryRun ? ' [DRY RUN]' : ''}…`
  );
  console.time('seed-nbi');

  if (replaceNbi) await clearNbiOnly();
  const submitterIds = await ensureReporters();

  const existing = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.datasetKey, DATASET));
  const existingIds = new Set(existing.map((r) => r.id));

  const reportRows = [];
  const locationRows = [];
  const historyRows = [];
  let skipped = 0;
  const conditionCounts: Record<string, number> = {};
  const cdCounts: Record<string, number> = {};

  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];
    // Include row index: spreadsheet can repeat NBI IDs across districts
    const rowKey = `nbi_${b.nbiId}_${b.objectId ?? i}_${i}`;
    const reportId = detId('rpt', rowKey);
    if (existingIds.has(reportId)) {
      skipped++;
      continue;
    }

    const failing = b.condition === 'F';
    const severity = failing ? 5 : 4;
    const failureType = failing ? 'Structural Failure' : 'Deferred Maintenance';
    const conditionLabel = failing ? 'Failing' : 'Poor';
    const road = b.roadCarried || 'Unnamed route';
    const features = b.features || 'waterway/roadway';
    const title = `${conditionLabel} bridge — ${road} over ${features}`;
    const cost = b.repairCost ?? 0;
    const costLow = cost > 0 ? Math.round(cost * 0.85) : null;
    const costHigh = cost > 0 ? Math.round(cost * 1.15) : null;
    const submitterId = pick(submitterIds, i);
    const status = pick([...STATUSES], Math.floor(rand(i + 1) * STATUSES.length));
    const yearBuilt = b.yearBuilt || 1970;
    const ageYears = Math.max(1, new Date().getFullYear() - yearBuilt);
    // Keep within ~11 months so default analytics "year" preset includes all NBI rows
    const daysAgo = Math.min(320, Math.floor(30 + (ageYears % 90) + rand(i + 2) * 40));
    const createdAt = new Date(Date.now() - daysAgo * 86400000);
    const occurredAt = new Date(createdAt.getTime() - Math.floor(rand(i + 3) * 14) * 86400000);
    const state = stateFromCd(b.congressionalDistrict);
    const mapsNote = b.mapsUrl ? `\n\nMaps: ${b.mapsUrl}` : '';

    const description = [
      `NBI inventory bridge ${b.nbiId} rated ${conditionLabel} (${b.condition}).`,
      `Carries ${road} over ${features}.`,
      b.location ? `Location: ${b.location}.` : '',
      b.routeNo ? `Route No: ${b.routeNo}.` : '',
      b.congressionalDistrict ? `Congressional District: ${b.congressionalDistrict}.` : '',
      `Year built: ${yearBuilt}.`,
      b.lastWork ? `Last work: ${b.lastWork}.` : 'Last work: none recorded.',
      cost > 0 ? `Estimated repair cost: $${cost.toLocaleString('en-US')}.` : '',
      'Source: US Bridge Inventory CD 2026V14 (synthetic seed for analytics).',
      mapsNote,
    ]
      .filter(Boolean)
      .join(' ');

    reportRows.push({
      id: reportId,
      referenceNo: `NBI-${b.nbiId}-${b.objectId ?? i}`,
      submitterId,
      title,
      description,
      latitude: b.latitude,
      longitude: b.longitude,
      severity,
      status,
      category: 'Transportation',
      subcategory: 'Bridge',
      infrastructureClass: 'Transportation',
      infrastructureType: 'Bridge',
      failureType,
      suspectedCause: failing
        ? 'Structural deterioration / deferred maintenance'
        : 'Age and deferred maintenance',
      assetName: `NBI ${b.nbiId}`,
      responsibleAgency: 'DOT',
      isRecurrence: (b.lastWork || 0) > 0 && ageYears > 40,
      postAction: 'failure',
      postType: 'new',
      evidenceType: 'photo',
      observationConfidence: 4,
      estimatedCostLow: costLow,
      estimatedCostHigh: costHigh,
      actualCost: null,
      currency: 'USD',
      costEstimateSource: 'nbi_repair_cost',
      costConfidence: 3,
      peopleAffected: failing ? Math.floor(500 + rand(i + 4) * 4500) : Math.floor(100 + rand(i + 4) * 1500),
      householdsAffected: null,
      outageDurationHours: null,
      safetyImpact: failing,
      accessibilityImpact: true,
      environmentalImpact: false,
      tags: [
        'nbi',
        'bridge',
        b.condition,
        b.congressionalDistrict,
        state,
        yearBuilt,
      ]
        .filter(Boolean)
        .join(',')
        .toLowerCase(),
      imageUrl: pick(BRIDGE_IMAGE_POOL, i),
      isHidden: false,
      featured: i % 100 === 0,
      isSynthetic: true,
      datasetKey: DATASET,
      occurredAt,
      resolvedAt: null,
      updatedAt: createdAt,
      createdAt,
    });

    locationRows.push({
      id: detId('loc', rowKey),
      reportId,
      addressLine: b.location,
      city: null,
      postalCode: null,
      county: null,
      stateProvince: state,
      countryCode: 'US',
      latitude: b.latitude,
      longitude: b.longitude,
      geocodeStatus: 'matched',
      geocodeSource: 'nbi-inventory-2026v14',
      geocodeConfidence: 0.95,
      censusRegion: null,
      censusDivision: null,
      stateFips: null,
      countyFips: null,
      tractGeoid: null,
      congressionalDistrict: b.congressionalDistrict,
      stateSenateDistrict: null,
      stateHouseDistrict: null,
      schoolDistrict: null,
      metroArea: null,
      createdAt,
      updatedAt: createdAt,
    });

    historyRows.push({
      id: detId('hist', `${rowKey}_0`),
      reportId,
      fromStatus: null,
      toStatus: 'submitted',
      changedBy: submitterId,
      note: 'Seeded from NBI inventory',
      createdAt: occurredAt,
    });

    if (status !== 'submitted') {
      historyRows.push({
        id: detId('hist', `${rowKey}_1`),
        reportId,
        fromStatus: 'submitted',
        toStatus: status,
        changedBy: submitterId,
        note: 'Seeded progression',
        createdAt,
      });
    }

    conditionCounts[b.condition] = (conditionCounts[b.condition] || 0) + 1;
    if (b.congressionalDistrict) {
      cdCounts[b.congressionalDistrict] = (cdCounts[b.congressionalDistrict] || 0) + 1;
    }
  }

  if (!dryRun) {
    console.log(`Inserting ${reportRows.length} reports (skipping ${skipped} existing)…`);
    await insertChunks(reports, reportRows, 'reports');
    await insertChunks(reportLocations, locationRows, 'locations');
    await insertChunks(reportStatusHistory, historyRows, 'history');
  }

  console.timeEnd('seed-nbi');
  console.log(`Done. inserted=${reportRows.length}, skipped(existing)=${skipped}`);
  console.log('Condition counts:', conditionCounts);
  const topCds = Object.entries(cdCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  console.log('Top CDs:', topCds);
  console.log(`Analytics filter: datasetKey=${DATASET}`);
  console.log('Login: admin@fixmydistrict.app / password123');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
