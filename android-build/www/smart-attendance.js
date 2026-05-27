/* ════════════════════════════════════════════════════════════════════════════
   smart-attendance.js — BỘ NÃO CHẤM CÔNG TỰ ĐỘNG v2.0
   Kiến trúc xương cá — 7 module độc lập

   SƠ ĐỒ XƯƠNG CÁ:
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  MODULE 1: CONFIG       — Hằng số & cấu hình                           │
   │  MODULE 2: STATE        — State machine JS (đồng bộ với native)        │
   │  MODULE 3: WIFI         — Kiểm tra WiFi công ty / nhà                  │
   │  MODULE 4: GPS          — Lấy vị trí & xác minh khoảng cách            │
   │  MODULE 5: DECISION     — Bộ ra quyết định JS (gọi native brain)       │
   │  MODULE 6: RECOVERY     — Xử lý bù khi app mở lại                     │
   │  MODULE 7: NOTIFICATION — Hiển thị kết quả qua UI                      │
   └─────────────────────────────────────────────────────────────────────────┘

   NGUYÊN TẮC:
   • App được ngủ — thức đúng lúc, xử lý xong rồi ngủ lại
   • WiFi là tín hiệu ưu tiên số 1 (rẻ pin nhất)
   • Motion chỉ là công tắc GPS — không quyết định attendance
   • GPS không chạy 24/7 — chỉ bật khi cần xác minh
   • Mất WiFi ≠ checkout (chỉ là MAYBE_LEFT_WORK)
   • Logic nền quan trọng nằm ở native (AlarmManager / Motion API)
   • JS = UI + config + recovery khi WebView mở lại

   BRIDGE: window.ccNative.brain.xxx() → AttendanceBrainPlugin.java
   ════════════════════════════════════════════════════════════════════════════ */

(function() {
'use strict';

/* ════════════════════════════════════════════════════════════════════════════
   MODULE 1: CONFIG — Hằng số & cấu hình
   ════════════════════════════════════════════════════════════════════════════ */

var SA_STORAGE_KEY = 'cp22_sa_v2';

/** 7 trạng thái — đồng bộ với AttendanceState.java */
var STATE = {
  HOME:                  'HOME',
  OUTSIDE:               'OUTSIDE',
  WAIT_CHECKIN_CONFIRM:  'WAIT_CHECKIN_CONFIRM',
  WORKING:               'WORKING',
  MAYBE_LEFT_WORK:       'MAYBE_LEFT_WORK',
  WAIT_CHECKOUT_CONFIRM: 'WAIT_CHECKOUT_CONFIRM',
  CHECKED_OUT:           'CHECKED_OUT'
};

/** Labels hiển thị theo state */
var STATE_LABEL = {
  HOME:                  { vi: 'Đang ở nhà',              en: 'At home' },
  OUTSIDE:               { vi: 'Ngoài đường',             en: 'Outside' },
  WAIT_CHECKIN_CONFIRM:  { vi: 'Đang xác nhận vào ca…',  en: 'Confirming check-in…' },
  WORKING:               { vi: 'Đang làm việc',           en: 'Working' },
  MAYBE_LEFT_WORK:       { vi: 'Đang xác minh rời CT…',  en: 'Verifying exit…' },
  WAIT_CHECKOUT_CONFIRM: { vi: 'Chờ xác nhận tan ca…',   en: 'Confirming checkout…' },
  CHECKED_OUT:           { vi: 'Đã tan ca',               en: 'Checked out' }
};

/** Timing defaults (ms) — native có thể override */
var TIMING = {
  RECOVERY_DEBOUNCE_MS:     3000,    // debounce recovery khi app mở
  UI_SYNC_MS:               1000,    // sync UI mỗi 1s khi foreground
  GPS_FRESH_MS:             5 * 60_000, // GPS reading coi là fresh nếu < 5 phút
};

/* ════════════════════════════════════════════════════════════════════════════
   MODULE 2: STATE MACHINE JS
   ════════════════════════════════════════════════════════════════════════════ */

/** Dữ liệu state JS (đồng bộ với native qua ccNative.brain) */
var _sa = {
  // Trạng thái chính — đọc từ native, không tự quyết định ở JS
  state:             STATE.OUTSIDE,
  stateChangedAt:    0,

  // Chấm công hôm nay
  todayCheckedIn:    false,
  todayCheckedOut:   false,
  checkinTime:       '',    // 'HH:mm'
  checkoutTime:      '',    // 'HH:mm'

  // Deadline checkout (epoch ms) — để hiện countdown
  checkoutDeadlineAt: 0,

  // Trạng thái native
  motionStatus:      'UNKNOWN',
  enabled:           false,

  // Cấu hình
  config: {
    workWifi:      [],   // [{ssid:'...', bssid:'...'}]
    homeWifi:      [],
    workGps:       null, // {lat, lng, radius}
    homeGps:       null,
    checkinMin:    20,
    checkoutMin:   60,
    alarmBeforeMin: 10,
    shiftStart:    null, // {hour, min}
    shiftEnd:      null,
  }
};

/** Timers */
var _saTimers = {
  recovery: null,
  uiSync:   null
};

// ─── Lấy ngôn ngữ ─────────────────────────────────────────────────────────
function _lang() {
  return (window.userData && window.userData.lang) || 'vi';
}

// ─── Lưu dữ liệu JS vào localStorage ─────────────────────────────────────
function _saveLocal() {
  try {
    var data = {
      state:            _sa.state,
      stateChangedAt:   _sa.stateChangedAt,
      todayCheckedIn:   _sa.todayCheckedIn,
      todayCheckedOut:  _sa.todayCheckedOut,
      checkinTime:      _sa.checkinTime,
      checkoutTime:     _sa.checkoutTime,
      checkoutDeadlineAt: _sa.checkoutDeadlineAt,
      enabled:          _sa.enabled,
      config:           _sa.config
    };
    lsSet(SA_STORAGE_KEY, JSON.stringify(data));
  } catch(e) {}
}

// ─── Đọc dữ liệu JS từ localStorage ──────────────────────────────────────
function _loadLocal() {
  try {
    var raw = lsGet(SA_STORAGE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (data.state)           _sa.state           = data.state;
    if (data.stateChangedAt)  _sa.stateChangedAt  = data.stateChangedAt;
    if (data.todayCheckedIn != null)  _sa.todayCheckedIn  = data.todayCheckedIn;
    if (data.todayCheckedOut != null) _sa.todayCheckedOut = data.todayCheckedOut;
    if (data.checkinTime)     _sa.checkinTime     = data.checkinTime;
    if (data.checkoutTime)    _sa.checkoutTime    = data.checkoutTime;
    if (data.checkoutDeadlineAt) _sa.checkoutDeadlineAt = data.checkoutDeadlineAt;
    if (data.enabled != null) _sa.enabled         = data.enabled;
    if (data.config)          _sa.config          = Object.assign(_sa.config, data.config);
  } catch(e) {}
}

/* ════════════════════════════════════════════════════════════════════════════
   MODULE 3: WIFI — Kiểm tra WiFi công ty / nhà
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Kiểm tra WiFi hiện tại có phải WiFi công ty không.
 * Đây là tín hiệu ưu tiên số 1 — rẻ pin nhất.
 */
function saCheckWorkWifi(currentSsid) {
  if (!currentSsid) return false;
  var list = _sa.config.workWifi || [];
  return list.some(function(w) {
    return w.ssid && w.ssid.trim().toLowerCase() === currentSsid.trim().toLowerCase();
  });
}

/**
 * Kiểm tra WiFi hiện tại có phải WiFi nhà không.
 * HOME chỉ xác định bằng bằng chứng cụ thể (WiFi nhà hoặc GPS nhà).
 */
function saCheckHomeWifi(currentSsid) {
  if (!currentSsid) return false;
  var list = _sa.config.homeWifi || [];
  return list.some(function(w) {
    return w.ssid && w.ssid.trim().toLowerCase() === currentSsid.trim().toLowerCase();
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   MODULE 4: GPS — Lấy vị trí & xác minh khoảng cách
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Lấy GPS qua navigator.geolocation (JS).
 * Sau khi có kết quả → gửi xuống native qua updateGpsResult().
 * GPS chỉ gọi khi cần — không poll liên tục.
 */
function saGetGpsOnce(onResult, onError) {
  if (!navigator.geolocation) {
    if (onError) onError('no_api');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      var acc = pos.coords.accuracy;

      // Cập nhật vào native SharedPreferences để Brain có thể dùng
      if (window.ccNative && window.ccNative.brain) {
        window.ccNative.brain.updateGpsResult(lat, lng, acc).catch(function() {});
      }

      if (onResult) onResult({ lat: lat, lng: lng, accuracy: acc });
    },
    function(err) {
      if (onError) onError(err.message || 'gps_error');
    },
    { timeout: 15000, maximumAge: 60000, enableHighAccuracy: true }
  );
}

/**
 * Tính khoảng cách (m) — Haversine formula.
 */
function saGpsDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2)
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Kiểm tra vị trí lat/lng có trong vùng công ty không.
 */
function saIsInWorkZone(lat, lng) {
  var wg = _sa.config.workGps;
  if (!wg || !wg.lat || !wg.lng) return false;
  var dist = saGpsDistance(lat, lng, wg.lat, wg.lng);
  return dist <= (wg.radius || 100);
}

/**
 * Kiểm tra vị trí lat/lng có trong vùng nhà không.
 */
function saIsInHomeZone(lat, lng) {
  var hg = _sa.config.homeGps;
  if (!hg || !hg.lat || !hg.lng) return false;
  var dist = saGpsDistance(lat, lng, hg.lat, hg.lng);
  return dist <= (hg.radius || 120);
}

/* ════════════════════════════════════════════════════════════════════════════
   MODULE 5: DECISION ENGINE JS
   Giao tiếp với native brain qua window.ccNative.brain
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Đồng bộ toàn bộ config xuống native.
 * Gọi khi: user thay đổi cài đặt, app khởi động.
 */
async function saSyncConfigToNative() {
  if (!window.ccNative || !window.ccNative.brain) return;
  try {
    var cfg = _sa.config;
    await window.ccNative.brain.syncConfig({
      enabled:       _sa.enabled,
      checkinMin:    cfg.checkinMin,
      checkoutMin:   cfg.checkoutMin,
      alarmBeforeMin: cfg.alarmBeforeMin,
      shiftStart:    cfg.shiftStart,
      shiftEnd:      cfg.shiftEnd,
      workGps:       cfg.workGps,
      homeGps:       cfg.homeGps,
      workWifiJson:  JSON.stringify(cfg.workWifi || []),
      homeWifiJson:  JSON.stringify(cfg.homeWifi || []),
    });
    console.log('[SA] syncConfig OK');
  } catch(e) {
    console.warn('[SA] syncConfig error:', e);
  }
}

/**
 * Bật bộ não nền native.
 */
async function saStart() {
  if (!_sa.enabled) return;
  await saSyncConfigToNative();
  if (window.ccNative && window.ccNative.brain) {
    try {
      var r = await window.ccNative.brain.start();
      console.log('[SA] brain.start()', r);
    } catch(e) {
      console.warn('[SA] brain.start() error:', e);
    }
  }
}

/**
 * Tắt bộ não nền native.
 */
async function saStop() {
  if (window.ccNative && window.ccNative.brain) {
    try {
      await window.ccNative.brain.stop();
      console.log('[SA] brain.stop()');
    } catch(e) {}
  }
}

/**
 * Đọc state từ native và đồng bộ về JS.
 */
async function saSyncStateFromNative() {
  if (!window.ccNative || !window.ccNative.brain) return;
  try {
    var r = await window.ccNative.brain.getState();
    if (r && r.state) {
      var changed = _sa.state !== r.state;
      _sa.state          = r.state;
      _sa.todayCheckedIn  = r.todayCheckedIn  || false;
      _sa.todayCheckedOut = r.todayCheckedOut || false;
      _sa.checkoutDeadlineAt = r.checkoutDeadlineAt || 0;
      _sa.motionStatus   = r.motionStatus || 'UNKNOWN';
      if (changed) {
        _saveLocal();
        _renderUI();
      }
    }
  } catch(e) {}
}

/* ════════════════════════════════════════════════════════════════════════════
   MODULE 6: RECOVERY — Xử lý bù khi app mở lại / WebView visible
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Recovery entry point.
 * Gọi khi: app foreground / WebView visible / service restart.
 *
 * Pipeline:
 * 1. Đọc pending event từ native (check-in/out bù đã xảy ra khi app tắt)
 * 2. Đọc state native hiện tại
 * 3. Kiểm tra ngày mới
 * 4. Đồng bộ UI
 * 5. Chạy native recovery
 */
async function saRunRecovery(source) {
  source = source || 'app_open';
  console.log('[SA] recovery start, source=' + source);

  if (!_sa.enabled) {
    console.log('[SA] recovery: disabled — skip');
    return;
  }

  if (!window.ccNative || !window.ccNative.brain) {
    // Không có native brain — chạy recovery JS-only
    _saRecoveryJsOnly();
    return;
  }

  try {
    // ─── 1. Kiểm tra pending event từ native ────────────────────────────
    var evt = await window.ccNative.brain.consumePendingEvent();
    if (evt && evt.hasEvent) {
      console.log('[SA] pending event:', evt.type, evt.detail);
      _saHandlePendingEvent(evt.type, evt.detail);
    }

    // ─── 2. Đọc state native ────────────────────────────────────────────
    await saSyncStateFromNative();

    // ─── 3. Kiểm tra ngày mới ───────────────────────────────────────────
    _saCheckDayRollover();

    // ─── 4. Đồng bộ UI ──────────────────────────────────────────────────
    _renderUI();

    // ─── 5. Chạy native recovery ─────────────────────────────────────────
    var r = await window.ccNative.brain.runRecovery();
    console.log('[SA] native recovery result:', r);

    // Đọc lại state sau recovery
    await saSyncStateFromNative();
    _renderUI();

  } catch(e) {
    console.error('[SA] recovery error:', e);
    _saRecoveryJsOnly();
  }
}

/**
 * Xử lý pending event từ native (check-in/out đã xảy ra khi app ngủ).
 */
function _saHandlePendingEvent(type, detail) {
  var parts  = (detail || '').split('|');
  var timeStr = parts[0] || '';

  if (type === 'CHECKED_IN') {
    _sa.todayCheckedIn = true;
    _sa.checkinTime    = timeStr;
    _sa.state = STATE.WORKING;
    _saveLocal();
    // Ghi vào attData (hệ thống chấm công chính)
    _saWriteCheckinToHistory(timeStr);
    console.log('[SA] pending CHECKED_IN at', timeStr);

  } else if (type === 'CHECKED_OUT') {
    _sa.todayCheckedOut = true;
    _sa.checkoutTime    = timeStr;
    _sa.state = STATE.CHECKED_OUT;
    _saveLocal();
    _saWriteCheckoutToHistory(timeStr, parts[1] || 'auto');
    console.log('[SA] pending CHECKED_OUT at', timeStr);

  } else if (type === 'CHECKOUT_REMIND') {
    // Native đã gửi notification — không cần làm gì thêm ở JS
    console.log('[SA] pending CHECKOUT_REMIND at', timeStr);

  } else if (type === 'PERMISSION_ERROR') {
    _saShowPermissionWarning(detail);
  }
}

/**
 * Recovery JS-only (khi không có native brain — môi trường browser/test).
 */
function _saRecoveryJsOnly() {
  _saCheckDayRollover();
  _renderUI();
  console.log('[SA] JS-only recovery, state=' + _sa.state);
}

/**
 * Kiểm tra ngày mới và reset flag nếu cần.
 */
function _saCheckDayRollover() {
  var todayKey = _saTodayKey();
  var lastKey  = lsGet('cp22_sa_daykey') || '';
  if (todayKey !== lastKey) {
    console.log('[SA] day rollover:', lastKey, '→', todayKey);
    lsSet('cp22_sa_daykey', todayKey);

    var oldState = _sa.state;
    _sa.todayCheckedIn  = false;
    _sa.todayCheckedOut = false;
    _sa.checkinTime     = '';
    _sa.checkoutTime    = '';
    _sa.checkoutDeadlineAt = 0;

    // Reset state về HOME/OUTSIDE cho ngày mới
    if (oldState === STATE.CHECKED_OUT ||
        oldState === STATE.WAIT_CHECKOUT_CONFIRM ||
        oldState === STATE.MAYBE_LEFT_WORK) {
      _sa.state = STATE.OUTSIDE;
    }
    _saveLocal();
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   MODULE 7: NOTIFICATION / UI — Hiển thị kết quả
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Render UI theo state hiện tại.
 * UI phải theo state thật — không để UI tự đoán.
 */
function _renderUI() {
  try {
    // Cập nhật home stats nếu có hàm
    if (typeof renderHomeStats === 'function') renderHomeStats();

    // Cập nhật banner/status hiển thị state
    _saRenderStateBanner();

    // Cập nhật countdown deadline nếu đang WAIT_CHECKOUT_CONFIRM
    _saRenderCheckoutCountdown();

  } catch(e) {
    console.warn('[SA] renderUI error:', e);
  }
}

function _saRenderStateBanner() {
  var el = document.getElementById('sa-state-banner');
  if (!el) return;

  var label = STATE_LABEL[_sa.state];
  if (!label) return;

  var lang = _lang();
  el.textContent = label[lang] || label['vi'];
  el.className = 'sa-banner sa-banner-' + _sa.state.toLowerCase().replace(/_/g, '-');
}

function _saRenderCheckoutCountdown() {
  var el = document.getElementById('sa-checkout-countdown');
  if (!el) return;

  if (_sa.state !== STATE.WAIT_CHECKOUT_CONFIRM || !_sa.checkoutDeadlineAt) {
    el.style.display = 'none';
    return;
  }

  var remain = _sa.checkoutDeadlineAt - Date.now();
  if (remain <= 0) {
    el.style.display = 'none';
    return;
  }

  var mins = Math.ceil(remain / 60000);
  var lang = _lang();
  el.textContent = lang === 'vi'
    ? 'Tự checkout sau ' + mins + ' phút'
    : 'Auto checkout in ' + mins + ' min';
  el.style.display = '';
}

function _saShowPermissionWarning(detail) {
  var lang = _lang();
  var msg = lang === 'vi'
    ? 'Cần bật GPS / quyền vị trí để chấm công tự động'
    : 'Enable GPS / location permission for auto attendance';
  if (detail) msg += '\n' + detail;
  if (typeof showGpsBanner === 'function') showGpsBanner(msg);
  console.warn('[SA] permission warning:', msg);
}

/* ════════════════════════════════════════════════════════════════════════════
   GIAO TIẾP VỚI HỆ THỐNG CHẤM CÔNG CHÍNH (attData / saveAtt)
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Ghi check-in vào lịch sử.
 * Gọi hàm saveAtt / attData từ checkin.js.
 */
function _saWriteCheckinToHistory(timeStr) {
  try {
    var key = todayKey ? todayKey() : _saTodayKey();
    if (typeof attData === 'undefined' || typeof saveAtt === 'undefined') return;

    var rec = attData[key] || {};
    if (rec.in) {
      console.log('[SA] check-in bù: đã có record, skip');
      return;
    }

    rec.in  = timeStr;
    rec.inSrc = 'auto';
    attData[key] = rec;
    saveAtt();
    console.log('[SA] ✅ ghi check-in', timeStr, 'vào key', key);
  } catch(e) {
    console.error('[SA] _saWriteCheckinToHistory error:', e);
  }
}

/**
 * Ghi checkout vào lịch sử.
 */
function _saWriteCheckoutToHistory(timeStr, reason) {
  try {
    var key = todayKey ? todayKey() : _saTodayKey();
    if (typeof attData === 'undefined' || typeof saveAtt === 'undefined') return;

    var rec = attData[key] || {};
    if (!rec.in) {
      console.log('[SA] checkout bù: không có check-in, skip');
      return;
    }
    if (rec.out) {
      console.log('[SA] checkout bù: đã có record, skip');
      return;
    }

    rec.out    = timeStr;
    rec.outSrc = 'auto';
    if (reason) rec.outReason = reason;
    attData[key] = rec;
    saveAtt();
    console.log('[SA] ✅ ghi checkout', timeStr, 'vào key', key);
  } catch(e) {
    console.error('[SA] _saWriteCheckoutToHistory error:', e);
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   KHỞI ĐỘNG & VÒNG ĐỜI
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Init khi app load.
 * Gọi từ app.js sau khi attData sẵn sàng.
 */
async function saInit(config) {
  console.log('[SA] saInit() v2.0');

  // Load dữ liệu JS từ localStorage
  _loadLocal();

  // Ghi đè config nếu được truyền vào
  if (config) {
    _sa.config  = Object.assign(_sa.config, config.profile || {});
    _sa.enabled = config.enabled || false;
  }

  // Lắng nghe WebView visible (recovery khi user mở app)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      clearTimeout(_saTimers.recovery);
      _saTimers.recovery = setTimeout(function() {
        saRunRecovery('visibility_change');
      }, TIMING.RECOVERY_DEBOUNCE_MS);
    }
  });

  // Sync UI mỗi 1s để cập nhật countdown (chỉ khi foreground)
  clearInterval(_saTimers.uiSync);
  _saTimers.uiSync = setInterval(function() {
    if (document.visibilityState === 'visible') {
      _saRenderCheckoutCountdown();
    }
  }, TIMING.UI_SYNC_MS);

  // Chạy recovery ngay khi init
  await saRunRecovery('init');
}

/**
 * Bật/tắt tính năng chấm công tự động.
 */
async function saSetEnabled(enabled) {
  _sa.enabled = enabled;
  _saveLocal();
  if (enabled) {
    await saStart();
  } else {
    await saStop();
    _sa.state = STATE.OUTSIDE;
    _renderUI();
  }
}

/**
 * Cập nhật config và đồng bộ xuống native.
 */
async function saUpdateConfig(newConfig) {
  _sa.config = Object.assign(_sa.config, newConfig);
  _saveLocal();
  await saSyncConfigToNative();
  if (_sa.enabled) {
    // Đặt lại alarm nếu giờ ca thay đổi
    if (window.ccNative && window.ccNative.brain) {
      await window.ccNative.brain.scheduleAlarms().catch(function() {});
    }
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════════════ */

function _saTodayKey() {
  var d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function _saFmtTime(ms) {
  var d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':'
    + String(d.getMinutes()).padStart(2, '0');
}

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC API — expose ra window
   ════════════════════════════════════════════════════════════════════════════ */

window.saInit           = saInit;
window.saSetEnabled     = saSetEnabled;
window.saUpdateConfig   = saUpdateConfig;
window.saRunRecovery    = saRunRecovery;
window.saSyncConfigToNative = saSyncConfigToNative;
window.saSyncStateFromNative = saSyncStateFromNative;

/** Đọc state hiện tại (dùng cho UI) */
window.saGetState = function() { return _sa.state; };
window.saGetData  = function() { return _sa; };

/** State labels (dùng cho debug UI) */
window.SA_STATE       = STATE;
window.SA_STATE_LABEL = STATE_LABEL;

console.log('[SA] smart-attendance.js v2.0 loaded');

})();
