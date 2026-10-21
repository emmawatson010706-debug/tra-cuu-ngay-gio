// Máy chủ thử nghiệm trên máy tính (không cần Vercel): node tests/dev-server.js
// Phục vụ tệp tĩnh + các hàm /api, dùng Redis giả lập trong bộ nhớ.
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = Number(process.env.PORT || 5173);
const ROOT = path.join(__dirname, '..');

// Redis giả lập (chỉ các lệnh ứng dụng dùng)
const mem = new Map(), sets = new Map(), exp = new Map();
function alive(k) { if (exp.has(k) && exp.get(k) < Date.now()) { mem.delete(k); exp.delete(k); } return mem.has(k); }
function runRedis(cmd) {
  const [op, k, ...a] = cmd; const o = String(op).toUpperCase();
  if (o === 'SET') {
    const nx = a.includes('NX'), exI = a.indexOf('EX');
    if (nx && alive(k)) return null;
    mem.set(k, a[0]); if (exI >= 0) exp.set(k, Date.now() + Number(a[exI + 1]) * 1000);
    return 'OK';
  }
  if (o === 'GET') return alive(k) ? mem.get(k) : null;
  if (o === 'DEL') { const had = mem.delete(k); return had ? 1 : 0; }
  if (o === 'SADD') { if (!sets.has(k)) sets.set(k, new Set()); sets.get(k).add(a[0]); return 1; }
  if (o === 'SREM') { sets.has(k) && sets.get(k).delete(a[0]); return 1; }
  if (o === 'SMEMBERS') return [...(sets.get(k) || [])];
  throw new Error('Lệnh chưa hỗ trợ: ' + o);
}

process.env.KV_REST_API_URL = process.env.KV_REST_API_URL || `http://127.0.0.1:${PORT}/__redis`;
process.env.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || 'thu-nghiem';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', async () => {
    const url = new URL(req.url, 'http://x');
    const raw = Buffer.concat(chunks).toString();
    if (url.pathname === '/__redis') {
      try { const r = runRedis(JSON.parse(raw)); res.end(JSON.stringify({ result: r })); }
      catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z-]/g, '');
      const file = path.join(ROOT, 'api', name + '.js');
      if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('{}'); }
      try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = {}; }
      try { await require(file)(req, res); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
      return;
    }
    let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, path.normalize(p));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('Không tìm thấy'); }
    res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
    if (p === '/sw.js') res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(f).pipe(res);
  });
});
server.listen(PORT, () => console.log('Đang chạy: http://localhost:' + PORT));
module.exports = server;
