import { NextResponse } from 'next/server';
import { fetchTrendingReports } from '../../../lib/reports';
import { serverError } from '@/lib/http';

export async function GET() {
  try {
    const trending = await fetchTrendingReports(5);
    return NextResponse.json(trending);
  } catch (error: unknown) {
    return serverError(error, 'trending');
  }
}
