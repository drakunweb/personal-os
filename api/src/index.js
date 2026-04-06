/**
 * Personal OS — Cloudflare Worker API
 *
 * Endpoints:
 *   GET    /data              全データ取得
 *   PUT    /data              全データ上書き
 *   PATCH  /data              部分マージ更新
 *   GET    /data/:section     セクション取得
 *   PUT    /data/:section     セクション更新
 *   DELETE /data/:section     セクション削除
 *   POST   /data/event        イベント追記（配列への追加）
 *   GET    /health            ヘルスチェック
 *
 * Auth: X-API-Key ヘッダー または ?key= クエリパラメータ
 */

const KV_KEY = 'personal_os_v1';

// ─── CORS headers ──────────────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200, origin) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

function error(msg, status = 400, origin) {
  return json({ error: msg, status }, status, origin);
}

// ─── Auth check ────────────────────────────────────────────────────────────
function isAuthorized(request, env) {
  const key =
    request.headers.get('X-API-Key') ||
    new URL(request.url).searchParams.get('key');
  return key === env.API_KEY;
}

// ─── Deep merge ────────────────────────────────────────────────────────────
function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

// ─── Main handler ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const method = request.method.toUpperCase();

    // Preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Health check (no auth)
    if (url.pathname === '/health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() }, 200, origin);
    }

    // Auth
    if (!isAuthorized(request, env)) {
      return error('Unauthorized. Provide X-API-Key header or ?key= param.', 401, origin);
    }

    const path = url.pathname.replace(/\/$/, '');

    // ── GET /data ──────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/data') {
      const raw = await env.KV.get(KV_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return json({ ok: true, data, updated_at: data._updated_at || null }, 200, origin);
    }

    // ── GET /data/:section ────────────────────────────────────────────────
    if (method === 'GET' && path.startsWith('/data/')) {
      const section = path.slice(6); // after /data/
      const raw = await env.KV.get(KV_KEY);
      const data = raw ? JSON.parse(raw) : {};
      if (!(section in data)) {
        return error(`Section "${section}" not found`, 404, origin);
      }
      return json({ ok: true, section, data: data[section] }, 200, origin);
    }

    // ── PUT /data ──────────────────────────────────────────────────────────
    if (method === 'PUT' && path === '/data') {
      let body;
      try { body = await request.json(); } catch { return error('Invalid JSON', 400, origin); }
      body._updated_at = new Date().toISOString();
      await env.KV.put(KV_KEY, JSON.stringify(body));
      return json({ ok: true, message: 'Data replaced', updated_at: body._updated_at }, 200, origin);
    }

    // ── PATCH /data ─────────────────────────────────────────────────────
    if (method === 'PATCH' && path === '/data') {
      let body;
      try { body = await request.json(); } catch { return error('Invalid JSON', 400, origin); }
      const raw = await env.KV.get(KV_KEY);
      const existing = raw ? JSON.parse(raw) : {};
      const merged = deepMerge(existing, body);
      merged._updated_at = new Date().toISOString();
      await env.KV.put(KV_KEY, JSON.stringify(merged));
      return json({ ok: true, message: 'Data merged', updated_at: merged._updated_at }, 200, origin);
    }

    // ── PUT /data/:section ────────────────────────────────────────────────
    if (method === 'PUT' && path.startsWith('/data/')) {
      const section = path.slice(6);
      let body;
      try { body = await request.json(); } catch { return error('Invalid JSON', 400, origin); }
      const raw = await env.KV.get(KV_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data[section] = body;
      data._updated_at = new Date().toISOString();
      await env.KV.put(KV_KEY, JSON.stringify(data));
      return json({ ok: true, section, message: `Section "${section}" updated`, updated_at: data._updated_at }, 200, origin);
    }

    // ── DELETE /data/:section ─────────────────────────────────────────────
    if (method === 'DELETE' && path.startsWith('/data/')) {
      const section = path.slice(6);
      const raw = await env.KV.get(KV_KEY);
      const data = raw ? JSON.parse(raw) : {};
      delete data[section];
      data._updated_at = new Date().toISOString();
      await env.KV.put(KV_KEY, JSON.stringify(data));
      return json({ ok: true, message: `Section "${section}" deleted` }, 200, origin);
    }

    // ── POST /data/event ──────────────────────────────────────────────────
    // AIエージェントなどからのイベント追記用
    if (method === 'POST' && path === '/data/event') {
      let body;
      try { body = await request.json(); } catch { return error('Invalid JSON', 400, origin); }
      const { section, item } = body;
      if (!section || !item) return error('section and item are required', 400, origin);
      const raw = await env.KV.get(KV_KEY);
      const data = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(data[section])) data[section] = [];
      item._id = Date.now();
      item._created_at = new Date().toISOString();
      data[section].unshift(item);
      data._updated_at = new Date().toISOString();
      await env.KV.put(KV_KEY, JSON.stringify(data));
      return json({ ok: true, section, item }, 201, origin);
    }

    return error('Not found', 404, origin);
  },
};
