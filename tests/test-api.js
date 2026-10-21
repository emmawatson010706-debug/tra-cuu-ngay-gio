// Kiểm thử các hàm máy chủ với Redis giả lập và bộ gửi thông báo giả lập:
//   VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... CRON_SECRET=... node tests/test-api.js
const webpush = require('web-push');
const sent = [];
let failNext = 0;
webpush.sendNotification = async (sub, payload) => {
  if (failNext) { failNext--; const e = new Error('Gone'); e.statusCode = 410; throw e; }
  sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  return { statusCode: 201 };
};
process.env.PORT = '5199';
const server = require('./dev-server');
const G = require('../gio-core.js');
const base = 'http://127.0.0.1:5199';
let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };
const post = (p, b, h) => fetch(base + p, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}), body: JSON.stringify(b) });

(async () => {
  await new Promise(r => setTimeout(r, 200));
  const st = await (await fetch(base + '/api/status')).json();
  ok(st.push === true && st.publicKey, 'status báo đã cấu hình');

  const today = G.todayJdVN();
  // Tạo hồ sơ có ngày giỗ đúng 5 ngày nữa và một hồ sơ đúng hôm nay
  const in5 = G.jdToLunar(today + 5), d0 = G.jdToLunar(today);
  const people = [
    { id: 'a', name: 'Nguyễn Văn An', title: 'Ông nội', day: in5.day, month: in5.month, leap: in5.leap, leapRule: in5.leap ? 'leap' : 'regular', missingRule: 'last' },
    { id: 'b', name: 'Trần Thị Bình', title: 'Bà ngoại', day: d0.day, month: d0.month, leap: d0.leap, leapRule: d0.leap ? 'leap' : 'regular', missingRule: 'last' },
    { id: 'c', name: '', title: 'Cha', day: 99, month: 1 }
  ];
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'x'.repeat(87), auth: 'y'.repeat(22) } };

  let r = await post('/api/subscribe', { subscription: { endpoint: 'https://evil.example.com/x', keys: sub.keys }, people });
  ok(r.status === 400, 'chặn endpoint lạ');
  r = await post('/api/subscribe', { subscription: sub, people, settings: { dayOf: true } });
  const j = await r.json();
  ok(r.status === 200 && j.count === 2, 'lưu đăng ký, bỏ hồ sơ lỗi (' + JSON.stringify(j) + ')');

  r = await fetch(base + '/api/cron');
  ok(r.status === 401, 'cron chặn khi không có khóa');
  r = await fetch(base + '/api/cron', { headers: { Authorization: 'Bearer ' + process.env.CRON_SECRET } });
  const rep = await r.json();
  ok(rep.da_gui === 2, 'cron gửi 2 nhắc: ' + JSON.stringify(rep));
  ok(sent.some(s => s.payload.body.startsWith('Còn 5 ngày nữa đến ngày giỗ Ông nội — Nguyễn Văn An')), 'nội dung nhắc trước 5 ngày');
  ok(sent.some(s => s.payload.body.startsWith('Hôm nay là ngày giỗ Bà ngoại — Trần Thị Bình')), 'nội dung nhắc đúng ngày');

  const rep2 = await (await fetch(base + '/api/cron', { headers: { Authorization: 'Bearer ' + process.env.CRON_SECRET } })).json();
  ok(rep2.da_gui === 0 && rep2.bo_qua_trung === 2, 'không gửi trùng khi cron chạy lại');

  // Tắt nhắc đúng ngày
  await post('/api/subscribe', { subscription: { endpoint: sub.endpoint + 'z', keys: sub.keys }, people, settings: { dayOf: false } });
  const before = sent.length;
  await fetch(base + '/api/cron', { headers: { Authorization: 'Bearer ' + process.env.CRON_SECRET } });
  ok(sent.length - before === 1, 'tắt nhắc đúng ngày thì chỉ gửi nhắc trước 5 ngày');

  r = await post('/api/test', { endpoint: sub.endpoint });
  ok(r.status === 200, 'gửi thử');
  r = await post('/api/test', { endpoint: sub.endpoint });
  ok(r.status === 429, 'giới hạn gửi thử 1 lần/phút');

  // Đăng ký hết hạn bị xóa
  failNext = 1;
  r = await post('/api/test', { endpoint: sub.endpoint + 'z' });
  ok(r.status === 410, 'xóa đăng ký hết hạn');
  r = await post('/api/unsubscribe', { endpoint: sub.endpoint });
  ok(r.status === 200, 'hủy đăng ký');
  r = await post('/api/test', { endpoint: sub.endpoint });
  ok(r.status === 404, 'sau khi hủy không còn dữ liệu');

  console.log(`\nKẾT QUẢ API: ${pass} đạt, ${fail} lỗi`);
  server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
