import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthError, requireAdmin } from '@/lib/auth';
import { publishEthics } from '@/lib/ethics';
import { MAX_ETHICS_LENGTH } from '@/lib/ethics-text';
import { parseJsonBody, serverError } from '@/lib/http';

const publishSchema = z.object({
  body: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(50, 'The code needs at least a few sentences').max(MAX_ETHICS_LENGTH)),
});

/** Publish a new version of the Code of Ethics (admins). */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;
    const parsed = await parseJsonBody(request, publishSchema);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(await publishEthics(parsed.data.body, admin.id), { status: 201 });
  } catch (error: unknown) {
    return serverError(error, 'admin/ethics POST');
  }
}
