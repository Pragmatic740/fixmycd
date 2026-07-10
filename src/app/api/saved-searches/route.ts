import { NextResponse } from 'next/server';
import { db } from '../../../db';
import { savedSearches } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { getSessionUser } from '../../../lib/auth';

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, sessionUser.id));

    return NextResponse.json(rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch saved searches';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, queryJson } = await request.json();
    if (!name || !queryJson) {
      return NextResponse.json({ error: 'name and queryJson required' }, { status: 400 });
    }

    const row = await db.insert(savedSearches).values({
      id: crypto.randomUUID(),
      userId: sessionUser.id,
      name,
      queryJson: typeof queryJson === 'string' ? queryJson : JSON.stringify(queryJson),
      createdAt: new Date(),
    }).returning();

    return NextResponse.json(row[0], { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save search';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();
    await db
      .delete(savedSearches)
      .where(eq(savedSearches.id, id));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete search';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
