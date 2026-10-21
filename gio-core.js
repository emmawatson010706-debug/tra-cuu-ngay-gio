/*
 * gio-core.js — Lõi tính âm lịch Việt Nam và ngày giỗ.
 * Dùng chung cho: giao diện (trình duyệt), service worker và máy chủ (Vercel).
 * Thuật toán âm lịch: Hồ Ngọc Đức (thiên văn, múi giờ UTC+7 cho lịch Việt Nam).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GioCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TZ = 7; // Lịch Việt Nam tính theo kinh tuyến 105°Đ (UTC+7)
  var PI = Math.PI;
  function INT(d) { return Math.floor(d); }

  /* ---------- Ngày Julius ---------- */
  function jdFromDate(dd, mm, yy) {
    var a = INT((14 - mm) / 12);
    var y = yy + 4800 - a;
    var m = mm + 12 * a - 3;
    var jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
    if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
    return jd;
  }

  function jdToDate(jd) {
    var a, b, c;
    if (jd > 2299160) {
      a = jd + 32044;
      b = INT((4 * a + 3) / 146097);
      c = a - INT((b * 146097) / 4);
    } else {
      b = 0;
      c = jd + 32082;
    }
    var d = INT((4 * c + 3) / 1461);
    var e = c - INT((1461 * d) / 4);
    var m = INT((5 * e + 2) / 153);
    var day = e - INT((153 * m + 2) / 5) + 1;
    var month = m + 3 - 12 * INT(m / 10);
    var year = b * 100 + d - 4800 + INT(m / 10);
    return { day: day, month: month, year: year };
  }

  /* ---------- Thiên văn ---------- */
  function newMoon(k) {
    var T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
    var Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    var M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    var Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    var F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    var C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    var deltat;
    if (T < -11) deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
    else deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
    return Jd1 + C1 - deltat;
  }

  function sunLongitude(jdn) {
    var T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
    var M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    var L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    var DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    var L = (L0 + DL) * dr;
    L = L - PI * 2 * INT(L / (PI * 2));
    return L;
  }

  function getNewMoonDay(k) { return INT(newMoon(k) + 0.5 + TZ / 24); }
  function getSunLongitude(dayNumber) { return INT(sunLongitude(dayNumber - 0.5 - TZ / 24) / PI * 6); }

  function getLunarMonth11(yy) {
    var off = jdFromDate(31, 12, yy) - 2415021;
    var k = INT(off / 29.530588853);
    var nm = getNewMoonDay(k);
    if (getSunLongitude(nm) >= 9) nm = getNewMoonDay(k - 1);
    return nm;
  }

  function getLeapMonthOffset(a11) {
    var k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    var last, i = 1;
    var arc = getSunLongitude(getNewMoonDay(k + i));
    do {
      last = arc;
      i++;
      arc = getSunLongitude(getNewMoonDay(k + i));
    } while (arc !== last && i < 14);
    return i - 1;
  }

  /* Dương lịch (jd) -> Âm lịch */
  function jdToLunar(dayNumber) {
    var yy = jdToDate(dayNumber).year;
    var k = INT((dayNumber - 2415021.076998695) / 29.530588853);
    // Tìm điểm sóc gần nhất không sau ngày đang xét (vòng lặp để tránh lệch ở vài ngày biên)
    var monthStart = getNewMoonDay(k + 1);
    while (monthStart > dayNumber) { k--; monthStart = getNewMoonDay(k + 1); }
    while (getNewMoonDay(k + 2) <= dayNumber) { k++; monthStart = getNewMoonDay(k + 1); }
    var a11 = getLunarMonth11(yy), b11 = a11, lunarYear;
    if (a11 >= monthStart) {
      lunarYear = yy;
      a11 = getLunarMonth11(yy - 1);
    } else {
      lunarYear = yy + 1;
      b11 = getLunarMonth11(yy + 1);
    }
    var lunarDay = dayNumber - monthStart + 1;
    var diff = INT((monthStart - a11) / 29);
    var leap = false, lunarMonth = diff + 11;
    if (b11 - a11 > 365) {
      var leapMonthDiff = getLeapMonthOffset(a11);
      if (diff >= leapMonthDiff) {
        lunarMonth = diff + 10;
        if (diff === leapMonthDiff) leap = true;
      }
    }
    if (lunarMonth > 12) lunarMonth -= 12;
    if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
    return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: leap };
  }

  /* Danh sách các tháng của một năm âm lịch: [{month, leap, startJd, length}] */
  var _yearCache = {};
  function lunarYearMonths(Y) {
    if (_yearCache[Y]) return _yearCache[Y];
    // Tìm mùng 1 Tết năm Y: điểm sóc đầu tiên sau tháng 11 và 12 âm của năm Y-1
    var a11 = getLunarMonth11(Y - 1);
    var k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    var months = [];
    // Duyệt tối đa 18 tháng từ tháng 11 năm trước, giữ lại các tháng thuộc năm Y
    for (var i = 0; i < 18; i++) {
      var start = getNewMoonDay(k + i);
      var next = getNewMoonDay(k + i + 1);
      var L = jdToLunar(start);
      if (L.year < Y) continue;
      if (L.year > Y) break;
      months.push({ month: L.month, leap: L.leap, startJd: start, length: next - start });
    }
    _yearCache[Y] = months;
    return months;
  }

  function leapMonthOfYear(Y) {
    var ms = lunarYearMonths(Y);
    for (var i = 0; i < ms.length; i++) if (ms[i].leap) return ms[i].month;
    return 0;
  }

  /* Âm lịch -> jd (trả null nếu ngày không tồn tại) */
  function lunarToJd(day, month, year, leap) {
    var ms = lunarYearMonths(year);
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].month === month && ms[i].leap === !!leap) {
        if (day < 1 || day > ms[i].length) return null;
        return ms[i].startJd + day - 1;
      }
    }
    return null;
  }

  /* ---------- Tiện ích hiển thị ---------- */
  var CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  var CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
  var THU = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

  function canChiYear(y) { return CAN[(y + 6) % 10] + ' ' + CHI[(y + 8) % 12]; }
  function canChiDay(jd) { return CAN[(jd + 9) % 10] + ' ' + CHI[(jd + 1) % 12]; }
  function canChiMonth(m, y) { return CAN[(y * 12 + m + 3) % 10] + ' ' + CHI[(m + 1) % 12]; }

  /* Ngày âm lịch kế tiếp (từ fromJd trở đi).
   * month = null: hằng tháng; day = 'last' là ngày cuối tháng (29 hoặc 30). Bỏ qua tháng nhuận nếu skipLeap. */
  function nextLunarDate(day, month, fromJd, skipLeap) {
    var ly = jdToLunar(fromJd).year;
    for (var Y = ly - 1; Y <= ly + 2; Y++) {
      var ms = lunarYearMonths(Y);
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (month != null && (m.month !== month || m.leap)) continue;
        if (month == null && skipLeap && m.leap) continue;
        var d = day === 'last' ? m.length : day;
        if (d > m.length) continue;
        var jd = m.startJd + d - 1;
        if (jd >= fromJd) return { jd: jd, day: d, month: m.month, leap: m.leap, year: Y };
      }
    }
    return null;
  }
  function weekdayName(jd) { return THU[(jd + 1) % 7]; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function solarText(jd) { var d = jdToDate(jd); return pad2(d.day) + '/' + pad2(d.month) + '/' + d.year; }
  function isoDate(jd) { var d = jdToDate(jd); return d.year + '-' + pad2(d.month) + '-' + pad2(d.day); }
  function lunarDayName(d) { return d <= 10 ? 'mùng ' + d : String(d); }
  function lunarText(day, month, leap) { return pad2(day) + '/' + pad2(month) + (leap ? ' nhuận' : ''); }

  /* Ngày hôm nay theo giờ Việt Nam (UTC+7), dạng jd */
  function todayJdVN(nowMs) {
    var d = new Date((nowMs == null ? Date.now() : nowMs) + TZ * 3600 * 1000);
    return jdFromDate(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear());
  }

  /* ---------- Ngày giỗ ----------
   * person = {
   *   id, name, title (danh xưng), day, month, leap (mất vào tháng nhuận),
   *   leapRule: 'regular' | 'leap',     // chỉ dùng khi leap = true
   *   missingRule: 'last' | 'next',     // khi ngày 30 rơi vào tháng thiếu
   *   deathYear (năm âm lịch, tùy chọn)
   * }
   * Trả về occurrence = { jd, lunarYear, lunarDay, lunarMonth, lunarLeap, notes:[...] }
   */
  function resolveOccurrence(p, Y) {
    var ms = lunarYearMonths(Y);
    var notes = [];
    var target = null, idx = -1, i;
    var wantLeap = !!p.leap && p.leapRule === 'leap';

    if (wantLeap) {
      for (i = 0; i < ms.length; i++) if (ms[i].month === p.month && ms[i].leap) { target = ms[i]; idx = i; }
      if (!target) notes.push('Năm ' + Y + ' (' + canChiYear(Y) + ') không có tháng ' + p.month + ' nhuận — giỗ vào tháng ' + p.month + ' thường.');
    }
    if (!target) {
      for (i = 0; i < ms.length; i++) if (ms[i].month === p.month && !ms[i].leap) { target = ms[i]; idx = i; break; }
      if (!p.leap || p.leapRule !== 'leap') {
        for (i = 0; i < ms.length; i++) if (ms[i].month === p.month && ms[i].leap) {
          notes.push('Năm ' + Y + ' có tháng ' + p.month + ' nhuận — giỗ vào tháng ' + p.month + ' thường (tháng đầu).');
        }
      }
    }
    if (!target) return null;

    var day = p.day, month = target.month, leap = target.leap, jd;
    if (day <= target.length) {
      jd = target.startJd + day - 1;
    } else {
      // Ngày 30 nhưng tháng này chỉ có 29 ngày
      if (p.missingRule === 'next' && ms[idx + 1]) {
        var nx = ms[idx + 1];
        jd = nx.startJd; day = 1; month = nx.month; leap = nx.leap;
        notes.push('Tháng ' + p.month + (target.leap ? ' nhuận' : '') + ' năm ' + Y + ' chỉ có 29 ngày — theo quy tắc đã chọn, giỗ vào mùng 1 tháng ' + month + (leap ? ' nhuận' : '') + '.');
      } else if (p.missingRule === 'next') {
        // Tháng 12 thiếu: mùng 1 tháng sau là mùng 1 Tết năm sau
        var nextYear = lunarYearMonths(Y + 1)[0];
        jd = nextYear.startJd; day = 1; month = 1; leap = false;
        notes.push('Tháng 12 năm ' + Y + ' chỉ có 29 ngày — theo quy tắc đã chọn, giỗ vào mùng 1 Tết.');
      } else {
        jd = target.startJd + target.length - 1; day = target.length;
        notes.push('Tháng ' + p.month + (target.leap ? ' nhuận' : '') + ' năm ' + Y + ' chỉ có 29 ngày — theo quy tắc đã chọn, giỗ vào ngày 29 (ngày cuối tháng).');
      }
    }
    return { jd: jd, lunarYear: Y, lunarDay: day, lunarMonth: month, lunarLeap: leap, notes: notes };
  }

  function occurrencesFrom(p, fromJd, count) {
    var ly = jdToLunar(fromJd).year;
    var out = [];
    for (var Y = ly - 1; out.length < count && Y < ly + count + 2; Y++) {
      var o = resolveOccurrence(p, Y);
      if (o && o.jd >= fromJd) out.push(o);
    }
    return out;
  }

  function nextOccurrence(p, fromJd) { return occurrencesFrom(p, fromJd, 1)[0] || null; }

  function displayTitle(p) {
    var t = (p.title === 'Khác' ? (p.customTitle || '').trim() : p.title) || '';
    return t;
  }

  function anniversaryNumber(p, occ) {
    if (!p.deathYear || !occ) return 0;
    var n = occ.lunarYear - p.deathYear;
    return n >= 1 ? n : 0;
  }

  function reminderText(p, occ, daysLeft) {
    var who = displayTitle(p) + ' — ' + p.name;
    var dateInfo = ' (' + weekdayName(occ.jd) + ', ' + solarText(occ.jd) + ', tức ' + lunarText(occ.lunarDay, occ.lunarMonth, occ.lunarLeap) + ' âm lịch)';
    if (daysLeft === 0) return 'Hôm nay là ngày giỗ ' + who + dateInfo + '. Gia đình thắp hương tưởng nhớ.';
    return 'Còn ' + daysLeft + ' ngày nữa đến ngày giỗ ' + who + dateInfo + '. Gia đình hãy chuẩn bị lễ thắp hương.';
  }

  /* Các nhắc nhở cần gửi trong ngày todayJd.
   * opts = { daysBefore: 5, dayOf: true } */
  function remindersForDay(people, todayJd, opts) {
    opts = opts || {};
    var before = opts.daysBefore == null ? 5 : opts.daysBefore;
    var out = [];
    (people || []).forEach(function (p) {
      var occ = nextOccurrence(p, todayJd);
      if (!occ) return;
      var left = occ.jd - todayJd;
      if (left === before) out.push({ person: p, occ: occ, kind: 'truoc' + before, daysLeft: left });
      else if (left === 0 && opts.dayOf) out.push({ person: p, occ: occ, kind: 'hom-nay', daysLeft: 0 });
    });
    return out;
  }

  /* Kiểm tra hồ sơ trước khi lưu: trả về {errors:[], warnings:[]} */
  function validatePerson(p) {
    var errors = [], warnings = [];
    if (!p.name || !String(p.name).trim()) errors.push('Vui lòng nhập họ và tên người đã khuất.');
    if (!p.title) errors.push('Vui lòng chọn danh xưng.');
    if (p.title === 'Khác' && !(p.customTitle || '').trim()) errors.push('Vui lòng nhập danh xưng riêng.');
    if (!(p.day >= 1 && p.day <= 30)) errors.push('Ngày âm lịch phải từ 1 đến 30.');
    if (!(p.month >= 1 && p.month <= 12)) errors.push('Tháng âm lịch phải từ 1 đến 12.');
    if (p.deathYear != null && p.deathYear !== '') {
      var y = Number(p.deathYear);
      var nowY = jdToLunar(todayJdVN()).year;
      if (!(y >= 1800 && y <= nowY)) errors.push('Năm mất phải từ 1800 đến ' + nowY + '.');
      else if (!errors.length) {
        if (p.leap) {
          var lm = leapMonthOfYear(y);
          if (lm !== p.month) warnings.push('Theo lịch Việt Nam, năm ' + y + ' (' + canChiYear(y) + ') ' + (lm ? 'có tháng ' + lm + ' nhuận, không phải tháng ' + p.month + ' nhuận' : 'không có tháng nhuận') + '. Xin kiểm tra lại.');
        }
        if (p.day === 30) {
          var ms = lunarYearMonths(y);
          for (var i = 0; i < ms.length; i++) {
            if (ms[i].month === p.month && ms[i].leap === !!p.leap && ms[i].length === 29) {
              warnings.push('Theo lịch Việt Nam, tháng ' + p.month + (p.leap ? ' nhuận' : '') + ' năm ' + y + ' chỉ có 29 ngày, không có ngày 30. Xin kiểm tra lại.');
            }
          }
        }
      }
    }
    return { errors: errors, warnings: warnings };
  }

  return {
    TZ: TZ,
    jdFromDate: jdFromDate,
    jdToDate: jdToDate,
    jdToLunar: jdToLunar,
    lunarToJd: lunarToJd,
    lunarYearMonths: lunarYearMonths,
    leapMonthOfYear: leapMonthOfYear,
    canChiYear: canChiYear,
    canChiDay: canChiDay,
    canChiMonth: canChiMonth,
    nextLunarDate: nextLunarDate,
    weekdayName: weekdayName,
    solarText: solarText,
    isoDate: isoDate,
    lunarText: lunarText,
    lunarDayName: lunarDayName,
    todayJdVN: todayJdVN,
    resolveOccurrence: resolveOccurrence,
    occurrencesFrom: occurrencesFrom,
    nextOccurrence: nextOccurrence,
    displayTitle: displayTitle,
    anniversaryNumber: anniversaryNumber,
    reminderText: reminderText,
    remindersForDay: remindersForDay,
    validatePerson: validatePerson
  };
});
