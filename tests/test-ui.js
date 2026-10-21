// Kiểm thử giao diện trên khung điện thoại (Android + iPhone) bằng Playwright
//   node tests/test-ui.js [thư-mục-ảnh]
//   BASE_URL=file:///.../xem-truoc.html  → kiểm thử tệp xem trước
//   SANDBOX=1 → chạy trong khung bị chặn lưu trữ (giống ô xem trước / Zalo)
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');
process.env.PORT = '5188';
const server = process.env.BASE_URL ? null : require('./dev-server');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5188/';
const OUT = process.argv[2] || path.join(__dirname, 'anh');
fs.mkdirSync(OUT, { recursive: true });
let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

// Khung bị chặn lưu trữ: trang chủ chứa iframe sandbox (không có allow-same-origin)
let host = null;
if (process.env.SANDBOX) {
  const html = fs.readFileSync(new URL(BASE).pathname, 'utf8');
  host = http.createServer((q, r) => {
    r.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (q.url.startsWith('/app')) return r.end(html);
    r.end('<!doctype html><body style="margin:0"><iframe sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads" src="/app" style="width:100vw;height:100vh;border:0"></iframe></body>');
  }).listen(5167);
}

async function overflowCheck(page, label) {
  const bad = await page.evaluate(() => {
    const W = document.documentElement.clientWidth, out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push('trang tràn ngang ' + document.documentElement.scrollWidth + '>' + W);
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || cs.display === 'none' || cs.visibility === 'hidden') return;
      if (el.closest('.sheet:not(.open), .modal:not(.open), .screen:not(.active), .toast, svg, .chips, details:not([open]) > .content')) return;
      if (r.right > W + 1) out.push('tràn khung: ' + el.tagName + '.' + el.className + ' ' + Math.round(r.right));
      if (cs.overflow !== 'hidden' && el.scrollWidth > el.clientWidth + 1 && ['BUTTON', 'SPAN', 'DIV', 'P', 'TD', 'LABEL', 'A'].includes(el.tagName) && cs.whiteSpace === 'nowrap' && cs.textOverflow !== 'ellipsis')
        out.push('chữ tràn: ' + el.tagName + '.' + el.className + ' "' + el.textContent.slice(0, 30) + '"');
    });
    return out.slice(0, 8);
  });
  ok(bad.length === 0, label + ': ' + bad.join(' | '));
}

async function run(device, tag) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[device], locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', permissions: ['clipboard-read', 'clipboard-write'] });
  const top = await ctx.newPage();
  const errors = [];
  top.on('pageerror', e => errors.push(e.message));
  top.on('console', m => { if (m.type() === 'error' && !/api\/status|Failed to load resource|ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text()); });
  await top.goto(host ? 'http://127.0.0.1:5167/' : BASE);
  await top.waitForTimeout(400);
  const page = host ? top.frames()[1] : top;
  const shot = (name, full) => top.screenshot({ path: path.join(OUT, tag + '-' + name + '.png'), fullPage: !!full });
  const tab = name => page.click(`.nav button[data-screen=${name}]`);
  await page.waitForSelector('#screen-nhap.active');
  if (host) ok(await page.isVisible('#storage-banner.warn-bar'), tag + ': hiện cảnh báo trình duyệt chặn lưu');

  async function check(sel) {
    const loc = page.locator(sel);
    await loc.evaluate(e => e.scrollIntoView({ block: 'center' }));
    await loc.check();
  }
  async function addPerson(p) {
    await tab('nhap');
    await page.fill('#f-name', p.name);
    await page.selectOption('#f-title', p.title);
    if (p.custom) await page.fill('#f-custom', p.custom);
    await page.selectOption('#f-day', String(p.day));
    await page.selectOption('#f-month', String(p.month));
    if (p.leap) { await check('#f-leap'); if (p.leapRule) await check(`input[name=leapRule][value=${p.leapRule}]`); }
    if (p.missing) await check(`input[name=missingRule][value=${p.missing}]`);
    if (p.year) await page.fill('#f-year', String(p.year));
    if (p.home) await page.fill('#f-home', p.home);
    if (p.shot) await shot(p.shot);
    const before = await page.locator('#all .gc').count();
    await page.click('#btn-save');
    if (p.expectWarn) { await page.waitForSelector('#modal.open'); await page.click('#modal-actions button:first-child'); }
    await page.waitForFunction(n => document.querySelectorAll('#all .gc').length === n + 1, before, { timeout: 5000 });
  }

  // Trang chủ & Tra cứu trống trước khi nhập
  await tab('trangchu');
  ok((await page.textContent('#home-list')).includes('Chưa có ngày giỗ'), tag + ': trang chủ trống có hướng dẫn');
  await tab('tracuu');
  ok((await page.textContent('#hero')).includes('Chưa có ngày giỗ'), tag + ': tra cứu trống có hướng dẫn');
  await tab('nhap');
  await page.click('#btn-save');
  ok(await page.isVisible('#f-errors'), tag + ': báo lỗi khi bỏ trống');

  await addPerson({ name: 'Nguyễn Văn An', title: 'Ông nội', day: 15, month: 9, year: 1998, home: 'Hưng Nguyên, Nghệ An', shot: '1-nhap' });
  // Liên kết: vừa lưu đã có ở Tra cứu và trên lịch
  await tab('tracuu');
  ok((await page.textContent('#hero')).includes('Nguyễn Văn An'), tag + ': lưu xong hiện ngay ở Tra cứu');
  ok(await page.locator('#upcoming .gc').count() === 1, tag + ': danh sách sắp đến có 1 mục');
  await tab('lich');
  ok(await page.locator('#cal-grid .cal-day.gio').count() === 1, tag + ': lưu xong hiện nút đỏ trên lịch');

  await addPerson({ name: 'Hồ Thị Lan', title: 'Bà nội', day: 10, month: 6, leap: true, leapRule: 'leap', year: 2025 });
  await addPerson({ name: 'Hồ Văn Bảy Trường Giang Nguyên Sơn', title: 'Khác', custom: 'Ông bác', day: 30, month: 12, missing: 'last' });
  await addPerson({ name: 'Trần Văn Cường', title: 'Cha', day: 4, month: 6, leap: true, year: 2024, expectWarn: true });
  await addPerson({ name: 'Lê Thị Mai', title: 'Mẹ', day: 15, month: 9 });
  await addPerson({ name: 'Võ Thị Hoành', title: 'Bà ngoại', day: 26, month: 11 });
  await addPerson({ name: 'Hồ Viết Tam', title: 'Cha', day: 26, month: 3 });
  ok(await page.locator('#all .gc').count() === 7, tag + ': có 7 hồ sơ');
  ok(await page.locator('#all .gc .act-edit').count() === 7 && await page.locator('#all .gc .act-del').count() === 7, tag + ': mỗi hồ sơ có nút Sửa và Xóa');
  await page.evaluate(() => document.querySelector('#all').scrollIntoView());
  await shot('2-danhsach');
  await overflowCheck(page, tag + ' nhập giỗ');

  await page.fill('#search', 'ong bac');
  ok(await page.locator('#all .gc').count() === 1, tag + ': tìm không dấu theo danh xưng');
  await page.fill('#search', 'nghe an');
  ok(await page.locator('#all .gc').count() === 1, tag + ': tìm theo quê');
  await page.click('#search-clear');

  // Sửa ngay từ danh sách
  await page.locator('#all .gc', { hasText: 'Hồ Thị Lan' }).locator('.act-edit').click();
  ok(await page.isVisible('#edit-banner') && (await page.inputValue('#f-name')) === 'Hồ Thị Lan', tag + ': nút Sửa nạp hồ sơ vào biểu mẫu');
  await page.fill('#f-name', 'Hồ Thị Lan Anh');
  await page.click('#btn-save');
  await page.waitForSelector('#all .gc:has-text("Hồ Thị Lan Anh")');
  ok(await page.locator('#all .gc').count() === 7 && !(await page.isVisible('#edit-banner')), tag + ': sửa xong không tạo bản trùng');

  // Xóa ngay từ danh sách + hoàn tác
  await page.locator('#all .gc', { hasText: 'Lê Thị Mai' }).locator('.act-del').click();
  await page.waitForSelector('#modal.open');
  await shot('3-xoa');
  await page.click('#modal-actions button:first-child');
  await page.waitForFunction(() => document.querySelectorAll('#all .gc').length === 6);
  await page.click('#toast button');
  await page.waitForFunction(() => document.querySelectorAll('#all .gc').length === 7);
  ok(true, '');

  // Thẻ 2: Tra cứu
  await tab('tracuu');
  const heroText = await page.textContent('#hero');
  ok(heroText.includes('ngày nữa') || heroText.includes('Hôm nay'), tag + ': thẻ ngày giỗ gần nhất');
  ok(await page.locator('#upcoming .gc').count() === 7, tag + ': sắp đến có 7 mục');
  ok(await page.locator('#upcoming .gc .act-edit').count() === 7, tag + ': danh sách tra cứu có nút Sửa/Xóa');
  ok((await page.textContent('#nav-badge')).trim() !== '', tag + ': huy hiệu số ngày giỗ gần trên thẻ Tra cứu');
  await shot('4-tracuu');
  await overflowCheck(page, tag + ' tra cứu');
  await page.click('.seg button[data-seg=theonam]');
  ok((await page.textContent('#yr-label')).includes('Bính Ngọ'), tag + ': xem theo năm âm lịch Bính Ngọ');
  const ba = page.locator('#yr-list .gc', { hasText: 'Võ Thị Hoành' });
  ok(await ba.count() === 1 && (await ba.textContent()).includes('03/01/2027') && (await ba.textContent()).includes('Còn 74 ngày'), tag + ': bà ngoại 26/11 âm = CN 03/01/2027, còn 74 ngày');
  ok(await page.locator('#yr-list .gc', { hasText: 'Hồ Viết Tam' }).count() === 0 && (await page.textContent('#yr-list')).includes('Đinh Mùi'), tag + ': cha 26/3 chuyển sang năm Đinh Mùi');
  ok(await page.isDisabled('#yr-prev'), tag + ': không lùi về năm đã qua');
  await shot('4b-theonam', false);
  await page.click('#yr-next');
  const cha = page.locator('#yr-list .gc', { hasText: 'Hồ Viết Tam' });
  ok((await page.textContent('#yr-label')).includes('Đinh Mùi') && await cha.count() === 1 && (await cha.textContent()).includes('02/05/2027'), tag + ': năm Đinh Mùi: cha giỗ 02/05/2027');
  await page.click('#yr-prev');
  await page.click('.seg button[data-seg=sapden]');

  ok(!(await page.evaluate(() => document.body.innerText.includes('Đã qua'))), tag + ': không còn chữ "Đã qua"');

  // Trang chủ (chỉ xem)
  await tab('trangchu');
  ok(await page.locator('#home-list .tv').count() === 7, tag + ': trang chủ hiện đủ 7 người');
  ok(await page.locator('#home-list [data-edit], #home-list [data-del]').count() === 0, tag + ': trang chủ không có nút Sửa/Xóa');
  ok((await page.textContent('#home-hero')).includes('Bính Ngọ'), tag + ': trang chủ hiện ngày âm hôm nay');
  await shot('0-trangchu');
  await page.locator('#home-list .tv', { hasText: 'Võ Thị Hoành' }).locator('.tv-head').click();
  const body = await page.locator('#home-list .tv.open').textContent();
  ok(body.includes('Ngày 26 tháng 11 âm lịch') && body.includes('03/01/2027') && body.includes('Các năm sau'), tag + ': mở chi tiết bà ngoại trên trang chủ');
  await shot('0b-trangchu-chitiet');
  await overflowCheck(page, tag + ' trang chủ');
  await page.fill('#home-search', 'hoanh');
  ok(await page.locator('#home-list .tv').count() === 1, tag + ': tìm trên trang chủ');
  await page.fill('#home-search', '');

  // Thẻ 3: Lịch — nút đỏ, chạm hiện tên + danh xưng
  await tab('lich');
  await page.click('#cal-today');
  const cells = await page.locator('#cal-grid .cal-day:not(.out)').count();
  ok(cells === 31, tag + ': tháng 10 có 31 ô, thấy ' + cells);
  const red = page.locator('#cal-grid .cal-day.gio');
  ok(await red.count() >= 1, tag + ': ngày giỗ là nút đỏ');
  const bg = await red.first().evaluate(e => getComputedStyle(e).backgroundImage);
  ok(/gradient/.test(bg), tag + ': nút đỏ có nền nổi');
  ok(await red.first().locator('.cnt').count() === 1, tag + ': ngày có 2 người giỗ hiện số 2');
  await shot('5-lich');
  await red.first().click();
  await page.waitForSelector('#pop.open');
  const pop = await page.textContent('#pop-body');
  ok(pop.includes('Nguyễn Văn An') && pop.includes('Ông nội') && pop.includes('Lê Thị Mai') && pop.includes('Mẹ'), tag + ': chạm nút đỏ hiện tên và danh xưng');
  await shot('6-popup');
  await overflowCheck(page, tag + ' cửa sổ ngày giỗ');
  // Sửa từ cửa sổ lịch → chuyển sang thẻ Nhập
  await page.locator('#pop-body .pop-person', { hasText: 'Lê Thị Mai' }).locator('[data-edit]').click();
  ok(await page.isVisible('#screen-nhap.active') && (await page.inputValue('#f-name')) === 'Lê Thị Mai', tag + ': Sửa từ lịch mở biểu mẫu');
  await page.click('#btn-cancel-edit');
  await tab('lich');
  ok(await page.locator('#cal-list .gc').count() >= 2, tag + ': danh sách giỗ trong tháng dưới lịch');
  await page.locator('#tool-solar summary').click();
  await page.fill('#cv-solar', '2030-02-02');
  ok((await page.textContent('#cv-solar-result')).includes('Canh Tuất'), tag + ': đổi 2/2/2030 = Tết Canh Tuất');
  await page.locator('#tool-lunar summary').click();
  await page.fill('#cv-year', '2025'); await page.selectOption('#cv-month', '6'); await page.selectOption('#cv-day', '1');
  await check('#cv-leap');
  ok((await page.textContent('#cv-lunar-result')).includes('25/07/2025'), tag + ': 1/6 nhuận 2025 = 25/07/2025');
  await overflowCheck(page, tag + ' lịch');

  // Thẻ 4: Bài cúng (mở từ cửa sổ lịch)
  await page.locator('#cal-grid .cal-day.gio').first().click();
  await page.locator('#pop-body .pop-person', { hasText: 'Nguyễn Văn An' }).locator('[data-prayer]').click();
  ok(await page.isVisible('#screen-baicung.active') && await page.locator('details.prayer[data-bid=gio][open]').count() === 1, tag + ': nút Bài khấn mở đúng bài cúng giỗ');
  ok((await page.textContent('#pt-gio')).includes('Ông nội Nguyễn Văn An'), tag + ': bài khấn tự điền đúng người');
  await page.locator('#bc-info summary').click().catch(() => {});
  if (!(await page.isVisible('#bc-tinchu'))) await page.locator('#bc-info summary').click();
  await page.fill('#bc-tinchu', 'Hồ Nam Tấn'); await page.press('#bc-tinchu', 'Tab');
  ok((await page.textContent('#pt-gio')).includes('Hồ Nam Tấn'), tag + ': điền người khấn');
  ok(await page.locator('details.prayer').count() === 2, tag + ': nhóm Cúng giỗ có 2 bài');
  await page.click('.chip[data-group="Tất cả"]');
  ok(await page.locator('details.prayer').count() >= 15, tag + ': đủ 15 bài khấn');
  await shot('7-baicung');
  await overflowCheck(page, tag + ' bài cúng');

  // Chân trang tác giả
  const credit = await page.textContent('.credit');
  ok(credit.includes('Hồ Nam Tấn') && credit.includes('0914 587 575'), tag + ': chân trang có tác giả và điện thoại');
  ok((await page.getAttribute('.cr-tel', 'href')) === 'tel:0914587575', tag + ': số điện thoại bấm gọi được');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('8-chantrang');

  // Cài đặt
  await page.click('#btn-settings');
  await page.waitForSelector('#sheet-settings.open');
  await overflowCheck(page, tag + ' cài đặt');
  await page.click('#sheet-settings [data-close]');

  if (!host) {
    await page.reload();
    await page.waitForSelector('.screen.active');
    ok(await page.locator('#all .gc').count() === 7, tag + ': dữ liệu còn sau khi tải lại');
  }
  ok(errors.length === 0, tag + ': lỗi JS: ' + errors.join(' | '));
  await browser.close();
}

(async () => {
  try {
    await run('Pixel 7', 'android');
    await run('iPhone 13', 'iphone');
    await run('iPhone SE', 'iphone-se');
  } catch (e) { console.error(e); fail++; }
  console.log(`\nKẾT QUẢ GIAO DIỆN${process.env.SANDBOX ? ' (khung bị chặn lưu trữ)' : ''}: ${pass} đạt, ${fail} lỗi`);
  if (server) server.close();
  if (host) host.close();
  process.exit(fail ? 1 : 0);
})();
