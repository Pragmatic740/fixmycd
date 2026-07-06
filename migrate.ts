import Database from 'better-sqlite3';

const sqlite = new Database('sqlite.db');

sqlite.exec(`
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"role" text DEFAULT 'submitter',
	"created_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
`);

sqlite.exec(`
CREATE TABLE IF NOT EXISTS "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reference_no" text NOT NULL,
	"submitter_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"image_url" text,
	"status" text DEFAULT 'Submitted',
	"severity" integer DEFAULT 1,
	"created_at" integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	"resolved_at" integer,
	CONSTRAINT "reports_reference_no_unique" UNIQUE("reference_no")
);
`);

console.log("Migration complete.");
