import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { clientIp, parseJsonBody, serverError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { signupSchema } from '@/lib/validation';
import { PASSWORD_HASH_COST } from '@/lib/auth';

const PENDING_MESSAGE =
  'Thanks for signing up! An admin will review your account and you will be able to log in once it is approved.';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit('signup', clientIp(request));
    if (limited) return limited;

    const parsed = await parseJsonBody(request, signupSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password, displayName } = parsed.data;

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    // Same response whether or not the address is already registered, so the
    // signup form cannot be used to discover who has an account.
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_COST);
      await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          email,
          displayName,
          passwordHash,
          role: 'submitter',
          status: 'pending',
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    }

    return NextResponse.json({ success: true, pending: true, message: PENDING_MESSAGE }, { status: 201 });
  } catch (error: unknown) {
    return serverError(error, 'auth/signup');
  }
}
