import { pgTable, text, real, integer, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  displayName: text('display_name'),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('viewer'),
  bio: text('bio'),
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
  postAction: text('post_action').default('failure'),
  postType: text('post_type').default('new'),
  parentReportId: text('parent_report_id'),
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  audioUrl: text('audio_url'),
  compassDirection: real('compass_direction'),
  aiSummary: text('ai_summary'),
  reviewNote: text('review_note'),
  isHidden: boolean('is_hidden').notNull().default(false),
  featured: boolean('featured').notNull().default(false),
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
