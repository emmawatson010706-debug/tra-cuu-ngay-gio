// POST /api/test — gửi một thông báo thử đến điện thoại đã đăng ký (tối đa 1 lần/phút)
const { config, redis, validEndpoint, subKey, readBody, send, pushTo } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Chỉ nhận POST' });
  if (!config().ok) return send(res, 503, { error: 'Máy chủ chưa cấu hình' });
  const { endpoint } = readBody(req);
  if (!validEndpoint(endpoint)) return send(res, 400, { error: 'Không hợp lệ' });
  try {
    const key = subKey(endpoint);
    const raw = await redis('GET', key);
    if (!raw) return send(res, 404, { error: 'Máy chủ chưa có đăng ký của điện thoại này. Hãy tắt rồi bật lại thông báo.' });
    const allowed = await redis('SET', 'test:' + key, '1', 'NX', 'EX', 60);
    if (allowed !== 'OK') return send(res, 429, { error: 'Vui lòng chờ 1 phút rồi gửi thử lại.' });
    const sub = JSON.parse(raw);
    await pushTo(sub, {
      title: 'Thông báo thử',
      body: 'Điện thoại đã nhận được thông báo từ “Tra cứu ngày giỗ”. Ứng dụng sẽ nhắc trước ngày giỗ 5 ngày.',
      tag: 'thu-nghiem'
    });
    send(res, 200, { ok: true });
  } catch (e) {
    const code = e.statusCode;
    if (code === 404 || code === 410) {
      const key = subKey(endpoint);
      await redis('DEL', key).catch(() => {});
      await redis('SREM', 'subs', key).catch(() => {});
      return send(res, 410, { error: 'Đăng ký đã hết hạn. Hãy tắt rồi bật lại thông báo.' });
    }
    send(res, 500, { error: 'Gửi không thành công: ' + (e.body || e.message) });
  }
};
