package com.chamcongpro.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * ════════════════════════════════════════════════════════
 *  MODULE 8: CAPACITOR BRIDGE
 *  Xương cá: JS ↔ Native
 * ════════════════════════════════════════════════════════
 *
 *  JS gọi qua:
 *    Capacitor.Plugins.AttendanceBrain.xxx()
 *  hoặc qua wrapper:
 *    window.ccNative.brain.xxx()
 *
 *  Methods:
 *    syncConfig(config)   — JS đồng bộ cấu hình xuống native
 *    start()              — bật bộ não (register motion, set alarms)
 *    stop()               — tắt bộ não
 *    getState()           — đọc state hiện tại từ native
 *    setState(state)      — JS ghi đè state (dùng khi JS làm recovery)
 *    runRecovery()        — chạy recovery check
 *    consumePendingEvent()— đọc và xoá pending event
 *    requestOneShotGps()  — yêu cầu GPS oneshot
 *    updateGpsResult(lat,lng,accuracy) — JS cập nhật GPS result vào native
 */
@CapacitorPlugin(name = "AttendanceBrain")
public class AttendanceBrainPlugin extends Plugin {

    private static final String TAG = "BrainPlugin";

    // ══════════════════════════════════════════════════════════════════════════
    //  syncConfig — JS đồng bộ toàn bộ config xuống SharedPreferences
    // ══════════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void syncConfig(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor ed = AttendanceState.prefs(ctx).edit();

        try {
            ed.putBoolean(AttendanceState.KEY_ENABLED,
                call.getBoolean("enabled", false));
            ed.putInt(AttendanceState.KEY_CHECKIN_MIN,
                call.getInt("checkinMin", 20));
            ed.putInt(AttendanceState.KEY_CHECKOUT_MIN,
                call.getInt("checkoutMin", 60));
            ed.putInt(AttendanceState.KEY_ALARM_BEFORE_MIN,
                call.getInt("alarmBeforeMin", 10));

            // Giờ vào ca
            JSObject shiftIn = call.getObject("shiftStart");
            if (shiftIn != null) {
                ed.putInt(AttendanceState.KEY_SHIFT_START_HOUR, shiftIn.getInteger("hour", -1));
                ed.putInt(AttendanceState.KEY_SHIFT_START_MIN,  shiftIn.getInteger("min", 0));
            }

            // Giờ tan ca
            JSObject shiftOut = call.getObject("shiftEnd");
            if (shiftOut != null) {
                ed.putInt(AttendanceState.KEY_SHIFT_END_HOUR, shiftOut.getInteger("hour", -1));
                ed.putInt(AttendanceState.KEY_SHIFT_END_MIN,  shiftOut.getInteger("min", 0));
            }

            // WiFi công ty
            JSObject workWifi = call.getArray("workWifi") != null
                ? null : call.getObject("workWifi");
            String workWifiJson = call.getString("workWifiJson", "[]");
            ed.putString(AttendanceState.KEY_WORK_WIFI_LIST, workWifiJson);

            // WiFi nhà
            String homeWifiJson = call.getString("homeWifiJson", "[]");
            ed.putString(AttendanceState.KEY_HOME_WIFI_LIST, homeWifiJson);

            // GPS công ty
            JSObject workGps = call.getObject("workGps");
            if (workGps != null) {
                ed.putFloat(AttendanceState.KEY_WORK_GPS_LAT,
                    (float) workGps.getDouble("lat", 0));
                ed.putFloat(AttendanceState.KEY_WORK_GPS_LNG,
                    (float) workGps.getDouble("lng", 0));
                ed.putFloat(AttendanceState.KEY_WORK_GPS_RADIUS,
                    (float) workGps.getDouble("radius", 100));
            }

            // GPS nhà
            JSObject homeGps = call.getObject("homeGps");
            if (homeGps != null) {
                ed.putFloat(AttendanceState.KEY_HOME_GPS_LAT,
                    (float) homeGps.getDouble("lat", 0));
                ed.putFloat(AttendanceState.KEY_HOME_GPS_LNG,
                    (float) homeGps.getDouble("lng", 0));
                ed.putFloat(AttendanceState.KEY_HOME_GPS_RADIUS,
                    (float) homeGps.getDouble("radius", 120));
            }

            ed.apply();
            Log.d(TAG, "syncConfig OK");

            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "syncConfig error: " + e.getMessage());
            call.reject("syncConfig error: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  start — bật bộ não nền
    // ══════════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        try {
            AttendanceState.prefs(ctx).edit()
                .putBoolean(AttendanceState.KEY_ENABLED, true)
                .apply();

            // Đăng ký motion transitions
            MotionTransitionManager.get().register(ctx);

            // Đặt alarm cho hôm nay
            AttendanceAlarmScheduler.get().scheduleForToday(ctx);

            // Chạy evaluate ngay lần đầu
            new Thread(() ->
                AttendanceBrain.get().evaluate(ctx, "plugin:start"),
                "Brain-start"
            ).start();

            Log.d(TAG, "start() OK");
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("motionReady", true);
            ret.put("alarmReady", true);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "start error: " + e.getMessage());
            call.reject("start error: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  stop — tắt bộ não nền
    // ══════════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        try {
            AttendanceState.prefs(ctx).edit()
                .putBoolean(AttendanceState.KEY_ENABLED, false)
                .apply();

            MotionTransitionManager.get().unregister(ctx);
            AttendanceAlarmScheduler.get().cancelAll(ctx);
            NativeGpsService.stop(ctx);

            Log.d(TAG, "stop() OK");
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("stop error: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  getState — đọc state native hiện tại
    // ══════════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void getState(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences p = AttendanceState.prefs(ctx);

        JSObject ret = new JSObject();
        ret.put("state",         AttendanceState.getState(ctx));
        ret.put("todayCheckedIn",  p.getBoolean(AttendanceState.KEY_TODAY_CHECKED_IN, false));
        ret.put("todayCheckedOut", p.getBoolean(AttendanceState.KEY_TODAY_CHECKED_OUT, false));
        ret.put("motionStatus",  p.getString(AttendanceState.KEY_MOTION_STATUS, "UNKNOWN"));
        ret.put("enabled",       p.getBoolean(AttendanceState.KEY_ENABLED, false));
        ret.put("stateChangedAt", p.getLong(AttendanceState.KEY_STATE_CHANGED_AT, 0));
        ret.put("checkoutDeadlineAt", p.getLong(AttendanceState.KEY_CHECKOUT_DEADLINE_AT, 0));

        call.resolve(ret);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  setState — JS ghi đè state (dùng cho recovery JS-side)
    // ══════════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void setState(PluginCall call) {
        String state = call.getString("state");
        if (state == null) { call.reject("state required"); return; }

        AttendanceState.setState(getContext(), state);

        // Đồng bộ các flag nếu có
        Boolean checkedIn  = call.getBoolean("todayCheckedIn", null);
        Boolean checkedOut = call.getBoolean("todayCheckedOut", null);
        SharedPreferences.Editor ed = AttendanceState.prefs(getContext()).edit();
        if (checkedIn  != null) ed.putBoolean(AttendanceState.KEY_TODAY_CHECKED_IN,  checkedIn);
        if (checkedOut != null) ed.putBoolean(AttendanceState.KEY_TODAY_CHECKED_OUT, checkedOut);
        ed.apply();

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  runRecovery — xương cá tầng 6: Recovery
    // ══════════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void runRecovery(PluginCall call) {
        Context ctx = getContext();
        new Thread(() -> {
            AttendanceBrain.EvalResult result =
                AttendanceBrain.get().runRecovery(ctx);

            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("state", result.newState);
            ret.put("action", result.action);
            ret.put("stateChanged", result.stateChanged);
            call.resolve(ret);

        }, "Brain-recovery").start();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  consumePendingEvent — JS đọc pending event khi mở app
    // ══════════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void consumePendingEvent(PluginCall call) {
        String event = AttendanceState.consumePendingEvent(getContext());

        JSObject ret = new JSObject();
        if (event != null) {
            String[] parts = event.split("\\|", 2);
            ret.put("hasEvent", true);
            ret.put("type",   parts[0]);
            ret.put("detail", parts.length > 1 ? parts[1] : "");
        } else {
            ret.put("hasEvent", false);
        }
        call.resolve(ret);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  requestOneShotGps — JS yêu cầu GPS ngắn hạn
    // ══════════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void requestOneShotGps(PluginCall call) {
        NativeGpsService.requestOneShot(getContext());
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  updateGpsResult — JS cập nhật GPS reading vào native SharedPreferences
    // ══════════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void updateGpsResult(PluginCall call) {
        double lat = call.getDouble("lat", 0);
        double lng = call.getDouble("lng", 0);
        long   ts  = System.currentTimeMillis();

        AttendanceState.prefs(getContext()).edit()
            .putLong(AttendanceState.KEY_LAST_GPS_LAT, Double.doubleToLongBits(lat))
            .putLong(AttendanceState.KEY_LAST_GPS_LNG, Double.doubleToLongBits(lng))
            .putLong(AttendanceState.KEY_LAST_GPS_AT, ts)
            .apply();

        // Evaluate ngay sau khi có GPS mới
        Context ctx = getContext();
        new Thread(() ->
            AttendanceBrain.get().evaluate(ctx, "plugin:gps_result"),
            "Brain-gps"
        ).start();

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  scheduleAlarms — JS yêu cầu đặt lại alarm (ví dụ sau khi đổi giờ ca)
    // ══════════════════════════════════════════════════════════════════════════

    @PluginMethod
    public void scheduleAlarms(PluginCall call) {
        AttendanceAlarmScheduler.get().scheduleForToday(getContext());
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }
}
