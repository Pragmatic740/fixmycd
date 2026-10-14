import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users, reports, comments, reportLocations } from '@/db/schema';

export const TEST_PASSWORD = 'correct horse battery';
// Cost 4 keeps the suite fast; production cost is enforced by the app.
const TEST_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

export type Role = 'viewer' | 'submitter' | 'referee' | 'admin' | 'super_admin';

let counter = 0;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function createUser(
  overrides: Partial<typeof users.$inferInsert> & { role?: Role } = {}
) {
  const id = overrides.id ?? `user_${uid()}`;
  const row: typeof users.$inferInsert = {
    id,
    email: `${id}@example.test`,
    displayName: `User ${id}`,
    passwordHash: TEST_HASH,
    role: 'submitter',
    status: 'approved',
    createdAt: new Date(),
    ...overrides,
  };
  await db.insert(users).values(row);
  return { ...row, password: TEST_PASSWORD };
}

export async function createReport(
  submitterId: string,
  overrides: Partial<typeof reports.$inferInsert> = {}
) {
  const id = overrides.id ?? `rpt_${uid()}`;
  const row: typeof reports.$inferInsert = {
    id,
    referenceNo: `T-${id}`,
    submitterId,
    title: 'Broken streetlight',
    description: 'The light on the corner has been out for a week.',
    latitude: 40.7128,
    longitude: -74.006,
    severity: 3,
    status: 'submitted',
    category: 'Utilities',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await db.insert(reports).values(row);
  await db.insert(reportLocations).values({
    id: `loc_${id}`,
    reportId: id,
    latitude: row.latitude,
    longitude: row.longitude,
    city: 'New York',
    stateProvince: 'NY',
    countryCode: 'US',
    geocodeStatus: 'matched',
  });
  return row;
}

export async function createComment(
  reportId: string,
  userId: string,
  overrides: Partial<typeof comments.$inferInsert> = {}
) {
  const row: typeof comments.$inferInsert = {
    id: crypto.randomUUID(),
    reportId,
    userId,
    body: 'Same here, it is dangerous at night.',
    createdAt: new Date(),
    ...overrides,
  };
  await db.insert(comments).values(row);
  return row;
}
