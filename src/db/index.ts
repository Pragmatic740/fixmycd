import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || '';

// For serverless/pooled environments (like Vercel/Neon), prepare: false is recommended
export const dbClient = postgres(connectionString, { prepare: false, onnotice: () => {} });
export const db = drizzle(dbClient, { schema });
