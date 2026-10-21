// GET /api/cron — Vercel gọi mỗi ngày (khoảng 7–8 giờ sáng giờ Việt Nam) để gửi nhắc giỗ
const G = require('../gio-core.js');
const { config, redis, send, pushTo } = require('../lib/server');

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return send(res, 500, { error: 'Thiếu biến môi trường CRON_SECRET' });
  if (req.headers.authorization !== 'Bearer ' + secret) return send(res, 401, { error: 'Không có quyền' });
  if (!config().ok) return send(res, 503, { error: 'Máy chủ chưa cấu hình', missing: config().missing });

  const today = G.todayJdVN();
  const report = { ngay: G.solarText(today), dang_ky: 0, da_gui: 0, bo_qua_trung: 0, het_han: 0, loi: 0 };
  const keys = (await redis('SMEMBERS', 'subs')) || [];
  report.dang_ky = keys.length;

  for (const key of keys) {
    let sub;
    try { sub = JSON.parse((await redis('GET', key)) || 'null'); } catch (e) { sub = null; }
    if (!sub) { await redis('SREM', 'subs', key).catch(() => {}); continue; }
    const items = G.remindersForDay(sub.people || [], today, { daysBefore: 5, dayOf: !!(sub.settings && sub.settings.dayOf) });
    for (const it of items) {
      // Chống gửi trùng nếu Vercel gọi lại trong cùng ngày
      const mark = await redis('SET', ['sent', key, it.person.id, it.occ.jd, it.kind].join(':'), '1', 'NX', 'EX', 3 * 24 * 3600);
      if (mark !== 'OK') { report.bo_qua_trung++; continue; }
      try {
        await pushTo(sub, {
          title: it.daysLeft === 0 ? 'Hôm nay là ngày giỗ' : 'Còn ' + it.daysLeft + ' ngày đến ngày giỗ',
          body: G.reminderText(it.person, it.occ, it.daysLeft),
          tag: 'gio-' + it.person.id + '-' + it.kind,
          url: '/'
        });
        report.da_gui++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await redis('DEL', key).catch(() => {});
          await redis('SREM', 'subs', key).catch(() => {});
          report.het_han++;
          break;
        }
        report.loi++;
        console.error('Gửi lỗi', key, e.statusCode, e.body || e.message);
      }
    }
  }
  console.log('Nhắc giỗ', JSON.stringify(report));
  send(res, 200, report);
};
