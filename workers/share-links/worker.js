const TTL_SECONDS = 60 * 60 * 24 * 30;

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function isValidPayload(payload) {
  return payload && payload.v === 1 && Array.isArray(payload.p) && Array.isArray(payload.slots);
}

function createShareId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function createToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const url = new URL(request.url);

    // POST /shares — create, returns { id, token }
    if (request.method === 'POST' && url.pathname === '/shares') {
      let body = null;
      try { body = await request.json(); } catch {
        return json({ error: 'Invalid JSON body' }, 400, env);
      }
      if (!isValidPayload(body?.data)) return json({ error: 'Invalid share payload' }, 400, env);

      const id = createShareId();
      const token = createToken();
      await env.SHARES.put(id, JSON.stringify({ data: body.data, token, createdAt: new Date().toISOString() }), { expirationTtl: TTL_SECONDS });
      return json({ id, token, expiresIn: TTL_SECONDS }, 201, env);
    }

    // PUT /shares/:id — update (token required in body)
    if (request.method === 'PUT' && url.pathname.startsWith('/shares/')) {
      const id = url.pathname.slice('/shares/'.length);
      if (!id) return json({ error: 'Missing share id' }, 400, env);

      let body = null;
      try { body = await request.json(); } catch {
        return json({ error: 'Invalid JSON body' }, 400, env);
      }
      if (!body?.token) return json({ error: 'Missing token' }, 401, env);
      if (!isValidPayload(body?.data)) return json({ error: 'Invalid share payload' }, 400, env);

      const raw = await env.SHARES.get(id);
      if (!raw) return json({ error: 'Share not found' }, 404, env);

      let existing;
      try { existing = JSON.parse(raw); } catch {
        return json({ error: 'Corrupt share data' }, 500, env);
      }
      if (existing.token !== body.token) return json({ error: 'Invalid token' }, 403, env);

      const updatedAt = new Date().toISOString();
      await env.SHARES.put(id, JSON.stringify({ data: body.data, token: existing.token, createdAt: existing.createdAt, updatedAt }), { expirationTtl: TTL_SECONDS });
      return json({ id, updatedAt }, 200, env);
    }

    // GET /shares/:id — read (token never returned)
    if (request.method === 'GET' && url.pathname.startsWith('/shares/')) {
      const id = url.pathname.slice('/shares/'.length);
      if (!id) return json({ error: 'Missing share id' }, 400, env);

      const raw = await env.SHARES.get(id);
      if (!raw) return json({ error: 'Share not found' }, 404, env);

      let stored;
      try { stored = JSON.parse(raw); } catch {
        return json({ error: 'Corrupt share data' }, 500, env);
      }
      return new Response(
        JSON.stringify({ data: stored.data, createdAt: stored.createdAt, updatedAt: stored.updatedAt ?? null }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30', ...corsHeaders(env) } },
      );
    }

    return json({ error: 'Not found' }, 404, env);
  },
};
