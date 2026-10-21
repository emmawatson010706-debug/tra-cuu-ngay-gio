// POST /api/subscribe — lưu đăng ký nhận thông báo và danh sách ngày giỗ (tối thiểu) của một điện thoại
const { config, redis, validEndpoint, subKey, cleanPerson, readBody, send } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Chỉ nhận POST' });
  if (!config().ok) return send(res, 503, { error: 'Máy chủ chưa cấu hình' });
  const body = readBody(req);
  const sub = body.subscription || {};
  if (!validEndpoint(sub.endpoint) || !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') {
    return send(res, 400, { error: 'Đăng ký thông báo không hợp lệ' });
  }
  const people = (Array.isArray(body.people) ? body.people : []).slice(0, 500).map(cleanPerson).filter(Boolean);
  const record = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh.slice(0, 200), auth: sub.keys.auth.slice(0, 100) },
    people,
    settings: { dayOf: !!(body.settings && body.settings.dayOf) },
    updatedAt: Date.now()
  };
  try {
    const key = subKey(sub.endpoint);
    await redis('SET', key, JSON.stringify(record));
    await redis('SADD', 'subs', key);
    send(res, 200, { ok: true, count: people.length });
  } catch (e) {
    send(res, 500, { error: 'Không lưu được: ' + e.message });
  }
};
