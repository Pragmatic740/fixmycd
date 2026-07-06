import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not defined in the environment.");
  process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
  console.log("Running Postgres migrations...");
  
  await sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" text PRIMARY KEY NOT NULL,
      "email" text NOT NULL UNIQUE,
      "display_name" text,
      "password_hash" text,
      "role" text DEFAULT 'viewer' NOT NULL,
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;

  await sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "reports" (
      "id" text PRIMARY KEY NOT NULL,
      "reference_no" text NOT NULL UNIQUE,
      "submitter_id" text NOT NULL REFERENCES "users"("id"),
      "title" text NOT NULL,
      "description" text,
      "latitude" real NOT NULL,
      "longitude" real NOT NULL,
      "severity" integer,
      "status" text DEFAULT 'submitted' NOT NULL,
      "image_url" text,
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;

  await sql`
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "image_url" text;
  `;

  console.log("Migration complete.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
