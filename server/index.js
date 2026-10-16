// MindFlow AI session service: xAI-backed chat sessions, stateless completions, and TTS.
// Secrets come only from env: XAI_API_KEY, APP_KEYS, TTS_SERVICE_TOKEN, DATABASE_URL.
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const PORT = Number(process.env.PORT || 8080);
const XAI = 'https://api.x.ai/v1';
const XAI_KEY = process.env.XAI_API_KEY || '';
const MODEL = process.env.XAI_MODEL || 'grok-4.20-0309-non-reasoning';
const RATE = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const MAX_BODY = 256 * 1024;
// APP_KEYS="mindflow:key1,other:key2"
const APP_KEYS = new Map((process.env.APP_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean).map((p) => { const i = p.indexOf(':'); return [p.slice(i + 1), p.slice(0, i)]; }));
const ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const TTS_TOKEN = process.env.TTS_SERVICE_TOKEN || '';

const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function migrate() {
  if (!pool) throw new Error('DATABASE_URL missing');
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY, app text NOT NULL, system text, model text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS messages (id bigserial PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, role text NOT NULL, content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id, id);`);
}

// ---- rate limit: fixed 60s window per key ----
const buckets = new Map();
function limited(id) {
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || now - b.start > 60000) { buckets.set(id, { start: now, n: 1 }); return false; }
  return ++b.n > RATE;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.start > 60000) buckets.delete(k); }, 60000).unref();

const eq = (a, b) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function cors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGINS.some((pat) => pat === '*' || pat === o || (pat.includes('*') && new RegExp('^' + pat.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9-]+') + '$').test(o)))) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Service-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('body too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(Object.assign(new Error('invalid JSON'), { status: 400 })); } });
    req.on('error', reject);
  });
}

async function xai(path, body) {
  const r = await fetch(XAI + path, { method: 'POST', headers: { Authorization: `Bearer ${XAI_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { const t = (await r.text()).slice(0, 300); throw Object.assign(new Error(`upstream ${r.status}: ${t}`), { status: 502 }); }
  return r;
}

// Pipe an OpenAI-style SSE stream to the client as our own SSE events; returns full text.
async function relayStream(upstream, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const dec = new TextDecoder(); let buf = ''; let text = '';
  for await (const chunk of upstream.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try { const d = JSON.parse(data).choices?.[0]?.delta?.content; if (d) { text += d; res.write(`event: delta\ndata: ${JSON.stringify({ text: d })}\n\n`); } } catch {}
    }
  }
  return text;
}

async function getSession(id, app) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await pool.query('SELECT * FROM sessions WHERE id=$1 AND app=$2', [id, app]);
  return rows[0] || null;
}
const history = async (id) => (await pool.query('SELECT role, content, created_at FROM messages WHERE session_id=$1 ORDER BY id', [id])).rows;

async function chatTurn(res, session, content, stream, extra = {}) {
  const prior = await history(session.id);
  const messages = [...(session.system ? [{ role: 'system', content: session.system }] : []), ...prior.map(({ role, content }) => ({ role, content })), { role: 'user', content }];
  await pool.query('INSERT INTO messages(session_id, role, content) VALUES ($1,$2,$3)', [session.id, 'user', content]);
  const body = { model: session.model, messages, stream: !!stream, ...extra };
  const up = await xai('/chat/completions', body);
  let reply;
  if (stream) {
    reply = await relayStream(up, res);
    await pool.query('INSERT INTO messages(session_id, role, content) VALUES ($1,$2,$3)', [session.id, 'assistant', reply]);
    res.write(`event: done\ndata: ${JSON.stringify({ session_id: session.id, reply })}\n\n`); res.end();
  } else {
    const d = await up.json(); reply = d.choices?.[0]?.message?.content ?? '';
    await pool.query('INSERT INTO messages(session_id, role, content) VALUES ($1,$2,$3)', [session.id, 'assistant', reply]);
    json(res, 200, { session_id: session.id, reply, usage: d.usage });
  }
}

const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (p === '/health') return json(res, 200, { ok: true });

  // ---- TTS: service token ----
  if (p === '/v1/tts' && req.method === 'POST') {
    const tok = req.headers['x-service-token'];
    if (!TTS_TOKEN || typeof tok !== 'string' || !eq(tok, TTS_TOKEN)) return json(res, 401, { error: 'invalid service token' });
    if (limited('tts')) return json(res, 429, { error: 'rate limited' });
    const b = await readBody(req);
    if (!str(b.text, 5000)) return json(res, 400, { error: 'text required (max 5000 chars)' });
    const up = await xai('/tts', { text: b.text, voice_id: typeof b.voice === 'string' ? b.voice : 'eve', language: typeof b.language === 'string' ? b.language : 'en' });
    res.writeHead(200, { 'Content-Type': up.headers.get('content-type') || 'audio/mpeg' });
    for await (const c of up.body) res.write(c);
    return res.end();
  }
  if (p === '/v1/tts/voices' && req.method === 'GET') {
    const tok = req.headers['x-service-token'];
    if (!TTS_TOKEN || typeof tok !== 'string' || !eq(tok, TTS_TOKEN)) return json(res, 401, { error: 'invalid service token' });
    const r = await fetch(XAI + '/tts/voices', { headers: { Authorization: `Bearer ${XAI_KEY}` } });
    return json(res, r.status, await r.json());
  }

  // ---- app-key routes ----
  const key = req.headers['x-api-key'];
  const app = typeof key === 'string' ? APP_KEYS.get(key) : undefined;
  if (!app) return json(res, 401, { error: 'invalid API key' });
  if (limited('app:' + app)) return json(res, 429, { error: 'rate limited' });

  if (p === '/v1/sessions' && req.method === 'POST') {
    const b = await readBody(req);
    const id = crypto.randomUUID();
    const system = typeof b.system === 'string' ? b.system.slice(0, 8000) : null;
    await pool.query('INSERT INTO sessions(id, app, system, model) VALUES ($1,$2,$3,$4)', [id, app, system, MODEL]);
    const s = { id, app, system, model: MODEL };
    if (str(b.message, 20000)) return chatTurn(res, s, b.message, b.stream, b.response_format ? { response_format: b.response_format } : {});
    return json(res, 201, { session_id: id });
  }
  let m = p.match(/^\/v1\/sessions\/([^/]+)(\/messages)?$/);
  if (m) {
    const s = await getSession(m[1], app);
    if (!s) return json(res, 404, { error: 'session not found' });
    if (!m[2] && req.method === 'GET') return json(res, 200, { session_id: s.id, system: s.system, messages: await history(s.id) });
    if (m[2] && req.method === 'POST') {
      const b = await readBody(req);
      if (!str(b.message, 20000)) return json(res, 400, { error: 'message required (max 20000 chars)' });
      return chatTurn(res, s, b.message, b.stream, b.response_format ? { response_format: b.response_format } : {});
    }
  }
  // Stateless OpenAI-compatible pass-through for tool-calling agents.
  if (p === '/v1/complete' && req.method === 'POST') {
    const b = await readBody(req);
    if (!Array.isArray(b.messages) || !b.messages.length) return json(res, 400, { error: 'messages required' });
    const body = { model: MODEL, messages: b.messages, stream: !!b.stream };
    for (const k of ['tools', 'tool_choice', 'response_format', 'temperature', 'max_tokens']) if (b[k] !== undefined) body[k] = b[k];
    const up = await xai('/chat/completions', body);
    if (b.stream) { const reply = await relayStream(up, res); res.write(`event: done\ndata: ${JSON.stringify({ reply })}\n\n`); return res.end(); }
    const d = await up.json();
    return json(res, 200, { message: d.choices?.[0]?.message, finish_reason: d.choices?.[0]?.finish_reason, usage: d.usage });
  }
  return json(res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  try { await route(req, res); }
  catch (e) {
    console.error(`${req.method} ${req.url} -> ${e.status || 500}: ${e.message}`);
    if (!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : 'internal error' }); else res.end();
  }
});

if (!XAI_KEY) console.error('warning: XAI_API_KEY not set');
migrate().then(() => server.listen(PORT, () => console.log(`session service on :${PORT}, model ${MODEL}, ${APP_KEYS.size} app key(s)`)))
  .catch((e) => { console.error('startup failed:', e.message); process.exit(1); });
