import type { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
// Next route handlers relay long-polling. Caddy routes this path directly to
// Nest in HTTPS deployments, including WebSocket upgrades; polling remains a fallback.
async function relay(request: NextRequest) {
  const url = new URL(
    '/socket.io/',
    process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000',
  );
  url.search = request.nextUrl.search;
  const headers = new Headers();
  for (const key of ['cookie', 'origin', 'content-type', 'sec-fetch-site']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (
    !headers.has('origin') &&
    request.headers.get('sec-fetch-site') === 'same-origin' &&
    request.headers.get('host')
  )
    headers.set(
      'origin',
      request.nextUrl.protocol + '//' + request.headers.get('host'),
    );
  try {
    let body: Uint8Array | undefined;
    if (request.method === 'POST') {
      const reader = request.body?.getReader(),
        chunks: Uint8Array[] = [];
      let total = 0;
      if (reader)
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          total += chunk.value.byteLength;
          if (total > 4096) {
            await reader.cancel();
            return new Response(null, { status: 413 });
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
    const result = await fetch(url, {
      method: request.method,
      headers,
      ...(body ? { body: body as BodyInit } : {}),
      signal: AbortSignal.timeout(30000),
      cache: 'no-store',
      redirect: 'manual',
    });
    return new Response(result.body, {
      status: result.status,
      headers: {
        'Content-Type': result.headers.get('content-type') || 'text/plain',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Realtime unavailable', { status: 503 });
  }
}
export { relay as GET, relay as POST };
