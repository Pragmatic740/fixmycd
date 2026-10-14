import { cookieJar } from './cookie-jar';

// Route handlers declare their own params shape; any handler is callable here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (request: Request, ctx: { params: Promise<any> }) => Promise<Response> | Response;

export type CallOptions = {
  method?: string;
  path?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  rawBody?: BodyInit;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  ip?: string;
};

export type CallResult = {
  status: number;
  headers: Headers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertions read arbitrary JSON
  json: any;
  text: string;
  bytes: Uint8Array;
};

/**
 * Invoke a Next.js route handler the way the framework would, with the shared
 * cookie jar acting as the browser's cookies.
 */
export async function call(handler: Handler, opts: CallOptions = {}): Promise<CallResult> {
  const url = new URL(opts.path ?? '/api/test', 'http://localhost:3000');
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const headers = new Headers(opts.headers);
  headers.set('x-forwarded-for', opts.ip ?? '203.0.113.10');
  let body: BodyInit | undefined = opts.rawBody;
  if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  }
  const cookieHeader = cookieJar
    .store()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  if (cookieHeader) headers.set('cookie', cookieHeader);
  cookieJar.setRequestHeaders(headers);

  const request = new Request(url, { method: opts.method ?? 'GET', headers, body });
  const response = await handler(request, { params: Promise.resolve(opts.params ?? {}) });

  const buf = new Uint8Array(await response.arrayBuffer());
  const text = new TextDecoder().decode(buf);
  let json: unknown = undefined;
  if ((response.headers.get('content-type') ?? '').includes('json')) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  return { status: response.status, headers: response.headers, json, text, bytes: buf };
}
