import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

/** Arguments used for both recording and checking the seed snapshot. */
export const SEED_RUNS: { script: string; args: string[] }[] = [
  { script: 'seed.ts', args: ['--count=100'] },
  { script: 'seed-nbi-bridges.ts', args: ['--limit=50'] },
];

/** Run the real seed scripts (as `npm run db:seed*` would) against a database. */
export function runSeeds(databaseUrl: string): void {
  for (const { script, args } of SEED_RUNS) {
    execFileSync(path.join(ROOT, 'node_modules/.bin/tsx'), [script, ...args], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
      timeout: 300_000,
    });
  }
}
