package com.chamcongpro.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.telephony.CellIdentityGsm;
import android.telephony.CellIdentityLte;
import android.telephony.CellIdentityWcdma;
import android.telephony.CellInfo;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoWcdma;
import android.telephony.TelephonyManager;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * ChamCongNativePlugin — Capacitor plugin tùy chỉnh cho Chấm Công Pro
 * Hỗ trợ:
 *   - sendNotification: gửi thông báo ngay lập tức
 *   - scheduleNotification: lên lịch thông báo tương lai (AlarmManager)
 *   - cancelNotification: hủy thông báo đã lên lịch
 *   - getPendingNotifications: lấy danh sách thông báo đang chờ
 *   - requestPermission: xin quyền POST_NOTIFICATIONS (Android 13+)
 */
@CapacitorPlugin(
    name = "ChamCongNative",
    permissions = {
        @Permission(
            alias = "postNotifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        ),
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        )
    }
)
public class ChamCongNativePlugin extends Plugin {

    private static final String CHANNEL_ID = "chamcongpro_main";
    private static final String CHANNEL_NAME = "Chấm Công Pro";
    private static final String CHANNEL_DESC = "Thông báo chấm công, nhắc ca làm việc";
    private static final String ATTENDANCE_ALERT_CHANNEL_ID = "chamcongpro_attendance_alert";
    private static final String PREFS_NAME = "cc_pending_notifs";
    private static final String PREFS_KEY = "pending_ids";

    @Override
    public void load() {
        android.util.Log.d("ChamCongNative", ">>> Plugin ChamCongNative LOADED OK <<<");
        createNotificationChannel();
        android.util.Log.d("ChamCongNative", ">>> Notification channel created <<<");
    }

    /** Tạo notification channel (bắt buộc Android 8+) */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESC);
            channel.enableVibration(true);
            channel.setShowBadge(true);
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
                createAttendanceAlertChannel(nm);
            }
        }
    }

    private void createAttendanceAlertChannel(NotificationManager nm) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || nm == null) return;
        NotificationChannel channel = new NotificationChannel(
            ATTENDANCE_ALERT_CHANNEL_ID,
            "Chấm công thành công",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Thông báo bật lên khi tự động vào ca hoặc ra ca thành công");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 350, 120, 350});
        channel.setShowBadge(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
    }

    private boolean isAttendanceAlertId(int id) {
        return id == 1001 || id == 1002 || id == 2001 || id == 2002
            || id == 2003 || id == 2004 || id == 9101 || id == 9102;
    }

    private String notificationChannelForId(int id) {
        return isAttendanceAlertId(id) ? ATTENDANCE_ALERT_CHANNEL_ID : CHANNEL_ID;
    }

    /** Gửi thông báo ngay lập tức */
    @PluginMethod
    public void sendNotification(PluginCall call) {
        String title = call.getString("title", "Chấm Công Pro");
        String body  = call.getString("body", "");
        int    id    = call.getInt("id", (int)(System.currentTimeMillis() % 100000));
        String channelId = notificationChannelForId(id);

        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) createAttendanceAlertChannel(nm);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(isAttendanceAlertId(id) ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_HIGH)
            .setCategory(isAttendanceAlertId(id) ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setTicker(title)
            .setVibrate(isAttendanceAlertId(id) ? new long[]{0, 350, 120, 350} : null)
            .setAutoCancel(true)
            .setDefaults(NotificationCompat.DEFAULT_ALL);

        // Tap notification → mở app
        Intent launchIntent = getContext().getPackageManager()
            .getLaunchIntentForPackage(getContext().getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                getContext(), id, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            builder.setContentIntent(pendingIntent);
            if (isAttendanceAlertId(id)) {
                builder.setFullScreenIntent(pendingIntent, true);
            }
        }

        if (nm != null) nm.notify(id, builder.build());

        JSObject ret = new JSObject();
        ret.put("id", id);
        call.resolve(ret);
    }

    /** Lên lịch thông báo trong tương lai dùng AlarmManager */
    @PluginMethod
    public void scheduleNotification(PluginCall call) {
        String title    = call.getString("title", "Chấm Công Pro");
        String body     = call.getString("body", "");
        int    id       = call.getInt("id", (int)(System.currentTimeMillis() % 100000));
        long   atMillis = call.getLong("at", 0L); // epoch millis

        if (atMillis <= 0) {
            call.reject("Missing or invalid 'at' timestamp");
            return;
        }

        Intent intent = new Intent(getContext(), NotificationReceiver.class);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("id", id);
        intent.putExtra("channelId", notificationChannelForId(id));
        // Truyền dateKey + job để NotificationReceiver validate ca trước khi hiện thông báo
        String dateKey = call.getString("dateKey", "");
        String job     = call.getString("job", "");
        if (dateKey != null && !dateKey.isEmpty()) intent.putExtra("dateKey", dateKey);
        if (job != null && !job.isEmpty())         intent.putExtra("job", job);
        String extraData = call.getString("data", "");
        if (extraData != null && !extraData.isEmpty()) intent.putExtra("data", extraData);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(getContext(), id, intent, flags);

        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            try {
                // Android 12+ (API 31): cần kiểm tra quyền SCHEDULE_EXACT_ALARM
                boolean canExact = true;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    canExact = am.canScheduleExactAlarms();
                }

                if (canExact && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    // Fallback: không chính xác tuyệt đối nhưng không crash
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    am.setExact(AlarmManager.RTC_WAKEUP, atMillis, pi);
                } else {
                    am.set(AlarmManager.RTC_WAKEUP, atMillis, pi);
                }
            } catch (SecurityException se) {
                android.util.Log.w("ChamCongNative", "Không có quyền exact alarm, dùng fallback: " + se.getMessage());
                // Fallback an toàn
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi);
                    } else {
                        am.set(AlarmManager.RTC_WAKEUP, atMillis, pi);
                    }
                } catch (Exception e2) {
                    android.util.Log.e("ChamCongNative", "scheduleNotification fallback lỗi: " + e2.getMessage());
                }
            }
        }

        // Lưu id vào SharedPreferences để getPending có thể trả về
        savePendingId(id, atMillis, title, body);

        JSObject ret = new JSObject();
        ret.put("id", id);
        call.resolve(ret);
    }

    /** Hủy thông báo đã lên lịch */
    @PluginMethod
    public void cancelNotification(PluginCall call) {
        int id = call.getInt("id", -1);
        if (id < 0) { call.reject("Missing id"); return; }

        cancelScheduledNotificationId(id);
        removePendingId(id);

        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    /** Lấy danh sách thông báo đang chờ */
    @PluginMethod
    public void getPendingNotifications(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> raw = prefs.getStringSet(PREFS_KEY, new HashSet<>());
        JSArray arr = new JSArray();
        for (String entry : raw) {
            try {
                JSONObject obj = new JSONObject(entry);
                arr.put(obj);
            } catch (Exception e) { /* skip invalid */ }
        }
        JSObject ret = new JSObject();
        ret.put("notifications", arr);
        call.resolve(ret);
    }

    /** Xin quyền POST_NOTIFICATIONS (Android 13+) */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("postNotifications", call, "permissionCallback");
        } else {
            // Dưới Android 13 không cần xin quyền
            JSObject ret = new JSObject();
            ret.put("postNotifications", "granted");
            call.resolve(ret);
        }
    }

    /** Kiểm tra và mở Settings để cấp quyền SCHEDULE_EXACT_ALARM (Android 12+) */
    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (am != null && am.canScheduleExactAlarms()) {
                // Đã có quyền rồi
                JSObject ret = new JSObject();
                ret.put("granted", true);
                call.resolve(ret);
            } else {
                // Mở màn hình Settings > Alarms & Reminders cho app này
                Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("granted", false);
                ret.put("openedSettings", true);
                call.resolve(ret);
            }
        } else {
            // Dưới Android 12 không cần quyền này
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        }
    }

    /** Kiểm tra trạng thái quyền exact alarm (không mở Settings) */
    @PluginMethod
    public void checkLocationPermission(PluginCall call) {
        JSObject ret = new JSObject();
        putLocationPermissionState(ret);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestLocationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || hasLocationPermission()) {
            JSObject ret = new JSObject();
            putLocationPermissionState(ret);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("location", call, "permissionCallback");
    }

    @PluginMethod
    public void checkExactAlarmPermission(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            granted = (am != null && am.canScheduleExactAlarms());
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    // ══════════════════════════════════════════════════════════════
    //  NATIVE GPS SERVICE — chạy ngầm kể cả khi app bị kill
    // ══════════════════════════════════════════════════════════════

    /**
     * Lưu cấu hình GPS vào SharedPreferences để NativeGpsService đọc.
     * Gọi từ JS mỗi khi user thay đổi vị trí / bán kính / delay.
     * Params: lat(double), lng(double), radius(float), checkinMin(int), checkoutMin(int)
     */
    @PluginMethod
    public void setGpsConfig(PluginCall call) {
        double lat        = call.getDouble("lat", 0.0);
        double lng        = call.getDouble("lng", 0.0);
        float  radius     = call.getFloat("radius", 15f);
        int    checkinMin = call.getInt("checkinMin", 20);
        int    checkoutMin= call.getInt("checkoutMin", 80);
        int    scheduleInMin = call.getInt("scheduleInMin", 8 * 60);
        int    scheduleOutMin = call.getInt("scheduleOutMin", 17 * 60);
        boolean tightCompanyGps = Boolean.TRUE.equals(call.getBoolean("tightCompanyGps", false));
        boolean smartAttendanceMode = Boolean.TRUE.equals(call.getBoolean("smartAttendanceMode", false));
        boolean enabled   = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        boolean hasLocation = Boolean.TRUE.equals(call.getBoolean("hasLocation", true));
        boolean validLocation = hasLocation && isValidGpsPair(lat, lng);
        String smartState = call.getString("smartState", "");
        String smartHomeWifi = call.getString("smartHomeWifi", "[]");
        String smartHomeBts = call.getString("smartHomeBts", "[]");
        String smartHomeGps = call.getString("smartHomeGps", "null");
        String smartWorkWifi = call.getString("smartWorkWifi", "[]");
        String smartWorkBts = call.getString("smartWorkBts", "[]");
        String smartWorkGps = call.getString("smartWorkGps", "null");
        String userLang = call.getString("userLang", "vi");
        long smartCheckinWindowStart = Math.round(call.getDouble("smartCheckinWindowStart", 0.0));
        long smartCheckoutWindowStart = Math.round(call.getDouble("smartCheckoutWindowStart", 0.0));
        long smartLastCheckoutAt = Math.round(call.getDouble("smartLastCheckoutAt", 0.0));
        long smartCycleReadyAt = Math.round(call.getDouble("smartCycleReadyAt", 0.0));
        long smartGpsWakeupAt = Math.round(call.getDouble("smartGpsWakeupAt", 0.0));

        SharedPreferences.Editor editor = getContext()
            .getSharedPreferences(NativeGpsService.GPS_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("userLang", userLang)
            .putInt("checkinMin",   checkinMin)
            .putInt("checkoutMin",  checkoutMin)
            .putInt("scheduleInMin", scheduleInMin)
            .putInt("scheduleOutMin", scheduleOutMin)
            .putBoolean("tightCompanyGps", tightCompanyGps)
            .putBoolean("smartAttendanceMode", smartAttendanceMode)
            .putString("smartState", smartState)
            .putLong("smartCheckinWindowStart", smartCheckinWindowStart)
            .putLong("smartCheckoutWindowStart", smartCheckoutWindowStart)
            .putLong("smartLastCheckoutAt", smartLastCheckoutAt)
            .putLong("smartCycleReadyAt", smartCycleReadyAt)
            .putLong("smartGpsWakeupAt", smartGpsWakeupAt)
            .putString("smartHomeWifi", smartHomeWifi)
            .putString("smartHomeBts", smartHomeBts)
            .putString("smartHomeGps", smartHomeGps)
            .putString("smartWorkWifi", smartWorkWifi)
            .putString("smartWorkBts", smartWorkBts)
            .putString("smartWorkGps", smartWorkGps)
            .putBoolean("insideScheduleOut", false)
            .putLong("smartJsAliveTs", System.currentTimeMillis()) // JS heartbeat
            .putBoolean("enabled",  enabled && validLocation);
        if (validLocation) {
            editor
                .putLong("lat",     Double.doubleToLongBits(lat))
                .putLong("lng",     Double.doubleToLongBits(lng))
                .putFloat("radius", radius);
        }
        editor.apply();

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    /**
     * Khởi động NativeGpsService (foreground service GPS chạy ngầm).
     * Params tùy chọn: lat, lng, radius, checkinMin, checkoutMin — sẽ ghi đè config cũ nếu có.
     */
    @PluginMethod
    public void startNativeGps(PluginCall call) {
        if (!hasLocationPermission()) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("missingPermission", true);
            ret.put("reason", "location-permission-required");
            call.resolve(ret);
            return;
        }

        // Cập nhật config nếu có truyền tham số
        if (call.getData().has("lat")) {
            double lat        = call.getDouble("lat", 0.0);
            double lng        = call.getDouble("lng", 0.0);
            float  radius     = call.getFloat("radius", 15f);
            int    checkinMin = call.getInt("checkinMin", 20);
            int    checkoutMin= call.getInt("checkoutMin", 80);
            int    scheduleInMin = call.getInt("scheduleInMin", 8 * 60);
            int    scheduleOutMin = call.getInt("scheduleOutMin", 17 * 60);
            boolean tightCompanyGps = Boolean.TRUE.equals(call.getBoolean("tightCompanyGps", false));
            boolean smartAttendanceMode = Boolean.TRUE.equals(call.getBoolean("smartAttendanceMode", false));
            boolean hasLocation = Boolean.TRUE.equals(call.getBoolean("hasLocation", true));
            boolean validLocation = hasLocation && isValidGpsPair(lat, lng);
            String smartState = call.getString("smartState", "");
            String smartHomeWifi = call.getString("smartHomeWifi", "[]");
            String smartHomeBts = call.getString("smartHomeBts", "[]");
            String smartHomeGps = call.getString("smartHomeGps", "null");
            String smartWorkWifi = call.getString("smartWorkWifi", "[]");
            String smartWorkBts = call.getString("smartWorkBts", "[]");
            String smartWorkGps = call.getString("smartWorkGps", "null");
            String userLang = call.getString("userLang", "vi");
            long smartCheckinWindowStart = Math.round(call.getDouble("smartCheckinWindowStart", 0.0));
            long smartCheckoutWindowStart = Math.round(call.getDouble("smartCheckoutWindowStart", 0.0));
            long smartLastCheckoutAt = Math.round(call.getDouble("smartLastCheckoutAt", 0.0));
            long smartCycleReadyAt = Math.round(call.getDouble("smartCycleReadyAt", 0.0));
            long smartGpsWakeupAt = Math.round(call.getDouble("smartGpsWakeupAt", 0.0));
            SharedPreferences.Editor editor = getContext()
                .getSharedPreferences(NativeGpsService.GPS_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString("userLang", userLang)
                .putInt("checkinMin",  checkinMin)
                .putInt("checkoutMin", checkoutMin)
                .putInt("scheduleInMin", scheduleInMin)
                .putInt("scheduleOutMin", scheduleOutMin)
                .putBoolean("tightCompanyGps", tightCompanyGps)
                .putBoolean("smartAttendanceMode", smartAttendanceMode)
                .putString("smartState", smartState)
                .putLong("smartCheckinWindowStart", smartCheckinWindowStart)
                .putLong("smartCheckoutWindowStart", smartCheckoutWindowStart)
                .putLong("smartLastCheckoutAt", smartLastCheckoutAt)
                .putLong("smartCycleReadyAt", smartCycleReadyAt)
                .putLong("smartGpsWakeupAt", smartGpsWakeupAt)
                .putString("smartHomeWifi", smartHomeWifi)
                .putString("smartHomeBts", smartHomeBts)
                .putString("smartHomeGps", smartHomeGps)
                .putString("smartWorkWifi", smartWorkWifi)
                .putString("smartWorkBts", smartWorkBts)
                .putString("smartWorkGps", smartWorkGps)
                .putBoolean("insideScheduleOut", false)
                .putLong("smartJsAliveTs", System.currentTimeMillis())
                .putBoolean("enabled", validLocation);
            if (validLocation) {
                editor
                    .putLong("lat",     Double.doubleToLongBits(lat))
                    .putLong("lng",     Double.doubleToLongBits(lng))
                    .putFloat("radius", radius);
            }
            editor.apply();
        } else {
            // Chỉ đánh dấu enabled = true
            getContext().getSharedPreferences(NativeGpsService.GPS_PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean("enabled", true).putBoolean("smartAttendanceMode", false).apply();
        }

        Intent svcIntent = new Intent(getContext(), NativeGpsService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(svcIntent);
        } else {
            getContext().startService(svcIntent);
        }

        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    private boolean hasLocationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return getContext().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || getContext().checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void putLocationPermissionState(JSObject ret) {
        boolean fine = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || getContext().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || getContext().checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        ret.put("location", (fine || coarse) ? "granted" : "denied");
        ret.put("fineLocation", fine ? "granted" : "denied");
        ret.put("coarseLocation", coarse ? "granted" : "denied");
    }

    /** Dừng NativeGpsService */
    @PluginMethod
    public void stopNativeGps(PluginCall call) {
        getContext().getSharedPreferences(NativeGpsService.GPS_PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean("enabled", false).putBoolean("smartAttendanceMode", false).apply();

        getContext().stopService(new Intent(getContext(), NativeGpsService.class));

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    /**
     * JS là sổ chấm công chính. Mỗi lần JS lưu attData, nó gửi trạng thái hôm nay
     * và hôm qua sang đây để NativeGpsService không tự chấm/trùng thông báo.
     */
    @PluginMethod
    public void setAttendanceState(PluginCall call) {
        SharedPreferences.Editor editor = getContext()
            .getSharedPreferences(NativeGpsService.STATE_PREFS, Context.MODE_PRIVATE)
            .edit();
        writeAttendanceState(editor, call, "today");
        writeAttendanceState(editor, call, "yesterday");
        editor.putLong("lastOutTs", Math.round(call.getDouble("lastOutTs", 0.0)));
        editor.apply();

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    /**
     * Đọc danh sách bản ghi chấm công tự động từ NativeGpsService.
     * JS gọi khi app mở để merge vào localStorage.
     * Returns: { records: [{type:"IN"|"OUT", date:"2026-4-8", time:"08:32", ts:...}] }
     */
    @PluginMethod
    public void getNativeAttendance(PluginCall call) {
        String raw = getContext()
            .getSharedPreferences(NativeGpsService.ATT_PREFS, Context.MODE_PRIVATE)
            .getString(NativeGpsService.ATT_KEY, "[]");
        try {
            JSArray arr = new JSArray(raw);
            JSObject ret = new JSObject();
            ret.put("records", arr);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("records", new JSArray());
            call.resolve(ret);
        }
    }

    /**
     * Xóa danh sách bản ghi SAU KHI JS đã sync xong.
     * CHỈ xóa các record cũ hơn hôm nay — giữ lại record hôm nay
     * để NativeGpsService dùng làm guard chặn chấm công lại trong ngày.
     */
    @PluginMethod
    public void clearNativeAttendance(PluginCall call) {
        SharedPreferences prefs = getContext()
            .getSharedPreferences(NativeGpsService.ATT_PREFS, Context.MODE_PRIVATE);
        boolean clearAll = Boolean.TRUE.equals(call.getBoolean("clearAll", false));
        boolean resetState = Boolean.TRUE.equals(call.getBoolean("resetState", false));
        if (clearAll) {
            prefs.edit().putString(NativeGpsService.ATT_KEY, "[]").apply();
            if (resetState) {
                getContext().getSharedPreferences(NativeGpsService.STATE_PREFS, Context.MODE_PRIVATE)
                    .edit().clear().apply();
                getContext().getSharedPreferences(NativeGpsService.GPS_PREFS, Context.MODE_PRIVATE)
                    .edit().clear().apply();
                getContext().getSharedPreferences(NativeGpsService.SIGNAL_PREFS, Context.MODE_PRIVATE)
                    .edit().clear().apply();
                cancelAllPendingNotifications();
                getContext().stopService(new Intent(getContext(), NativeGpsService.class));
            }
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("clearedAll", true);
            ret.put("resetState", resetState);
            call.resolve(ret);
            return;
        }
        String today = makeTodayDateKey();
        String raw = prefs.getString(NativeGpsService.ATT_KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            JSONArray kept = new JSONArray();
            int removed = 0;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject rec = arr.getJSONObject(i);
                if (today.equals(rec.optString("date"))) kept.put(rec);
                else removed++;
            }
            prefs.edit().putString(NativeGpsService.ATT_KEY, kept.toString()).apply();
            android.util.Log.d("NativePlugin", "clearNativeAttendance: removed old=" + removed + ", keptToday=" + kept.length());
        } catch (Exception e) {
            prefs.edit().putString(NativeGpsService.ATT_KEY, raw).apply();
            android.util.Log.w("NativePlugin", "clearNativeAttendance keep-today failed: " + e.getMessage());
        }
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    /** Tạo dateKey theo format của NativeGpsService: year-month(0-indexed)-day */
    private String makeTodayDateKey() {
        java.util.Calendar c = java.util.Calendar.getInstance();
        return c.get(java.util.Calendar.YEAR) + "-"
             + c.get(java.util.Calendar.MONTH) + "-"
             + c.get(java.util.Calendar.DAY_OF_MONTH);
    }

    private void writeAttendanceState(SharedPreferences.Editor editor, PluginCall call, String prefix) {
        String cap = prefix.substring(0, 1).toUpperCase(Locale.US) + prefix.substring(1);
        String date = call.getString(prefix + "Date", "");
        boolean hasIn = Boolean.TRUE.equals(call.getBoolean(prefix + "HasIn", false));
        boolean hasOut = Boolean.TRUE.equals(call.getBoolean(prefix + "HasOut", false));
        String in = call.getString(prefix + "In", "");
        String out = call.getString(prefix + "Out", "");
        long inTs = Math.round(call.getDouble(prefix + "InTs", 0.0));
        long outTs = Math.round(call.getDouble(prefix + "OutTs", 0.0));
        editor
            .putString(prefix + "Date", date)
            .putBoolean(prefix + "HasIn", hasIn)
            .putBoolean(prefix + "HasOut", hasOut)
            .putString(prefix + "In", in)
            .putString(prefix + "Out", out)
            .putLong(prefix + "InTs", inTs)
            .putLong(prefix + "OutTs", outTs);
        android.util.Log.d("NativePlugin", "setAttendanceState " + cap + ": " + date + " in=" + hasIn + " out=" + hasOut);
    }

    private boolean isValidGpsPair(double lat, double lng) {
        return Double.isFinite(lat) && Double.isFinite(lng)
            && lat >= -90.0 && lat <= 90.0
            && lng >= -180.0 && lng <= 180.0
            && !(lat == 0.0 && lng == 0.0);
    }

    // ══════════════════════════════════════════════════════════════
    //  WI-FI & BTS — Đọc thông tin mạng cho chấm công thông minh
    // ══════════════════════════════════════════════════════════════

    /**
     * Đọc thông tin Wi-Fi hiện tại (SSID, BSSID, trạng thái kết nối).
     * Dùng cho smart-attendance.js: Wi-Fi = tín hiệu mạnh nhất khi vào ca.
     * Returns: {ssid, bssid, connected}
     */
    @PluginMethod
    public void getWifiInfo(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            WifiManager wm = (WifiManager) getContext().getApplicationContext()
                .getSystemService(Context.WIFI_SERVICE);
            if (wm == null || !wm.isWifiEnabled()) {
                ret.put("connected", false);
                ret.put("ssid", "");
                ret.put("bssid", "");
                call.resolve(ret);
                return;
            }
            WifiInfo info = wm.getConnectionInfo();
            if (info == null || info.getNetworkId() == -1) {
                ret.put("connected", false);
                ret.put("ssid", "");
                ret.put("bssid", "");
                call.resolve(ret);
                return;
            }
            String ssid = info.getSSID();
            // Android trả về SSID trong ngoặc kép, cần loại bỏ
            if (ssid != null && ssid.startsWith("\"") && ssid.endsWith("\"")) {
                ssid = ssid.substring(1, ssid.length() - 1);
            }
            // "<unknown ssid>" nghĩa là thiếu quyền location hoặc Wi-Fi chưa kết nối
            if ("<unknown ssid>".equals(ssid)) {
                ssid = "";
            }
            ret.put("connected", ssid != null && !ssid.isEmpty());
            ret.put("ssid", ssid != null ? ssid : "");
            ret.put("bssid", info.getBSSID() != null ? info.getBSSID() : "");
        } catch (Exception e) {
            android.util.Log.w("NativePlugin", "getWifiInfo error: " + e.getMessage());
            ret.put("connected", false);
            ret.put("ssid", "");
            ret.put("bssid", "");
        }
        call.resolve(ret);
    }

    /**
     * Đọc thông tin BTS/Cell Tower hiện tại (Cell ID, LAC, MCC, MNC).
     * Dùng cho smart-attendance.js: BTS = radar phát hiện đổi khu vực.
     * Trả về cell đang registered (kết nối). Hỗ trợ LTE, GSM, WCDMA, 5G NR.
     * Returns: {cellId, lac, mcc, mnc, type}
     */
    @PluginMethod
    public void getCellInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("cellId", -1);
        ret.put("lac", -1);
        ret.put("mcc", "");
        ret.put("mnc", "");
        ret.put("type", "");

        try {
            TelephonyManager tm = (TelephonyManager) getContext()
                .getSystemService(Context.TELEPHONY_SERVICE);
            if (tm == null || !hasLocationPermission()) {
                call.resolve(ret);
                return;
            }

            List<CellInfo> cells = tm.getAllCellInfo();
            if (cells == null || cells.isEmpty()) {
                call.resolve(ret);
                return;
            }

            for (CellInfo ci : cells) {
                if (!ci.isRegistered()) continue;

                // ── LTE (4G) ──
                if (ci instanceof CellInfoLte) {
                    CellIdentityLte id = ((CellInfoLte) ci).getCellIdentity();
                    ret.put("cellId", id.getCi());
                    ret.put("lac", id.getTac()); // LTE dùng TAC thay LAC
                    ret.put("type", "LTE");
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        ret.put("mcc", id.getMccString() != null ? id.getMccString() : "");
                        ret.put("mnc", id.getMncString() != null ? id.getMncString() : "");
                    }
                    call.resolve(ret);
                    return;
                }

                // ── GSM (2G) ──
                if (ci instanceof CellInfoGsm) {
                    CellIdentityGsm id = ((CellInfoGsm) ci).getCellIdentity();
                    ret.put("cellId", id.getCid());
                    ret.put("lac", id.getLac());
                    ret.put("type", "GSM");
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        ret.put("mcc", id.getMccString() != null ? id.getMccString() : "");
                        ret.put("mnc", id.getMncString() != null ? id.getMncString() : "");
                    }
                    call.resolve(ret);
                    return;
                }

                // ── WCDMA (3G) ──
                if (ci instanceof CellInfoWcdma) {
                    CellIdentityWcdma id = ((CellInfoWcdma) ci).getCellIdentity();
                    ret.put("cellId", id.getCid());
                    ret.put("lac", id.getLac());
                    ret.put("type", "WCDMA");
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        ret.put("mcc", id.getMccString() != null ? id.getMccString() : "");
                        ret.put("mnc", id.getMncString() != null ? id.getMncString() : "");
                    }
                    call.resolve(ret);
                    return;
                }

                // ── 5G NR (API 29+) — dùng reflection để tương thích ngược ──
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        if ("android.telephony.CellInfoNr".equals(ci.getClass().getName())) {
                            Object identity = ci.getClass().getMethod("getCellIdentity").invoke(ci);
                            if (identity != null) {
                                long nci = (Long) identity.getClass().getMethod("getNci").invoke(identity);
                                int tac = (Integer) identity.getClass().getMethod("getTac").invoke(identity);
                                String mcc = (String) identity.getClass().getMethod("getMccString").invoke(identity);
                                String mnc = (String) identity.getClass().getMethod("getMncString").invoke(identity);
                                ret.put("cellId", nci);
                                ret.put("lac", tac);
                                ret.put("mcc", mcc != null ? mcc : "");
                                ret.put("mnc", mnc != null ? mnc : "");
                                ret.put("type", "NR");
                                call.resolve(ret);
                                return;
                            }
                        }
                    } catch (Exception nrEx) {
                        android.util.Log.w("NativePlugin", "5G NR cell parse: " + nrEx.getMessage());
                    }
                }
            }
        } catch (SecurityException se) {
            android.util.Log.w("NativePlugin", "getCellInfo permission: " + se.getMessage());
        } catch (Exception e) {
            android.util.Log.w("NativePlugin", "getCellInfo error: " + e.getMessage());
        }

        call.resolve(ret);
    }

    /**
     * Đọc tín hiệu Wi-Fi + BTS đã lưu bởi NativeGpsService khi app bị kill.
     * smart-attendance.js gọi để khôi phục trạng thái sau khi app mở lại.
     * Returns: {wifiSsid, wifiBssid, wifiConnected, cellId, lac, cellType, signalTs}
     */
    @PluginMethod
    public void getStoredSignals(PluginCall call) {
        SharedPreferences prefs = getContext()
            .getSharedPreferences(NativeGpsService.SIGNAL_PREFS, Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("wifiSsid", prefs.getString("wifiSsid", ""));
        ret.put("wifiBssid", prefs.getString("wifiBssid", ""));
        ret.put("wifiConnected", prefs.getBoolean("wifiConnected", false));
        ret.put("cellId", prefs.getLong("cellId", -1L));
        ret.put("lac", prefs.getInt("lac", -1));
        ret.put("cellType", prefs.getString("cellType", ""));
        ret.put("signalTs", prefs.getLong("signalTs", 0L));
        call.resolve(ret);
    }

    /**
     * Mở màn hình Settings tắt Battery Optimization cho app.
     * Chiến lược 3 tầng để hoạt động trên mọi thiết bị Android/Samsung/MIUI:
     *   1. ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS — dialog trực tiếp (Android stock)
     *   2. ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS — danh sách tất cả app
     *   3. ACTION_APPLICATION_DETAILS_SETTINGS — trang chi tiết app (luôn hoạt động)
     */
    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        if (System.currentTimeMillis() >= 0L) {
            Uri pkgUri = Uri.parse("package:" + getContext().getPackageName());
            boolean alreadyIgnoring = isIgnoringBatteryOptimizations();
            boolean opened = false;
            String openedTarget = "";

            if (alreadyIgnoring) {
                call.resolve(buildBatteryStatusResult(false, "alreadyGranted", true));
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && tryOpenSettings(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkgUri))) {
                opened = true;
                openedTarget = "requestIgnoreOptimization";
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && tryOpenSettings(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) {
                opened = true;
                openedTarget = "batteryOptimizationList";
            } else if (tryOpenAppDetailsSettings(pkgUri)) {
                opened = true;
                openedTarget = "appDetails";
            } else if (tryOpenAppBatteryUsageSettings(pkgUri)) {
                opened = true;
                openedTarget = "appBatteryUsage";
            } else if (tryOpenSettings(new Intent(Intent.ACTION_POWER_USAGE_SUMMARY))) {
                opened = true;
                openedTarget = "powerUsageSummary";
            } else if (tryOpenSettings(new Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS))) {
                opened = true;
                openedTarget = "batterySaver";
            } else if (tryOpenManufacturerBatterySettings()) {
                opened = true;
                openedTarget = "manufacturerBattery";
            } else if (tryOpenSettings(new Intent(Settings.ACTION_SETTINGS))) {
                opened = true;
                openedTarget = "settings";
            }

            call.resolve(buildBatteryStatusResult(opened, openedTarget, isIgnoringBatteryOptimizations()));
            return;
        }
        {
            Uri batteryPkgUri = Uri.parse("package:" + getContext().getPackageName());
            boolean alreadyIgnoring = isIgnoringBatteryOptimizations();
            boolean opened = tryOpenAppBatteryUsageSettings(batteryPkgUri);

            if (!opened && !alreadyIgnoring && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                opened = tryOpenSettings(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, batteryPkgUri));
            }
            if (!opened) opened = tryOpenSettings(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, batteryPkgUri));
            if (!opened && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                opened = tryOpenSettings(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            }
            if (!opened) opened = tryOpenSettings(new Intent(Intent.ACTION_POWER_USAGE_SUMMARY));
            if (!opened) opened = tryOpenSettings(new Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS));
            if (!opened) opened = tryOpenManufacturerBatterySettings();
            if (!opened) opened = tryOpenSettings(new Intent(Settings.ACTION_SETTINGS));

            if (opened) {
                JSObject ret = new JSObject();
                ret.put("openedSettings", true);
                ret.put("ignoringBatteryOptimizations", alreadyIgnoring);
                call.resolve(ret);
                return;
            }
        }
        android.net.Uri pkgUri = android.net.Uri.parse("package:" + getContext().getPackageName());

        // Tầng 1: dialog trực tiếp
        try {
            Intent intent = new Intent(
                android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkgUri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject(); ret.put("openedSettings", true); call.resolve(ret);
            return;
        } catch (Exception e1) {
            android.util.Log.w("NativePlugin", "ACTION_REQUEST_IGNORE_BATTERY failed, try list: " + e1.getMessage());
        }

        // Tầng 2: danh sách tối ưu pin tất cả app
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject(); ret.put("openedSettings", true); call.resolve(ret);
            return;
        } catch (Exception e2) {
            android.util.Log.w("NativePlugin", "ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS failed, try app details: " + e2.getMessage());
        }

        // Tầng 3: trang chi tiết ứng dụng — luôn hoạt động trên mọi Android
        try {
            Intent intent = new Intent(
                android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception e3) {
            android.util.Log.e("NativePlugin", "Không mở được bất kỳ settings nào: " + e3.getMessage());
        }
        JSObject ret = new JSObject(); ret.put("openedSettings", true); call.resolve(ret);
    }

    /**
     * Mở trang quyền Vị trí của app trong System Settings.
     */
    @PluginMethod
    public void checkBatteryOptimizationPermission(PluginCall call) {
        call.resolve(buildBatteryStatusResult(false, "checkOnly", isIgnoringBatteryOptimizations()));
    }

    private boolean isIgnoringBatteryOptimizations() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        } catch (Exception e) {
            android.util.Log.w("NativePlugin", "Cannot read battery optimization state: " + e.getMessage());
            return false;
        }
    }

    private JSObject buildBatteryStatusResult(boolean opened, String target, boolean ignoring) {
        JSObject ret = new JSObject();
        ret.put("openedSettings", opened);
        ret.put("openedTarget", target);
        ret.put("ignoringBatteryOptimizations", ignoring);
        ret.put("granted", ignoring);
        ret.put("packageName", getContext().getPackageName());
        ret.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        ret.put("sdk", Build.VERSION.SDK_INT);
        return ret;
    }

    private boolean tryOpenSettings(Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PackageManager pm = getContext().getPackageManager();
            if (intent.resolveActivity(pm) == null) return false;
            getContext().startActivity(intent);
            return true;
        } catch (Exception e) {
            android.util.Log.w("NativePlugin", "Open settings failed: " + e.getMessage());
            return false;
        }
    }

    private boolean tryOpenAppBatteryUsageSettings(Uri pkgUri) {
        // Một số bản ROM Samsung (One UI) crash trong AdvancedPowerUsageDetail.
        // Tránh màn này trên Samsung, fallback sang các settings khác ổn định hơn.
        String manufacturer = Build.MANUFACTURER == null
            ? ""
            : Build.MANUFACTURER.toLowerCase(Locale.US);
        if (manufacturer.contains("samsung")) return false;
        Intent intent = new Intent("android.settings.VIEW_ADVANCED_POWER_USAGE_DETAIL");
        intent.setData(pkgUri);
        intent.putExtra("android.provider.extra.APP_PACKAGE", getContext().getPackageName());
        intent.putExtra("package", getContext().getPackageName());
        return tryOpenSettings(intent);
    }

    private boolean tryOpenAppDetailsSettings(Uri pkgUri) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri);
        intent.putExtra("android.provider.extra.APP_PACKAGE", getContext().getPackageName());
        intent.putExtra("package", getContext().getPackageName());
        return tryOpenSettings(intent);
    }

    private boolean tryOpenManufacturerBatterySettings() {
        String manufacturer = Build.MANUFACTURER == null
            ? ""
            : Build.MANUFACTURER.toLowerCase(Locale.US);
        if (!manufacturer.contains("samsung")) return false;

        Intent launchDeviceCare = getContext().getPackageManager()
            .getLaunchIntentForPackage("com.samsung.android.lool");
        if (launchDeviceCare != null && tryOpenSettings(launchDeviceCare)) return true;

        Intent launchDeviceCareAlt = getContext().getPackageManager()
            .getLaunchIntentForPackage("com.samsung.android.sm");
        if (launchDeviceCareAlt != null && tryOpenSettings(launchDeviceCareAlt)) return true;

        Intent[] samsungIntents = new Intent[] {
            new Intent().setComponent(new ComponentName(
                "com.samsung.android.lool",
                "com.samsung.android.sm.ui.battery.BatteryActivity"
            )),
            new Intent().setComponent(new ComponentName(
                "com.samsung.android.sm",
                "com.samsung.android.sm.ui.battery.BatteryActivity"
            ))
        };

        for (Intent intent : samsungIntents) {
            if (tryOpenSettings(intent)) return true;
        }
        return false;
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        try {
            // Mở trang chi tiết app → user tự vào Permissions → Location
            android.net.Uri uri = android.net.Uri.parse("package:" + getContext().getPackageName());
            Intent intent = new Intent(
                android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception e) {
            // Fallback: mở trang Location chung
            try {
                Intent intent = new Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e2) { /* ignore */ }
        }
        JSObject ret = new JSObject();
        ret.put("openedSettings", true);
        call.resolve(ret);
    }

    /**
     * Mở trang Thông báo của app trong System Settings.
     */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Android 8+ có trang notification riêng cho từng app
                intent.setAction(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                // Android < 8: mở trang chi tiết app
                android.net.Uri uri = android.net.Uri.parse("package:" + getContext().getPackageName());
                intent.setAction(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(uri);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception e) {
            /* ignore */
        }
        JSObject ret = new JSObject();
        ret.put("openedSettings", true);
        call.resolve(ret);
    }

    /**
     * Đánh dấu ca làm việc đã checkout vào SharedPreferences "cc_open_shift_closed".
     * NotificationReceiver đọc trước khi hiện thông báo nhắc ca mở — nếu đã đóng thì bỏ qua.
     * Params: dateKey (String), job ("main" | "sub")
     */
    @PluginMethod
    public void markOpenShiftClosed(PluginCall call) {
        String dateKey = call.getString("dateKey", "");
        String job     = call.getString("job", "main");
        if (dateKey == null || dateKey.isEmpty()) { call.resolve(new JSObject()); return; }
        String key = (job != null ? job : "main") + "_" + dateKey;
        getContext()
            .getSharedPreferences("cc_open_shift_closed", Context.MODE_PRIVATE)
            .edit()
            .putBoolean(key, true)
            .putLong(key + "_ts", System.currentTimeMillis())
            .apply();
        android.util.Log.d("NativePlugin", "markOpenShiftClosed: " + key);
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("postNotifications",
            getPermissionState("postNotifications").toString().toLowerCase());
        putLocationPermissionState(ret);
        call.resolve(ret);
    }

    // ── Helpers lưu pending notification ids ──────────────────────────

    private void savePendingId(int id, long atMillis, String title, String body) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> raw = new HashSet<>(prefs.getStringSet(PREFS_KEY, new HashSet<>()));
        // Xóa entry cũ có cùng id
        raw.removeIf(s -> {
            try { return new JSONObject(s).getInt("id") == id; } catch (Exception e) { return false; }
        });
        try {
            JSONObject obj = new JSONObject();
            obj.put("id", id);
            obj.put("at", atMillis);
            obj.put("title", title);
            obj.put("body", body);
            raw.add(obj.toString());
        } catch (Exception e) { /* ignore */ }
        prefs.edit().putStringSet(PREFS_KEY, raw).apply();
    }

    private void removePendingId(int id) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> raw = new HashSet<>(prefs.getStringSet(PREFS_KEY, new HashSet<>()));
        raw.removeIf(s -> {
            try { return new JSONObject(s).getInt("id") == id; } catch (Exception e) { return false; }
        });
        prefs.edit().putStringSet(PREFS_KEY, raw).apply();
    }

    private void cancelScheduledNotificationId(int id) {
        Intent intent = new Intent(getContext(), NotificationReceiver.class);
        int flags = PendingIntent.FLAG_NO_CREATE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getBroadcast(getContext(), id, intent, flags);
        if (pi != null) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(pi);
            pi.cancel();
        }

        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(id);
    }

    private void cancelAllPendingNotifications() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> raw = new HashSet<>(prefs.getStringSet(PREFS_KEY, new HashSet<>()));
        for (String entry : raw) {
            try {
                int id = new JSONObject(entry).optInt("id", -1);
                if (id >= 0) cancelScheduledNotificationId(id);
            } catch (Exception ignored) {}
        }
        prefs.edit().putStringSet(PREFS_KEY, new HashSet<>()).apply();
    }
}
