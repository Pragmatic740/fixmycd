import { createMigratedDatabase } from '../helpers/pg';

export const TEST_DB = 'fixmycd_test';

/** Runs once before all integration files: a fresh, fully migrated database. */
export default async function setup() {
  await createMigratedDatabase(TEST_DB);
}
