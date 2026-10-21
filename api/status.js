// GET /api/status — cho ứng dụng biết máy chủ thông báo đã cấu hình chưa
const { config, send } = require('../lib/server');

module.exports = async (req, res) => {
  const c = config();
  send(res, 200, { push: c.ok, publicKey: c.ok ? c.publicKey : null, missing: c.missing });
};
