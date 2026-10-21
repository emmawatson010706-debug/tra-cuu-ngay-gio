/* app.js — Giao diện "Tra cứu ngày giỗ" */
(function () {
  'use strict';
  var G = window.GioCore;
  var APP_VERSION = '1.3.0';

  var TITLES = ['Cụ tổ', 'Bà cô', 'Cố ông', 'Cố bà', 'Ông nội', 'Bà nội', 'Ông ngoại', 'Bà ngoại', 'Cha', 'Mẹ',
    'Anh', 'Chị', 'Anh rể', 'Chị dâu', 'Em trai', 'Em gái', 'Em dâu', 'Em rể', 'O (cô)', 'Con trai', 'Con gái',
    'Con dâu', 'Con rể', 'Cháu trai', 'Cháu gái', 'Cháu dâu', 'Cháu rể', 'Khác'];
  var MONTH_LABEL = { 1: 'Tháng 1 (Giêng)', 11: 'Tháng 11 (Một)', 12: 'Tháng 12 (Chạp)' };
  function monthLabel(m) { return MONTH_LABEL[m] || ('Tháng ' + m); }

  var state = { people: [], settings: { dayOf: true, pushEnabled: false, lastBackup: null }, query: '', upQuery: '', homeQuery: '', homeOpen: null, lyear: 0, seg: 'sapden', screen: null, year: 0, calY: 0, calM: 0, selJd: 0, bcGroup: 'Tất cả', bcPerson: {}, bcOpen: null, editingId: null, detailId: null, mtYear: null, serverStatus: null };
  var $ = function (id) { return document.getElementById(id); };

  /* ================= Lưu trữ: IndexedDB → localStorage → bộ nhớ tạm =================
   * Nguyên tắc: cập nhật giao diện NGAY (cả 3 thẻ), sau đó mới ghi xuống máy.
   * Nếu trình duyệt chặn lưu (khung xem trước, Zalo, chế độ ẩn danh...), ứng dụng vẫn chạy
   * và hiện cảnh báo rõ ràng thay vì báo lỗi "Không lưu được". */
  var DB_NAME = 'tra-cuu-ngay-gio', DB_VER = 1, MIRROR_KEY = 'ngaygio.saoluu.v1';
  var dbp = null;
  var storageMode = 'idb'; // 'idb' | 'local' | 'memory'
  var memMeta = {};
  function safe(fn, fb) { try { return fn(); } catch (e) { return fb; } }
  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var idb = safe(function () { return window.indexedDB; }, null);
      if (!idb) return rej(new Error('no-idb'));
      var rq;
      try { rq = idb.open(DB_NAME, DB_VER); } catch (e) { return rej(e); }
      var timer = setTimeout(function () { rej(new Error('idb-timeout')); }, 3000);
      rq.onupgradeneeded = function () {
        var db = rq.result;
        if (!db.objectStoreNames.contains('people')) db.createObjectStore('people', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      rq.onsuccess = function () { clearTimeout(timer); res(rq.result); };
      rq.onerror = function () { clearTimeout(timer); rej(rq.error || new Error('idb-error')); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t, s, out;
        try { t = db.transaction(store, mode); s = t.objectStore(store); out = fn(s); } catch (e) { return rej(e); }
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error); };
      });
    });
  }
  var idbStore = {
    all: function () { return tx('people', 'readonly', function (s) { return s.getAll(); }); },
    replaceAll: function (list) { return tx('people', 'readwrite', function (s) { s.clear(); list.forEach(function (p) { s.put(p); }); }); },
    getMeta: function (k) { return tx('meta', 'readonly', function (s) { return s.get(k); }).then(function (r) { return r ? r.value : undefined; }); },
    setMeta: function (k, v) { return tx('meta', 'readwrite', function (s) { s.put({ key: k, value: v }); }); }
  };
  function localOK() {
    return safe(function () { var k = '__thu__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }, false);
  }
  function mirror() {
    return safe(function () { localStorage.setItem(MIRROR_KEY, JSON.stringify({ savedAt: Date.now(), people: state.people, settings: state.settings })); return true; }, false);
  }
  function readMirror() { return safe(function () { var s = localStorage.getItem(MIRROR_KEY); return s ? JSON.parse(s) : null; }, null); }

  /* Ghi toàn bộ dữ liệu xuống máy (gọi sau mỗi thay đổi). */
  function persist() {
    var okLocal = mirror();
    return idbStore.replaceAll(state.people).then(function () {
      return idbStore.setMeta('settings', state.settings);
    }).then(function () { setMode('idb'); return true; }, function () {
      setMode(okLocal ? 'local' : 'memory'); return okLocal;
    });
  }
  function saveSettings() { return persist(); }
  function getMeta(k) { return storageMode === 'idb' ? idbStore.getMeta(k).catch(function () { return memMeta[k]; }) : Promise.resolve(memMeta[k]); }
  function setMeta(k, v) { memMeta[k] = v; return storageMode === 'idb' ? idbStore.setMeta(k, v).catch(function () {}) : Promise.resolve(); }

  function setMode(m) {
    storageMode = m;
    var el = $('storage-banner');
    if (!el) return;
    if (m === 'memory') {
      el.className = 'warn-bar';
      el.innerHTML = '<svg width="22" height="22"><use href="#i-info"/></svg><div><b>Trình duyệt đang chặn lưu dữ liệu</b>' +
        'Thường gặp khi mở tệp trong Zalo, trong ô xem trước hoặc chế độ ẩn danh. Hồ sơ vẫn hiện và tra cứu bình thường nhưng sẽ mất khi đóng trang. ' +
        'Hãy mở bằng Chrome (Android) hoặc Safari (iPhone), hoặc vào Cài đặt → Sao lưu trước khi đóng.</div>';
    } else el.className = 'hidden';
  }

  function loadData() {
    return idbStore.all().then(function (list) {
      return idbStore.getMeta('settings').then(function (st) {
        if (st) state.settings = Object.assign(state.settings, st);
        if (!list || !list.length) {
          var m = readMirror();
          if (m && m.people && m.people.length) {
            list = m.people;
            if (m.settings) state.settings = Object.assign(state.settings, m.settings);
          }
        }
        setMode('idb');
        return list || [];
      });
    }).catch(function () {
      var m = readMirror();
      if (m && m.settings) state.settings = Object.assign(state.settings, m.settings);
      setMode(localOK() ? 'local' : 'memory');
      return (m && m.people) || [];
    }).then(function (list) {
      state.people = list;
      if (storageMode !== 'memory') persist();
    });
  }

  /* ================= Tiện ích ================= */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fold(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim(); }
  function uid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function today() { return G.todayJdVN(); }
  function countText(n) { return n <= 0 ? 'Hôm nay' : n === 0 ? 'Hôm nay' : n === 1 ? 'Ngày mai' : 'Còn ' + n + ' ngày'; }
  function tap() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function isStandalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }

  var toastTimer;
  function toast(msg, action) {
    var t = $('toast');
    $('toast-msg').textContent = msg;
    var old = t.querySelector('button'); if (old) old.remove();
    if (action) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
      b.onclick = function () { t.classList.remove('show'); action.fn(); };
      t.appendChild(b);
    }
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, action ? 9000 : 3200);
  }

  /* Hộp thoại xác nhận: buttons = [{label, cls, value}] */
  function dialog(title, msg, buttons) {
    return new Promise(function (resolve) {
      $('modal-title').textContent = title;
      $('modal-msg').textContent = msg;
      var box = $('modal-actions'); box.innerHTML = '';
      buttons.forEach(function (b) {
        var el = document.createElement('button');
        el.type = 'button'; el.className = 'btn btn-block ' + (b.cls || 'btn-light'); el.textContent = b.label;
        el.onclick = function () { $('modal').classList.remove('open'); resolve(b.value); };
        box.appendChild(el);
      });
      $('modal').classList.add('open');
      setTimeout(function () { var f = box.querySelector('button'); if (f) f.focus(); }, 50);
    });
  }

  /* ================= Tính toán cho hiển thị ================= */
  function withNext(list) {
    var t = today();
    return list.map(function (p) {
      var occ = G.nextOccurrence(p, t);
      return { p: p, occ: occ, left: occ ? occ.jd - t : 99999 };
    });
  }
  function sortByNext(a, b) { return a.left - b.left || fold(a.p.name).localeCompare(fold(b.p.name)); }
  function findPerson(id) { return state.people.find(function (x) { return x.id === id; }); }
  function who(p) { return G.displayTitle(p) + ' — ' + p.name; }
  function matches(p, q, deep) {
    if (!q) return true;
    var f = [p.name, G.displayTitle(p)];
    if (deep) f.push(p.hometown, p.branch);
    return f.some(function (s) { return fold(s).indexOf(q) >= 0; });
  }
  function solarLong(jd) { return G.weekdayName(jd) + ', ' + G.solarText(jd); }

  function monthWord(m) { return m === 1 ? 'Giêng' : m === 12 ? 'Chạp' : String(m); }
  function lunarPhrase(d, m, leap) { return (d <= 10 ? 'Mùng ' : 'Ngày ') + d + ' tháng ' + monthWord(m) + (leap ? ' nhuận' : ''); }

  /* Thẻ ngày giỗ dùng chung cho các danh sách quản lý — có nút Sửa / Xóa.
   * Ngày âm là chính; ngày dương lịch và thứ chỉ để ghi chú.
   * Không bao giờ hiện "Đã qua": nếu lần giỗ đang xem đã tới trước hôm nay (lịch tháng cũ), hiện ngày giỗ lần tới. */
  function gcHTML(x) {
    var p = x.p, o = x.occ, t = today();
    if (x.left < 0) { var nx = G.nextOccurrence(p, t); if (nx) { o = nx; x = { p: p, occ: nx, left: nx.jd - t }; } }
    var soon = x.left <= 5;
    var cls = 'gc' + (x.left === 0 ? ' today' : soon ? ' soon' : '');
    var d = o ? o.lunarDay : p.day, m = o ? o.lunarMonth : p.month, leap = o ? o.lunarLeap : false;
    var pill = x.left === 0 ? 'pill today' : soon ? 'pill soon' : 'pill';
    var meta = [];
    if (p.deathYear) meta.push('Mất năm ' + p.deathYear);
    var nth = G.anniversaryNumber(p, o); if (nth) meta.push('giỗ lần thứ ' + nth);
    if (!meta.length && p.hometown) meta.push(p.hometown);
    var metaHTML = esc(meta.join(' · ')) + (o && o.notes.length ? (meta.length ? ' · ' : '') + '<span class="note">lưu ý ngày giỗ năm nay</span>' : '');
    return '<article class="' + cls + '" data-id="' + esc(p.id) + '">' +
      '<button class="gc-main" type="button" data-open="' + esc(p.id) + '" aria-label="Xem chi tiết ' + esc(who(p)) + '">' +
        '<span class="gc-date"><span class="d">' + (d < 10 ? '0' : '') + d + '</span><span class="m">' + (leap ? 'th.' + m + ' nhuận' : 'tháng ' + m) + '</span><span class="al">âm lịch</span></span>' +
        '<span class="gc-info"><span class="gc-title" style="display:block">' + esc(G.displayTitle(p)) + '</span>' +
        '<span class="gc-name" style="display:block">' + esc(p.name) + '</span>' +
        '<span class="gc-when" style="display:block">' + (o ? 'Dương lịch: ' + esc(solarLong(o.jd)) : '') + '</span></span>' +
        '<span class="' + pill + '">' + esc(countText(x.left)) + '</span>' +
      '</button>' +
      '<div class="gc-foot"><span class="gc-meta">' + metaHTML + '</span>' +
        '<button class="act act-edit" type="button" data-edit="' + esc(p.id) + '"><svg width="16" height="16"><use href="#i-edit"/></svg>Sửa</button>' +
        '<button class="act act-del" type="button" data-del="' + esc(p.id) + '"><svg width="16" height="16"><use href="#i-trash"/></svg>Xóa</button>' +
      '</div></article>';
  }

  function emptyCard(title, sub, withBtn) {
    return '<div class="card empty"><div class="em-ic"><svg width="30" height="30"><use href="#i-incense"/></svg></div><h3>' + title + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') +
      (withBtn ? '<button class="btn btn-red" type="button" data-go="nhap"><svg width="20" height="20"><use href="#i-plus"/></svg> Nhập ngày giỗ</button>' : '') + '</div>';
  }

  /* ================= TRANG CHỦ — chỉ xem, không sửa/xóa ================= */
  function ringSVG(left, size) {
    var r = 21, c = 2 * Math.PI * r, frac = left <= 0 ? 1 : Math.max(0.04, 1 - Math.min(left, 365) / 365);
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 52 52" aria-hidden="true">' +
      '<circle cx="26" cy="26" r="' + r + '" class="ring-bg"/>' +
      '<circle cx="26" cy="26" r="' + r + '" class="ring-fg" stroke-dasharray="' + (c * frac).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 26 26)"/></svg>';
  }
  function countBlock(left) {
    return left <= 0 ? '<span class="cb-n cb-today">Hôm<br>nay</span>' : '<span class="cb-n">' + left + '</span><span class="cb-u">ngày</span>';
  }

  function renderHome() {
    var t = today(), L = G.jdToLunar(t);
    var rows = withNext(state.people).sort(sortByNext);
    var next = rows[0];
    var heroAssistant = '';

    // Ca dao tục ngữ đạo hiếu truyền thống: Mỗi vế chuẩn xác 1 hàng
    var PROVERBS = [
      ['“Cây có cội mới trổ cành xanh lá,', 'Nước có nguồn mới bủa khắp rạch sông”'],
      ['“Con người có tổ có tông,', 'Như cây có cội, như sông có nguồn”'],
      ['“Công cha như núi Thái Sơn,', 'Nghĩa mẹ như nước trong nguồn chảy ra”'],
      ['“Ơn sâu dưỡng dục ngàn năm nhớ,', 'Đức trọng sinh thành vạn thuở ghi”'],
      ['“Ẩm thủy tư nguyên tâm hướng thiện,', 'Vinh hoa phú quý đức lưu truyền”']
    ];
    var prov = PROVERBS[(L.day || 1) % PROVERBS.length];

    if (!rows.length) {
      // Khi chưa có hồ sơ nào
      heroAssistant = '<div class="hh-assistant hh-card-idle">' +
        '<div class="hh-hoanhphi"><span class="hp-orn">❖</span> ẨM THỦY TƯ NGUYÊN <span class="hp-orn">❖</span></div>' +
        '<div class="hh-hp-sub">UỐNG NƯỚC NHỚ NGUỒN · VẸN TRÒN ĐẠO HIẾU</div>' +
        '<div class="hh-panel">' +
          '<div class="hh-panel-title">CHƯA CÓ NGÀY GIỖ NÀO ĐƯỢC LƯU</div>' +
          '<div class="hh-panel-sub">Nhập ngày giỗ để ứng dụng tự tính âm dương và nhắc nhở chu toàn tiết lễ gia tiên.</div>' +
        '</div>' +
        '<div class="hh-hp-caudoi">' +
          '<div class="hp-line">' + prov[0] + '</div>' +
          '<div class="hp-line">' + prov[1] + '</div>' +
        '</div>' +
        '<div class="hh-btn-center">' +
          '<button class="btn btn-gold btn-sm" type="button" data-go="nhap">' +
            '<svg width="18" height="18"><use href="#i-plus"/></svg> Nhập ngày giỗ đầu tiên</button>' +
        '</div>' +
      '</div>';
    } else if (next && next.occ && next.left <= 5) {
      // Khi ngày giỗ đến gần trong 5 ngày tới hoặc đúng hôm nay
      var o = next.occ, same = rows.filter(function (x) { return x.occ && x.occ.jd === o.jd; });
      var isToday = next.left === 0;
      var whoList = same.map(function (x) {
        return '<span class="hh-u-person"><span>' + esc(G.displayTitle(x.p)) + '</span> <b>' + esc(x.p.name) + '</b></span>';
      }).join(' · ');

      heroAssistant = '<div class="hh-assistant hh-card-urgent' + (isToday ? ' is-today' : ' is-soon') + '">' +
        '<div class="hh-urgent-header">' +
          '<span class="hh-urgent-tag">' + (isToday ? '⚡ HÔM NAY CHÍNH GIỖ ⚡' : '🔔 NHẮC LỄ GIA TIÊN · CÒN ' + next.left + ' NGÀY') + '</span>' +
        '</div>' +
        '<div class="hh-urgent-who">' + whoList + '</div>' +
        '<div class="hh-urgent-date">' +
          '<b>' + esc(lunarPhrase(o.lunarDay, o.lunarMonth, o.lunarLeap)) + ' âm lịch</b> · Dương lịch: ' + esc(solarLong(o.jd)) +
        '</div>' +
        '<p class="hh-urgent-tip">' + (isToday
          ? 'Hôm nay là ngày húy nhật thiêng liêng. Con cháu kính cẩn thắp nén tâm hương, dâng mâm cơm cúng trước án gia tiên.'
          : 'Gia đình chuẩn bị hương hoa trà quả, phẩm vật và báo tin để con cháu sắp xếp thời gian sum họp thắp hương tưởng niệm.') + '</p>' +
        '<div class="hh-urgent-actions">' +
          '<button class="btn btn-gold btn-sm" type="button" data-prayer="' + esc(next.p.id) + '">' +
            '<svg width="16" height="16"><use href="#i-book"/></svg> ' + (isToday ? 'Đọc bài văn khấn giỗ' : 'Xem bài văn khấn mẫu') + '</button>' +
          (same.length > 1
            ? '<button class="btn btn-glass btn-sm" type="button" data-cal="' + o.jd + '"><svg width="16" height="16"><use href="#i-cal"/></svg> Xem trên lịch</button>'
            : '<button class="btn btn-glass btn-sm" type="button" data-open="' + esc(next.p.id) + '"><svg width="16" height="16"><use href="#i-eye"/></svg> Chi tiết hồ sơ</button>') +
        '</div>' +
      '</div>';
    } else {
      // Khi ngày giỗ còn xa (> 5 ngày): Khung đỏ sơn mài + Hoa văn Trống Đồng Đông Sơn + Tinh gọn cân đối tuyệt đối
      var inMonthOccs = [];
      state.people.forEach(function (p) {
        var occ = G.resolveOccurrence(p, L.year);
        if (occ && occ.lunarMonth === L.month && occ.lunarLeap === L.leap) {
          inMonthOccs.push({ p: p, occ: occ });
        }
      });
      inMonthOccs.sort(function(a, b) { return a.occ.jd - b.occ.jd; });

      var centerPanelHtml = '';
      if (inMonthOccs.length > 0) {
        // Trong tháng hiện tại CÓ ngày giỗ: Liệt kê rõ ràng từng người, ngày âm & dương, không xuống dòng tùy tiện
        centerPanelHtml = '<div class="hh-panel">' +
          '<div class="hh-panel-header">THÁNG ' + monthWord(L.month).toUpperCase() + (L.leap ? ' NHUẬN' : '') + ' NÀY: GIA ĐÌNH CÓ ' + inMonthOccs.length + ' NGÀY GIỖ</div>' +
          inMonthOccs.map(function(x) {
            return '<div class="hh-panel-row">' +
              '<div class="hp-row-name"><span class="hp-rel">' + esc(G.displayTitle(x.p)) + '</span> <b class="hp-name">' + esc(x.p.name) + '</b></div>' +
              '<div class="hp-row-date">Chính giỗ: <b>' + esc(lunarPhrase(x.occ.lunarDay, x.occ.lunarMonth, x.occ.lunarLeap)) + ' ÂL</b> (' + esc(solarLong(x.occ.jd)) + ')</div>' +
            '</div>';
          }).join('') +
        '</div>';
      } else {
        // Trong tháng hiện tại KHÔNG CÓ giỗ: Nêu rõ tháng an yên và NÊU TIẾT GIỖ KẾ TIẾP (Họ tên + Ngày tháng) gọn gàng
        var nextRow = '';
        if (next && next.occ) {
          nextRow = '<div class="hh-panel-row next-target">' +
            '<div class="hp-next-label">TIẾT GIỖ GẦN NHẤT KẾ TIẾP:</div>' +
            '<div class="hp-row-name"><span class="hp-rel">' + esc(G.displayTitle(next.p)) + '</span> <b class="hp-name">' + esc(next.p.name) + '</b></div>' +
            '<div class="hp-row-date">Chính giỗ: <b>' + esc(lunarPhrase(next.occ.lunarDay, next.occ.lunarMonth, next.occ.lunarLeap)) + ' ÂL</b> · ' + esc(solarLong(next.occ.jd)) + ' <span class="hp-days">(' + countText(next.left).toLowerCase() + ')</span></div>' +
          '</div>';
        }

        centerPanelHtml = '<div class="hh-panel">' +
          '<div class="hh-panel-header">THÁNG ' + monthWord(L.month).toUpperCase() + (L.leap ? ' NHUẬN' : '') + ' NÀY: GIA ĐẠO AN YÊN · KHÔNG CÓ TIẾT GIỖ</div>' +
          nextRow +
        '</div>';
      }

      heroAssistant = '<div class="hh-assistant hh-card-idle">' +
        '<div class="hh-hoanhphi"><span class="hp-orn">❖</span> ẨM THỦY TƯ NGUYÊN <span class="hp-orn">❖</span></div>' +
        '<div class="hh-hp-sub">UỐNG NƯỚC NHỚ NGUỒN · GIA ĐẠO AN YÊN</div>' +
        centerPanelHtml +
        '<div class="hh-hp-caudoi">' +
          '<div class="hp-line">' + prov[0] + '</div>' +
          '<div class="hp-line">' + prov[1] + '</div>' +
        '</div>' +
        '<div class="hh-hp-wish">Kính chúc toàn thể gia quyến vạn sự bình an, phúc thọ trường tồn.</div>' +
      '</div>';
    }

    $('home-hero').innerHTML =
      '<div class="hh-top">' +
        '<div class="hh-date"><div class="hh-daynum">' + L.day + '</div>' +
          '<div class="hh-daytx"><div class="hh-k">Hôm nay · âm lịch</div><div class="hh-lunar">' + esc(lunarPhrase(L.day, L.month, L.leap)) + '</div>' +
          '<div class="hh-year">Năm ' + esc(G.canChiYear(L.year)) + '</div>' +
          '<div class="hh-sol">' + esc(solarLong(t)) + '</div></div></div>' +
        '<div class="hh-count"><b>' + rows.length + '</b><span>người<br>đã khuất</span></div>' +
      '</div>' + heroAssistant;

    if (!rows.length) {
      $('home-list').innerHTML = '<div class="home-empty"><div class="em-ic"><svg width="30" height="30"><use href="#i-incense"/></svg></div>' +
        '<h3>Chưa có ngày giỗ nào</h3><p>Nhập ngày giỗ âm lịch của ông bà, cha mẹ. Trang chủ sẽ tự sắp xếp và đếm ngược đến từng ngày giỗ.</p>' +
        '<button class="btn btn-red" type="button" data-go="nhap"><svg width="20" height="20"><use href="#i-plus"/></svg> Nhập ngày giỗ</button></div>';
      return;
    }
    var q = fold(state.homeQuery);
    var list = rows.filter(function (x) { return matches(x.p, q, true); });
    if (!list.length) { $('home-list').innerHTML = '<div class="home-empty"><h3>Không tìm thấy “' + esc(state.homeQuery) + '”</h3><p>Thử gõ tên hoặc danh xưng, không cần dấu.</p></div>'; return; }
    var groups = [], cur = null;
    list.forEach(function (x) {
      var o = x.occ, key = o.lunarYear + ':' + o.lunarMonth + (o.lunarLeap ? 'n' : '');
      if (!cur || cur.key !== key) { cur = { key: key, o: o, items: [] }; groups.push(cur); }
      cur.items.push(tabletHTML(x));
    });
    $('home-list').innerHTML = groups.map(function (g) {
      return '<div class="home-month"><span class="hm-orn"></span><span class="hm-tx">Tháng ' + monthWord(g.o.lunarMonth) + (g.o.lunarLeap ? ' nhuận' : '') + ' · ' + esc(G.canChiYear(g.o.lunarYear)) + '</span><span class="hm-orn"></span></div>' +
        '<div class="tv-list">' + g.items.join('') + '</div>';
    }).join('') + '<p class="home-note">Trang chủ chỉ để xem. Muốn thêm, sửa hoặc xóa, vào thẻ “Nhập giỗ”.</p>';
  }

  /* Thẻ "bài vị": thông tin một người, chạm để mở chi tiết (chỉ xem) */
  function tabletHTML(x) {
    var p = x.p, o = x.occ, open = state.homeOpen === p.id, soon = x.left <= 5;
    var nth = G.anniversaryNumber(p, o);
    var later = G.occurrencesFrom(p, o.jd + 1, 3);
    var rule = p.leap ? (p.leapRule === 'leap' ? 'Mất tháng nhuận — giỗ tháng nhuận khi năm có tháng nhuận đó' : 'Mất tháng nhuận — giỗ vào tháng thường') : '';
    var rows = [
      ['Ngày giỗ', lunarPhrase(p.day, p.month, p.leap) + ' âm lịch, hằng năm'],
      rule ? ['Quy tắc', rule] : null,
      p.day === 30 ? ['Tháng thiếu', p.missingRule === 'next' ? 'Giỗ mùng 1 tháng sau' : 'Giỗ ngày 29'] : null,
      ['Lần tới', lunarPhrase(o.lunarDay, o.lunarMonth, o.lunarLeap) + ' năm ' + G.canChiYear(o.lunarYear) + '\nDương lịch: ' + solarLong(o.jd)],
      p.deathYear ? ['Năm mất', p.deathYear + ' (' + G.canChiYear(p.deathYear) + ')' + (nth ? ' · giỗ lần thứ ' + nth : '')] : null,
      p.hometown ? ['Quê quán', p.hometown] : null,
      p.branch ? ['Chi họ', p.branch] : null,
      p.note ? ['Ghi chú', p.note] : null
    ].filter(Boolean);
    return '<article class="tv' + (soon ? ' soon' : '') + (open ? ' open' : '') + '" data-id="' + esc(p.id) + '">' +
      '<button class="tv-head" type="button" data-toggle="' + esc(p.id) + '" aria-expanded="' + open + '">' +
        '<span class="tv-medal"><span class="d">' + o.lunarDay + '</span><span class="m">' + (o.lunarLeap ? 'th.' + o.lunarMonth + ' nhuận' : 'tháng ' + o.lunarMonth) + '</span></span>' +
        '<span class="tv-main"><span class="tv-title">' + esc(G.displayTitle(p)) + '</span><span class="tv-name">' + esc(p.name) + '</span>' +
          '<span class="tv-sol">Dương lịch: ' + esc(solarLong(o.jd)) + '</span></span>' +
        '<span class="tv-ring">' + ringSVG(x.left, 56) + '<span class="tv-ring-in">' + countBlock(x.left) + '</span></span>' +
      '</button>' +
      '<div class="tv-body">' +
        '<dl class="tv-dl">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]).replace(/\n/g, '<br>') + '</dd></div>'; }).join('') + '</dl>' +
        (o.notes.length ? '<div class="tv-notes">' + o.notes.map(function (n) { return '<p>' + esc(n) + '</p>'; }).join('') + '</div>' : '') +
        (later.length ? '<div class="tv-later"><div class="tv-later-h">Các năm sau</div>' + later.map(function (l) {
          return '<div class="tv-later-r"><span>' + esc(G.canChiYear(l.lunarYear)) + '</span><span>' + esc(solarLong(l.jd)) + '</span></div>'; }).join('') + '</div>' : '') +
        '<button class="btn btn-gold btn-block" type="button" data-prayer="' + esc(p.id) + '"><svg width="18" height="18"><use href="#i-book"/></svg> Xem bài khấn giỗ</button>' +
      '</div></article>';
  }

  /* ================= Thẻ 2: Tra cứu ================= */
  function renderTraCuu() {
    var t = today();
    var rows = withNext(state.people).sort(sortByNext);
    // Thẻ ngày giỗ gần nhất
    if (!rows.length) {
      $('hero').innerHTML = emptyCard('Chưa có ngày giỗ nào', 'Nhập ngày giỗ ở thẻ “Nhập giỗ”, thông tin sẽ tự hiện ở đây và trên lịch âm dương.', true);
      $('stats').innerHTML = ''; $('alerts').innerHTML = '';
    } else {
      var top = rows[0], o = top.occ;
      var same = rows.filter(function (x) { return x.occ && x.occ.jd === o.jd; });
      var people = same.map(function (x) {
        var n = G.anniversaryNumber(x.p, x.occ);
        return '<div class="hero-person"><div class="hero-title">' + esc(G.displayTitle(x.p)) + '</div><div class="hero-name">' + esc(x.p.name) + (n ? ' <span class="hero-nth">· giỗ lần thứ ' + n + '</span>' : '') + '</div></div>';
      }).join('');
      $('hero').innerHTML = '<div class="hero">' +
        '<div class="hero-kicker">' + (top.left === 0 ? 'Hôm nay là ngày giỗ' : 'Ngày giỗ gần nhất') + (same.length > 1 ? ' · ' + same.length + ' người' : '') + '</div>' +
        '<div class="hero-row"><div class="hero-count' + (top.left === 0 ? ' today' : '') + '">' +
          (top.left === 0 ? '<span class="n">Hôm nay</span>' : '<span class="n">' + top.left + '</span><span class="u">ngày nữa</span>') + '</div>' +
          '<div class="hero-info">' + people +
          '<div class="hero-date"><b>' + esc(lunarPhrase(o.lunarDay, o.lunarMonth, o.lunarLeap)) + ' âm lịch</b> · ' + esc(G.canChiYear(o.lunarYear)) + '<br>Dương lịch: ' + esc(solarLong(o.jd)) + '</div></div></div>' +
        '<div class="hero-actions"><button class="btn btn-gold" type="button" data-prayer="' + esc(top.p.id) + '"><svg width="18" height="18"><use href="#i-book"/></svg> Bài khấn</button>' +
          (same.length > 1 ? '<button class="btn btn-glass" type="button" data-cal="' + o.jd + '"><svg width="18" height="18"><use href="#i-cal"/></svg> Xem trên lịch</button>'
            : '<button class="btn btn-glass" type="button" data-open="' + esc(top.p.id) + '"><svg width="18" height="18"><use href="#i-eye"/></svg> Chi tiết</button>') + '</div>' +
        '</div>';
      var d = G.jdToDate(t);
      var monthEnd = (d.month === 12 ? G.jdFromDate(1, 1, d.year + 1) : G.jdFromDate(1, d.month + 1, d.year)) - 1;
      var in30 = rows.filter(function (x) { return x.left <= 30; }).length;
      var inMonth = rows.filter(function (x) { return x.occ && x.occ.jd <= monthEnd; }).length;
      $('stats').innerHTML =
        '<div class="stat"><div class="v">' + rows.length + '</div><div class="k">Hồ sơ</div></div>' +
        '<div class="stat"><div class="v red">' + inMonth + '</div><div class="k">Tháng này</div></div>' +
        '<div class="stat"><div class="v">' + in30 + '</div><div class="k">Trong 30 ngày</div></div>';
      var al = rows.filter(function (x) { return x.left <= 5 && x.occ.jd !== o.jd; });
      $('alerts').innerHTML = al.map(function (x) {
        var w = '<b>' + esc(who(x.p)) + '</b>';
        var msg = x.left === 0 ? 'Hôm nay là ngày giỗ ' + w + '. Gia đình thắp hương tưởng nhớ.'
          : 'Còn ' + x.left + ' ngày nữa đến ngày giỗ ' + w + ' (' + esc(solarLong(x.occ.jd)) + '). Gia đình hãy chuẩn bị lễ thắp hương.';
        return '<div class="alert" role="alert"><div class="ico"><svg width="20" height="20"><use href="#i-incense"/></svg></div><div class="msg">' + msg + '</div></div>';
      }).join('');
    }
    // Danh sách sắp đến
    var q = fold(state.upQuery);
    var up = rows.filter(function (x) { return matches(x.p, q); });
    $('upcoming').innerHTML = !rows.length ? '' : up.length ? up.map(gcHTML).join('') : emptyCard('Không tìm thấy', 'Thử gõ tên hoặc danh xưng, không cần dấu.');
    $('seg-sapden').classList.toggle('hidden', state.seg !== 'sapden');
    $('seg-theonam').classList.toggle('hidden', state.seg !== 'theonam');
    document.querySelectorAll('.seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.seg === state.seg); b.setAttribute('aria-selected', b.dataset.seg === state.seg); });
    renderYear();
  }

  /* Ngày giỗ rơi vào năm dương lịch Y */
  function occInRange(from, to) {
    var t = today(), list = [];
    var y1 = G.jdToLunar(from).year, y2 = G.jdToLunar(to).year;
    state.people.forEach(function (p) {
      for (var ly = y1 - 1; ly <= y2; ly++) {
        var o = G.resolveOccurrence(p, ly);
        if (o && o.jd >= from && o.jd <= to) list.push({ p: p, occ: o, left: o.jd - t });
      }
    });
    return list.sort(function (a, b) { return a.occ.jd - b.occ.jd || fold(a.p.name).localeCompare(fold(b.p.name)); });
  }
  /* Theo từng năm ÂM LỊCH, chỉ các ngày giỗ từ hôm nay trở đi */
  function renderYear() {
    var t = today(), curY = G.jdToLunar(t).year;
    if (!state.lyear || state.lyear < curY) state.lyear = curY;
    var Y = state.lyear;
    var ms = G.lunarYearMonths(Y), last = ms[ms.length - 1];
    $('yr-label').textContent = 'Năm ' + G.canChiYear(Y) + ' (' + Y + ')';
    $('yr-sub').textContent = Y === curY ? 'Từ hôm nay đến hết năm âm lịch' : 'Dương lịch ' + G.solarText(ms[0].startJd) + ' – ' + G.solarText(last.startJd + last.length - 1);
    $('yr-prev').disabled = Y <= curY;
    if (!state.people.length) { $('yr-list').innerHTML = emptyCard('Chưa có ngày giỗ nào', 'Nhập ngày giỗ để xem lịch giỗ cả năm.', true); return; }
    var list = [], later = [];
    state.people.forEach(function (p) {
      var o = G.resolveOccurrence(p, Y);
      if (o && o.jd >= t) list.push({ p: p, occ: o, left: o.jd - t }); else later.push(p);
    });
    list.sort(function (a, b) { return a.occ.jd - b.occ.jd || fold(a.p.name).localeCompare(fold(b.p.name)); });
    var groups = [], cur = null;
    list.forEach(function (x) {
      var key = x.occ.lunarMonth + (x.occ.lunarLeap ? 'n' : '') + ':' + x.occ.lunarYear;
      if (!cur || cur.key !== key) { cur = { key: key, m: x.occ.lunarMonth, leap: x.occ.lunarLeap, y: x.occ.lunarYear, items: [] }; groups.push(cur); }
      cur.items.push(gcHTML(x));
    });
    var html = groups.map(function (g) {
      return '<div class="month-head">Tháng ' + monthWord(g.m) + (g.leap ? ' nhuận' : '') + ' âm lịch' + (g.y !== Y ? ' · ' + G.canChiYear(g.y) : '') + ' · ' + g.items.length + ' ngày giỗ</div><div class="list">' + g.items.join('') + '</div>';
    }).join('');
    if (!list.length) html = emptyCard('Không còn ngày giỗ nào trong năm ' + G.canChiYear(Y), 'Bấm › để xem năm ' + G.canChiYear(Y + 1) + '.');
    if (Y === curY && later.length) {
      html += '<div class="card next-year"><p>Lần giỗ tới của <b>' + later.map(function (p) { return esc(who(p)); }).join(', ') + '</b> nằm ở năm ' + esc(G.canChiYear(Y + 1)) + '.</p>' +
        '<button class="btn btn-light btn-block" type="button" id="yr-go-next">Xem năm ' + esc(G.canChiYear(Y + 1)) + ' ›</button></div>';
    }
    $('yr-list').innerHTML = html;
    var gn = $('yr-go-next'); if (gn) gn.onclick = function () { state.lyear = Y + 1; renderYear(); $('seg-theonam').scrollIntoView({ behavior: 'smooth' }); };
  }

  /* ================= Thẻ 1: Nhập ngày giỗ — danh sách ================= */
  function renderNhapList() {
    var rows = withNext(state.people);
    var q = fold(state.query);
    var all = rows.filter(function (x) { return matches(x.p, q, true); }).sort(sortByNext);
    $('count').textContent = q ? (all.length + ' / ' + rows.length + ' hồ sơ') : (rows.length + ' hồ sơ');
    $('all').innerHTML = all.length ? all.map(gcHTML).join('') :
      (rows.length ? emptyCard('Không tìm thấy “' + esc(state.query) + '”', 'Thử gõ tên, danh xưng hoặc không cần dấu.') : emptyCard('Chưa có hồ sơ nào', 'Điền biểu mẫu phía trên rồi bấm “Lưu ngày giỗ”.'));
    $('search-clear').classList.toggle('hidden', !state.query);
  }

  /* Huy hiệu trên thẻ Tra cứu: số ngày giỗ trong 5 ngày tới */
  function renderBadge() {
    var n = withNext(state.people).filter(function (x) { return x.left >= 0 && x.left <= 5; }).length;
    var b = $('nav-badge');
    b.textContent = n; b.classList.toggle('hidden', !n);
  }
  function renderHeaderDate() {
    var t = today(), L = G.jdToLunar(t);
    $('screen-sub').textContent = G.solarText(t) + ' · Âm lịch ' + G.lunarText(L.day, L.month, L.leap) + ' ' + G.canChiYear(L.year);
  }

  /* ================= Biểu mẫu thêm / sửa ================= */
  function fillSelect(sel, items) { sel.innerHTML = items.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join(''); }
  function initFormOptions() {
    fillSelect($('f-title'), [['', '— Chọn danh xưng —']].concat(TITLES.map(function (t) { return [t, t]; })));
    var days = [], months = [];
    for (var d = 1; d <= 30; d++) days.push([d, (d <= 10 ? 'Mùng ' : 'Ngày ') + d]);
    for (var m = 1; m <= 12; m++) months.push([m, monthLabel(m)]);
    fillSelect($('f-day'), days); fillSelect($('f-month'), months);
    fillSelect($('cv-day'), days); fillSelect($('cv-month'), months);
  }
  function radioVal(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  function setRadio(name, v) { var r = document.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (r) r.checked = true; }

  function readForm() {
    var y = $('f-year').value.trim();
    return {
      name: $('f-name').value.replace(/\s+/g, ' ').trim(),
      title: $('f-title').value,
      customTitle: $('f-custom').value.trim(),
      day: Number($('f-day').value),
      month: Number($('f-month').value),
      leap: $('f-leap').checked,
      leapRule: $('f-leap').checked ? radioVal('leapRule') : 'regular',
      missingRule: radioVal('missingRule') || 'last',
      deathYear: y === '' ? null : Number(y),
      hometown: $('f-home').value.trim(),
      branch: $('f-branch').value.trim(),
      note: $('f-note').value.trim()
    };
  }

  function updateFormUI() {
    var p = readForm();
    $('f-custom').classList.toggle('hidden', p.title !== 'Khác');
    $('box-leap').classList.toggle('hidden', !p.leap);
    $('box-missing').classList.toggle('hidden', p.day !== 30);
    var yh = '';
    if (p.deathYear && p.deathYear >= 1800 && p.deathYear <= 2199) {
      yh = 'Năm ' + G.canChiYear(p.deathYear);
      var lm = G.leapMonthOfYear(p.deathYear);
      yh += lm ? ' — có tháng ' + lm + ' nhuận' : ' — không có tháng nhuận';
    }
    $('f-year-hint').textContent = yh;
    // Xem trước ngày giỗ kế tiếp
    var pv = $('f-preview');
    if (p.day >= 1 && p.month >= 1) {
      var t = today(), occ = G.nextOccurrence(p, t);
      if (occ) {
        var left = occ.jd - t;
        pv.innerHTML = '<div class="label">Ngày giỗ tới</div><div class="v">' + esc(G.weekdayName(occ.jd)) + ', ' + esc(G.solarText(occ.jd)) +
          ' — ' + esc(countText(left).toLowerCase()) + '</div><div class="small">Tức ngày ' + esc(G.lunarText(occ.lunarDay, occ.lunarMonth, occ.lunarLeap)) +
          ' năm ' + esc(G.canChiYear(occ.lunarYear)) + '</div>' + occ.notes.map(function (n) { return '<div class="note">' + esc(n) + '</div>'; }).join('');
      }
    }
  }

  function resetForm() {
    state.editingId = null;
    $('form').reset();
    $('f-day').value = 1; $('f-month').value = 1;
    $('f-errors').classList.add('hidden');
    document.querySelectorAll('#form .invalid').forEach(function (el) { el.classList.remove('invalid'); });
    $('edit-banner').classList.add('hidden');
    $('btn-save-text').textContent = 'Lưu ngày giỗ';
    updateFormUI();
  }

  function openForm(p) {
    closePop();
    closeAllSheets();
    showScreen('nhap');
    resetForm();
    if (p) {
      state.editingId = p.id;
      $('f-name').value = p.name || '';
      $('f-title').value = TITLES.indexOf(p.title) >= 0 ? p.title : 'Khác';
      $('f-custom').value = p.title === 'Khác' ? (p.customTitle || '') : (TITLES.indexOf(p.title) >= 0 ? '' : p.title || '');
      $('f-day').value = p.day; $('f-month').value = p.month;
      $('f-leap').checked = !!p.leap;
      setRadio('leapRule', p.leapRule || 'regular');
      setRadio('missingRule', p.missingRule || 'last');
      $('f-year').value = p.deathYear || '';
      $('f-home').value = p.hometown || ''; $('f-branch').value = p.branch || ''; $('f-note').value = p.note || '';
      $('edit-banner').classList.remove('hidden');
      $('edit-name').textContent = G.displayTitle(p) + ' — ' + p.name;
      $('btn-save-text').textContent = 'Lưu thay đổi';
      updateFormUI();
    }
    window.scrollTo(0, 0);
    setTimeout(function () { $('f-name').focus({ preventScroll: true }); }, 150);
  }

  function submitForm(e) {
    e.preventDefault();
    var p = readForm();
    var v = G.validatePerson(p);
    document.querySelectorAll('#form .invalid').forEach(function (el) { el.classList.remove('invalid'); });
    if (!p.name) $('f-name').classList.add('invalid');
    if (!p.title) $('f-title').classList.add('invalid');
    if (p.title === 'Khác' && !p.customTitle) $('f-custom').classList.add('invalid');
    if (v.errors.length) {
      $('f-errors').innerHTML = '<ul>' + v.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      $('f-errors').classList.remove('hidden');
      $('f-errors').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    $('f-errors').classList.add('hidden');
    var go = v.warnings.length ? dialog('Xin kiểm tra lại', v.warnings.join('\n\n'), [
      { label: 'Vẫn lưu', cls: 'btn-primary', value: true }, { label: 'Quay lại sửa', value: false }]) : Promise.resolve(true);
    go.then(function (okSave) {
      if (!okSave) return;
      var old = state.editingId && findPerson(state.editingId);
      var rec = Object.assign({}, old || {}, p, { id: old ? old.id : uid(), createdAt: old ? old.createdAt : Date.now(), updatedAt: Date.now() });
      if (rec.title !== 'Khác') rec.customTitle = '';
      // 1) Cập nhật dữ liệu và cả 3 thẻ ngay lập tức
      var i = state.people.findIndex(function (x) { return x.id === rec.id; });
      if (i >= 0) state.people[i] = rec; else state.people.push(rec);
      resetForm();
      renderAll();
      // Lịch âm dương nhảy tới tháng có ngày giỗ vừa lưu
      var occ = G.nextOccurrence(rec, today());
      if (occ) { var dd = G.jdToDate(occ.jd); state.calY = dd.year; state.calM = dd.month; state.selJd = occ.jd; renderCalendar(); }
      var navBtn = document.querySelector('.nav button[data-screen=tracuu]');
      navBtn.classList.remove('pulse'); void navBtn.offsetWidth; navBtn.classList.add('pulse');
      toast((old ? 'Đã sửa ' : 'Đã lưu ') + who(rec) + (occ ? ' · giỗ tới ' + G.solarText(occ.jd) : ''), { label: 'Xem tra cứu', fn: function () { showScreen('tracuu'); } });
      var item = document.querySelector('#all .gc[data-id="' + rec.id + '"]');
      if (item) item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 2) Ghi xuống máy
      persist();
      scheduleSync();
    });
  }

  /* ================= Chi tiết ================= */
  function openDetail(id) { state.detailId = id; renderDetail(); openSheet('sheet-detail'); }
  function renderDetail() {
    var p = findPerson(state.detailId);
    if (!p) { closeSheet('sheet-detail'); return; }
    var t = today(), occs = G.occurrencesFrom(p, t, 5), next = occs[0], left = next ? next.jd - t : null;
    var rule = p.leap ? (p.leapRule === 'leap' ? 'Mất tháng nhuận — giỗ tháng nhuận (năm không có thì giỗ tháng thường)' : 'Mất tháng nhuận — giỗ tháng thường') : '';
    var rows = [
      ['Ngày giỗ', esc(G.lunarDayName(p.day)) + ' ' + esc(monthLabel(p.month).toLowerCase()) + (p.leap ? ' nhuận' : '') + ' âm lịch'],
      rule ? ['Quy tắc', esc(rule)] : null,
      p.day === 30 ? ['Tháng thiếu', p.missingRule === 'next' ? 'Giỗ mùng 1 tháng sau' : 'Giỗ ngày 29'] : null,
      p.deathYear ? ['Năm mất', esc(p.deathYear) + ' (' + esc(G.canChiYear(p.deathYear)) + ')'] : null,
      p.hometown ? ['Quê quán', esc(p.hometown)] : null,
      p.branch ? ['Chi họ', esc(p.branch)] : null,
      p.note ? ['Ghi chú', esc(p.note).replace(/\n/g, '<br>')] : null
    ].filter(Boolean);
    var nth = G.anniversaryNumber(p, next);
    $('detail-body').innerHTML =
      (next ? '<div class="hero">' +
        '<div class="hero-kicker">' + esc(G.displayTitle(p)) + '</div>' +
        '<div class="hero-row"><div class="hero-count' + (left === 0 ? ' today' : '') + '">' + (left === 0 ? '<span class="n">Hôm nay</span>' : '<span class="n">' + left + '</span><span class="u">ngày nữa</span>') + '</div>' +
        '<div class="hero-info"><div class="hero-name">' + esc(p.name) + '</div><div class="hero-date"><b>' + esc(lunarPhrase(next.lunarDay, next.lunarMonth, next.lunarLeap)) + ' âm lịch</b> · ' + esc(G.canChiYear(next.lunarYear)) + (nth ? ' · giỗ lần thứ ' + nth : '') + '<br>Dương lịch: ' + esc(solarLong(next.jd)) + '</div></div></div>' +
        next.notes.map(function (n) { return '<div class="hero-date" style="color:#ffe3a3">' + esc(n) + '</div>'; }).join('') +
        '<div class="hero-actions"><button class="btn btn-gold" type="button" data-prayer="' + esc(p.id) + '"><svg width="18" height="18"><use href="#i-book"/></svg> Bài khấn</button>' +
        '<button class="btn btn-glass" type="button" data-cal="' + next.jd + '"><svg width="18" height="18"><use href="#i-cal"/></svg> Xem trên lịch</button></div></div>' : '') +
      '<div class="card" style="margin-top:12px"><dl class="rows">' + rows.map(function (r) { return '<div class="row"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl></div>' +
      '<div class="section-title"><span>Các năm tới</span></div>' +
      '<div class="card">' + occs.map(function (o) {
        return '<div class="occ"><div class="y">Năm ' + esc(G.canChiYear(o.lunarYear)) + ' (' + o.lunarYear + ')</div><div class="s">' + esc(solarLong(o.jd)) + '</div>' +
          o.notes.map(function (n) { return '<div class="n">' + esc(n) + '</div>'; }).join('') + '</div>';
      }).join('') + '</div>' +
      '<div class="btn-row">' +
        '<button class="btn btn-primary" type="button" data-edit="' + esc(p.id) + '" id="d-edit2"><svg width="20" height="20"><use href="#i-edit"/></svg> Sửa</button>' +
        '<button class="btn btn-ghost-red" type="button" data-del="' + esc(p.id) + '" id="d-del"><svg width="20" height="20"><use href="#i-trash"/></svg> Xóa</button>' +
      '</div>' +
      '<button class="btn btn-light btn-block" style="margin-top:10px" type="button" id="d-ics"><svg width="20" height="20"><use href="#i-cal"/></svg> Thêm vào Lịch điện thoại</button>';
    $('d-ics').onclick = function () { exportICS([p], 'ngay-gio-' + fold(p.name).replace(/[^a-z0-9]+/g, '-') + '.ics'); };
  }

  function confirmDelete(p) {
    return dialog('Xóa ngày giỗ?', 'Xóa hồ sơ ' + who(p) + ' khỏi danh sách, tra cứu và lịch âm dương.', [
      { label: 'Xóa hồ sơ', cls: 'btn-red', value: true }, { label: 'Không xóa', value: false }
    ]).then(function (yes) {
      if (!yes) return false;
      state.people = state.people.filter(function (x) { return x.id !== p.id; });
      if (state.editingId === p.id) resetForm();
      closePop();
      if (state.detailId === p.id) closeSheet('sheet-detail');
      renderAll(); persist(); scheduleSync();
      toast('Đã xóa ' + who(p), { label: 'Hoàn tác', fn: function () {
        state.people.push(p); renderAll(); persist(); scheduleSync(); toast('Đã khôi phục hồ sơ');
      } });
      return true;
    });
  }

  /* ================= Màn hình phủ & điều hướng ================= */
  var openSheets = [], skipPop = 0;
  function openSheet(id) {
    var el = $(id);
    if (!el.classList.contains('open')) {
      el.classList.add('open'); el.scrollTop = 0; openSheets.push(id);
      try { history.pushState({ sheet: id }, ''); } catch (e) {}
    }
  }
  function closeSheet(id, fromPop) {
    var el = $(id);
    if (!el.classList.contains('open')) return;
    el.classList.remove('open');
    openSheets = openSheets.filter(function (x) { return x !== id; });
    if (id === 'sheet-detail') state.detailId = null;
    if (!fromPop) { skipPop++; try { history.back(); } catch (e) { skipPop--; } }
  }
  window.addEventListener('popstate', function () {
    if (skipPop > 0) { skipPop--; return; }
    if ($('modal').classList.contains('open')) { $('modal').classList.remove('open'); try { history.pushState({}, ''); } catch (e) {} return; }
    var last = openSheets[openSheets.length - 1];
    if (last) closeSheet(last, true);
  });

  function closeAllSheets() { openSheets.slice().reverse().forEach(function (id) { closeSheet(id); }); }

  var SCREENS = {
    trangchu: ['Tra cứu ngày giỗ', ''],
    nhap: ['Nhập ngày giỗ', 'Thêm, sửa hồ sơ người đã khuất'],
    tracuu: ['Tra cứu ngày giỗ hằng năm', 'Ngày giỗ sắp đến và theo từng năm'],
    lich: ['Xem lịch âm dương', 'Lịch tháng, đổi ngày âm – dương'],
    baicung: ['Các bài cúng tham khảo', 'Văn khấn giỗ, hằng tháng, lễ Tết']
  };
  function showScreen(name) {
    if (!SCREENS[name]) name = 'trangchu';
    state.screen = name;
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === 'screen-' + name); });
    document.querySelectorAll('.nav button').forEach(function (b) { b.classList.toggle('active', b.dataset.screen === name); });
    $('screen-title').textContent = SCREENS[name][0];
    renderHeaderDate();
    window.scrollTo(0, 0);
    try { history.replaceState(history.state, '', '#' + name); } catch (e) {}
    if (name === 'lich') renderConvert();
    if (name === 'baicung') renderBaiCung();
    if (name === 'tracuu') renderTraCuu();
    if (name === 'trangchu') renderHome();
    closePop();
  }
  function openSettings() { renderSettings(); openSheet('sheet-settings'); }

  /* ================= Đổi lịch ================= */
  function renderConvert() {
    var t = today(), L = G.jdToLunar(t);
    if (!$('cv-solar').value) { $('cv-solar').value = G.isoDate(t); }
    if (!$('cv-year').value) { $('cv-year').value = L.year; $('cv-day').value = L.day; $('cv-month').value = L.month; }
    if (state.mtYear == null) state.mtYear = L.year;
    convertSolar(); convertLunar(); renderMonthTable(); renderCalendar();
  }
  function convertSolar() {
    var v = $('cv-solar').value, out = $('cv-solar-result');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { out.innerHTML = ''; return; }
    var a = v.split('-').map(Number);
    if (a[0] < 1800 || a[0] > 2199) { out.innerHTML = '<div class="result"><div class="v red">Chỉ hỗ trợ năm 1800–2199.</div></div>'; return; }
    var j = G.jdFromDate(a[2], a[1], a[0]), L = G.jdToLunar(j);
    var m = G.lunarYearMonths(L.year).find(function (x) { return x.month === L.month && x.leap === L.leap; });
    out.innerHTML = '<div class="result"><div class="small">' + esc(G.weekdayName(j)) + ', ' + esc(G.solarText(j)) + ' là ngày</div>' +
      '<div class="v red">' + esc(G.lunarDayName(L.day)) + ' ' + esc(monthLabel(L.month).toLowerCase()) + (L.leap ? ' nhuận' : '') + '</div>' +
      '<div class="v">Năm ' + esc(G.canChiYear(L.year)) + ' (' + L.year + ')</div>' +
      '<div class="small">Tháng này ' + (m && m.length === 30 ? 'đủ (30 ngày)' : 'thiếu (29 ngày)') + '.</div></div>';
  }
  function convertLunar() {
    var d = Number($('cv-day').value), m = Number($('cv-month').value), y = Number($('cv-year').value), leap = $('cv-leap').checked, out = $('cv-lunar-result');
    if (!(y >= 1800 && y <= 2199)) { out.innerHTML = '<div class="result"><div class="v red">Nhập năm từ 1800 đến 2199.</div></div>'; return; }
    var j = G.lunarToJd(d, m, y, leap);
    if (j == null) {
      var lm = G.leapMonthOfYear(y), msg;
      if (leap && lm !== m) msg = 'Năm ' + y + ' (' + G.canChiYear(y) + ') ' + (lm ? 'chỉ có tháng ' + lm + ' nhuận.' : 'không có tháng nhuận.');
      else msg = monthLabel(m) + (leap ? ' nhuận' : '') + ' năm ' + y + ' chỉ có 29 ngày, không có ngày 30.';
      out.innerHTML = '<div class="result"><div class="v red">Ngày này không tồn tại.</div><div class="small">' + esc(msg) + '</div></div>';
      return;
    }
    out.innerHTML = '<div class="result"><div class="small">' + esc(G.lunarDayName(d)) + ' ' + esc(monthLabel(m).toLowerCase()) + (leap ? ' nhuận' : '') + ' năm ' + esc(G.canChiYear(y)) + ' là</div>' +
      '<div class="v red">' + esc(G.weekdayName(j)) + ', ' + esc(G.solarText(j)) + '</div></div>';
  }
  function renderMonthTable() {
    var Y = state.mtYear, t = today();
    $('mt-title').textContent = 'Các tháng âm lịch năm ' + G.canChiYear(Y) + ' (' + Y + ')';
    $('mt-body').innerHTML = G.lunarYearMonths(Y).map(function (m) {
      var cur = t >= m.startJd && t < m.startJd + m.length;
      return '<tr class="' + (m.leap ? 'leap ' : '') + (cur ? 'cur' : '') + '"><td>' + m.month + (m.leap ? ' nhuận' : '') + '</td><td>' + esc(G.weekdayName(m.startJd).replace('Chủ nhật', 'CN').replace('Thứ ', 'T')) + ', ' + esc(G.solarText(m.startJd)) + '</td><td>' + m.length + (m.length === 30 ? ' (đủ)' : ' (thiếu)') + '</td></tr>';
    }).join('');
  }

  /* ================= Thẻ 3: Lịch âm dương ================= */
  function gioOnDay(jd) { return occInRange(jd, jd); }

  function renderCalendar() {
    var t = today(), Y = state.calY, M = state.calM;
    var first = G.jdFromDate(1, M, Y);
    var nextFirst = M === 12 ? G.jdFromDate(1, 1, Y + 1) : G.jdFromDate(1, M + 1, Y);
    var days = nextFirst - first;
    var offset = ((first + 1) % 7 + 6) % 7; // lịch bắt đầu từ Thứ hai
    var L1 = G.jdToLunar(first), L2 = G.jdToLunar(nextFirst - 1);
    $('cal-title').textContent = 'Tháng ' + M + ' / ' + Y;
    $('cal-sub').textContent = 'Âm lịch: tháng ' + L1.month + (L1.leap ? ' nhuận' : '') + (L1.month !== L2.month || L1.leap !== L2.leap ? ' – ' + L2.month + (L2.leap ? ' nhuận' : '') : '') + ' · ' + G.canChiYear(L2.year);
    var monthGio = occInRange(first, nextFirst - 1);
    var marks = {};
    monthGio.forEach(function (x) { (marks[x.occ.jd] = marks[x.occ.jd] || []).push(x); });
    var html = '';
    for (var i = 0; i < offset; i++) html += '<span class="cal-day out"></span>';
    for (var d = 0; d < days; d++) {
      var jd = first + d, L = G.jdToLunar(jd), isSun = (jd + 1) % 7 === 0, g = marks[jd];
      var cls = 'cal-day' + (isSun ? ' sun' : '') + (jd === t ? ' today' : '') + (g ? ' gio' : (jd === state.selJd ? ' sel' : ''));
      var lun = L.day === 1 ? '1/' + L.month + (L.leap ? 'n' : '') : String(L.day);
      var label = (d + 1) + '/' + M + ', âm lịch ' + L.day + '/' + L.month + (g ? ', ngày giỗ ' + g.map(function (x) { return who(x.p); }).join(', ') : '');
      html += '<button type="button" class="' + cls + '" data-jd="' + jd + '" aria-label="' + esc(label) + '">' +
        (g && g.length > 1 ? '<span class="cnt">' + g.length + '</span>' : '') +
        '<span class="s">' + (d + 1) + '</span><span class="l' + (L.day === 1 || L.day === 15 ? ' m1' : '') + '">' + lun + '</span></button>';
    }
    $('cal-grid').innerHTML = html;
    $('cal-list-title').textContent = 'Ngày giỗ trong tháng ' + M + '/' + Y;
    $('cal-count').textContent = monthGio.length ? monthGio.length + ' ngày giỗ' : '';
    $('cal-list').innerHTML = monthGio.length ? monthGio.map(gcHTML).join('') :
      emptyCard(state.people.length ? 'Tháng này không có ngày giỗ' : 'Chưa có ngày giỗ nào', state.people.length ? 'Bấm ‹ › để xem tháng khác.' : 'Ngày giỗ đã nhập sẽ hiện thành nút đỏ trên lịch.', !state.people.length);
    renderDayInfo();
  }

  function renderDayInfo() {
    var jd = state.selJd, L = G.jdToLunar(jd), t = today();
    var m = G.lunarYearMonths(L.year).find(function (x) { return x.month === L.month && x.leap === L.leap; });
    var gio = gioOnDay(jd);
    var diff = jd - t;
    var rel = diff === 0 ? 'Hôm nay' : diff > 0 ? (diff === 1 ? 'Ngày mai' : 'Còn ' + diff + ' ngày') : (diff === -1 ? 'Hôm qua' : (-diff) + ' ngày trước');
    $('day-info').innerHTML =
      '<div class="info-big">' + esc(solarLong(jd)) + ' <span class="small" style="font-weight:600;color:var(--ink-2)">· ' + esc(rel) + '</span></div>' +
      '<div class="info-red">' + esc(G.lunarDayName(L.day)) + ' ' + esc(monthLabel(L.month).toLowerCase()) + (L.leap ? ' nhuận' : '') + ' năm ' + esc(G.canChiYear(L.year)) + '</div>' +
      '<dl class="kv"><dt>Ngày</dt><dd>' + esc(G.canChiDay(jd)) + '</dd>' +
        '<dt>Tháng</dt><dd>' + esc(G.canChiMonth(L.month, L.year)) + (m ? ' (' + (m.length === 30 ? 'tháng đủ' : 'tháng thiếu') + ')' : '') + '</dd>' +
        '<dt>Năm</dt><dd>' + esc(G.canChiYear(L.year)) + '</dd>' +
        (gio.length ? '<dt>Ngày giỗ</dt><dd class="red bold">' + gio.map(function (x) { return esc(who(x.p)); }).join('<br>') + '</dd>' : '') +
      '</dl>';
  }

  /* Cửa sổ khi chạm vào ngày giỗ trên lịch */
  function openPop(jd) {
    var list = gioOnDay(jd);
    if (!list.length) return;
    var L = G.jdToLunar(jd), t = today(), diff = jd - t;
    $('pop-title').textContent = solarLong(jd);
    $('pop-sub').textContent = 'Tức ' + G.lunarText(L.day, L.month, L.leap) + ' âm lịch · ' + G.canChiYear(L.year) + ' · ' + (diff < 0 ? (-diff) + ' ngày trước' : countText(diff));
    $('pop-body').innerHTML = list.map(function (x) {
      var p = x.p, nth = G.anniversaryNumber(p, x.occ);
      return '<div class="pop-person"><div class="pt">' + esc(G.displayTitle(p)) + '</div><div class="pn">' + esc(p.name) + '</div>' +
        '<div class="pm">' + esc([p.deathYear ? 'Mất năm ' + p.deathYear : '', nth ? 'giỗ lần thứ ' + nth : '', p.hometown || ''].filter(Boolean).join(' · ')) + '</div>' +
        x.occ.notes.map(function (n) { return '<div class="note">' + esc(n) + '</div>'; }).join('') +
        '<div class="pop-actions">' +
          '<button class="btn btn-gold" type="button" data-prayer="' + esc(p.id) + '"><svg width="16" height="16"><use href="#i-book"/></svg> Bài khấn</button>' +
          '<button class="btn btn-light" type="button" data-open="' + esc(p.id) + '"><svg width="16" height="16"><use href="#i-eye"/></svg> Chi tiết</button>' +
          '<button class="btn btn-primary" type="button" data-edit="' + esc(p.id) + '"><svg width="16" height="16"><use href="#i-edit"/></svg> Sửa</button>' +
          '<button class="btn btn-ghost-red" type="button" data-del="' + esc(p.id) + '"><svg width="16" height="16"><use href="#i-trash"/></svg> Xóa</button>' +
        '</div></div>';
    }).join('');
    $('pop').classList.add('open');
  }
  function closePop() { $('pop').classList.remove('open'); }

  /* ================= Thẻ 4: Bài cúng ================= */
  function prayerTarget(b, personId) {
    var t = today(), w = b.when;
    if (w.type === 'gio' || w.type === 'tienthuong') {
      var p = state.people.find(function (x) { return x.id === personId; });
      if (!p) return { p: null };
      var o = G.nextOccurrence(p, w.type === 'tienthuong' ? t + 1 : t);
      if (!o) return { p: p };
      var jd = w.type === 'tienthuong' ? o.jd - 1 : o.jd, L = G.jdToLunar(jd);
      return { p: p, jd: jd, day: L.day, month: L.month, leap: L.leap, year: L.year };
    }
    var r = G.nextLunarDate(w.day, w.month, t, true);
    return r ? { jd: r.jd, day: r.day, month: r.month, leap: r.leap, year: r.year } : {};
  }
  function fillPrayer(text, tg) {
    var s = state.settings, p = tg.p;
    var map = {
      tinchu: s.tinchu, diachi: s.diachi, ho: s.ho,
      ngay: tg.day ? (tg.day <= 10 ? 'mùng ' + tg.day : String(tg.day)) : '',
      thang: tg.month ? (tg.month === 1 ? 'Giêng' : tg.month === 12 ? 'Chạp' : String(tg.month)) + (tg.leap ? ' nhuận' : '') : '',
      nam: tg.year ? G.canChiYear(tg.year) : '',
      danhxung: p ? G.displayTitle(p) : '', tenmat: p ? p.name : ''
    };
    return esc(text).replace(/\{(\w+)\}/g, function (_, k) {
      var v = map[k];
      return v ? '<span class="fill">' + esc(v) + '</span>' : '<span class="blank">……</span>';
    });
  }
  function prayerHTML(b) {
    var isGio = b.when.type === 'gio' || b.when.type === 'tienthuong';
    var pid = state.bcPerson[b.id] || (state.people.length ? withNext(state.people).sort(sortByNext)[0].p.id : '');
    var tg = prayerTarget(b, pid);
    var next = tg.jd != null ? 'Lần cúng tới: ' + G.weekdayName(tg.jd) + ', ' + G.solarText(tg.jd) + ' (' + G.lunarText(tg.day, tg.month, tg.leap) + ' âm lịch)' : (isGio ? 'Chọn người được giỗ để tự điền' : '');
    var sel = '';
    if (isGio) {
      sel = state.people.length ? '<div class="field" style="margin-top:12px"><label>Bài khấn cho</label><select class="input bc-person" data-bid="' + b.id + '">' +
        withNext(state.people).sort(sortByNext).map(function (x) { return '<option value="' + esc(x.p.id) + '"' + (x.p.id === pid ? ' selected' : '') + '>' + esc(G.displayTitle(x.p) + ' — ' + x.p.name) + '</option>'; }).join('') +
        '</select></div>' : '<p class="hint red">Chưa có hồ sơ nào — nhập ngày giỗ để bài khấn tự điền tên và ngày.</p>';
    }
    return '<details class="card prayer" data-bid="' + b.id + '"' + (state.bcOpen === b.id ? ' open' : '') + '><summary><span><span class="p-title">' + esc(b.ten) + '</span>' +
      (next ? '<span class="p-next">' + esc(next) + '</span>' : '') + '</span></summary><div class="content">' +
      '<p class="p-meta"><b>Thời gian:</b> ' + esc(b.khi) + '</p>' +
      '<p class="p-meta"><b>Lễ vật gợi ý:</b> ' + esc(b.levat) + '</p>' + sel +
      '<div class="p-text" id="pt-' + b.id + '">' + fillPrayer(b.van, tg) + '</div>' +
      '<div class="p-tools"><button class="btn btn-light btn-copy" type="button" data-bid="' + b.id + '"><svg width="20" height="20"><use href="#i-copy"/></svg> Sao chép bài khấn</button></div>' +
      '</div></details>';
  }
  function renderBaiCung() {
    var list = window.BaiCung || [];
    var groups = ['Tất cả'];
    list.forEach(function (b) { if (groups.indexOf(b.nhom) < 0) groups.push(b.nhom); });
    if (groups.indexOf(state.bcGroup) < 0) state.bcGroup = 'Tất cả';
    $('bc-chips').innerHTML = groups.map(function (g) { return '<button type="button" class="chip' + (g === state.bcGroup ? ' on' : '') + '" data-group="' + esc(g) + '">' + esc(g) + '</button>'; }).join('');
    $('bc-tinchu').value = state.settings.tinchu || ''; $('bc-diachi').value = state.settings.diachi || ''; $('bc-ho').value = state.settings.ho || '';
    if (!state.settings.tinchu && !$('bc-info').dataset.touched) $('bc-info').open = true;
    var html = '', lastG = '';
    list.filter(function (b) { return state.bcGroup === 'Tất cả' || b.nhom === state.bcGroup; }).forEach(function (b) {
      if (b.nhom !== lastG) { html += '<div class="month-head">' + esc(b.nhom) + '</div>'; lastG = b.nhom; }
      html += prayerHTML(b);
    });
    $('bc-list').innerHTML = html;
  }
  function copyPrayer(bid) {
    var el = $('pt-' + bid); if (!el) return;
    var text = el.innerText;
    var done = function () { toast('Đã sao chép bài khấn'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Không sao chép được'); } ta.remove();
    }
  }

  /* ================= Sao lưu / khôi phục ================= */
  function stamp() { var t = today(); return G.isoDate(t); }
  function deliverFile(name, mime, text) {
    var blob = new Blob([text], { type: mime });
    var file;
    try { file = new File([blob], name, { type: mime }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: name }).then(function () { return true; }).catch(function (e) {
        if (e && e.name === 'AbortError') return false;
        download(blob, name); return true;
      });
    }
    download(blob, name);
    return Promise.resolve(true);
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }
  function exportBackup() {
    var data = { ung_dung: 'tra-cuu-ngay-gio', phien_ban: 1, ngay_sao_luu: new Date().toISOString(), so_ho_so: state.people.length, people: state.people };
    deliverFile('sao-luu-ngay-gio-' + stamp() + '.json', 'application/json', JSON.stringify(data, null, 2)).then(function (done) {
      if (!done) return;
      state.settings.lastBackup = Date.now(); saveSettings(); renderSettings();
      toast('Đã tạo tệp sao lưu ' + state.people.length + ' hồ sơ');
    });
  }
  function cleanImported(p) {
    var r = {
      id: typeof p.id === 'string' && p.id ? p.id.slice(0, 64) : uid(),
      name: String(p.name || '').slice(0, 80).trim(),
      title: String(p.title || '').slice(0, 40),
      customTitle: String(p.customTitle || '').slice(0, 40),
      day: Number(p.day), month: Number(p.month), leap: !!p.leap,
      leapRule: p.leapRule === 'leap' ? 'leap' : 'regular',
      missingRule: p.missingRule === 'next' ? 'next' : 'last',
      deathYear: p.deathYear ? Number(p.deathYear) : null,
      hometown: String(p.hometown || '').slice(0, 120), branch: String(p.branch || '').slice(0, 120), note: String(p.note || '').slice(0, 1000),
      createdAt: Number(p.createdAt) || Date.now(), updatedAt: Number(p.updatedAt) || Date.now()
    };
    if (r.title && r.title !== 'Khác' && TITLES.indexOf(r.title) < 0) { r.customTitle = r.title; r.title = 'Khác'; }
    return r;
  }
  function importBackup(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var data;
      try { data = JSON.parse(rd.result); } catch (e) { return dialog('Không đọc được tệp', 'Tệp này không phải tệp sao lưu của ứng dụng.', [{ label: 'Đóng', value: 0 }]); }
      var list = Array.isArray(data) ? data : data && data.people;
      if (!Array.isArray(list)) return dialog('Không đọc được tệp', 'Tệp này không có danh sách hồ sơ.', [{ label: 'Đóng', value: 0 }]);
      var good = [], bad = 0;
      list.forEach(function (p) { var c = cleanImported(p || {}); if (G.validatePerson(c).errors.length) bad++; else good.push(c); });
      if (!good.length) return dialog('Không có hồ sơ hợp lệ', 'Tệp không có hồ sơ nào đọc được.', [{ label: 'Đóng', value: 0 }]);
      var msg = 'Tìm thấy ' + good.length + ' hồ sơ hợp lệ' + (bad ? ' (bỏ qua ' + bad + ' hồ sơ lỗi)' : '') + '.\nHiện có ' + state.people.length + ' hồ sơ trên máy.\n\n• Gộp: giữ hồ sơ hiện có, thêm hồ sơ mới, cập nhật hồ sơ trùng.\n• Thay thế: xóa toàn bộ hồ sơ hiện có rồi nạp từ tệp.';
      dialog('Khôi phục dữ liệu', msg, [
        { label: 'Gộp vào dữ liệu hiện có', cls: 'btn-primary', value: 'merge' },
        { label: 'Thay thế toàn bộ', cls: 'btn-ghost-red', value: 'replace' },
        { label: 'Hủy', value: null }
      ]).then(function (mode) {
        if (!mode) return;
        var next;
        if (mode === 'replace') next = good;
        else {
          var map = {}; state.people.forEach(function (p) { map[p.id] = p; }); good.forEach(function (p) { map[p.id] = p; });
          next = Object.keys(map).map(function (k) { return map[k]; });
        }
        var go = mode === 'replace' && state.people.length ? dialog('Chắc chắn thay thế?', 'Toàn bộ ' + state.people.length + ' hồ sơ hiện có sẽ bị thay bằng ' + good.length + ' hồ sơ trong tệp.', [
          { label: 'Đồng ý thay thế', cls: 'btn-red', value: true }, { label: 'Hủy', value: false }]) : Promise.resolve(true);
        go.then(function (yes) {
          if (!yes) return;
          state.people = next; renderAll(); persist(); scheduleSync();
          toast('Đã khôi phục — hiện có ' + next.length + ' hồ sơ');
        });
      });
    };
    rd.readAsText(file);
  }

  /* ================= Xuất lịch .ics ================= */
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) {
    var out = [], cur = '', bytes = 0, enc = new TextEncoder();
    for (var ch of line) {
      var b = enc.encode(ch).length;
      if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  function ymd(jd) { return G.isoDate(jd).replace(/-/g, ''); }
  function buildICS(people) {
    var t = today(), L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tra cuu ngay gio//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Ngày giỗ', 'X-WR-TIMEZONE:Asia/Ho_Chi_Minh'];
    var now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    people.forEach(function (p) {
      G.occurrencesFrom(p, t, 10).forEach(function (o) {
        var who = G.displayTitle(p) + ' — ' + p.name;
        var desc = 'Ngày ' + G.lunarText(o.lunarDay, o.lunarMonth, o.lunarLeap) + ' âm lịch, năm ' + G.canChiYear(o.lunarYear) + '.';
        var nth = G.anniversaryNumber(p, o); if (nth) desc += ' Giỗ lần thứ ' + nth + '.';
        if (o.notes.length) desc += '\n' + o.notes.join('\n');
        L.push('BEGIN:VEVENT', 'UID:' + p.id + '-' + o.lunarYear + '@tra-cuu-ngay-gio', 'DTSTAMP:' + now,
          'DTSTART;VALUE=DATE:' + ymd(o.jd), 'DTEND;VALUE=DATE:' + ymd(o.jd + 1),
          'SUMMARY:' + icsEsc('Giỗ ' + who), 'DESCRIPTION:' + icsEsc(desc), 'TRANSP:TRANSPARENT',
          'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P4DT16H', 'DESCRIPTION:' + icsEsc('Còn 5 ngày nữa đến ngày giỗ ' + who + '. Gia đình hãy chuẩn bị lễ thắp hương.'), 'END:VALARM',
          'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT7H', 'DESCRIPTION:' + icsEsc('Hôm nay là ngày giỗ ' + who + '.'), 'END:VALARM',
          'END:VEVENT');
      });
    });
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
  }
  function exportICS(people, name) {
    if (!people.length) { toast('Chưa có hồ sơ nào để đưa vào lịch'); return; }
    deliverFile(name || ('ngay-gio-' + stamp() + '.ics'), 'text/calendar', buildICS(people)).then(function (done) {
      if (done) dialog('Đã tạo tệp lịch', 'Mở tệp vừa tạo bằng ứng dụng Lịch (Calendar) và bấm “Thêm tất cả”.\n\nGoogle Lịch có thể bỏ qua giờ nhắc trong tệp; khi đó hãy đặt thông báo mặc định cho lịch “Ngày giỗ” là 5 ngày.', [{ label: 'Đã hiểu', cls: 'btn-primary', value: 1 }]);
    });
  }

  /* ================= Thông báo đẩy ================= */
  var swReg = null;
  function swOK() { return location.protocol !== 'file:' && safe(function () { return 'serviceWorker' in navigator && !!navigator.serviceWorker; }, false); }
  function pushSupported() { return swOK() && safe(function () { return 'PushManager' in window && 'Notification' in window; }, false); }
  function b64ToU8(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4), s = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a;
  }
  function serverStatus() {
    if (state.serverStatus) return Promise.resolve(state.serverStatus);
    return fetch('/api/status', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (s) { state.serverStatus = s; return s; })
      .catch(function () { return { push: false, reason: 'offline' }; });
  }
  function minimalPeople() {
    return state.people.map(function (p) {
      return { id: p.id, name: p.name, title: p.title, customTitle: p.customTitle, day: p.day, month: p.month, leap: !!p.leap, leapRule: p.leapRule, missingRule: p.missingRule };
    });
  }
  function getSub() { return swReg ? swReg.pushManager.getSubscription() : Promise.resolve(null); }
  function syncServer() {
    if (!state.settings.pushEnabled) return Promise.resolve(false);
    return getSub().then(function (sub) {
      if (!sub) { state.settings.pushEnabled = false; saveSettings(); return false; }
      return fetch('/api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), people: minimalPeople(), settings: { dayOf: !!state.settings.dayOf } })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        state.settings.lastSync = Date.now(); saveSettings(); return true;
      });
    }).catch(function () { state.settings.syncError = Date.now(); saveSettings(); return false; });
  }
  var syncTimer;
  function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(function () { syncServer().then(function () { if ($('sheet-settings').classList.contains('open')) renderSettings(); }); }, 800); }

  function enablePush() {
    if (!pushSupported()) return toast('Thiết bị này chưa hỗ trợ thông báo');
    if (isIOS() && !isStandalone()) {
      return dialog('Cần cài ứng dụng trước', 'Trên iPhone/iPad, hãy cài ứng dụng ra Màn hình chính (xem hướng dẫn ở mục “Cài ứng dụng”), mở ứng dụng từ biểu tượng, rồi bật thông báo.', [{ label: 'Đã hiểu', cls: 'btn-primary', value: 1 }]);
    }
    serverStatus().then(function (s) {
      if (!s.push) return dialog('Máy chủ chưa cấu hình', 'Máy chủ nhắc giỗ chưa được cấu hình (khóa VAPID hoặc cơ sở dữ liệu). Xem hướng dẫn triển khai. Trong lúc chờ, hãy dùng “Thêm vào Lịch của điện thoại”.', [{ label: 'Đã hiểu', cls: 'btn-primary', value: 1 }]);
      return Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') {
          return dialog('Chưa được cấp quyền', 'Anh/chị chưa cho phép thông báo. Vào Cài đặt điện thoại → Thông báo → cho phép ứng dụng (hoặc Chrome) gửi thông báo, sau đó bấm lại.', [{ label: 'Đã hiểu', cls: 'btn-primary', value: 1 }]);
        }
        return getSub().then(function (sub) {
          return sub || swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(s.publicKey) });
        }).then(function () {
          state.settings.pushEnabled = true; saveSettings();
          return syncServer();
        }).then(function (ok) {
          renderSettings();
          toast(ok ? 'Đã bật thông báo nhắc giỗ' : 'Đã bật trên máy, nhưng chưa gửi được lên máy chủ. Sẽ thử lại khi có mạng.');
        });
      });
    }).catch(function (e) { toast('Không bật được thông báo: ' + (e && e.message || 'lỗi')); renderSettings(); });
  }
  function disablePush() {
    getSub().then(function (sub) {
      if (!sub) return;
      fetch('/api/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(function () {});
      return sub.unsubscribe();
    }).then(function () { state.settings.pushEnabled = false; saveSettings(); renderSettings(); toast('Đã tắt thông báo'); });
  }
  function testPush() {
    getSub().then(function (sub) {
      if (!sub) return toast('Chưa bật thông báo');
      return fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) { toast(x.ok ? 'Đã gửi thông báo thử — kiểm tra thanh thông báo' : (x.j.error || 'Gửi thử không thành công')); });
    }).catch(function () { toast('Không kết nối được máy chủ'); });
  }

  /* Nhắc trong ứng dụng khi máy chủ chưa bật: hiện thông báo khi mở ứng dụng (một lần mỗi mốc) */
  function localNotify() {
    if (state.settings.pushEnabled || !swReg || !pushSupported() || Notification.permission !== 'granted') return;
    var t = today();
    getMeta('shown').then(function (shown) {
      shown = shown || {};
      var changed = false;
      withNext(state.people).forEach(function (x) {
        if (x.left > 5) return;
        var key = x.p.id + ':' + x.occ.jd + ':' + (x.left === 0 ? 'd0' : 'd5');
        if (shown[key]) return;
        shown[key] = t; changed = true;
        swReg.showNotification('Nhắc ngày giỗ', { body: G.reminderText(x.p, x.occ, x.left), icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'gio-' + x.p.id, data: { url: '/' } });
      });
      Object.keys(shown).forEach(function (k) { if (t - shown[k] > 60) { delete shown[k]; changed = true; } });
      if (changed) setMeta('shown', shown);
    });
  }

  /* ================= Cài đặt ================= */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; renderInstall(); });
  window.addEventListener('appinstalled', function () { deferredPrompt = null; renderInstall(); toast('Đã cài ứng dụng lên màn hình chính'); });

  function renderInstall() {
    var help = $('install-help'), banner = $('install-banner');
    if (isStandalone()) {
      help.innerHTML = '<span class="status ok">✓ Đang chạy như ứng dụng đã cài</span>';
      banner.classList.add('hidden'); return;
    }
    if (isIOS()) {
      help.innerHTML = '<ol class="steps"><li>Mở trang này bằng <b>Safari</b>.</li><li>Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên).</li><li>Chọn <b>“Thêm vào MH chính”</b> rồi bấm <b>Thêm</b>.</li><li>Mở ứng dụng từ biểu tượng mới trên màn hình.</li></ol>';
    } else if (deferredPrompt) {
      help.innerHTML = '<p>Cài để mở nhanh như ứng dụng thường và nhận thông báo ổn định hơn.</p><button class="btn btn-primary btn-block" style="margin-top:10px" type="button" id="btn-install">Cài ứng dụng</button>';
      $('btn-install').onclick = doInstall;
    } else {
      help.innerHTML = '<ol class="steps"><li>Mở trang này bằng <b>Chrome</b>.</li><li>Bấm nút <b>⋮</b> ở góc trên bên phải.</li><li>Chọn <b>“Cài đặt ứng dụng”</b> hoặc <b>“Thêm vào màn hình chính”</b>.</li></ol>';
    }
    var dismissed = safe(function () { return localStorage.getItem('ngaygio.anbanner') === '1'; }, false) || state.bannerHidden;
    if (!dismissed && (deferredPrompt || isIOS())) {
      banner.className = 'card install-banner';
      banner.innerHTML = '<div class="set-item"><div class="ic"><svg width="22" height="22"><use href="#i-phone"/></svg></div><div class="tx"><h3>Cài lên màn hình chính</h3><p>Để mở nhanh và nhận nhắc giỗ khi không mở ứng dụng.</p></div></div>' +
        '<div class="btn-row"><button class="btn btn-light" type="button" id="bn-later">Để sau</button><button class="btn btn-primary" type="button" id="bn-go">' + (isIOS() ? 'Xem cách cài' : 'Cài ngay') + '</button></div>';
      $('bn-later').onclick = function () { state.bannerHidden = true; safe(function () { localStorage.setItem('ngaygio.anbanner', '1'); }); banner.classList.add('hidden'); };
      $('bn-go').onclick = function () { if (isIOS()) openSettings(); else doInstall(); };
    } else banner.classList.add('hidden');
  }
  function doInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () { deferredPrompt = null; renderInstall(); });
  }

  function fmtTime(ms) { if (!ms) return ''; var d = new Date(ms); return d.toLocaleDateString('vi-VN') + ' lúc ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }

  function renderSettings() {
    $('opt-dayof').checked = !!state.settings.dayOf;
    $('app-version').textContent = 'Phiên bản ' + APP_VERSION + ' · ' + state.people.length + ' hồ sơ trên máy này';
    var bs = $('backup-status');
    bs.innerHTML = state.settings.lastBackup ? '<span class="status info">Sao lưu gần nhất: ' + esc(fmtTime(state.settings.lastBackup)) + '</span>'
      : (state.people.length ? '<span class="status warn">Chưa sao lưu lần nào</span>' : '');
    renderInstall();
    var st = $('push-status'), act = $('push-actions');
    if (!pushSupported()) {
      st.innerHTML = '<span class="status warn">Trình duyệt này chưa hỗ trợ thông báo</span>' + (isIOS() ? '<p class="small" style="margin-top:6px">iPhone cần iOS 16.4+ và phải cài ứng dụng ra Màn hình chính.</p>' : '');
      act.innerHTML = ''; return;
    }
    var perm = Notification.permission;
    getSub().then(function (sub) {
      return serverStatus().then(function (s) {
        var html, buttons;
        if (perm === 'denied') {
          html = '<span class="status warn">Thông báo đang bị chặn</span><p class="small" style="margin-top:6px">Vào Cài đặt điện thoại → Thông báo → cho phép ' + (isStandalone() ? 'ứng dụng “Ngày Giỗ”' : 'trình duyệt') + ', rồi mở lại ứng dụng.</p>';
          buttons = '';
        } else if (sub && state.settings.pushEnabled) {
          html = '<span class="status ok">✓ Đã bật nhắc giỗ</span>' + (state.settings.lastSync ? '<p class="small" style="margin-top:6px">Đồng bộ lên máy chủ: ' + esc(fmtTime(state.settings.lastSync)) + '</p>' : '');
          if (state.settings.syncError && (!state.settings.lastSync || state.settings.syncError > state.settings.lastSync)) html += '<p class="small red">Lần đồng bộ gần nhất bị lỗi, ứng dụng sẽ thử lại khi mở.</p>';
          buttons = '<div class="btn-row"><button class="btn btn-light" type="button" id="btn-test">Gửi thử</button><button class="btn btn-ghost-red" type="button" id="btn-off">Tắt nhắc</button></div>';
        } else if (!s.push) {
          html = '<span class="status warn">Máy chủ nhắc giỗ chưa cấu hình</span><p class="small" style="margin-top:6px">' + (s.reason === 'offline' ? 'Không có mạng hoặc chưa triển khai lên Vercel.' : 'Cần thêm khóa VAPID và cơ sở dữ liệu Upstash Redis trên Vercel.') + ' Ứng dụng vẫn nhắc khi mở; nên dùng thêm “Thêm vào Lịch”.</p>';
          buttons = perm !== 'granted' ? '<button class="btn btn-light btn-block" type="button" id="btn-local">Cho phép nhắc khi mở ứng dụng</button>' : '';
        } else {
          html = '<span class="status info">Chưa bật</span>';
          buttons = '<button class="btn btn-red btn-block" type="button" id="btn-on"><svg width="20" height="20"><use href="#i-bell"/></svg> Bật thông báo nhắc giỗ</button>';
        }
        st.innerHTML = html; act.innerHTML = buttons;
        if ($('btn-on')) $('btn-on').onclick = enablePush;
        if ($('btn-off')) $('btn-off').onclick = function () { dialog('Tắt nhắc giỗ?', 'Điện thoại này sẽ không nhận thông báo nhắc giỗ nữa.', [{ label: 'Tắt nhắc', cls: 'btn-red', value: true }, { label: 'Giữ nguyên', value: false }]).then(function (y) { if (y) disablePush(); }); };
        if ($('btn-test')) $('btn-test').onclick = testPush;
        if ($('btn-local')) $('btn-local').onclick = function () { Notification.requestPermission().then(function () { renderSettings(); localNotify(); }); };
      });
    });
  }

  /* ================= Liên kết giữa các thẻ ================= */
  function openPrayer(id) {
    closePop(); closeAllSheets();
    state.bcGroup = 'Cúng giỗ'; state.bcPerson.gio = id; state.bcOpen = 'gio';
    showScreen('baicung');
    var el = document.querySelector('details.prayer[data-bid=gio]');
    if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }
  function openOnCalendar(jd) {
    closePop(); closeAllSheets();
    var d = G.jdToDate(jd); state.calY = d.year; state.calM = d.month; state.selJd = jd;
    showScreen('lich');
    if (gioOnDay(jd).length) openPop(jd);
  }

  /* ================= Khởi động ================= */
  function renderAll() {
    renderHeaderDate();
    renderHome();
    renderNhapList();
    renderTraCuu();
    renderCalendar();
    renderBadge();
    if (state.screen === 'baicung') renderBaiCung();
    if ($('sheet-detail').classList.contains('open')) renderDetail();
    if ($('sheet-settings').classList.contains('open')) renderSettings();
  }

  function bind() {
    document.querySelectorAll('.nav button').forEach(function (b) { b.onclick = function () { tap(); showScreen(b.dataset.screen); }; });
    $('btn-settings').onclick = function () { tap(); openSettings(); };
    var bg = $('btn-guide'); if (bg) bg.onclick = function () { tap(); openSheet('sheet-guide'); };
    $('pop-close').onclick = closePop;
    $('pop').addEventListener('click', function (e) { if (e.target === this) closePop(); });
    document.addEventListener('click', function (e) {
      var el;
      if ((el = e.target.closest('[data-edit]'))) { tap(); var pe = findPerson(el.dataset.edit); closePop(); if (pe) openForm(pe); return; }
      if ((el = e.target.closest('[data-del]'))) { tap(); var pd = findPerson(el.dataset.del); if (pd) confirmDelete(pd); return; }
      if ((el = e.target.closest('[data-open]'))) { tap(); closePop(); openDetail(el.dataset.open); return; }
      if ((el = e.target.closest('[data-prayer]'))) { tap(); openPrayer(el.dataset.prayer); return; }
      if ((el = e.target.closest('[data-cal]'))) { tap(); openOnCalendar(Number(el.dataset.cal)); return; }
      if ((el = e.target.closest('[data-toggle]'))) { tap(); var id = el.dataset.toggle; state.homeOpen = state.homeOpen === id ? null : id; renderHome(); var card = document.querySelector('.tv[data-id="' + id + '"]'); if (card && state.homeOpen) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
      if ((el = e.target.closest('[data-close]'))) { closeSheet(el.dataset.close); return; }
      if ((el = e.target.closest('[data-go]'))) { closeAllSheets(); showScreen(el.dataset.go); return; }
      if ((el = e.target.closest('.cal-day[data-jd]'))) {
        tap(); state.selJd = Number(el.dataset.jd); renderCalendar();
        if (el.classList.contains('gio')) openPop(state.selJd);
        return;
      }
      if ((el = e.target.closest('.seg button[data-seg]'))) { state.seg = el.dataset.seg; renderTraCuu(); return; }
      if ((el = e.target.closest('.chip[data-group]'))) { state.bcGroup = el.dataset.group; renderBaiCung(); return; }
      if ((el = e.target.closest('.btn-copy'))) { copyPrayer(el.dataset.bid); return; }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });
    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (d.classList && d.classList.contains('prayer')) { if (d.open) state.bcOpen = d.dataset.bid; else if (state.bcOpen === d.dataset.bid) state.bcOpen = null; }
      if (d.id === 'bc-info') d.dataset.touched = '1';
    }, true);
    document.addEventListener('change', function (e) {
      if (e.target.classList.contains('bc-person')) { state.bcPerson[e.target.dataset.bid] = e.target.value; state.bcOpen = e.target.dataset.bid; renderBaiCung(); }
    });
    ['bc-tinchu', 'bc-diachi', 'bc-ho'].forEach(function (id) {
      $(id).addEventListener('change', function () { state.settings[id.slice(3)] = this.value.trim(); saveSettings(); renderBaiCung(); });
    });
    $('d-edit').onclick = function () { var p = findPerson(state.detailId); if (p) openForm(p); };
    $('btn-cancel-edit').onclick = function () { resetForm(); toast('Đã hủy sửa'); };
    $('search').addEventListener('input', function () { state.query = this.value; renderNhapList(); });
    $('search-clear').onclick = function () { $('search').value = ''; state.query = ''; renderNhapList(); $('search').focus(); };
    $('home-search').addEventListener('input', function () { state.homeQuery = this.value; renderHome(); });
    $('up-search').addEventListener('input', function () { state.upQuery = this.value; renderTraCuu(); });
    $('yr-prev').onclick = function () { state.lyear--; renderYear(); };
    $('yr-next').onclick = function () { if (state.lyear < 2199) { state.lyear++; renderYear(); } };
    $('cal-prev').onclick = function () { state.calM--; if (state.calM < 1) { state.calM = 12; state.calY--; } renderCalendar(); };
    $('cal-next').onclick = function () { state.calM++; if (state.calM > 12) { state.calM = 1; state.calY++; } renderCalendar(); };
    $('cal-today').onclick = function () { var d = G.jdToDate(today()); state.calY = d.year; state.calM = d.month; state.selJd = today(); renderCalendar(); };
    $('form').addEventListener('submit', submitForm);
    $('form').addEventListener('input', function (e) { if (e.target.classList.contains('invalid') && e.target.value) e.target.classList.remove('invalid'); });
    $('form').addEventListener('change', function (e) { if (e.target.classList.contains('invalid') && e.target.value) e.target.classList.remove('invalid'); });
    ['f-title', 'f-day', 'f-month', 'f-leap', 'f-year'].forEach(function (id) { $(id).addEventListener('input', updateFormUI); $(id).addEventListener('change', updateFormUI); });
    document.querySelectorAll('input[name="leapRule"], input[name="missingRule"]').forEach(function (r) { r.addEventListener('change', updateFormUI); });
    $('f-title').addEventListener('change', function () { if (this.value === 'Khác') setTimeout(function () { $('f-custom').focus(); }, 50); });
    $('cv-solar').addEventListener('input', convertSolar);
    ['cv-day', 'cv-month', 'cv-year', 'cv-leap'].forEach(function (id) { $(id).addEventListener('input', convertLunar); $(id).addEventListener('change', convertLunar); });
    $('mt-prev').onclick = function () { if (state.mtYear > 1800) { state.mtYear--; renderMonthTable(); } };
    $('mt-next').onclick = function () { if (state.mtYear < 2199) { state.mtYear++; renderMonthTable(); } };
    $('opt-dayof').onchange = function () { state.settings.dayOf = this.checked; saveSettings(); scheduleSync(); };
    $('btn-export').onclick = exportBackup;
    $('btn-import').onclick = function () { $('file-import').value = ''; $('file-import').click(); };
    $('file-import').onchange = function () { if (this.files && this.files[0]) importBackup(this.files[0]); };
    $('btn-ics').onclick = function () { exportICS(state.people); };
    document.addEventListener('touchstart', function () {}, { passive: true });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { renderAll(); localNotify(); } });
  }

  function registerSW() {
    if (!swOK()) return Promise.resolve();
    return navigator.serviceWorker.register('./sw.js').then(function (reg) {
      swReg = reg;
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Đã có phiên bản mới', { label: 'Cập nhật', fn: function () { nw.postMessage('skipWaiting'); } });
          }
        });
      });
      var reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () { if (!reloading) { reloading = true; location.reload(); } });
      if ('periodicSync' in reg) {
        navigator.permissions && navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (st) {
          if (st.state === 'granted') reg.periodicSync.register('nhac-gio', { minInterval: 12 * 3600 * 1000 }).catch(function () {});
        }).catch(function () {});
      }
      return navigator.serviceWorker.ready.then(function (r) { swReg = r; });
    }).catch(function () {});
  }

  function start() {
    var t = today(), d = G.jdToDate(t);
    state.year = d.year; state.calY = d.year; state.calM = d.month; state.selJd = t;
        initFormOptions();
    bind();
    safe(function () { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); });
    loadData().then(function () {
      resetForm();
      var hash = location.hash.replace('#', '');
      if (hash === 'them') hash = 'nhap';
      renderAll();
      if (hash === 'cai-dat') { showScreen('tracuu'); openSettings(); }
      else showScreen(SCREENS[hash] ? hash : (state.people.length ? 'trangchu' : 'nhap'));
      return registerSW();
    }).then(function () {
      renderInstall();
      if (state.settings.pushEnabled) syncServer();
      localNotify();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
