import { cookies } from 'next/headers';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('session_user_id')?.value ?? null;
}

export async function getSessionUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userList[0];
  if (!user || user.disabledAt) return null;
  return user;
}

export function isModerator(role: string) {
  return role === 'referee' || role === 'admin';
}
