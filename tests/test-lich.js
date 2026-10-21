// Kiểm thử lõi âm lịch: chạy bằng lệnh  node tests/test-lich.js
const G = require('../gio-core.js');
let fail = 0, pass = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  ✗ ' + msg); } }
const jd = (d, m, y) => G.jdFromDate(d, m, y);

console.log('1) Mùng 1 Tết theo lịch Việt Nam (có các năm khác lịch Trung Quốc)');
const tet = { 1968: [29, 1], 1985: [21, 1], 2007: [17, 2], 2020: [25, 1], 2023: [22, 1], 2024: [10, 2], 2025: [29, 1], 2026: [17, 2], 2027: [6, 2], 2028: [26, 1], 2030: [2, 2] };
for (const y in tet) {
  const [d, m] = tet[y];
  ok(G.lunarToJd(1, 1, +y, false) === jd(d, m, +y), `Tết ${y} phải là ${d}/${m}/${y}, tính ra ${G.solarText(G.lunarToJd(1, 1, +y, false))}`);
}

console.log('2) Tháng nhuận');
const leaps = { 2017: 6, 2020: 4, 2023: 2, 2025: 6, 2028: 5, 2026: 0, 2024: 0 };
for (const y in leaps) ok(G.leapMonthOfYear(+y) === leaps[y], `Năm ${y} nhuận tháng ${leaps[y]}, tính ra ${G.leapMonthOfYear(+y)}`);
ok(G.lunarToJd(1, 6, 2025, true) === jd(25, 7, 2025), 'Mùng 1/6 nhuận 2025 = 25/07/2025');
ok(G.lunarToJd(15, 8, 2026, false) === jd(25, 9, 2026), 'Trung thu 2026 = 25/09/2026');
ok(G.lunarToJd(15, 7, 2025, false) === jd(6, 9, 2025), 'Rằm tháng 7 năm 2025 = 06/09/2025');

console.log('3) Đổi qua lại dương ↔ âm cho mọi ngày 1900–2199');
let checked = 0;
for (let j = jd(1, 1, 1900); j <= jd(31, 12, 2199); j++) {
  const L = G.jdToLunar(j);
  const back = G.lunarToJd(L.day, L.month, L.year, L.leap);
  if (back !== j) { ok(false, `Sai ở ${G.solarText(j)}: ${JSON.stringify(L)} -> ${back && G.solarText(back)}`); if (fail > 20) break; }
  checked++;
}
ok(true, ''); console.log(`   đã kiểm ${checked} ngày`);

console.log('4) Cấu trúc năm âm lịch 1900–2199 (12/13 tháng, mỗi tháng 29/30 ngày, nối liền)');
for (let y = 1900; y <= 2199; y++) {
  const ms = G.lunarYearMonths(y);
  const leapCount = ms.filter(m => m.leap).length;
  ok(ms.length === 12 + leapCount && leapCount <= 1, `Năm ${y} có ${ms.length} tháng`);
  ok(ms.every(m => m.length === 29 || m.length === 30), `Năm ${y} có tháng dài bất thường`);
  for (let i = 1; i < ms.length; i++) ok(ms[i].startJd === ms[i - 1].startJd + ms[i - 1].length, `Năm ${y} tháng không liền`);
  const next = G.lunarYearMonths(y + 1)[0];
  ok(ms[ms.length - 1].startJd + ms[ms.length - 1].length === next.startJd, `Năm ${y} không nối với năm sau`);
  ok(ms[0].month === 1 && ms[ms.length - 1].month === 12, `Năm ${y} không bắt đầu tháng 1 / kết thúc tháng 12`);
}

console.log('5) Quy tắc ngày giỗ');
// Tìm năm có tháng 6 nhuận (2025), người mất 10/6 nhuận
const pLeapReg = { day: 10, month: 6, leap: true, leapRule: 'regular', missingRule: 'last' };
const pLeapLeap = { day: 10, month: 6, leap: true, leapRule: 'leap', missingRule: 'last' };
const o1 = G.resolveOccurrence(pLeapReg, 2025), o2 = G.resolveOccurrence(pLeapLeap, 2025), o3 = G.resolveOccurrence(pLeapLeap, 2026);
ok(o1.jd === G.lunarToJd(10, 6, 2025, false) && !o1.lunarLeap, 'Giỗ tháng nhuận, quy tắc tháng thường -> 10/6 thường');
ok(o2.jd === G.lunarToJd(10, 6, 2025, true) && o2.lunarLeap, 'Giỗ tháng nhuận, quy tắc tháng nhuận -> 10/6 nhuận');
ok(o3.jd === G.lunarToJd(10, 6, 2026, false) && o3.notes.length === 1, 'Năm không có tháng 6 nhuận -> tháng 6 thường + có ghi chú');
// Người mất tháng thường, năm có nhuận cùng tháng -> tháng thường + ghi chú
const pNormal = { day: 10, month: 6, leap: false, missingRule: 'last' };
const o4 = G.resolveOccurrence(pNormal, 2025);
ok(o4.jd === G.lunarToJd(10, 6, 2025, false) && o4.notes.length === 1, 'Mất tháng 6 thường, năm 2025 có 6 nhuận -> tháng 6 thường + ghi chú');
// Ngày 30 ở tháng thiếu
let found = 0;
for (let y = 2020; y <= 2060 && found < 30; y++) {
  for (const m of G.lunarYearMonths(y)) {
    if (m.leap) continue;
    const pl = { day: 30, month: m.month, leap: false, missingRule: 'last' };
    const pn = { day: 30, month: m.month, leap: false, missingRule: 'next' };
    const a = G.resolveOccurrence(pl, y), b = G.resolveOccurrence(pn, y);
    if (m.length === 30) { ok(a.jd === m.startJd + 29 && a.notes.length === 0 || G.leapMonthOfYear(y) === m.month, `30/${m.month}/${y} đủ`); }
    else {
      found++;
      ok(a.jd === m.startJd + 28 && a.lunarDay === 29 && a.notes.length >= 1, `30/${m.month}/${y} thiếu -> ngày 29`);
      ok(b.jd === m.startJd + 29 && b.lunarDay === 1 && b.notes.length >= 1, `30/${m.month}/${y} thiếu -> mùng 1 tháng sau`);
    }
  }
}
ok(found > 0, 'Có tìm thấy tháng thiếu để kiểm');

console.log('6) Ngày giỗ kế tiếp và nhắc trước 5 ngày');
const today = jd(20, 10, 2026);
const p = { name: 'Nguyễn Văn An', title: 'Ông nội', day: 15, month: 9, leap: false, missingRule: 'last' };
const nx = G.nextOccurrence(p, today);
ok(nx && nx.jd >= today && G.jdToLunar(nx.jd).day === 15 && G.jdToLunar(nx.jd).month === 9, 'Ngày giỗ kế tiếp đúng ngày âm');
const remindDay = nx.jd - 5;
const r = G.remindersForDay([p], remindDay, { daysBefore: 5, dayOf: true });
ok(r.length === 1 && r[0].daysLeft === 5, 'Có nhắc đúng ngày trước 5 ngày');
ok(G.reminderText(p, nx, 5).startsWith('Còn 5 ngày nữa đến ngày giỗ Ông nội — Nguyễn Văn An'), 'Nội dung nhắc đúng mẫu');
ok(G.remindersForDay([p], remindDay + 1, { daysBefore: 5, dayOf: false }).length === 0, 'Không nhắc sai ngày');
ok(G.remindersForDay([p], nx.jd, { dayOf: true })[0].kind === 'hom-nay', 'Nhắc đúng ngày giỗ');
// Chuyển năm: giỗ 5/1 khi đang ở tháng Chạp
const p2 = { day: 5, month: 1, leap: false, missingRule: 'last' };
const n2 = G.nextOccurrence(p2, jd(20, 1, 2027));
ok(n2.jd === G.lunarToJd(5, 1, 2027, false), 'Giỗ đầu năm âm khi đang cuối năm âm');

console.log('7) Kiểm tra hồ sơ');
ok(G.validatePerson({ name: '', title: '', day: 0, month: 13 }).errors.length === 4, 'Bắt lỗi thiếu thông tin');
ok(G.validatePerson({ name: 'A', title: 'Khác', customTitle: '', day: 1, month: 1 }).errors.length === 1, 'Bắt lỗi danh xưng Khác');
ok(G.validatePerson({ name: 'A', title: 'Cha', day: 1, month: 4, leap: true, deathYear: 2025 }).warnings.length === 1, 'Cảnh báo tháng nhuận không có trong năm mất');
ok(G.validatePerson({ name: 'A', title: 'Cha', day: 1, month: 6, leap: true, deathYear: 2025 }).warnings.length === 0, 'Không cảnh báo khi đúng tháng nhuận');

console.log('\nThông tin tham khảo: hôm nay 20/10/2026 =', JSON.stringify(G.jdToLunar(today)), G.weekdayName(today));
console.log('Ngày giỗ kế tiếp của ví dụ:', G.solarText(nx.jd), '-', G.reminderText(p, nx, 5));
console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
