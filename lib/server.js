// Tiện ích dùng chung cho các hàm máy chủ (Vercel Functions)
const crypto = require('crypto');
const webpush = require('web-push');

// Hỗ trợ cả tên biến của Upstash qua Vercel Marketplace (KV_*) và tên gốc (UPSTASH_*)
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const VAPID_PUBLIC = (process.env.VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE = (process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT || 'mailto:lienhe@example.com').trim();

let vapidReady = false;
function setupVapid() {
  if (vapidReady) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidReady = true;
  return true;
}

function config() {
  const missing = [];
  if (!VAPID_PUBLIC) missing.push('VAPID_PUBLIC_KEY');
  if (!VAPID_PRIVATE) missing.push('VAPID_PRIVATE_KEY');
  if (!REDIS_URL || !REDIS_TOKEN) missing.push('Upstash Redis (KV_REST_API_URL, KV_REST_API_TOKEN)');
  return { ok: missing.length === 0, missing, publicKey: VAPID_PUBLIC };
}

async function redis(...cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Redis: ' + (j.error || r.status));
  return j.result;
}

const ALLOWED_PUSH_HOST = /(^|\.)fcm\.googleapis\.com$|(^|\.)push\.apple\.com$|(^|\.)push\.services\.mozilla\.com$|(^|\.)notify\.windows\.com$|(^|\.)push\.android\.com$/i;
function validEndpoint(ep) {
  if (typeof ep !== 'string' || ep.length > 1000) return false;
  try {
    const u = new URL(ep);
    return u.protocol === 'https:' && ALLOWED_PUSH_HOST.test(u.hostname);
  } catch (e) { return false; }
}
function subKey(endpoint) { return 'sub:' + crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 40); }

function str(v, max) { return String(v == null ? '' : v).slice(0, max); }
function cleanPerson(p) {
  if (!p || typeof p !== 'object') return null;
  const day = Number(p.day), month = Number(p.month);
  if (!(day >= 1 && day <= 30 && month >= 1 && month <= 12)) return null;
  const name = str(p.name, 80).trim();
  if (!name) return null;
  return {
    id: str(p.id, 64), name, title: str(p.title, 40), customTitle: str(p.customTitle, 40),
    day, month, leap: !!p.leap,
    leapRule: p.leapRule === 'leap' ? 'leap' : 'regular',
    missingRule: p.missingRule === 'next' ? 'next' : 'last'
  };
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function pushTo(sub, payload) {
  setupVapid();
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: sub.keys },
    JSON.stringify(payload),
    { TTL: 2 * 24 * 3600, urgency: 'high' }
  );
}

module.exports = { config, redis, validEndpoint, subKey, cleanPerson, readBody, send, pushTo, setupVapid };
