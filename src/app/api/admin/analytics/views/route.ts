import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsSavedViews } from '@/db/schema';
import { isAuthError, requireAdmin } from '@/lib/auth';
import { filtersForPersist } from '@/lib/analytics';

function normalizeDescription(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().slice(0, 40);
  return s === '' ? null : s;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const rows = await db
      .select()
      .from(analyticsSavedViews)
      .where(eq(analyticsSavedViews.ownerId, admin.id))
      .orderBy(desc(analyticsSavedViews.updatedAt));

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        filters: JSON.parse(r.filtersJson),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list views';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const body = await request.json();
    const name = String(body.name || '').trim();
    const description = normalizeDescription(body.description);
    const overwrite = Boolean(body.overwrite);
    if (!name || !body.filters || typeof body.filters !== 'object') {
      return NextResponse.json({ error: 'name and filters are required' }, { status: 400 });
    }
    const filters = filtersForPersist(body.filters);
    const now = new Date();

    if (overwrite) {
      const existing = await db
        .select()
        .from(analyticsSavedViews)
        .where(and(eq(analyticsSavedViews.ownerId, admin.id), eq(analyticsSavedViews.name, name)))
        .limit(1);

      if (existing[0]) {
        const updated = await db
          .update(analyticsSavedViews)
          .set({
            description,
            filtersJson: JSON.stringify(filters),
            updatedAt: now,
          })
          .where(eq(analyticsSavedViews.id, existing[0].id))
          .returning();

        return NextResponse.json({
          id: updated[0].id,
          name: updated[0].name,
          description: updated[0].description,
          filters,
          createdAt: updated[0].createdAt.toISOString(),
          updatedAt: updated[0].updatedAt.toISOString(),
          overwritten: true,
        });
      }
    }

    const id = crypto.randomUUID();
    try {
      await db.insert(analyticsSavedViews).values({
        id,
        ownerId: admin.id,
        name,
        description,
        filtersJson: JSON.stringify(filters),
        createdAt: now,
        updatedAt: now,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save view';
      if (String(message).includes('unique') || String(message).includes('duplicate')) {
        return NextResponse.json({ error: 'A dashboard with that name already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(
      {
        id,
        name,
        description,
        filters,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save view';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const body = await request.json();
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updates: Partial<{
      name: string;
      description: string | null;
      filtersJson: string;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };
    if (body.name != null) updates.name = String(body.name).trim();
    if (body.description !== undefined) updates.description = normalizeDescription(body.description);
    if (body.filters != null) updates.filtersJson = JSON.stringify(filtersForPersist(body.filters));

    const updated = await db
      .update(analyticsSavedViews)
      .set(updates)
      .where(and(eq(analyticsSavedViews.id, id), eq(analyticsSavedViews.ownerId, admin.id)))
      .returning();

    if (!updated[0]) return NextResponse.json({ error: 'View not found' }, { status: 404 });
    return NextResponse.json({
      id: updated[0].id,
      name: updated[0].name,
      description: updated[0].description,
      filters: JSON.parse(updated[0].filtersJson),
      updatedAt: updated[0].updatedAt.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update view';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const deleted = await db
      .delete(analyticsSavedViews)
      .where(and(eq(analyticsSavedViews.id, id), eq(analyticsSavedViews.ownerId, admin.id)))
      .returning();

    if (!deleted[0]) return NextResponse.json({ error: 'View not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete view';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
