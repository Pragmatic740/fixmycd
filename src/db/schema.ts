import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('viewer'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  referenceNo: text('reference_no').unique().notNull(),
  submitterId: text('submitter_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  severity: integer('severity'),
  status: text('status').notNull().default('submitted'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
