/**
 * Safe additive U.S.-first demo seed.
 * Never deletes non-demo data.
 *
 * Usage:
 *   npx tsx seed.ts
 *   npx tsx seed.ts --replace-demo   # wipe only us-demo-v1 records then reseed
 *   npx tsx seed.ts --count=300
 *   npx tsx seed.ts --dry-run
 */
import crypto from 'crypto';
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
  serviceAreas,
  reportServiceAreas,
} from './src/db/schema';
import { INFRASTRUCTURE_TAXONOMY, FAILURE_TYPES } from './src/lib/categories';

dotenv.config();

const DATASET = 'us-demo-v1';
const PASSWORD = 'password123';
const passwordHash = bcrypt.hashSync(PASSWORD, 10);
const BATCH = 40;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const replaceDemo = args.includes('--replace-demo');
const countArg = args.find((a) => a.startsWith('--count='));
const REPORT_COUNT = countArg ? Math.min(1000, Math.max(50, parseInt(countArg.split('=')[1], 10))) : 500;

type Metro = {
  name: string;
  state: string;
  stateFips: string;
  county: string;
  countyFips: string;
  region: string;
  division: string;
  lat: number;
  lng: number;
  zips: string[];
};

const METROS: Metro[] = [
  { name: 'New York', state: 'NY', stateFips: '36', county: 'New York County', countyFips: '36061', region: 'Northeast', division: 'Middle Atlantic', lat: 40.7128, lng: -74.006, zips: ['10001', '10002', '10013', '11201'] },
  { name: 'Washington DC', state: 'DC', stateFips: '11', county: 'District of Columbia', countyFips: '11001', region: 'South', division: 'South Atlantic', lat: 38.9072, lng: -77.0369, zips: ['20001', '20002', '20005', '20009'] },
  { name: 'Atlanta', state: 'GA', stateFips: '13', county: 'Fulton County', countyFips: '13121', region: 'South', division: 'South Atlantic', lat: 33.749, lng: -84.388, zips: ['30303', '30308', '30309', '30318'] },
  { name: 'Chicago', state: 'IL', stateFips: '17', county: 'Cook County', countyFips: '17031', region: 'Midwest', division: 'East North Central', lat: 41.8781, lng: -87.6298, zips: ['60601', '60611', '60614', '60622'] },
  { name: 'Houston', state: 'TX', stateFips: '48', county: 'Harris County', countyFips: '48201', region: 'South', division: 'West South Central', lat: 29.7604, lng: -95.3698, zips: ['77002', '77007', '77019', '77027'] },
  { name: 'Denver', state: 'CO', stateFips: '08', county: 'Denver County', countyFips: '08031', region: 'West', division: 'Mountain', lat: 39.7392, lng: -104.9903, zips: ['80202', '80203', '80205', '80211'] },
  { name: 'Los Angeles', state: 'CA', stateFips: '06', county: 'Los Angeles County', countyFips: '06037', region: 'West', division: 'Pacific', lat: 34.0522, lng: -118.2437, zips: ['90012', '90015', '90028', '90036'] },
  { name: 'Seattle', state: 'WA', stateFips: '53', county: 'King County', countyFips: '53033', region: 'West', division: 'Pacific', lat: 47.6062, lng: -122.3321, zips: ['98101', '98104', '98109', '98122'] },
];

const IMAGE_POOL = [
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1590496793929-36417d95d294?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=800&q=80',
];
const AGENCIES = ['DOT', 'DPW', 'Water Utility', 'Power Utility', 'Parks Dept', 'School District', 'Transit Authority', 'Emergency Management'];
const STATUSES = ['submitted', 'in_review', 'accepted', 'in_progress', 'resolved', 'resubmit'] as const;
const FIRST = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Sam', 'Jamie', 'Chris', 'Pat', 'Drew', 'Cameron', 'Reese'];
const LAST = ['Nguyen', 'Patel', 'Garcia', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White'];

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

async function ensureCoreAccounts() {
  const core = [
    { email: 'superadmin@fixmydistrict.app', displayName: 'Super Admin', role: 'super_admin', key: 'superadmin' },
    { email: 'admin@fixmydistrict.app', displayName: 'System Admin', role: 'admin', key: 'admin' },
    { email: 'referee@fixmydistrict.app', displayName: 'Referee Admin', role: 'referee', key: 'referee' },
    { email: 'viewer@fixmydistrict.app', displayName: 'District Viewer', role: 'viewer', key: 'viewer' },
    { email: 'citizen1@fixmydistrict.app', displayName: 'Tendai Moyo', role: 'submitter', key: 'citizen1' },
    { email: 'citizen2@fixmydistrict.app', displayName: 'Rudo Chikwanha', role: 'submitter', key: 'citizen2' },
    { email: 'citizen3@fixmydistrict.app', displayName: 'Farai Ndlovu', role: 'submitter', key: 'citizen3' },
  ];

  for (const u of core) {
    const existing = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    if (existing.length === 0) {
      if (!dryRun) {
        await db.insert(users).values({
          id: detId('user', u.key),
          email: u.email,
          displayName: u.displayName,
          passwordHash,
          role: u.role,
          createdAt: new Date(),
        });
      }
      console.log(`+ user ${u.email}`);
    } else if (!dryRun) {
      await db.update(users).set({ passwordHash, role: u.role }).where(eq(users.email, u.email));
      console.log(`~ password set for ${u.email}`);
    }
  }
}

async function clearDemoOnly() {
  console.log(`Replacing demo dataset ${DATASET}…`);
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
  await db.delete(serviceAreas).where(eq(serviceAreas.datasetKey, DATASET));
  const demoUsers = await db.select({ id: users.id }).from(users).where(eq(users.datasetKey, DATASET));
  if (demoUsers.length) {
    await db.delete(users).where(inArray(users.id, demoUsers.map((u) => u.id)));
  }
}

async function seed() {
  console.log(`Seeding ${DATASET} (${REPORT_COUNT} reports)${dryRun ? ' [DRY RUN]' : ''}…`);
  console.time('seed');

  await ensureCoreAccounts();
  if (replaceDemo) await clearDemoOnly();

  const submitterIds: string[] = [];
  const newUsers = [];
  for (let i = 0; i < 50; i++) {
    const id = detId('user', `submitter_${i}`);
    submitterIds.push(id);
    newUsers.push({
      id,
      email: `demo.citizen${i + 1}@fixmydistrict.app`,
      displayName: `${pick(FIRST, i)} ${pick(LAST, i + 3)}`,
      passwordHash,
      role: 'submitter' as const,
      bio: `Demo civic reporter #${i + 1}`,
      isSynthetic: true,
      datasetKey: DATASET,
      createdAt: new Date(Date.now() - (50 - i) * 86400000 * 10),
    });
  }
  if (!dryRun) {
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, submitterIds));
    const have = new Set(existingUsers.map((u) => u.id));
    const missing = newUsers.filter((u) => !have.has(u.id));
    await insertChunks(users, missing, 'users');
    console.log(`Submitters ready (${missing.length} inserted, ${have.size} existed)`);
  }

  const serviceRows = [];
  for (let i = 0; i < METROS.length; i++) {
    const metro = METROS[i];
    for (const type of ['water', 'power', 'school'] as const) {
      serviceRows.push({
        id: detId('svc', `${metro.name}_${type}`),
        name: `${metro.name} ${type} service area`,
        type,
        provider: `${metro.name} ${type === 'school' ? 'Public Schools' : type === 'water' ? 'Water Authority' : 'Power Co'}`,
        countryCode: 'US',
        stateProvince: metro.state,
        isSynthetic: true,
        datasetKey: DATASET,
        createdAt: new Date(),
      });
    }
  }
  if (!dryRun) {
    const existingSvc = await db
      .select({ id: serviceAreas.id })
      .from(serviceAreas)
      .where(inArray(serviceAreas.id, serviceRows.map((s) => s.id)));
    const haveSvc = new Set(existingSvc.map((s) => s.id));
    await insertChunks(
      serviceAreas,
      serviceRows.filter((s) => !haveSvc.has(s.id)),
      'service areas'
    );
  }

  const existingDemo = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.datasetKey, DATASET));
  const existingIds = new Set(existingDemo.map((r) => r.id));

  const classes = Object.keys(INFRASTRUCTURE_TAXONOMY);
  const reportRows = [];
  const locationRows = [];
  const historyRows = [];
  const upvoteRows = [];
  const commentRows = [];
  const rsaRows = [];
  let skipped = 0;

  for (let i = 0; i < REPORT_COUNT; i++) {
    const reportId = detId('rpt', `report_${i}`);
    if (existingIds.has(reportId)) {
      skipped++;
      continue;
    }

    const metro = pick(METROS, i);
    const klass = pick(classes, i);
    const types = INFRASTRUCTURE_TAXONOMY[klass];
    const infraType = pick(types, i + 2);
    const failureType = pick([...FAILURE_TYPES], i + 5);
    const status = pick([...STATUSES], Math.floor(rand(i) * STATUSES.length * 1.4) % STATUSES.length);
    const severity = 1 + Math.floor(rand(i + 1) * 5);
    const submitterId = pick(submitterIds, i);
    const lat = metro.lat + (rand(i + 2) - 0.5) * 0.18;
    const lng = metro.lng + (rand(i + 3) - 0.5) * 0.22;
    const daysAgo = Math.floor(rand(i + 4) * 400);
    const createdAt = new Date(Date.now() - daysAgo * 86400000);
    const occurredAt = new Date(createdAt.getTime() - Math.floor(rand(i + 5) * 3) * 86400000);
    const resolvedAt =
      status === 'resolved'
        ? new Date(createdAt.getTime() + Math.floor(rand(i + 6) * 40 + 2) * 86400000)
        : null;
    const costBase = Math.pow(10, 2 + rand(i + 7) * 4);
    const costLow = Math.round(costBase * (0.7 + rand(i + 8) * 0.2));
    const costHigh = Math.round(costBase * (1.1 + rand(i + 9) * 0.8));
    const people = severity >= 4 ? Math.floor(rand(i + 10) * 5000) : Math.floor(rand(i + 10) * 200);
    const intentionallySparse = rand(i + 11) < 0.08;
    const title = `${failureType.split('/')[0]} — ${infraType} in ${metro.name}`;
    const zip = pick(metro.zips, i);
    const tract = `${metro.countyFips}${String(100000 + (i % 900)).slice(1)}`;

    reportRows.push({
      id: reportId,
      referenceNo: `FMD-D${String(10000 + i)}`,
      submitterId,
      title,
      description: `${failureType} affecting ${infraType.toLowerCase()} near ${metro.name}, ${metro.state}. Observed by community reporter. Severity ${severity}/5.`,
      latitude: lat,
      longitude: lng,
      severity,
      status,
      category: klass,
      subcategory: infraType,
      infrastructureClass: klass,
      infrastructureType: infraType,
      failureType,
      suspectedCause: pick(['Age/deferred maintenance', 'Storm damage', 'Overloaded capacity', 'Vandalism', 'Unknown'], i),
      assetName: `${infraType} #${1000 + (i % 900)}`,
      responsibleAgency: pick(AGENCIES, i),
      isRecurrence: rand(i + 12) < 0.15,
      postAction: pick(['failure', 'failure', 'failure', 'fix', 'update'], i),
      postType: 'new',
      evidenceType: pick(['photo', 'photo', 'video', 'eyewitness'], i),
      observationConfidence: 2 + Math.floor(rand(i + 13) * 4),
      estimatedCostLow: intentionallySparse ? null : costLow,
      estimatedCostHigh: intentionallySparse ? null : costHigh,
      actualCost:
        status === 'resolved' && !intentionallySparse
          ? Math.round(((costLow + costHigh) / 2) * (0.8 + rand(i + 14) * 0.4))
          : null,
      currency: 'USD',
      costEstimateSource: intentionallySparse ? null : 'demo_model',
      costConfidence: intentionallySparse ? null : 2 + Math.floor(rand(i + 15) * 3),
      peopleAffected: people,
      householdsAffected: Math.floor(people / 2.4),
      outageDurationHours: severity >= 4 ? Math.round(rand(i + 16) * 72) : Math.round(rand(i + 16) * 8),
      safetyImpact: severity >= 4,
      accessibilityImpact: rand(i + 17) < 0.25,
      environmentalImpact: klass.includes('Water') || klass.includes('Flood') || rand(i + 18) < 0.15,
      tags: `${metro.name},${klass},${failureType}`.toLowerCase(),
      imageUrl: IMAGE_POOL[i % IMAGE_POOL.length],
      isHidden: false,
      featured: i % 47 === 0,
      isSynthetic: true,
      datasetKey: DATASET,
      occurredAt,
      resolvedAt,
      updatedAt: resolvedAt || createdAt,
      createdAt,
    });

    locationRows.push({
      id: detId('loc', `report_${i}`),
      reportId,
      addressLine: `${100 + (i % 800)} ${pick(['Main', 'Oak', 'Market', 'Broadway', 'Pine'], i)} St`,
      city: metro.name,
      postalCode: zip,
      county: metro.county,
      stateProvince: metro.state,
      countryCode: 'US',
      latitude: lat,
      longitude: lng,
      geocodeStatus: intentionallySparse && rand(i + 19) < 0.5 ? 'unmatched' : 'matched',
      geocodeSource: 'seed-us-demo',
      geocodeConfidence: intentionallySparse ? 0.3 : 0.92,
      censusRegion: metro.region,
      censusDivision: metro.division,
      stateFips: metro.stateFips,
      countyFips: metro.countyFips,
      tractGeoid: tract,
      congressionalDistrict: `${metro.state}-${String(1 + (i % 12)).padStart(2, '0')}`,
      stateSenateDistrict: `${metro.state}-SD-${1 + (i % 20)}`,
      stateHouseDistrict: `${metro.state}-HD-${1 + (i % 40)}`,
      schoolDistrict: `${metro.name} Unified`,
      metroArea: metro.name,
      createdAt,
      updatedAt: createdAt,
    });

    historyRows.push({
      id: detId('hist', `report_${i}_0`),
      reportId,
      fromStatus: null,
      toStatus: 'submitted',
      changedBy: submitterId,
      note: 'Seeded submission',
      createdAt: occurredAt,
    });
    if (status !== 'submitted') {
      historyRows.push({
        id: detId('hist', `report_${i}_1`),
        reportId,
        fromStatus: 'submitted',
        toStatus: status,
        changedBy: submitterId,
        note: 'Seeded progression',
        createdAt,
      });
    }

    if (rand(i + 20) < 0.4) {
      upvoteRows.push({
        id: detId('up', `report_${i}`),
        userId: pick(submitterIds, i + 7),
        reportId,
        createdAt,
      });
    }
    if (rand(i + 21) < 0.25) {
      commentRows.push({
        id: detId('cmt', `report_${i}`),
        reportId,
        userId: pick(submitterIds, i + 11),
        body: pick(
          [
            'Seeing this daily on my commute.',
            'Please escalate — safety risk.',
            'Confirmed with photos last week.',
            'City crew was nearby yesterday.',
          ],
          i
        ),
        createdAt,
      });
    }

    rsaRows.push({
      id: detId('rsa', `report_${i}`),
      reportId,
      serviceAreaId: detId('svc', `${metro.name}_${pick(['water', 'power', 'school'], i)}`),
      createdAt,
    });
  }

  // Harare sample
  for (let i = 0; i < 15; i++) {
    const reportId = detId('rpt', `harare_${i}`);
    if (existingIds.has(reportId)) {
      skipped++;
      continue;
    }
    const submitterId = pick(submitterIds, i);
    const createdAt = new Date(Date.now() - i * 86400000 * 5);
    reportRows.push({
      id: reportId,
      referenceNo: `FMD-H${2000 + i}`,
      submitterId,
      title: `Harare infrastructure issue #${i + 1}`,
      description: 'Country-aware non-US sample for multi-country readiness.',
      latitude: -17.8292 + (rand(i) - 0.5) * 0.05,
      longitude: 31.0522 + (rand(i + 1) - 0.5) * 0.05,
      severity: 1 + (i % 5),
      status: 'submitted',
      category: 'Transportation',
      subcategory: 'Road',
      infrastructureClass: 'Transportation',
      infrastructureType: 'Road',
      failureType: 'Surface Damage',
      postAction: 'failure',
      isSynthetic: true,
      datasetKey: DATASET,
      estimatedCostLow: 500,
      estimatedCostHigh: 5000,
      currency: 'USD',
      peopleAffected: 50 + i * 10,
      occurredAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      suspectedCause: null,
      assetName: null,
      responsibleAgency: null,
      isRecurrence: false,
      postType: 'new',
      evidenceType: 'eyewitness',
      observationConfidence: 3,
      actualCost: null,
      costEstimateSource: null,
      costConfidence: null,
      householdsAffected: null,
      outageDurationHours: null,
      safetyImpact: false,
      accessibilityImpact: false,
      environmentalImpact: false,
      tags: 'harare,zw',
      imageUrl: IMAGE_POOL[i % IMAGE_POOL.length],
      isHidden: false,
      featured: false,
      resolvedAt: null,
    });
    locationRows.push({
      id: detId('loc', `harare_${i}`),
      reportId,
      addressLine: null,
      city: 'Harare',
      postalCode: null,
      county: null,
      stateProvince: 'Harare',
      countryCode: 'ZW',
      latitude: -17.8292,
      longitude: 31.0522,
      geocodeStatus: 'manual',
      geocodeSource: 'seed-harare',
      geocodeConfidence: 0.5,
      censusRegion: null,
      censusDivision: null,
      stateFips: null,
      countyFips: null,
      tractGeoid: null,
      congressionalDistrict: null,
      stateSenateDistrict: null,
      stateHouseDistrict: null,
      schoolDistrict: null,
      metroArea: 'Harare',
      createdAt,
      updatedAt: createdAt,
    });
  }

  if (!dryRun) {
    console.log(`Inserting ${reportRows.length} reports (skipping ${skipped} existing)…`);
    await insertChunks(reports, reportRows, 'reports');
    await insertChunks(reportLocations, locationRows, 'locations');
    await insertChunks(reportStatusHistory, historyRows, 'history');
    await insertChunks(upvotes, upvoteRows, 'upvotes');
    await insertChunks(comments, commentRows, 'comments');
    await insertChunks(reportServiceAreas, rsaRows, 'service links');
  }

  console.timeEnd('seed');
  console.log(`Done. inserted=${reportRows.length}, skipped(existing)=${skipped}`);
  console.log(`Login: admin@fixmydistrict.app / ${PASSWORD}`);
  console.log(`Analytics: /dashboard/admin/analytics`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
