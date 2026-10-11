import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';
import { clientIp, parseJsonBody, serverError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/validation';

// Compared against when the email is unknown so response time doesn't reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const invalidCredentials = () =>
  NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

export async function POST(request: Request) {
  try {
    const limitedByIp = await enforceRateLimit('loginByIp', clientIp(request));
    if (limitedByIp) return limitedByIp;

    const parsed = await parseJsonBody(request, loginSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const limitedByAccount = await enforceRateLimit('loginByAccount', email);
    if (limitedByAccount) return limitedByAccount;

    // Case-insensitive so accounts created before email normalization still match.
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        status: users.status,
        passwordHash: users.passwordHash,
        disabledAt: users.disabledAt,
      })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !passwordOk) return invalidCredentials();

    // Account state is only revealed to someone who knows the password.
    if (user.disabledAt) {
      return NextResponse.json({ error: 'Account has been disabled' }, { status: 403 });
    }
    if (user.status === 'pending') {
      return NextResponse.json(
        { error: 'Your account is pending approval. Please wait for admin approval.' },
        { status: 403 }
      );
    }
    if (user.status !== 'approved') {
      return NextResponse.json(
        { error: 'Your account was not approved. Please contact support.' },
        { status: 403 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    });
  } catch (error: unknown) {
    return serverError(error, 'auth/login');
  }
}
