import { NextResponse } from 'next/server';
import { db } from '../../../../db';
import { users } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('session_user_id');

    if (!userIdCookie || !userIdCookie.value) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const userList = await db.select().from(users).where(eq(users.id, userIdCookie.value)).limit(1);
    const user = userList[0];

    if (!user || user.disabledAt) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        bio: user.bio,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
