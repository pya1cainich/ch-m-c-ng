/* ════════════════════════════════════════════════════════════════════════
   capacitor-integration.js — BRIDGE NATIVE CHO CHẤM CÔNG PRO

   File này thiết lập window.ccNative và window.rescheduleNativeNotifications.
   Chỉ chạy trong APK Android (khi window.Capacitor tồn tại).

   Plugins sử dụng:
     - ChamCongNative  : gửi/lên lịch thông báo native
     - BackgroundGeolocation : GPS chạy ngầm
   ════════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ── Chỉ chạy trong APK (Capacitor native platform) ──────────────────
  if (!window.Capacitor) {
    console.log('[cc-int] Browser mode — ccNative disabled');
    return;
  }

  // ── Hàm init chính — gọi sau khi Capacitor ready ───────────────────
  async function initCcNative() {
    try {
      const Plugins = window.Capacitor.Plugins || {};
      const NativePlugin = Plugins.ChamCongNative;
      const BgGeo  = Plugins.BackgroundGeolocation;
      const FgSvc  = Plugins.ForegroundService;
      const isNative = window.Capacitor.isNativePlatform
        ? window.Capacitor.isNativePlatform()
        : (typeof window.Capacitor.platform !== 'undefined');
      let notificationPermissionAsked = false;

      async function ensureNotificationPermission() {
        if (notificationPermissionAsked) return null; // Đã xin rồi — không xin lại mỗi lần gửi thông báo
        if (!NativePlugin || !NativePlugin.requestPermission) return null;
        try {
          notificationPermissionAsked = true;
          const res = await NativePlugin.requestPermission();
          console.log('[cc-int] Notification permission:', JSON.stringify(res || {}));
          return res;
        } catch (e) {
          console.warn('[cc-int] request notification permission failed:', e);
          return null;
        }
      }

      // FIX GPS: xin quyền vị trí ngay khi khởi động.
      // Trước đây app chỉ xin quyền notification, quyền GPS được xin lazy (lúc poll
      // GPS lần đầu) → native service có thể chạy trước khi có quyền → không track
      // được ngầm. Xin sớm để cả JS lẫn NativeGpsService đều có quyền ngay.
      let locationPermissionAsked = false;
      async function ensureLocationPermissionOnInit() {
        if (!NativePlugin || !NativePlugin.requestLocationPermission) return null;
        try {
          locationPermissionAsked = true;
          // Chỉ xin nếu chưa có — tránh popup thừa
          if (NativePlugin.checkLocationPermission) {
            const cur = await NativePlugin.checkLocationPermission();
            if (cur && (cur.location === 'granted' || cur.fineLocation === 'granted' || cur.coarseLocation === 'granted')) {
              console.log('[cc-int] Location permission: đã được cấp');
              return cur;
            }
          }
          const res = await NativePlugin.requestLocationPermission();
          console.log('[cc-int] Location permission:', JSON.stringify(res || {}));
          return res;
        } catch (e) {
          console.warn('[cc-int] request location permission failed:', e);
          return null;
        }
      }

      // ── Xin quyền notification ngay khi khởi động (Android 13+) ────
      function validGpsPair(lat, lng) {
        return Number.isFinite(lat) && Number.isFinite(lng)
          && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      }

      function normalizeGpsLoc(loc, fallbackRadius) {
        if (!loc) return null;
        const lat = Number(loc.lat);
        const lng = Number(loc.lng);
        if (!validGpsPair(lat, lng)) return null;
        const radius = Number(loc.radius) > 0 ? Number(loc.radius) : (Number(fallbackRadius) || 100);
        return { lat, lng, radius };
      }

      function smartJson(value, fallback) {
        try { return JSON.stringify(value == null ? fallback : value); }
        catch (e) { return JSON.stringify(fallback); }
      }

      function resolveStoredCompanyGps(gpsData) {
        const g = gpsData || window._gpsData || {};
        try {
          if (typeof window.gpsGetStoredCompanyLocation === 'function') {
            const loc = normalizeGpsLoc(window.gpsGetStoredCompanyLocation(g.activeJob || 'main'), g.radius);
            if (loc) return loc;
          }
        } catch (e) {}
        const locations = g.locations || {};
        return normalizeGpsLoc(locations[g.activeJob || 'main'], g.radius)
          || normalizeGpsLoc(locations.main, g.radius)
          || normalizeGpsLoc(g, g.radius);
      }

      function dateKeyForOffset(offsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        if (typeof window.dateKeyFromDate === 'function') return window.dateKeyFromDate(d);
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      }

      function timeToTs(dateKey, hm, inHm) {
        if (!dateKey || !hm) return 0;
        const parts = String(dateKey).split('-');
        const dp = parts.map(Number);
        const tp = String(hm).split(':').map(Number);
        if (dp.length < 3 || tp.length < 2 || dp.some(Number.isNaN) || tp.some(Number.isNaN)) return 0;
        const legacyMonth = parts[1].length < 2 || parts[2].length < 2 || dp[1] === 0;
        const month = legacyMonth ? dp[1] : dp[1] - 1;
        const d = new Date(dp[0], month, dp[2], tp[0], tp[1], 0, 0);
        if (inHm) {
          const ip = String(inHm).split(':').map(Number);
          if (ip.length >= 2 && !ip.some(Number.isNaN)) {
            const outMin = tp[0] * 60 + tp[1];
            const inMin = ip[0] * 60 + ip[1];
            if (outMin <= inMin) d.setDate(d.getDate() + 1);
          }
        }
        return d.getTime();
      }

      function collectDayState(prefix, dateKey) {
        const day = (window.attData && window.attData[dateKey]) || {};
        const state = {};
        const inTs = (typeof window.attendanceCheckInAt === 'function')
          ? window.attendanceCheckInAt(day, dateKey)
          : (Number(day.checkInAt || day.gpsInTs || 0) || (day.in ? timeToTs(dateKey, day.in) : 0));
        const outTs = (typeof window.attendanceCheckOutAt === 'function')
          ? window.attendanceCheckOutAt(day, dateKey)
          : (Number(day.checkOutAt || day.gpsOutTs || 0) || (day.out ? timeToTs(dateKey, day.out, day.in) : 0));
        state[prefix + 'Date'] = dateKey;
        state[prefix + 'HasIn'] = !!day.in;
        state[prefix + 'HasOut'] = !!day.out;
        state[prefix + 'In'] = day.in || '';
        state[prefix + 'Out'] = day.out || '';
        state[prefix + 'InTs'] = day.in ? inTs : 0;
        state[prefix + 'OutTs'] = day.out ? outTs : 0;
        return state;
      }

      function lastCheckoutTsForNative() {
        try {
          if (typeof window.gpsFindLastCheckoutInfo === 'function') {
            const main = window.gpsFindLastCheckoutInfo('main');
            const sub = window.gpsFindLastCheckoutInfo('sub');
            return Math.max((main && main.ts) || 0, (sub && sub.ts) || 0);
          }
        } catch (e) {}
        let best = 0;
        const data = window.attData || {};
        Object.keys(data).forEach(function(k) {
          const day = data[k] || {};
          if (day.out) best = Math.max(best, (typeof window.attendanceCheckOutAt === 'function' ? window.attendanceCheckOutAt(day, k) : 0) || Number(day.checkOutAt || day.gpsOutTs || 0) || timeToTs(k, day.out, day.in));
          if (day.sub && day.sub.out) best = Math.max(best, (typeof window.attendanceCheckOutAt === 'function' ? window.attendanceCheckOutAt(day.sub, k) : 0) || Number(day.sub.checkOutAt || day.sub.gpsOutTs || 0) || timeToTs(k, day.sub.out, day.sub.in));
        });
        return best;
      }

      function nativeTimeToMinutes(value, fallback) {
        const m = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return fallback;
        const h = Number(m[1]);
        const min = Number(m[2]);
        if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return fallback;
        return h * 60 + min;
      }

      function currentShiftScheduleForNative() {
        const data = window.userData || {};
        const shifts = Array.isArray(data.shiftTimes) && data.shiftTimes.length ? data.shiftTimes : [{ in:'08:00', out:'17:00' }];
        // Dùng getEffectiveCurrentShift (xét rotation pattern) — đồng bộ giờ ca xuống native
        // theo ĐÚNG ca user đang làm tuần này, không phải userData.currentShift cứng.
        const curShift = (typeof window.getEffectiveCurrentShift === 'function')
          ? window.getEffectiveCurrentShift()
          : (Number(data.currentShift) || 1);
        const idx = Math.max(0, Math.min(shifts.length - 1, curShift - 1));
        const shift = shifts[idx] || shifts[0] || {};
        return {
          inMin: nativeTimeToMinutes(shift.in || '08:00', 8 * 60),
          outMin: nativeTimeToMinutes(shift.out || '17:00', 17 * 60)
        };
      }

      function buildNativeAttendanceState() {
        const state = Object.assign(
          {},
          collectDayState('today', dateKeyForOffset(0)),
          collectDayState('yesterday', dateKeyForOffset(-1))
        );
        state.lastOutTs = lastCheckoutTsForNative();
        return state;
      }

      await ensureNotificationPermission();
      // Xin quyền vị trí ngay khi khởi động (sau notification) — quan trọng để
      // NativeGpsService track GPS được ngầm và navigator.geolocation hoạt động.
      await ensureLocationPermissionOnInit();

      // ═══════════════════════════════════════════════════════════════
      //  window.ccNative — đối tượng bridge chính
      // ═══════════════════════════════════════════════════════════════
      window.ccNative = {
        isNative : isNative,
        platform : 'android',
        plugins  : {
          BG : !!BgGeo,
          FS : !!FgSvc,
          CN : !!NativePlugin
        },

        // ── Gửi thông báo ngay lập tức ──────────────────────────────
        sendNotification: async function(title, body, id) {
          if (!NativePlugin) { console.warn('[ccNative] Plugin chưa sẵn sàng'); return; }
          try {
            await ensureNotificationPermission();
            await NativePlugin.sendNotification({ title, body, id: id || 1 });
            console.log('[ccNative] Sent:', title);
          } catch(e) {
            console.error('[ccNative] sendNotification lỗi:', e);
          }
        },

        // ── Lên lịch thông báo tương lai ────────────────────────────
        // extra (tuỳ chọn): { dateKey, job } — để NotificationReceiver validate khi app tắt
        scheduleNotification: async function(title, body, id, atDate, extra) {
          if (!NativePlugin) return;
          const atMs = atDate instanceof Date ? atDate.getTime() : Number(atDate);
          if (isNaN(atMs) || atMs <= Date.now()) {
            console.log('[ccNative] Bỏ qua schedule trong quá khứ:', id, title);
            return;
          }
          try {
            if (!notificationPermissionAsked) await ensureNotificationPermission();
            const payload = { title, body, id, at: atMs };
            if (extra && extra.dateKey) payload.dateKey = String(extra.dateKey);
            if (extra && extra.job)     payload.job     = String(extra.job);
            if (extra && extra.data)    payload.data    = String(extra.data);
            await NativePlugin.scheduleNotification(payload);
            console.log('[ccNative] Scheduled id=' + id + ' at=' + new Date(atMs).toLocaleString());
          } catch(e) {
            console.error('[ccNative] scheduleNotification lỗi:', e);
          }
        },

        // ── Đánh dấu ca đã checkout vào SharedPreferences (backup validate) ──
        markOpenShiftClosed: async function(dateKey, job) {
          if (!NativePlugin || !NativePlugin.markOpenShiftClosed) return;
          try {
            await NativePlugin.markOpenShiftClosed({ dateKey: String(dateKey || ''), job: String(job || 'main') });
          } catch(e) {
            console.warn('[ccNative] markOpenShiftClosed lỗi:', e);
          }
        },

        // ── Hủy thông báo đã lên lịch ───────────────────────────────
        cancelNotification: async function(id) {
          if (!NativePlugin) return;
          try { await NativePlugin.cancelNotification({ id }); } catch(e) {}
        },

        // ── Lấy danh sách thông báo đang chờ ────────────────────────
        getPending: async function() {
          if (!NativePlugin) return [];
          try {
            const res = await NativePlugin.getPendingNotifications();
            return res.notifications || [];
          } catch(e) { return []; }
        },

        openNotificationSettings: async function() {
          if (!NativePlugin || !NativePlugin.openNotificationSettings) {
            throw new Error('Native notification settings bridge unavailable');
          }
          return NativePlugin.openNotificationSettings();
        },

        openLocationSettings: async function() {
          if (!NativePlugin || !NativePlugin.openLocationSettings) {
            throw new Error('Native location settings bridge unavailable');
          }
          return NativePlugin.openLocationSettings();
        },

        // ── Quyền vị trí (GPS) ──────────────────────────────────────
        checkLocationPermission: async function() {
          if (!NativePlugin || !NativePlugin.checkLocationPermission) {
            return { location:'unknown', missingBridge:true };
          }
          try { return await NativePlugin.checkLocationPermission(); }
          catch (e) { return { location:'unknown', error:String(e && e.message || e) }; }
        },

        requestLocationPermission: async function() {
          if (!NativePlugin || !NativePlugin.requestLocationPermission) {
            return { location:'unknown', missingBridge:true };
          }
          try { return await NativePlugin.requestLocationPermission(); }
          catch (e) { return { location:'denied', error:String(e && e.message || e) }; }
        },

        // Đảm bảo có quyền vị trí: kiểm tra trước, chỉ xin nếu chưa được cấp.
        // checkin.js gọi window.ccNative.ensureLocationPermission() trong gpsCurrentPosition.
        ensureLocationPermission: async function() {
          if (!NativePlugin) return { location:'unknown', missingBridge:true };
          try {
            if (NativePlugin.checkLocationPermission) {
              const cur = await NativePlugin.checkLocationPermission();
              if (cur && (cur.location === 'granted' || cur.fineLocation === 'granted' || cur.coarseLocation === 'granted')) {
                return cur;
              }
            }
            if (NativePlugin.requestLocationPermission) {
              return await NativePlugin.requestLocationPermission();
            }
          } catch (e) {
            console.warn('[ccNative] ensureLocationPermission lỗi:', e);
          }
          return { location:'denied' };
        },

        ensureLocationPermission: async function() {
          if (!NativePlugin) return { granted:false, missingBridge:true };
          try {
            if (NativePlugin.checkLocationPermission) {
              const cur = await NativePlugin.checkLocationPermission();
              if (cur && (cur.location === 'granted' || cur.coarseLocation === 'granted')) {
                return Object.assign({ granted:true }, cur);
              }
            }
            if (NativePlugin.requestLocationPermission) {
              const res = await NativePlugin.requestLocationPermission();
              const granted = !!(res && (res.location === 'granted' || res.coarseLocation === 'granted'));
              return Object.assign({ granted }, res || {});
            }
          } catch(e) {
            console.warn('[ccNative] location permission request failed:', e);
          }
          return { granted:false };
        },

        requestIgnoreBatteryOptimization: async function() {
          if (!NativePlugin || !NativePlugin.requestIgnoreBatteryOptimization) {
            throw new Error('Native battery settings bridge unavailable');
          }
          return NativePlugin.requestIgnoreBatteryOptimization();
        },

        checkBatteryOptimization: async function() {
          if (!NativePlugin || !NativePlugin.checkBatteryOptimizationPermission) {
            return { granted:false, missingBridge:true };
          }
          return NativePlugin.checkBatteryOptimizationPermission();
        },

        checkExactAlarmPermission: async function() {
          if (!NativePlugin || !NativePlugin.checkExactAlarmPermission) {
            return { granted:true, missingBridge:true }; // fallback: assume granted
          }
          return NativePlugin.checkExactAlarmPermission();
        },

        requestExactAlarmPermission: async function() {
          if (!NativePlugin || !NativePlugin.requestExactAlarmPermission) {
            return { opened:false, missingBridge:true };
          }
          return NativePlugin.requestExactAlarmPermission();
        },

        getWifiInfo: async function() {
          if (!NativePlugin || !NativePlugin.getWifiInfo) {
            return { connected:false, ssid:'', bssid:'', missingBridge:true };
          }
          return NativePlugin.getWifiInfo();
        },

        getCellInfo: async function() {
          if (!NativePlugin || !NativePlugin.getCellInfo) {
            return { cellId:-1, lac:-1, mcc:'', mnc:'', type:'', missingBridge:true };
          }
          return NativePlugin.getCellInfo();
        },

        getStoredSignals: async function() {
          if (!NativePlugin || !NativePlugin.getStoredSignals) {
            return {
              wifiConnected:false,
              wifiSsid:'',
              wifiBssid:'',
              cellId:-1,
              lac:-1,
              cellType:'',
              signalTs:0,
              missingBridge:true
            };
          }
          return NativePlugin.getStoredSignals();
        },

        syncNativeGps: async function(gpsData) {
          if (!NativePlugin) return { ok:false, reason:'missing-plugin' };
          const g = gpsData || window._gpsData || {};
          const loc = resolveStoredCompanyGps(g);
          const tightCompanyGps = !!g.tightCompanyGps;
          const smartAttendanceMode = !!(g.smartAttendanceMode || (window._sa && window._sa.enabled));
          const sa = window._sa || {};
          const saHome = sa.home || {};
          const saWork = sa.work || {};
          const shift = currentShiftScheduleForNative();
          const cfg = {
            lat: loc ? loc.lat : 0,
            lng: loc ? loc.lng : 0,
            radius: tightCompanyGps ? 15 : (loc ? loc.radius : (Number(g.radius) || 15)),
            // FIX #5: Smart mode trước đây force checkinMin=20/checkoutMin=80, ignore slider.
            // → user kéo slider không có tác dụng, UX confusing. Giờ luôn dùng giá trị từ
            // slider (_gpsData.checkinMin/checkoutMin), fallback 20/80 khi chưa set.
            checkinMin: Number(g.checkinMin) > 0 ? Number(g.checkinMin) : 20,
            checkoutMin: Number(g.checkoutMin) > 0 ? Number(g.checkoutMin) : 80,
            scheduleInMin: shift.inMin,
            scheduleOutMin: shift.outMin,
            tightCompanyGps: tightCompanyGps,
            smartAttendanceMode: smartAttendanceMode,
            smartState: smartAttendanceMode && sa.state ? String(sa.state) : '',
            smartCheckinWindowStart: Number(sa.checkinWindowStart) || 0,
            smartCheckoutWindowStart: Number(sa.checkoutWindowStart) || 0,
            smartLastCheckoutAt: Number(sa.lastCheckoutAt) || 0,
            smartCycleReadyAt: Number(sa.cycleReadyAt) || 0,
            smartGpsWakeupAt: Number(sa.gpsWakeupAt) || 0,
            smartHomeWifi: smartJson(saHome.wifi, []),
            smartHomeBts: smartJson(saHome.bts, []),
            smartHomeGps: smartJson(saHome.gps, null),
            smartWorkWifi: smartJson(saWork.wifi, []),
            smartWorkBts: smartJson(saWork.bts, []),
            smartWorkGps: smartJson(saWork.gps, null),
            userLang: (window.userData && window.userData.lang) || 'vi',
            insideScheduleOut: false,
            enabled: !!((g.enabled || (sa && sa.enabled)) && loc),
            hasLocation: !!loc
          };
          if (NativePlugin.setGpsConfig) await NativePlugin.setGpsConfig(cfg);
          if (cfg.enabled && NativePlugin.startNativeGps) {
            const perm = await this.ensureLocationPermission();
            if (!perm || !perm.granted) return { ok:false, missingPermission:true, reason:'location-permission-required' };

            // ── Kiểm tra battery optimization ──────────────────────────────
            // Nếu chưa được whitelist → nhắc user (không block, chỉ warn).
            // Đây là nguyên nhân #1 khiến service chết trên MIUI/Samsung.
            try {
              if (NativePlugin.checkBatteryOptimizationPermission) {
                const bat = await NativePlugin.checkBatteryOptimizationPermission();
                const ignored = !!(bat && (bat.ignoringBatteryOptimizations || bat.granted));
                if (!ignored) {
                  // Ghi flag để JS hiện banner nhắc sau khi start
                  if (window._gpsData) window._gpsData._needBatteryPrompt = true;
                }
              }
            } catch(e) { /* không block nếu check lỗi */ }

            // ── Kiểm tra SCHEDULE_EXACT_ALARM (Android 12+) ────────────────
            // Nếu không được grant → alarm không fire → service không restart được.
            try {
              if (NativePlugin.checkExactAlarmPermission) {
                const ea = await NativePlugin.checkExactAlarmPermission();
                const granted = !!(ea && (ea.granted || ea.canScheduleExactAlarms));
                if (!granted) {
                  if (window._gpsData) window._gpsData._needExactAlarmPrompt = true;
                }
              }
            } catch(e) { /* không block */ }

            await NativePlugin.startNativeGps(cfg);
            return { ok:true, started:true,
              needBatteryPrompt: !!(window._gpsData && window._gpsData._needBatteryPrompt),
              needExactAlarmPrompt: !!(window._gpsData && window._gpsData._needExactAlarmPrompt) };
          }
          if (!cfg.enabled && NativePlugin.stopNativeGps) {
            await NativePlugin.stopNativeGps();
            return { ok:true, stopped:true };
          }
          return { ok:false, reason:'missing-native-gps-method' };
        },

        pullNativeAttendance: async function() {
          if (!NativePlugin || !NativePlugin.getNativeAttendance) return { merged:0 };
          const res = await NativePlugin.getNativeAttendance();
          const records = (res && res.records) || [];
          let merged = 0;
          if (!window.attData) window.attData = {};
          for (const rec of records) {
            const key = rec && rec.date;
            if (!key) continue;
            if (!window.attData[key]) window.attData[key] = { type:'cm' };
            const day = window.attData[key];
            day.type = day.type || 'cm';
            if (rec.type === 'IN' && !day.in) {
              day.in = rec.time;
              day.auto = true;
              merged++;
            } else if (rec.type === 'OUT' && !day.out) {
              day.out = rec.time;
              day.auto = true;
              merged++;
            }
          }
          if (merged > 0) {
            if (typeof window.saveAtt === 'function') window.saveAtt();
            else if (typeof lsSet === 'function') lsSet('cp22_att', window.attData);
            if (typeof window.renderHomeStats === 'function') window.renderHomeStats();
            if (typeof window.updateTodayStatusTime === 'function') window.updateTodayStatusTime();
            if (typeof window.renderCalBig === 'function') window.renderCalBig();
            if (typeof window.renderCalDayList === 'function') window.renderCalDayList();
            if (typeof window.updateExcelPanel === 'function') window.updateExcelPanel();
            console.log('[ccNative] merged native attendance records:', merged);
          }
          if (records.length > 0 && NativePlugin.clearNativeAttendance) {
            if (NativePlugin.setAttendanceState) {
              try { await NativePlugin.setAttendanceState(buildNativeAttendanceState()); } catch (e) {}
            }
            await NativePlugin.clearNativeAttendance({ clearAll:true });
            console.log('[ccNative] cleared native attendance queue:', records.length);
          }
          return { merged };
        },

        syncNativeAttendanceState: async function() {
          if (!NativePlugin || !NativePlugin.setAttendanceState) return { ok:false, reason:'missing-method' };
          const state = buildNativeAttendanceState();
          await NativePlugin.setAttendanceState(state);
          return { ok:true, state };
        },

        // ── Khởi động GPS nền ────────────────────────────────────────
        startBg: async function() {
          // NativeGpsService already owns the Android foreground service.
          // Starting the legacy BackgroundGeolocation watcher here creates a
          // second persistent GPS notification, so delegate to native instead.
          try {
            const res = await this.syncNativeGps(window._gpsData);
            if (res && res.started) window._gpsBgWatchId = 'native';
            console.log('[ccNative] NativeGpsService start result:', res);
            return res;
          } catch(e) {
            console.error('[ccNative] startBg native lỗi:', e);
            return { ok:false, error:String(e && e.message || e) };
          }
        }
      };

      console.log('[cc-int] ccNative ready. Plugins:', JSON.stringify(window.ccNative.plugins));
      // Trigger GPS startup check: plugin + quyền đã sẵn sàng → start GPS nếu OK
      if(typeof window.ensureGpsAutoRunning === 'function'){
        setTimeout(function(){ window.ensureGpsAutoRunning('ccNative-ready'); }, 100);
      }

      const syncNativeGpsSafe = async function() {
        if (!window.ccNative || !window.ccNative.syncNativeGps) return;
        try {
          // FIX P2 #4: BỎ gọi window.loadGpsData() định kỳ.
          // Lý do: loadGpsData() có gpsRepairLocationPersistence() → mỗi lần gọi sẽ
          // lsSet('cp22_gps', _gpsData) → ghi localStorage liên tục mỗi 15s (hao pin,
          // wear flash, log spam). _gpsData đã có sẵn trong RAM, và hook saveGpsData
          // (xem dưới) đã đảm bảo sync khi data thay đổi từ phía JS.
          if (!window._gpsData) return;
          const res = await window.ccNative.syncNativeGps(window._gpsData);
          if (res && res.started) window._gpsBgWatchId = 'native';
          return res;
        }
        catch (e) { console.warn('[cc-int] syncNativeGps failed:', e); }
      };

      const pullNativeAttendanceSafe = async function() {
        if (!window.ccNative || !window.ccNative.pullNativeAttendance) return;
        try {
          await window.ccNative.pullNativeAttendance();
          await syncNativeAttendanceStateSafe();
        }
        catch (e) { console.warn('[cc-int] pullNativeAttendance failed:', e); }
      };

      const syncNativeAttendanceStateSafe = async function() {
        if (!window.ccNative || !window.ccNative.syncNativeAttendanceState) return;
        try { await window.ccNative.syncNativeAttendanceState(); }
        catch (e) { console.warn('[cc-int] syncNativeAttendanceState failed:', e); }
      };

      if (typeof window.saveGpsData === 'function' && !window.saveGpsData.__nativeGpsHooked) {
        const originalSaveGpsData = window.saveGpsData;
        window.saveGpsData = function() {
          const result = originalSaveGpsData.apply(this, arguments);
          setTimeout(syncNativeGpsSafe, 0);
          return result;
        };
        window.saveGpsData.__nativeGpsHooked = true;
      }

      if (typeof window.saveAtt === 'function' && !window.saveAtt.__nativeAttHooked) {
        const originalSaveAtt = window.saveAtt;
        window.saveAtt = function() {
          const result = originalSaveAtt.apply(this, arguments);
          setTimeout(syncNativeAttendanceStateSafe, 0);
          return result;
        };
        window.saveAtt.__nativeAttHooked = true;
      }

      setTimeout(syncNativeGpsSafe, 800);
      setTimeout(syncNativeAttendanceStateSafe, 1000);
      setTimeout(pullNativeAttendanceSafe, 1200);
      // FIX P2 #4: tăng interval 15s → 60s. Sync với native không cần quá thường xuyên
      // vì hook saveGpsData/saveAtt đã tự trigger sync khi có thay đổi từ phía JS.
      // Native plugin có thể chịu được gap 60s vì NativeGpsService có lifecycle riêng.
      setInterval(syncNativeGpsSafe, 60000);
      setInterval(syncNativeAttendanceStateSafe, 60000);
      setInterval(pullNativeAttendanceSafe, 60000);
      document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
          syncNativeGpsSafe();
          if (typeof window.ensureGpsAutoRunning === 'function') {
            setTimeout(function(){ window.ensureGpsAutoRunning('cc-visible'); }, 250);
          }
          syncNativeAttendanceStateSafe();
          pullNativeAttendanceSafe();
          // Xem lại reminder đang chờ: nếu ca đã checkout thì huỷ hết thông báo tương lai
          if (typeof window.gpsValidateOpenShiftReminders === 'function') {
            window.gpsValidateOpenShiftReminders();
          }
        }
      });

      let notificationRescheduleSeq = 0;
      // FIX P2 #5: timer debounce + flag để gộp nhiều call reschedule gần nhau
      // (vd: init auto + saveGpsData hook + user click "Bắt đầu ngày làm việc")
      let notificationRescheduleDebounceTimer = null;
      let notificationRescheduleInProgress = false;

      async function cancelScheduledNotificationIds() {
        const ids = new Set();
        const pending = await window.ccNative.getPending();
        for (const n of pending) {
          if (n.id >= 10000 && n.id <= 49999) ids.add(n.id);
        }

        // Known scheduler ids. Cancel these even when SharedPreferences is stale,
        // so changing shift times always removes old alarms before writing new ones.
        for (let i = 10000; i <= 10006; i++) ids.add(i);
        for (let i = 20000; i <= 20006; i++) ids.add(i);
        for (let i = 40000; i <= 40003; i++) ids.add(i);

        for (const id of ids) {
          await window.ccNative.cancelNotification(id);
        }
        console.log('[cc-int] Cancelled scheduled notification ids:', ids.size);
      }

      // ── Thiết lập rescheduleNativeNotifications ──────────────────
      // FIX P2 #5: implementation gốc đổi tên thành _impl, wrapper public bên ngoài
      // sẽ debounce 800ms + skip nếu đang chạy để tránh trùng lặp (xem cuối hàm này).
      async function _rescheduleNativeNotificationsImpl() {
        if (!window.ccNative || !window.ccNative.isNative) return;
        if (!NativePlugin) return;
        const seq = ++notificationRescheduleSeq;

        const storedNotifCfg = (typeof lsGet === 'function') ? (lsGet('cp22_notif') || {}) : {};
        const notifCfg = Object.assign(
          { n1: true, n2: true, n3: false, n4: false },
          storedNotifCfg,
          window.notifCfg || {}
        );
        const userData = window.userData || {};
        const shiftTimes = userData.shiftTimes || [];
        // Dùng getEffectiveCurrentShift (xét rotation pattern) thay userData.currentShift.
        // Đảm bảo notification N1/N2 lên lịch theo đúng ca trong tuần khi user bật xoay ca.
        const currentShift = (typeof window.getEffectiveCurrentShift === 'function')
          ? window.getEffectiveCurrentShift()
          : (userData.currentShift || 1);
        const shiftIdx = Math.max(0, currentShift - 1);
        const shiftInfo = shiftTimes[shiftIdx] || {};

        const inTime  = shiftInfo.in  || '08:00';
        const outTime = shiftInfo.out || '17:00';
        const L = userData.lang || 'vi';

        console.log('[cc-int] Rescheduling... n1=' + notifCfg.n1 + ' n2=' + notifCfg.n2 + ' n4=' + notifCfg.n4);

        // Hủy tất cả thông báo đã lên lịch trước
        await cancelScheduledNotificationIds();
        if (seq !== notificationRescheduleSeq) {
          console.log('[cc-int] Reschedule superseded before scheduling.');
          return;
        }

        // ── N1: Nhắc trước ca 30 phút (n1 = true) ──────────────────
        if (notifCfg.n1) {
          const n1Msgs = {
            vi: { title:'⏰ Sắp vào ca!', body: `Ca bắt đầu lúc ${inTime} — chuẩn bị sẵn sàng!` },
            en: { title:'⏰ Shift starting soon!', body: `Shift starts at ${inTime} — get ready!` },
            ko: { title:'⏰ 출근 준비!', body: `출근 시간: ${inTime} — 준비하세요!` },
            ja: { title:'⏰ 出勤まもなく!', body: `${inTime} 出勤開始 — 準備しましょう！` },
            zh: { title:'⏰ 即将上班!', body: `${inTime} 开始上班 — 准备好了吗？` },
          };
          const msg1 = n1Msgs[L] || n1Msgs.vi;
          // Lên lịch cho 7 ngày tới
          for (let d = 0; d < 7; d++) {
            const dt = _getNextWeekday(inTime, d, -30);
            if (dt > new Date()) {
              if (seq !== notificationRescheduleSeq) return;
              const id = 10000 + d;
              await window.ccNative.scheduleNotification(msg1.title, msg1.body, id, dt);
            }
          }
        }

        // ── N2: Nhắc xác nhận hết ca sau 15 phút (n2 = true) ────────
        if (notifCfg.n2) {
          const n2Msgs = {
            vi: { title:'🏁 Hết ca rồi!', body: `Đã qua ${outTime} — nhớ chấm hết ca nhé!` },
            en: { title:'🏁 Shift ended!', body: `It's past ${outTime} — remember to clock out!` },
            ko: { title:'🏁 퇴근 시간!', body: `${outTime} 지났습니다 — 퇴근 체크해 주세요!` },
            ja: { title:'🏁 退勤時間!', body: `${outTime} を過ぎました — 退勤打刻してください！` },
            zh: { title:'🏁 下班了!', body: `${outTime} 已过 — 记得打卡下班！` },
          };
          const msg2 = n2Msgs[L] || n2Msgs.vi;
          for (let d = 0; d < 7; d++) {
            const dt = _getNextWeekday(outTime, d, +15);
            if (dt > new Date()) {
              if (seq !== notificationRescheduleSeq) return;
              const id = 20000 + d;
              await window.ccNative.scheduleNotification(msg2.title, msg2.body, id, dt);
            }
          }
        }

        // ── N4: Tổng kết cuối tuần (Thứ 6 17:00) ───────────────────
        if (notifCfg.n4) {
          const n4Msgs = {
            vi: { title:'📊 Tổng kết tuần!', body: 'Xem lại công việc tuần này trong Chấm Công Pro.' },
            en: { title:'📊 Weekly summary!', body: 'Review your work week in Chấm Công Pro.' },
            ko: { title:'📊 주간 요약!', body: '이번 주 근무를 확인해 보세요.' },
            ja: { title:'📊 週間まとめ!', body: '今週の出勤を確認しましょう。' },
            zh: { title:'📊 周总结!', body: '查看本周的考勤记录。' },
          };
          const msg4 = n4Msgs[L] || n4Msgs.vi;
          const fri = _getNextFriday();
          if (fri > new Date()) {
            if (seq !== notificationRescheduleSeq) return;
            await window.ccNative.scheduleNotification(msg4.title, msg4.body, 40000, fri);
          }
        }

        console.log('[cc-int] reschedule done.');
      }

      // FIX P2 #5: Wrapper public — debounce 800ms + skip nếu đang chạy
      // Trước đây: 2 lần reschedule liên tiếp trong 1 giây → cancel/schedule x2 thừa (36 lệnh AlarmManager).
      // Giờ: nhiều call trong 800ms được gộp thành 1, và nếu đang chạy thì call mới bị bỏ.
      window.rescheduleNativeNotifications = function() {
        if (notificationRescheduleInProgress) {
          console.log('[cc-int] reschedule bo qua, lan truoc dang chay');
          return Promise.resolve();
        }
        if (notificationRescheduleDebounceTimer) {
          clearTimeout(notificationRescheduleDebounceTimer);
        }
        return new Promise(function(resolve){
          notificationRescheduleDebounceTimer = setTimeout(async function(){
            notificationRescheduleDebounceTimer = null;
            notificationRescheduleInProgress = true;
            try { await _rescheduleNativeNotificationsImpl(); }
            catch(e){ console.error('[cc-int] reschedule loi:', e); }
            finally { notificationRescheduleInProgress = false; resolve(); }
          }, 800);
        });
      };

      // ── Tự động khởi động GPS nếu user đã bật ─────────────────────
      setTimeout(async () => {
        try {
          const gpsData = (typeof lsGet === 'function') ? lsGet('cp22_gps') : null;
          const hasSavedLoc = !!(gpsData && (
            (Number.isFinite(Number(gpsData.lat)) && Number.isFinite(Number(gpsData.lng))) ||
            (gpsData.locations && (
              (gpsData.locations.main && Number.isFinite(Number(gpsData.locations.main.lat)) && Number.isFinite(Number(gpsData.locations.main.lng))) ||
              (gpsData.locations.sub && Number.isFinite(Number(gpsData.locations.sub.lat)) && Number.isFinite(Number(gpsData.locations.sub.lng)))
            ))
          ));
          if (gpsData && gpsData.enabled && hasSavedLoc) {
            console.log('[cc-int] GPS enabled — ensuring native GPS service');
            if (typeof window.gpsScheduleAutoStart === 'function') window.gpsScheduleAutoStart('cc-auto-init');
            else if (typeof window.ensureGpsAutoRunning === 'function') window.ensureGpsAutoRunning('cc-auto-init');
            else await syncNativeGpsSafe();
          }
          // Lên lịch notifications sau khi init
          await window.rescheduleNativeNotifications();
          // Hiển thị bg status card
          if (typeof _showBgStatusCardIfNative === 'function') {
            _showBgStatusCardIfNative();
          }
        } catch(e) {
          console.error('[cc-int] Auto-init error:', e);
        }
      }, 1500); // Đợi 1.5s để app.js và checkin.js khởi tạo xong

    } catch(err) {
      console.error('[cc-int] Lỗi khởi tạo ccNative:', err);
    }
  }

  // ── Helper: tính thời điểm "HH:MM" ngày d từ hôm nay + offsetMin ──
  function _getNextWeekday(timeStr, dayOffset, offsetMin) {
    const [h, m] = timeStr.split(':').map(Number);
    const dt = new Date();
    dt.setDate(dt.getDate() + dayOffset);
    dt.setHours(h, m + (offsetMin || 0), 0, 0);
    return dt;
  }

  // ── Helper: Thứ 6 tuần này lúc 17:00 ────────────────────────────────
  function _getNextFriday() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 5=Fri
    const diff = (5 - day + 7) % 7 || 7;
    const fri = new Date(now);
    fri.setDate(now.getDate() + diff);
    fri.setHours(17, 0, 0, 0);
    return fri;
  }

  /* ══════════════════════════════════════════════════════════════════════
     window.ccNative.brain — Wrapper cho AttendanceBrainPlugin (bộ não mới)
     Xương cá: JS ↔ Native bridge duy nhất cho smart attendance
     ══════════════════════════════════════════════════════════════════════ */
  function initBrainWrapper() {
    const BrainPlugin = (window.Capacitor && window.Capacitor.Plugins)
      ? window.Capacitor.Plugins.AttendanceBrain
      : null;

    if (!BrainPlugin) {
      console.warn('[cc-int] AttendanceBrain plugin không tìm thấy — brain wrapper disabled');
      return;
    }

    window.ccNative = window.ccNative || {};
    window.ccNative.brain = {
      /** Đồng bộ config từ JS xuống native SharedPreferences */
      syncConfig: (cfg) => BrainPlugin.syncConfig(cfg),

      /** Bật bộ não nền (register motion, đặt alarm, evaluate lần đầu) */
      start: () => BrainPlugin.start(),

      /** Tắt bộ não nền */
      stop: () => BrainPlugin.stop(),

      /** Đọc state native hiện tại */
      getState: () => BrainPlugin.getState(),

      /** JS ghi đè state (dùng cho recovery JS-side) */
      setState: (state, flags) => BrainPlugin.setState({ state, ...flags }),

      /** Chạy recovery khi app mở lại / WebView visible */
      runRecovery: () => BrainPlugin.runRecovery(),

      /** Đọc và xoá pending event do native ghi (check-in/out bù) */
      consumePendingEvent: () => BrainPlugin.consumePendingEvent(),

      /** Yêu cầu GPS oneshot ngắn hạn */
      requestOneShotGps: () => BrainPlugin.requestOneShotGps(),

      /** JS cập nhật GPS result vào native (sau khi lấy GPS qua JS) */
      updateGpsResult: (lat, lng, accuracy) =>
        BrainPlugin.updateGpsResult({ lat, lng, accuracy }),

      /** Đặt lại alarm cho hôm nay (sau khi đổi giờ ca) */
      scheduleAlarms: () => BrainPlugin.scheduleAlarms(),
    };

    console.log('[cc-int] ccNative.brain ready');
  }

  // ── Chờ Capacitor sẵn sàng rồi init ─────────────────────────────────
  if (window.Capacitor && window.Capacitor.Plugins) {
    // Capacitor đã sẵn sàng
    initCcNative();
    initBrainWrapper();
  } else {
    // Chờ event deviceready (Capacitor 6)
    document.addEventListener('deviceready', () => {
      initCcNative();
      initBrainWrapper();
    }, { once: true });
    // Fallback: thử lại sau 2 giây
    setTimeout(() => {
      if (!window.ccNative) {
        console.log('[cc-int] Fallback init...');
        initCcNative();
      }
      if (!window.ccNative || !window.ccNative.brain) {
        initBrainWrapper();
      }
    }, 2000);
  }

})();
