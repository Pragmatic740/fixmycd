import { isAdmin, isAuthError, requireUser } from '@/lib/auth';
import { analyticsEndpointResponse } from '@/lib/analytics-endpoint';
import { serverError } from '@/lib/http';

/**
 * Analytics for every signed-in user. Admins get the full data; everyone else gets
 * the same charts without reporter ids, emails or per-person breakdowns.
 */
export async function GET(request: Request, { params }: { params: Promise<{ endpoint: string }> }) {
  try {
    const user = await requireUser();
    if (isAuthError(user)) return user;
    const { endpoint } = await params;
    return await analyticsEndpointResponse(request, endpoint, { isAdmin: isAdmin(user.role) });
  } catch (error: unknown) {
    return serverError(error, 'analytics/[endpoint]');
  }
}
