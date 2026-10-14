import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { createMigratedDatabase } from '../helpers/pg';
import { runSeeds } from '../helpers/run-seeds';
import { diffSeedSnapshots, takeSeedSnapshot, type SeedSnapshot } from '../helpers/seed-snapshot';

const fixture: SeedSnapshot = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../fixtures/seed-snapshot.json'), 'utf8')
);

const CORE_ACCOUNTS = [
  ['superadmin@fixmydistrict.app', 'super_admin'],
  ['admin@fixmydistrict.app', 'admin'],
  ['referee@fixmydistrict.app', 'referee'],
  ['viewer@fixmydistrict.app', 'viewer'],
  ['citizen1@fixmydistrict.app', 'submitter'],
] as const;

describe('seed data', () => {
  it('is identical to the recorded snapshot (seed output must not change)', async () => {
    const url = await createMigratedDatabase('fixmycd_seed_check');
    runSeeds(url);
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    try {
      const snapshot = await takeSeedSnapshot(sql);
      expect(diffSeedSnapshots(fixture, snapshot)).toEqual([]);

      // Demo accounts keep their documented roles and the password123 default.
      for (const [email, role] of CORE_ACCOUNTS) {
        const [u] = await sql`SELECT role, status, password_hash FROM users WHERE email = ${email}`;
        expect(u, email).toBeDefined();
        expect(u.role).toBe(role);
        expect(u.status).toBe('approved');
        expect(bcrypt.compareSync('password123', u.password_hash)).toBe(true);
      }

      // Re-running the seeds is additive and leaves the data unchanged.
      runSeeds(url);
      expect(diffSeedSnapshots(fixture, await takeSeedSnapshot(sql))).toEqual([]);
    } finally {
      await sql.end();
    }
  }, 300_000);
});
