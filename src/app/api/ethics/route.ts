import { NextResponse } from 'next/server';
import { getCurrentEthics } from '@/lib/ethics';
import { serverError } from '@/lib/http';

/** The current Code of Ethics (public). */
export async function GET() {
  try {
    return NextResponse.json(await getCurrentEthics());
  } catch (error: unknown) {
    return serverError(error, 'ethics GET');
  }
}
