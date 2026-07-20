import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { users } from '../src/db/schema';

async function main() {
  const email = 'superadmin@fixmydistrict.app';
  const passwordHash = bcrypt.hashSync('password123', 10);
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!existing[0]) {
    await db.insert(users).values({
      id: 'user_superadmin_core',
      email,
      displayName: 'Super Admin',
      passwordHash,
      role: 'super_admin',
      createdAt: new Date(),
    });
    console.log('created', email);
  } else {
    await db.update(users).set({ passwordHash, role: 'super_admin' }).where(eq(users.email, email));
    console.log('updated', email);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
