import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSessionUserId } from '../../../lib/auth';

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 });
    }

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`reports/${userId}/${Date.now()}-${file.name}`, file, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return NextResponse.json({ url: blob.url });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mime = file.type || 'application/octet-stream';
    const dataUrl = `data:${mime};base64,${base64}`;

    if (dataUrl.length > 2_000_000) {
      return NextResponse.json(
        { error: 'File too large for local storage. Set BLOB_READ_WRITE_TOKEN for cloud uploads.' },
        { status: 413 }
      );
    }

    return NextResponse.json({ url: dataUrl, fallback: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
