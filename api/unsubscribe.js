// POST /api/unsubscribe — xóa đăng ký và dữ liệu của điện thoại khỏi máy chủ
const { config, redis, validEndpoint, subKey, readBody, send } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Chỉ nhận POST' });
  if (!config().ok) return send(res, 503, { error: 'Máy chủ chưa cấu hình' });
  const { endpoint } = readBody(req);
  if (!validEndpoint(endpoint)) return send(res, 400, { error: 'Không hợp lệ' });
  try {
    const key = subKey(endpoint);
    await redis('DEL', key);
    await redis('SREM', 'subs', key);
    send(res, 200, { ok: true });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
};
