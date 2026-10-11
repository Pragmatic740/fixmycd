import type postgres from 'postgres';

/**
 * Idempotent schema migrations. Every statement uses IF NOT EXISTS (or a
 * conditional backfill), so this is safe to run on every deploy.
 * Runs inside a single transaction: a failure leaves the schema untouched.
 */
export async function runMigrations(client: postgres.Sql): Promise<void> {
  await client.begin(async (sql) => {
  
    await sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" text PRIMARY KEY NOT NULL,
        "email" text NOT NULL UNIQUE,
        "display_name" text,
        "password_hash" text,
        "role" text DEFAULT 'viewer' NOT NULL,
        "bio" text,
        "is_synthetic" boolean DEFAULT false NOT NULL,
        "dataset_key" text,
        "disabled_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
  
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;`;
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;`;
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_at" timestamp with time zone;`;
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_synthetic" boolean DEFAULT false;`;
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dataset_key" text;`;
    await sql`UPDATE "users" SET "is_synthetic" = false WHERE "is_synthetic" IS NULL;`;
  
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
  
    const reportColumns = [
      ['infrastructure_class', 'text'],
      ['infrastructure_type', 'text'],
      ['failure_type', 'text'],
      ['suspected_cause', 'text'],
      ['asset_name', 'text'],
      ['responsible_agency', 'text'],
      ['is_recurrence', 'boolean DEFAULT false'],
      ['evidence_type', 'text'],
      ['observation_confidence', 'integer'],
      ['estimated_cost_low', 'real'],
      ['estimated_cost_high', 'real'],
      ['actual_cost', 'real'],
      ['currency', "text DEFAULT 'USD'"],
      ['cost_estimate_source', 'text'],
      ['cost_confidence', 'integer'],
      ['people_affected', 'integer'],
      ['households_affected', 'integer'],
      ['outage_duration_hours', 'real'],
      ['safety_impact', 'boolean DEFAULT false'],
      ['accessibility_impact', 'boolean DEFAULT false'],
      ['environmental_impact', 'boolean DEFAULT false'],
      ['tags', 'text'],
      ['is_synthetic', 'boolean DEFAULT false'],
      ['dataset_key', 'text'],
      ['occurred_at', 'timestamp with time zone'],
      ['resolved_at', 'timestamp with time zone'],
      ['updated_at', 'timestamp with time zone DEFAULT CURRENT_TIMESTAMP'],
      ['image_url', 'text'],
      ['category', 'text'],
      ['subcategory', 'text'],
      ['post_action', "text DEFAULT 'failure'"],
      ['post_type', "text DEFAULT 'new'"],
      ['parent_report_id', 'text'],
      ['video_url', 'text'],
      ['audio_url', 'text'],
      ['compass_direction', 'real'],
      ['ai_summary', 'text'],
      ['review_note', 'text'],
      ['is_hidden', 'boolean DEFAULT false'],
      ['featured', 'boolean DEFAULT false'],
    ] as const;
  
    for (const [col, typ] of reportColumns) {
      await sql.unsafe(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "${col}" ${typ};`);
    }
  
    await sql`UPDATE "reports" SET "is_synthetic" = false WHERE "is_synthetic" IS NULL;`;
    await sql`UPDATE "reports" SET "is_recurrence" = false WHERE "is_recurrence" IS NULL;`;
    await sql`UPDATE "reports" SET "safety_impact" = false WHERE "safety_impact" IS NULL;`;
    await sql`UPDATE "reports" SET "accessibility_impact" = false WHERE "accessibility_impact" IS NULL;`;
    await sql`UPDATE "reports" SET "environmental_impact" = false WHERE "environmental_impact" IS NULL;`;
    await sql`UPDATE "reports" SET "is_hidden" = false WHERE "is_hidden" IS NULL;`;
    await sql`UPDATE "reports" SET "featured" = false WHERE "featured" IS NULL;`;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "report_locations" (
        "id" text PRIMARY KEY NOT NULL,
        "report_id" text NOT NULL UNIQUE REFERENCES "reports"("id"),
        "address_line" text,
        "city" text,
        "postal_code" text,
        "county" text,
        "state_province" text,
        "country_code" text DEFAULT 'US' NOT NULL,
        "latitude" real NOT NULL,
        "longitude" real NOT NULL,
        "geocode_status" text DEFAULT 'pending' NOT NULL,
        "geocode_source" text,
        "geocode_confidence" real,
        "census_region" text,
        "census_division" text,
        "state_fips" text,
        "county_fips" text,
        "tract_geoid" text,
        "block_group_geoid" text,
        "congressional_district" text,
        "state_senate_district" text,
        "state_house_district" text,
        "school_district" text,
        "metro_area" text,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
      );
    `;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "geographic_areas" (
        "id" text PRIMARY KEY NOT NULL,
        "type" text NOT NULL,
        "name" text NOT NULL,
        "code" text,
        "parent_id" text,
        "country_code" text DEFAULT 'US' NOT NULL,
        "source" text,
        "vintage" text,
        "metadata_json" text,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "report_geographic_areas" (
        "id" text PRIMARY KEY NOT NULL,
        "report_id" text NOT NULL REFERENCES "reports"("id"),
        "geographic_area_id" text NOT NULL REFERENCES "geographic_areas"("id"),
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "service_areas" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "type" text NOT NULL,
        "provider" text,
        "country_code" text DEFAULT 'US' NOT NULL,
        "state_province" text,
        "geometry_json" text,
        "metadata_json" text,
        "is_synthetic" boolean DEFAULT false NOT NULL,
        "dataset_key" text,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "report_service_areas" (
        "id" text PRIMARY KEY NOT NULL,
        "report_id" text NOT NULL REFERENCES "reports"("id"),
        "service_area_id" text NOT NULL REFERENCES "service_areas"("id"),
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "report_status_history" (
        "id" text PRIMARY KEY NOT NULL,
        "report_id" text NOT NULL REFERENCES "reports"("id"),
        "from_status" text,
        "to_status" text NOT NULL,
        "changed_by" text REFERENCES "users"("id"),
        "note" text,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "admin_audit_log" (
        "id" text PRIMARY KEY NOT NULL,
        "actor_id" text NOT NULL REFERENCES "users"("id"),
        "action" text NOT NULL,
        "target_type" text NOT NULL,
        "target_id" text,
        "details_json" text,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
  
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
  
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "geographic_areas_type_code_unique" ON "geographic_areas" ("type", "code", "country_code");`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "report_geo_areas_unique" ON "report_geographic_areas" ("report_id", "geographic_area_id");`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "report_service_areas_unique" ON "report_service_areas" ("report_id", "service_area_id");`;
  
    await sql`CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports" ("status");`;
    await sql`CREATE INDEX IF NOT EXISTS "reports_category_idx" ON "reports" ("category");`;
    await sql`CREATE INDEX IF NOT EXISTS "reports_created_at_idx" ON "reports" ("created_at");`;
    await sql`CREATE INDEX IF NOT EXISTS "reports_lat_lng_idx" ON "reports" ("latitude", "longitude");`;
    await sql`CREATE INDEX IF NOT EXISTS "reports_submitter_idx" ON "reports" ("submitter_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "reports_severity_idx" ON "reports" ("severity");`;
    await sql`CREATE INDEX IF NOT EXISTS "reports_post_action_idx" ON "reports" ("post_action");`;
    await sql`CREATE INDEX IF NOT EXISTS "reports_infra_class_idx" ON "reports" ("infrastructure_class");`;
    await sql`CREATE INDEX IF NOT EXISTS "reports_occurred_at_idx" ON "reports" ("occurred_at");`;
    await sql`CREATE INDEX IF NOT EXISTS "reports_dataset_idx" ON "reports" ("dataset_key");`;
    await sql`CREATE INDEX IF NOT EXISTS "report_locations_city_idx" ON "report_locations" ("city");`;
    await sql`CREATE INDEX IF NOT EXISTS "report_locations_state_idx" ON "report_locations" ("state_province");`;
    await sql`CREATE INDEX IF NOT EXISTS "report_locations_zip_idx" ON "report_locations" ("postal_code");`;
    await sql`CREATE INDEX IF NOT EXISTS "report_locations_county_idx" ON "report_locations" ("county");`;
    await sql`CREATE INDEX IF NOT EXISTS "report_locations_tract_idx" ON "report_locations" ("tract_geoid");`;
    await sql`CREATE INDEX IF NOT EXISTS "report_locations_country_idx" ON "report_locations" ("country_code");`;
    await sql`CREATE INDEX IF NOT EXISTS "report_status_history_report_idx" ON "report_status_history" ("report_id");`;
  
    // Backfill infrastructure fields from legacy category where missing
    await sql`
      UPDATE "reports" SET
        "infrastructure_class" = CASE "category"
          WHEN 'Road' THEN 'Transportation'
          WHEN 'Traffic' THEN 'Transportation'
          WHEN 'Water' THEN 'Water/Wastewater'
          WHEN 'Utilities' THEN 'Power'
          WHEN 'Buildings' THEN 'Buildings'
          WHEN 'Parks' THEN 'Parks'
          WHEN 'Schools' THEN 'Schools'
          ELSE COALESCE("infrastructure_class", "category")
        END
      WHERE "infrastructure_class" IS NULL AND "category" IS NOT NULL;
    `;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "analytics_saved_views" (
        "id" text PRIMARY KEY NOT NULL,
        "owner_id" text NOT NULL REFERENCES "users"("id"),
        "name" text NOT NULL,
        "filters_json" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    await sql`ALTER TABLE "analytics_saved_views" ADD COLUMN IF NOT EXISTS "description" text;`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "analytics_saved_views_owner_name" ON "analytics_saved_views" ("owner_id", "name");`;
    await sql`CREATE INDEX IF NOT EXISTS "analytics_saved_views_owner_idx" ON "analytics_saved_views" ("owner_id");`;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "analytics_share_tokens" (
        "id" text PRIMARY KEY NOT NULL,
        "token" text NOT NULL UNIQUE,
        "created_by" text NOT NULL REFERENCES "users"("id"),
        "saved_view_id" text REFERENCES "analytics_saved_views"("id"),
        "filters_json" text NOT NULL,
        "label" text,
        "expires_at" timestamp with time zone,
        "revoked_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "analytics_share_tokens_token_idx" ON "analytics_share_tokens" ("token");`;
  
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'approved' NOT NULL;`;
    await sql`UPDATE "users" SET "status" = 'approved' WHERE "status" IS NULL;`;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "beta_subscribers" (
        "id" text PRIMARY KEY NOT NULL,
        "email" text NOT NULL UNIQUE,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "notified_at" timestamp with time zone
      );
    `;
  
    await sql`
      CREATE TABLE IF NOT EXISTS "endorsements" (
        "id" text PRIMARY KEY NOT NULL,
        "report_id" text NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
        "expert_user_id" text NOT NULL REFERENCES "users"("id"),
        "severity_level" integer NOT NULL,
        "note" text,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "endorsements_report_idx" ON "endorsements" ("report_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "endorsements_expert_idx" ON "endorsements" ("expert_user_id");`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "endorsements_report_expert_unique" ON "endorsements" ("report_id", "expert_user_id");`;
  
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_notifications" boolean DEFAULT true NOT NULL;`;
    await sql`UPDATE "users" SET "email_notifications" = true WHERE "email_notifications" IS NULL;`;
  
      //Share view tracking
    await sql`
      CREATE TABLE IF NOT EXISTS "share_view_events" (
        "id" text PRIMARY KEY NOT NULL,
        "token_id" text NOT NULL REFERENCES "analytics_share_tokens"("id") ON DELETE CASCADE,
        "viewed_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "referrer" text,
        "user_agent_hash" text
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "share_view_token_idx" ON "share_view_events" ("token_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "share_view_viewed_at_idx" ON "share_view_events" ("viewed_at");`;

    // Server-side sessions (cookie carries a random token; we store its hash)
    await sql`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "expires_at" timestamp with time zone NOT NULL,
        "last_seen_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" ("expires_at");`;

    await sql`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "metadata_json" text;`;
    await sql`ALTER TABLE "endorsements" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;`;

    // Rate limiting counters
    await sql`
      CREATE TABLE IF NOT EXISTS "rate_limits" (
        "key" text PRIMARY KEY NOT NULL,
        "window_start" timestamp with time zone NOT NULL,
        "count" integer DEFAULT 0 NOT NULL
      );
    `;
  });
}
