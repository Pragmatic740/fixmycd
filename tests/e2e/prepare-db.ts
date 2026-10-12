/**
 * Fresh database for the Playwright run, with a few known accounts.
 * Used by `npm run test:e2e` before the app server starts.
 */
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { createMigratedDatabase } from '../helpers/pg';
import { E2E_DB, E2E_PASSWORD, E2E_USERS } from './fixtures';

async function main() {
  const url = await createMigratedDatabase(E2E_DB);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const hash = bcrypt.hashSync(E2E_PASSWORD, 10);
  for (const u of Object.values(E2E_USERS)) {
    await sql`
      INSERT INTO users (id, email, display_name, password_hash, role, status)
      VALUES (${u.id}, ${u.email}, ${u.name}, ${hash}, ${u.role}, 'approved')`;
  }
  await sql`
    INSERT INTO reports (id, reference_no, submitter_id, title, description, latitude, longitude, severity, status, category)
    VALUES ('e2e_report_1', 'E2E-1', ${E2E_USERS.citizen.id}, 'Broken streetlight on Elm St',
            'Dark at night', 40.7128, -74.006, 3, 'submitted', 'Utilities')`;
  await sql.end();
  console.log(`E2E database ready: ${E2E_DB}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
