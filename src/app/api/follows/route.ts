import { NextResponse } from 'next/server';
import { db } from '../../../db';
import { follows } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { getSessionUser } from '../../../lib/auth';
import { parseJsonBody, serverError } from '../../../lib/http';
import { followSchema } from '../../../lib/validation';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const rows = await db
      .select({ id: follows.id, followType: follows.followType, targetId: follows.targetId, createdAt: follows.createdAt })
      .from(follows)
      .where(eq(follows.userId, sessionUser.id));
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return serverError(error, 'follows GET');
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const parsed = await parseJsonBody(request, followSchema);
    if (!parsed.ok) return parsed.response;
    const { followType, targetId } = parsed.data;

    if (followType === 'user' && targetId === sessionUser.id) {
      return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 });
    }

    const existing = await db
      .select({ id: follows.id })
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
    return serverError(error, 'follows POST');
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const parsed = await parseJsonBody(request, followSchema);
    if (!parsed.ok) return parsed.response;
    const { followType, targetId } = parsed.data;

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
    return serverError(error, 'follows DELETE');
  }
}
