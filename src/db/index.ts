import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || '';

// For serverless/pooled environments (like Vercel/Neon), prepare: false is recommended
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
