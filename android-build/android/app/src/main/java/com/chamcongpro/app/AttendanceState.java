package com.chamcongpro.app;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * ════════════════════════════════════════════════════════
 *  MODULE 1: STATE MACHINE — Hằng số + SharedPreferences
 *  Xương cá tầng 5: State Machine
 * ════════════════════════════════════════════════════════
 *
 *  7 trạng thái của bộ não chấm công:
 *
 *  HOME                  → Có bằng chứng đang ở nhà (WiFi nhà / GPS nhà)
 *  OUTSIDE               → Không ở công ty, không xác định là nhà
 *  WAIT_CHECKIN_CONFIRM  → Đã phát hiện tín hiệu công ty, đang đếm checkinMin
 *  WORKING               → Đã check-in, còn trong ca
 *  MAYBE_LEFT_WORK       → Đang WORKING nhưng mất tín hiệu công ty, đang xác minh
 *  WAIT_CHECKOUT_CONFIRM → Đã xác nhận nghiêng về ngoài công ty, đang đếm checkoutMin
 *  CHECKED_OUT           → Đã checkout, GPS tắt
 */
public class AttendanceState {

    // ─── Tên SharedPreferences ───────────────────────────────────────────────
    public static final String PREFS_NAME = "cc_brain_state";

    // ─── 7 trạng thái ────────────────────────────────────────────────────────
    public static final String HOME                  = "HOME";
    public static final String OUTSIDE               = "OUTSIDE";
    public static final String WAIT_CHECKIN_CONFIRM  = "WAIT_CHECKIN_CONFIRM";
    public static final String WORKING               = "WORKING";
    public static final String MAYBE_LEFT_WORK       = "MAYBE_LEFT_WORK";
    public static final String WAIT_CHECKOUT_CONFIRM = "WAIT_CHECKOUT_CONFIRM";
    public static final String CHECKED_OUT           = "CHECKED_OUT";

    // ─── Keys lưu trong SharedPreferences ───────────────────────────────────
    static final String KEY_STATE                  = "state";
    static final String KEY_STATE_CHANGED_AT       = "stateChangedAt";
    static final String KEY_TODAY_KEY              = "todayKey";
    static final String KEY_TODAY_CHECKED_IN       = "todayCheckedIn";
    static final String KEY_TODAY_CHECKED_OUT      = "todayCheckedOut";
    static final String KEY_CHECKIN_WINDOW_START   = "checkinWindowStart";
    static final String KEY_CHECKIN_SIGNAL_ON_MS   = "checkinSignalOnMs";
    static final String KEY_CHECKOUT_WINDOW_START  = "checkoutWindowStart";
    static final String KEY_CHECKOUT_DEADLINE_AT   = "checkoutDeadlineAt";
    static final String KEY_CHECKOUT_SIGNAL_ON_MS  = "checkoutSignalOnMs";
    static final String KEY_MAYBE_LEFT_SINCE       = "maybeLeftSince";
    static final String KEY_LAST_WIFI_SSID         = "lastWifiSsid";
    static final String KEY_LAST_GPS_LAT           = "lastGpsLat";
    static final String KEY_LAST_GPS_LNG           = "lastGpsLng";
    static final String KEY_LAST_GPS_AT            = "lastGpsAt";
    static final String KEY_MOTION_STATUS          = "motionStatus";
    static final String KEY_MOTION_LAST_EVENT_AT   = "motionLastEventAt";
    static final String KEY_MOTION_STALE_LOG_AT    = "motionStaleLogAt";
    static final String KEY_PENDING_EVENT          = "pendingEvent";
    static final String KEY_PENDING_EVENT_AT       = "pendingEventAt";

    // ─── Config keys (đồng bộ từ JS) ─────────────────────────────────────────
    static final String KEY_ENABLED                = "enabled";
    static final String KEY_CHECKIN_MIN            = "checkinMin";
    static final String KEY_CHECKOUT_MIN           = "checkoutMin";
    static final String KEY_WORK_WIFI_LIST         = "workWifiList";
    static final String KEY_HOME_WIFI_LIST         = "homeWifiList";
    static final String KEY_WORK_GPS_LAT           = "workGpsLat";
    static final String KEY_WORK_GPS_LNG           = "workGpsLng";
    static final String KEY_WORK_GPS_RADIUS        = "workGpsRadius";
    static final String KEY_HOME_GPS_LAT           = "homeGpsLat";
    static final String KEY_HOME_GPS_LNG           = "homeGpsLng";
    static final String KEY_HOME_GPS_RADIUS        = "homeGpsRadius";
    static final String KEY_SHIFT_START_HOUR       = "shiftStartHour";
    static final String KEY_SHIFT_START_MIN        = "shiftStartMin";
    static final String KEY_SHIFT_END_HOUR         = "shiftEndHour";
    static final String KEY_SHIFT_END_MIN          = "shiftEndMin";
    static final String KEY_ALARM_BEFORE_MIN       = "alarmBeforeMin";

    // ─── Motion status values ─────────────────────────────────────────────────
    public static final String MOTION_UNKNOWN = "UNKNOWN";
    public static final String MOTION_STILL   = "STILL";
    public static final String MOTION_MOVING  = "MOVING";

    // ─── Pending event types ──────────────────────────────────────────────────
    public static final String EVENT_CHECKED_IN         = "CHECKED_IN";
    public static final String EVENT_CHECKED_OUT        = "CHECKED_OUT";
    public static final String EVENT_CHECKOUT_REMIND    = "CHECKOUT_REMIND";
    public static final String EVENT_PERMISSION_ERROR   = "PERMISSION_ERROR";

    // ─── Helper: lấy SharedPreferences ───────────────────────────────────────
    public static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    // ─── Helper: đọc state hiện tại ──────────────────────────────────────────
    public static String getState(Context ctx) {
        return prefs(ctx).getString(KEY_STATE, OUTSIDE);
    }

    // ─── Helper: lưu state ───────────────────────────────────────────────────
    public static void setState(Context ctx, String newState) {
        String oldState = getState(ctx);
        prefs(ctx).edit()
            .putString(KEY_STATE, newState)
            .putLong(KEY_STATE_CHANGED_AT, System.currentTimeMillis())
            .apply();
        if (oldState == null) oldState = "";
        if (newState == null) newState = "";
        if (!oldState.equals(newState)) {
            NativeAuditTrail.log(ctx, "STATE", oldState + " -> " + newState, "transition");
        } else {
            NativeAuditTrail.log(ctx, "STATE", newState, "state set same");
        }
    }

    // ─── Helper: lưu pending event để JS đọc khi mở app ─────────────────────
    public static void setPendingEvent(Context ctx, String eventType, String detail) {
        prefs(ctx).edit()
            .putString(KEY_PENDING_EVENT, eventType + "|" + detail)
            .putLong(KEY_PENDING_EVENT_AT, System.currentTimeMillis())
            .apply();
        NativeAuditTrail.log(ctx, "EVENT", String.valueOf(eventType), String.valueOf(detail));
    }

    // ─── Helper: đọc và xoá pending event ────────────────────────────────────
    public static String consumePendingEvent(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String event = p.getString(KEY_PENDING_EVENT, null);
        if (event != null) {
            p.edit().remove(KEY_PENDING_EVENT).remove(KEY_PENDING_EVENT_AT).apply();
        }
        return event;
    }

    // ─── Helper: kiểm tra config hợp lệ ──────────────────────────────────────
    public static boolean isEnabled(Context ctx) {
        return prefs(ctx).getBoolean(KEY_ENABLED, false);
    }

    // ─── Helper: checkinMin / checkoutMin ────────────────────────────────────
    public static long checkinMs(Context ctx) {
        int min = prefs(ctx).getInt(KEY_CHECKIN_MIN, 20);
        return Math.max(min, 5) * 60_000L;
    }

    public static long checkoutMs(Context ctx) {
        int min = prefs(ctx).getInt(KEY_CHECKOUT_MIN, 60);
        return Math.max(min, 5) * 60_000L;
    }

    // ─── Helper: debounce MAYBE_LEFT_WORK → WAIT_CHECKOUT_CONFIRM (90 giây) ──
    public static final long MAYBE_LEFT_DEBOUNCE_MS = 90_000L;

    // ─── Helper: GPS radius công ty mặc định (m) ─────────────────────────────
    public static float workGpsRadius(Context ctx) {
        return prefs(ctx).getFloat(KEY_WORK_GPS_RADIUS, 100f);
    }

    // ─── Helper: GPS radius nhà mặc định (m) ─────────────────────────────────
    public static float homeGpsRadius(Context ctx) {
        return prefs(ctx).getFloat(KEY_HOME_GPS_RADIUS, 120f);
    }
}
