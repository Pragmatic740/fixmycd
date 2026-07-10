import { NextResponse } from 'next/server';
import { db } from '../../../db';
import { follows } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { getSessionUser } from '../../../lib/auth';

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await db.select().from(follows).where(eq(follows.userId, sessionUser.id));
    return NextResponse.json(rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch follows';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { followType, targetId } = await request.json();
    if (!followType || !targetId) {
      return NextResponse.json({ error: 'followType and targetId required' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.userId, sessionUser.id),
          eq(follows.followType, followType),
          eq(follows.targetId, targetId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ following: true });
    }

    await db.insert(follows).values({
      id: crypto.randomUUID(),
      userId: sessionUser.id,
      followType,
      targetId,
      createdAt: new Date(),
    });

    return NextResponse.json({ following: true }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to follow';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { followType, targetId } = await request.json();

    await db
      .delete(follows)
      .where(
        and(
          eq(follows.userId, sessionUser.id),
          eq(follows.followType, followType),
          eq(follows.targetId, targetId)
        )
      );

    return NextResponse.json({ following: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to unfollow';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
