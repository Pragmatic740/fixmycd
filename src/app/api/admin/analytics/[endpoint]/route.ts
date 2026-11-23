import { isAuthError, requireAdmin } from '@/lib/auth';
import { analyticsEndpointResponse } from '@/lib/analytics-endpoint';
import { serverError } from '@/lib/http';

export async function GET(request: Request, { params }: { params: Promise<{ endpoint: string }> }) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;
    const { endpoint } = await params;
    return await analyticsEndpointResponse(request, endpoint, { isAdmin: true });
  } catch (error: unknown) {
    return serverError(error, 'admin/analytics/[endpoint]');
  }
}
