import { afterAll, beforeEach, vi } from 'vitest';
import { urlForDatabase } from '../helpers/pg';
import { cookieJar } from '../helpers/cookie-jar';

// Must be set before any app module imports '@/db'. dotenv never overrides an
// existing variable, so a developer's .env cannot point tests at a real DB.
process.env.DATABASE_URL = urlForDatabase('fixmycd_test');
process.env.RESEND_API_KEY = '';

vi.mock('next/headers', async () => {
  const { cookieJar: jar } = await import('../helpers/cookie-jar');
  return {
    cookies: async () => jar.store(),
    headers: async () => jar.requestHeaders(),
  };
});

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  const { pendingAfter } = await import('../helpers/after');
  // after() needs a live request scope; in tests, collect the callbacks so a
  // test can await them explicitly.
  return { ...actual, after: (fn: () => unknown) => pendingAfter.push(fn) };
});

beforeEach(async () => {
  cookieJar.clear();
  const { truncateAll } = await import('../helpers/db');
  await truncateAll();
});

afterAll(async () => {
  const { closeDb } = await import('../helpers/db');
  await closeDb();
});
