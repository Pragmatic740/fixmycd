import postgres from 'postgres';
import dotenv from 'dotenv';
import { runMigrations } from './src/db/migrations';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not defined in the environment.');
  process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
  console.log('Running Postgres migrations...');
  await runMigrations(sql);
  console.log('Migration complete.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
