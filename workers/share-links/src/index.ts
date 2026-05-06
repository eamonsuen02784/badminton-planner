export interface Env {
  SHARES: KVNamespace;
  ALLOWED_ORIGIN?: string;
}

interface SharePayload {
  v: 1;
  p: Array<[string, string]>;
  cfg?: { g?: number; c?: number };
  scores?: Record<string, { a: string; b: string }>;
  slots: Array<{
    s: number;
    c: number[][][];
    sit: number[];
  }>;
}

const TTL_SECONDS = 60 * 60 * 24 * 30;

function corsHeaders(env: Env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body: unknown, status: number, env: Env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env),
    },
  });
}

function isValidPayload(payload: SharePayload | null | undefined) {
  return payload && payload.v === 1 && Array.isArray(payload.p) && Array.isArray(payload.slots);
}

function createShareId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/shares') {
      let body: { data?: SharePayload } | null = null;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400, env);
      }

      if (!isValidPayload(body?.data)) {
        return json({ error: 'Invalid share payload' }, 400, env);
      }

      const id = createShareId();
      await env.SHARES.put(
        id,
        JSON.stringify({
          data: body.data,
          createdAt: new Date().toISOString(),
        }),
        { expirationTtl: TTL_SECONDS },
      );

      return json({ id, expiresIn: TTL_SECONDS }, 201, env);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/shares/')) {
      const id = url.pathname.slice('/shares/'.length);
      if (!id) return json({ error: 'Missing share id' }, 400, env);

      const raw = await env.SHARES.get(id);
      if (!raw) return json({ error: 'Share not found' }, 404, env);

      return new Response(raw, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
          ...corsHeaders(env),
        },
      });
    }

    return json({ error: 'Not found' }, 404, env);
  },
};
