/* ════════════════════════════════════════════════════════════════════════════════
   smart-attendance.js — HỆ THỐNG CHẤM CÔNG THÔNG MINH v1.0
   Wi-Fi + GPS — State Machine 10 trạng thái
   (Đã bỏ BTS/Cell Tower theo yêu cầu — chỉ còn 2 tín hiệu)

   Load SAU checkin.js (cần: attData, saveAtt, renderHomeStats, u(), lsGet/lsSet,
   gpsDistance, fmtTime, todayKey, showGpsBanner)

   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ NGUYÊN TẮC:                                                                 │
   │   Wi-Fi = xác thực mạnh nhất khi VÀO ca                                    │
   │   GPS   = xác thực mạnh nhất khi TAN ca                                    │
   │   Nhà và công ty đều có hồ sơ riêng                                         │
   └──────────────────────────────────────────────────────────────────────────────┘

   10 TRẠNG THÁI:
     HOME                    — Đang ở nhà (Wi-Fi nhà / GPS nhà)
     LEAVING_HOME            — Đã rời nhà (mất Wi-Fi nhà / GPS xa nhà)
     GOING_TO_WORK           — Đang đi tới công ty (GPS bật, 1-3p/lần)
     WAIT_WORK_WIFI_5_MIN    — GPS/Wi-Fi đã vào vùng công ty, chờ xác nhận 20 phút
     WORKING_WIFI            — Đang làm việc (xác nhận bằng Wi-Fi)
     WORKING_GPS_BACKUP      — Đang làm việc (Wi-Fi không có, GPS backup)
     WORK_WIFI_LOST          — Mất Wi-Fi công ty > 5p, đang verify GPS
     POSSIBLE_CHECKOUT       — Có thể đã tan ca (GPS ngoài + mất Wi-Fi)
     CHECKOUT_WAIT_75_MIN    — Đang chờ 80 phút để auto checkout
     CHECKED_OUT             — Đã checkout, chờ reset

   ════════════════════════════════════════════════════════════════════════════════ */

(function(){
'use strict';

/* ═══════════════════════════════════════════════════════════════════════════════
   1. HẰNG SỐ & CẤU HÌNH
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Các trạng thái của state machine */
var STATE = {
  HOME:                  'HOME',
  LEAVING_HOME:          'LEAVING_HOME',
  GOING_TO_WORK:         'GOING_TO_WORK',
  WAIT_CHECKIN_CONFIRM:  'WAIT_CHECKIN_CONFIRM',
  WORKING:               'WORKING',
  WAIT_CHECKOUT_CONFIRM: 'WAIT_CHECKOUT_CONFIRM',
  CHECKED_OUT:           'CHECKED_OUT',
  // Alias cũ để tương thích với state đã lưu trong localStorage
  WAIT_WORK_WIFI_5_MIN:  'WAIT_CHECKIN_CONFIRM',
  WORKING_WIFI:          'WORKING',
  WORKING_GPS_BACKUP:    'WORKING',
  WORK_WIFI_LOST:        'WORKING',
  POSSIBLE_CHECKOUT:     'WAIT_CHECKOUT_CONFIRM',
  CHECKOUT_WAIT_75_MIN:  'WAIT_CHECKOUT_CONFIRM'
};

/** Thời gian chờ (ms) */
var TIMING = {
  GPS_HOME_CHECK_MS:       120 * 1000,
  HOME_GPS_BEFORE_SHIFT_MS: 120 * 60 * 1000,
  HOME_GPS_AFTER_SHIFT_MS:  180 * 60 * 1000,
  WIFI_WAIT_MS:           20 * 60 * 1000,     // fallback 20p — thực tế đọc từ saCheckinMs()
  WIFI_LOST_WAIT_MS:      80 * 60 * 1000,     // fallback 80p — thực tế đọc từ saCheckoutMs()
  CHECKOUT_WAIT_MS:       80 * 60 * 1000,     // fallback 80p — thực tế đọc từ saCheckoutMs()
  CHECKOUT_RETURN_STABLE_MS: 30 * 1000,       // tín hiệu công ty ổn định lại đủ lâu mới hủy checkout
  GPS_POLL_TRAVEL_MS:     90 * 1000,          // 1.5 phút GPS poll khi đang di chuyển
  GPS_POLL_NEAR_SHIFT_MS: 30 * 1000,          // 30s GPS poll gần giờ ca
  GPS_POLL_BACKUP_MS:     120 * 1000,         // 2 phút GPS poll khi backup (trong ca)
  WIFI_SIGNAL_FRESH_MS:   90 * 1000,
  // BTS_SIGNAL_FRESH_MS đã bỏ — không còn dùng BTS
  GPS_SIGNAL_FRESH_MS:    5 * 60 * 1000,
  // FIX P0 #1: tăng từ 3p lên 15p để chịu được lúc app bị throttle background dài (JS interval
  // không chạy ổn định trên Android khi app ẩn) — tránh CHECK_IN_WAIT_RESET mỗi lần user mở app.
  CONFIRM_SIGNAL_GAP_MS:  15 * 60 * 1000,
  // Khi không có Wi-Fi, GPS có thể lệch 30-70m dù người dùng đứng yên.
  // Giữ phiên xác nhận nếu chỉ mất tín hiệu công ty ngắn hạn.
  WORK_SIGNAL_LOST_GRACE_MS: 90 * 1000,
  GPS_HOME_WORK_CLOSE_M:   180,
  GPS_WORK_HOME_MARGIN_M:  15,
  GPS_WORK_EXIT_BUFFER_MIN_M: 40,
  GPS_WORK_EXIT_BUFFER_MAX_M: 120,
  // FIX P1 #2: debounce 60s mới chuyển HOME → LEAVING_HOME để tránh dao động khi Wi-Fi rớt 1 nhịp.
  HOME_LEAVE_DEBOUNCE_MS: 60 * 1000,
  EVALUATE_DEBOUNCE_MS:   120,
  DEBUG_RENDER_MS:        1000,
  PROFILE_RENDER_MS:      2000,
  // BTS_POLL_MS đã bỏ — không còn poll BTS
  WIFI_POLL_MS:           15 * 1000,          // 15s poll Wi-Fi
  STATE_SAVE_MS:          5 * 1000,           // 5s debounce lưu state
  NEW_CYCLE_WAIT_MS:      8 * 60 * 60 * 1000, // 8 tiếng chờ chu kỳ mới
  GPS_WAKEUP_PREPARE_MS:  15 * 60 * 1000,
  GPS_WAKEUP_AFTER_OUT_MS: 8 * 60 * 60 * 1000 - 15 * 60 * 1000 // bật GPS trước chu kỳ mới 15p
};

/** Thời gian chờ VÀO ca (ms) — đọc từ slider checkinMin của user, fallback 20p */
function saCheckinMs()  { return ((window._gpsData && _gpsData.checkinMin  > 0) ? _gpsData.checkinMin  : 20) * 60 * 1000; }
/** Thời gian chờ RA ca (ms) — đọc từ slider checkoutMin của user, fallback 80p */
function saCheckoutMs() { return ((window._gpsData && _gpsData.checkoutMin > 0) ? _gpsData.checkoutMin : 80) * 60 * 1000; }
function saCheckoutReturnStableMs(){ return Math.max(TIMING.CHECKOUT_RETURN_STABLE_MS, Math.floor(saCheckoutMs() * 0.1)); }

/** Storage key */
var STORAGE_KEY = 'cp22_smart_att';

/** Lấy ngôn ngữ hiện tại của user (fallback 'vi') */
function _saL(){ return (window.userData && window.userData.lang) || 'vi'; }

/* ═══════════════════════════════════════════════════════════════════════════════
   2. DỮ LIỆU STATE MACHINE
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Dữ liệu chính của hệ thống */
var _sa = {
  /** Trạng thái hiện tại */
  state: STATE.HOME,

  /** Hồ sơ nhà */
  home: {
    wifi: [],       // [{ssid:'...', bssid:'...'}]
    gps:  null      // {lat, lng, radius} hoặc null
  },

  /** Hồ sơ công ty (kế thừa từ _gpsData) */
  work: {
    wifi: [],       // [{ssid:'...', bssid:'...'}]
    gps:  null      // {lat, lng, radius} — đồng bộ từ _gpsData
  },

  /** Hồ sơ việc phụ (Wi-Fi/GPS riêng biệt) */
  subWork: {
    wifi: [],
    gps:  null
  },

  /** Timestamps quan trọng */
  stateChangedAt: 0,
  homeSignalLostAt: 0,
  workSignalLostAt: 0,

  /** Cửa sổ vào ca (WAIT_CHECKIN_CONFIRM) — tích lũy thời gian có/mất tín hiệu */
  checkinWindowStart: 0,       // thời điểm mở cửa sổ check-in
  checkinSignalOnMs: 0,        // tổng ms có tín hiệu công ty (đã hoàn thành)
  checkinSignalOffMs: 0,       // tổng ms mất tín hiệu công ty (đã hoàn thành)
  checkinLastSignalState: false, // trạng thái tín hiệu tại lần eval trước
  checkinLastFlipAt: 0,        // timestamp lần cuối tín hiệu đổi trạng thái

  /** Cửa sổ tan ca (WAIT_CHECKOUT_CONFIRM) — tích lũy thời gian mất/có tín hiệu */
  checkoutWindowStart: 0,
  checkoutSignalOnMs: 0,
  checkoutSignalOffMs: 0,
  checkoutLastSignalState: true,
  checkoutLastFlipAt: 0,
  lastCheckoutAt: 0,
  cycleReadyAt: 0,
  gpsWakeupAt: 0,

  /** Field cũ — giữ để tương thích ngược với localStorage đã lưu */
  checkoutWaitStart: 0,
  wifiLostAt: 0,
  wifiWaitStart: 0,
  checkinConfirmMethod: '',
  checkinConfirmLastSeen: 0,
  checkoutConfirmMethod: '',
  checkoutConfirmLastSeen: 0,

  /** Tín hiệu hiện tại (cập nhật mỗi poll) */
  signals: {
    wifi:     null,  // {ssid, bssid, connected} hoặc null
    gps:      null,  // {lat, lng, accuracy} hoặc null
    gpsInside:null,  // true/false/null
    ts: {wifi:0, gps:0}
  },

  /** GPS có đang bật không */
  gpsActive: false,

  /** Đã enabled chưa (user bật tính năng) */
  enabled: false,

  /** Ngày cuối cùng đã đồng bộ cờ check-in/out */
  lastDailyKey: '',

  /** Đã checkin hôm nay chưa (để tránh checkin trùng) */
  todayCheckedIn: false,
  todayCheckedOut: false,
  /** Riêng cho job phụ */
  todayCheckedInSub: false,
  todayCheckedOutSub: false
};

/** Timer IDs */
var _saTimers = {
  wifi: null,
  gps: null,
  gpsIntervalMs: 0,
  evaluate: null,
  stateSave: null,
  wifiWait: null,
  wifiLost: null,
  checkoutWait: null,
  brainStatus: null
};

var _saPerf = {
  lastDebugRenderAt: 0,
  lastProfileRenderAt: 0
};

/* ═══════════════════════════════════════════════════════════════════════════════
   3. PERSISTENCE — Lưu/đọc trạng thái
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Đọc dữ liệu từ localStorage */
function saLoad(){
  try {
    var raw = (typeof lsGet === 'function') ? lsGet(STORAGE_KEY) : null;
    if(!raw) return;
    // Chỉ restore các field cần thiết, giữ nguyên signals
    // Normalize state cũ → tên mới (tương thích localStorage đã lưu)
    var _rawState = raw.state;
    if(_rawState === 'WAIT_WORK_WIFI_5_MIN') _rawState = 'WAIT_CHECKIN_CONFIRM';
    if(_rawState === 'WORKING_WIFI' || _rawState === 'WORKING_GPS_BACKUP' || _rawState === 'WORK_WIFI_LOST') _rawState = 'WORKING';
    if(_rawState === 'POSSIBLE_CHECKOUT' || _rawState === 'CHECKOUT_WAIT_75_MIN') _rawState = 'WAIT_CHECKOUT_CONFIRM';
    if(_rawState) _sa.state = _rawState;

    if(raw.home)    _sa.home    = raw.home;
    if(raw.work)    _sa.work    = raw.work;
    if(raw.subWork) _sa.subWork = raw.subWork;
    if(raw.stateChangedAt) _sa.stateChangedAt = raw.stateChangedAt;
    if(raw.homeSignalLostAt) _sa.homeSignalLostAt = raw.homeSignalLostAt;
    if(raw.workSignalLostAt) _sa.workSignalLostAt = raw.workSignalLostAt;

    // Cửa sổ check-in
    if(raw.checkinWindowStart) _sa.checkinWindowStart = raw.checkinWindowStart;
    if(raw.checkinSignalOnMs)  _sa.checkinSignalOnMs  = raw.checkinSignalOnMs;
    if(raw.checkinSignalOffMs) _sa.checkinSignalOffMs = raw.checkinSignalOffMs;
    _sa.checkinLastSignalState = !!raw.checkinLastSignalState;
    if(raw.checkinLastFlipAt)  _sa.checkinLastFlipAt  = raw.checkinLastFlipAt;

    // Cửa sổ tan ca
    if(raw.checkoutWindowStart) _sa.checkoutWindowStart = raw.checkoutWindowStart;
    if(raw.checkoutSignalOnMs)  _sa.checkoutSignalOnMs  = raw.checkoutSignalOnMs;
    if(raw.checkoutSignalOffMs) _sa.checkoutSignalOffMs = raw.checkoutSignalOffMs;
    _sa.checkoutLastSignalState = (raw.checkoutLastSignalState !== false);
    if(raw.checkoutLastFlipAt)  _sa.checkoutLastFlipAt  = raw.checkoutLastFlipAt;
    if(raw.lastCheckoutAt) _sa.lastCheckoutAt = raw.lastCheckoutAt;
    if(raw.cycleReadyAt) _sa.cycleReadyAt = raw.cycleReadyAt;
    if(raw.gpsWakeupAt) _sa.gpsWakeupAt = raw.gpsWakeupAt;

    // Migrate từ wifiWaitStart cũ nếu đang restore WAIT_CHECKIN_CONFIRM
    if(!_sa.checkinWindowStart && raw.wifiWaitStart && _sa.state === STATE.WAIT_CHECKIN_CONFIRM){
      _sa.checkinWindowStart = raw.wifiWaitStart;
      _sa.checkinLastFlipAt  = raw.wifiWaitStart;
    }
    // Migrate checkoutWaitStart cũ
    if(!_sa.checkoutWindowStart && raw.checkoutWaitStart && _sa.state === STATE.WAIT_CHECKOUT_CONFIRM){
      _sa.checkoutWindowStart = raw.checkoutWaitStart;
      _sa.checkoutLastFlipAt  = raw.checkoutWaitStart;
    }

    _sa.enabled = !!raw.enabled;
    if(raw.lastDailyKey) _sa.lastDailyKey = raw.lastDailyKey;
    _sa.todayCheckedIn = !!raw.todayCheckedIn;
    _sa.todayCheckedOut = !!raw.todayCheckedOut;
    _sa.todayCheckedInSub = !!raw.todayCheckedInSub;
    _sa.todayCheckedOutSub = !!raw.todayCheckedOutSub;
  } catch(e){ console.warn('[SA] saLoad error:', e); }
}

/** Lưu dữ liệu vào localStorage (debounced) */
function saSave(){
  clearTimeout(_saTimers.stateSave);
  _saTimers.stateSave = setTimeout(function(){
    try {
      if(typeof lsSet === 'function'){
        lsSet(STORAGE_KEY, {
          state: _sa.state,
          home: _sa.home,
          work: _sa.work,
          subWork: _sa.subWork,
          stateChangedAt: _sa.stateChangedAt,
          homeSignalLostAt: _sa.homeSignalLostAt,
          workSignalLostAt: _sa.workSignalLostAt,
          checkinWindowStart: _sa.checkinWindowStart,
          checkinSignalOnMs: _sa.checkinSignalOnMs,
          checkinSignalOffMs: _sa.checkinSignalOffMs,
          checkinLastSignalState: _sa.checkinLastSignalState,
          checkinLastFlipAt: _sa.checkinLastFlipAt,
          checkoutWindowStart: _sa.checkoutWindowStart,
          checkoutSignalOnMs: _sa.checkoutSignalOnMs,
          checkoutSignalOffMs: _sa.checkoutSignalOffMs,
          checkoutLastSignalState: _sa.checkoutLastSignalState,
          checkoutLastFlipAt: _sa.checkoutLastFlipAt,
          lastCheckoutAt: _sa.lastCheckoutAt,
          cycleReadyAt: _sa.cycleReadyAt,
          gpsWakeupAt: _sa.gpsWakeupAt,
          enabled: _sa.enabled,
          lastDailyKey: _sa.lastDailyKey,
          todayCheckedIn: _sa.todayCheckedIn,
          todayCheckedOut: _sa.todayCheckedOut,
          todayCheckedInSub: _sa.todayCheckedInSub,
          todayCheckedOutSub: _sa.todayCheckedOutSub
        });
      }
    } catch(e){ console.warn('[SA] saSave error:', e); }
  }, TIMING.STATE_SAVE_MS);
}

/** Đồng bộ GPS công ty từ _gpsData hiện có */
function saSyncWorkGpsFromLegacy(){
  try {
    var g = window._gpsData;
    if(!g) return;
    var job = (typeof saActiveJob === 'function') ? saActiveJob() : (g.activeJob === 'sub' ? 'sub' : 'main');
    var loc = null;
    if(typeof window.gpsGetStoredCompanyLocation === 'function'){
      loc = window.gpsGetStoredCompanyLocation(job);
    }
    if(!loc && g.locations && g.locations[job]){
      loc = g.locations[job];
    }
    if(!loc) loc = g;
    var lat = Number(loc.lat), lng = Number(loc.lng);
    if(Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0){
      var profile = job === 'sub' ? (_sa.subWork || (_sa.subWork = {wifi:[], gps:null})) : _sa.work;
      profile.gps = {
        lat: lat,
        lng: lng,
        radius: Number(loc.radius || g.radius) || 100
      };
    }
  } catch(e){}
}

/* ═══════════════════════════════════════════════════════════════════════════════
   4. TÍN HIỆU — Đọc Wi-Fi, GPS
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Đọc Wi-Fi hiện tại qua native bridge */
function saGetWifi(callback){
  if(window.ccNative && window.ccNative.getWifiInfo){
    window.ccNative.getWifiInfo().then(function(info){
      callback(info);
    }).catch(function(){
      callback(null);
    });
  } else {
    // Fallback: không có native → không có Wi-Fi info
    callback(null);
  }
}

// (Đã bỏ saGetBts — không còn đọc BTS/Cell Tower)

/** Đọc GPS 1 lần (dùng API hiện có) */
function saGetGps(callback){
  if(typeof gpsCurrentPosition === 'function'){
    gpsCurrentPosition(
      function(pos){
        callback({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 50
        });
      },
      function(err){
        // Log chi tiết để debug (err thường non-enumerable)
        var code = err && err.code !== undefined ? err.code : '?';
        var msg  = err && err.message ? err.message : 'unknown';
        console.warn('[SA] GPS error: code=' + code + ' msg=' + msg);
        callback(null);
      }
    );
  } else if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      function(pos){
        callback({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 50
        });
      },
      function(){ callback(null); },
      // FIX timeout: nới 15s → 30s cho high-accuracy (GPS cold-start cần thời gian).
      // Fallback này chỉ chạy khi gpsCurrentPosition (checkin.js) không tồn tại.
      {enableHighAccuracy: true, timeout: 30000, maximumAge: 30000}
    );
  } else {
    callback(null);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   5. SO KHỚP TÍN HIỆU — Kiểm tra match với hồ sơ
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Kiểm tra Wi-Fi hiện tại có khớp với danh sách hồ sơ không.
 * STRICT BSSID-FIRST: nếu cả profile và Wi-Fi hiện tại đều có BSSID
 * → BẮT BUỘC khớp BSSID (KHÔNG fallback SSID nữa). Tránh bị giả mạo
 * bằng router cùng tên SSID nhưng MAC khác (vd: Wi-Fi tên giống ở quán cà phê).
 * Chỉ dùng SSID khi entry cũ chưa có BSSID (backward compat) hoặc OS không trả BSSID.
 */
function saMatchWifi(currentWifi, profileWifiList){
  if(!currentWifi || !currentWifi.connected || !currentWifi.ssid) return false;
  if(!profileWifiList || profileWifiList.length === 0) return false;
  var curBssid = currentWifi.bssid ? String(currentWifi.bssid).toLowerCase() : '';
  for(var i = 0; i < profileWifiList.length; i++){
    var p = profileWifiList[i];
    var pBssid = p.bssid ? String(p.bssid).toLowerCase() : '';
    // Trường hợp 1: cả 2 đều có BSSID → khớp BSSID là tin cậy duy nhất
    if(pBssid && curBssid){
      if(pBssid === curBssid) return true;
      continue; // BSSID khác nhau → entry này KHÔNG khớp, không fallback SSID
    }
    // Trường hợp 2: thiếu BSSID ở 1 bên (entry cũ hoặc OS không trả) → SSID dự phòng
    if(p.ssid && currentWifi.ssid && p.ssid === currentWifi.ssid){
      return true;
    }
  }
  return false;
}

// (Đã bỏ toàn bộ hàm so khớp BTS: saValidBts, saSameBts, saBtsExists,
//  saBtsIsAmbiguous, saHasUsableBts, saMatchBts — không còn dùng BTS)

function saGpsDistanceToProfile(currentGps, profileGps){
  if(!currentGps || !profileGps) return null;
  var curLat = Number(currentGps.lat), curLng = Number(currentGps.lng);
  var profLat = Number(profileGps.lat), profLng = Number(profileGps.lng);
  if(!Number.isFinite(curLat) || !Number.isFinite(curLng) || !Number.isFinite(profLat) || !Number.isFinite(profLng)) return null;
  var dist = gpsDistance(curLat, curLng, profLat, profLng);
  return Number.isFinite(dist) ? dist : null;
}

function saGpsRadius(profileGps, fallback){
  var r = profileGps ? Number(profileGps.radius) : 0;
  return Number.isFinite(r) && r > 0 ? r : fallback;
}

function saGpsExitBuffer(currentGps){
  var acc = currentGps ? Number(currentGps.accuracy || currentGps.acc) : 0;
  if(!Number.isFinite(acc) || acc <= 0) return TIMING.GPS_WORK_EXIT_BUFFER_MIN_M;
  return Math.min(TIMING.GPS_WORK_EXIT_BUFFER_MAX_M, Math.max(TIMING.GPS_WORK_EXIT_BUFFER_MIN_M, acc * 2.5));
}

/**
 * GPS-only decision cho công ty.
 * Nếu nhà và công ty quá gần nhau, không dùng mỗi bán kính vì vùng có thể chồng lên nhau.
 * Khi GPS gần nhà hơn rõ rệt, trả "home"/"ambiguous" thay vì "outside" để state machine
 * không nhảy sai chỉ vì một mẫu GPS lệch.
 */
function saGpsWorkState(currentGps, profileGps){
  var workDist = saGpsDistanceToProfile(currentGps, profileGps);
  if(workDist == null) return null;
  var workRadius = saGpsRadius(profileGps, 100);
  var buffer = saGpsExitBuffer(currentGps);
  var homeGps = _sa.home && _sa.home.gps;
  var homeDist = saGpsDistanceToProfile(currentGps, homeGps);
  var homeWorkDist = saGpsDistanceToProfile(homeGps, profileGps);
  var closeProfiles = homeWorkDist != null && homeWorkDist <= TIMING.GPS_HOME_WORK_CLOSE_M;

  if(closeProfiles && homeDist != null){
    var margin = TIMING.GPS_WORK_HOME_MARGIN_M;
    var homeRadius = saGpsRadius(homeGps, 200);
    if(homeDist + margin < workDist){
      return homeDist <= (homeRadius + buffer) ? 'home' : 'ambiguous';
    }
    if(workDist <= workRadius) return 'inside';
    if(workDist <= workRadius + buffer) return 'ambiguous';
    return 'outside';
  }

  if(workDist <= workRadius) return 'inside';
  if(workDist <= workRadius + buffer) return 'ambiguous';
  return 'outside';
}

/** Kiểm tra GPS hiện tại có trong vùng công ty không */
function saGpsInside(currentGps, profileGps){
  var state = saGpsWorkState(currentGps, profileGps);
  if(state === 'inside') return true;
  if(state === 'outside') return false;
  return null;
}

function saSignalFresh(kind, maxAge){
  var ts = _sa.signals && _sa.signals.ts ? Number(_sa.signals.ts[kind]) : 0;
  return !!ts && (Date.now() - ts) <= maxAge;
}

function saWifiFresh(){ return saSignalFresh('wifi', TIMING.WIFI_SIGNAL_FRESH_MS); }
// saBtsFresh đã bỏ — không còn dùng BTS
function saGpsFresh(){ return saSignalFresh('gps', TIMING.GPS_SIGNAL_FRESH_MS); }

/**
 * Wi-Fi không khả dụng (đã tắt radio hoặc không kết nối mạng nào).
 * Khi này phải bật GPS làm backup vì Wi-Fi không còn dùng được để xác định vị trí.
 */
function saWifiUnavailable(){
  if(!saWifiFresh()) return false; // chưa có dữ liệu mới → chưa kết luận được
  var w = _sa.signals.wifi;
  if(!w) return true;              // null → Wi-Fi tắt
  return w.connected !== true;     // có info nhưng không kết nối
}

/** Kiểm tra GPS gần nhà (nếu có GPS nhà) */
function saGpsNearHome(currentGps){
  if(!currentGps || !_sa.home.gps) return null;
  var dist = saGpsDistanceToProfile(currentGps, _sa.home.gps);
  if(dist == null) return null;
  var workGps = saGetWorkProfile().gps;
  var workDist = saGpsDistanceToProfile(currentGps, workGps);
  var homeWorkDist = saGpsDistanceToProfile(_sa.home.gps, workGps);
  if(homeWorkDist != null && homeWorkDist <= TIMING.GPS_HOME_WORK_CLOSE_M && workDist != null){
    if(workDist + TIMING.GPS_WORK_HOME_MARGIN_M < dist) return false;
  }
  var radius = _sa.home.gps.radius || 200; // bán kính nhà rộng hơn
  return dist <= radius;
}

/** Hồ sơ nhà có Wi-Fi không */
function saHomeHasWifi(){ return _sa.home.wifi && _sa.home.wifi.length > 0; }

// saHomeHasBts đã bỏ — không còn dùng BTS

/** Hồ sơ nhà có GPS không */
function saHomeHasGps(){ return !!_sa.home.gps; }

/** Đang ở nhà theo GPS không */
function saIsAtHomeGps(){
  return saGpsFresh() && saGpsNearHome(_sa.signals.gps) === true;
}

/** Hồ sơ công ty có Wi-Fi không */
function saWorkHasWifi(){ var p=saGetWorkProfile(); return p.wifi && p.wifi.length > 0; }

/** Hồ sơ công ty có GPS không */
function saWorkHasGps(){ return !!saGetWorkProfile().gps; }

/** Đang ở nhà? (theo tín hiệu hiện tại) */
function saIsAtHome(){
  var sig = _sa.signals;
  var wifiFresh = saWifiFresh();
  // 1) Wi-Fi nhà match → chắc chắn ở nhà
  if(wifiFresh && saIsAtHomeWifi()){
    return true;
  }
  // 2) GPS gần nhà (fallback khi Wi-Fi tắt/mất; cần đã lưu GPS nhà)
  if(saHomeHasGps() && saIsAtHomeGps()){
    return true;
  }
  return false;
}

/** Đã rời nhà? (theo tín hiệu hiện tại) */
function saHasLeftHome(){
  var sig = _sa.signals;
  var wifiFresh = saWifiFresh();
  // Fast path: GPS xác nhận đi xa nhà → rời nhà
  if(saHomeHasGps() && saGpsFresh() && saGpsNearHome(sig.gps) === false){
    return true;
  }
  // Mất Wi-Fi nhà → coi như rời (sau khi BTS bị bỏ, Wi-Fi là tín hiệu chính)
  if(saHomeHasWifi()){
    return wifiFresh && !saMatchWifi(sig.wifi, _sa.home.wifi);
  }
  return false;
}

/**
 * FIX P1 #2: Debounce 60s cho việc rời nhà — chỉ trả true khi tín hiệu nhà
 * mất LIÊN TỤC trong HOME_LEAVE_DEBOUNCE_MS. Tránh dao động HOME ↔ LEAVING_HOME
 * khi Wi-Fi rớt 1 nhịp do roaming/handoff giữa các AP.
 *
 * Cách dùng: thay saHasLeftHome() bằng saConfirmedLeftHome(now) ở case STATE.HOME.
 * Khi tín hiệu nhà có lại → tự reset homeSignalLostAt.
 */
function saConfirmedLeftHome(now){
  if(!saHasLeftHome()){
    if(_sa.homeSignalLostAt) _sa.homeSignalLostAt = 0;
    return false;
  }
  if(!_sa.homeSignalLostAt) _sa.homeSignalLostAt = now;
  return (now - _sa.homeSignalLostAt) >= TIMING.HOME_LEAVE_DEBOUNCE_MS;
}

function saCurrentWifiKind(){
  if(!saWifiFresh()) return '';
  var sig = _sa.signals.wifi;
  if(!sig || !sig.connected) return '';
  var home = saHomeHasWifi() && saMatchWifi(sig, _sa.home.wifi);
  var work = saWorkHasWifi() && saMatchWifi(sig, _sa.work.wifi);
  var sub = !!(_sa.subWork && _sa.subWork.wifi && _sa.subWork.wifi.length && saMatchWifi(sig, _sa.subWork.wifi));
  var count = (home?1:0) + (work?1:0) + (sub?1:0);
  if(count > 1) return 'ambiguous';
  if(home) return 'home';
  if(sub) return 'subWork';
  if(work) return 'work';
  return '';
}

/** Đang ở công ty? (theo Wi-Fi) */
function saIsAtWorkWifi(){
  var kind = saCurrentWifiKind();
  if(kind === 'ambiguous') return false;
  return saActiveJob() === 'sub' ? kind === 'subWork' : kind === 'work';
}

/** Đang ở công ty? (theo GPS) */
function saIsAtWorkGps(){
  return saGpsFresh() && _sa.signals.gpsInside === true;
}

/**
 * Đang KẾT NỐI VÀO 1 trong các Wi-Fi ĐÃ LƯU (nhà / công ty / việc phụ) không?
 * Đây là điều kiện quyết định bật/tắt GPS:
 *   - Kết nối Wi-Fi đã lưu → "có tín hiệu" → tắt GPS
 *   - Mất Wi-Fi HOẶC kết nối Wi-Fi lạ → "mất tín hiệu" → bật GPS
 * Wi-Fi lạ (vd quán cà phê) không được tính vì app không biết đó là ở đâu.
 */
function saIsConnectedToSavedWifi(){
  var kind = saCurrentWifiKind();
  return !!kind && kind !== 'ambiguous';
}

/* ═══════════════════════════════════════════════════════════════════════════════
   6. ACTIONS — Thực hiện chấm công
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Auto check-in */
function saIsOutsideWorkGps(){
  return saGpsFresh() && _sa.signals.gpsInside === false;
}

function saIsAtHomeWifi(){
  return saCurrentWifiKind() === 'home';
}

function saCurrentShiftInfo(){
  try {
    if(typeof gpsCurrentShiftSchedule === 'function') return gpsCurrentShiftSchedule();
  } catch(e){}
  return {inMin: 8 * 60, outMin: 17 * 60};
}

function saMinutesFromShiftStart(){
  var shift = saCurrentShiftInfo();
  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var diff = nowMin - (Number(shift.inMin) || 8 * 60);
  if(diff > 12 * 60) diff -= 24 * 60;
  if(diff < -12 * 60) diff += 24 * 60;
  return diff;
}

function saIsNearShiftStart(){
  var diffMs = saMinutesFromShiftStart() * 60 * 1000;
  return diffMs >= -TIMING.HOME_GPS_BEFORE_SHIFT_MS
    && diffMs <= TIMING.HOME_GPS_AFTER_SHIFT_MS;
}

function saShouldRunHomeGpsCheck(){
  if(saIsAtHomeWifi()) return false;
  // Wi-Fi tắt + có GPS profile nào → bật GPS (verify nhà/công ty)
  // Bỏ qua mọi điều kiện khác để đảm bảo có GPS làm backup khi Wi-Fi không dùng được
  if(saWifiUnavailable() && (saHomeHasGps() || saWorkHasGps())) return true;
  if(!saWorkHasGps()) return false;
  if(_sa.todayCheckedIn) return false;
  if(saHasLeftHome()) return true;
  // Sau khi bỏ BTS: chỉ còn Wi-Fi là tín hiệu nhận diện nhà — không có Wi-Fi nhà thì luôn cần GPS
  if(!saHomeHasWifi()) return true;
  return saIsNearShiftStart();
}

function saAttendanceData(){
  return (typeof attData !== 'undefined' && attData) ? attData : {};
}

function saAttendanceRecord(key){
  var data = saAttendanceData();
  if(typeof getAttRecordByKey === 'function') return getAttRecordByKey(key);
  return data[key] || null;
}

function saYesterdayKey(){
  var yd = new Date();
  yd.setDate(yd.getDate() - 1);
  return saDateKeyFromDate(yd);
}

function saOpenAttendanceInfo(job){
  var keys = [todayKey(), saYesterdayKey()];
  for(var i=0;i<keys.length;i++){
    var key = keys[i];
    var day = saAttendanceRecord(key);
    if(!day) continue;
    if(job !== 'sub' && day.in && !day.out) return {key:key, job:'main', rec:day};
    if(job !== 'main' && day.sub && day.sub.in && !day.sub.out) return {key:key, job:'sub', rec:day.sub};
  }
  return null;
}

function saOpenAttendanceKey(job){
  var open = saOpenAttendanceInfo(job);
  return open ? open.key : '';
}

function saHasOpenAttendance(job){
  return !!saOpenAttendanceInfo(job);
}

function saSyncAttendanceFlagsFromData(){
  var today = saAttendanceRecord(todayKey()) || {};
  _sa.todayCheckedIn = !!today.in;
  _sa.todayCheckedOut = !!today.out;
  _sa.todayCheckedInSub = !!(today.sub && today.sub.in);
  _sa.todayCheckedOutSub = !!(today.sub && today.sub.out);
}

function saNeedsOpenAttendanceState(state){
  return state === STATE.WORKING || state === STATE.WAIT_CHECKOUT_CONFIRM;
}

function saHasCheckoutRecord(){
  var today = saAttendanceRecord(todayKey()) || {};
  var yesterday = saAttendanceRecord(saYesterdayKey()) || {};
  return !!(today.out || (today.sub && today.sub.out) || yesterday.out || (yesterday.sub && yesterday.sub.out));
}

function saShouldPreserveCheckedOutSleep(now){
  var sleepMs = _saPostCheckoutSleepMs(now || Date.now());
  return sleepMs > 0 && !saHasOpenAttendance() && saHasCheckoutRecord();
}

function saNormalizePostCheckoutState(reason){
  if(!saShouldPreserveCheckedOutSleep()) return false;
  if(_sa.state === STATE.CHECKED_OUT) return false;
  var old = _sa.state;
  _sa.state = STATE.CHECKED_OUT;
  _sa.stateChangedAt = Date.now();
  _sa.checkoutWaitStart = 0;
  _sa.wifiLostAt = 0;
  _sa.workSignalLostAt = 0;
  saResetCheckinConfirm();
  saResetCheckoutConfirm();
  saSave();
  saLog('STATE_NORMALIZED', old + ' -> CHECKED_OUT (' + (reason || 'giu ngu sau checkout') + ')');
  return true;
}

function saResetStaleWorkState(reason){
  if(saNormalizePostCheckoutState('reset stale guard')) return true;
  saSyncAttendanceFlagsFromData();
  if(!saNeedsOpenAttendanceState(_sa.state) || saHasOpenAttendance()) return false;
  var old = _sa.state;
  _sa.state = STATE.HOME;
  _sa.stateChangedAt = Date.now();
  _sa.checkoutWaitStart = 0;
  _sa.wifiLostAt = 0;
  _sa.workSignalLostAt = 0;
  saResetCheckinConfirm();
  saResetCheckoutConfirm();
  if(_sa.gpsActive) saStopGps();
  saSave();
  saLog('STATE_RESET', old + ' -> HOME (' + (reason || 'khong co IN dang mo') + ')');
  return true;
}

function saShouldBlockTransition(newState){
  saSyncAttendanceFlagsFromData();
  if(saNeedsOpenAttendanceState(newState) && !saHasOpenAttendance()) return true;
  if(newState === STATE.CHECKED_OUT && !saHasOpenAttendance() && !saHasCheckoutRecord()) return true;
  return false;
}

function saIsPreCheckinState(state){
  return state === STATE.HOME
    || state === STATE.LEAVING_HOME
    || state === STATE.GOING_TO_WORK
    || state === STATE.WAIT_CHECKIN_CONFIRM
    || state === STATE.CHECKED_OUT;
}

function saReconcileExistingCheckinState(reason){
  saSyncAttendanceFlagsFromData();
  var open = saOpenAttendanceInfo();
  if(!open) return false;
  if(_sa.state === STATE.WORKING || _sa.state === STATE.WAIT_CHECKOUT_CONFIRM) return false;
  if(!saIsPreCheckinState(_sa.state)) return false;
  var old = _sa.state;
  _sa.lastCheckoutAt = 0;
  _sa.cycleReadyAt = 0;
  _sa.gpsWakeupAt = 0;
  _sa.workSignalLostAt = 0;
  saResetCheckinConfirm();
  saResetCheckoutConfirm();
  _saCancelGpsWakeup();
  saTransition(STATE.WORKING, (reason || 'da co IN, dong bo WORKING') + ' [' + old + ' -> WORKING, ' + open.job + ']');
  return true;
}

/** Trả về job đang active: 'sub' nếu user bật sub-job và GPS đang nhắm vào sub, ngược lại 'main' */
function saActiveJob(){
  return (window._gpsData && _gpsData.activeJob === 'sub'
       && window.userData && userData.subJob && userData.subJob.active)
    ? 'sub' : 'main';
}

/** Trả về profile địa điểm làm việc đang active (main hoặc sub) */
function saGetWorkProfile(){
  if(saActiveJob() === 'sub'){
    if(!_sa.subWork) _sa.subWork = {wifi:[], gps:null};
    return _sa.subWork;
  }
  return _sa.work;
}

function saDateKeyFromDate(d){
  if(typeof dateKeyFromDate === 'function') return dateKeyFromDate(d);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function saRecordDateFromMs(ms, fallbackMs){
  var n = Number(ms);
  if(!Number.isFinite(n) || n <= 0) n = fallbackMs;
  return new Date(n);
}

function saDoCheckin(method, atMs){
  var isSub = saActiveJob() === 'sub';
  var isBrainMethod = String(method || '').indexOf('brain_') === 0;

  // Guard: đã chấm hôm nay rồi
  if(isSub ? _sa.todayCheckedInSub : _sa.todayCheckedIn) return 'already_in';

  // Record the moment the confirmation window started, not the wake/open time.
  var t = saRecordDateFromMs(atMs, Date.now() - saCheckinMs());
  var k = saDateKeyFromDate(t);
  var targetJob = isSub ? 'sub' : 'main';

  if(!isBrainMethod && typeof gpsEnsureCycleForCheckin === 'function'){
    // Smart auto không nên bật popup confirm "đóng ca cũ" vì dễ gây cảm giác
    // "tự dưng hiện cảnh báo". Việc confirm để manual flow xử lý.
    var canConfirm = false;
    var cycle = gpsEnsureCycleForCheckin(targetJob, {
      source: 'smart_attendance',
      nowMs: t.getTime(),
      closeMs: t.getTime(),
      allowConfirm: canConfirm,
      showBanner: true
    });
    if(!cycle || !cycle.allowed){
      saLog('CHECK_IN_BLOCKED', targetJob + ': blocked by cycle guard (' + (cycle && cycle.reason ? cycle.reason : 'unknown') + ')');
      return false;
    }
  }

  if(isSub){
    // Kiểm tra chu kỳ 8 tiếng cho sub-job
    if(!isBrainMethod && typeof gpsCanStartNewAutoCycle === 'function' && !gpsCanStartNewAutoCycle('sub')){
      saLog('CHECK_IN_BLOCKED', 'sub: chưa đủ 8h từ lần ra ca gần nhất'); return false;
    }
    if(attData[k] && attData[k].sub && attData[k].sub.in){
      saLog('CHECK_IN_SKIP', 'Đã có IN sub hôm nay'); return 'already_in';
    }
  } else {
    if(!isBrainMethod && typeof gpsCanStartNewAutoCycle === 'function' && !gpsCanStartNewAutoCycle('main')){
      saLog('CHECK_IN_BLOCKED', 'Chưa đủ 8h từ lần ra ca gần nhất'); return false;
    }
    if(attData[k] && attData[k].in){
      saLog('CHECK_IN_SKIP', 'Đã có IN hôm nay'); return 'already_in';
    }
  }

  var hm = fmtTime(t);
  if(!attData[k]) attData[k] = {type:'cm'};

  if(isSub){
    if(!attData[k].sub) attData[k].sub = {type:'cm'};
    if(typeof attendanceSetIn === 'function') attendanceSetIn(attData[k].sub, k, hm, t.getTime());
    else { attData[k].sub.in = hm; attData[k].sub.checkInAt = t.getTime(); }
    attData[k].sub.type = 'cm';
    attData[k].sub.auto = true;
    attData[k].sub.autoMethod = method || 'smart';
    _sa.todayCheckedInSub = true;
  } else {
    if(typeof attendanceSetIn === 'function') attendanceSetIn(attData[k], k, hm, t.getTime());
    else { attData[k].in = hm; attData[k].checkInAt = t.getTime(); }
    attData[k].type = 'cm';
    attData[k].auto = true;
    attData[k].autoMethod = method || 'smart';
    _sa.todayCheckedIn = true;
  }

  saveAtt();
  if(typeof renderHomeStats === 'function') renderHomeStats();
  saSave();

  // Thông báo
  var methodLabel = method === 'wifi' ? 'Wi-Fi' : method === 'gps' ? 'GPS' : 'Smart';
  var _L0 = _saL();
  var subName = isSub ? ((userData && userData.subJob && userData.subJob.name) || 'Job phụ') : '';
  var _inMsg = {vi:'✅ Đã vào ca lúc ',en:'✅ Clocked in at ',ko:'✅ 출근 완료 ',ja:'✅ 出勤 ',zh:'✅ 上班打卡 ',my:'✅ ဝင်ချိန် ',th:'✅ เข้างานเวลา ',id:'✅ Masuk pukul ',ph:'✅ Nag-time in ',ne:'✅ भित्रिएको ',hi:'✅ अंदर समय '}[_L0]||'✅ Đã vào ca lúc ';
  var _inNotifTitle = {vi:'✅ Đã vào ca',en:'✅ Clocked In',ko:'✅ 출근',ja:'✅ 出勤',zh:'✅ 上班',my:'✅ ဝင်',th:'✅ เข้างาน',id:'✅ Masuk',ph:'✅ Time In',ne:'✅ भित्रियो',hi:'✅ प्रवेश'}[_L0]||'✅ Đã vào ca';
  var _inNotifBody = {vi:'Chấm công vào ca lúc ',en:'Clocked in at ',ko:'출근 ',ja:'出勤 ',zh:'上班打卡 ',my:'ဝင်ချိန် ',th:'เข้างานเวลา ',id:'Masuk pukul ',ph:'Time in ng ',ne:'भित्रिएको ',hi:'अंदर समय '}[_L0]||'Chấm công vào ca lúc ';
  var _autoSfx = {vi:' tự động',en:' auto',ko:' 자동',ja:' 自動',zh:' 自动',my:' အော်တို',th:' อัตโนมัติ',id:' otomatis',ph:' auto',ne:' स्वतः',hi:' स्वतः'}[_L0]||' tự động';
  var prefix = isSub ? ('💼 ' + subName + ' ') : '';
  showGpsBanner(prefix + _inMsg + hm + ' (' + methodLabel + ')', isSub ? '#7B5EA7' : '#0D9E75');

  if(window.ccNative && window.ccNative.scheduleNotification){
    window.ccNative.scheduleNotification(
      (isSub ? '💼 ' + subName + ' — ' : '') + _inNotifTitle,
      _inNotifBody + hm + ' (' + methodLabel + _autoSfx + ')',
      isSub ? 2003 : 2001,
      Date.now() + 2000
    ).catch(function(){});
  }

  saLog('CHECK_IN_OK', method + ' — ' + hm + (isSub ? ' [sub]' : ''));
  return true;
}

/** Auto check-out */
function saDoCheckout(method, atMs){
  var isSub = saActiveJob() === 'sub';

  // Guard: đã chấm ra hôm nay rồi
  if(isSub ? _sa.todayCheckedOutSub : _sa.todayCheckedOut) return;

  // Record the time the leave/home signal started, even if the app wakes later.
  var t = saRecordDateFromMs(atMs, Date.now() - saCheckoutMs());
  var k = saDateKeyFromDate(t);
  var yd = new Date(t.getTime()); yd.setDate(yd.getDate() - 1);
  var yk = saDateKeyFromDate(yd);

  if(isSub){
    // Tìm ngày có sub.in mà chưa có sub.out
    if(!attData[k] || !attData[k].sub || !attData[k].sub.in){
      if(attData[yk] && attData[yk].sub && attData[yk].sub.in && !attData[yk].sub.out){
        k = yk;
      } else {
        saLog('CHECK_OUT_SKIP', 'sub: không có IN để checkout'); return;
      }
    }
    if(attData[k].sub && attData[k].sub.out){
      saLog('CHECK_OUT_SKIP', 'sub: đã có OUT'); return;
    }
  } else {
    // Tìm ngày có IN mà chưa có OUT (xử lý ca qua đêm)
    if(!attData[k] || !attData[k].in){
      if(attData[yk] && attData[yk].in && !attData[yk].out){
        k = yk;
      } else {
        saLog('CHECK_OUT_SKIP', 'Không có IN để checkout'); return;
      }
    }
    if(attData[k] && attData[k].out){
      saLog('CHECK_OUT_SKIP', 'Đã có OUT'); return;
    }
  }

  var hm = fmtTime(t);

  if(isSub){
    if(!attData[k].sub) attData[k].sub = {type:'cm'};
    if(typeof attendanceSetOut === 'function') attendanceSetOut(attData[k].sub, k, hm, t.getTime());
    else { attData[k].sub.out = hm; attData[k].sub.checkOutAt = t.getTime(); }
    attData[k].sub.auto = true;
    attData[k].sub.autoOutMethod = method || 'smart';
    _sa.todayCheckedOutSub = true;
  } else {
    if(typeof attendanceSetOut === 'function') attendanceSetOut(attData[k], k, hm, t.getTime());
    else { attData[k].out = hm; attData[k].checkOutAt = t.getTime(); }
    attData[k].auto = true;
    attData[k].autoOutMethod = method || 'smart';
    _sa.todayCheckedOut = true;
  }

  saveAtt();
  if(typeof renderHomeStats === 'function') renderHomeStats();
  saSave();

  var _L1 = _saL();
  var _homeWifi = {vi:'Wi-Fi nhà',en:'Home Wi-Fi',ko:'집 Wi-Fi',ja:'自宅Wi-Fi',zh:'家Wi-Fi',my:'အိမ် Wi-Fi',th:'Wi-Fi บ้าน',id:'Wi-Fi rumah',ph:'Wi-Fi bahay',ne:'घर Wi-Fi',hi:'घर Wi-Fi'}[_L1]||'Wi-Fi nhà';
  var _tout80   = {vi:'timeout 80p',en:'timeout 80m',ko:'타임아웃80분',ja:'タイムアウト80分',zh:'超时80分',my:'timeout 80p',th:'หมดเวลา 80น',id:'timeout 80m',ph:'timeout 80m',ne:'timeout 80m',hi:'timeout 80m'}[_L1]||'timeout 80p';
  var methodLabel = method === 'wifi_home' ? _homeWifi : method === 'gps_home' ? 'GPS nhà' : method === 'timeout' ? _tout80 : method === 'gps' ? 'GPS' : 'Smart';
  var _outMsg = {vi:'🏁 Đã ra ca lúc ',en:'🏁 Clocked out at ',ko:'🏁 퇴근 완료 ',ja:'🏁 退勤 ',zh:'🏁 下班打卡 ',my:'🏁 ထွက်ချိန် ',th:'🏁 ออกงานเวลา ',id:'🏁 Keluar pukul ',ph:'🏁 Nag-time out ',ne:'🏁 बाहिरिएको ',hi:'🏁 बाहर समय '}[_L1]||'🏁 Đã ra ca lúc ';
  var _outNotifTitle = {vi:'🏁 Đã ra ca',en:'🏁 Clocked Out',ko:'🏁 퇴근',ja:'🏁 退勤',zh:'🏁 下班',my:'🏁 ထွက်',th:'🏁 ออกงาน',id:'🏁 Keluar',ph:'🏁 Time Out',ne:'🏁 बाहिरियो',hi:'🏁 बाहर'}[_L1]||'🏁 Đã ra ca';
  var _outNotifBody = {vi:'Chấm công ra ca lúc ',en:'Clocked out at ',ko:'퇴근 ',ja:'退勤 ',zh:'下班打卡 ',my:'ထွက်ချိန် ',th:'ออกงานเวลา ',id:'Keluar pukul ',ph:'Time out ng ',ne:'बाहिरिएको ',hi:'बाहर समय '}[_L1]||'Chấm công ra ca lúc ';
  var _autoSfx1 = {vi:' tự động',en:' auto',ko:' 자동',ja:' 自動',zh:' 自动',my:' အော်တို',th:' อัตโนมัติ',id:' otomatis',ph:' auto',ne:' स्वतः',hi:' स्वतः'}[_L1]||' tự động';
  var subName1 = isSub ? ((userData && userData.subJob && userData.subJob.name) || 'Job phụ') : '';
  var prefix1 = isSub ? ('💼 ' + subName1 + ' ') : '';
  showGpsBanner(prefix1 + _outMsg + hm + ' (' + methodLabel + ')', isSub ? '#9B6FC0' : '#F5A623');

  // Dùng scheduleNotification (AlarmManager) thay vì sendNotification trực tiếp
  // để notification hiện ngay cả khi app đang background (OEM battery optimizer hay chặn bridge)
  if(window.ccNative && window.ccNative.scheduleNotification){
    window.ccNative.scheduleNotification(
      (isSub ? '💼 ' + subName1 + ' — ' : '') + _outNotifTitle,
      _outNotifBody + hm + ' (' + methodLabel + _autoSfx1 + ')',
      isSub ? 2004 : 2002,
      Date.now() + 2000
    ).catch(function(){});
  }

  saLog('CHECK_OUT_OK', method + ' — ' + hm + (isSub ? ' [sub]' : ''));

  // Huỷ alarm deadline checkout vì checkout đã xảy ra (dù qua kênh nào)
  if(window.ccNative && window.ccNative.cancelNotification){
    window.ccNative.cancelNotification(9101).catch(function(){});
  }

  // Tắt GPS ngay sau ra ca, đặt timer đánh thức lại trước chu kỳ mới 15p.
  saStopGps();
  _saScheduleGpsWakeup(t.getTime());
}

/* ═══════════════════════════════════════════════════════════════════════════════
   7. GPS CONTROL — Bật/tắt GPS theo trạng thái
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Bật GPS polling với tần suất nhất định */
function saStartGps(intervalMs){
  intervalMs = intervalMs || TIMING.GPS_POLL_TRAVEL_MS;
  if(_sa.gpsActive && _saTimers.gps && _saTimers.gpsIntervalMs === intervalMs) return;
  saStopGps();
  _sa.gpsActive = true;
  _saTimers.gpsIntervalMs = intervalMs;
  // Poll ngay lần đầu
  saGpsPoll();
  // Đặt interval
  _saTimers.gps = setInterval(saGpsPoll, intervalMs);
  saLog('GPS_ON', 'interval=' + Math.round(intervalMs / 1000) + 's');
}

/** Tắt GPS polling */
function saStopGps(){
  if(!_saTimers.gps && !_sa.gpsActive) return;
  if(_saTimers.gps){
    clearInterval(_saTimers.gps);
    _saTimers.gps = null;
  }
  _saTimers.gpsIntervalMs = 0;
  _sa.gpsActive = false;
}

var _saGpsWakeupTimer = null;

/** Huỷ timer đánh thức GPS */
function _saCancelGpsWakeup(){
  if(_saGpsWakeupTimer){ clearTimeout(_saGpsWakeupTimer); _saGpsWakeupTimer = null; }
  try{ lsSet('cp22_sa_gps_wakeup_at', null); }catch(e){}
}

function _saPersistCycleTimers(){
  try{
    lsSet('cp22_sa_last_checkout_at', _sa.lastCheckoutAt || 0);
    lsSet('cp22_sa_cycle_ready_at', _sa.cycleReadyAt || 0);
    lsSet('cp22_sa_gps_wakeup_at', _sa.gpsWakeupAt || 0);
  }catch(e){}
}

function _saLoadCycleTimers(){
  try{
    _sa.lastCheckoutAt = Number(_sa.lastCheckoutAt || lsGet('cp22_sa_last_checkout_at') || 0);
    _sa.cycleReadyAt = Number(_sa.cycleReadyAt || lsGet('cp22_sa_cycle_ready_at') || 0);
    _sa.gpsWakeupAt = Number(_sa.gpsWakeupAt || lsGet('cp22_sa_gps_wakeup_at') || 0);
  }catch(e){}
}

function _saPostCheckoutSleepMs(now){
  now = now || Date.now();
  _saLoadCycleTimers();
  return _sa.gpsWakeupAt > now ? (_sa.gpsWakeupAt - now) : 0;
}

function _saWakeForNextCycle(reason){
  _saCancelGpsWakeup();
  _sa.gpsWakeupAt = 0;
  _sa.todayCheckedIn = false;
  _sa.todayCheckedOut = false;
  _sa.todayCheckedInSub = false;
  _sa.todayCheckedOutSub = false;
  if(_sa.state === STATE.CHECKED_OUT) _sa.state = STATE.HOME;
  _sa.stateChangedAt = Date.now();
  _saPersistCycleTimers();
  saSave();
  saSyncNativeSmartState();
  saLog('GPS_WAKEUP', (reason || 'wake') + ' | cycleReadyIn=' + Math.max(0, Math.ceil(((_sa.cycleReadyAt || 0) - Date.now()) / 60000)) + 'p');
  saConfigurePolling();
  saEvaluate();
  saUpdateUI();
}

/**
 * Đặt timer đánh thức GPS sau 7h45 kể từ lúc ra ca.
 * GPS được bật sớm 15p để bắt tín hiệu, nhưng cycle guard vẫn chặn IN tới đủ 8h.
 */
function _saScheduleGpsWakeup(checkoutAtMs){
  _saCancelGpsWakeup();
  var base = Number(checkoutAtMs) > 0 ? Number(checkoutAtMs) : Date.now();
  var wakeupAt = base + TIMING.GPS_WAKEUP_AFTER_OUT_MS;
  var cycleReadyAt = base + TIMING.NEW_CYCLE_WAIT_MS;
  _sa.lastCheckoutAt = base;
  _sa.cycleReadyAt = cycleReadyAt;
  _sa.gpsWakeupAt = wakeupAt;
  _saPersistCycleTimers();
  var delay = wakeupAt - Date.now();
  if(delay <= 0){
    setTimeout(function(){ _saWakeForNextCycle('wakeup qua han'); }, 0);
    return;
  }
  try{ lsSet('cp22_sa_gps_wakeup_at', wakeupAt); }catch(e){}
  _saGpsWakeupTimer = setTimeout(function(){
    _saGpsWakeupTimer = null;
    if(!_sa || !_sa.enabled) return;
    _saWakeForNextCycle('7h45 sau ra ca');
  }, delay);
  saLog('GPS_WAKEUP_SCHEDULED', 'sau ' + Math.round(delay / 60000) + 'p | cycleReady=' + Math.round((cycleReadyAt - Date.now()) / 60000) + 'p');
}

/**
 * Phục hồi wakeup timer khi app khởi động lại (nếu còn thời gian chưa hết)
 */
function _saRestoreGpsWakeup(){
  try{
    _saLoadCycleTimers();
    var wakeupAt = Number(_sa.gpsWakeupAt || 0);
    if(!wakeupAt) return;
    var remaining = wakeupAt - Date.now();
    if(remaining <= 0){
      if(!_sa || !_sa.enabled) return;
      _saWakeForNextCycle('restore het timer');
    } else {
      // Còn thời gian → đặt lại timer với thời gian còn lại
      _saGpsWakeupTimer = setTimeout(function(){
        _saGpsWakeupTimer = null;
        if(!_sa || !_sa.enabled) return;
        _saWakeForNextCycle('restore 7h45');
      }, remaining);
      saLog('GPS_WAKEUP_RESTORED', 'con ' + Math.round(remaining / 60000) + ' phut');
    }
  }catch(e){}
}

/** GPS poll 1 lần */
function saGpsPoll(){
  saGetGps(function(gps){
    _sa.signals.gps = gps;
    _sa.signals.ts.gps = Date.now();
    if(gps && saWorkHasGps()){
      _sa.signals.gpsInside = saGpsInside(gps, saGetWorkProfile().gps);
    } else {
      _sa.signals.gpsInside = null;
    }
    try{ _gpsWasInside = _sa.signals.gpsInside; }catch(e){}
    try{ if(typeof updateGpsStatus === 'function') updateGpsStatus(); }catch(e){}
    // Trigger state machine sau khi có GPS mới
    saRequestEvaluate();
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   8. POLLING — Wi-Fi định kỳ
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Bắt đầu poll Wi-Fi */
function saStartWifiPoll(){
  if(_saTimers.wifi) return;
  saWifiPoll(); // poll ngay
  _saTimers.wifi = setInterval(saWifiPoll, TIMING.WIFI_POLL_MS);
}

/** Dừng poll Wi-Fi */
function saStopWifiPoll(){
  if(_saTimers.wifi){ clearInterval(_saTimers.wifi); _saTimers.wifi = null; }
}

/** Poll Wi-Fi 1 lần.
 *  Nếu trạng thái "đang kết nối Wi-Fi ĐÃ LƯU" đổi (vừa rớt / vừa bắt được Wi-Fi
 *  đã lưu / chuyển sang Wi-Fi lạ) → gọi saConfigurePolling bật/tắt GPS.
 *  Wi-Fi lạ KHÔNG được tính là "có tín hiệu" — vẫn coi như mất Wi-Fi.
 */
function saWifiPoll(){
  var prevMatched = saIsConnectedToSavedWifi();
  saGetWifi(function(info){
    _sa.signals.wifi = info;
    _sa.signals.ts.wifi = Date.now();
    var nowMatched = saIsConnectedToSavedWifi();
    if(prevMatched !== nowMatched){
      // Trạng thái "Wi-Fi đã lưu" đổi → re-cấu hình GPS
      saLog('WIFI_SAVED_CHANGE', prevMatched + ' -> ' + nowMatched);
      saConfigurePolling();
    }
    saRequestEvaluate();
  });
}

// (Đã bỏ saStartBtsPoll / saStopBtsPoll / saBtsPoll — không còn poll BTS)

function saRequestEvaluate(){
  if(_saTimers.evaluate) return;
  _saTimers.evaluate = setTimeout(function(){
    _saTimers.evaluate = null;
    saEvaluate();
    saUpdateUI();
  }, TIMING.EVALUATE_DEBOUNCE_MS);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   9. STATE MACHINE — Bộ não chính
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Chuyển trạng thái */
function saTransition(newState, reason){
  var old = _sa.state;
  if(old === newState) return;
  if(saShouldBlockTransition(newState)){
    _sa.state = STATE.HOME;
    _sa.stateChangedAt = Date.now();
    _sa.checkoutWaitStart = 0;
    _sa.wifiLostAt = 0;
    _sa.workSignalLostAt = 0;
    saResetCheckinConfirm();
    saResetCheckoutConfirm();
    if(_sa.gpsActive) saStopGps();
    saSave();
    saLog('TRANSITION_BLOCKED', old + ' -> ' + newState + ' (khong co IN dang mo)');
    saUpdateUI();
    saConfigurePolling();
    return;
  }
  _sa.state = newState;
  _sa.stateChangedAt = Date.now();
  if(newState !== STATE.WAIT_CHECKOUT_CONFIRM) _sa.workSignalLostAt = 0;
  saSave();
  saSyncNativeSmartState();
  saLog('TRANSITION', old + ' → ' + newState + (reason ? ' (' + reason + ')' : ''));
  saUpdateUI();
  saConfigurePolling();
}

/** Cấu hình polling phù hợp với trạng thái hiện tại */
function saConfigurePolling(){
  var s = _sa.state;

  switch(s){
    case STATE.HOME:
      saStartWifiPoll();
      if(saShouldRunHomeGpsCheck()) saStartGps(TIMING.GPS_HOME_CHECK_MS);
      else saStopGps();
      break;
      if(saIsAtWorkWifi()){
        saDoCheckin('wifi');
        saTransition(STATE.WORKING_WIFI, 'ket noi Wi-Fi cong ty');
        break;
      }
      if(saIsAtHome()){
        if(_sa.gpsActive) saStopGps();
        break;
      }
      if(saHasLeftHome()){
        saTransition(STATE.LEAVING_HOME, 'roi vung nha');
        break;
      }
      if(saShouldRunHomeGpsCheck()){
        if(!_sa.gpsActive) saStartGps(TIMING.GPS_HOME_CHECK_MS);
        if(saIsAtWorkGps()){
          _sa.wifiWaitStart = now;
          saTransition(STATE.WAIT_WORK_WIFI_5_MIN, 'GPS vao vung, cho Wi-Fi');
        }
      } else if(_sa.gpsActive) {
        saStopGps();
      }
      break;
      // Ở nhà: poll Wi-Fi để phát hiện rời nhà, GPS tắt
      saStartWifiPoll();
      if(saShouldRunHomeGpsCheck()) saStartGps(TIMING.GPS_HOME_CHECK_MS);
      else saStopGps();
      break;

    case STATE.LEAVING_HOME:
      // Vừa rời nhà: bật GPS để tìm công ty
      saStartWifiPoll();
      saStartGps(TIMING.GPS_POLL_TRAVEL_MS);
      break;

    case STATE.GOING_TO_WORK:
      // Đang đi: GPS poll 1.5p, Wi-Fi poll để phát hiện công ty
      saStartWifiPoll();
      if(!_sa.gpsActive) saStartGps(TIMING.GPS_POLL_TRAVEL_MS);
      break;

    case STATE.WAIT_WORK_WIFI_5_MIN:
      // GPS vào vùng, chờ Wi-Fi: poll Wi-Fi nhanh hơn, GPS vẫn chạy
      saStartWifiPoll();
      if(!_sa.gpsActive) saStartGps(TIMING.GPS_POLL_NEAR_SHIFT_MS);
      break;

    case STATE.WORKING_WIFI:
      // Đang làm việc bằng Wi-Fi: tắt GPS, chỉ poll Wi-Fi
      saStartWifiPoll();
      saStopGps();
      break;

    case STATE.WORKING_GPS_BACKUP:
      saStartWifiPoll();
      saStartGps(TIMING.GPS_POLL_BACKUP_MS);
      break;
      if(saIsAtHome()){
        saDoCheckout('wifi_home');
        saTransition(STATE.CHECKED_OUT, 've Wi-Fi nha');
        break;
      }
      // Đang làm việc bằng GPS backup: GPS chạy nền nhẹ
      saStartWifiPoll(); // vẫn kiểm tra Wi-Fi
      saStartGps(TIMING.GPS_POLL_BACKUP_MS);
      break;

    case STATE.WORK_WIFI_LOST:
      saStartWifiPoll();
      saStartGps(TIMING.GPS_POLL_NEAR_SHIFT_MS);
      break;
      if(saIsAtHomeWifi()){
        saDoCheckout('wifi_home');
        saTransition(STATE.CHECKED_OUT, 've Wi-Fi nha');
        break;
      }
      if(saIsAtWorkWifi()){
        saTransition(STATE.WORKING_WIFI, 'Wi-Fi cong ty quay lai');
        break;
      }
      if(saIsAtWorkGps()){
        saTransition(STATE.WORKING_GPS_BACKUP, 'GPS xac nhan van o cong ty');
        break;
      }
      if(saIsOutsideWorkGps()){
        saTransition(STATE.POSSIBLE_CHECKOUT, 'GPS xac nhan roi cong ty');
      }
      break;
      // Mất Wi-Fi, đang verify GPS
      saStartWifiPoll();
      saStartGps(TIMING.GPS_POLL_NEAR_SHIFT_MS);
      break;

    case STATE.POSSIBLE_CHECKOUT:
    case STATE.CHECKOUT_WAIT_75_MIN:
      // Có thể đã tan ca: GPS + Wi-Fi để kiểm tra
      saStartWifiPoll();
      saStartGps(TIMING.GPS_POLL_TRAVEL_MS);
      break;

    case STATE.CHECKED_OUT:
      // Đã checkout: chỉ cần Wi-Fi để phát hiện về nhà
      saStartWifiPoll();
      saStopGps();
      break;
  }
}

/** Đánh giá tín hiệu và chuyển trạng thái (gọi mỗi khi có tín hiệu mới) */
function saEvaluate(){
  if(!_sa.enabled) return;
  if(_sa.nativeBrainFull){
    saBrainPullState('evaluate-full');
    saBrainConsumePending('evaluate-full');
    return;
  }
  saDailyReset();
  if(saReconcileExistingCheckinState('evaluate da co ca dang mo')){
    saConfigurePolling();
    saUpdateUI();
    return;
  }
  if(saResetStaleWorkState('evaluate khong co ca dang mo')){
    saConfigurePolling();
    saUpdateUI();
    return;
  }
  var s = _sa.state;
  var now = Date.now();

  if(s === STATE.HOME){
    if(saIsAtWorkWifi()){
      saDoCheckin('wifi');
      saTransition(STATE.WORKING_WIFI, 'ket noi Wi-Fi cong ty');
      return;
    }
    if(saIsAtHomeWifi()){
      if(_sa.gpsActive) saStopGps();
      return;
    }
    if(saHasLeftHome()){
      saTransition(STATE.LEAVING_HOME, 'mat tin hieu nha');
      return;
    }
    if(saShouldRunHomeGpsCheck()){
      if(!_sa.gpsActive) saStartGps(TIMING.GPS_HOME_CHECK_MS);
      if(saIsAtWorkGps()){
        _sa.wifiWaitStart = now;
        saTransition(STATE.WAIT_WORK_WIFI_5_MIN, 'GPS vao vung, cho Wi-Fi');
      }
    } else if(_sa.gpsActive) {
      saStopGps();
    }
    return;
  }

  if(s === STATE.WORKING_GPS_BACKUP){
    if(saIsAtHomeWifi()){
      saDoCheckout('wifi_home');
      saTransition(STATE.CHECKED_OUT, 've Wi-Fi nha');
      return;
    }
    if(saIsAtWorkWifi()){
      saTransition(STATE.WORKING_WIFI, 'bat duoc Wi-Fi cong ty');
      return;
    }
    if(saIsAtWorkGps()) return;
    if(saIsOutsideWorkGps()) saTransition(STATE.POSSIBLE_CHECKOUT, 'GPS xac nhan roi cong ty');
    return;
  }

  if(s === STATE.WORK_WIFI_LOST){
    if(saIsAtHomeWifi()){
      saDoCheckout('wifi_home');
      saTransition(STATE.CHECKED_OUT, 've Wi-Fi nha');
      return;
    }
    if(saIsAtWorkWifi()){
      saTransition(STATE.WORKING_WIFI, 'Wi-Fi cong ty quay lai');
      return;
    }
    if(saIsAtWorkGps()){
      saTransition(STATE.WORKING_GPS_BACKUP, 'GPS xac nhan van o cong ty');
      return;
    }
    if(saIsOutsideWorkGps()) saTransition(STATE.POSSIBLE_CHECKOUT, 'GPS xac nhan roi cong ty');
    return;
  }

  switch(s){

    /* ─── HOME: Đang ở nhà ──────────────────────────────────── */
    case STATE.HOME:
      if(saHasLeftHome()){
        saTransition(STATE.LEAVING_HOME, 'mất Wi-Fi nhà');
      }
      break;

    /* ─── LEAVING_HOME: Vừa rời nhà ─────────────────────────── */
    case STATE.LEAVING_HOME:
      // Nếu quay lại nhà → về HOME
      if(saIsAtHomeWifi()){
        saTransition(STATE.HOME, 'quay lại nhà');
        break;
      }
      // Kết nối Wi-Fi công ty → check-in ngay
      if(saIsAtWorkWifi()){
        saDoCheckin('wifi');
        saTransition(STATE.WORKING_WIFI, 'kết nối Wi-Fi công ty');
        break;
      }
      // Chuyển sang GOING_TO_WORK (GPS đã được bật ở configurePolling)
      saTransition(STATE.GOING_TO_WORK, 'GPS bật, đang tìm công ty');
      break;

    /* ─── GOING_TO_WORK: Đang di chuyển ─────────────────────── */
    case STATE.GOING_TO_WORK:
      // Quay lại nhà
      if(saIsAtHomeWifi()){
        saTransition(STATE.HOME, 'quay lại nhà');
        break;
      }
      // Kết nối Wi-Fi công ty → check-in ngay
      if(saIsAtWorkWifi()){
        saDoCheckin('wifi');
        saTransition(STATE.WORKING_WIFI, 'kết nối Wi-Fi công ty');
        break;
      }
      // GPS vào vùng công ty → chờ 20p để Wi-Fi xác nhận, nếu không có Wi-Fi thì check-in GPS
      if(saIsAtWorkGps()){
        _sa.wifiWaitStart = now;
        saTransition(STATE.WAIT_WORK_WIFI_5_MIN, 'GPS vào vùng, chờ Wi-Fi');
        break;
      }
      break;

    /* ─── WAIT_WORK_WIFI_5_MIN: GPS vào vùng, chờ Wi-Fi 5p ──── */
    case STATE.WAIT_WORK_WIFI_5_MIN:
      // Bắt được Wi-Fi công ty → check-in bằng Wi-Fi
      if(saIsAtWorkWifi()){
        saDoCheckin('wifi');
        saTransition(STATE.WORKING_WIFI, 'Wi-Fi công ty bắt được trong 5p');
        break;
      }
      // Hết giờ chờ, vẫn không có Wi-Fi → check-in GPS (hoặc theo đồng hồ nếu GPS stale)
      if(now - _sa.wifiWaitStart >= saCheckinMs()){
        // P0 FIX: luôn check-in khi đã đủ giờ xác nhận — không quay về GOING_TO_WORK.
        // Nếu quay về, saStartCheckinConfirm → saTouchCheckinConfirm sẽ thấy gap > 15p → stale=true
        // → reset wifiWaitStart = now → đếm lại từ đầu → check-in không bao giờ xảy ra.
        // GPS stale sau khi app bị throttle background là bình thường, không phải user rời công ty.
        var _atGps = saIsAtWorkGps();
        saDoCheckin('gps');
        saTransition(STATE.WORKING_GPS_BACKUP,
          _atGps ? 'hết giờ chờ, GPS backup check-in'
                 : 'hết giờ chờ, GPS stale — check-in theo đồng hồ');
        break;
      }
      // P1 FIX: chỉ hủy countdown khi GPS FRESH và xác nhận ngoài vùng.
      // Nếu GPS stale (app bị throttle background) → giữ nguyên WAIT, không reset wifiWaitStart.
      if(saGpsFresh() && !saIsAtWorkGps()){
        saTransition(STATE.GOING_TO_WORK, 'GPS fresh - ra khỏi vùng khi đang chờ');
      }
      break;

    /* ─── WORKING_WIFI: Đang làm việc bằng Wi-Fi ─────────────── */
    case STATE.WORKING_WIFI:
      // Vẫn có Wi-Fi → không làm gì
      if(saIsAtWorkWifi()) break;
      // Mất Wi-Fi → bắt đầu đếm 5 phút
      _sa.wifiLostAt = now;
      saTransition(STATE.WORK_WIFI_LOST, 'mất Wi-Fi công ty');
      break;

    /* ─── WORKING_GPS_BACKUP: Làm việc bằng GPS ─────────────── */
    case STATE.WORKING_GPS_BACKUP:
      // Bắt được Wi-Fi công ty → chuyển sang WORKING_WIFI, tắt GPS
      if(saIsAtWorkWifi()){
        saTransition(STATE.WORKING_WIFI, 'bắt được Wi-Fi công ty');
        break;
      }
      // GPS vẫn trong vùng → tiếp tục
      if(saIsAtWorkGps()) break;
      if(!saIsOutsideWorkGps()) break;
      // GPS ra ngoài → có thể tan ca
      saTransition(STATE.POSSIBLE_CHECKOUT, 'GPS ra ngoài (đang backup)');
      break;

    /* ─── WORK_WIFI_LOST: Mất Wi-Fi > 5p, verify GPS ─────────── */
    case STATE.WORK_WIFI_LOST:
      // Wi-Fi quay lại → tiếp tục làm việc
      if(saIsAtWorkWifi()){
        saTransition(STATE.WORKING_WIFI, 'Wi-Fi công ty quay lại');
        break;
      }
      // Chưa đủ 5 phút → chờ
      if(now - _sa.wifiLostAt < saCheckoutMs()) break;

      // Đã 5 phút, bật GPS verify
      if(saIsAtWorkGps()){
        // GPS vẫn ở công ty → Wi-Fi lỗi, chuyển sang GPS backup
        saTransition(STATE.WORKING_GPS_BACKUP, 'Wi-Fi lỗi, GPS xác nhận vẫn ở công ty');
      } else {
        // GPS cũng ngoài → có thể đã tan ca
        saTransition(STATE.POSSIBLE_CHECKOUT, 'mất Wi-Fi 5p + GPS ngoài vùng');
      }
      break;

    /* ─── POSSIBLE_CHECKOUT: Có thể đã tan ca ─────────────────── */
    case STATE.POSSIBLE_CHECKOUT:
      // Quay lại công ty (Wi-Fi hoặc GPS)
      if(saIsAtWorkWifi()){
        saTransition(STATE.WORKING_WIFI, 'quay lại công ty (Wi-Fi)');
        break;
      }
      if(saIsAtWorkGps()){
        saTransition(STATE.WORKING_GPS_BACKUP, 'quay lại công ty (GPS)');
        break;
      }
      // Về nhà (Wi-Fi nhà) → checkout ngay
      if(saIsAtHomeWifi()){
        saDoCheckout('wifi_home');
        saTransition(STATE.CHECKED_OUT, 'về nhà (Wi-Fi nhà) → checkout ngay');
        break;
      }
      // Bắt đầu đếm 75 phút
      _sa.checkoutWaitStart = now;
      saTransition(STATE.CHECKOUT_WAIT_75_MIN, 'bắt đầu đếm 75 phút');
      break;

    /* ─── CHECKOUT_WAIT_75_MIN: Đang chờ 75 phút ────────────── */
    case STATE.CHECKOUT_WAIT_75_MIN:
      // Quay lại công ty → hủy checkout
      if(saIsAtWorkWifi()){
        saTransition(STATE.WORKING_WIFI, 'quay lại công ty trong 75p');
        break;
      }
      if(saIsAtWorkGps()){
        saTransition(STATE.WORKING_GPS_BACKUP, 'quay lại công ty (GPS) trong 75p');
        break;
      }
      // Về nhà → checkout ngay
      if(saIsAtHomeWifi()){
        saDoCheckout('wifi_home');
        saTransition(STATE.CHECKED_OUT, 'về nhà trong 75p → checkout ngay');
        break;
      }
      // Hết 75 phút → auto checkout
      if(now - _sa.checkoutWaitStart >= saCheckoutMs()){
        saDoCheckout('timeout');
        saTransition(STATE.CHECKED_OUT, 'hết 75 phút → auto checkout');
      }
      break;

    /* ─── CHECKED_OUT: Đã checkout ───────────────────────────── */
    case STATE.CHECKED_OUT:
      // Về nhà → reset sang HOME
      if(saIsAtHome()){
        saTransition(STATE.HOME, 'đã về nhà sau checkout');
      }
      break;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   10. UI — Cập nhật giao diện
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Cập nhật UI hiển thị trạng thái */
/* Optimized smart-attendance rules.
   Legacy state-machine code above is kept for reference; this block is the
   active implementation because it is declared later in the same scope. */
/**
 * QUY TẮC POLLING:
 *   ✦ Wi-Fi LUÔN poll (đảm bảo có 1 trong 2 tín hiệu — trừ trường hợp CHECKED_OUT)
 *   ✦ GPS TẮT khi đang kết nối Wi-Fi ĐÃ LƯU (nhà / công ty / việc phụ)
 *   ✦ GPS BẬT khi mất Wi-Fi HOẶC kết nối Wi-Fi LẠ (chưa lưu) — trong chu kỳ làm việc
 *   ✦ ĐẶC BIỆT: state CHECKED_OUT → TẮT GPS HOÀN TOÀN (kể cả không có Wi-Fi).
 *     Sau 8h, _saScheduleGpsWakeup tự reset về HOME → vòng làm việc mới.
 *   ✦ Chu kỳ GPS chọn theo state để tiết kiệm pin (di chuyển nhanh / trong ca chậm)
 *
 * Hàm này được gọi:
 *   1) Mỗi lần state đổi (saTransition)
 *   2) Mỗi lần trạng thái Wi-Fi-đã-lưu đổi (saWifiPoll phát hiện match/no-match)
 */
function saConfigurePolling(){
  if(_sa.nativeBrainFull){
    saStopGps();
    saStopWifiPoll();
    saMotionStop();
    return;
  }
  // Wi-Fi luôn chạy — là tín hiệu chính để biết khi nào cần bật/tắt GPS
  saStartWifiPoll();

  // Đã tan ca → tắt GPS tới mốc 7h45 sau checkout, rồi bật lại để chuẩn bị ca mới.
  if(_saPostCheckoutSleepMs(Date.now()) > 0 && !saHasOpenAttendance()){
    saStopGps();
    saMotionStop();
    return;
  }

  // Kết nối VÀO Wi-Fi đã lưu → tắt GPS (Wi-Fi đã đủ tin cậy để biết vị trí)
  // Wi-Fi lạ (vd quán cà phê) không được tính → vẫn cần GPS để biết đang ở đâu
  if(saIsConnectedToSavedWifi()){
    saStopGps();
    saMotionStop();
    return;
  }

  // Mất Wi-Fi → bật GPS làm tín hiệu thay thế. Chu kỳ theo state:
  var s = _sa.state;
  var interval;
  if(s === STATE.WAIT_CHECKIN_CONFIRM){
    interval = TIMING.GPS_POLL_NEAR_SHIFT_MS;   // 30s — đang xác nhận vào ca
  } else if(s === STATE.WORKING){
    interval = TIMING.GPS_POLL_BACKUP_MS;        // 2p — trong ca, dùng GPS backup
    saMotionStart();                              // bật motion detector khi đang làm
  } else if(s === STATE.WAIT_CHECKOUT_CONFIRM){
    interval = TIMING.GPS_POLL_TRAVEL_MS;        // 90s — đang xác nhận tan ca
    saMotionStop();
  } else if(s === STATE.HOME){
    interval = TIMING.GPS_HOME_CHECK_MS;         // 2p — ở nhà nhưng Wi-Fi tắt
    saMotionStop();
  } else {
    interval = TIMING.GPS_POLL_TRAVEL_MS;        // 90s — đang di chuyển
    saMotionStop();
  }
  saStartGps(interval);
}

function saWorkPresenceMethod(){
  if(saIsAtWorkWifi()) return 'wifi';
  if(saIsAtWorkGps()) return 'gps';
  return '';
}

function saCheckoutAwayMethod(){
  if(saIsAtHomeWifi()) return 'wifi_home';
  if(saIsAtHomeGps()) return 'gps_home';
  if(saIsOutsideWorkGps()) return 'gps';
  return '';
}

function saResetCheckinConfirm(){
  _sa.wifiWaitStart = 0;
  _sa.checkinConfirmMethod = '';
  _sa.checkinConfirmLastSeen = 0;
  _sa.checkinWindowStart = 0;
  _sa.checkinSignalOnMs = 0;
  _sa.checkinSignalOffMs = 0;
  _sa.checkinLastSignalState = false;
  _sa.checkinLastFlipAt = 0;
}

function saResetCheckoutConfirm(){
  _sa.checkoutWaitStart = 0;
  _sa.checkoutConfirmMethod = '';
  _sa.checkoutConfirmLastSeen = 0;
  _sa.checkoutWindowStart = 0;
  _sa.checkoutSignalOnMs = 0;
  _sa.checkoutSignalOffMs = 0;
  _sa.checkoutLastSignalState = true;
  _sa.checkoutLastFlipAt = 0;
}

function saTouchCheckinConfirm(method, now){
  var stale = _sa.checkinConfirmLastSeen && (now - _sa.checkinConfirmLastSeen > TIMING.CONFIRM_SIGNAL_GAP_MS);
  if(!_sa.wifiWaitStart || stale){
    _sa.wifiWaitStart = now;
    if(stale) saLog('CHECK_IN_WAIT_RESET', 'tin hieu vao ca gian doan, dem lai ' + Math.round(saCheckinMs()/60000) + 'p');
  }
  _sa.checkinConfirmMethod = method || '';
  _sa.checkinConfirmLastSeen = now;
}

function saTouchCheckoutConfirm(method, now){
  var stale = _sa.checkoutConfirmLastSeen && (now - _sa.checkoutConfirmLastSeen > TIMING.CONFIRM_SIGNAL_GAP_MS);
  if(!_sa.checkoutWaitStart || stale){
    _sa.checkoutWaitStart = now;
    if(stale) saLog('CHECK_OUT_WAIT_RESET', 'tin hieu ra ca gian doan, dem lai ' + Math.round(saCheckoutMs()/60000) + 'p');
  }
  _sa.checkoutConfirmMethod = method || '';
  _sa.checkoutConfirmLastSeen = now;
}

/** Mở cửa sổ check-in: đặt lại tất cả accumulator, chuyển sang WAIT_CHECKIN_CONFIRM */
function saOpenCheckinWindow(now, reason){
  if(saReconcileExistingCheckinState('chan mo check-in moi vi da co IN')) return;
  var checkinMinVal = (window._gpsData && _gpsData.checkinMin > 0) ? _gpsData.checkinMin : 20;
  _sa.checkinWindowStart     = now;
  _sa.checkinSignalOnMs      = 0;
  _sa.checkinSignalOffMs     = 0;
  _sa.checkinLastSignalState = true;  // tín hiệu có mặt khi bắt đầu cửa sổ
  _sa.checkinLastFlipAt      = now;
  saTransition(STATE.WAIT_CHECKIN_CONFIRM,
    reason || ('mo cua so check-in ' + checkinMinVal + 'p'));
  saForceNativeDeadlineSync('checkin');
}

/** Cập nhật accumulator check-in dựa trên tín hiệu hiện tại. Trả về {totalOnMs, totalOffMs} */
function saTickCheckinWindow(hasSignal, now){
  if(hasSignal !== _sa.checkinLastSignalState){
    var dt = now - _sa.checkinLastFlipAt;
    if(_sa.checkinLastSignalState) _sa.checkinSignalOnMs  += dt;
    else                            _sa.checkinSignalOffMs += dt;
    _sa.checkinLastSignalState = hasSignal;
    _sa.checkinLastFlipAt = now;
  }
  var pending = now - _sa.checkinLastFlipAt;
  return {
    totalOnMs:  _sa.checkinSignalOnMs  + (hasSignal ? pending : 0),
    totalOffMs: _sa.checkinSignalOffMs + (hasSignal ? 0 : pending)
  };
}

/** Mở cửa sổ tan ca: chuyển sang WAIT_CHECKOUT_CONFIRM */
function saOpenCheckoutWindow(now, reason){
  var checkoutMinVal = (window._gpsData && _gpsData.checkoutMin > 0) ? _gpsData.checkoutMin : 80;
  _sa.checkoutWindowStart     = now;
  _sa.checkoutSignalOnMs      = 0;
  _sa.checkoutSignalOffMs     = 0;
  _sa.checkoutLastSignalState = false;  // tín hiệu vừa mất khi bắt đầu cửa sổ
  _sa.checkoutLastFlipAt      = now;
  saTransition(STATE.WAIT_CHECKOUT_CONFIRM,
    reason || ('mo cua so checkout ' + checkoutMinVal + 'p'));
  saForceNativeDeadlineSync('checkout');
  _saScheduleNativeCheckoutAlarm(now);
}

/** Đặt AlarmManager alarm deadline checkout để Java fire ngay cả khi WebView bị kill */
function _saScheduleNativeCheckoutAlarm(windowStartMs){
  if(!window.ccNative || !window.ccNative.scheduleNotification) return;
  var deadlineMs = windowStartMs + saCheckoutMs();
  if(deadlineMs <= Date.now()) return;
  var L = _saL();
  var title = {vi:'🏁 Đã ra ca',en:'🏁 Clocked Out',ko:'🏁 퇴근',ja:'🏁 退勤',zh:'🏁 下班',
               my:'🏁 ထွက်',th:'🏁 ออกงาน',id:'🏁 Keluar',ph:'🏁 Time Out',
               ne:'🏁 बाहिरियो',hi:'🏁 बाहर'}[L]||'🏁 Đã ra ca';
  var body = {vi:'Chấm công ra ca tự động (timeout)',en:'Auto clocked out (timeout)'}[L]
             ||'Chấm công ra ca tự động (timeout)';
  // Gọi với positional args: (title, body, id, atDate, extra)
  window.ccNative.scheduleNotification(
    title, body, 9101, deadlineMs,
    { data: JSON.stringify({ windowStartMs: windowStartMs }) }
  ).catch(function(e){ console.warn('[SA] schedule checkout alarm failed:', e); });
  saLog('CHECKOUT_ALARM_SCHEDULED', 'deadline=' + new Date(deadlineMs).toLocaleTimeString());
}

/** Cập nhật accumulator tan ca. Trả về {totalOnMs, totalOffMs} */
function saTickCheckoutWindow(hasSignal, now){
  if(hasSignal !== _sa.checkoutLastSignalState){
    var dt2 = now - _sa.checkoutLastFlipAt;
    if(_sa.checkoutLastSignalState) _sa.checkoutSignalOnMs  += dt2;
    else                             _sa.checkoutSignalOffMs += dt2;
    _sa.checkoutLastSignalState = hasSignal;
    _sa.checkoutLastFlipAt = now;
  }
  var pending2 = now - _sa.checkoutLastFlipAt;
  return {
    totalOnMs:  _sa.checkoutSignalOnMs  + (hasSignal ? pending2 : 0),
    totalOffMs: _sa.checkoutSignalOffMs + (hasSignal ? 0 : pending2)
  };
}

/** Thời gian tín hiệu tối thiểu để check-in (15% checkinMs, ít nhất 20s) */
function saMinCheckinSignalMs(){
  return Math.max(20 * 1000, Math.floor(saCheckinMs() * 0.15));
}

function saEvaluate(){
  if(!_sa.enabled) return;
  saDailyReset();
  if(saResetStaleWorkState('evaluate khong co ca dang mo')){
    saConfigurePolling();
    saUpdateUI();
    return;
  }
  var s = _sa.state;
  var now = Date.now();

  switch(s){

    /* ─── HOME ─────────────────────────────────────────────────── */
    case STATE.HOME:
      // Phát hiện vùng công ty → mở cửa sổ check-in ngay
      var homeMethod = saWorkPresenceMethod();
      if(homeMethod){
        saOpenCheckinWindow(now, 'phat hien tin hieu cong ty tu HOME');
        break;
      }
      if(saIsAtHomeWifi()){
        if(_sa.gpsActive) saStopGps();
        break;
      }
      // Debounce 60s trước khi chuyển LEAVING_HOME (tránh Wi-Fi nhà rớt 1 nhịp)
      if(saConfirmedLeftHome(now)){
        saTransition(STATE.LEAVING_HOME, 'mat tin hieu nha (debounce 60s)');
        break;
      }
      if(saShouldRunHomeGpsCheck()){
        if(!_sa.gpsActive) saStartGps(TIMING.GPS_HOME_CHECK_MS);
        if(saIsAtWorkGps()){
          saOpenCheckinWindow(now, 'GPS vao vung cong ty tu HOME');
        }
      } else if(_sa.gpsActive){
        saStopGps();
      }
      break;

    /* ─── LEAVING_HOME ──────────────────────────────────────────── */
    case STATE.LEAVING_HOME:
      if(saIsAtHome()){
        _sa.homeSignalLostAt = 0;
        saTransition(STATE.HOME, 'quay lai nha');
        break;
      }
      var leavingMethod = saWorkPresenceMethod();
      if(leavingMethod){
        saOpenCheckinWindow(now, 'phat hien tin hieu cong ty khi roi nha');
        break;
      }
      saTransition(STATE.GOING_TO_WORK, 'bat GPS tim cong ty');
      break;

    /* ─── GOING_TO_WORK ─────────────────────────────────────────── */
    case STATE.GOING_TO_WORK:
      if(saIsAtHome()){
        saTransition(STATE.HOME, 'quay lai nha');
        break;
      }
      var goingMethod = saWorkPresenceMethod();
      if(goingMethod){
        saOpenCheckinWindow(now, 'phat hien tin hieu cong ty khi di lam');
      }
      break;

    /* ─── WAIT_CHECKIN_CONFIRM ──────────────────────────────────── */
    case STATE.WAIT_CHECKIN_CONFIRM:{
      var hasWorkSig = !!(saIsAtWorkWifi() || saIsAtWorkGps());
      var ciTick = saTickCheckinWindow(hasWorkSig, now);
      var ciElapsed = now - _sa.checkinWindowStart;
      var ciMinMs = saMinCheckinSignalMs();
      var ciCheckinMs = saCheckinMs();
      var ciMinVal = Math.round(ciCheckinMs / 60000);

      // Điều kiện check-in: cửa sổ đã đủ thời gian + on > off + đủ tín hiệu tối thiểu
      if(ciElapsed >= ciCheckinMs && ciTick.totalOnMs > ciTick.totalOffMs && ciTick.totalOnMs >= ciMinMs){
        var ciMethod = saIsAtWorkWifi() ? 'wifi' : 'gps';
        var didCheckin = saDoCheckin(ciMethod, _sa.checkinWindowStart || (now - ciCheckinMs));
        if(didCheckin === true || didCheckin === 'already_in'){
          saTransition(STATE.WORKING,
            didCheckin === 'already_in'
              ? 'da co IN, dong bo WORKING'
              : 'check-in: ' + Math.round(ciTick.totalOnMs/60000) + 'p on / ' + Math.round(ciTick.totalOffMs/60000) + 'p off');
        } else {
          saLog('CHECK_IN_WAIT_BLOCKED', 'du dieu kien tin hieu nhung bi chan boi cycle guard');
        }
        break;
      }
      // Hết cửa sổ nhưng tín hiệu không đủ → hủy, quay về GOING_TO_WORK
      if(ciElapsed >= ciCheckinMs && ciTick.totalOnMs < ciMinMs){
        saLog('CHECKIN_CANCEL', 'het cua so ' + ciMinVal + 'p, tin hieu khong du toi thieu');
        saTransition(STATE.GOING_TO_WORK, 'het cua so check-in, tin hieu qua it');
        break;
      }
      // Về nhà trong lúc chờ → hủy
      if(saIsAtHome()){
        saTransition(STATE.HOME, 'quay ve nha khi dang cho check-in');
        break;
      }
      // Đang trong cửa sổ → log và tiếp tục tích lũy
      saLog('WAIT_CHECKIN',
        Math.round(ciElapsed/1000) + 's/' + ciMinVal + 'p | on=' + Math.round(ciTick.totalOnMs/1000) + 's off=' + Math.round(ciTick.totalOffMs/1000) + 's');
      break;
    }

    /* ─── WORKING ────────────────────────────────────────────────── */
    case STATE.WORKING:{
      var hasWorkWhileWorking = !!(saIsAtWorkWifi() || saIsAtWorkGps());
      if(hasWorkWhileWorking){
        _sa.workSignalLostAt = 0;
        break;
      }
      if(!_sa.workSignalLostAt){
        _sa.workSignalLostAt = now;
        saSave();
        saLog('WORK_SIGNAL_LOST', 'bat dau debounce truoc khi mo checkout');
        break;
      }
      var workLostMs = now - _sa.workSignalLostAt;
      if(workLostMs < TIMING.WORK_SIGNAL_LOST_GRACE_MS){
        saLog('WORK_SIGNAL_LOST_WAIT',
          Math.round(workLostMs/1000) + 's/' + Math.round(TIMING.WORK_SIGNAL_LOST_GRACE_MS/1000) + 's');
        break;
      }
      // Về nhà cũng chỉ mở cửa sổ xác nhận sau debounce, không checkout ngay.
      if(saIsAtHomeWifi()){
        saOpenCheckoutWindow(_sa.workSignalLostAt, 've Wi-Fi nha, mo cua so checkout sau debounce');
        break;
      }
      // Mất tín hiệu đủ lâu → mở cửa sổ tan ca
      saOpenCheckoutWindow(_sa.workSignalLostAt, 'mat tin hieu cong ty du lau, mo cua so checkout');
      break;
    }

    /* ─── WAIT_CHECKOUT_CONFIRM ─────────────────────────────────── */
    case STATE.WAIT_CHECKOUT_CONFIRM:{
      var hasWorkSig2 = !!(saIsAtWorkWifi() || saIsAtWorkGps());
      var coTick = saTickCheckoutWindow(hasWorkSig2, now);
      var coElapsed = now - _sa.checkoutWindowStart;
      var coCheckoutMs = saCheckoutMs();
      var coCurrentOnMs = hasWorkSig2 ? Math.max(0, now - (_sa.checkoutLastFlipAt || now)) : 0;
      var coReturnStableMs = saCheckoutReturnStableMs();
      var coMinVal = Math.round(coCheckoutMs / 60000);

      // Tín hiệu công ty phải quay lại ổn định, không hủy checkout chỉ vì nhảy lại vài giây.
      if(hasWorkSig2 && coCurrentOnMs >= coReturnStableMs && coTick.totalOnMs > coTick.totalOffMs){
        saTransition(STATE.WORKING, 'tin hieu cong ty quay lai on dinh');
        break;
      }
      // Checkout dựa trên tổng thời gian mất tín hiệu, không chỉ thời gian cửa sổ đã mở.
      if(coTick.totalOffMs >= coCheckoutMs && coTick.totalOffMs > coTick.totalOnMs){
        var coMethod = saIsAtHomeWifi() ? 'wifi_home' : (saIsAtHomeGps() ? 'gps_home' : (saIsOutsideWorkGps() ? 'gps' : 'timeout'));
        saDoCheckout(coMethod, _sa.checkoutWindowStart || (now - coCheckoutMs));
        saTransition(STATE.CHECKED_OUT,
          'checkout: ' + Math.round(coTick.totalOffMs/60000) + 'p off / ' + Math.round(coTick.totalOnMs/60000) + 'p on');
        break;
      }
      // Đang trong cửa sổ → log và tiếp tục
      saLog('WAIT_CHECKOUT',
        Math.round(coElapsed/1000) + 's/' + coMinVal + 'p | off=' + Math.round(coTick.totalOffMs/1000) + 's on=' + Math.round(coTick.totalOnMs/1000) + 's currentOn=' + Math.round(coCurrentOnMs/1000) + 's');
      break;
    }

    /* ─── CHECKED_OUT ────────────────────────────────────────────── */
    case STATE.CHECKED_OUT:
      if(_saPostCheckoutSleepMs(now) <= 0){
        _saWakeForNextCycle('evaluate sau checkout');
      }
      break;
  }
}

function saEsc(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
  });
}

function saDebugBadge(text, ok){
  var bg = ok ? '#E8F7EF' : '#FFF0F0';
  var color = ok ? '#0D6E3F' : '#B42318';
  return '<span style="display:inline-block;padding:1px 5px;border-radius:6px;background:' + bg + ';color:' + color + ';font-weight:800">' + saEsc(text) + '</span>';
}

function saSignalAge(ts){
  var L = _saL();
  var noData = {vi:'chưa có',en:'no data',ko:'없음',ja:'なし',zh:'无',my:'မရှိ',th:'ไม่มี',id:'belum ada',ph:'wala pa',ne:'छैन',hi:'नहीं'}[L]||'chưa có';
  var secSfx = {vi:'s trước',en:'s ago',ko:'초 전',ja:'秒前',zh:'秒前',my:'s မတိုင်ခင်',th:'วินาทีที่แล้ว',id:'dtk lalu',ph:'sg nakaraang',ne:'s अघि',hi:'s पहले'}[L]||'s trước';
  var minSfx = {vi:'p trước',en:'m ago',ko:'분 전',ja:'分前',zh:'分前',my:'p မတိုင်ခင်',th:'นาทีที่แล้ว',id:'mnt lalu',ph:'m nakaraang',ne:'m अघि',hi:'m पहले'}[L]||'p trước';
  if(!ts) return noData;
  var sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if(sec < 60) return sec + secSfx;
  return Math.round(sec / 60) + minSfx;
}

function saGpsInsideText(){
  var L = _saL();
  var inside  = {vi:'trong vùng công ty',en:'inside work zone',ko:'회사 구역 내',ja:'会社エリア内',zh:'公司范围内',my:'ကုမ္ပဏီဇုန်အတွင်း',th:'ในพื้นที่บริษัท',id:'dalam zona kantor',ph:'loob ng zone ng trabaho',ne:'कम्पनी क्षेत्र भित्र',hi:'कंपनी क्षेत्र के अंदर'}[L]||'trong vùng công ty';
  var outside = {vi:'ngoài vùng công ty',en:'outside work zone',ko:'회사 구역 밖',ja:'会社エリア外',zh:'公司范围外',my:'ကုမ္ပဏီဇုန်ပြင်ပ',th:'นอกพื้นที่บริษัท',id:'luar zona kantor',ph:'labas ng zone ng trabaho',ne:'कम्पनी क्षेत्र बाहिर',hi:'कंपनी क्षेत्र के बाहर'}[L]||'ngoài vùng công ty';
  var unknown = {vi:'chưa rõ',en:'unknown',ko:'불명',ja:'不明',zh:'未知',my:'မသိ',th:'ไม่ทราบ',id:'belum jelas',ph:'hindi pa malinaw',ne:'अज्ञात',hi:'अज्ञात'}[L]||'chưa rõ';
  if(!saGpsFresh()) return '<span style="color:#687385">' + saEsc(unknown) + '</span>';
  if(_sa.signals.gpsInside === true)  return saDebugBadge(inside, true);
  if(_sa.signals.gpsInside === false) return saDebugBadge(outside, false);
  return '<span style="color:#687385">' + saEsc(unknown) + '</span>';
}

function saDecisionText(){
  var L = _saL();
  var T = {
    workWifi:  {vi:'Có Wi-Fi công ty: check-in/working bằng Wi-Fi, GPS tắt.',en:'Work Wi-Fi detected: check-in via Wi-Fi, GPS off.',ko:'회사 Wi-Fi 감지: Wi-Fi로 체크인, GPS 꺼짐.',ja:'会社Wi-Fi検出: Wi-Fiでチェックイン、GPSオフ。',zh:'检测到公司Wi-Fi：通过Wi-Fi签到，GPS关闭。',my:'ကုမ္ပဏီ Wi-Fi ရှိ: Wi-Fi ဖြင့် check-in, GPS ပိတ်။',th:'Wi-Fi บริษัทพบ: เช็กอินผ่าน Wi-Fi, GPS ปิด',id:'Wi-Fi kantor terdeteksi: check-in via Wi-Fi, GPS mati.',ph:'Wi-Fi trabaho nakita: check-in sa Wi-Fi, GPS off.',ne:'कम्पनी Wi-Fi भेटियो: Wi-Fi मार्फत check-in, GPS बन्द।',hi:'कंपनी Wi-Fi मिला: Wi-Fi से check-in, GPS बंद।'},
    homeWifi:  {vi:'Có Wi-Fi nhà: đang ở nhà, GPS tắt.',en:'Home Wi-Fi: at home, GPS off.',ko:'집 Wi-Fi: 집에 있음, GPS 꺼짐.',ja:'自宅Wi-Fi: 自宅にいます、GPSオフ。',zh:'家庭Wi-Fi：在家，GPS关闭。',my:'အိမ် Wi-Fi: အိမ်မှာ, GPS ပိတ်။',th:'Wi-Fi บ้าน: อยู่บ้าน, GPS ปิด',id:'Wi-Fi rumah: di rumah, GPS mati.',ph:'Wi-Fi bahay: nasa bahay, GPS off.',ne:'घर Wi-Fi: घरमा छौ, GPS बन्द।',hi:'घर Wi-Fi: घर पर, GPS बंद।'},
    leftHome:  {vi:'Wi-Fi báo đã rời nhà: bật GPS kiểm tra.',en:'Wi-Fi: left home, turning on GPS.',ko:'Wi-Fi: 집 떠남, GPS 켜짐.',ja:'Wi-Fi: 自宅を出た、GPS起動。',zh:'Wi-Fi：已离家，开启GPS。',my:'Wi-Fi: အိမ်ကထွက်ပြီ၊ GPS ဖွင့်မည်。',th:'Wi-Fi แจ้งออกจากบ้าน: เปิด GPS ตรวจสอบ',id:'Wi-Fi: keluar rumah, GPS dinyalakan.',ph:'Wi-Fi: lumabas sa bahay, GPS bubuksan.',ne:'Wi-Fi: घर छोड्यो, GPS सुरु गर्दै।',hi:'Wi-Fi: घर छोड़ा, GPS चालू हो रहा है।'},
    nearShift: {vi:'Ở nhà nhưng gần giờ ca: GPS bật nhẹ.',en:'At home, near shift time: light GPS on.',ko:'집에 있지만 교대 임박: GPS 경량 켜짐.',ja:'在宅だが交代時間が近い：GPS軽量起動。',zh:'在家但接近班次时间：轻GPS开启。',my:'အိမ်မှာ ဆင်းနီးနေ: GPS နည်းနည်းဖွင့်မည်。',th:'อยู่บ้านแต่ใกล้กะ: เปิด GPS เบาๆ',id:'Di rumah tapi hampir giliran: GPS ringan aktif.',ph:'Sa bahay pero malapit na shift: GPS maliit buksan.',ne:'घरमा तर सिफ्ट नजिक: हल्का GPS सुरु।',hi:'घर पर पर शिफ्ट नजदीक: हल्का GPS चालू।'},
    waitIn:    {vi:'Đang xác nhận vào ca: đủ 20 phút ở công ty mới check-in.',en:'Confirming check-in: need 20 min at workplace.',ko:'체크인 확인 중: 회사에서 20분 필요.',ja:'チェックイン確認中：職場に20分必要。',zh:'正在确认签到：需在公司20分钟。',my:'Check-in အတည်ပြုနေဆဲ: 20 မိနစ်လိုသည်。',th:'กำลังยืนยันเข้ากะ: ต้อง 20 นาทีที่บริษัท',id:'Konfirmasi check-in: butuh 20 menit di kantor.',ph:'Kinukumpirma ang check-in: kailangan 20 min sa trabaho.',ne:'Check-in पुष्टि गर्दै: कम्पनीमा 20 मिनेट चाहिन्छ।',hi:'Check-in पुष्टि: दफ्तर में 20 मिनट चाहिए।'},
    wifiLost:  {vi:'Mất Wi-Fi công ty: GPS đang xác nhận vị trí.',en:'Work Wi-Fi lost: GPS verifying location.',ko:'회사 Wi-Fi 손실: GPS 위치 확인 중.',ja:'会社Wi-Fi喪失：GPS位置確認中。',zh:'公司Wi-Fi断开：GPS正在验证位置。',my:'ကုမ္ပဏီ Wi-Fi ပျောက်: GPS တည်နေရာ စစ်ဆေးနေ。',th:'หาย Wi-Fi บริษัท: GPS กำลังยืนยันตำแหน่ง',id:'Wi-Fi kantor hilang: GPS memverifikasi lokasi.',ph:'Nawala Wi-Fi trabaho: GPS nag-verify ng lokasyon.',ne:'कम्पनी Wi-Fi गुम्यो: GPS स्थान प्रमाणित गर्दै।',hi:'कंपनी Wi-Fi खो गई: GPS स्थान सत्यापित कर रहा है।'},
    gpsBackup: {vi:'Không có Wi-Fi công ty: GPS nền nhẹ giữ trạng thái làm việc.',en:'No work Wi-Fi: light background GPS keeping work state.',ko:'회사 Wi-Fi 없음: GPS 백그라운드 근무 상태 유지.',ja:'会社Wi-Fiなし：バックグラウンドGPSで勤務状態維持。',zh:'无公司Wi-Fi：轻量GPS后台维持工作状态。',my:'ကုမ္ပဏီ Wi-Fi မရှိ: GPS နောက်ခံ အလုပ်အခြေအနေ ထိန်းနေ。',th:'ไม่มี Wi-Fi บริษัท: GPS เบื้องหลังรักษาสถานะทำงาน',id:'Tidak ada Wi-Fi kantor: GPS ringan latar belakang menjaga status kerja.',ph:'Walang Wi-Fi trabaho: GPS background nagpapanatili ng status.',ne:'कम्पनी Wi-Fi छैन: हल्का GPS ले काम अवस्था राख्दैछ।',hi:'कंपनी Wi-Fi नहीं: हल्के GPS से काम की स्थिति बनाए रखना।'},
    waitOut:   {vi:'Đang xác nhận ra ca: đủ 80 phút rời công ty mới checkout.',en:'Confirming checkout: need 80 min away from workplace.',ko:'체크아웃 확인 중: 회사에서 80분 필요.',ja:'チェックアウト確認中：職場離脱80分必要。',zh:'正在确认签出：需离开公司80分钟。',my:'Checkout အတည်ပြုနေ: 80 မိနစ်ထွက်ရမည်。',th:'กำลังยืนยันออกกะ: ต้อง 80 นาทีออกจากบริษัท',id:'Konfirmasi checkout: butuh 80 menit pergi dari kantor.',ph:'Kinukumpirma ang checkout: kailangan 80 min malayo sa trabaho.',ne:'Checkout पुष्टि गर्दै: कम्पनीबाट 80 मिनेट टाढा चाहिन्छ।',hi:'Checkout पुष्टि: दफ्तर से 80 मिनट दूर चाहिए।'},
    gpsOn:     {vi:'GPS đang bật để xác minh.',en:'GPS active for verification.',ko:'GPS 활성화 중.',ja:'GPS検証中。',zh:'GPS正在运行验证。',my:'GPS ဖွင့်ထား အတည်ပြုနေ。',th:'GPS เปิดอยู่เพื่อยืนยัน',id:'GPS aktif untuk verifikasi.',ph:'GPS aktibo para sa verification.',ne:'GPS प्रमाणिकरणका लागि सक्रिय।',hi:'GPS सत्यापन के लिए सक्रिय है।'},
    gpsOff:    {vi:'GPS đang tắt, chỉ theo dõi Wi-Fi.',en:'GPS off, monitoring Wi-Fi only.',ko:'GPS 꺼짐, Wi-Fi만 모니터링.',ja:'GPSオフ、Wi-Fiのみ監視。',zh:'GPS关闭，仅监控Wi-Fi。',my:'GPS ပိတ်, Wi-Fi သာ စောင့်ကြည့်။',th:'GPS ปิด ติดตามเฉพาะ Wi-Fi',id:'GPS mati, hanya memantau Wi-Fi.',ph:'GPS off, Wi-Fi lang ang monitored.',ne:'GPS बन्द, Wi-Fi मात्र निगरानी।',hi:'GPS बंद, केवल Wi-Fi निगरानी।'},
  };
  try {
    if(_sa.state === STATE.WAIT_CHECKIN_CONFIRM)  return T.waitIn[L]||T.waitIn.vi;
    if(_sa.state === STATE.WAIT_CHECKOUT_CONFIRM) return T.waitOut[L]||T.waitOut.vi;
    if(saIsAtWorkWifi()) return T.workWifi[L]||T.workWifi.vi;
    if(saIsAtHomeWifi()) return T.homeWifi[L]||T.homeWifi.vi;
    if(_sa.state === STATE.HOME && saHasLeftHome()) return T.leftHome[L]||T.leftHome.vi;
    if(_sa.state === STATE.HOME && saShouldRunHomeGpsCheck()) return T.nearShift[L]||T.nearShift.vi;
    if(_sa.state === STATE.WORKING && !saIsAtWorkWifi()) return T.gpsBackup[L]||T.gpsBackup.vi;
  } catch(e){}
  return _sa.gpsActive ? (T.gpsOn[L]||T.gpsOn.vi) : (T.gpsOff[L]||T.gpsOff.vi);
}

function saRenderDebugUI(){
  var el = document.getElementById('saSignalDebugBody');
  if(!el) return;

  var wifi = _sa.signals.wifi || {};
  var gps = _sa.signals.gps || {};
  var homeWifi = saIsAtHomeWifi();
  var workWifi = saIsAtWorkWifi();
  // Các biến BTS đã bỏ — không còn dùng BTS
  var L = _saL();
  var _noData  = {vi:'chưa có',en:'no data',ko:'없음',ja:'なし',zh:'无',my:'မရှိ',th:'ไม่มี',id:'belum ada',ph:'wala pa',ne:'छैन',hi:'नहीं'}[L]||'chưa có';
  var _noConn  = {vi:'chưa kết nối',en:'not connected',ko:'미연결',ja:'未接続',zh:'未连接',my:'မချိတ်ဆက်ရ',th:'ยังไม่เชื่อมต่อ',id:'belum terhubung',ph:'hindi pa nakakonekta',ne:'जडान भएको छैन',hi:'कनेक्ट नहीं'}[L]||'chưa kết nối';
  var _noName  = {vi:'không tên',en:'no name',ko:'이름없음',ja:'名前なし',zh:'无名称',my:'အမည်မရှိ',th:'ไม่มีชื่อ',id:'tanpa nama',ph:'walang pangalan',ne:'नाम छैन',hi:'नाम नहीं'}[L]||'không tên';
  var _homeW   = {vi:'nhà',en:'home',ko:'집',ja:'自宅',zh:'家',my:'အိမ်',th:'บ้าน',id:'rumah',ph:'bahay',ne:'घर',hi:'घर'}[L]||'nhà';
  var _workW   = {vi:'công ty',en:'work',ko:'회사',ja:'会社',zh:'公司',my:'ကုမ္ပဏီ',th:'บริษัท',id:'kantor',ph:'trabaho',ne:'कम्पनी',hi:'कंपनी'}[L]||'công ty';
  var _gpsZone = {vi:'GPS vùng công ty',en:'GPS work zone',ko:'GPS 회사 구역',ja:'GPS会社エリア',zh:'GPS公司区域',my:'GPS ကုမ္ပဏီဇုန်',th:'GPS พื้นที่บริษัท',id:'GPS zona kantor',ph:'GPS work zone',ne:'GPS कम्पनी क्षेत्र',hi:'GPS कंपनी क्षेत्र'}[L]||'GPS vùng công ty';
  var _decide  = {vi:'Quyết định',en:'Decision',ko:'판단',ja:'判断',zh:'决定',my:'ဆုံးဖြတ်',th:'การตัดสินใจ',id:'Keputusan',ph:'Desisyon',ne:'निर्णय',hi:'निर्णय'}[L]||'Quyết định';

  var gpsText = gps && gps.lat
    ? (Number(gps.lat).toFixed(5) + ',' + Number(gps.lng).toFixed(5) + ' ±' + Math.round(Number(gps.accuracy) || 0) + 'm')
    : _noData;
  var wifiText = wifi && wifi.connected
    ? (saEsc(wifi.ssid || '(' + _noName + ')') + (wifi.bssid ? ' / ' + saEsc(wifi.bssid) : ''))
    : _noConn;
  // Đã bỏ btsText / BTS rows trong debug — không còn dùng BTS

  el.innerHTML =
    '<div>State: <b>' + saEsc(_sa.state) + '</b> | Auto: ' + (_sa.enabled ? saDebugBadge('ON', true) : saDebugBadge('OFF', false)) + ' | GPS: ' + (_sa.gpsActive ? saDebugBadge('ON', true) : saDebugBadge('OFF', false)) + '</div>' +
    '<div>Poll: Wi-Fi ' + (_saTimers.wifi ? saDebugBadge('ON', true) : saDebugBadge('OFF', false)) + '</div>' +
    '<div>Wi-Fi: ' + wifiText + ' <span style="color:#687385">(' + saSignalAge(_sa.signals.ts && _sa.signals.ts.wifi) + ')</span></div>' +
    '<div>Wi-Fi match: ' + _homeW + '=' + (homeWifi ? saDebugBadge('YES', true) : saDebugBadge('NO', false)) + ' ' + _workW + '=' + (workWifi ? saDebugBadge('YES', true) : saDebugBadge('NO', false)) + '</div>' +
    '<div>GPS: ' + saEsc(gpsText) + ' <span style="color:#687385">(' + saSignalAge(_sa.signals.ts && _sa.signals.ts.gps) + ')</span></div>' +
    '<div>' + _gpsZone + ': ' + saGpsInsideText() + '</div>' +
    '<div style="margin-top:4px;color:#1F4F8F;white-space:normal">' + _decide + ': ' + saEsc(saDecisionText()) + '</div>';
}

// FIX P3 #6: throttle 800ms để chặn user spam click (log thấy 14 click trong 19s).
// Disable + fade button trong khi quét để user thấy feedback rõ ràng.
var _saRefreshBusy = false;
function saRefreshDebug(){
  if(_saRefreshBusy) return;
  _saRefreshBusy = true;
  var btn = document.getElementById('saSignalRefreshBtn');
  var prevOpacity = '';
  if(btn){
    btn.disabled = true;
    prevOpacity = btn.style.opacity;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'wait';
  }
  saWifiPoll();
  // saBtsPoll đã bỏ — không còn poll BTS
  if(_sa.gpsActive) saGpsPoll();
  else saUpdateUI();
  setTimeout(function(){
    _saRefreshBusy = false;
    if(btn){
      btn.disabled = false;
      btn.style.opacity = prevOpacity;
      btn.style.cursor = '';
    }
  }, 800);
}

function saUpdateUI(){
  var s = _sa.state;
  var statusEl = document.getElementById('saStatusText');
  var dotEl = document.getElementById('saStatusDot');
  if(!statusEl) return;

  var L = (window.userData && window.userData.lang) || 'vi';
  var text = '', color = '#ccc';

  var LABELS = {
    HOME:                 {vi:'🏠 Đang ở nhà',              en:'🏠 At home',                  ko:'🏠 집에 있음',             ja:'🏠 自宅',                zh:'🏠 在家',              my:'🏠 အိမ်မှာ',             th:'🏠 อยู่บ้าน',             id:'🏠 Di rumah',             ph:'🏠 Nasa bahay',           ne:'🏠 घरमा',                hi:'🏠 घर पर'},
    LEAVING_HOME:         {vi:'🚶 Đang rời nhà...',         en:'🚶 Leaving home...',           ko:'🚶 집에서 출발 중...',      ja:'🚶 外出中...',             zh:'🚶 离开家...',           my:'🚶 အိမ်မှ ထွက်...',       th:'🚶 ออกจากบ้าน...',         id:'🚶 Keluar rumah...',       ph:'🚶 Umaalis...',            ne:'🚶 घरबाट निस्कँदै...',    hi:'🚶 घर से निकल रहे...'},
    GOING_TO_WORK:        {vi:'🚗 Đang đi tới công ty...',  en:'🚗 Going to work...',          ko:'🚗 출근 중...',             ja:'🚗 出勤中...',             zh:'🚗 去上班...',           my:'🚗 အလုပ်သွား...',         th:'🚗 กำลังไปทำงาน...',       id:'🚗 Ke kantor...',          ph:'🚗 Papunta sa work...',    ne:'🚗 कार्यालय जाँदै...',     hi:'🚗 काम पर जा रहे...'},
    WAIT_CHECKIN_CONFIRM:  {vi:'⏳ Chờ xác nhận vào ca...', en:'⏳ Confirming check-in...', ko:'⏳ 출근 확인 중...', ja:'⏳ 出勤確認中...', zh:'⏳ 正在确认上班...', my:'⏳ အလုပျအဝင်က် အတည်နပᯀ...', th:'⏳ ยืนยันเข้างาน...', id:'⏳ Konfirmasi masuk...', ph:'⏳ Kinukumpirma ang pasok...', ne:'⏳ प्रवेश पुष्टि...', hi:'⏳ प्रवेश पुष्टि...'},
    WORKING:               {vi:'✅ Đang làm việc', en:'✅ Working', ko:'✅ 근무 중', ja:'✅ 勤務中', zh:'✅ 工作中', my:'✅ အလုပ်လုပ်နေ', th:'✅ ทำงานอยู่', id:'✅ Bekerja', ph:'✅ Nagta-trabaho', ne:'✅ काममा', hi:'✅ काम पर'},
    WAIT_CHECKOUT_CONFIRM: {vi:'⏱️ Chờ xác nhận ra ca...', en:'⏱️ Confirming check-out...', ko:'⏱️ 퇴근 확인 대기 중...', ja:'⏱️ 退勤確認待ち...', zh:'⏱️ 等待确认下班...', my:'⏱️ အတည်နပᯀ စောင်...', th:'⏱️ รอยืนยันเลิกงาน...', id:'⏱️ Menunggu konfirmasi...', ph:'⏱️ Naghihintay...', ne:'⏱️ पुष्टि पर्खँदै...', hi:'⏱️ पुष्टि की प्रतीक्षा...'},
    CHECKED_OUT:          {vi:'🏁 Đã ra ca',                en:'🏁 Checked out',               ko:'🏁 퇴근 완료',             ja:'🏁 退勤済み',              zh:'🏁 已下班',              my:'🏁 အလုပ်ပြန်ပြီ',        th:'🏁 ออกงานแล้ว',            id:'🏁 Sudah pulang',          ph:'🏁 Nag-check out na',    ne:'🏁 चेकआउट भयो',           hi:'🏁 चेक आउट हो गया'}
  };

  var COLORS = {
    HOME: '#9CA3AF', LEAVING_HOME: '#F5A623', GOING_TO_WORK: '#2D7DD2',
    WAIT_CHECKIN_CONFIRM: '#F5A623', WORKING: '#0D9E75',
    WAIT_CHECKOUT_CONFIRM: '#F5A623', CHECKED_OUT: '#9CA3AF'
  };

  var label = LABELS[s];
  text = label ? (label[L] || label.en || label.vi) : s;
  color = COLORS[s] || '#ccc';

  // Countdown: thời gian còn lại trong cửa sổ check-in / tan ca
  if(s === STATE.WAIT_CHECKIN_CONFIRM && _sa.checkinWindowStart){
    var elapsed2 = Date.now() - _sa.checkinWindowStart;
    var remain2 = Math.max(0, saCheckinMs() - elapsed2);
    var mins2 = Math.ceil(remain2 / 60000);
    text += ' (' + mins2 + 'p)';
  }
  if(s === STATE.WAIT_CHECKOUT_CONFIRM && _sa.checkoutWindowStart){
    var elapsed = Date.now() - _sa.checkoutWindowStart;
    var remain = Math.max(0, saCheckoutMs() - elapsed);
    var mins = Math.ceil(remain / 60000);
    text += ' (' + mins + 'p)';
  }

  statusEl.textContent = text;
  if(dotEl) dotEl.style.background = color;

  // Cập nhật GPS panel cũ nếu tồn tại
  var gpsTxt = document.getElementById('gpsStatusTxt');
  if(gpsTxt && _sa.enabled) gpsTxt.textContent = text;
  var gpsDot = document.getElementById('gpsStatusDot');
  if(gpsDot && _sa.enabled) gpsDot.style.background = color;
  var now = Date.now();
  if(now - _saPerf.lastDebugRenderAt >= TIMING.DEBUG_RENDER_MS){
    _saPerf.lastDebugRenderAt = now;
    saRenderDebugUI();
  }
  if(now - _saPerf.lastProfileRenderAt >= TIMING.PROFILE_RENDER_MS){
    _saPerf.lastProfileRenderAt = now;
    saRenderProfiles(false);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   11. LOGGING — Ghi log cho debug/audit
   ═══════════════════════════════════════════════════════════════════════════════ */

var _saTrail = [];
var SA_TRAIL_MAX = 200;

function saLog(type, msg){
  var entry = {
    t: Date.now(),
    type: type,
    state: _sa.state,
    msg: msg || ''
  };
  _saTrail.push(entry);
  if(_saTrail.length > SA_TRAIL_MAX) _saTrail.shift();
  console.log('[SA]', type, msg || '', '| state=' + _sa.state);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   12. PROFILE SETUP — Lưu hồ sơ nhà / công ty
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Bảng thông báo profile dùng chung cho tất cả hàm save/clear */
var _SA_BANNER = {
  noWifi:      {vi:'⚠️ Chưa kết nối Wi-Fi.',en:'⚠️ Not connected to Wi-Fi.',ko:'⚠️ Wi-Fi 미연결.',ja:'⚠️ Wi-Fi未接続。',zh:'⚠️ 未连接Wi-Fi。',my:'⚠️ Wi-Fi မချိတ်ဆက်ရ။',th:'⚠️ ยังไม่เชื่อมต่อ Wi-Fi',id:'⚠️ Belum terhubung Wi-Fi.',ph:'⚠️ Hindi nakakonekta sa Wi-Fi.',ne:'⚠️ Wi-Fi कनेक्ट छैन।',hi:'⚠️ Wi-Fi कनेक्ट नहीं।'},
  // Đã bỏ noBts / btsAmbigH / btsAmbigW — không còn dùng BTS
  noGps:       {vi:'⚠️ Không lấy được GPS.',en:'⚠️ Cannot get GPS.',ko:'⚠️ GPS 없음.',ja:'⚠️ GPS取得失敗。',zh:'⚠️ 无法获取GPS。',my:'⚠️ GPS မရ။',th:'⚠️ ไม่สามารถรับ GPS',id:'⚠️ Tidak bisa dapat GPS.',ph:'⚠️ Hindi makuha ang GPS.',ne:'⚠️ GPS लिन सकिएन।',hi:'⚠️ GPS नहीं मिला।'},
  wifiDupH:    {vi:'ℹ️ Wi-Fi đã có trong hồ sơ nhà.',en:'ℹ️ Wi-Fi already in home profile.',ko:'ℹ️ Wi-Fi 이미 집 프로필에 있음.',ja:'ℹ️ Wi-Fiは自宅プロファイルに既存。',zh:'ℹ️ Wi-Fi已在家庭配置中。',my:'ℹ️ Wi-Fi အိမ်ပရိုဖိုင်တွင် ရှိပြီး။',th:'ℹ️ Wi-Fi มีในโปรไฟล์บ้านแล้ว',id:'ℹ️ Wi-Fi sudah di profil rumah.',ph:'ℹ️ Nasa home profile na ang Wi-Fi.',ne:'ℹ️ Wi-Fi घर प्रोफाइलमा छ।',hi:'ℹ️ Wi-Fi घर प्रोफाइल में पहले से है।'},
  wifiDupW:    {vi:'ℹ️ Wi-Fi đã có trong hồ sơ công ty.',en:'ℹ️ Wi-Fi already in work profile.',ko:'ℹ️ Wi-Fi 이미 회사 프로필에 있음.',ja:'ℹ️ Wi-Fiは会社プロファイルに既存。',zh:'ℹ️ Wi-Fi已在公司配置中。',my:'ℹ️ Wi-Fi ကုမ္ပဏီပရိုဖိုင်တွင် ရှိပြီး။',th:'ℹ️ Wi-Fi มีในโปรไฟล์บริษัทแล้ว',id:'ℹ️ Wi-Fi sudah di profil kantor.',ph:'ℹ️ Nasa work profile na ang Wi-Fi.',ne:'ℹ️ Wi-Fi कम्पनी प्रोफाइलमा छ।',hi:'ℹ️ Wi-Fi कंपनी प्रोफाइल में पहले से है।'},
  // Đã bỏ btsDupH / btsDupW — không còn dùng BTS
  savedWifiH:  {vi:'✅ Đã lưu Wi-Fi nhà: ',en:'✅ Home Wi-Fi saved: ',ko:'✅ 집 Wi-Fi 저장: ',ja:'✅ 自宅Wi-Fi保存: ',zh:'✅ 家Wi-Fi已保存: ',my:'✅ အိမ် Wi-Fi သိမ်းပြီး: ',th:'✅ บันทึก Wi-Fi บ้าน: ',id:'✅ Wi-Fi rumah disimpan: ',ph:'✅ Na-save ang Wi-Fi bahay: ',ne:'✅ घर Wi-Fi सेभ: ',hi:'✅ घर Wi-Fi सहेजा: '},
  savedWifiW:  {vi:'✅ Đã lưu Wi-Fi công ty: ',en:'✅ Work Wi-Fi saved: ',ko:'✅ 회사 Wi-Fi 저장: ',ja:'✅ 会社Wi-Fi保存: ',zh:'✅ 公司Wi-Fi已保存: ',my:'✅ ကုမ္ပဏီ Wi-Fi သိမ်းပြီး: ',th:'✅ บันทึก Wi-Fi บริษัท: ',id:'✅ Wi-Fi kantor disimpan: ',ph:'✅ Na-save ang Wi-Fi trabaho: ',ne:'✅ कम्पनी Wi-Fi सेभ: ',hi:'✅ कंपनी Wi-Fi सहेजा: '},
  // Đã bỏ savedBtsH / savedBtsW — không còn dùng BTS
  savedGpsH:   {vi:'✅ Đã lưu GPS nhà',en:'✅ Home GPS saved',ko:'✅ 집 GPS 저장됨',ja:'✅ 自宅GPS保存済',zh:'✅ 家GPS已保存',my:'✅ အိမ် GPS သိမ်းပြီ',th:'✅ บันทึก GPS บ้านแล้ว',id:'✅ GPS rumah disimpan',ph:'✅ Na-save ang GPS bahay',ne:'✅ घर GPS सेभ भयो',hi:'✅ घर GPS सहेजा'},
  savedGpsW:   {vi:'✅ Đã lưu GPS công ty',en:'✅ Work GPS saved',ko:'✅ 회사 GPS 저장됨',ja:'✅ 会社GPS保存済',zh:'✅ 公司GPS已保存',my:'✅ ကုမ္ပဏီ GPS သိမ်းပြီ',th:'✅ บันทึก GPS บริษัทแล้ว',id:'✅ GPS kantor disimpan',ph:'✅ Na-save ang GPS trabaho',ne:'✅ कम्पनी GPS सेभ भयो',hi:'✅ कंपनी GPS सहेजा'},
  clearedH:    {vi:'🗑️ Đã xóa hồ sơ nhà',en:'🗑️ Home profile cleared',ko:'🗑️ 집 프로필 초기화됨',ja:'🗑️ 自宅プロファイルを削除しました',zh:'🗑️ 家庭配置已清除',my:'🗑️ အိမ်ပရိုဖိုင်ဖျက်ပြီ',th:'🗑️ ลบโปรไฟล์บ้านแล้ว',id:'🗑️ Profil rumah dihapus',ph:'🗑️ Na-clear ang home profile',ne:'🗑️ घर प्रोफाइल मेटाइयो',hi:'🗑️ घर प्रोफाइल साफ किया'},
  clearedW:    {vi:'🗑️ Đã xóa Wi-Fi công ty',en:'🗑️ Work Wi-Fi cleared',ko:'🗑️ 회사 Wi-Fi 초기화됨',ja:'🗑️ 会社Wi-Fiを削除しました',zh:'🗑️ 公司Wi-Fi已清除',my:'🗑️ ကုမ္ပဏီ Wi-Fi ဖျက်ပြီ',th:'🗑️ ลบ Wi-Fi บริษัทแล้ว',id:'🗑️ Wi-Fi kantor dihapus',ph:'🗑️ Na-clear ang work Wi-Fi',ne:'🗑️ कम्पनी Wi-Fi मेटाइयो',hi:'🗑️ कंपनी Wi-Fi साफ किया'},
  noWifiSub:   {vi:'❌ Không tìm thấy Wi-Fi',en:'❌ No Wi-Fi found',ko:'❌ Wi-Fi 없음',ja:'❌ Wi-Fiが見つかりません',zh:'❌ 找不到Wi-Fi',my:'❌ Wi-Fi မတွေ့',th:'❌ ไม่พบ Wi-Fi',id:'❌ Wi-Fi tidak ditemukan',ph:'❌ Walang Wi-Fi',ne:'❌ Wi-Fi भेटिएन',hi:'❌ Wi-Fi नहीं मिला'},
  wifiDupSub:  {vi:'ℹ️ Wi-Fi việc phụ đã có',en:'ℹ️ Sub-job Wi-Fi already saved',ko:'ℹ️ 부업 Wi-Fi 이미 저장됨',ja:'ℹ️ 副業Wi-Fiは既存',zh:'ℹ️ 副业Wi-Fi已存在',my:'ℹ️ Sub-job Wi-Fi ရှိပြီး',th:'ℹ️ Wi-Fi งานเสริมมีแล้ว',id:'ℹ️ Wi-Fi sub-job sudah ada',ph:'ℹ️ Naroon na ang Wi-Fi ng sub-job',ne:'ℹ️ Sub-job Wi-Fi छ',hi:'ℹ️ Sub-job Wi-Fi पहले से है'},
  savedWifiSub:{vi:'✅ Đã lưu Wi-Fi việc phụ: ',en:'✅ Sub-job Wi-Fi saved: ',ko:'✅ 부업 Wi-Fi 저장: ',ja:'✅ 副業Wi-Fi保存: ',zh:'✅ 副业Wi-Fi已保存: ',my:'✅ Sub-job Wi-Fi သိမ်းပြီး: ',th:'✅ บันทึก Wi-Fi งานเสริม: ',id:'✅ Wi-Fi sub-job disimpan: ',ph:'✅ Na-save ang Wi-Fi ng sub-job: ',ne:'✅ Sub-job Wi-Fi सेभ: ',hi:'✅ Sub-job Wi-Fi सहेजा: '},
  // Đã bỏ noBtsSub / btsDupSub / savedBtsSub — không còn dùng BTS
  noGpsSub:    {vi:'❌ Không có GPS',en:'❌ No GPS',ko:'❌ GPS 없음',ja:'❌ GPSなし',zh:'❌ 无GPS',my:'❌ GPS မရှိ',th:'❌ ไม่มี GPS',id:'❌ Tidak ada GPS',ph:'❌ Walang GPS',ne:'❌ GPS छैन',hi:'❌ GPS नहीं'},
  savedGpsSub: {vi:'✅ Đã lưu GPS việc phụ',en:'✅ Sub-job GPS saved',ko:'✅ 부업 GPS 저장됨',ja:'✅ 副業GPS保存済',zh:'✅ 副业GPS已保存',my:'✅ Sub-job GPS သိမ်းပြီ',th:'✅ บันทึก GPS งานเสริมแล้ว',id:'✅ GPS sub-job disimpan',ph:'✅ Na-save ang GPS ng sub-job',ne:'✅ Sub-job GPS सेभ भयो',hi:'✅ Sub-job GPS सहेजा'},
  clearedSub:  {vi:'🗑️ Đã xóa hồ sơ việc phụ',en:'🗑️ Sub-job profile cleared',ko:'🗑️ 부업 프로필 초기화됨',ja:'🗑️ 副業プロファイル削除',zh:'🗑️ 副业配置已清除',my:'🗑️ Sub-job ပရိုဖိုင်ဖျက်ပြီ',th:'🗑️ ลบโปรไฟล์งานเสริมแล้ว',id:'🗑️ Profil sub-job dihapus',ph:'🗑️ Na-clear ang sub-job profile',ne:'🗑️ Sub-job प्रोफाइल मेटाइयो',hi:'🗑️ Sub-job प्रोफाइल साफ किया'},
};
function _saB(key){ var L=_saL(); return (_SA_BANNER[key]||{})[L] || (_SA_BANNER[key]||{}).vi || ''; }

/**
 * Helper kiểm tra Wi-Fi đã có trong danh sách chưa.
 * STRICT BSSID-FIRST:
 *   - Nếu cả 2 đều có BSSID → so BSSID (lowercase). Khác BSSID = entry MỚI (cho phép lưu).
 *   - Nếu thiếu BSSID 1 bên → fallback so SSID (backward compat / OS che BSSID).
 * Cho phép nhiều router cùng SSID (mesh, multi-AP) lưu thành nhiều entry riêng.
 */
function _saWifiIsDuplicate(list, info){
  if(!list || !list.length || !info) return false;
  var curBssid = info.bssid ? String(info.bssid).toLowerCase() : '';
  for(var i = 0; i < list.length; i++){
    var p = list[i];
    var pBssid = p.bssid ? String(p.bssid).toLowerCase() : '';
    if(pBssid && curBssid){
      if(pBssid === curBssid) return true; // cùng router vật lý
      continue; // khác BSSID → không tính trùng dù SSID có thể giống
    }
    // Thiếu BSSID 1 bên → fallback SSID
    if(p.ssid && info.ssid && p.ssid === info.ssid) return true;
  }
  return false;
}

function _saWifiRemoveFromList(list, info){
  if(!list || !list.length || !info) return false;
  var curBssid = info.bssid ? String(info.bssid).toLowerCase() : '';
  var changed = false;
  for(var i = list.length - 1; i >= 0; i--){
    var p = list[i] || {};
    var pBssid = p.bssid ? String(p.bssid).toLowerCase() : '';
    var same = false;
    if(pBssid && curBssid) same = pBssid === curBssid;
    else same = !!(p.ssid && info.ssid && p.ssid === info.ssid);
    if(same){ list.splice(i, 1); changed = true; }
  }
  return changed;
}

function _saWifiRemoveFromOtherProfiles(target, info){
  if(target !== 'home') _saWifiRemoveFromList(_sa.home.wifi, info);
  if(target !== 'work') _saWifiRemoveFromList(_sa.work.wifi, info);
  if(_sa.subWork && target !== 'subWork') _saWifiRemoveFromList(_sa.subWork.wifi, info);
}

/** Lưu Wi-Fi hiện tại vào hồ sơ nhà (ưu tiên BSSID làm khoá duy nhất) */
function saSaveHomeWifi(){
  saGetWifi(function(info){
    if(!info || !info.connected || !info.ssid){
      showGpsBanner(_saB('noWifi'), '#E8433A');
      return;
    }
    if(_saWifiIsDuplicate(_sa.home.wifi, info)){
      showGpsBanner(_saB('wifiDupH'), '#2D7DD2');
      return;
    }
    _saWifiRemoveFromOtherProfiles('home', info);
    _sa.home.wifi.push({ssid: info.ssid, bssid: info.bssid || ''});
    saSave();
    saSyncNativeSmartState();
    saRenderHomeProfile();
    showGpsBanner(_saB('savedWifiH') + info.ssid, '#0D9E75');
  });
}

// (Đã bỏ saSaveHomeBts — không còn lưu BTS cho hồ sơ nhà)

/** Lưu GPS hiện tại vào hồ sơ nhà */
function saSaveHomeGps(){
  saGetGps(function(gps){
    if(!gps){
      showGpsBanner(_saB('noGps'), '#E8433A');
      return;
    }
    _sa.home.gps = {lat: gps.lat, lng: gps.lng, radius: 200};
    saSave();
    saSyncNativeSmartState();
    saRenderHomeProfile();
    showGpsBanner(_saB('savedGpsH'), '#0D9E75');
  });
}

/** Lưu Wi-Fi hiện tại vào hồ sơ công ty (ưu tiên BSSID làm khoá duy nhất) */
function saSaveWorkWifi(){
  saGetWifi(function(info){
    if(!info || !info.connected || !info.ssid){
      showGpsBanner(_saB('noWifi'), '#E8433A');
      return;
    }
    if(_saWifiIsDuplicate(_sa.work.wifi, info)){
      showGpsBanner(_saB('wifiDupW'), '#2D7DD2');
      return;
    }
    _saWifiRemoveFromOtherProfiles('work', info);
    _sa.work.wifi.push({ssid: info.ssid, bssid: info.bssid || ''});
    saSave();
    saSyncNativeSmartState();
    saRenderWorkProfile();
    showGpsBanner(_saB('savedWifiW') + info.ssid, '#0D9E75');
  });
}

// (Đã bỏ saSaveWorkBts — không còn lưu BTS cho hồ sơ công ty)

/** Lưu GPS hiện tại vào hồ sơ công ty */
function saSaveWorkGps(){
  saGetGps(function(gps){
    if(!gps){
      showGpsBanner(_saB('noGps'), '#E8433A');
      return;
    }
    _sa.work.gps = {lat:gps.lat, lng:gps.lng, radius:100};
    try{
      if(window._gpsData && typeof gpsPersistCompanyLocation === 'function'){
        gpsPersistCompanyLocation(gps.lat, gps.lng, 100, 'main');
      }
      if(window._gpsData){
        _gpsData.activeJob = 'main';
        _gpsData.lat = gps.lat;
        _gpsData.lng = gps.lng;
        _gpsData.radius = 100;
      }
    }catch(e){}
    saSave();
    saSyncNativeSmartState();
    saRenderWorkProfile();
    showGpsBanner(_saB('savedGpsW'), '#0D9E75');
  });
}

/** Xóa hồ sơ nhà */
function saClearHome(){
  _sa.home = {wifi:[], gps:null};
  saSave();
  saSyncNativeSmartState();
  saRenderHomeProfile();
  showGpsBanner(_saB('clearedH'), '#9CA3AF');
}

/** Xóa Wi-Fi công ty (giữ GPS) */
function saClearWorkSignals(){
  _sa.work.wifi = [];
  // _sa.work.bts đã bỏ — không còn dùng BTS
  saSave();
  saSyncNativeSmartState();
  saRenderWorkProfile();
  showGpsBanner(_saB('clearedW'), '#9CA3AF');
}

/* ── Hồ sơ việc phụ ── */

function saSaveSubWorkWifi(){
  saGetWifi(function(info){
    if(!info || !info.connected || !info.ssid){ showGpsBanner(_saB('noWifiSub'), '#E8433A'); return; }
    if(!_sa.subWork) _sa.subWork = {wifi:[], gps:null};
    if(_saWifiIsDuplicate(_sa.subWork.wifi, info)){
      showGpsBanner(_saB('wifiDupSub'), '#2D7DD2'); return;
    }
    _saWifiRemoveFromOtherProfiles('subWork', info);
    _sa.subWork.wifi.push({ssid:info.ssid, bssid:info.bssid||''});
    saSave(); saSyncNativeSmartState(); saRenderSubWorkProfile();
    showGpsBanner(_saB('savedWifiSub')+info.ssid, '#7B5EA7');
  });
}

// (Đã bỏ saSaveSubWorkBts — không còn lưu BTS cho việc phụ)

function saSaveSubWorkGps(){
  saGetGps(function(gps){
    if(!gps){ showGpsBanner(_saB('noGpsSub'), '#E8433A'); return; }
    if(!_sa.subWork) _sa.subWork = {wifi:[], gps:null};
    _sa.subWork.gps = {lat:gps.lat, lng:gps.lng, radius:100};
    saSave(); saSyncNativeSmartState(); saRenderSubWorkProfile();
    showGpsBanner(_saB('savedGpsSub'), '#7B5EA7');
  });
}

function saClearSubWorkSignals(){
  if(!_sa.subWork) _sa.subWork = {wifi:[], gps:null};
  _sa.subWork.wifi = []; _sa.subWork.gps = null;
  saSave(); saSyncNativeSmartState(); saRenderSubWorkProfile();
  showGpsBanner(_saB('clearedSub'), '#9CA3AF');
}

/* ═══════════════════════════════════════════════════════════════════════════════
   13. RENDER PROFILE UI — Hiển thị hồ sơ trong panel GPS
   ═══════════════════════════════════════════════════════════════════════════════ */

function saEscHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

/** Render phần hồ sơ nhà */
function saRenderHomeProfile(){
  var box = document.getElementById('saHomeProfile');
  if(!box) return;
  var L = _saL();
  var _notSaved  = {vi:'Chưa lưu',en:'Not saved',ko:'저장 안됨',ja:'未保存',zh:'未保存',my:'မသိမ်း',th:'ยังไม่บันทึก',id:'Belum disimpan',ph:'Hindi pa naka-save',ne:'सेभ भएको छैन',hi:'सहेजा नहीं'}[L]||'Chưa lưu';
  var _wifiHome  = {vi:'📶 Wi-Fi nhà',en:'📶 Home Wi-Fi',ko:'📶 집 Wi-Fi',ja:'📶 自宅Wi-Fi',zh:'📶 家庭Wi-Fi',my:'📶 အိမ် Wi-Fi',th:'📶 Wi-Fi บ้าน',id:'📶 Wi-Fi rumah',ph:'📶 Wi-Fi bahay',ne:'📶 घर Wi-Fi',hi:'📶 घर Wi-Fi'}[L]||'📶 Wi-Fi nhà';
  var _saveWifi  = {vi:'📶 Lưu Wi-Fi hiện tại',en:'📶 Save current Wi-Fi',ko:'📶 현재 Wi-Fi 저장',ja:'📶 現在のWi-Fiを保存',zh:'📶 保存当前Wi-Fi',my:'📶 လက်ရှိ Wi-Fi သိမ်း',th:'📶 บันทึก Wi-Fi ปัจจุบัน',id:'📶 Simpan Wi-Fi saat ini',ph:'📶 I-save ang Wi-Fi ngayon',ne:'📶 हालको Wi-Fi सेभ गर्नुस्',hi:'📶 वर्तमान Wi-Fi सहेजें'}[L]||'📶 Lưu Wi-Fi hiện tại';
  // Đã bỏ _btsHome / _saveBts — không còn BTS
  var _gpsHome   = {vi:'📍 GPS nhà (dự phòng)',en:'📍 Home GPS (backup)',ko:'📍 집 GPS (백업)',ja:'📍 自宅GPS（バックアップ）',zh:'📍 家庭GPS（备用）',my:'📍 အိမ် GPS (backup)',th:'📍 GPS บ้าน (สำรอง)',id:'📍 GPS rumah (cadangan)',ph:'📍 GPS bahay (backup)',ne:'📍 घर GPS (ब्याकअप)',hi:'📍 घर GPS (बैकअप)'}[L]||'📍 GPS nhà (dự phòng)';
  var _saveGps   = {vi:'📍 Lưu GPS nhà',en:'📍 Save home GPS',ko:'📍 집 GPS 저장',ja:'📍 自宅GPSを保存',zh:'📍 保存家庭GPS',my:'📍 အိမ် GPS သိမ်း',th:'📍 บันทึก GPS บ้าน',id:'📍 Simpan GPS rumah',ph:'📍 I-save ang GPS bahay',ne:'📍 घर GPS सेभ गर्नुस्',hi:'📍 घर GPS सहेजें'}[L]||'📍 Lưu GPS nhà';
  var _clearHome = {vi:'🗑️ Xóa hồ sơ nhà',en:'🗑️ Clear home profile',ko:'🗑️ 집 프로필 초기화',ja:'🗑️ 自宅プロファイルを削除',zh:'🗑️ 清除家庭配置',my:'🗑️ အိမ်ပရိုဖိုင်ဖျက်',th:'🗑️ ลบโปรไฟล์บ้าน',id:'🗑️ Hapus profil rumah',ph:'🗑️ Burahin ang profile ng bahay',ne:'🗑️ घर प्रोफाइल मेटाउनुस्',hi:'🗑️ घर प्रोफाइल हटाएं'}[L]||'🗑️ Xóa hồ sơ nhà';

  var html = '';
  html += '<div style="font-size:11px;font-weight:900;color:var(--text3);margin-bottom:6px">' + _wifiHome + '</div>';
  if(_sa.home.wifi.length === 0){
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">' + _notSaved + '</div>';
  } else {
    for(var i = 0; i < _sa.home.wifi.length; i++){
      var w = _sa.home.wifi[i];
      html += '<div style="font-size:12px;color:var(--text);margin-bottom:4px">• ' + saEscHtml(w.ssid) +
              ' <span onclick="_saRemoveHomeWifi('+i+')" style="color:#E8433A;cursor:pointer;font-size:11px">✕</span></div>';
    }
  }
  html += '<button onclick="saSaveHomeWifi()" style="margin:6px 0 12px;padding:8px 14px;border-radius:8px;border:1.5px solid var(--ac);background:white;color:var(--ac);font-size:11px;font-weight:800;font-family:Nunito,sans-serif">' + _saveWifi + '</button>';

  // Đã bỏ section BTS nhà — không còn dùng BTS

  html += '<div style="font-size:11px;font-weight:900;color:var(--text3);margin-bottom:6px">' + _gpsHome + '</div>';
  if(!_sa.home.gps){
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">' + _notSaved + '</div>';
  } else {
    html += '<div style="font-size:12px;color:var(--text);margin-bottom:8px">' +
            _sa.home.gps.lat.toFixed(5) + ', ' + _sa.home.gps.lng.toFixed(5) + '</div>';
  }
  html += '<button onclick="saSaveHomeGps()" style="margin:6px 0 8px;padding:8px 14px;border-radius:8px;border:1.5px solid var(--border);background:white;color:var(--text2);font-size:11px;font-weight:800;font-family:Nunito,sans-serif">' + _saveGps + '</button>';

  html += '<div style="margin-top:8px"><button onclick="saClearHome()" style="padding:6px 12px;border-radius:8px;border:1px solid #E8433A;background:white;color:#E8433A;font-size:11px;font-weight:800;font-family:Nunito,sans-serif">' + _clearHome + '</button></div>';

  box.innerHTML = html;
}

/** Render phần Wi-Fi công ty */
function saRenderWorkProfile(){
  var box = document.getElementById('saWorkProfile');
  if(!box) return;
  var L = _saL();
  var _notSaved  = {vi:'Chưa lưu',en:'Not saved',ko:'저장 안됨',ja:'未保存',zh:'未保存',my:'မသိမ်း',th:'ยังไม่บันทึก',id:'Belum disimpan',ph:'Hindi pa naka-save',ne:'सेभ भएको छैन',hi:'सहेजा नहीं'}[L]||'Chưa lưu';
  var _wifiWork  = {vi:'📶 Wi-Fi công ty',en:'📶 Work Wi-Fi',ko:'📶 회사 Wi-Fi',ja:'📶 会社Wi-Fi',zh:'📶 公司Wi-Fi',my:'📶 ကုမ္ပဏီ Wi-Fi',th:'📶 Wi-Fi บริษัท',id:'📶 Wi-Fi kantor',ph:'📶 Wi-Fi trabaho',ne:'📶 कम्पनी Wi-Fi',hi:'📶 कंपनी Wi-Fi'}[L]||'📶 Wi-Fi công ty';
  var _saveWifi  = {vi:'📶 Lưu Wi-Fi hiện tại',en:'📶 Save current Wi-Fi',ko:'📶 현재 Wi-Fi 저장',ja:'📶 現在のWi-Fiを保存',zh:'📶 保存当前Wi-Fi',my:'📶 လက်ရှိ Wi-Fi သိမ်း',th:'📶 บันทึก Wi-Fi ปัจจุบัน',id:'📶 Simpan Wi-Fi saat ini',ph:'📶 I-save ang Wi-Fi ngayon',ne:'📶 हालको Wi-Fi सेभ गर्नुस्',hi:'📶 वर्तमान Wi-Fi सहेजें'}[L]||'📶 Lưu Wi-Fi hiện tại';
  var _gpsWork   = {vi:'📍 GPS công ty',en:'📍 Work GPS',ko:'📍 회사 GPS',ja:'📍 会社GPS',zh:'📍 公司GPS',my:'📍 ကုမ္ပဏီ GPS',th:'📍 GPS บริษัท',id:'📍 GPS kantor',ph:'📍 GPS trabaho',ne:'📍 कम्पनी GPS',hi:'📍 कंपनी GPS'}[L]||'📍 GPS công ty';
  var _saveGps   = {vi:'📍 Lưu GPS công ty',en:'📍 Save work GPS',ko:'📍 회사 GPS 저장',ja:'📍 会社GPSを保存',zh:'📍 保存公司GPS',my:'📍 ကုမ္ပဏီ GPS သိမ်း',th:'📍 บันทึก GPS บริษัท',id:'📍 Simpan GPS kantor',ph:'📍 I-save ang GPS trabaho',ne:'📍 कम्पनी GPS सेभ गर्नुस्',hi:'📍 कंपनी GPS सहेजें'}[L]||'📍 Lưu GPS công ty';
  // Đã bỏ _btsWork / _saveBts — không còn BTS
  var _clearWork = {vi:'🗑️ Xóa Wi-Fi công ty',en:'🗑️ Clear work Wi-Fi',ko:'🗑️ 회사 Wi-Fi 초기화',ja:'🗑️ 会社Wi-Fiを削除',zh:'🗑️ 清除公司Wi-Fi',my:'🗑️ ကုမ္ပဏီ Wi-Fi ဖျက်',th:'🗑️ ลบ Wi-Fi บริษัท',id:'🗑️ Hapus Wi-Fi kantor',ph:'🗑️ Burahin ang Wi-Fi trabaho',ne:'🗑️ कम्पनी Wi-Fi मेटाउनुस्',hi:'🗑️ कंपनी Wi-Fi हटाएं'}[L]||'🗑️ Xóa Wi-Fi công ty';

  var html = '';
  html += '<div style="font-size:11px;font-weight:900;color:var(--text3);margin-bottom:6px">' + _wifiWork + '</div>';
  if(_sa.work.wifi.length === 0){
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">' + _notSaved + '</div>';
  } else {
    for(var i = 0; i < _sa.work.wifi.length; i++){
      var w = _sa.work.wifi[i];
      html += '<div style="font-size:12px;color:var(--text);margin-bottom:4px">• ' + saEscHtml(w.ssid) +
              ' <span onclick="_saRemoveWorkWifi('+i+')" style="color:#E8433A;cursor:pointer;font-size:11px">✕</span></div>';
    }
  }
  html += '<button onclick="saSaveWorkWifi()" style="margin:6px 0 12px;padding:8px 14px;border-radius:8px;border:1.5px solid var(--ac);background:white;color:var(--ac);font-size:11px;font-weight:800;font-family:Nunito,sans-serif">' + _saveWifi + '</button>';

  // Đã bỏ section BTS công ty — không còn dùng BTS

  html += '<div style="font-size:11px;font-weight:900;color:var(--text3);margin:8px 0 6px">' + _gpsWork + '</div>';
  if(!_sa.work.gps){
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:4px">' + _notSaved + '</div>';
  } else {
    html += '<div style="font-size:12px;color:var(--text);margin-bottom:4px">' +
            _sa.work.gps.lat.toFixed(5) + ', ' + _sa.work.gps.lng.toFixed(5) +
            ' <span onclick="saClearWorkGps&&saClearWorkGps()" style="color:#E8433A;cursor:pointer;font-size:11px">✕</span></div>';
  }
  html += '<button onclick="saSaveWorkGps()" style="margin:4px 0 8px;padding:8px 14px;border-radius:8px;border:1.5px solid var(--border);background:white;color:var(--text2);font-size:11px;font-weight:800;font-family:Nunito,sans-serif">' + _saveGps + '</button>';

  html += '<div style="margin-top:8px"><button onclick="saClearWorkSignals()" style="padding:6px 12px;border-radius:8px;border:1px solid #E8433A;background:white;color:#E8433A;font-size:11px;font-weight:800;font-family:Nunito,sans-serif">' + _clearWork + '</button></div>';

  box.innerHTML = html;
}

function saRenderSubWorkProfile(){
  var section = document.getElementById('saSubWorkSection');
  var box = document.getElementById('saSubWorkProfile');
  if(!box) return;
  var active = !!(window.userData && userData.subJob && userData.subJob.active);
  if(section) section.style.display = active ? 'block' : 'none';
  if(!active){ box.innerHTML = ''; return; }
  if(!_sa.subWork) _sa.subWork = {wifi:[], gps:null};
  var html = '';
  html += '<div style="font-size:11px;font-weight:900;color:#5a3e8e;margin-bottom:6px">📶 Wi-Fi việc phụ</div>';
  if(!_sa.subWork.wifi.length){
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Chưa lưu</div>';
  } else {
    for(var i=0; i<_sa.subWork.wifi.length; i++){
      var w=_sa.subWork.wifi[i];
      html += '<div style="font-size:12px;color:var(--text);margin-bottom:4px">• '+saEscHtml(w.ssid)+
              ' <span onclick="_saRemoveSubWorkWifi('+i+')" style="color:#E8433A;cursor:pointer;font-size:11px">✕</span></div>';
    }
  }
  html += '<button onclick="saSaveSubWorkWifi()" style="margin:6px 0 12px;padding:8px 14px;border-radius:8px;border:1.5px solid #7B5EA7;background:white;color:#7B5EA7;font-size:11px;font-weight:800;font-family:Nunito,sans-serif">📶 Lưu Wi-Fi việc phụ</button>';
  // Đã bỏ section BTS việc phụ — không còn dùng BTS
  html += '<div style="font-size:11px;font-weight:900;color:#5a3e8e;margin:8px 0 6px">📍 GPS việc phụ</div>';
  if(_sa.subWork.gps){
    html += '<div style="font-size:12px;color:var(--text);margin-bottom:4px">'+
            _sa.subWork.gps.lat.toFixed(5)+', '+_sa.subWork.gps.lng.toFixed(5)+
            ' <span onclick="saClearSubWorkGps&&saClearSubWorkGps()" style="color:#E8433A;cursor:pointer;font-size:11px">✕</span></div>';
  } else {
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:4px">Chưa lưu</div>';
  }
  html += '<button onclick="saSaveSubWorkGps()" style="margin:4px 0 8px;padding:8px 14px;border-radius:8px;border:1.5px solid var(--border);background:white;color:var(--text2);font-size:11px;font-weight:800;font-family:Nunito,sans-serif">📍 Lưu GPS việc phụ</button>';
  html += '<div style="margin-top:8px"><button onclick="saClearSubWorkSignals()" style="padding:6px 12px;border-radius:8px;border:1px solid #E8433A;background:white;color:#E8433A;font-size:11px;font-weight:800;font-family:Nunito,sans-serif">🗑️ Xóa hồ sơ việc phụ</button></div>';
  box.innerHTML = html;
}

/* ── Helpers xóa từng mục ── */
window._saRemoveHomeWifi = function(i){ _sa.home.wifi.splice(i,1); saSave(); saSyncNativeSmartState(); saRenderHomeProfile(); };
window._saRemoveWorkWifi = function(i){ _sa.work.wifi.splice(i,1); saSave(); saSyncNativeSmartState(); saRenderWorkProfile(); };
window._saRemoveSubWorkWifi = function(i){ if(_sa.subWork) _sa.subWork.wifi.splice(i,1); saSave(); saRenderSubWorkProfile(); };
window.saClearWorkGps      = function(){ _sa.work.gps=null; saSave(); saSyncNativeSmartState(); saRenderWorkProfile(); };
window.saClearSubWorkGps    = function(){ if(_sa.subWork) _sa.subWork.gps=null; saSave(); saRenderSubWorkProfile(); };
// Đã bỏ _saRemoveHomeBts / _saRemoveWorkBts / _saRemoveSubWorkBts — không còn BTS

var _saProfileRenderSig = '';
function saProfileRenderSignature(){
  try {
    return JSON.stringify({
      homeWifi: _sa.home.wifi || [],
      homeGps: _sa.home.gps || null,
      workWifi: _sa.work.wifi || [],
      workGps: _sa.work.gps || null,
      // homeBts/workBts/subWorkBts đã bỏ — không còn BTS
      subWorkWifi: (_sa.subWork && _sa.subWork.wifi) || [],
      subWorkGps:  (_sa.subWork && _sa.subWork.gps)  || null
    });
  } catch(e){
    return String(Date.now());
  }
}

function saRenderProfiles(force){
  var sig = saProfileRenderSignature();
  if(!force && sig === _saProfileRenderSig) return;
  _saProfileRenderSig = sig;
  saRenderHomeProfile();
  saRenderWorkProfile();
  saRenderSubWorkProfile();
}

function saSyncLegacyAutoSwitch(enabled){
  var on = !!enabled;
  try {
    if(window._gpsData){
      _gpsData.enabled = on;
      _gpsData.smartAttendanceMode = on;
      _gpsData.insideScheduleOut = false;
    }
    if(window.notifCfg) notifCfg.n3 = on;
    var gpsBtn = document.getElementById('togN3');
    if(gpsBtn) gpsBtn.classList.toggle('on', on);
    var saBtn = document.getElementById('togSA');
    if(saBtn) saBtn.classList.toggle('on', on);
    var card = document.getElementById('gpsSetupCard');
    if(card) card.style.display = on ? 'block' : 'none';
    if(typeof saveNotif === 'function') saveNotif();
    if(typeof saveGpsData === 'function') saveGpsData();
    if(!on && typeof stopGeofencing === 'function') stopGeofencing();
  } catch(e){
    console.warn('[SA] sync legacy switch failed:', e);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   14. ENABLE/DISABLE — Bật/tắt hệ thống
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Bật hệ thống chấm công thông minh */
function saSyncNativeSmartState(){
  try {
    if(window._gpsData){
      if(_sa.enabled) _gpsData.enabled = true;
      _gpsData.smartAttendanceMode = !!_sa.enabled;
      _gpsData.insideScheduleOut = false;
    }
    if(typeof saveGpsData === 'function'){
      saveGpsData();
    } else if(window.ccNative && window.ccNative.syncNativeGps) {
      window.ccNative.syncNativeGps(window._gpsData).catch(function(){});
    }
    saBrainSyncConfigMaybe('smart-state');
  } catch(e){
    console.warn('[SA] sync native smart state failed:', e);
  }
}

function saForceNativeDeadlineSync(label){
  function run(){
    try{
      if(window._gpsData){
        if(_sa.enabled) _gpsData.enabled = true;
        _gpsData.smartAttendanceMode = !!_sa.enabled;
        _gpsData.insideScheduleOut = false;
      }
      if(typeof gpsSyncNativeNow === 'function') gpsSyncNativeNow();
      else if(window.ccNative && window.ccNative.syncNativeGps) window.ccNative.syncNativeGps(window._gpsData).catch(function(){});
      saBrainSyncConfigMaybe('deadline-sync:' + (label || ''));
    } catch(e){
      console.warn('[SA] force native deadline sync failed:', label, e);
    }
  }
  try{
    if(typeof saveGpsData === 'function') saveGpsData();
    run();
    setTimeout(run, 800);
  } catch(e){
    console.warn('[SA] force native deadline sync failed:', label, e);
  }
}

/** Áp dụng checkout đã được Java ghi vào CapacitorStorage khi JS không chạy */
function _saApplyPendingNativeCheckout(){
  try {
    var raw = typeof lsGet === 'function' ? lsGet('cp22_sa_pending_checkout') : null;
    if(!raw || !raw.time || !raw.date) return;
    var date = raw.date, time = raw.time, method = raw.method || 'timeout';
    var data = saAttendanceData();
    var rec  = data[date];
    if(rec && rec.in && !rec.out){
      if(typeof attendanceSetOut === 'function'){
        attendanceSetOut(rec, date, time, new Date(date + 'T' + time).getTime());
      } else {
        rec.out = time;
      }
      rec.auto = true;
      rec.autoOutMethod = method + '_native';
      if(typeof saveAtt === 'function') saveAtt();
      if(typeof renderHomeStats === 'function') renderHomeStats();
      saLog('PENDING_CHECKOUT_APPLIED', date + ' ' + time + ' (' + method + ')');
      var _L2 = _saL();
      var _msg2 = {vi:'🏁 Đã ra ca lúc ',en:'🏁 Clocked out at ',ko:'🏁 퇴근 완료 ',
                   ja:'🏁 退勤 ',zh:'🏁 下班打卡 '}[_L2]||'🏁 Đã ra ca lúc ';
      if(typeof showGpsBanner === 'function') showGpsBanner(_msg2 + time + ' (auto)', '#F5A623');
      if(window.ccNative && window.ccNative.scheduleNotification){
        var _t2 = {vi:'🏁 Đã ra ca',en:'🏁 Clocked Out',ko:'🏁 퇴근',ja:'🏁 退勤',zh:'🏁 下班'}[_L2]||'🏁 Đã ra ca';
        var _b2 = {vi:'Chấm công ra ca lúc ',en:'Clocked out at '}[_L2]||'Chấm công ra ca lúc ';
        window.ccNative.scheduleNotification(_t2, _b2 + time + ' (timeout)', 2002, Date.now() + 2000).catch(function(){});
      }
    }
    if(typeof lsSet === 'function') lsSet('cp22_sa_pending_checkout', null);
  } catch(e){ console.warn('[SA] apply pending checkout failed:', e); }
}

/* Native AttendanceBrain (motion + alarm) integration */
var _saBrain = {
  started: false,
  starting: false,
  consumeBusy: false,
  lastSyncAt: 0
};

function saBrainIsNative(){
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function saBrainBridge(){
  return (window.ccNative && window.ccNative.brain) ? window.ccNative.brain : null;
}

function saUseNativeBrainFull(){
  return !!(saBrainIsNative() && saBrainBridge());
}

function saBrainHmFromMin(totalMin, fallback){
  var n = Number(totalMin);
  if(!Number.isFinite(n) || n < 0) n = fallback;
  var h = Math.floor(n / 60) % 24;
  var m = n % 60;
  return {hour:h, min:m};
}

function saBrainBuildConfig(){
  var shift = saCurrentShiftInfo();
  var workProfile = saGetWorkProfile() || {};
  var homeProfile = _sa.home || {};
  return {
    enabled: !!_sa.enabled,
    checkinMin: Math.max(1, Math.round(saCheckinMs() / 60000)),
    checkoutMin: Math.max(1, Math.round(saCheckoutMs() / 60000)),
    alarmBeforeMin: 10,
    shiftStart: saBrainHmFromMin(shift.inMin, 8 * 60),
    shiftEnd: saBrainHmFromMin(shift.outMin, 17 * 60),
    workWifiJson: JSON.stringify(workProfile.wifi || []),
    homeWifiJson: JSON.stringify(homeProfile.wifi || []),
    workGps: workProfile.gps ? {
      lat: Number(workProfile.gps.lat) || 0,
      lng: Number(workProfile.gps.lng) || 0,
      radius: Number(workProfile.gps.radius) || 100
    } : null,
    homeGps: homeProfile.gps ? {
      lat: Number(homeProfile.gps.lat) || 0,
      lng: Number(homeProfile.gps.lng) || 0,
      radius: Number(homeProfile.gps.radius) || 120
    } : null
  };
}

function saBrainSyncConfig(reason){
  var brain = saBrainBridge();
  if(!brain || typeof brain.syncConfig !== 'function') return Promise.resolve(false);
  var cfg = saBrainBuildConfig();
  return Promise.resolve(brain.syncConfig(cfg)).then(function(){
    _saBrain.lastSyncAt = Date.now();
    saLog('BRAIN_SYNC', reason || '');
    return true;
  }).catch(function(e){
    console.warn('[SA] brain sync config failed:', e);
    return false;
  });
}

function saBrainSyncConfigMaybe(reason){
  if(!_sa.enabled) return;
  if((Date.now() - (_saBrain.lastSyncAt || 0)) < 2000) return;
  saBrainSyncConfig(reason || 'auto');
}

function saBrainEventTime(detail){
  var raw = String(detail || '');
  var parts = raw.split('|');
  var hm = String(parts[0] || '');
  var m = hm.match(/^(\d{1,2}):(\d{2})$/);
  var method = String(parts[1] || 'native').trim() || 'native';
  var now = new Date();
  if(!m){
    return {ts: Date.now(), method: method};
  }
  var h = Number(m[1]), min = Number(m[2]);
  var t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, 0, 0).getTime();
  if(t > (Date.now() + 2 * 60 * 60 * 1000)) t -= 24 * 60 * 60 * 1000;
  return {ts: t, method: method};
}

function saBrainApplyPendingEvent(type, detail){
  var t = saBrainEventTime(detail);
  if(type === 'CHECKED_IN'){
    var inRes = saDoCheckin('brain_' + t.method, t.ts);
    if(inRes === true || inRes === 'already_in'){
      saReconcileExistingCheckinState('brain pending checked_in');
      saUpdateUI();
      return true;
    }
    return false;
  }
  if(type === 'CHECKED_OUT'){
    saDoCheckout('brain_' + t.method, t.ts);
    saNormalizePostCheckoutState('brain pending checked_out');
    saUpdateUI();
    return true;
  }
  if(type === 'CHECKOUT_REMIND'){
    if(typeof showGpsBanner === 'function'){
      showGpsBanner('⏰ Nhắc checkout: ca làm việc chưa được chốt.', '#F5A623');
    }
    return true;
  }
  return false;
}

function saMapBrainState(state){
  var s = String(state || '');
  if(s === 'HOME') return STATE.HOME;
  if(s === 'OUTSIDE') return STATE.GOING_TO_WORK;
  if(s === 'WAIT_CHECKIN_CONFIRM') return STATE.WAIT_CHECKIN_CONFIRM;
  if(s === 'WORKING') return STATE.WORKING;
  if(s === 'MAYBE_LEFT_WORK') return STATE.WAIT_CHECKOUT_CONFIRM;
  if(s === 'WAIT_CHECKOUT_CONFIRM') return STATE.WAIT_CHECKOUT_CONFIRM;
  if(s === 'CHECKED_OUT') return STATE.CHECKED_OUT;
  return _sa.state || STATE.HOME;
}

function saBrainPullState(reason){
  var brain = saBrainBridge();
  if(!brain || typeof brain.getState !== 'function') return;
  Promise.resolve(brain.getState()).then(function(st){
    if(!st) return;
    var mapped = saMapBrainState(st.state);
    if(mapped && mapped !== _sa.state){
      var old = _sa.state;
      _sa.state = mapped;
      _sa.stateChangedAt = Number(st.stateChangedAt) || Date.now();
      saLog('BRAIN_STATE', old + ' -> ' + mapped + ' (' + (reason || 'pull') + ')');
    }
    if(typeof st.todayCheckedIn === 'boolean') _sa.todayCheckedIn = !!st.todayCheckedIn;
    if(typeof st.todayCheckedOut === 'boolean') _sa.todayCheckedOut = !!st.todayCheckedOut;
    if(typeof st.enabled === 'boolean') _sa.enabled = !!st.enabled;
    saSave();
    saUpdateUI();
  }).catch(function(e){
    console.warn('[SA] brain getState failed:', e);
  });
}

function saBrainStartFullLoop(){
  if(_saTimers.brainStatus) clearInterval(_saTimers.brainStatus);
  _saTimers.brainStatus = setInterval(function(){
    saBrainPullState('interval');
    saBrainConsumePending('interval');
  }, 10000);
}

function saBrainStopFullLoop(){
  if(_saTimers.brainStatus){
    clearInterval(_saTimers.brainStatus);
    _saTimers.brainStatus = null;
  }
}

function saBrainConsumePending(reason){
  var brain = saBrainBridge();
  if(!brain || typeof brain.consumePendingEvent !== 'function') return;
  if(_saBrain.consumeBusy) return;
  _saBrain.consumeBusy = true;
  Promise.resolve(brain.consumePendingEvent()).then(function(res){
    if(res && res.hasEvent){
      saLog('BRAIN_PENDING', (reason || '') + ' ' + (res.type || '') + '|' + (res.detail || ''));
      saBrainApplyPendingEvent(String(res.type || ''), String(res.detail || ''));
    }
  }).catch(function(e){
    console.warn('[SA] consume pending brain event failed:', e);
  }).then(function(){
    _saBrain.consumeBusy = false;
  }, function(){
    _saBrain.consumeBusy = false;
  });
}

function saBrainRecover(reason){
  var brain = saBrainBridge();
  if(!brain) return;
  saBrainPullState((reason || 'recover') + ':state');
  if(typeof brain.runRecovery === 'function'){
    Promise.resolve(brain.runRecovery()).then(function(){
      saBrainConsumePending((reason || 'recover') + ':pending');
      saBrainPullState((reason || 'recover') + ':state-post');
    }).catch(function(e){
      console.warn('[SA] brain recovery failed:', e);
    });
  } else {
    saBrainConsumePending(reason || 'recover-noop');
  }
}

function saBrainStart(reason){
  if(!_sa.enabled || !saBrainIsNative()) return;
  var brain = saBrainBridge();
  if(!brain){
    setTimeout(function(){ saBrainStart((reason || 'start') + '+retry'); }, 1200);
    return;
  }
  if(_saBrain.starting) return;
  _saBrain.starting = true;
  saBrainSyncConfig(reason || 'start').then(function(){
    if(typeof brain.start !== 'function') return;
    return Promise.resolve(brain.start()).then(function(){
      _saBrain.started = true;
      saLog('MOTION_ON', reason || '');
      if(saUseNativeBrainFull()){
        _sa.nativeBrainFull = true;
        saStopGps();
        saStopWifiPoll();
        saBrainStartFullLoop();
      }
      saBrainRecover((reason || 'start') + ':recovery');
    });
  }).catch(function(e){
    console.warn('[SA] brain start failed:', e);
  }).then(function(){
    _saBrain.starting = false;
  }, function(){
    _saBrain.starting = false;
  });
}

function saBrainStop(reason){
  var brain = saBrainBridge();
  _sa.nativeBrainFull = false;
  saBrainStopFullLoop();
  if(!brain || typeof brain.stop !== 'function') return;
  Promise.resolve(brain.stop()).then(function(){
    _saBrain.started = false;
    saLog('MOTION_OFF', reason || '');
  }).catch(function(e){
    console.warn('[SA] brain stop failed:', e);
  });
}

function saBrainSyncFromManualAttendance(payload){
  if(!_sa.enabled || !saUseNativeBrainFull()) return;
  var p = payload || {};
  var dk = String(p.dateKey || '');
  if(dk && dk !== todayKey()){
    saBrainRecover('manual-non-today');
    return;
  }
  var brain = saBrainBridge();
  if(!brain || typeof brain.setState !== 'function') return;
  var nextState = null;
  var flags = {
    todayCheckedIn: !!_sa.todayCheckedIn,
    todayCheckedOut: !!_sa.todayCheckedOut
  };
  if(p.mainOut){
    nextState = 'CHECKED_OUT';
    flags.todayCheckedIn = true;
    flags.todayCheckedOut = true;
    _sa.todayCheckedIn = true;
    _sa.todayCheckedOut = true;
    _sa.state = STATE.CHECKED_OUT;
  } else if(p.mainIn){
    nextState = 'WORKING';
    flags.todayCheckedIn = true;
    flags.todayCheckedOut = false;
    _sa.todayCheckedIn = true;
    _sa.todayCheckedOut = false;
    _sa.state = STATE.WORKING;
  } else {
    return;
  }
  saSave();
  saUpdateUI();
  Promise.resolve(brain.setState(nextState, flags)).then(function(){
    saLog('BRAIN_SET_STATE', nextState + ' manual-sync');
    saBrainPullState('manual-sync');
  }).catch(function(e){
    console.warn('[SA] brain setState from manual failed:', e);
  });
}

function saEnable(){
  if(window.__SA_STARTED__) return;
  window.__SA_STARTED__ = true;
  saLoad();
  _saApplyPendingNativeCheckout();
  _saRestoreGpsWakeup();
  _sa.enabled = true;
  saSyncLegacyAutoSwitch(true);
  saSyncWorkGpsFromLegacy();
  saDailyReset();
  saNormalizePostCheckoutState('enable restore');
  saResetStaleWorkState('bat lai khi khong co ca dang mo');
  saReconcileExistingCheckinState('bat lai da co IN');
  saSave();
  saSyncNativeSmartState();
  saBrainStart('saEnable');
  if(saUseNativeBrainFull()){
    _sa.nativeBrainFull = true;
    saStopGps();
    saStopWifiPoll();
    saBrainStartFullLoop();
    saBrainRecover('saEnable-full');
  } else {
    saConfigurePolling();
    saEvaluate();
  }
  saUpdateUI();
  showGpsBanner({vi:'✅ Chấm công thông minh đã bật',en:'✅ Smart attendance enabled',ko:'✅ 스마트 출퇴근 켜짐',ja:'✅ スマート勤怠オン',zh:'✅ 智能考勤已开启',my:'✅ အလိုအလျောက် တက်မှတ်ချိန် ဖွင့်ပြီ',th:'✅ เปิดการเช็คอินอัจฉริยะแล้ว',id:'✅ Absensi cerdas aktif',ph:'✅ Smart attendance naka-on',ne:'✅ स्मार्ट हाजिरी सक्रिय',hi:'✅ स्मार्ट उपस्थिति चालू'}[_saL()]||'✅ Chấm công thông minh đã bật', '#0D9E75');
  saLog('ENABLED', '');
}

/** Tắt hệ thống */
function saDisable(){
  window.__SA_STARTED__ = false;
  _sa.enabled = false;
  saSyncLegacyAutoSwitch(false);
  saStopGps();
  saStopWifiPoll();
  saMotionStop();
  // saStopBtsPoll đã bỏ — không còn poll BTS
  saBrainStop('saDisable');
  saSave();
  saUpdateUI();
  showGpsBanner({vi:'⏸️ Chấm công thông minh đã tắt',en:'⏸️ Smart attendance disabled',ko:'⏸️ 스마트 출퇴근 꺼짐',ja:'⏸️ スマート勤怠オフ',zh:'⏸️ 智能考勤已关闭',my:'⏸️ အလိုအလျောက် တက်မှတ်ချိန် ပိတ်ပြီ',th:'⏸️ ปิดการเช็คอินอัจฉริยะแล้ว',id:'⏸️ Absensi cerdas nonaktif',ph:'⏸️ Smart attendance naka-off',ne:'⏸️ स्मार्ट हाजिरी बन्द',hi:'⏸️ स्मार्ट उपस्थिति बंद'}[_saL()]||'⏸️ Chấm công thông minh đã tắt', '#9CA3AF');
  saLog('DISABLED', '');
}

/** Toggle */
function saToggle(){
  if(_sa.enabled) saDisable(); else saEnable();
}

/** Reset trạng thái hàng ngày (gọi lúc 00:00 hoặc khi mở app ngày mới) */
function saDailyReset(){
  var today = todayKey();
  var lastKey = _sa.lastDailyKey || '';
  if(lastKey && typeof normalizeDateKey === 'function') lastKey = normalizeDateKey(lastKey);
  var lastDate = (!lastKey && _sa.stateChangedAt) ? new Date(_sa.stateChangedAt) : null;
  if(!lastKey && lastDate){
    lastKey = saDateKeyFromDate(lastDate);
  }
  if(!lastKey){
    _sa.lastDailyKey = today;
    saSyncAttendanceFlagsFromData();
    return;
  }
  if(lastKey !== today){
    var hasOpenAcrossDay = saHasOpenAttendance();
    _sa.lastDailyKey = today;
    _sa.todayCheckedIn = false;
    _sa.todayCheckedOut = false;
    _sa.todayCheckedInSub = false;
    _sa.todayCheckedOutSub = false;
    if(!hasOpenAcrossDay){
      saResetCheckinConfirm();
      saResetCheckoutConfirm();
    } else if(_sa.state === STATE.WAIT_CHECKIN_CONFIRM){
      saResetCheckinConfirm();
    }
    saSyncAttendanceFlagsFromData();
    if(_sa.state === STATE.CHECKED_OUT && _saPostCheckoutSleepMs(Date.now()) > 0){
      saSave();
      if(typeof saSyncNativeSmartState === 'function') saSyncNativeSmartState();
      saLog('DAY_RESET_SLEEP', lastKey + ' -> ' + today + ' (giu CHECKED_OUT toi wakeup)');
    } else if(_sa.state === STATE.CHECKED_OUT){
      saTransition(STATE.HOME, 'ngày mới — reset');
    } else {
      saSave();
      if(typeof saSyncNativeSmartState === 'function') saSyncNativeSmartState();
      saLog('DAY_RESET', lastKey + ' -> ' + today);
    }
    return;
  }
  saSyncAttendanceFlagsFromData();
}

/* ═══════════════════════════════════════════════════════════════════════════════
   14B. GPS AUTO CONTROL — Bridge tương thích do Smart Attendance sở hữu
   ═══════════════════════════════════════════════════════════════════════════════ */

function startGeofencing(){
  if(window._gpsData && window._gpsData.smartAttendanceMode && window._sa && window._sa.enabled) return;
  console.warn('[GPS] startGeofencing: chỉ hỗ trợ smartAttendanceMode. Bật Smart Attendance để dùng GPS.');
}

function stopGeofencing(options){
  if(typeof saStopGps === 'function') try{ saStopGps(); }catch(e){}
}

function startBackgroundGps(){
  try{
    if(window.ccNative && window.ccNative.syncNativeGps){
      window.ccNative.syncNativeGps(_gpsData).catch(function(){});
      _gpsBgWatchId = 'native';
      window._gpsBgWatchId = 'native';
      return true;
    }
  }catch(e){}
  return false;
}

function stopBackgroundGps(){
  _gpsBgWatchId = null;
  window._gpsBgWatchId = null;
  try{
    var plugin = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.ChamCongNative;
    if(plugin && plugin.stopNativeGps) plugin.stopNativeGps();
  }catch(e){}
}

function _processGpsPosition(pos){}

function _handleGpsError(err){
  _gpsErrorCount++;
  console.warn('[GPS Error]', err && (err.code || err.message) || err);
}

function setGpsBatteryProfile(profile){
  if(GPS_BATTERY_PROFILES[profile]) _gpsBatteryProfile = profile;
}

function gpsAutoCheckin(){
  if(typeof saDoCheckin === 'function'){ saDoCheckin('gps'); return; }
  console.warn('[GPS] gpsAutoCheckin: saDoCheckin chưa sẵn sàng');
}

function gpsAutoCheckout(){
  if(typeof saDoCheckout === 'function'){ saDoCheckout('gps'); return; }
  console.warn('[GPS] gpsAutoCheckout: saDoCheckout chưa sẵn sàng');
}

function _ensureGpsAutoRunningCore(reason){
  try{
    if(!_gpsData.enabled || !_gpsData.smartAttendanceMode){
      _gpsData.enabled = true;
      _gpsData.smartAttendanceMode = true;
      gpsSetAutoAttendanceUi(true);
      if(window.notifCfg){
        notifCfg.n3 = true;
        if(typeof saveNotif === 'function') saveNotif();
      }
      if(typeof saveGpsData === 'function') saveGpsData();
      console.log('[GPS] auto-start smart attendance:', reason || 'startup');
    }

    if(_gpsData.smartAttendanceMode){
      gpsSetAutoAttendanceUi(true);
      if(typeof window.saEnable === 'function'){
        if(!window._sa || !window._sa.enabled) window.saEnable();
        else if(typeof window.saUpdateUI === 'function') window.saUpdateUI();
      } else {
        setTimeout(function(){
          if(window._gpsData && window._gpsData.smartAttendanceMode && typeof window.saEnable === 'function'){
            window.saEnable();
          }
        }, 800);
      }
      if(typeof gpsSyncNativeNow === 'function') gpsSyncNativeNow();
      else if(window.ccNative && window.ccNative.syncNativeGps) window.ccNative.syncNativeGps(_gpsData).catch(function(){});
      // Quan trọng cho APK: ép NativeGpsService chạy nền ngay khi smart mode bật.
      if(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()){
        if(window.ccNative && typeof window.ccNative.startBg === 'function'){
          window.ccNative.startBg().then(function(res){
            if(res && res.started){
              _gpsBgWatchId = 'native';
              window._gpsBgWatchId = 'native';
            }
          }).catch(function(e){
            console.warn('[GPS] startBg failed:', e);
          });
        } else if(typeof window.startBackgroundGps === 'function'){
          window.startBackgroundGps();
        }
      }
      return true;
    }

    var loc = (typeof gpsResolveRunnableLocation === 'function') ? gpsResolveRunnableLocation() : null;
    if(!loc){
      if(typeof updateGpsStatus === 'function') updateGpsStatus();
      console.warn('[GPS] auto-start skipped: no saved location', reason || '');
      return false;
    }

    try{
      var btn = document.getElementById('togN3');
      if(btn) btn.classList.add('on');
      var card = document.getElementById('gpsSetupCard');
      if(card) card.style.display = 'block';
      if(window.notifCfg){
        notifCfg.n3 = true;
        if(typeof saveNotif === 'function') saveNotif();
      }
    }catch(e){}

    if(typeof gpsSyncNativeNow === 'function') gpsSyncNativeNow();
    else if(window.ccNative && window.ccNative.syncNativeGps) window.ccNative.syncNativeGps(_gpsData).catch(function(){});

    if(!_gpsInterval && typeof startGeofencing === 'function'){
      console.log('[GPS] auto-start geofence:', reason || 'ensure');
      startGeofencing();
    } else if(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()
      && _gpsBgWatchId !== 'native'
      && typeof window.startBackgroundGps === 'function'){
      window.startBackgroundGps();
    }

    if(typeof updateGpsStatus === 'function') updateGpsStatus();
    return true;
  }catch(e){
    console.warn('[GPS] _ensureGpsAutoRunningCore failed:', e);
    return false;
  }
}

function _gpsShowPermNeeded(reason){
  var banner = document.getElementById('gpsPermNeededBanner');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'gpsPermNeededBanner';
    banner.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);'
      + 'z-index:9998;width:calc(100% - 32px);max-width:360px;padding:14px 16px;'
      + 'border-radius:16px;background:#1A2332;color:white;font-size:13px;font-weight:800;'
      + 'font-family:Nunito,sans-serif;text-align:center;'
      + 'box-shadow:0 8px 32px rgba(0,0,0,.35)';
    document.body.appendChild(banner);
  }
  banner.innerHTML = '📍 Cần quyền vị trí để chấm công GPS tự động'
    + '<br><button onclick="openNativePermissionSetting(\'location\')"'
    + ' style="margin-top:10px;padding:8px 20px;border:0;border-radius:10px;'
    + 'background:#0D9E75;color:white;font-size:13px;font-weight:800;'
    + 'cursor:pointer;font-family:Nunito,sans-serif">Cấp quyền ngay</button>';
  banner.style.display = 'block';
  console.log('[GPS] permission needed, reason:', reason);
}

function _gpsHidePermNeeded(){
  var banner = document.getElementById('gpsPermNeededBanner');
  if(banner) banner.style.display = 'none';
}

function ensureGpsAutoRunning(reason){
  try{
    if(typeof loadGpsData === 'function') loadGpsData();
    if(!_gpsData) return false;
    if(window.__gpsManualOffThisSession) return false;

    var isCapNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if(isCapNative){
      if(!window.ccNative) return false;
      if(!window.ccNative.plugins || !window.ccNative.plugins.CN){
        _gpsShowPermNeeded('plugin-not-ready');
        return false;
      }
      window.ccNative.checkLocationPermission().then(function(perm){
        var granted = !!(perm && (perm.location === 'granted'
          || perm.fineLocation === 'granted'
          || perm.coarseLocation === 'granted'));
        if(granted){
          _gpsHidePermNeeded();
          _ensureGpsAutoRunningCore(reason);
        } else {
          _gpsShowPermNeeded('denied');
        }
      }).catch(function(){
        _ensureGpsAutoRunningCore(reason);
      });
      return true;
    }

    _ensureGpsAutoRunningCore(reason);
    return true;
  }catch(e){
    console.warn('[GPS] ensureGpsAutoRunning failed:', e);
    return false;
  }
}

function scheduleGpsAutoStart(reason){
  [0, 700, 2000, 5000].forEach(function(delay){
    setTimeout(function(){ ensureGpsAutoRunning((reason || 'auto') + '+' + delay); }, delay);
  });
}

function gpsSetAutoAttendanceUi(enabled){
  var on = !!enabled;
  var gpsBtn = document.getElementById('togN3');
  if(gpsBtn) gpsBtn.classList.toggle('on', on);
  var saBtn = document.getElementById('togSA');
  if(saBtn) saBtn.classList.toggle('on', on);
  var card = document.getElementById('gpsSetupCard');
  if(card) card.style.display = on ? 'block' : 'none';
  if(window.notifCfg) notifCfg.n3 = on;
}

function gpsSetSmartAutoAttendance(enabled, reason){
  var on = !!enabled;
  window.__gpsManualOffThisSession = !on;
  if(typeof loadGpsData === 'function') loadGpsData();
  _gpsData.enabled = on;
  _gpsData.smartAttendanceMode = on;
  gpsSetAutoAttendanceUi(on);

  if(on){
    if(typeof window.saEnable === 'function'){
      window.saEnable();
    } else {
      setTimeout(function(){
        if(window._gpsData && window._gpsData.smartAttendanceMode && typeof window.saEnable === 'function'){
          window.saEnable();
        }
      }, 800);
    }
    setTimeout(function(){ ensureGpsAutoRunning(reason || 'toggle-on'); }, 120);
  } else {
    if(typeof window.saDisable === 'function') window.saDisable();
    if(typeof stopGeofencing === 'function') stopGeofencing();
  }

  if(typeof saveNotif === 'function') saveNotif();
  if(typeof saveGpsData === 'function') saveGpsData();
  if(typeof updateGpsStatus === 'function') updateGpsStatus();
  if(typeof _addGpsTrail === 'function') _addGpsTrail({type:'SMART_AUTO_TOGGLE', enabled:on, reason:reason || 'toggle'});
  return true;
}

function installGpsResumeHooks(){
  if(window.__gpsAutoStartHooksInstalled) return;
  window.__gpsAutoStartHooksInstalled = true;
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ scheduleGpsAutoStart('dom-ready'); });
  } else {
    scheduleGpsAutoStart('dom-ready');
  }
  window.addEventListener('focus', function(){
    setTimeout(function(){ ensureGpsAutoRunning('window-focus'); }, 250);
    setTimeout(function(){ saBrainRecover('window-focus'); }, 400);
  });
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden){
      setTimeout(function(){ ensureGpsAutoRunning('visible'); }, 250);
      setTimeout(function(){ saBrainRecover('visible'); }, 400);
    }
  });
}

function installCapacitorGpsResumeHook(){
  if(window.__gpsCapacitorResumeHookInstalled) return;
  var App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if(!App || !App.addListener) return;
  window.__gpsCapacitorResumeHookInstalled = true;
  try{
    App.addListener('appStateChange', function(state){
      if(state && state.isActive){
        setTimeout(function(){ ensureGpsAutoRunning('appState-active'); }, 250);
        setTimeout(function(){ saBrainRecover('appState-active'); }, 400);
      }
    });
  }catch(e){}
}

function installGpsV3Bridge(){
  window.gpsV3 = {
    setActiveJob       : typeof setActiveGpsJob === 'function' ? setActiveGpsJob : function(){},
    getActiveLocation  : typeof getActiveGpsLocation === 'function' ? getActiveGpsLocation : function(){ return null; },
    saveLocationForJob : typeof saveGpsLocationForJob === 'function' ? saveGpsLocationForJob : function(){},
    setBatteryProfile  : setGpsBatteryProfile,
    getTrail           : function(){ return _gpsTrail.slice(); },
    isInsidePolygon    : typeof isInsidePolygon === 'function' ? isInsidePolygon : function(){ return false; },
    startBackground    : startBackgroundGps,
    stopBackground     : stopBackgroundGps,
    restart            : function(){
      if(typeof saStopGps === 'function') try{ saStopGps(); }catch(e){}
      if(typeof saEnable === 'function') setTimeout(function(){ saEnable(); }, 300);
    },
    getStats           : function(){
      return { enabled: _gpsData && _gpsData.enabled, smartMode: true, batteryProfile: _gpsBatteryProfile };
    }
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   15. INIT — Khởi tạo
   ═══════════════════════════════════════════════════════════════════════════════ */

function saInit(){
  if(window.__SA_INITIALIZED__ || window.__SA_BOOTING__) return;
  window.__SA_BOOTING__ = true;
  saLoad();
  saSyncWorkGpsFromLegacy();
  saDailyReset();
  _saRestoreGpsWakeup();
  saNormalizePostCheckoutState('init restore');
  saResetStaleWorkState('khoi dong khi khong co ca dang mo');
  saReconcileExistingCheckinState('khoi dong da co IN');
  saRenderProfiles(true);

  if(_sa.enabled){
    saSyncLegacyAutoSwitch(true);
    if(saUseNativeBrainFull()){
      _sa.nativeBrainFull = true;
      saStopGps();
      saStopWifiPoll();
      saBrainStart('saInit-full');
      saBrainStartFullLoop();
      saBrainRecover('saInit-full');
    } else {
    // Kiểm tra quyền GPS trước khi khôi phục polling
    var _saInitIsCapNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if(_saInitIsCapNative && window.ccNative && window.ccNative.checkLocationPermission){
      // ccNative đã sẵn sàng → check quyền async
      window.ccNative.checkLocationPermission().then(function(perm){
        var granted = !!(perm && (perm.location === 'granted'
          || perm.fineLocation === 'granted'
          || perm.coarseLocation === 'granted'));
        if(granted){
          saConfigurePolling();
          setTimeout(function(){ saEvaluate(); saUpdateUI(); }, 2000);
        }
        // Nếu denied → không start, ensureGpsAutoRunning('ccNative-ready') sẽ xử lý
      }).catch(function(){
        saConfigurePolling();
        setTimeout(function(){ saEvaluate(); saUpdateUI(); }, 2000);
      });
    } else if(!_saInitIsCapNative){
      // Browser/non-native → chạy thẳng
      saConfigurePolling();
      setTimeout(function(){ saEvaluate(); saUpdateUI(); }, 2000);
    }
    // _saInitIsCapNative && !window.ccNative → ccNative chưa sẵn sàng,
    // ensureGpsAutoRunning('ccNative-ready') từ capacitor-integration.js sẽ xử lý
    saBrainStart('saInit-enabled');
    }
  }

  window.__SA_INITIALIZED__ = true;
  window.__SA_BOOTING__ = false;
  saLog('INIT', 'state=' + _sa.state + ' enabled=' + _sa.enabled);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   16. EXPOSE GLOBAL — Cho HTML/UI truy cập
   ═══════════════════════════════════════════════════════════════════════════════ */

// State machine data (read-only access)
window._sa = _sa;
window._saTrail = _saTrail;

// Profile setup
window.saSaveHomeWifi = saSaveHomeWifi;
window.saSaveHomeGps = saSaveHomeGps;
window.saSaveWorkWifi = saSaveWorkWifi;
window.saSaveWorkGps = saSaveWorkGps;
window.saClearHome = saClearHome;
window.saClearWorkSignals = saClearWorkSignals;
window.saSaveSubWorkWifi = saSaveSubWorkWifi;
window.saSaveSubWorkGps = saSaveSubWorkGps;
window.saClearSubWorkSignals = saClearSubWorkSignals;
// Đã bỏ saSaveHomeBts / saSaveWorkBts / saSaveSubWorkBts — không còn BTS

// Control
window.saEnable = saEnable;
window.saDisable = saDisable;
window.saToggle = saToggle;
window.saBrainSyncFromManualAttendance = saBrainSyncFromManualAttendance;

// Render
window.saRenderHomeProfile = saRenderHomeProfile;
window.saRenderWorkProfile = saRenderWorkProfile;
window.saRenderSubWorkProfile = saRenderSubWorkProfile;
window.saUpdateUI = saUpdateUI;
window.saEvaluate = saEvaluate;
window.saRefreshDebug = saRefreshDebug;

// GPS auto-control bridge
installGpsV3Bridge();
window.startBackgroundGps = startBackgroundGps;
window.stopBackgroundGps = stopBackgroundGps;
window.gpsAutoCheckin = gpsAutoCheckin;
window.gpsAutoCheckout = gpsAutoCheckout;
window.gpsCurrentPosition = typeof gpsCurrentPosition === 'function' ? gpsCurrentPosition : window.gpsCurrentPosition;
window._processGpsPosition = _processGpsPosition;
window._handleGpsError = _handleGpsError;
window.startGeofencing = startGeofencing;
window.stopGeofencing = stopGeofencing;
window.ensureGpsAutoRunning = ensureGpsAutoRunning;
window.gpsScheduleAutoStart = scheduleGpsAutoStart;
window.gpsSetSmartAutoAttendance = gpsSetSmartAutoAttendance;
window.GPS_BATTERY_PROFILES = GPS_BATTERY_PROFILES;

// Constants
window.SA_STATE = STATE;

installGpsResumeHooks();
installCapacitorGpsResumeHook();
setTimeout(installCapacitorGpsResumeHook, 2000);

/* ═══════════════════════════════════════════════════════════════════════
   MOTION DETECTOR — DeviceMotion API
   Chạy khi state=WORKING + không có Wi-Fi công ty.
   Khi phát hiện di chuyển → gọi saGpsPoll() ngay, không đợi timer 2p.
   Hoạt động trong Android WebView, không cần native plugin.
   ═══════════════════════════════════════════════════════════════════════ */
var _saMotion = {
  active:        false,
  handler:       null,
  lastTriggerAt: 0,
  samples:       [],
  WINDOW_MS:     2000,   // cửa sổ trượt 2 giây
  MIN_SAMPLES:   15,     // cần ít nhất 15 mẫu (~0.25s ở 60Hz) mới tính
  THRESHOLD_LIN: 1.2,    // m/s² mean khi dùng acceleration (không gravity) → đang đi
  THRESHOLD_VAR: 1.8,    // variance magnitude khi dùng accelerationIncludingGravity
  COOLDOWN_MS:   30000   // 30s giữa 2 lần trigger GPS
};

function _saMotionInstall(){
  _saMotion.handler = function(e){
    var now = Date.now();
    var mag = 0;
    var useGrav = false;

    // Ưu tiên acceleration (đã trừ gravity) — signal sạch hơn
    var a = e.acceleration;
    if(a && a.x !== null && a.x !== undefined){
      mag = Math.sqrt((a.x||0)*(a.x||0) + (a.y||0)*(a.y||0) + (a.z||0)*(a.z||0));
    } else {
      var ag = e.accelerationIncludingGravity;
      if(!ag) return;
      mag = Math.sqrt((ag.x||0)*(ag.x||0) + (ag.y||0)*(ag.y||0) + (ag.z||0)*(ag.z||0));
      useGrav = true;
    }

    // Sliding window — giữ lại mẫu trong 2 giây gần nhất
    _saMotion.samples.push({mag: mag, t: now});
    var cutoff = now - _saMotion.WINDOW_MS;
    var s = _saMotion.samples;
    var i = 0;
    while(i < s.length && s[i].t < cutoff) i++;
    if(i > 0) _saMotion.samples = s.slice(i);
    if(_saMotion.samples.length < _saMotion.MIN_SAMPLES) return;

    // Tính mean
    var n = _saMotion.samples.length;
    var sum = 0;
    for(var j = 0; j < n; j++) sum += _saMotion.samples[j].mag;
    var mean = sum / n;

    // Quyết định đang di chuyển hay không
    var moving = false;
    if(!useGrav){
      // acceleration (no gravity): đứng yên ≈ 0, đi bộ ≈ 1-2 m/s²
      moving = mean > _saMotion.THRESHOLD_LIN;
    } else {
      // accelerationIncludingGravity: đứng yên variance thấp, đi bộ variance cao
      var vSum = 0;
      for(var k = 0; k < n; k++){
        var d = _saMotion.samples[k].mag - mean;
        vSum += d * d;
      }
      moving = (vSum / n) > _saMotion.THRESHOLD_VAR;
    }

    if(moving && (now - _saMotion.lastTriggerAt) > _saMotion.COOLDOWN_MS){
      _saMotion.lastTriggerAt = now;
      _saMotion.samples = [];
      saLog('MOTION_DETECTED', (useGrav ? 'var=' : 'mean=') + mean.toFixed(2));
      // Chỉ trigger GPS khi đang WORKING — tránh gọi lúc state không phù hợp
      if(_sa.state === STATE.WORKING && typeof saGpsPoll === 'function') saGpsPoll();
    }
  };

  window.addEventListener('devicemotion', _saMotion.handler, {passive: true});
  _saMotion.active = true;
  saLog('MOTION_ON', 'DeviceMotion listener installed');
}

function saMotionStart(){
  if(_saMotion.active) return;
  if(!window.DeviceMotionEvent) return;

  // iOS 13+ yêu cầu xin quyền — Android không cần
  if(typeof DeviceMotionEvent.requestPermission === 'function'){
    DeviceMotionEvent.requestPermission().then(function(perm){
      if(perm === 'granted') _saMotionInstall();
    }).catch(function(){});
    return;
  }
  _saMotionInstall();
}

function saMotionStop(){
  if(!_saMotion.active || !_saMotion.handler) return;
  window.removeEventListener('devicemotion', _saMotion.handler);
  _saMotion.handler = null;
  _saMotion.active = false;
  _saMotion.samples = [];
  saLog('MOTION_OFF', 'DeviceMotion listener removed');
}

window.saMotionStart = saMotionStart;
window.saMotionStop  = saMotionStop;

// Init khi DOM sẵn sàng
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(saInit, 500); });
} else {
  setTimeout(saInit, 500);
}

})();
