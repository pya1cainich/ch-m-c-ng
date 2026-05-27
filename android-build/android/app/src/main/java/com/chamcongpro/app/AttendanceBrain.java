package com.chamcongpro.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * ════════════════════════════════════════════════════════
 *  MODULE 2: DECISION ENGINE — Bộ não trung tâm (Native)
 *  Xương cá tầng 5: State Machine (điều phối)
 * ════════════════════════════════════════════════════════
 *
 *  Được gọi bởi:
 *   - AttendanceAlarmReceiver  (alarm đến hạn)
 *   - MotionTransitionReceiver (motion thay đổi)
 *   - NativeGpsBootReceiver    (boot / app restart)
 *   - AttendanceBrainPlugin    (JS gọi qua Capacitor)
 *
 *  Pipeline mỗi lần evaluate():
 *    1. Đọc state hiện tại
 *    2. Kiểm tra WiFi
 *    3. Kiểm tra GPS (nếu cần)
 *    4. Kiểm tra deadline
 *    5. Ra quyết định
 *    6. Lưu state mới
 *    7. Gửi notification nếu cần
 *    8. Điều chỉnh GPS on/off
 */
public class AttendanceBrain {

    private static final String TAG = "AttendanceBrain";

    // ─── Singleton ────────────────────────────────────────────────────────────
    private static AttendanceBrain instance;
    public static synchronized AttendanceBrain get() {
        if (instance == null) instance = new AttendanceBrain();
        return instance;
    }

    // ─── Kết quả evaluate ────────────────────────────────────────────────────
    public static class EvalResult {
        public String oldState;
        public String newState;
        public boolean stateChanged;
        public String action;    // "CHECKED_IN" | "CHECKED_OUT" | "REMIND" | "NONE"
        public String detail;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  ENTRY POINT CHÍNH
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Gọi khi có sự kiện: alarm / motion / boot / GPS result / JS recovery.
     * Luôn chạy trên background thread (tránh ANR).
     */
    public EvalResult evaluate(Context ctx, String triggerSource) {
        EvalResult result = new EvalResult();
        result.action = "NONE";

        if (!AttendanceState.isEnabled(ctx)) {
            Log.d(TAG, "[" + triggerSource + "] disabled — skip");
            return result;
        }

        String state = AttendanceState.getState(ctx);
        result.oldState = state;
        result.newState = state;

        Log.d(TAG, "[" + triggerSource + "] evaluate() state=" + state);

        // ─── Kiểm tra ngày mới (reset nếu hôm nay != ngày đã lưu) ─────────
        checkDayRollover(ctx);

        // ─── Đã checkout hôm nay → không làm gì thêm ──────────────────────
        if (AttendanceState.prefs(ctx).getBoolean(AttendanceState.KEY_TODAY_CHECKED_OUT, false)) {
            if (!state.equals(AttendanceState.CHECKED_OUT)) {
                AttendanceState.setState(ctx, AttendanceState.CHECKED_OUT);
                result.newState = AttendanceState.CHECKED_OUT;
                result.stateChanged = true;
            }
            return result;
        }

        // ─── Chạy pipeline theo state hiện tại ─────────────────────────────
        switch (state) {
            case AttendanceState.HOME:
            case AttendanceState.OUTSIDE:
                result = evalPreShift(ctx, state, triggerSource);
                break;

            case AttendanceState.WAIT_CHECKIN_CONFIRM:
                result = evalCheckinWindow(ctx, triggerSource);
                break;

            case AttendanceState.WORKING:
                result = evalWorking(ctx, triggerSource);
                break;

            case AttendanceState.MAYBE_LEFT_WORK:
                result = evalMaybeLeft(ctx, triggerSource);
                break;

            case AttendanceState.WAIT_CHECKOUT_CONFIRM:
                result = evalCheckoutWindow(ctx, triggerSource);
                break;

            case AttendanceState.CHECKED_OUT:
                // Không làm gì, GPS đã tắt
                break;
        }

        // ─── Điều chỉnh GPS sau khi quyết định ─────────────────────────────
        adjustGps(ctx, result.newState);

        return result;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  PIPELINE 1: HOME / OUTSIDE — Chờ vào ca
    // ══════════════════════════════════════════════════════════════════════════

    private EvalResult evalPreShift(Context ctx, String currentState, String trigger) {
        EvalResult r = new EvalResult();
        r.oldState = currentState;
        r.newState = currentState;
        r.action = "NONE";

        // Kiểm tra tín hiệu công ty
        SignalResult sig = checkWorkSignal(ctx);

        if (sig.hasSignal) {
            // Tín hiệu công ty → mở cửa sổ check-in
            long now = System.currentTimeMillis();
            SharedPreferences.Editor ed = AttendanceState.prefs(ctx).edit();

            // Nếu chưa mở cửa sổ check-in, mở mới
            long windowStart = AttendanceState.prefs(ctx).getLong(
                AttendanceState.KEY_CHECKIN_WINDOW_START, 0);
            if (windowStart == 0) {
                ed.putLong(AttendanceState.KEY_CHECKIN_WINDOW_START, now)
                  .putLong(AttendanceState.KEY_CHECKIN_SIGNAL_ON_MS, 0);
            }
            ed.apply();

            r.newState = AttendanceState.WAIT_CHECKIN_CONFIRM;
            r.stateChanged = true;
            AttendanceState.setState(ctx, AttendanceState.WAIT_CHECKIN_CONFIRM);
            Log.d(TAG, "PRE_SHIFT → WAIT_CHECKIN_CONFIRM (signal=" + sig.source + ")");

            // Tiếp tục đánh giá trong cửa sổ check-in ngay
            return evalCheckinWindow(ctx, trigger);
        }

        // Kiểm tra có phải HOME không (WiFi nhà hoặc GPS nhà)
        if (isAtHome(ctx)) {
            if (!currentState.equals(AttendanceState.HOME)) {
                r.newState = AttendanceState.HOME;
                r.stateChanged = true;
                AttendanceState.setState(ctx, AttendanceState.HOME);
            }
        } else {
            if (!currentState.equals(AttendanceState.OUTSIDE)) {
                r.newState = AttendanceState.OUTSIDE;
                r.stateChanged = true;
                AttendanceState.setState(ctx, AttendanceState.OUTSIDE);
            }
        }

        return r;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  PIPELINE 2: WAIT_CHECKIN_CONFIRM — Đang đếm giờ vào ca
    // ══════════════════════════════════════════════════════════════════════════

    private EvalResult evalCheckinWindow(Context ctx, String trigger) {
        EvalResult r = new EvalResult();
        r.oldState = AttendanceState.WAIT_CHECKIN_CONFIRM;
        r.newState = AttendanceState.WAIT_CHECKIN_CONFIRM;
        r.action = "NONE";

        SharedPreferences p = AttendanceState.prefs(ctx);
        long windowStart = p.getLong(AttendanceState.KEY_CHECKIN_WINDOW_START, 0);
        long now         = System.currentTimeMillis();
        long checkinMs   = AttendanceState.checkinMs(ctx);

        SignalResult sig = checkWorkSignal(ctx);

        if (sig.hasSignal) {
            // ── Chiến lược theo loại tín hiệu ────────────────────────────────
            // WiFi: rẻ pin, đáng tin — dùng wall-clock từ lúc phát hiện WiFi.
            //   Alarm thưa cũng không ảnh hưởng vì chỉ so sánh thời điểm.
            // GPS: kém ổn định hơn — dùng tích lũy các lần poll (45s/lần).
            //   Tránh check-in giả khi GPS bị lệch 1 lần rồi vào lại vùng.

            if (sig.source.startsWith("wifi")) {
                // WiFi: wall-clock — nếu WiFi công ty có mặt đủ checkinMs → check-in
                long elapsed = (windowStart > 0) ? (now - windowStart) : 0;
                Log.d(TAG, "CHECKIN_WINDOW [wifi] elapsed=" + elapsed/1000 + "s / need=" + checkinMs/1000 + "s");
                if (elapsed >= checkinMs) {
                    return doCheckIn(ctx, sig.source);
                }
                // Chưa đủ — cập nhật last-seen để đếm liên tục
                // (windowStart chỉ reset khi mất tín hiệu)

            } else {
                // GPS: tích lũy — cộng khoảng cách giữa các lần poll, giới hạn 90s/lần
                // để tránh cộng quá nhiều khi evaluate hiếm
                long signalOnMs = p.getLong(AttendanceState.KEY_CHECKIN_SIGNAL_ON_MS, 0);
                long elapsed    = (windowStart > 0) ? (now - windowStart) : 0;
                long delta      = Math.min(elapsed, 90_000L);
                long newOnMs    = signalOnMs + delta;

                AttendanceState.prefs(ctx).edit()
                    .putLong(AttendanceState.KEY_CHECKIN_SIGNAL_ON_MS, newOnMs)
                    .putLong(AttendanceState.KEY_CHECKIN_WINDOW_START, now)
                    .apply();

                Log.d(TAG, "CHECKIN_WINDOW [gps] signal_on=" + newOnMs/1000 + "s / need=" + checkinMs/1000 + "s");

                if (newOnMs >= checkinMs) {
                    return doCheckIn(ctx, sig.source);
                }
            }

        } else {
            // Mất tín hiệu hoàn toàn
            long totalElapsed = (windowStart > 0) ? (now - windowStart) : 0;

            // Reset GPS accumulation khi mất tín hiệu
            // (để tránh tích lũy từ các phiên WiFi/GPS khác nhau)
            if (p.getLong(AttendanceState.KEY_CHECKIN_SIGNAL_ON_MS, 0) > 0) {
                AttendanceState.prefs(ctx).edit()
                    .putLong(AttendanceState.KEY_CHECKIN_SIGNAL_ON_MS, 0)
                    .putLong(AttendanceState.KEY_CHECKIN_WINDOW_START, now)
                    .apply();
                Log.d(TAG, "CHECKIN_WINDOW signal lost — reset accumulator");
            }

            // Hủy cửa sổ nếu mất tín hiệu quá lâu (checkinMs * 3)
            if (totalElapsed > checkinMs * 3) {
                Log.d(TAG, "CHECKIN_WINDOW timed out — reset to OUTSIDE");
                resetCheckinWindow(ctx);
                r.newState = AttendanceState.OUTSIDE;
                r.stateChanged = true;
                AttendanceState.setState(ctx, AttendanceState.OUTSIDE);
            }
        }

        return r;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  PIPELINE 3: WORKING — Đang trong ca
    // ══════════════════════════════════════════════════════════════════════════

    private EvalResult evalWorking(Context ctx, String trigger) {
        EvalResult r = new EvalResult();
        r.oldState = AttendanceState.WORKING;
        r.newState = AttendanceState.WORKING;
        r.action = "NONE";

        SignalResult sig = checkWorkSignal(ctx);

        if (sig.hasSignal) {
            // WiFi công ty còn → giữ WORKING tuyệt đối
            Log.d(TAG, "WORKING — signal ok (" + sig.source + "), keep WORKING");
            return r;
        }

        // Mất tín hiệu → chuyển MAYBE_LEFT_WORK
        Log.d(TAG, "WORKING — signal lost → MAYBE_LEFT_WORK");
        long now = System.currentTimeMillis();
        AttendanceState.prefs(ctx).edit()
            .putLong(AttendanceState.KEY_MAYBE_LEFT_SINCE, now)
            .apply();
        AttendanceState.setState(ctx, AttendanceState.MAYBE_LEFT_WORK);
        r.newState = AttendanceState.MAYBE_LEFT_WORK;
        r.stateChanged = true;

        return r;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  PIPELINE 4: MAYBE_LEFT_WORK — Nghi ngờ đã rời công ty
    // ══════════════════════════════════════════════════════════════════════════

    private EvalResult evalMaybeLeft(Context ctx, String trigger) {
        EvalResult r = new EvalResult();
        r.oldState = AttendanceState.MAYBE_LEFT_WORK;
        r.newState = AttendanceState.MAYBE_LEFT_WORK;
        r.action = "NONE";

        SignalResult sig = checkWorkSignal(ctx);

        if (sig.hasSignal) {
            // Tín hiệu công ty quay lại → hủy nghi ngờ, về WORKING
            Log.d(TAG, "MAYBE_LEFT_WORK → signal returned → back to WORKING");
            resetMaybeLeft(ctx);
            AttendanceState.setState(ctx, AttendanceState.WORKING);
            r.newState = AttendanceState.WORKING;
            r.stateChanged = true;
            return r;
        }

        // Kiểm tra đã đủ debounce chưa
        long maybeLeftSince = AttendanceState.prefs(ctx).getLong(
            AttendanceState.KEY_MAYBE_LEFT_SINCE, 0);
        long elapsed = System.currentTimeMillis() - maybeLeftSince;

        if (elapsed >= AttendanceState.MAYBE_LEFT_DEBOUNCE_MS) {
            // Đủ debounce → mở cửa sổ checkout
            Log.d(TAG, "MAYBE_LEFT_WORK → debounce passed → WAIT_CHECKOUT_CONFIRM");
            return openCheckoutWindow(ctx);
        }

        // Còn trong debounce → chờ thêm, yêu cầu GPS xác minh
        Log.d(TAG, "MAYBE_LEFT_WORK — debounce " + elapsed/1000 + "s / " +
            AttendanceState.MAYBE_LEFT_DEBOUNCE_MS/1000 + "s — need GPS verify");
        NativeGpsService.requestOneShot(ctx);

        return r;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  PIPELINE 5: WAIT_CHECKOUT_CONFIRM — Đang đếm giờ tan ca
    // ══════════════════════════════════════════════════════════════════════════

    private EvalResult evalCheckoutWindow(Context ctx, String trigger) {
        EvalResult r = new EvalResult();
        r.oldState = AttendanceState.WAIT_CHECKOUT_CONFIRM;
        r.newState = AttendanceState.WAIT_CHECKOUT_CONFIRM;
        r.action = "NONE";

        SharedPreferences p = AttendanceState.prefs(ctx);
        long deadlineAt = p.getLong(AttendanceState.KEY_CHECKOUT_DEADLINE_AT, 0);
        long now        = System.currentTimeMillis();

        SignalResult sig = checkWorkSignal(ctx);

        if (sig.hasSignal) {
            // Tín hiệu công ty quay lại → hủy checkout
            Log.d(TAG, "WAIT_CHECKOUT_CONFIRM → signal returned → back to WORKING");
            resetCheckoutWindow(ctx);
            AttendanceState.setState(ctx, AttendanceState.WORKING);
            r.newState = AttendanceState.WORKING;
            r.stateChanged = true;
            return r;
        }

        // Kiểm tra đã tới deadline chưa
        if (deadlineAt > 0 && now >= deadlineAt) {
            Log.d(TAG, "WAIT_CHECKOUT_CONFIRM → deadline reached → CHECKED_OUT");
            return doCheckOut(ctx, "deadline");
        }

        Log.d(TAG, "WAIT_CHECKOUT_CONFIRM — waiting, deadline in " +
            (deadlineAt > 0 ? (deadlineAt - now)/1000 : "?") + "s");

        return r;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  ACTIONS: Check-in / Check-out
    // ══════════════════════════════════════════════════════════════════════════

    private EvalResult doCheckIn(Context ctx, String method) {
        EvalResult r = new EvalResult();
        r.oldState = AttendanceState.WAIT_CHECKIN_CONFIRM;
        r.newState = AttendanceState.WORKING;
        r.action = AttendanceState.EVENT_CHECKED_IN;
        r.stateChanged = true;

        long now = System.currentTimeMillis();
        String timeStr = formatTime(now);

        Log.d(TAG, "✅ CHECK-IN via " + method + " at " + timeStr);

        AttendanceState.prefs(ctx).edit()
            .putBoolean(AttendanceState.KEY_TODAY_CHECKED_IN, true)
            .apply();
        AttendanceState.setState(ctx, AttendanceState.WORKING);
        resetCheckinWindow(ctx);

        r.detail = timeStr + "|" + method;
        AttendanceState.setPendingEvent(ctx, AttendanceState.EVENT_CHECKED_IN, r.detail);

        // Gửi notification ngay
        AttendanceNotifier.notifyCheckedIn(ctx, timeStr);

        // Đặt alarm nhắc nếu chưa checkout trước giờ tan ca
        AttendanceAlarmScheduler.get().scheduleCheckoutReminder(ctx);

        return r;
    }

    private EvalResult doCheckOut(Context ctx, String reason) {
        EvalResult r = new EvalResult();
        r.oldState = AttendanceState.WAIT_CHECKOUT_CONFIRM;
        r.newState = AttendanceState.CHECKED_OUT;
        r.action = AttendanceState.EVENT_CHECKED_OUT;
        r.stateChanged = true;

        long now = System.currentTimeMillis();
        String timeStr = formatTime(now);

        Log.d(TAG, "✅ CHECK-OUT reason=" + reason + " at " + timeStr);

        AttendanceState.prefs(ctx).edit()
            .putBoolean(AttendanceState.KEY_TODAY_CHECKED_OUT, true)
            .apply();
        AttendanceState.setState(ctx, AttendanceState.CHECKED_OUT);
        resetCheckoutWindow(ctx);
        resetMaybeLeft(ctx);

        r.detail = timeStr + "|" + reason;
        AttendanceState.setPendingEvent(ctx, AttendanceState.EVENT_CHECKED_OUT, r.detail);

        // Gửi notification
        boolean isCompensate = reason.contains("recovery") || reason.contains("deadline");
        AttendanceNotifier.notifyCheckedOut(ctx, timeStr, isCompensate);

        // Tắt alarm deadline (không còn cần)
        AttendanceAlarmScheduler.get().cancelCheckoutDeadline(ctx);

        return r;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  SIGNAL CHECK — WiFi + GPS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Kiểm tra tín hiệu công ty theo thứ tự ưu tiên:
     * 1. WiFi (ưu tiên cao nhất, rẻ pin nhất)
     * 2. GPS (nếu có kết quả gần đây)
     */
    public SignalResult checkWorkSignal(Context ctx) {
        SignalResult r = new SignalResult();

        // ─── 1. WiFi ────────────────────────────────────────────────────────
        String wifiSsid = getCurrentWifiSsid(ctx);
        if (wifiSsid != null && !wifiSsid.isEmpty()) {
            String workWifiList = AttendanceState.prefs(ctx)
                .getString(AttendanceState.KEY_WORK_WIFI_LIST, "");
            if (isInWifiList(wifiSsid, workWifiList)) {
                r.hasSignal = true;
                r.source = "wifi:" + wifiSsid;
                return r;
            }
        }

        // ─── 2. GPS (nếu có reading gần đây < 5 phút) ──────────────────────
        SharedPreferences p = AttendanceState.prefs(ctx);
        long lastGpsAt = p.getLong(AttendanceState.KEY_LAST_GPS_AT, 0);
        long age = System.currentTimeMillis() - lastGpsAt;

        if (lastGpsAt > 0 && age < 5 * 60_000L) {
            double lat = Double.longBitsToDouble(p.getLong(AttendanceState.KEY_LAST_GPS_LAT, 0));
            double lng = Double.longBitsToDouble(p.getLong(AttendanceState.KEY_LAST_GPS_LNG, 0));
            float workLat = p.getFloat(AttendanceState.KEY_WORK_GPS_LAT, 0f);
            float workLng = p.getFloat(AttendanceState.KEY_WORK_GPS_LNG, 0f);
            float radius  = AttendanceState.workGpsRadius(ctx);

            if (workLat != 0f && workLng != 0f) {
                float dist = distanceMeters((double) workLat, (double) workLng, lat, lng);
                if (dist <= radius) {
                    r.hasSignal = true;
                    r.source = "gps:" + String.format("%.0f", dist) + "m";
                    return r;
                }
            }
        }

        return r;
    }

    /**
     * Kiểm tra đang ở nhà không (WiFi nhà hoặc GPS nhà)
     */
    public boolean isAtHome(Context ctx) {
        // WiFi nhà
        String wifiSsid = getCurrentWifiSsid(ctx);
        if (wifiSsid != null && !wifiSsid.isEmpty()) {
            String homeWifiList = AttendanceState.prefs(ctx)
                .getString(AttendanceState.KEY_HOME_WIFI_LIST, "");
            if (isInWifiList(wifiSsid, homeWifiList)) return true;
        }

        // GPS nhà
        SharedPreferences p = AttendanceState.prefs(ctx);
        long lastGpsAt = p.getLong(AttendanceState.KEY_LAST_GPS_AT, 0);
        long age = System.currentTimeMillis() - lastGpsAt;

        if (lastGpsAt > 0 && age < 5 * 60_000L) {
            double lat = Double.longBitsToDouble(p.getLong(AttendanceState.KEY_LAST_GPS_LAT, 0));
            double lng = Double.longBitsToDouble(p.getLong(AttendanceState.KEY_LAST_GPS_LNG, 0));
            float homeLat = p.getFloat(AttendanceState.KEY_HOME_GPS_LAT, 0f);
            float homeLng = p.getFloat(AttendanceState.KEY_HOME_GPS_LNG, 0f);
            float radius  = AttendanceState.homeGpsRadius(ctx);

            if (homeLat != 0f && homeLng != 0f) {
                float dist = distanceMeters((double) homeLat, (double) homeLng, lat, lng);
                if (dist <= radius) return true;
            }
        }

        return false;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  GPS CONTROL — điều chỉnh GPS theo state
    // ══════════════════════════════════════════════════════════════════════════

    private void adjustGps(Context ctx, String state) {
        switch (state) {
            case AttendanceState.WAIT_CHECKIN_CONFIRM:
                // GPS 30-60s/lần nếu không có WiFi
                if (!checkWorkSignal(ctx).source.startsWith("wifi")) {
                    NativeGpsService.setInterval(ctx, 45_000L);
                } else {
                    NativeGpsService.stop(ctx);
                }
                break;

            case AttendanceState.WORKING:
                // Có WiFi → tắt GPS; không có WiFi → GPS backup 5p/lần
                if (checkWorkSignal(ctx).source.startsWith("wifi")) {
                    NativeGpsService.stop(ctx);
                } else {
                    NativeGpsService.setInterval(ctx, 5 * 60_000L);
                }
                break;

            case AttendanceState.MAYBE_LEFT_WORK:
                // GPS 1-3p để xác minh nhanh
                NativeGpsService.setInterval(ctx, 90_000L);
                break;

            case AttendanceState.WAIT_CHECKOUT_CONFIRM:
                // GPS 3-5p/lần
                NativeGpsService.setInterval(ctx, 4 * 60_000L);
                break;

            case AttendanceState.HOME:
            case AttendanceState.OUTSIDE:
            case AttendanceState.CHECKED_OUT:
                // Tắt GPS
                NativeGpsService.stop(ctx);
                break;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  RECOVERY — gọi khi app mở lại
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Xương cá tầng 6: Recovery
     * Gọi khi: WebView visible / app foreground / native service restart
     */
    public EvalResult runRecovery(Context ctx) {
        Log.d(TAG, "runRecovery()");

        checkDayRollover(ctx);

        SharedPreferences p = AttendanceState.prefs(ctx);
        boolean checkedIn  = p.getBoolean(AttendanceState.KEY_TODAY_CHECKED_IN, false);
        boolean checkedOut = p.getBoolean(AttendanceState.KEY_TODAY_CHECKED_OUT, false);
        long deadlineAt    = p.getLong(AttendanceState.KEY_CHECKOUT_DEADLINE_AT, 0);
        long now           = System.currentTimeMillis();

        // Đã check-in, chưa checkout, đã qua deadline → checkout bù
        if (checkedIn && !checkedOut && deadlineAt > 0 && now >= deadlineAt) {
            Log.d(TAG, "Recovery: past checkout deadline → checkout NOW");
            AttendanceState.setState(ctx, AttendanceState.WAIT_CHECKOUT_CONFIRM);
            return doCheckOut(ctx, "recovery");
        }

        // Đã check-in, chưa checkout, quá giờ tan ca nhưng chưa có deadline → nhắc
        if (checkedIn && !checkedOut) {
            long shiftEndMs = getShiftEndMs(ctx);
            if (shiftEndMs > 0 && now > shiftEndMs + 30 * 60_000L) {
                // Quá 30 phút sau tan ca mà chưa checkout
                String state = AttendanceState.getState(ctx);
                if (!state.equals(AttendanceState.WAIT_CHECKOUT_CONFIRM) &&
                    !state.equals(AttendanceState.CHECKED_OUT)) {
                    Log.d(TAG, "Recovery: overdue checkout → remind");
                    AttendanceNotifier.notifyCheckoutRemind(ctx);
                    AttendanceState.setPendingEvent(ctx,
                        AttendanceState.EVENT_CHECKOUT_REMIND, formatTime(now));
                }
            }
        }

        return evaluate(ctx, "recovery");
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private void checkDayRollover(Context ctx) {
        String todayKey = getTodayKey();
        SharedPreferences p = AttendanceState.prefs(ctx);
        String lastKey = p.getString(AttendanceState.KEY_TODAY_KEY, "");

        if (!todayKey.equals(lastKey)) {
            Log.d(TAG, "Day rollover: " + lastKey + " → " + todayKey + " — reset flags");
            p.edit()
                .putString(AttendanceState.KEY_TODAY_KEY, todayKey)
                .putBoolean(AttendanceState.KEY_TODAY_CHECKED_IN, false)
                .putBoolean(AttendanceState.KEY_TODAY_CHECKED_OUT, false)
                .remove(AttendanceState.KEY_CHECKIN_WINDOW_START)
                .remove(AttendanceState.KEY_CHECKIN_SIGNAL_ON_MS)
                .remove(AttendanceState.KEY_CHECKOUT_WINDOW_START)
                .remove(AttendanceState.KEY_CHECKOUT_DEADLINE_AT)
                .remove(AttendanceState.KEY_MAYBE_LEFT_SINCE)
                .apply();

            String state = AttendanceState.getState(ctx);
            if (state.equals(AttendanceState.CHECKED_OUT) ||
                state.equals(AttendanceState.WAIT_CHECKOUT_CONFIRM) ||
                state.equals(AttendanceState.MAYBE_LEFT_WORK)) {
                AttendanceState.setState(ctx, AttendanceState.OUTSIDE);
            }

            // Đặt lại alarm cho ngày mới
            AttendanceAlarmScheduler.get().scheduleForToday(ctx);
        }
    }

    private EvalResult openCheckoutWindow(Context ctx) {
        long now = System.currentTimeMillis();
        long checkoutMs = AttendanceState.checkoutMs(ctx);
        long deadlineAt = now + checkoutMs;

        AttendanceState.prefs(ctx).edit()
            .putLong(AttendanceState.KEY_CHECKOUT_WINDOW_START, now)
            .putLong(AttendanceState.KEY_CHECKOUT_DEADLINE_AT, deadlineAt)
            .apply();
        AttendanceState.setState(ctx, AttendanceState.WAIT_CHECKOUT_CONFIRM);

        // Đặt alarm deadline
        AttendanceAlarmScheduler.get().scheduleCheckoutDeadline(ctx, deadlineAt);

        EvalResult r = new EvalResult();
        r.oldState = AttendanceState.MAYBE_LEFT_WORK;
        r.newState = AttendanceState.WAIT_CHECKOUT_CONFIRM;
        r.action = "NONE";
        r.stateChanged = true;
        return r;
    }

    private void resetCheckinWindow(Context ctx) {
        AttendanceState.prefs(ctx).edit()
            .remove(AttendanceState.KEY_CHECKIN_WINDOW_START)
            .remove(AttendanceState.KEY_CHECKIN_SIGNAL_ON_MS)
            .apply();
    }

    private void resetCheckoutWindow(Context ctx) {
        AttendanceState.prefs(ctx).edit()
            .remove(AttendanceState.KEY_CHECKOUT_WINDOW_START)
            .remove(AttendanceState.KEY_CHECKOUT_DEADLINE_AT)
            .apply();
    }

    private void resetMaybeLeft(Context ctx) {
        AttendanceState.prefs(ctx).edit()
            .remove(AttendanceState.KEY_MAYBE_LEFT_SINCE)
            .apply();
    }

    // ─── WiFi ─────────────────────────────────────────────────────────────────
    public String getCurrentWifiSsid(Context ctx) {
        try {
            WifiManager wm = (WifiManager) ctx.getApplicationContext()
                .getSystemService(Context.WIFI_SERVICE);
            if (wm == null || !wm.isWifiEnabled()) return null;
            WifiInfo info = wm.getConnectionInfo();
            if (info == null) return null;
            String ssid = info.getSSID();
            if (ssid == null || ssid.equals("<unknown ssid>") || ssid.equals("\"\"")) return null;
            return ssid.replace("\"", "").trim();
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isInWifiList(String ssid, String listJson) {
        if (listJson == null || listJson.isEmpty() || ssid == null) return false;
        try {
            JSONArray arr = new JSONArray(listJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject item = arr.getJSONObject(i);
                String s = item.optString("ssid", "");
                if (s.equalsIgnoreCase(ssid)) return true;
            }
        } catch (Exception e) {
            // fallback: so sánh trực tiếp
            return listJson.contains(ssid);
        }
        return false;
    }

    // ─── GPS distance (Haversine) ─────────────────────────────────────────────
    public static float distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6371000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (float)(R * c);
    }

    // ─── Thời gian tan ca (epoch ms hôm nay) ─────────────────────────────────
    private long getShiftEndMs(Context ctx) {
        SharedPreferences p = AttendanceState.prefs(ctx);
        int hour = p.getInt(AttendanceState.KEY_SHIFT_END_HOUR, -1);
        int min  = p.getInt(AttendanceState.KEY_SHIFT_END_MIN, -1);
        if (hour < 0) return 0;

        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(java.util.Calendar.HOUR_OF_DAY, hour);
        cal.set(java.util.Calendar.MINUTE, min);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    // ─── Format HH:mm ─────────────────────────────────────────────────────────
    public static String formatTime(long ms) {
        java.util.Calendar c = java.util.Calendar.getInstance();
        c.setTimeInMillis(ms);
        return String.format("%02d:%02d", c.get(java.util.Calendar.HOUR_OF_DAY),
            c.get(java.util.Calendar.MINUTE));
    }

    // ─── Today key YYYY-MM-DD ─────────────────────────────────────────────────
    public static String getTodayKey() {
        java.util.Calendar c = java.util.Calendar.getInstance();
        return String.format("%04d-%02d-%02d",
            c.get(java.util.Calendar.YEAR),
            c.get(java.util.Calendar.MONTH) + 1,
            c.get(java.util.Calendar.DAY_OF_MONTH));
    }

    // ─── SignalResult ─────────────────────────────────────────────────────────
    public static class SignalResult {
        public boolean hasSignal = false;
        public String  source    = "";
    }
}
