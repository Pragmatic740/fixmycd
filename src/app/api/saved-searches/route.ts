import { NextResponse } from 'next/server';
import { db } from '../../../db';
import { savedSearches } from '../../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { getSessionUser } from '../../../lib/auth';
import { parseJsonBody, serverError } from '../../../lib/http';
import { idBodySchema, savedSearchSchema } from '../../../lib/validation';

const MAX_SAVED_SEARCHES = 50;
const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const rows = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, sessionUser.id));

    return NextResponse.json(rows);
  } catch (error: unknown) {
    return serverError(error, 'saved-searches GET');
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const parsed = await parseJsonBody(request, savedSearchSchema);
    if (!parsed.ok) return parsed.response;
    const { name, queryJson } = parsed.data;

    const [{ count }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(savedSearches)
      .where(eq(savedSearches.userId, sessionUser.id));
    if (count >= MAX_SAVED_SEARCHES) {
      return NextResponse.json({ error: `You can save up to ${MAX_SAVED_SEARCHES} searches` }, { status: 400 });
    }

    const [row] = await db
      .insert(savedSearches)
      .values({
        id: crypto.randomUUID(),
        userId: sessionUser.id,
        name,
        queryJson: typeof queryJson === 'string' ? queryJson : JSON.stringify(queryJson),
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error: unknown) {
    return serverError(error, 'saved-searches POST');
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const parsed = await parseJsonBody(request, idBodySchema);
    if (!parsed.ok) return parsed.response;

    await db
      .delete(savedSearches)
      .where(and(eq(savedSearches.id, parsed.data.id), eq(savedSearches.userId, sessionUser.id)));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return serverError(error, 'saved-searches DELETE');
  }
}
