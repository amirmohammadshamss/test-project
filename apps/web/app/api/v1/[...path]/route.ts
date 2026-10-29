import type { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (path[0]?.toLowerCase() === 'platform')
    return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  if (path.some((segment) => !/^[a-zA-Z0-9_-]+$/.test(segment)))
    return Response.json({ error: { code: 'INVALID_PATH' } }, { status: 400 });
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  const destination = new URL(
    '/api/v1/' + path.map(encodeURIComponent).join('/'),
    base,
  );
  destination.search = request.nextUrl.search;
  const headers = new Headers(request.headers);
  for (const name of [
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'accept-encoding',
  ])
    headers.delete(name);
  let body: Uint8Array | undefined;
  if (!['GET', 'HEAD'].includes(request.method) && request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > 65536) {
        await reader.cancel();
        return Response.json(
          { error: { code: 'PAYLOAD_TOO_LARGE' } },
          { status: 413 },
        );
      }
      chunks.push(chunk.value);
    }
    body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
  }
  try {
    const response = await fetch(destination, {
      method: request.method,
      headers,
      body: body as BodyInit | undefined,
      signal: AbortSignal.timeout(30000),
      redirect: 'manual',
      cache: 'no-store',
    });
    const outputHeaders = new Headers(response.headers);
    for (const name of [
      'connection',
      'transfer-encoding',
      'content-encoding',
      'content-length',
    ])
      outputHeaders.delete(name);
    return new Response(response.body, {
      status: response.status,
      headers: outputHeaders,
    });
  } catch {
    return Response.json(
      {
        error: {
          code: 'BACKEND_UNAVAILABLE',
          message: 'The server is temporarily unavailable.',
        },
      },
      { status: 503 },
    );
  }
}
export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
};
