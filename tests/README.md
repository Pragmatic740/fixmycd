# Tests

| Suite | Command | Needs |
| --- | --- | --- |
| Unit | `npm run test:unit` | nothing |
| Integration | `npm run test:integration` | Postgres (`TEST_DATABASE_URL`) |
| End-to-end | `npm run build && npm run test:e2e` | Postgres + Chromium |
| All Vitest suites | `npm test` | Postgres |

`TEST_DATABASE_URL` must point at a Postgres server where the tests may
**create and drop databases** (they use `fixmycd_test`, `fixmycd_e2e`,
`fixmycd_seed_check` and a few `fixmycd_mig_*`). Never point it at
production. Locally:

```bash
docker run -d --name fmd-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
npm test
```

## How the suites work

- **Unit** (`tests/unit`): pure functions — validation schemas, media and
  upload checks, CSRF check, PDF text handling, geocoder parsing, service
  worker caching rules, helpers.
- **Integration** (`tests/integration`): real route handlers called
  directly (`tests/helpers/route.ts`) against a freshly migrated database;
  `next/headers` cookies are backed by an in-memory jar so tests log in
  through the real login route. External services (Resend, geocoders)
  are mocked with `vi.mock`/`vi.spyOn(fetch)`.
- **Seed snapshot** (`tests/integration/seed.test.ts`): runs the real seed
  scripts and compares every row they write with
  `tests/fixtures/seed-snapshot.json` (timestamps and bcrypt hashes
  excluded). If you change seed data on purpose, re-record with
  `npm run test:seed:record` and review the diff.
- **Migrations** (`tests/integration/migrations.test.ts`): every column in
  `src/db/schema.ts` must exist after `runMigrations`, migrations must be
  idempotent, and an old (July 2026) database must upgrade cleanly.
- **End-to-end** (`tests/e2e`): Playwright against `next start`, with a
  fresh `fixmycd_e2e` database prepared by `tests/e2e/prepare-db.ts`.
