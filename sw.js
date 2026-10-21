/* sw.js — Service worker: chạy khi không có mạng, nhận thông báo đẩy, nhắc dự phòng */
var VERSION = 'ngaygio-v1.3.0';
var SHELL = [
  '/', '/index.html', '/styles.css', '/app.js', '/gio-core.js', '/bai-cung.js', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/badge-96.png', '/icons/apple-touch-icon.png', '/icons/favicon-64.png',
  '/fonts/be-vietnam-pro-vietnamese-400-normal.woff2', '/fonts/be-vietnam-pro-latin-400-normal.woff2',
  '/fonts/be-vietnam-pro-vietnamese-600-normal.woff2', '/fonts/be-vietnam-pro-latin-600-normal.woff2',
  '/fonts/be-vietnam-pro-vietnamese-700-normal.woff2', '/fonts/be-vietnam-pro-latin-700-normal.woff2'
];

importScripts('/gio-core.js');

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.indexOf('/api/') === 0) return;
  if (req.mode === 'navigate') {
    // Trang chính: lấy bản mới khi có mạng, không có mạng thì dùng bản đã lưu
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put('/index.html', copy); });
      return res;
    }).catch(function () { return caches.match('/index.html'); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});

/* ---------- Thông báo đẩy từ máy chủ ---------- */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  var title = d.title || 'Nhắc ngày giỗ';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'Mở ứng dụng để xem ngày giỗ sắp đến.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: d.tag || 'nhac-gio',
    renotify: true,
    data: { url: d.url || '/' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow(target);
  }));
});

/* ---------- Nhắc dự phòng (Android, khi ứng dụng đã cài và máy chủ chưa bật) ---------- */
function idb(store, mode, fn) {
  return new Promise(function (res, rej) {
    var rq = indexedDB.open('tra-cuu-ngay-gio', 1);
    rq.onupgradeneeded = function () {
      var db = rq.result;
      if (!db.objectStoreNames.contains('people')) db.createObjectStore('people', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    rq.onerror = function () { rej(rq.error); };
    rq.onsuccess = function () {
      var t = rq.result.transaction(store, mode), out = fn(t.objectStore(store));
      t.oncomplete = function () { res(out && out.result); };
      t.onerror = function () { rej(t.error); };
    };
  });
}
function checkLocal() {
  var G = self.GioCore, t = G.todayJdVN();
  return Promise.all([
    idb('people', 'readonly', function (s) { return s.getAll(); }),
    idb('meta', 'readonly', function (s) { return s.get('settings'); }),
    idb('meta', 'readonly', function (s) { return s.get('shown'); })
  ]).then(function (r) {
    var people = r[0] || [], settings = (r[1] && r[1].value) || {}, shown = (r[2] && r[2].value) || {};
    if (settings.pushEnabled) return; // máy chủ đã lo phần nhắc
    var jobs = [];
    people.forEach(function (p) {
      var occ = G.nextOccurrence(p, t);
      if (!occ) return;
      var left = occ.jd - t;
      if (left > 5) return;
      var key = p.id + ':' + occ.jd + ':' + (left === 0 ? 'd0' : 'd5');
      if (shown[key]) return;
      shown[key] = t;
      jobs.push(self.registration.showNotification('Nhắc ngày giỗ', { body: G.reminderText(p, occ, left), icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: 'gio-' + p.id, data: { url: '/' } }));
    });
    jobs.push(idb('meta', 'readwrite', function (s) { s.put({ key: 'shown', value: shown }); }));
    return Promise.all(jobs);
  }).catch(function () {});
}
self.addEventListener('periodicsync', function (e) { if (e.tag === 'nhac-gio') e.waitUntil(checkLocal()); });
