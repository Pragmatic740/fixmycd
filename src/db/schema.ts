import {
  pgTable,
  text,
  real,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  displayName: text('display_name'),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('viewer'),
  bio: text('bio'),
  isSynthetic: boolean('is_synthetic').notNull().default(false),
  datasetKey: text('dataset_key'),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable('reports', {
  id: text('id').primaryKey(),
  referenceNo: text('reference_no').unique().notNull(),
  submitterId: text('submitter_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  severity: integer('severity'),
  status: text('status').notNull().default('submitted'),
  category: text('category'),
  subcategory: text('subcategory'),
  infrastructureClass: text('infrastructure_class'),
  infrastructureType: text('infrastructure_type'),
  failureType: text('failure_type'),
  suspectedCause: text('suspected_cause'),
  assetName: text('asset_name'),
  responsibleAgency: text('responsible_agency'),
  isRecurrence: boolean('is_recurrence').notNull().default(false),
  postAction: text('post_action').default('failure'),
  postType: text('post_type').default('new'),
  parentReportId: text('parent_report_id'),
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  audioUrl: text('audio_url'),
  compassDirection: real('compass_direction'),
  evidenceType: text('evidence_type'),
  observationConfidence: integer('observation_confidence'),
  estimatedCostLow: real('estimated_cost_low'),
  estimatedCostHigh: real('estimated_cost_high'),
  actualCost: real('actual_cost'),
  currency: text('currency').default('USD'),
  costEstimateSource: text('cost_estimate_source'),
  costConfidence: integer('cost_confidence'),
  peopleAffected: integer('people_affected'),
  householdsAffected: integer('households_affected'),
  outageDurationHours: real('outage_duration_hours'),
  safetyImpact: boolean('safety_impact').notNull().default(false),
  accessibilityImpact: boolean('accessibility_impact').notNull().default(false),
  environmentalImpact: boolean('environmental_impact').notNull().default(false),
  tags: text('tags'),
  aiSummary: text('ai_summary'),
  reviewNote: text('review_note'),
  isHidden: boolean('is_hidden').notNull().default(false),
  featured: boolean('featured').notNull().default(false),
  isSynthetic: boolean('is_synthetic').notNull().default(false),
  datasetKey: text('dataset_key'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  submitterIdx: index('reports_submitter_idx').on(table.submitterId),
  severityIdx: index('reports_severity_idx').on(table.severity),
  postActionIdx: index('reports_post_action_idx').on(table.postAction),
  infraClassIdx: index('reports_infra_class_idx').on(table.infrastructureClass),
  occurredAtIdx: index('reports_occurred_at_idx').on(table.occurredAt),
  datasetIdx: index('reports_dataset_idx').on(table.datasetKey),
}));

export const reportLocations = pgTable('report_locations', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => reports.id).unique(),
  addressLine: text('address_line'),
  city: text('city'),
  postalCode: text('postal_code'),
  county: text('county'),
  stateProvince: text('state_province'),
  countryCode: text('country_code').notNull().default('US'),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  geocodeStatus: text('geocode_status').notNull().default('pending'),
  geocodeSource: text('geocode_source'),
  geocodeConfidence: real('geocode_confidence'),
  censusRegion: text('census_region'),
  censusDivision: text('census_division'),
  stateFips: text('state_fips'),
  countyFips: text('county_fips'),
  tractGeoid: text('tract_geoid'),
  blockGroupGeoid: text('block_group_geoid'),
  congressionalDistrict: text('congressional_district'),
  stateSenateDistrict: text('state_senate_district'),
  stateHouseDistrict: text('state_house_district'),
  schoolDistrict: text('school_district'),
  metroArea: text('metro_area'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  cityIdx: index('report_locations_city_idx').on(table.city),
  stateIdx: index('report_locations_state_idx').on(table.stateProvince),
  zipIdx: index('report_locations_zip_idx').on(table.postalCode),
  countyIdx: index('report_locations_county_idx').on(table.county),
  tractIdx: index('report_locations_tract_idx').on(table.tractGeoid),
  countryIdx: index('report_locations_country_idx').on(table.countryCode),
}));

export const geographicAreas = pgTable('geographic_areas', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  code: text('code'),
  parentId: text('parent_id'),
  countryCode: text('country_code').notNull().default('US'),
  source: text('source'),
  vintage: text('vintage'),
  metadataJson: text('metadata_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  typeCodeIdx: uniqueIndex('geographic_areas_type_code_unique').on(table.type, table.code, table.countryCode),
  typeIdx: index('geographic_areas_type_idx').on(table.type),
}));

export const reportGeographicAreas = pgTable('report_geographic_areas', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => reports.id),
  geographicAreaId: text('geographic_area_id').notNull().references(() => geographicAreas.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reportAreaUnique: uniqueIndex('report_geo_areas_unique').on(table.reportId, table.geographicAreaId),
  reportIdx: index('report_geo_areas_report_idx').on(table.reportId),
  areaIdx: index('report_geo_areas_area_idx').on(table.geographicAreaId),
}));

export const serviceAreas = pgTable('service_areas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  provider: text('provider'),
  countryCode: text('country_code').notNull().default('US'),
  stateProvince: text('state_province'),
  geometryJson: text('geometry_json'),
  metadataJson: text('metadata_json'),
  isSynthetic: boolean('is_synthetic').notNull().default(false),
  datasetKey: text('dataset_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reportServiceAreas = pgTable('report_service_areas', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => reports.id),
  serviceAreaId: text('service_area_id').notNull().references(() => serviceAreas.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reportServiceUnique: uniqueIndex('report_service_areas_unique').on(table.reportId, table.serviceAreaId),
}));

export const reportStatusHistory = pgTable('report_status_history', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => reports.id),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedBy: text('changed_by').references(() => users.id),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reportIdx: index('report_status_history_report_idx').on(table.reportId),
}));

export const adminAuditLog = pgTable('admin_audit_log', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  detailsJson: text('details_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const upvotes = pgTable('upvotes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  reportId: text('report_id').notNull().references(() => reports.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userReportUnique: uniqueIndex('upvotes_user_report_unique').on(table.userId, table.reportId),
}));

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => reports.id),
  userId: text('user_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  isHidden: boolean('is_hidden').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  actorId: text('actor_id').references(() => users.id),
  reportId: text('report_id').references(() => reports.id),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const flags = pgTable('flags', {
  id: text('id').primaryKey(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  reporterId: text('reporter_id').notNull().references(() => users.id),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const follows = pgTable('follows', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  followType: text('follow_type').notNull(),
  targetId: text('target_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const savedSearches = pgTable('saved_searches', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  queryJson: text('query_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsSavedViews = pgTable('analytics_saved_views', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  filtersJson: text('filters_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerNameUnique: uniqueIndex('analytics_saved_views_owner_name').on(table.ownerId, table.name),
  ownerIdx: index('analytics_saved_views_owner_idx').on(table.ownerId),
}));

export const analyticsShareTokens = pgTable('analytics_share_tokens', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  createdBy: text('created_by').notNull().references(() => users.id),
  savedViewId: text('saved_view_id').references(() => analyticsSavedViews.id),
  filtersJson: text('filters_json').notNull(),
  label: text('label'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index('analytics_share_tokens_token_idx').on(table.token),
}));
