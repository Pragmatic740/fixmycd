import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsShareTokens } from '@/db/schema';
import { isAuthError, requireAdmin } from '@/lib/auth';
import { filtersForPersist } from '@/lib/analytics';

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const rows = await db
      .select()
      .from(analyticsShareTokens)
      .where(and(eq(analyticsShareTokens.createdBy, admin.id), isNull(analyticsShareTokens.revokedAt)))
      .orderBy(desc(analyticsShareTokens.createdAt));

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        token: r.token,
        label: r.label,
        urlPath: `/v/${r.token}`,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() ?? null,
      }))
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list shares';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const body = await request.json();
    if (!body.filters || typeof body.filters !== 'object') {
      return NextResponse.json({ error: 'filters required' }, { status: 400 });
    }
    const filters = filtersForPersist(body.filters);

    const id = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString('base64url');
    const now = new Date();

    await db.insert(analyticsShareTokens).values({
      id,
      token,
      createdBy: admin.id,
      savedViewId: body.savedViewId || null,
      filtersJson: JSON.stringify(filters),
      label: body.label ? String(body.label).trim() : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      createdAt: now,
    });

    return NextResponse.json(
      {
        id,
        token,
        label: body.label || null,
        urlPath: `/v/${token}`,
        createdAt: now.toISOString(),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create share';
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

    const updated = await db
      .update(analyticsShareTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(analyticsShareTokens.id, id), eq(analyticsShareTokens.createdBy, admin.id)))
      .returning();

    if (!updated[0]) return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to revoke share';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
