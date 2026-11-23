import { isAuthError, requireAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createShare, listShares, revokeShare, type ShareViewer } from '@/lib/analytics-shares';
import { serverError } from '@/lib/http';

/** Admin view of share links: every active link, from anyone. */
async function viewer(): Promise<ShareViewer | NextResponse> {
  const user = await requireAdmin();
  if (isAuthError(user)) return user;
  return { id: user.id, isAdmin: true };
}

export async function GET() {
  try {
    const v = await viewer();
    if (v instanceof NextResponse) return v;
    return await listShares(v);
  } catch (error: unknown) {
    return serverError(error, 'admin/analytics/shares GET');
  }
}

export async function POST(request: Request) {
  try {
    const v = await viewer();
    if (v instanceof NextResponse) return v;
    return await createShare(request, v);
  } catch (error: unknown) {
    return serverError(error, 'admin/analytics/shares POST');
  }
}

export async function DELETE(request: Request) {
  try {
    const v = await viewer();
    if (v instanceof NextResponse) return v;
    return await revokeShare(request, v);
  } catch (error: unknown) {
    return serverError(error, 'admin/analytics/shares DELETE');
  }
}
