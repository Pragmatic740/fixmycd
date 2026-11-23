import { isAdmin, isAuthError, requireUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createShare, listShares, revokeShare, type ShareViewer } from '@/lib/analytics-shares';
import { serverError } from '@/lib/http';

/** Share links for any signed-in user: their own links (admins: all links). */
async function viewer(): Promise<ShareViewer | NextResponse> {
  const user = await requireUser();
  if (isAuthError(user)) return user;
  return { id: user.id, isAdmin: isAdmin(user.role) };
}

export async function GET() {
  try {
    const v = await viewer();
    if (v instanceof NextResponse) return v;
    return await listShares(v);
  } catch (error: unknown) {
    return serverError(error, 'analytics/shares GET');
  }
}

export async function POST(request: Request) {
  try {
    const v = await viewer();
    if (v instanceof NextResponse) return v;
    return await createShare(request, v);
  } catch (error: unknown) {
    return serverError(error, 'analytics/shares POST');
  }
}

export async function DELETE(request: Request) {
  try {
    const v = await viewer();
    if (v instanceof NextResponse) return v;
    return await revokeShare(request, v);
  } catch (error: unknown) {
    return serverError(error, 'analytics/shares DELETE');
  }
}
