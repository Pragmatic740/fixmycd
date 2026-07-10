import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not defined in the environment.');
  process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
  console.log('Running Postgres migrations...');

  await sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" text PRIMARY KEY NOT NULL,
      "email" text NOT NULL UNIQUE,
      "display_name" text,
      "password_hash" text,
      "role" text DEFAULT 'viewer' NOT NULL,
      "bio" text,
      "disabled_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;

  await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;`;
  await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;`;
  await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_at" timestamp with time zone;`;

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
      "category" text,
      "subcategory" text,
      "post_action" text DEFAULT 'failure',
      "post_type" text DEFAULT 'new',
      "parent_report_id" text,
      "image_url" text,
      "video_url" text,
      "audio_url" text,
      "compass_direction" real,
      "ai_summary" text,
      "review_note" text,
      "is_hidden" boolean DEFAULT false NOT NULL,
      "featured" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;

  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "image_url" text;`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "category" text;`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "subcategory" text;`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "post_action" text DEFAULT 'failure';`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "post_type" text DEFAULT 'new';`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "parent_report_id" text;`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "video_url" text;`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "audio_url" text;`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "compass_direction" real;`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "ai_summary" text;`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "review_note" text;`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "is_hidden" boolean DEFAULT false;`;
  await sql`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "featured" boolean DEFAULT false;`;

  await sql`
    CREATE TABLE IF NOT EXISTS "upvotes" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "users"("id"),
      "report_id" text NOT NULL REFERENCES "reports"("id"),
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "upvotes_user_report_unique" ON "upvotes" ("user_id", "report_id");`;

  await sql`
    CREATE TABLE IF NOT EXISTS "comments" (
      "id" text PRIMARY KEY NOT NULL,
      "report_id" text NOT NULL REFERENCES "reports"("id"),
      "user_id" text NOT NULL REFERENCES "users"("id"),
      "body" text NOT NULL,
      "is_hidden" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "notifications" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "users"("id"),
      "type" text NOT NULL,
      "actor_id" text REFERENCES "users"("id"),
      "report_id" text REFERENCES "reports"("id"),
      "read" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "flags" (
      "id" text PRIMARY KEY NOT NULL,
      "target_type" text NOT NULL,
      "target_id" text NOT NULL,
      "reporter_id" text NOT NULL REFERENCES "users"("id"),
      "reason" text NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "follows" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "users"("id"),
      "follow_type" text NOT NULL,
      "target_id" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "saved_searches" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "users"("id"),
      "name" text NOT NULL,
      "query_json" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports" ("status");`;
  await sql`CREATE INDEX IF NOT EXISTS "reports_category_idx" ON "reports" ("category");`;
  await sql`CREATE INDEX IF NOT EXISTS "reports_created_at_idx" ON "reports" ("created_at");`;
  await sql`CREATE INDEX IF NOT EXISTS "reports_lat_lng_idx" ON "reports" ("latitude", "longitude");`;

  console.log('Migration complete.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
