package com.chamcongpro.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.telephony.CellIdentityGsm;
import android.telephony.CellIdentityLte;
import android.telephony.CellIdentityWcdma;
import android.telephony.CellInfo;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoWcdma;
import android.telephony.TelephonyManager;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * NativeGpsService — Foreground Service theo dõi GPS và tự động chấm công.
 * Chạy ngay cả khi app bị kill (START_STICKY).
 * Lưu kết quả vào SharedPreferences để JS đọc khi app mở lại.
 */
public class NativeGpsService extends Service {

    private static final String CHANNEL_ID   = "chamcongpro_gps";
    private static final String CHANNEL_NAME = "GPS Chấm Công";
    private static final String ATTENDANCE_ALERT_CHANNEL_ID = "chamcongpro_attendance_alert";
    private static final int    NOTIF_ID     = 9001;
    private static final String ACTION_RESTART_SERVICE = "com.chamcongpro.app.RESTART_NATIVE_GPS";
    private static final String ACTION_AUTO_CHECKIN    = "com.chamcongpro.app.AUTO_CHECKIN";
    private static final String ACTION_AUTO_CHECKOUT   = "com.chamcongpro.app.AUTO_CHECKOUT";
    private static final String ACTION_SMART_CHECKIN   = "com.chamcongpro.app.SMART_CHECKIN";
    private static final String ACTION_SMART_CHECKOUT  = "com.chamcongpro.app.SMART_CHECKOUT";
    private static final String ACTION_SMART_WAKEUP    = "com.chamcongpro.app.SMART_WAKEUP";

    // ─── Brain v2 GPS control ─────────────────────────────────────────────────
    /** Action để Brain v2 điều khiển GPS service từ xa */
    static final String ACTION_BRAIN_GPS_CONTROL = "com.chamcongpro.app.BRAIN_GPS_CONTROL";
    static final String EXTRA_BRAIN_CMD          = "brain_cmd";     // "oneshot"|"stop"|"set_interval"
    static final String EXTRA_BRAIN_INTERVAL_MS  = "brain_interval_ms";

    // ─── Static helpers cho Brain v2 (gọi từ AttendanceBrain.java) ───────────

    /** Yêu cầu lấy 1 GPS fix ngắn hạn rồi dừng */
    public static void requestOneShot(Context ctx) {
        sendBrainCmd(ctx, "oneshot", 0);
    }

    /** Dừng GPS polling (tiết kiệm pin) */
    public static void stop(Context ctx) {
        sendBrainCmd(ctx, "stop", 0);
    }

    /** Đặt lại interval GPS polling */
    public static void setInterval(Context ctx, long intervalMs) {
        sendBrainCmd(ctx, "set_interval", intervalMs);
    }

    private static void sendBrainCmd(Context ctx, String cmd, long intervalMs) {
        try {
            Intent intent = new Intent(ctx, NativeGpsService.class);
            intent.setAction(ACTION_BRAIN_GPS_CONTROL);
            intent.putExtra(EXTRA_BRAIN_CMD, cmd);
            if (intervalMs > 0) intent.putExtra(EXTRA_BRAIN_INTERVAL_MS, intervalMs);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
        } catch (Exception e) {
            android.util.Log.w("NativeGps", "sendBrainCmd failed: " + e.getMessage());
        }
    }

    /** Kiểm tra Brain v2 có đang enabled không (để guard logic cũ) */
    static boolean isBrainV2Enabled(Context ctx) {
        return ctx.getSharedPreferences(
            AttendanceState.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(AttendanceState.KEY_ENABLED, false);
    }
    private static final String ACTION_INSIDE_SCHEDULE_CHECKOUT = "com.chamcongpro.app.INSIDE_SCHEDULE_CHECKOUT";
    private static final int    REQ_RESTART            = 9901;
    private static final int    REQ_AUTO_CHECKIN       = 9911;
    private static final int    REQ_AUTO_CHECKOUT      = 9912;
    private static final int    REQ_SMART_CHECKIN      = 9921;
    private static final int    REQ_SMART_CHECKOUT     = 9922;
    private static final int    REQ_SMART_WAKEUP       = 9923;
    private static final int    REQ_INSIDE_SCHEDULE_CHECKOUT = 9913;

    // SharedPreferences keys — dùng chung với ChamCongNativePlugin
    static final String GPS_PREFS  = "cc_gps_config";
    static final String ATT_PREFS  = "cc_native_att";
    static final String STATE_PREFS = "cc_att_state";
    static final String ATT_KEY    = "records";
    /** SharedPreferences cho tín hiệu Wi-Fi + BTS (smart-attendance.js đọc) */
    static final String SIGNAL_PREFS = "cc_smart_signals";
    private static final String KEY_PENDING_GPS_CHECKIN_TS = "pendingGpsCheckinSignalTs";
    private static final String KEY_PENDING_GPS_CHECKOUT_TS = "pendingGpsCheckoutSignalTs";
    private static final String KEY_PENDING_SMART_CHECKIN_TS = "pendingSmartCheckinSignalTs";
    private static final String KEY_PENDING_SMART_CHECKOUT_TS = "pendingSmartCheckoutSignalTs";
    private static final String KEY_PENDING_WIFI_CHECKIN_TS = "pendingWifiCheckinSignalTs";
    private static final String KEY_PENDING_WIFI_CHECKOUT_TS = "pendingWifiCheckoutSignalTs";

    // Location
    private LocationManager  locationManager;
    private LocationListener locationListener;
    private boolean          locationUpdatesActive = false;

    // State geofence
    private Boolean  wasInside = null;
    // FIX #1: tăng từ 1 lên 2 — yêu cầu 2 lần GPS đo "inside" liên tiếp mới
    // coi như user đã vào vùng công ty. Trước đây 1 lần đo (có thể là GPS noise
    // khi đi ngang công ty) đã trigger scheduleCheckin → 20p sau auto checkin sai.
    private static final int   INSIDE_CONFIRM_REQUIRED  = 2;
    private static final int   OUTSIDE_CONFIRM_REQUIRED = 5;
    // FIX #2: mở rộng max buffer 20m → 60m để công thức accuracy*2.5 có tác dụng.
    // Trước đây MIN==MAX=20m → exit buffer cố định 20m bất kể GPS chính xác hay yếu.
    // Giờ: GPS chính xác (acc=5m) → buffer=20m (min). GPS yếu (acc=24m) → buffer=60m (max).
    // Giúp tránh false-checkout khi GPS noise lệch ra vài chục mét.
    private static final float MIN_EXIT_BUFFER_M        = 20f;
    private static final float MAX_EXIT_BUFFER_M        = 60f;
    // FIX #6: tăng từ 25m → 40m. Trong building/tầng hầm GPS thường yếu (30-40m).
    // 25m quá strict → reliableOutside = false → không bao giờ trigger checkout.
    // 40m cân bằng: vẫn loại bỏ fix noise (>40m thường là network-only) nhưng cho
    // phép GPS hơi yếu (30-40m) vẫn được dùng nếu đã ra xa khỏi geofence + buffer.
    private static final float MAX_OUTSIDE_ACCURACY_M   = 40f;
    private static final float NETWORK_OUTSIDE_EXTRA_M  = 500f;
    private static final long  CHECKOUT_FIX_MAX_AGE_MS  = 10L * 60L * 1000L;
    private static final long  NEW_CYCLE_WAIT_MS        = 8L * 60L * 60L * 1000L;
    private static final long  SMART_GPS_WAKEUP_PREPARE_MS = 15L * 60L * 1000L;
    private static final long  SMART_GPS_WAKEUP_AFTER_OUT_MS = NEW_CYCLE_WAIT_MS - SMART_GPS_WAKEUP_PREPARE_MS;
    private static final long  OPEN_SHIFT_CONFIRM_MS    = 20L * 60L * 60L * 1000L;
    private static final long  OPEN_SHIFT_NOTIFY_COOLDOWN_MS = 30L * 60L * 1000L;
    private static final String KEY_OPEN_SHIFT_WARN_TS  = "openShiftWarnTs";
    private static final long  SMART_SIGNAL_POLL_MS     = 30L * 1000L;
    private static final int   SMART_HOME_GPS_BEFORE_SHIFT_MIN = 120;
    private static final int   SMART_HOME_GPS_AFTER_SHIFT_MIN  = 180;
    private static final float SMART_GPS_HOME_WORK_CLOSE_M = 180f;
    private static final float SMART_GPS_HOME_WORK_MARGIN_M = 15f;
    private static final float SMART_GPS_CLOSE_PROFILE_MAX_RADIUS_M = 80f;
    private int      insideConfirmCount  = 0;
    private int      outsideConfirmCount = 0;
    private Location lastDecisionLocation = null;

    // Timers debounce
    private final Handler  handler          = new Handler(Looper.getMainLooper());
    private Runnable       checkinRunnable  = null;
    private Runnable       checkoutRunnable = null;
    private Runnable       smartCheckinRunnable = null;
    private Runnable       smartCheckoutRunnable = null;
    private Runnable       smartWakeupRunnable = null;
    private Runnable       smartSignalRunnable = null;
    private Runnable       insideScheduleCheckoutRunnable = null;
    private long           smartCheckinTriggerAt = 0L;
    private long           smartCheckoutTriggerAt = 0L;
    private long           smartWakeupTriggerAt = 0L;
    private long           insideScheduleTriggerAt = 0L;
    private long           lastGpsAlertAt   = 0L;

    // WakeLock — giữ CPU không sleep khi đang track GPS
    private PowerManager.WakeLock wakeLock;

    // BroadcastReceiver — phản ứng tức thì khi Wi-Fi/GPS thay đổi (không đợi 30s poll)
    private BroadcastReceiver signalChangeReceiver;

    // ──────────────────────────────────────────────────────────────
    //  Lifecycle
    // ──────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        createGpsChannel();
        // Acquire WakeLock — giữ CPU không sleep, đảm bảo GPS tracking liên tục
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ChamCongPro::GpsWakeLock");
        }
        // Đăng ký nghe Wi-Fi/GPS state changes để phản ứng tức thì (không đợi 30s poll)
        registerSignalChangeReceiver();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!hasLocationPermission()) {
            getSharedPreferences(GPS_PREFS, MODE_PRIVATE)
                .edit().putBoolean("enabled", false).apply();
            android.util.Log.w("NativeGps", "Missing location permission — service stopped safely");
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent == null ? null : intent.getAction();
        if (intent == null) {
            // Android đã kill service và tự restart lại (START_STICKY)
            // Gửi thông báo yêu cầu người dùng mở app để kích hoạt lại GPS
            android.util.Log.d("NativeGps", "Service restarted by Android after kill");
            startForeground(NOTIF_ID, buildNotif(NotifTranslations.tr(this, "gpsInterrupted")));
            sendKillNotif();
        } else {
            startForeground(NOTIF_ID, buildNotif(NotifTranslations.tr(this, "ongoingTracking")));
        }
        // ── Brain v2 GPS control (ưu tiên xử lý trước) ─────────────────────
        if (ACTION_BRAIN_GPS_CONTROL.equals(action)) {
            handleBrainGpsControl(intent);
            configureTrackingFromPrefs();
            return START_STICKY;
        }

        // ── Logic cũ — chỉ chạy nếu Brain v2 KHÔNG được bật ────────────────
        // Khi Brain v2 enabled, nó tự quản lý toàn bộ vòng đời GPS + attendance.
        // NativeGpsService chỉ còn nhiệm vụ: chạy GPS foreground, báo cáo vị trí.
        boolean brainV2 = isBrainV2Enabled(this);

        if (ACTION_AUTO_CHECKIN.equals(action)) {
            cancelCheckinTimerOnly();
            if (!brainV2) doAutoCheckin();
        } else if (ACTION_AUTO_CHECKOUT.equals(action)) {
            cancelCheckoutTimerOnly();
            if (!brainV2) doAutoCheckout();
        } else if (ACTION_SMART_CHECKIN.equals(action)) {
            cancelSmartCheckinTimerOnly();
            if (!brainV2) doSmartAutoCheckin();
        } else if (ACTION_SMART_CHECKOUT.equals(action)) {
            cancelSmartCheckoutTimerOnly();
            if (!brainV2) doSmartAutoCheckout();
        } else if (ACTION_SMART_WAKEUP.equals(action)) {
            cancelSmartWakeupTimerOnly();
            if (!brainV2) wakeSmartCycleForGps();
        } else if (ACTION_INSIDE_SCHEDULE_CHECKOUT.equals(action)) {
            cancelInsideScheduleCheckout();
            android.util.Log.d("NativeGps", "inside schedule checkout disabled; alarm canceled");
        }

        configureTrackingFromPrefs();
        android.util.Log.d("NativeGps", "Service started, action=" + (action == null ? "normal" : action));
        return START_STICKY; // Android tự restart service khi bị kill
    }

    @Override
    public void onDestroy() {
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("enabled", false);
        if (enabled) {
            prefs.edit().putLong("smartJsAliveTs", 0L).apply();
        }
        unregisterSignalChangeReceiver();
        stopSmartSignalPolling();
        removeLocationUpdatesOnly();
        if (!enabled) {
            cancelCheckin();
            cancelCheckout();
            cancelSmartCheckin();
            cancelSmartCheckout();
            cancelSmartWakeup();
            cancelInsideScheduleCheckout();
            cancelWifiCheckin();
            cancelWifiCheckout();
        }
        // Release WakeLock
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
        // Gửi thông báo báo hiệu GPS vừa bị tắt — người dùng cần mở lại app
        if (enabled) {
            sendKillNotif();
            // Tự động schedule restart sau 3 giây
            scheduleRestart();
        }
        super.onDestroy();
        android.util.Log.d("NativeGps", "Service destroyed");
    }

    /**
     * onTaskRemoved — gọi khi user vuốt tắt app khỏi Recent Apps.
     * Lên lịch restart service sau 1 giây để tiếp tục tracking ngầm.
     */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        android.util.Log.d("NativeGps", "onTaskRemoved — scheduling restart");
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("enabled", false);
        if (enabled) {
            prefs.edit().putLong("smartJsAliveTs", 0L).apply();
            scheduleRestart();
        }
        super.onTaskRemoved(rootIntent);
    }

    /**
     * Lên lịch tự động restart service qua AlarmManager.
     * Hoạt động ngay cả khi process bị kill.
     */
    private void scheduleRestart() {
        if (System.currentTimeMillis() >= 0L) {
            scheduleServiceAlarm(ACTION_RESTART_SERVICE, REQ_RESTART, System.currentTimeMillis() + 3000L);
            android.util.Log.d("NativeGps", "Restart scheduled in 3s");
            return;
        }
        try {
            Intent restartIntent = new Intent(getApplicationContext(), NativeGpsService.class);
            int piFlags = PendingIntent.FLAG_ONE_SHOT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getService(
                getApplicationContext(), 9901, restartIntent, piFlags
            );
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am != null) {
                long triggerAt = System.currentTimeMillis() + 3000; // restart sau 3s
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                } else {
                    am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                }
                android.util.Log.d("NativeGps", "Restart scheduled in 3s");
            }
        } catch (Exception e) {
            android.util.Log.e("NativeGps", "scheduleRestart lỗi: " + e.getMessage());
        }
    }

    private void scheduleServiceAlarm(String action, int requestCode, long triggerAt) {
        try {
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
            Intent serviceIntent = new Intent(getApplicationContext(), NativeGpsService.class);
            serviceIntent.setAction(action);
            PendingIntent pi = buildServicePendingIntent(requestCode, serviceIntent, piFlags);

            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am == null) return;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                } else {
                    am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                }
            } catch (SecurityException se) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                } else {
                    am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                }
            }
        } catch (Exception e) {
            android.util.Log.e("NativeGps", "scheduleServiceAlarm error: " + e.getMessage());
        }
    }

    private void cancelServiceAlarm(String action, int requestCode) {
        try {
            int piFlags = PendingIntent.FLAG_NO_CREATE;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
            Intent serviceIntent = new Intent(getApplicationContext(), NativeGpsService.class);
            serviceIntent.setAction(action);
            PendingIntent pi = buildServicePendingIntent(requestCode, serviceIntent, piFlags);
            if (pi == null) return;
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am != null) am.cancel(pi);
            pi.cancel();
        } catch (Exception e) {
            android.util.Log.w("NativeGps", "cancelServiceAlarm error: " + e.getMessage());
        }
    }

    private PendingIntent buildServicePendingIntent(int requestCode, Intent intent, int flags) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return PendingIntent.getForegroundService(getApplicationContext(), requestCode, intent, flags);
        }
        return PendingIntent.getService(getApplicationContext(), requestCode, intent, flags);
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ══════════════════════════════════════════════════════════════════════════
    //  BRAIN V2 GPS CONTROL — xử lý lệnh từ AttendanceBrain
    // ══════════════════════════════════════════════════════════════════════════

    private void handleBrainGpsControl(Intent intent) {
        if (intent == null) return;
        String cmd = intent.getStringExtra(EXTRA_BRAIN_CMD);
        if (cmd == null) return;

        android.util.Log.d("NativeGps", "[Brain] GPS cmd=" + cmd);

        switch (cmd) {
            case "oneshot":
                // Lấy 1 GPS fix rồi dừng — không cần foreground notification dài
                startForeground(NOTIF_ID,
                    buildNotif(NotifTranslations.tr(this, "ongoingTracking")));
                startLocationUpdates();
                // Tự dừng sau 30s nếu không lấy được GPS
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    stopLocationUpdates();
                    stopForeground(true);
                }, 30_000L);
                break;

            case "stop":
                stopLocationUpdates();
                stopForeground(true);
                break;

            case "set_interval":
                long ms = intent.getLongExtra(EXTRA_BRAIN_INTERVAL_MS, 60_000L);
                // Lưu interval mới vào prefs để configureTrackingFromPrefs() dùng
                getSharedPreferences(GPS_PREFS, MODE_PRIVATE).edit()
                    .putLong("brain_interval_ms", ms)
                    .apply();
                startForeground(NOTIF_ID,
                    buildNotif(NotifTranslations.tr(this, "ongoingTracking")));
                // Restart location updates với interval mới
                stopLocationUpdates();
                startLocationUpdates();
                break;
        }
    }

    private boolean hasLocationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    // ──────────────────────────────────────────────────────────────
    //  Location tracking
    // ──────────────────────────────────────────────────────────────

    private void startLocationUpdates() {
        if (locationUpdatesActive && locationManager != null && locationListener != null) {
            ensureWakeLockHeld();
            checkFreshLastKnownLocation("already-active");
            return;
        }
        removeLocationUpdatesOnly();
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                checkGeofence(location);
            }
            @Override public void onStatusChanged(String p, int s, Bundle b) {}
            @Override public void onProviderEnabled(String p) {}
            @Override public void onProviderDisabled(String p) {
                sendGpsUnavailableNotif(NotifTranslations.tr(NativeGpsService.this, "noGpsTitle"), NotifTranslations.tr(NativeGpsService.this, "noGpsBodyDisabled"));
            }
        };

        try {
            // ── FIX WARNING: đọc brain_interval_ms nếu Brain v2 đang dùng ─────
            long locationIntervalMs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE)
                .getLong("brain_interval_ms", 30_000L);
            boolean requestedAnyProvider = false;
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER, locationIntervalMs, 5f, locationListener
                );
                requestedAnyProvider = true;
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER, locationIntervalMs, 5f, locationListener
                );
                requestedAnyProvider = true;
            }
            if (!requestedAnyProvider) {
                locationUpdatesActive = false;
                releaseWakeLockIfHeld();
                sendGpsUnavailableNotif(NotifTranslations.tr(this, "noGpsTitle"), NotifTranslations.tr(this, "noGpsBodyOff"));
            } else {
                locationUpdatesActive = true;
                ensureWakeLockHeld();
                android.util.Log.d("NativeGps", "Location updates active");
                checkFreshLastKnownLocation("start");
            }
        } catch (SecurityException e) {
            locationUpdatesActive = false;
            releaseWakeLockIfHeld();
            sendGpsUnavailableNotif(NotifTranslations.tr(this, "noPermTitle"), NotifTranslations.tr(this, "noPermBody"));
            android.util.Log.e("NativeGps", "Không có quyền location: " + e.getMessage());
        }
    }

    private void checkFreshLastKnownLocation(String reason) {
        Location fresh = getFreshBestLocation(CHECKOUT_FIX_MAX_AGE_MS);
        if (fresh == null) {
            android.util.Log.d("NativeGps", "No fresh last-known location for " + reason);
            return;
        }
        android.util.Log.d("NativeGps", "Using fresh last-known location for " + reason);
        checkGeofence(fresh);
    }

    private void removeLocationUpdatesOnly() {
        if (locationManager != null && locationListener != null) {
            try { locationManager.removeUpdates(locationListener); } catch (Exception ignored) {}
        }
        locationUpdatesActive = false;
        releaseWakeLockIfHeld();
    }

    private void stopLocationUpdates() {
        stopSmartSignalPolling();
        removeLocationUpdatesOnly();
        cancelCheckin();
        cancelCheckout();
        cancelInsideScheduleCheckout();
        cancelSmartCheckin();
        cancelSmartCheckout();
        cancelWifiCheckin();
        cancelWifiCheckout();
    }

    // ──────────────────────────────────────────────────────────────
    //  Geofence logic
    // ──────────────────────────────────────────────────────────────

    private void ensureWakeLockHeld() {
        if (wakeLock == null) return;
        try {
            if (!wakeLock.isHeld()) wakeLock.acquire();
        } catch (Exception ignored) {}
    }

    private void releaseWakeLockIfHeld() {
        if (wakeLock == null) return;
        try {
            if (wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {}
    }

    private void configureTrackingFromPrefs() {
        if (isSmartAttendanceMode()) {
            startSmartSignalPolling();
            readAndStoreSmartSignals();
            applySmartTrackingDecision();
        } else {
            stopSmartSignalPolling();
            startLocationUpdates();
        }
    }

    private void startSmartSignalPolling() {
        if (smartSignalRunnable != null) return;
        smartSignalRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    if (!isSmartAttendanceMode()) {
                        stopSmartSignalPolling();
                        startLocationUpdates();
                        return;
                    }
                    readAndStoreSmartSignals();
                    applySmartTrackingDecision();
                } catch (Exception e) {
                    android.util.Log.w("NativeGps", "smart signal poll: " + e.getMessage());
                }
                if (smartSignalRunnable == this) {
                    handler.postDelayed(this, SMART_SIGNAL_POLL_MS);
                }
            }
        };
        handler.post(smartSignalRunnable);
    }

    private void stopSmartSignalPolling() {
        if (smartSignalRunnable != null) {
            handler.removeCallbacks(smartSignalRunnable);
            smartSignalRunnable = null;
        }
    }

    private void markSmartPostCheckoutSleep(long checkoutAt) {
        if (checkoutAt <= 0L) checkoutAt = System.currentTimeMillis();
        long wakeupAt = checkoutAt + SMART_GPS_WAKEUP_AFTER_OUT_MS;
        long cycleReadyAt = checkoutAt + NEW_CYCLE_WAIT_MS;
        getSharedPreferences(GPS_PREFS, MODE_PRIVATE).edit()
            .putString("smartState", "CHECKED_OUT")
            .putLong("smartLastCheckoutAt", checkoutAt)
            .putLong("smartGpsWakeupAt", wakeupAt)
            .putLong("smartCycleReadyAt", cycleReadyAt)
            .putLong("smartCheckinWindowStart", 0L)
            .putLong("smartCheckoutWindowStart", 0L)
            .apply();
        scheduleSmartWakeup(wakeupAt);
    }

    private void markSmartCycleWakeReady(String reason) {
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        prefs.edit()
            .putString("smartState", "HOME")
            .putLong("smartGpsWakeupAt", 0L)
            .putLong("smartCheckinWindowStart", 0L)
            .putLong("smartCheckoutWindowStart", 0L)
            .apply();
        cancelSmartWakeupTimerOnly();
        android.util.Log.d("NativeGps", "Smart GPS wake ready: " + reason);
    }

    private void wakeSmartCycleForGps() {
        markSmartCycleWakeReady("alarm");
        configureTrackingFromPrefs();
    }

    private boolean handleSmartPostCheckoutSleep() {
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long lastCheckoutAt = Math.max(prefs.getLong("smartLastCheckoutAt", 0L), getLastCheckoutTs());
        long wakeupAt = prefs.getLong("smartGpsWakeupAt", 0L);
        long cycleReadyAt = prefs.getLong("smartCycleReadyAt", 0L);
        if (lastCheckoutAt > 0L) {
            long expectedWake = lastCheckoutAt + SMART_GPS_WAKEUP_AFTER_OUT_MS;
            long expectedReady = lastCheckoutAt + NEW_CYCLE_WAIT_MS;
            if (wakeupAt <= 0L || Math.abs(wakeupAt - expectedWake) > 5000L) wakeupAt = expectedWake;
            if (cycleReadyAt <= 0L || Math.abs(cycleReadyAt - expectedReady) > 5000L) cycleReadyAt = expectedReady;
        }

        String state = getSmartState();
        boolean sleepWindow = lastCheckoutAt > 0L && now < wakeupAt && findLatestOpenShiftInfo() == null;
        if (!"CHECKED_OUT".equals(state) && !sleepWindow) return false;
        if (lastCheckoutAt <= 0L) return false;

        prefs.edit()
            .putLong("smartLastCheckoutAt", lastCheckoutAt)
            .putLong("smartGpsWakeupAt", wakeupAt)
            .putLong("smartCycleReadyAt", cycleReadyAt)
            .apply();

        if (now < wakeupAt) {
            removeLocationUpdatesOnly();
            cancelCheckin();
            cancelCheckout();
            cancelInsideScheduleCheckout();
            cancelSmartCheckin();
            cancelSmartCheckout();
            cancelWifiCheckin();
            cancelWifiCheckout();
            scheduleSmartWakeup(wakeupAt);
            long leftMin = Math.max(1L, (wakeupAt - now + 59_999L) / 60_000L);
            updateNotif("Da ra ca. GPS tam nghi, bat lai sau " + leftMin + " phut.");
            return true;
        }

        if ("CHECKED_OUT".equals(state)) {
            markSmartCycleWakeReady("7h45 elapsed");
        } else {
            cancelSmartWakeupTimerOnly();
        }
        return false;
    }

    private void scheduleSmartWakeup(long triggerAt) {
        if (triggerAt <= 0L) return;
        if (smartWakeupRunnable != null && Math.abs(smartWakeupTriggerAt - triggerAt) < 5000L) return;
        cancelSmartWakeupTimerOnly();
        smartWakeupTriggerAt = triggerAt;
        long delayMs = triggerAt - System.currentTimeMillis();
        smartWakeupRunnable = () -> {
            smartWakeupRunnable = null;
            smartWakeupTriggerAt = 0L;
            cancelServiceAlarm(ACTION_SMART_WAKEUP, REQ_SMART_WAKEUP);
            wakeSmartCycleForGps();
        };
        if (delayMs <= 0L) handler.post(smartWakeupRunnable);
        else {
            handler.postDelayed(smartWakeupRunnable, delayMs);
            scheduleServiceAlarm(ACTION_SMART_WAKEUP, REQ_SMART_WAKEUP, triggerAt);
        }
        android.util.Log.d("NativeGps", "Smart GPS wakeup scheduled at " + triggerAt);
    }

    private void cancelSmartWakeup() {
        cancelSmartWakeupTimerOnly();
        getSharedPreferences(GPS_PREFS, MODE_PRIVATE).edit()
            .putLong("smartGpsWakeupAt", 0L)
            .putLong("smartCycleReadyAt", 0L)
            .putLong("smartLastCheckoutAt", 0L)
            .apply();
    }

    private void cancelSmartWakeupTimerOnly() {
        if (smartWakeupRunnable != null) {
            handler.removeCallbacks(smartWakeupRunnable);
            smartWakeupRunnable = null;
        }
        smartWakeupTriggerAt = 0L;
        cancelServiceAlarm(ACTION_SMART_WAKEUP, REQ_SMART_WAKEUP);
    }

    private void applySmartTrackingDecision() {
        if (!isSmartAttendanceMode()) {
            startLocationUpdates();
            return;
        }

        boolean jsAlive = isJsAliveSmart();
        applySmartStateDeadlineAlarms();
        if (handleSmartPostCheckoutSleep()) return;

        if (hasSmartWorkWifiProfile() && isAtSmartWorkWifiBySignals()) {
            removeLocationUpdatesOnly();
            cancelCheckin();
            cancelCheckout();
            cancelInsideScheduleCheckout();
            cancelWifiCheckout();
            scheduleWifiCheckin();
            updateNotif(NotifTranslations.tr(this, "smartFallbackWorkWifi"));
            return;
        }

        if (hasSmartHomeWifiProfile() && isAtSmartHomeWifiBySignals()) {
            removeLocationUpdatesOnly();
            cancelCheckin();
            cancelCheckout();
            cancelInsideScheduleCheckout();
            cancelWifiCheckin();
            scheduleWifiCheckout();
            updateNotif(NotifTranslations.tr(this, "smartFallbackHomeWifi"));
            return;
        }

        if (shouldUseGpsForSmartMode()) {
            // Wi-Fi không xác định được → bật GPS. JS chết → native dùng GPS để chấm
            startLocationUpdates();
            cancelWifiCheckin();
            cancelWifiCheckout();
            updateNotif(NotifTranslations.tr(this, jsAlive ? "smartJsGpsActive" : "smartFallbackGps"));
        } else {
            // Wi-Fi/BTS đã xác định rõ vị trí → không cần GPS
            removeLocationUpdatesOnly();
            cancelCheckin();
            cancelCheckout();
            cancelInsideScheduleCheckout();
            if (jsAlive) {
                // Wi-Fi/GPS chỉ là tín hiệu bắt đầu đếm. Native vẫn schedule cả IN/OUT
                // theo checkinMin/checkoutMin để không có đường nào chấm ngay khi JS bị throttle.
                if (hasSmartWorkWifiProfile() && isAtSmartWorkWifiBySignals()) {
                    cancelWifiCheckout();
                    scheduleWifiCheckin();
                    updateNotif(NotifTranslations.tr(this, "smartFallbackWorkWifi"));
                } else if (hasSmartHomeWifiProfile() && isAtSmartHomeWifiBySignals()) {
                    cancelWifiCheckin();
                    scheduleWifiCheckout();
                    updateNotif(NotifTranslations.tr(this, "smartFallbackHomeWifi"));
                } else {
                    // JS alive + không ở Wi-Fi đã lưu → hủy lịch Wi-Fi, GPS path xử lý riêng.
                    cancelWifiCheckin();
                    cancelWifiCheckout();
                    updateNotif(buildSmartPausedNotification());
                }
            } else {
                // JS chết → native chấm công bằng Wi-Fi (ưu tiên Wi-Fi hơn GPS)
                applyNativeWifiFallbackTriggers();
            }
        }
    }

    /**
     * Native fallback dùng Wi-Fi khi JS chết.
     * Ưu tiên Wi-Fi vì chính xác và tiết kiệm pin hơn GPS.
     */
    private void applyNativeWifiFallbackTriggers() {
        if (hasSmartWorkWifiProfile() && isAtSmartWorkWifiBySignals()) {
            // Đang ở Wi-Fi công ty → schedule chấm vào ca
            cancelWifiCheckout();
            scheduleWifiCheckin();
            updateNotif(NotifTranslations.tr(this, "smartFallbackWorkWifi"));
        } else if (hasSmartHomeWifiProfile() && isAtSmartHomeWifiBySignals()) {
            // Đang ở Wi-Fi nhà → schedule chấm ra ca
            cancelWifiCheckin();
            scheduleWifiCheckout();
            updateNotif(NotifTranslations.tr(this, "smartFallbackHomeWifi"));
        } else {
            // Không có Wi-Fi xác định → hủy mọi schedule Wi-Fi
            cancelWifiCheckin();
            cancelWifiCheckout();
            updateNotif(NotifTranslations.tr(this, "smartFallbackWaiting"));
        }
    }

    /**
     * Đăng ký nghe thay đổi Wi-Fi/GPS state.
     * Khi Wi-Fi bật/tắt/đổi mạng → phản ứng TỨC THÌ thay vì đợi 30s poll cycle.
     */
    private void registerSignalChangeReceiver() {
        if (signalChangeReceiver != null) return;
        signalChangeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                String action = intent.getAction();
                android.util.Log.d("NativeGps", "Signal changed: " + action);
                try {
                    // Đọc lại tín hiệu Wi-Fi/BTS ngay
                    readAndStoreSmartSignals();
                    // Quyết định lại: bật/tắt GPS, schedule Wi-Fi checkin/out
                    applySmartTrackingDecision();
                } catch (Exception e) {
                    android.util.Log.w("NativeGps", "signal change handler error: " + e.getMessage());
                }

                // ── FIX WARNING: Brain v2 WiFi change trigger ─────────────────
                // CONNECTIVITY_CHANGE không được nhận trong manifest trên API 24+,
                // nhưng đăng ký động trong foreground service thì vẫn hoạt động.
                if (isBrainV2Enabled(NativeGpsService.this)) {
                    final Context appCtx = getApplicationContext();
                    new Thread(() -> {
                        try {
                            android.util.Log.d("NativeGps",
                                "[Brain] WiFi/network changed (dynamic) → evaluate()");
                            AttendanceBrain.get().evaluate(appCtx, "wifi_change");
                        } catch (Exception ex) {
                            android.util.Log.w("NativeGps",
                                "Brain wifi_change eval error: " + ex.getMessage());
                        }
                    }, "Brain-wifi-dyn").start();
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(WifiManager.WIFI_STATE_CHANGED_ACTION);     // Wi-Fi radio bật/tắt
        filter.addAction(WifiManager.NETWORK_STATE_CHANGED_ACTION);  // Kết nối/ngắt Wi-Fi
        filter.addAction("android.net.conn.CONNECTIVITY_CHANGE");    // FIX: đăng ký động (API 24+ ok)
        filter.addAction(LocationManager.PROVIDERS_CHANGED_ACTION);  // GPS hệ thống bật/tắt
        try {
            registerReceiver(signalChangeReceiver, filter);
            android.util.Log.d("NativeGps", "Signal change receiver registered");
        } catch (Exception e) {
            android.util.Log.w("NativeGps", "registerReceiver failed: " + e.getMessage());
        }
    }

    private void unregisterSignalChangeReceiver() {
        if (signalChangeReceiver == null) return;
        try { unregisterReceiver(signalChangeReceiver); } catch (Exception ignored) {}
        signalChangeReceiver = null;
    }

    private Runnable wifiCheckinRunnable = null;
    private Runnable wifiCheckoutRunnable = null;

    private void rememberPendingSignal(String key) {
        rememberPendingSignal(key, System.currentTimeMillis());
    }

    private void rememberPendingSignal(String key, long ts) {
        getSharedPreferences(GPS_PREFS, MODE_PRIVATE)
            .edit().putLong(key, ts > 0L ? ts : System.currentTimeMillis()).apply();
    }

    private void clearPendingSignal(String key) {
        getSharedPreferences(GPS_PREFS, MODE_PRIVATE)
            .edit().remove(key).apply();
    }

    private long pendingSignalTs(String key, int fallbackMinutes) {
        long ts = getSharedPreferences(GPS_PREFS, MODE_PRIVATE).getLong(key, 0L);
        if (ts <= 0L) {
            ts = System.currentTimeMillis() - Math.max(1, fallbackMinutes) * 60_000L;
        }
        return ts;
    }

    private Calendar calendarFromPendingSignal(String key, int fallbackMinutes) {
        Calendar c = Calendar.getInstance();
        long delayMs = Math.max(1, fallbackMinutes) * 60_000L;
        // Call sites keep the old "subtract delay" line; pre-add it so final time is signal start.
        c.setTimeInMillis(pendingSignalTs(key, fallbackMinutes) + delayMs);
        return c;
    }

    private void scheduleWifiCheckin() {
        if (wifiCheckinRunnable != null) return; // đã schedule
        if (!canStartNewAutoCycle()) return;
        String todayKey = makeDateKey(Calendar.getInstance());
        AttendanceFlags flags = readAttendanceFlags(todayKey);
        if (flags.hasIn) return; // đã chấm rồi

        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int minutes = Math.max(1, prefs.getInt("checkinMin", 5));
        long delayMs = Math.max(60_000L, minutes * 60_000L);
        rememberPendingSignal(KEY_PENDING_WIFI_CHECKIN_TS);

        wifiCheckinRunnable = new Runnable() {
            @Override public void run() {
                wifiCheckinRunnable = null;
                // Kiểm tra lại tại thời điểm chấm: Wi-Fi công ty vẫn còn match
                if (hasSmartWorkWifiProfile() && isAtSmartWorkWifiBySignals()) {
                    doNativeWifiCheckin();
                }
            }
        };
        handler.postDelayed(wifiCheckinRunnable, delayMs);
        android.util.Log.d("NativeGps", "Wi-Fi checkin scheduled in " + minutes + " min");
    }

    private void scheduleWifiCheckout() {
        if (wifiCheckoutRunnable != null) return;
        String todayKey = makeDateKey(Calendar.getInstance());
        AttendanceFlags flags = readAttendanceFlags(todayKey);
        boolean hasOpenIn = flags.hasIn && !flags.hasOut;
        if (!hasOpenIn) {
            // Thử ngày hôm qua (ca qua đêm)
            Calendar yest = Calendar.getInstance();
            yest.add(Calendar.DATE, -1);
            AttendanceFlags yFlags = readAttendanceFlags(makeDateKey(yest));
            if (!(yFlags.hasIn && !yFlags.hasOut)) return; // không có IN mở
        }

        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int minutes = Math.max(1, prefs.getInt("checkoutMin", 75));
        long delayMs = Math.max(60_000L, minutes * 60_000L);
        rememberPendingSignal(KEY_PENDING_WIFI_CHECKOUT_TS);

        wifiCheckoutRunnable = new Runnable() {
            @Override public void run() {
                wifiCheckoutRunnable = null;
                // FIX P0 #8: bỏ điều kiện !isJsAliveSmart() — sau 80p chờ ở Wi-Fi nhà
                // là tín hiệu CHẮC CHẮN user đã về. Native cứ checkout, dù JS có "alive"
                // (heartbeat < 5p) trong lúc đợi.
                // doNativeWifiCheckout có guard hasOut check nên KHÔNG có double-checkout
                // nếu JS đã kịp chấm trước.
                if (hasSmartHomeWifiProfile() && isAtSmartHomeWifiBySignals()) {
                    doNativeWifiCheckout();
                }
            }
        };
        handler.postDelayed(wifiCheckoutRunnable, delayMs);
        android.util.Log.d("NativeGps", "Wi-Fi checkout scheduled in " + minutes + " min");
    }

    private void cancelWifiCheckin() {
        if (wifiCheckinRunnable != null) {
            handler.removeCallbacks(wifiCheckinRunnable);
            wifiCheckinRunnable = null;
        }
        clearPendingSignal(KEY_PENDING_WIFI_CHECKIN_TS);
    }

    private void cancelWifiCheckout() {
        if (wifiCheckoutRunnable != null) {
            handler.removeCallbacks(wifiCheckoutRunnable);
            wifiCheckoutRunnable = null;
        }
        clearPendingSignal(KEY_PENDING_WIFI_CHECKOUT_TS);
    }

    /** Chấm vào ca bằng Wi-Fi (không cần GPS verify) */
    private void doNativeWifiCheckin() {
        if (!canStartNewAutoCycle()) return;
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int checkinMin = Math.max(1, prefs.getInt("checkinMin", 5));
        Calendar c = calendarFromPendingSignal(KEY_PENDING_WIFI_CHECKIN_TS, checkinMin);
        c.add(Calendar.MINUTE, -checkinMin); // trừ độ trễ
        String dateKey = makeDateKey(c);
        String timeStr = makeTimeStr(c);

        AttendanceFlags flags = readAttendanceFlags(dateKey);
        if (flags.hasIn && !flags.hasOut) { clearPendingSignal(KEY_PENDING_WIFI_CHECKIN_TS); return; }
        if (flags.hasIn && flags.hasOut) {
            if (flags.outTs <= 0 || (System.currentTimeMillis() - flags.outTs) < 8L * 60 * 60 * 1000) {
                clearPendingSignal(KEY_PENDING_WIFI_CHECKIN_TS);
                return;
            }
        }

        boolean saved = saveAttRecord("IN", dateKey, timeStr, c.getTimeInMillis());
        clearPendingSignal(KEY_PENDING_WIFI_CHECKIN_TS);
        if (!saved) return;
        sendAutoNotif(1001, NotifTranslations.tr(this, "checkinNotifTitle"),
            NotifTranslations.tr(this, "checkinBodyWifi", timeStr));
        updateNotif(NotifTranslations.tr(this, "notifAfterCheckin", timeStr, "Wi-Fi"));
        android.util.Log.d("NativeGps", "Wi-Fi auto CHECKIN " + dateKey + " " + timeStr);
    }

    /** Chấm ra ca bằng Wi-Fi nhà (không cần GPS verify) */
    private void doNativeWifiCheckout() {
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int checkoutMin = Math.max(1, prefs.getInt("checkoutMin", 75));
        Calendar c = calendarFromPendingSignal(KEY_PENDING_WIFI_CHECKOUT_TS, checkoutMin);
        c.add(Calendar.MINUTE, -checkoutMin);
        String dateKey = makeDateKey(c);
        String timeStr = makeTimeStr(c);

        // Ưu tiên ngày hôm nay có IN không OUT; nếu không thì ngày hôm qua (ca đêm)
        AttendanceFlags flags = readAttendanceFlags(dateKey);
        if (!(flags.hasIn && !flags.hasOut)) {
            Calendar yest = Calendar.getInstance();
            yest.add(Calendar.DATE, -1);
            String yKey = makeDateKey(yest);
            AttendanceFlags yFlags = readAttendanceFlags(yKey);
            if (yFlags.hasIn && !yFlags.hasOut) {
                dateKey = yKey;
            } else { clearPendingSignal(KEY_PENDING_WIFI_CHECKOUT_TS); return; }
        }

        boolean saved = saveAttRecord("OUT", dateKey, timeStr, c.getTimeInMillis());
        clearPendingSignal(KEY_PENDING_WIFI_CHECKOUT_TS);
        if (!saved) return;
        sendAutoNotif(1002, NotifTranslations.tr(this, "checkoutNotifTitle"),
            NotifTranslations.tr(this, "checkoutBodyWifi", timeStr));
        updateNotif(NotifTranslations.tr(this, "notifAfterCheckout", timeStr, "Wi-Fi"));
        android.util.Log.d("NativeGps", "Wi-Fi auto CHECKOUT " + dateKey + " " + timeStr);
    }

    private void applySmartStateDeadlineAlarms() {
        if (!isSmartAttendanceMode()) {
            cancelSmartCheckin();
            cancelSmartCheckout();
            return;
        }

        String state = getSmartState();
        if ("WAIT_CHECKIN_CONFIRM".equals(state)) scheduleSmartCheckinDeadline();
        else cancelSmartCheckin();

        if ("WAIT_CHECKOUT_CONFIRM".equals(state)) scheduleSmartCheckoutDeadline();
        else cancelSmartCheckout();
    }

    private void scheduleSmartCheckinDeadline() {
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        long windowStart = prefs.getLong("smartCheckinWindowStart", 0L);
        if (windowStart <= 0L || !canStartNewAutoCycle()) {
            cancelSmartCheckin();
            return;
        }

        int minutes = Math.max(1, prefs.getInt("checkinMin", 20));
        long triggerAt = windowStart + minutes * 60_000L;
        if (smartCheckinRunnable != null && Math.abs(smartCheckinTriggerAt - triggerAt) < 5000L) return;

        cancelSmartCheckinTimerOnly();
        rememberPendingSignal(KEY_PENDING_SMART_CHECKIN_TS, windowStart);
        smartCheckinTriggerAt = triggerAt;
        long delayMs = triggerAt - System.currentTimeMillis();
        smartCheckinRunnable = () -> {
            smartCheckinRunnable = null;
            smartCheckinTriggerAt = 0L;
            cancelServiceAlarm(ACTION_SMART_CHECKIN, REQ_SMART_CHECKIN);
            doSmartAutoCheckin();
        };
        if (delayMs <= 0L) {
            handler.post(smartCheckinRunnable);
        } else {
            handler.postDelayed(smartCheckinRunnable, delayMs);
            scheduleServiceAlarm(ACTION_SMART_CHECKIN, REQ_SMART_CHECKIN, triggerAt);
        }
        android.util.Log.d("NativeGps", "Smart checkin deadline scheduled at " + triggerAt);
    }

    private void scheduleSmartCheckoutDeadline() {
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        long windowStart = prefs.getLong("smartCheckoutWindowStart", 0L);
        if (windowStart <= 0L) {
            cancelSmartCheckout();
            return;
        }

        int minutes = Math.max(1, prefs.getInt("checkoutMin", 80));
        long triggerAt = windowStart + minutes * 60_000L;
        if (smartCheckoutRunnable != null && Math.abs(smartCheckoutTriggerAt - triggerAt) < 5000L) return;

        cancelSmartCheckoutTimerOnly();
        rememberPendingSignal(KEY_PENDING_SMART_CHECKOUT_TS, windowStart);
        smartCheckoutTriggerAt = triggerAt;
        long delayMs = triggerAt - System.currentTimeMillis();
        smartCheckoutRunnable = () -> {
            smartCheckoutRunnable = null;
            smartCheckoutTriggerAt = 0L;
            cancelServiceAlarm(ACTION_SMART_CHECKOUT, REQ_SMART_CHECKOUT);
            doSmartAutoCheckout();
        };
        if (delayMs <= 0L) {
            handler.post(smartCheckoutRunnable);
        } else {
            handler.postDelayed(smartCheckoutRunnable, delayMs);
            scheduleServiceAlarm(ACTION_SMART_CHECKOUT, REQ_SMART_CHECKOUT, triggerAt);
        }
        android.util.Log.d("NativeGps", "Smart checkout deadline scheduled at " + triggerAt);
    }

    private void cancelSmartCheckin() {
        cancelSmartCheckinTimerOnly();
        clearPendingSignal(KEY_PENDING_SMART_CHECKIN_TS);
    }

    private void cancelSmartCheckinTimerOnly() {
        if (smartCheckinRunnable != null) {
            handler.removeCallbacks(smartCheckinRunnable);
            smartCheckinRunnable = null;
        }
        smartCheckinTriggerAt = 0L;
        cancelServiceAlarm(ACTION_SMART_CHECKIN, REQ_SMART_CHECKIN);
    }

    private void cancelSmartCheckout() {
        cancelSmartCheckoutTimerOnly();
        clearPendingSignal(KEY_PENDING_SMART_CHECKOUT_TS);
    }

    private void cancelSmartCheckoutTimerOnly() {
        if (smartCheckoutRunnable != null) {
            handler.removeCallbacks(smartCheckoutRunnable);
            smartCheckoutRunnable = null;
        }
        smartCheckoutTriggerAt = 0L;
        cancelServiceAlarm(ACTION_SMART_CHECKOUT, REQ_SMART_CHECKOUT);
    }

    private boolean shouldUseGpsForSmartMode() {
        if (!isSmartAttendanceMode()) return true;
        String state = getSmartState();

        // Wi-Fi radio tắt → KHÔNG dùng Wi-Fi được → buộc dùng GPS (backup)
        if (!isWifiRadioEnabled()) return true;

        if ("WORKING_WIFI".equals(state) && hasSmartWorkWifiProfile() && isAtSmartWorkWifiBySignals()) {
            return false;
        }

        if (isSmartHomeRestState(state)) {
            if (hasSmartHomeWifiProfile() && isAtSmartHomeWifiBySignals()) return false;
            if (hasUsableSmartBtsProfile(smartProfileArray("smartHomeBts"))) {
                return !isAtSmartHomeBtsBySignals();
            }
            return isNearSmartShiftStart();
        }

        return true;
    }

    /** Kiểm tra Wi-Fi radio có đang bật không */
    private boolean isWifiRadioEnabled() {
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            return wm != null && wm.isWifiEnabled();
        } catch (Exception e) {
            return true; // không biết được → coi như bật (an toàn)
        }
    }

    private String buildSmartPausedNotification() {
        String state = getSmartState();
        if ("WORKING_WIFI".equals(state)) {
            return NotifTranslations.tr(this, "pausedWorkWifi");
        }
        if (isSmartHomeRestState(state)) {
            return NotifTranslations.tr(this, "pausedHomeSignal");
        }
        return NotifTranslations.tr(this, "pausedWifiBts");
    }

    private String getSmartState() {
        return getSharedPreferences(GPS_PREFS, MODE_PRIVATE).getString("smartState", "");
    }

    private boolean isSmartHomeRestState(String state) {
        return state == null || state.length() == 0
            || "HOME".equals(state)
            || "CHECKED_OUT".equals(state);
    }

    private boolean hasSmartHomeProfile() {
        return smartProfileArray("smartHomeWifi").length() > 0
            || hasUsableSmartBtsProfile(smartProfileArray("smartHomeBts"));
    }

    private boolean hasSmartHomeWifiProfile() {
        return smartProfileArray("smartHomeWifi").length() > 0;
    }

    private boolean hasSmartWorkWifiProfile() {
        return smartProfileArray("smartWorkWifi").length() > 0;
    }

    private boolean isAtSmartHomeWifiBySignals() {
        return matchSmartWifiSignal("smartHomeWifi");
    }

    private boolean isAtSmartWorkWifiBySignals() {
        return matchSmartWifiSignal("smartWorkWifi");
    }

    private boolean matchSmartWifiSignal(String profileKey) {
        JSONArray profile = smartProfileArray(profileKey);
        if (profile.length() == 0) return false;

        SharedPreferences signals = getSharedPreferences(SIGNAL_PREFS, MODE_PRIVATE);
        return signals.getBoolean("wifiConnected", false)
            && matchSmartWifiProfile(
                profile,
                signals.getString("wifiSsid", ""),
                signals.getString("wifiBssid", "")
            );
    }

    private boolean isAtSmartHomeBtsBySignals() {
        JSONArray homeBts = smartProfileArray("smartHomeBts");
        if (!hasUsableSmartBtsProfile(homeBts)) return false;

        SharedPreferences signals = getSharedPreferences(SIGNAL_PREFS, MODE_PRIVATE);
        return matchSmartBtsProfile(
            homeBts,
            signals.getLong("cellId", -1L),
            signals.getInt("lac", -1)
        );
    }

    private boolean isNearSmartShiftStart() {
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int inMin = prefs.getInt("scheduleInMin", 8 * 60);
        Calendar now = Calendar.getInstance();
        int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int diff = nowMin - inMin;
        if (diff > 12 * 60) diff -= 24 * 60;
        if (diff < -12 * 60) diff += 24 * 60;
        return diff >= -SMART_HOME_GPS_BEFORE_SHIFT_MIN
            && diff <= SMART_HOME_GPS_AFTER_SHIFT_MIN;
    }

    private boolean isAtSmartHomeBySignals() {
        JSONArray homeWifi = smartProfileArray("smartHomeWifi");
        JSONArray homeBts = smartProfileArray("smartHomeBts");
        boolean hasHomeBts = hasUsableSmartBtsProfile(homeBts);
        if (homeWifi.length() == 0 && !hasHomeBts) return false;

        SharedPreferences signals = getSharedPreferences(SIGNAL_PREFS, MODE_PRIVATE);
        boolean wifiConnected = signals.getBoolean("wifiConnected", false);
        boolean wifiMatch = homeWifi.length() > 0
            && wifiConnected
            && matchSmartWifiProfile(
                homeWifi,
                signals.getString("wifiSsid", ""),
                signals.getString("wifiBssid", "")
            );
        if (wifiMatch) return true;
        if (homeWifi.length() > 0 && wifiConnected) return false;

        return hasHomeBts && matchSmartBtsProfile(
            homeBts,
            signals.getLong("cellId", -1L),
            signals.getInt("lac", -1)
        );
    }

    private JSONArray smartProfileArray(String key) {
        String raw = getSharedPreferences(GPS_PREFS, MODE_PRIVATE).getString(key, "[]");
        try {
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private boolean matchSmartWifiProfile(JSONArray profile, String ssid, String bssid) {
        String currentSsid = normalizeWifiId(ssid);
        String currentBssid = normalizeWifiId(bssid).toLowerCase(Locale.US);
        for (int i = 0; i < profile.length(); i++) {
            JSONObject item = profile.optJSONObject(i);
            if (item == null) continue;
            String savedBssid = normalizeWifiId(item.optString("bssid", "")).toLowerCase(Locale.US);
            if (savedBssid.length() > 0 && savedBssid.equals(currentBssid)) return true;
            String savedSsid = normalizeWifiId(item.optString("ssid", ""));
            if (savedSsid.length() > 0 && savedSsid.equals(currentSsid)) return true;
        }
        return false;
    }

    private String normalizeWifiId(String value) {
        if (value == null) return "";
        String out = value.trim();
        if (out.startsWith("\"") && out.endsWith("\"") && out.length() >= 2) {
            out = out.substring(1, out.length() - 1);
        }
        return "<unknown ssid>".equals(out) ? "" : out;
    }

    private boolean matchSmartBtsProfile(JSONArray profile, long cellId, int lac) {
        if (cellId <= 0L) return false;
        for (int i = 0; i < profile.length(); i++) {
            JSONObject item = profile.optJSONObject(i);
            if (item == null) continue;
            if (isAmbiguousSmartBts(item)) continue;
            long savedCellId = item.optLong("cellId", Long.MIN_VALUE);
            int savedLac = item.has("lac") ? item.optInt("lac", -1) : -1;
            if (savedCellId == cellId && (savedLac < 0 || savedLac == lac)) return true;
        }
        return false;
    }

    private boolean hasUsableSmartBtsProfile(JSONArray profile) {
        for (int i = 0; i < profile.length(); i++) {
            JSONObject item = profile.optJSONObject(i);
            if (item == null) continue;
            long cellId = item.optLong("cellId", -1L);
            if (cellId <= 0L) continue;
            if (!isAmbiguousSmartBts(item)) return true;
        }
        return false;
    }

    private boolean isAmbiguousSmartBts(JSONObject item) {
        if (item == null) return false;
        long cellId = item.optLong("cellId", -1L);
        int lac = item.has("lac") ? item.optInt("lac", -1) : -1;
        if (cellId <= 0L) return false;
        return smartBtsArrayHas(smartProfileArray("smartHomeBts"), cellId, lac)
            && smartBtsArrayHas(smartProfileArray("smartWorkBts"), cellId, lac);
    }

    private boolean smartBtsArrayHas(JSONArray profile, long cellId, int lac) {
        for (int i = 0; i < profile.length(); i++) {
            JSONObject item = profile.optJSONObject(i);
            if (item == null) continue;
            long savedCellId = item.optLong("cellId", Long.MIN_VALUE);
            int savedLac = item.has("lac") ? item.optInt("lac", -1) : -1;
            if (savedCellId == cellId && (savedLac < 0 || savedLac == lac)) return true;
        }
        return false;
    }

    private void checkGeofence(Location location) {
        // Đọc và lưu Wi-Fi + BTS cho smart-attendance.js
        readAndStoreSmartSignals();

        // ── FIX WARNING: GPS → Brain v2 feedback ─────────────────────────────
        // Ghi GPS fix vào cc_brain_state để AttendanceBrain.checkWorkSignal() đọc
        // khi app bị kill và JS không thể gọi updateGpsResult().
        if (isBrainV2Enabled(this)) {
            double lat = location.getLatitude();
            double lng = location.getLongitude();
            getSharedPreferences(AttendanceState.PREFS_NAME, MODE_PRIVATE).edit()
                .putLong(AttendanceState.KEY_LAST_GPS_LAT, Double.doubleToLongBits(lat))
                .putLong(AttendanceState.KEY_LAST_GPS_LNG, Double.doubleToLongBits(lng))
                .putLong(AttendanceState.KEY_LAST_GPS_AT, System.currentTimeMillis())
                .apply();
            // Trigger Brain evaluate với GPS mới (chạy thread riêng tránh block callback)
            final Context appCtx = getApplicationContext();
            new Thread(() -> {
                try {
                    AttendanceBrain.get().evaluate(appCtx, "gps_service_fix");
                } catch (Exception e) {
                    android.util.Log.w("NativeGps",
                        "Brain gps_service_fix eval error: " + e.getMessage());
                }
            }, "Brain-gps-fix").start();
        }

        GeofenceDecision decision = buildGeofenceDecision(location);
        if (!decision.hasTarget) return;

        // Chỉ nhường cho JS khi smart mode bật VÀ JS còn sống.
        // JS chết (màn hình tắt > 5p) → native tự xử lý bằng GPS thuần ở dưới.
        android.util.Log.d("NativeGps",
            "dist=" + Math.round(decision.distance) +
            "m radius=" + decision.radius +
            "m exit=" + Math.round(decision.exitRadius) +
            "m acc=" + Math.round(decision.accuracy) +
            "m provider=" + location.getProvider() +
            " inside=" + decision.inside +
            " outside=" + decision.outside +
            " state=" + wasInside);

        if (decision.inside) {
            lastDecisionLocation = new Location(location);
            insideConfirmCount++;
            outsideConfirmCount = 0;
            cancelCheckout();

            if (wasInside == null || !wasInside) {
                if (insideConfirmCount >= INSIDE_CONFIRM_REQUIRED) {
                    wasInside = true;
                    scheduleCheckin();
                }
            }
            return;
        }

        if (!decision.outside) {
            insideConfirmCount = 0;
            outsideConfirmCount = 0;
            android.util.Log.d("NativeGps", "buffer zone — no state change");
            return;
        }

        if (!decision.reliableOutside) {
            insideConfirmCount = 0;
            android.util.Log.d("NativeGps", "outside ignored: weak or network-only fix");
            return;
        }

        lastDecisionLocation = new Location(location);
        outsideConfirmCount++;
        insideConfirmCount = 0;
        cancelInsideScheduleCheckout();

        if (wasInside == null) {
            wasInside = false;
            if (outsideConfirmCount >= OUTSIDE_CONFIRM_REQUIRED) {
                cancelCheckin();
                scheduleCheckout();
            }
            return;
        }

        if (wasInside) {
            if (outsideConfirmCount >= OUTSIDE_CONFIRM_REQUIRED) {
                wasInside = false;
                cancelCheckin();
                scheduleCheckout();
            } else {
                android.util.Log.d("NativeGps", "outside pending " + outsideConfirmCount + "/" + OUTSIDE_CONFIRM_REQUIRED);
            }
        } else if (checkoutRunnable == null && outsideConfirmCount >= OUTSIDE_CONFIRM_REQUIRED) {
            scheduleCheckout();
        }
    }

    private static class SmartGpsProfile {
        boolean valid;
        double lat;
        double lng;
        float radius;
    }

    private SmartGpsProfile smartGpsProfile(String key, float fallbackRadius) {
        SmartGpsProfile p = new SmartGpsProfile();
        String raw = getSharedPreferences(GPS_PREFS, MODE_PRIVATE).getString(key, "null");
        try {
            JSONObject obj = new JSONObject(raw);
            double lat = obj.optDouble("lat", Double.NaN);
            double lng = obj.optDouble("lng", Double.NaN);
            if (Double.isNaN(lat) || Double.isNaN(lng) || (lat == 0d && lng == 0d)) return p;
            p.valid = true;
            p.lat = lat;
            p.lng = lng;
            double r = obj.optDouble("radius", fallbackRadius);
            p.radius = (float) ((Double.isNaN(r) || r <= 0d) ? fallbackRadius : r);
        } catch (Exception ignored) {}
        return p;
    }

    private float distanceMeters(double fromLat, double fromLng, double toLat, double toLng) {
        float[] out = new float[1];
        Location.distanceBetween(fromLat, fromLng, toLat, toLng, out);
        return out[0];
    }

    private static class GeofenceDecision {
        boolean hasTarget;
        boolean inside;
        boolean outside;
        boolean reliableOutside;
        float distance;
        float radius;
        float accuracy;
        float exitRadius;
    }

    private GeofenceDecision buildGeofenceDecision(Location location) {
        GeofenceDecision d = new GeofenceDecision();
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);

        long latBits = prefs.getLong("lat", 0L);
        long lngBits = prefs.getLong("lng", 0L);
        if (latBits == 0L && lngBits == 0L) return d;

        double targetLat = Double.longBitsToDouble(latBits);
        double targetLng = Double.longBitsToDouble(lngBits);
        float radius = prefs.getFloat("radius", 15f);
        float accuracy = location.hasAccuracy() ? Math.max(0f, location.getAccuracy()) : 60f;
        float exitBuffer = Math.min(MAX_EXIT_BUFFER_M, Math.max(MIN_EXIT_BUFFER_M, accuracy * 2.5f));

        float distance = distanceMeters(
            location.getLatitude(), location.getLongitude(),
            targetLat, targetLng
        );
        float effectiveRadius = radius;
        boolean homeCloserAtCloseProfile = false;

        if (prefs.getBoolean("smartAttendanceMode", false)) {
            SmartGpsProfile homeGps = smartGpsProfile("smartHomeGps", 200f);
            SmartGpsProfile workGps = smartGpsProfile("smartWorkGps", radius);
            if (homeGps.valid && workGps.valid) {
                float homeWorkDistance = distanceMeters(homeGps.lat, homeGps.lng, workGps.lat, workGps.lng);
                if (homeWorkDistance <= SMART_GPS_HOME_WORK_CLOSE_M) {
                    float homeDistance = distanceMeters(location.getLatitude(), location.getLongitude(), homeGps.lat, homeGps.lng);
                    float workDistance = distanceMeters(location.getLatitude(), location.getLongitude(), workGps.lat, workGps.lng);
                    distance = workDistance;
                    effectiveRadius = Math.max(radius, Math.min(workGps.radius, SMART_GPS_CLOSE_PROFILE_MAX_RADIUS_M));
                    homeCloserAtCloseProfile = homeDistance + SMART_GPS_HOME_WORK_MARGIN_M < workDistance
                        && homeDistance <= (Math.max(homeGps.radius, 200f) + exitBuffer);
                }
            }
        }

        d.hasTarget = true;
        d.distance = distance;
        d.radius = effectiveRadius;
        d.accuracy = accuracy;
        d.exitRadius = effectiveRadius + exitBuffer;
        d.inside = !homeCloserAtCloseProfile && distance <= effectiveRadius;
        d.outside = homeCloserAtCloseProfile || distance > d.exitRadius;
        boolean gpsProvider = LocationManager.GPS_PROVIDER.equals(location.getProvider());
        boolean networkCanProveExit = distance > effectiveRadius + Math.max(NETWORK_OUTSIDE_EXTRA_M, exitBuffer * 3f);
        d.reliableOutside = (location.hasAccuracy() && accuracy <= MAX_OUTSIDE_ACCURACY_M)
            && (gpsProvider || networkCanProveExit);
        return d;
    }

    private Location getFreshBestLocation(long maxAgeMs) {
        LocationManager lm = locationManager != null
            ? locationManager
            : (LocationManager) getSystemService(LOCATION_SERVICE);
        if (lm == null) return null;

        Location best = null;
        String[] providers = new String[] {
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER
        };

        for (String provider : providers) {
            try {
                Location loc = lm.getLastKnownLocation(provider);
                if (loc == null) continue;
                long age = System.currentTimeMillis() - loc.getTime();
                if (age < 0 || age > maxAgeMs) continue;
                if (best == null) {
                    best = loc;
                    continue;
                }
                boolean locIsGps = LocationManager.GPS_PROVIDER.equals(loc.getProvider());
                boolean bestIsGps = LocationManager.GPS_PROVIDER.equals(best.getProvider());
                if (locIsGps && !bestIsGps) {
                    best = loc;
                } else if (locIsGps == bestIsGps) {
                    boolean locBetterAccuracy = loc.hasAccuracy() && (!best.hasAccuracy() || loc.getAccuracy() < best.getAccuracy());
                    if (locBetterAccuracy || (!best.hasAccuracy() && loc.getTime() > best.getTime())) best = loc;
                }
            } catch (SecurityException ignored) {
            } catch (Exception ignored) {}
        }
        return best;
    }

    private boolean hasFreshOutsideFixForCheckout() {
        Location loc = getFreshBestLocation(CHECKOUT_FIX_MAX_AGE_MS);
        if (loc == null && lastDecisionLocation != null) {
            long age = System.currentTimeMillis() - lastDecisionLocation.getTime();
            if (age >= 0 && age <= CHECKOUT_FIX_MAX_AGE_MS) loc = lastDecisionLocation;
        }
        if (loc == null) {
            android.util.Log.d("NativeGps", "checkout guard: no fresh location");
            return false;
        }

        GeofenceDecision d = buildGeofenceDecision(loc);
        if (!d.hasTarget) return false;
        if (d.inside) {
            wasInside = true;
            insideConfirmCount = 1;
            outsideConfirmCount = 0;
            cancelCheckout();
            android.util.Log.d("NativeGps", "checkout guard: fresh fix is inside");
            return false;
        }
        boolean ok = d.outside && d.reliableOutside;
        android.util.Log.d("NativeGps",
            "checkout guard: dist=" + Math.round(d.distance) +
            " exit=" + Math.round(d.exitRadius) +
            " acc=" + Math.round(d.accuracy) +
            " provider=" + loc.getProvider() +
            " ok=" + ok);
        return ok;
    }

    // ──────────────────────────────────────────────────────────────
    //  Debounce timers
    // ──────────────────────────────────────────────────────────────

    private static class AttendanceFlags {
        boolean hasIn;
        boolean hasOut;
        long inTs;
        long outTs;
    }

    private static class OpenShiftInfo {
        String dateKey;
        long inTs;
    }

    private AttendanceFlags readAttendanceFlags(String dateKey) {
        dateKey = normalizeDateKey(dateKey);
        AttendanceFlags flags = new AttendanceFlags();
        mergeJsAttendanceState(flags, dateKey);

        SharedPreferences attPrefs = getSharedPreferences(ATT_PREFS, MODE_PRIVATE);
        String raw = attPrefs.getString(ATT_KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject rec = arr.getJSONObject(i);
                if (!sameDateKey(dateKey, rec.optString("date"))) continue;
                long ts = rec.optLong("ts", 0);
                if ("IN".equals(rec.optString("type"))) {
                    flags.hasIn = true;
                    if (ts > flags.inTs) flags.inTs = ts;
                } else if ("OUT".equals(rec.optString("type"))) {
                    flags.hasOut = true;
                    if (ts > flags.outTs) flags.outTs = ts;
                }
            }
        } catch (Exception ignored) {}
        return flags;
    }

    private void mergeJsAttendanceState(AttendanceFlags flags, String dateKey) {
        SharedPreferences state = getSharedPreferences(STATE_PREFS, MODE_PRIVATE);
        mergeJsAttendanceStatePrefix(flags, state, "today", dateKey);
        mergeJsAttendanceStatePrefix(flags, state, "yesterday", dateKey);
    }

    private void mergeJsAttendanceStatePrefix(AttendanceFlags flags, SharedPreferences state, String prefix, String dateKey) {
        if (!sameDateKey(dateKey, state.getString(prefix + "Date", ""))) return;
        if (state.getBoolean(prefix + "HasIn", false)) {
            flags.hasIn = true;
            flags.inTs = Math.max(flags.inTs, state.getLong(prefix + "InTs", 0L));
        }
        if (state.getBoolean(prefix + "HasOut", false)) {
            flags.hasOut = true;
            flags.outTs = Math.max(flags.outTs, state.getLong(prefix + "OutTs", 0L));
        }
    }

    private long getLastCheckoutTs() {
        long best = getSharedPreferences(STATE_PREFS, MODE_PRIVATE).getLong("lastOutTs", 0L);
        SharedPreferences attPrefs = getSharedPreferences(ATT_PREFS, MODE_PRIVATE);
        String raw = attPrefs.getString(ATT_KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject rec = arr.getJSONObject(i);
                if ("OUT".equals(rec.optString("type"))) {
                    best = Math.max(best, rec.optLong("ts", 0L));
                }
            }
        } catch (Exception ignored) {}
        return best;
    }

    private long fallbackInTsFromDateKey(String dateKey) {
        Calendar c = calendarFromDateKey(dateKey);
        if (c == null) return 0L;
        return c.getTimeInMillis();
    }

    private OpenShiftInfo findLatestOpenShiftInfo() {
        OpenShiftInfo best = null;
        try {
            java.util.HashSet<String> dateKeys = new java.util.HashSet<>();

            SharedPreferences attPrefs = getSharedPreferences(ATT_PREFS, MODE_PRIVATE);
            String raw = attPrefs.getString(ATT_KEY, "[]");
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject rec = arr.getJSONObject(i);
                String date = rec.optString("date", "");
                if (!date.isEmpty()) dateKeys.add(normalizeDateKey(date));
            }

            SharedPreferences state = getSharedPreferences(STATE_PREFS, MODE_PRIVATE);
            String todayDate = state.getString("todayDate", "");
            String yesterdayDate = state.getString("yesterdayDate", "");
            if (todayDate != null && !todayDate.isEmpty()) dateKeys.add(normalizeDateKey(todayDate));
            if (yesterdayDate != null && !yesterdayDate.isEmpty()) dateKeys.add(normalizeDateKey(yesterdayDate));

            for (String key : dateKeys) {
                AttendanceFlags flags = readAttendanceFlags(key);
                if (!flags.hasIn || flags.hasOut) continue;
                long inTs = flags.inTs > 0L ? flags.inTs : fallbackInTsFromDateKey(key);
                if (inTs <= 0L) continue;
                if (best == null || inTs > best.inTs) {
                    best = new OpenShiftInfo();
                    best.dateKey = key;
                    best.inTs = inTs;
                }
            }
        } catch (Exception ignored) {}
        return best;
    }

    private void notifyOpenShiftIfNeeded(OpenShiftInfo info) {
        if (info == null || info.inTs <= 0L) return;
        long now = System.currentTimeMillis();
        long elapsed = now - info.inTs;
        if (elapsed < OPEN_SHIFT_CONFIRM_MS) {
            updateNotif(NotifTranslations.tr(this, "skipMidCycle"));
            return;
        }

        SharedPreferences gpsPrefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        long lastWarnTs = gpsPrefs.getLong(KEY_OPEN_SHIFT_WARN_TS, 0L);
        if (lastWarnTs > 0L && (now - lastWarnTs) < OPEN_SHIFT_NOTIFY_COOLDOWN_MS) {
            updateNotif("⚠️ Ca cũ chưa checkout >20h. Mở app để xác nhận.");
            return;
        }

        gpsPrefs.edit().putLong(KEY_OPEN_SHIFT_WARN_TS, now).apply();
        int hours = (int) Math.max(20L, elapsed / (60L * 60L * 1000L));
        sendAutoNotif(
            1005,
            "⚠️ Ca trước chưa checkout",
            "Đã hơn " + hours + "h từ lúc vào ca. Mở app để xác nhận checkout trước khi vào ca mới."
        );
        updateNotif("⚠️ Ca cũ chưa checkout >20h. Mở app để xác nhận.");
    }

    private boolean canStartNewAutoCycle() {
        OpenShiftInfo open = findLatestOpenShiftInfo();
        if (open != null) {
            notifyOpenShiftIfNeeded(open);
            return false;
        }
        long lastOutTs = getLastCheckoutTs();
        return lastOutTs <= 0L || (System.currentTimeMillis() - lastOutTs) >= NEW_CYCLE_WAIT_MS;
    }

    private boolean isSmartAttendanceMode() {
        return getSharedPreferences(GPS_PREFS, MODE_PRIVATE).getBoolean("smartAttendanceMode", false);
    }

    /**
     * Kiểm tra JS layer còn sống không (smart-attendance.js).
     * JS heartbeat cập nhật vào "smartJsAliveTs" mỗi lần ping native (~15s).
     * Quá 5 phút không heartbeat → coi như JS đã chết (màn hình tắt, WebView pause).
     */
    private boolean isJsAliveSmart() {
        long lastTs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE).getLong("smartJsAliveTs", 0L);
        if (lastTs <= 0L) return false;
        return (System.currentTimeMillis() - lastTs) < 5L * 60L * 1000L;
    }

    /**
     * Smart mode chỉ "chiếm quyền" khi JS còn sống.
     * Nếu JS chết → native được phép tự chấm công bằng GPS thuần (fallback).
     */
    private boolean isSmartModeWithLiveJs() {
        return isSmartAttendanceMode() && isJsAliveSmart();
    }

    private void scheduleCheckin() {
        // FIX #4: BỎ guard "nhường JS khi alive". Lý do giống fix #8 cho Wi-Fi checkout:
        // JS có thể alive theo heartbeat (< 5p) nhưng WebView bị throttle khi app
        // background → không xử lý kịp. Trước đây native bỏ qua schedule → user vào
        // công ty app ẩn = không ai checkin.
        // Tại thời điểm alarm fire sau 20p, doAutoCheckin có guard hasIn nên nếu JS
        // đã kịp chấm thì sẽ skip → không double-checkin.
        if (!canStartNewAutoCycle()) {
            android.util.Log.d("NativeGps", "scheduleCheckin: blocked by cycle guard (open shift or under 8h)");
            return;
        }
        String todayKey = makeDateKey(Calendar.getInstance());
        AttendanceFlags jsFlags = readAttendanceFlags(todayKey);
        if (jsFlags.hasIn && !jsFlags.hasOut) {
            android.util.Log.d("NativeGps", "scheduleCheckin: mid-cycle, skip");
            updateNotif(NotifTranslations.tr(this, "skipMidCycle"));
            return;
        }
        if (jsFlags.hasIn && jsFlags.hasOut) {
            long eightHoursMs = 8L * 60 * 60 * 1000;
            if (jsFlags.outTs <= 0 || (System.currentTimeMillis() - jsFlags.outTs) < eightHoursMs) {
                android.util.Log.d("NativeGps", "scheduleCheckin: already has in/out, skip");
                updateNotif(NotifTranslations.tr(this, "skipFinishedCycle"));
                return;
            }
        }
        SharedPreferences attPrefs = getSharedPreferences(ATT_PREFS, MODE_PRIVATE);
        String raw = attPrefs.getString(ATT_KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            boolean hasIn = false, hasOut = false;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject rec = arr.getJSONObject(i);
                if (sameDateKey(todayKey, rec.optString("date"))) {
                    if ("IN".equals(rec.optString("type")))  hasIn  = true;
                    if ("OUT".equals(rec.optString("type"))) hasOut = true;
                }
            }
            if (hasIn && !hasOut) {
                android.util.Log.d("NativeGps", "scheduleCheckin: đang mid-cycle — bỏ qua");
                updateNotif(NotifTranslations.tr(this, "skipMidCycle"));
                return;
            }
            if (hasIn && hasOut) {
                long outTs = 0;
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject rec = arr.getJSONObject(i);
                    if ("OUT".equals(rec.optString("type")) && sameDateKey(todayKey, rec.optString("date"))) {
                        outTs = rec.optLong("ts", 0);
                        break;
                    }
                }
                long eightHoursMs = 8L * 60 * 60 * 1000;
                if (outTs > 0 && (System.currentTimeMillis() - outTs) < eightHoursMs) {
                    android.util.Log.d("NativeGps", "scheduleCheckin: chưa đủ 8h — bỏ qua");
                    updateNotif(NotifTranslations.tr(this, "skipFinishedCycle"));
                    return;
                }
            }
        } catch (Exception ignored) {}

        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int minutes = Math.max(1, prefs.getInt("checkinMin", 20));
        cancelCheckin();
        long delayMs = Math.max(60_000L, minutes * 60_000L);
        long triggerAt = System.currentTimeMillis() + delayMs;
        rememberPendingSignal(KEY_PENDING_GPS_CHECKIN_TS);
        checkinRunnable = () -> {
            checkinRunnable = null;
            cancelServiceAlarm(ACTION_AUTO_CHECKIN, REQ_AUTO_CHECKIN);
            doAutoCheckin();
        };
        handler.postDelayed(checkinRunnable, delayMs);
        scheduleServiceAlarm(ACTION_AUTO_CHECKIN, REQ_AUTO_CHECKIN, triggerAt);
        updateNotif(minutes <= 0
            ? NotifTranslations.tr(this, "scheduleCheckinNow")
            : NotifTranslations.tr(this, "scheduleCheckinWait", minutes));
        android.util.Log.d("NativeGps", "Scheduled checkin in " + minutes + " min");
    }

    private void scheduleCheckout() {
        // FIX #3: BỎ guard "nhường JS khi alive" — giống fix #4 cho checkin và #8 cho Wi-Fi.
        // JS có thể alive nhưng đang sleep → không xử lý → trước đây không ai checkout
        // qua đường GPS. Giờ native vẫn schedule, runnable check hasOut tại thời điểm fire.
        String todayKey = makeDateKey(Calendar.getInstance());
        String checkoutKey = todayKey;
        AttendanceFlags jsFlags = readAttendanceFlags(todayKey);
        if (!jsFlags.hasIn || jsFlags.hasOut) {
            OpenShiftInfo open = findLatestOpenShiftInfo();
            if (open != null && open.dateKey != null) {
                checkoutKey = open.dateKey;
                jsFlags = readAttendanceFlags(checkoutKey);
            }
        }
        if (jsFlags.hasOut) {
            android.util.Log.d("NativeGps", "scheduleCheckout: already out, skip");
            return;
        }
        if (!jsFlags.hasIn) {
            android.util.Log.d("NativeGps", "scheduleCheckout: no checkin yet, skip");
            return;
        }
        SharedPreferences attPrefs = getSharedPreferences(ATT_PREFS, MODE_PRIVATE);
        String raw = attPrefs.getString(ATT_KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            boolean hasIn = false, hasOut = false;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject rec = arr.getJSONObject(i);
                if (sameDateKey(checkoutKey, rec.optString("date"))) {
                    if ("IN".equals(rec.optString("type")))  hasIn  = true;
                    if ("OUT".equals(rec.optString("type"))) hasOut = true;
                }
            }
            if (hasOut) { android.util.Log.d("NativeGps", "scheduleCheckout: đã ra ca — bỏ qua"); return; }
            if (!hasIn) { android.util.Log.d("NativeGps", "scheduleCheckout: chưa vào ca — bỏ qua"); return; }
        } catch (Exception ignored) {}

        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int minutes = Math.max(1, prefs.getInt("checkoutMin", 80));
        cancelCheckout();
        long delayMs = Math.max(60_000L, minutes * 60_000L);
        long triggerAt = System.currentTimeMillis() + delayMs;
        rememberPendingSignal(KEY_PENDING_GPS_CHECKOUT_TS);
        checkoutRunnable = () -> {
            checkoutRunnable = null;
            cancelServiceAlarm(ACTION_AUTO_CHECKOUT, REQ_AUTO_CHECKOUT);
            doAutoCheckout();
        };
        handler.postDelayed(checkoutRunnable, delayMs);
        scheduleServiceAlarm(ACTION_AUTO_CHECKOUT, REQ_AUTO_CHECKOUT, triggerAt);
        android.util.Log.d("NativeGps", "Scheduled checkout in " + minutes + " min");
    }

    private void cancelCheckin() {
        cancelCheckinTimerOnly();
        clearPendingSignal(KEY_PENDING_GPS_CHECKIN_TS);
    }

    private void cancelCheckinTimerOnly() {
        if (checkinRunnable != null) { handler.removeCallbacks(checkinRunnable); checkinRunnable = null; }
        cancelServiceAlarm(ACTION_AUTO_CHECKIN, REQ_AUTO_CHECKIN);
    }

    private void cancelCheckout() {
        cancelCheckoutTimerOnly();
        clearPendingSignal(KEY_PENDING_GPS_CHECKOUT_TS);
    }

    private void cancelCheckoutTimerOnly() {
        if (checkoutRunnable != null) { handler.removeCallbacks(checkoutRunnable); checkoutRunnable = null; }
        cancelServiceAlarm(ACTION_AUTO_CHECKOUT, REQ_AUTO_CHECKOUT);
    }

    private void scheduleInsideScheduleCheckout() {
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean("insideScheduleOut", false)) {
            cancelInsideScheduleCheckout();
            return;
        }

        String dateKey = findOpenAttendanceKeyForSchedule();
        if (dateKey == null) {
            cancelInsideScheduleCheckout();
            return;
        }

        Calendar target = buildInsideScheduleTarget(dateKey);
        if (target == null) return;

        long triggerAt = target.getTimeInMillis();
        long now = System.currentTimeMillis();
        if (triggerAt <= now) {
            cancelInsideScheduleCheckout();
            doInsideScheduleCheckout();
            return;
        }

        if (insideScheduleCheckoutRunnable != null && Math.abs(insideScheduleTriggerAt - triggerAt) < 60_000L) {
            return;
        }

        cancelInsideScheduleCheckout();
        long delayMs = triggerAt - now;
        insideScheduleTriggerAt = triggerAt;
        insideScheduleCheckoutRunnable = () -> {
            insideScheduleCheckoutRunnable = null;
            insideScheduleTriggerAt = 0L;
            cancelServiceAlarm(ACTION_INSIDE_SCHEDULE_CHECKOUT, REQ_INSIDE_SCHEDULE_CHECKOUT);
            doInsideScheduleCheckout();
        };
        handler.postDelayed(insideScheduleCheckoutRunnable, delayMs);
        scheduleServiceAlarm(ACTION_INSIDE_SCHEDULE_CHECKOUT, REQ_INSIDE_SCHEDULE_CHECKOUT, triggerAt);
        android.util.Log.d("NativeGps", "Scheduled inside-company checkout at " + makeTimeStr(target) + " for " + dateKey);
    }

    private void cancelInsideScheduleCheckout() {
        if (insideScheduleCheckoutRunnable != null) {
            handler.removeCallbacks(insideScheduleCheckoutRunnable);
            insideScheduleCheckoutRunnable = null;
        }
        insideScheduleTriggerAt = 0L;
        cancelServiceAlarm(ACTION_INSIDE_SCHEDULE_CHECKOUT, REQ_INSIDE_SCHEDULE_CHECKOUT);
    }

    private String findOpenAttendanceKeyForSchedule() {
        Calendar today = Calendar.getInstance();
        String todayKey = makeDateKey(today);
        AttendanceFlags todayFlags = readAttendanceFlags(todayKey);
        if (todayFlags.hasIn && !todayFlags.hasOut) return todayKey;

        Calendar yesterday = Calendar.getInstance();
        yesterday.add(Calendar.DATE, -1);
        String yesterdayKey = makeDateKey(yesterday);
        AttendanceFlags yesterdayFlags = readAttendanceFlags(yesterdayKey);
        if (yesterdayFlags.hasIn && !yesterdayFlags.hasOut) return yesterdayKey;
        return null;
    }

    private Calendar buildInsideScheduleTarget(String dateKey) {
        Calendar c = calendarFromDateKey(dateKey);
        if (c == null) return null;
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int inMin = prefs.getInt("scheduleInMin", 8 * 60);
        int outMin = prefs.getInt("scheduleOutMin", 17 * 60);
        if (outMin < 0 || outMin >= 24 * 60) return null;
        if (inMin < 0 || inMin >= 24 * 60) inMin = 8 * 60;
        c.set(Calendar.HOUR_OF_DAY, outMin / 60);
        c.set(Calendar.MINUTE, outMin % 60);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (outMin <= inMin) c.add(Calendar.DATE, 1);
        return c;
    }

    private Calendar calendarFromDateKey(String dateKey) {
        try {
            String[] parts = dateKey.split("-");
            if (parts.length != 3) return null;
            String monthPart = parts[1];
            String dayPart = parts[2];
            int rawMonth = Integer.parseInt(monthPart);
            int day = Integer.parseInt(dayPart);
            boolean legacyZeroBased = monthPart.length() < 2 || dayPart.length() < 2 || rawMonth == 0;
            int month = legacyZeroBased ? rawMonth : rawMonth - 1;
            if (month < 0 || month > 11 || day < 1 || day > 31) return null;
            Calendar c = Calendar.getInstance();
            c.set(Calendar.YEAR, Integer.parseInt(parts[0]));
            c.set(Calendar.MONTH, month);
            c.set(Calendar.DAY_OF_MONTH, day);
            c.set(Calendar.HOUR_OF_DAY, 0);
            c.set(Calendar.MINUTE, 0);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            return c;
        } catch (Exception e) {
            return null;
        }
    }

    private boolean hasFreshInsideFixForSchedule() {
        Location loc = getFreshBestLocation(CHECKOUT_FIX_MAX_AGE_MS);
        if (loc == null && lastDecisionLocation != null) {
            long age = System.currentTimeMillis() - lastDecisionLocation.getTime();
            if (age >= 0 && age <= CHECKOUT_FIX_MAX_AGE_MS) loc = lastDecisionLocation;
        }
        if (loc == null) {
            android.util.Log.d("NativeGps", "inside schedule guard: no fresh location");
            return false;
        }
        GeofenceDecision d = buildGeofenceDecision(loc);
        boolean accurate = loc.hasAccuracy() && loc.getAccuracy() <= MAX_OUTSIDE_ACCURACY_M;
        boolean ok = d.hasTarget && d.inside && accurate;
        if (ok) {
            wasInside = true;
            insideConfirmCount = 1;
            outsideConfirmCount = 0;
        }
        android.util.Log.d("NativeGps",
            "inside schedule guard: dist=" + Math.round(d.distance) +
            " radius=" + Math.round(d.radius) +
            " acc=" + Math.round(d.accuracy) +
            " provider=" + loc.getProvider() +
            " ok=" + ok);
        return ok;
    }

    // ──────────────────────────────────────────────────────────────
    //  Auto check-in / check-out
    // ──────────────────────────────────────────────────────────────

    private void doSmartAutoCheckin() {
        if (!canStartNewAutoCycle()) {
            clearPendingSignal(KEY_PENDING_SMART_CHECKIN_TS);
            android.util.Log.d("NativeGps", "doSmartAutoCheckin: blocked by cycle guard");
            return;
        }
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int checkinMin = Math.max(1, prefs.getInt("checkinMin", 20));
        Calendar c = calendarFromPendingSignal(KEY_PENDING_SMART_CHECKIN_TS, checkinMin);
        c.add(Calendar.MINUTE, -checkinMin);
        String dateKey = makeDateKey(c);
        String timeStr = makeTimeStr(c);

        AttendanceFlags flags = readAttendanceFlags(dateKey);
        if (flags.hasIn && !flags.hasOut) { clearPendingSignal(KEY_PENDING_SMART_CHECKIN_TS); return; }
        if (flags.hasIn && flags.hasOut) {
            if (flags.outTs <= 0 || (System.currentTimeMillis() - flags.outTs) < 8L * 60 * 60 * 1000) {
                clearPendingSignal(KEY_PENDING_SMART_CHECKIN_TS);
                return;
            }
        }

        boolean saved = saveAttRecord("IN", dateKey, timeStr, c.getTimeInMillis());
        clearPendingSignal(KEY_PENDING_SMART_CHECKIN_TS);
        if (!saved) return;
        sendAutoNotif(1001, NotifTranslations.tr(this, "checkinNotifTitle"),
            NotifTranslations.tr(this, "checkinBodyGps", timeStr));
        updateNotif(NotifTranslations.tr(this, "notifAfterCheckin", timeStr, "Smart"));
        android.util.Log.d("NativeGps", "Smart auto CHECKIN " + dateKey + " " + timeStr);
    }

    private void doSmartAutoCheckout() {
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int checkoutMin = Math.max(1, prefs.getInt("checkoutMin", 80));
        Calendar c = calendarFromPendingSignal(KEY_PENDING_SMART_CHECKOUT_TS, checkoutMin);
        c.add(Calendar.MINUTE, -checkoutMin);
        String dateKey = makeDateKey(c);
        String timeStr = makeTimeStr(c);

        AttendanceFlags flags = readAttendanceFlags(dateKey);
        if (!(flags.hasIn && !flags.hasOut)) {
            Calendar yest = Calendar.getInstance();
            yest.add(Calendar.DATE, -1);
            String yKey = makeDateKey(yest);
            AttendanceFlags yFlags = readAttendanceFlags(yKey);
            if (yFlags.hasIn && !yFlags.hasOut) {
                dateKey = yKey;
            } else {
                clearPendingSignal(KEY_PENDING_SMART_CHECKOUT_TS);
                return;
            }
        }

        boolean saved = saveAttRecord("OUT", dateKey, timeStr, c.getTimeInMillis());
        clearPendingSignal(KEY_PENDING_SMART_CHECKOUT_TS);
        if (!saved) return;
        sendAutoNotif(1002, NotifTranslations.tr(this, "checkoutNotifTitle"),
            NotifTranslations.tr(this, "checkoutBodyGps", timeStr));
        updateNotif(NotifTranslations.tr(this, "notifAfterCheckout", timeStr, "Smart"));
        android.util.Log.d("NativeGps", "Smart auto CHECKOUT " + dateKey + " " + timeStr);
    }

    private void doAutoCheckin() {
        // FIX #4: BỎ guard "nhường JS" tại thời điểm fire. Guard hasIn ở dưới
        // (line readAttendanceFlags) đã đủ để tránh double-checkin nếu JS đã chấm trước.
        if (!canStartNewAutoCycle()) {
            clearPendingSignal(KEY_PENDING_GPS_CHECKIN_TS);
            android.util.Log.d("NativeGps", "doAutoCheckin: blocked by cycle guard (open shift or under 8h)");
            return;
        }
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int checkinMin = Math.max(1, prefs.getInt("checkinMin", 20));
        Calendar c = calendarFromPendingSignal(KEY_PENDING_GPS_CHECKIN_TS, checkinMin);
        c.add(Calendar.MINUTE, -checkinMin);
        String dateKey = makeDateKey(c);
        String timeStr = makeTimeStr(c);
        AttendanceFlags flags = readAttendanceFlags(dateKey);
        if (flags.hasIn && !flags.hasOut) { clearPendingSignal(KEY_PENDING_GPS_CHECKIN_TS); return; }
        if (flags.hasIn && flags.hasOut) {
            if (flags.outTs <= 0 || (System.currentTimeMillis() - flags.outTs) < 8L * 60 * 60 * 1000) {
                clearPendingSignal(KEY_PENDING_GPS_CHECKIN_TS);
                return;
            }
        }

        SharedPreferences attPrefs = getSharedPreferences(ATT_PREFS, MODE_PRIVATE);
        String raw = attPrefs.getString(ATT_KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            boolean hasIn = false, hasOut = false;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject rec = arr.getJSONObject(i);
                if (sameDateKey(dateKey, rec.optString("date"))) {
                    if ("IN".equals(rec.optString("type")))  hasIn  = true;
                    if ("OUT".equals(rec.optString("type"))) hasOut = true;
                }
            }
            if (hasIn && hasOut) {
                long outTs = 0;
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject rec = arr.getJSONObject(i);
                    if ("OUT".equals(rec.optString("type")) && sameDateKey(dateKey, rec.optString("date"))) {
                        outTs = rec.optLong("ts", 0); break;
                    }
                }
                if (outTs > 0 && (System.currentTimeMillis() - outTs) < 8L * 60 * 60 * 1000) {
                    clearPendingSignal(KEY_PENDING_GPS_CHECKIN_TS);
                    return;
                }
                JSONArray cleaned = new JSONArray();
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject rec = arr.getJSONObject(i);
                    if (!sameDateKey(dateKey, rec.optString("date"))) cleaned.put(rec);
                }
                attPrefs.edit().putString(ATT_KEY, cleaned.toString()).apply();
            }
        } catch (Exception ignored) {}

        boolean saved = saveAttRecord("IN", dateKey, timeStr, c.getTimeInMillis());
        clearPendingSignal(KEY_PENDING_GPS_CHECKIN_TS);
        if (!saved) return;
        sendAutoNotif(1001, NotifTranslations.tr(this, "checkinNotifTitle"),
            NotifTranslations.tr(this, "checkinBodyGps", timeStr));
        updateNotif(NotifTranslations.tr(this, "notifAfterCheckin", timeStr, "GPS"));
        android.util.Log.d("NativeGps", "Auto CHECKIN " + dateKey + " " + timeStr);
    }

    private void doAutoCheckout() {
        // FIX #3: BỎ guard "nhường JS" tại thời điểm fire. hasFreshOutsideFix + hasOut
        // check ở dưới đã đảm bảo không double-checkout và chỉ chấm khi GPS chắc chắn ngoài vùng.
        if (!hasFreshOutsideFixForCheckout()) {
            clearPendingSignal(KEY_PENDING_GPS_CHECKOUT_TS);
            updateNotif(NotifTranslations.tr(this, "skipOutGps"));
            return;
        }

        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        int checkoutMin = Math.max(1, prefs.getInt("checkoutMin", 80));
        Calendar c = calendarFromPendingSignal(KEY_PENDING_GPS_CHECKOUT_TS, checkoutMin);
        c.add(Calendar.MINUTE, -checkoutMin);
        String dateKey = makeDateKey(c);
        String timeStr = makeTimeStr(c);

        SharedPreferences attPrefs = getSharedPreferences(ATT_PREFS, MODE_PRIVATE);
        String raw = attPrefs.getString(ATT_KEY, "[]");
        try {
            Calendar yest = Calendar.getInstance();
            yest.add(Calendar.DATE, -1);
            String yesterdayKey = makeDateKey(yest);
            org.json.JSONArray arr = new org.json.JSONArray(raw);
            boolean todayHasIn = false, yesterdayHasIn = false;
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject rec = arr.getJSONObject(i);
                if ("IN".equals(rec.optString("type"))) {
                    if (sameDateKey(dateKey, rec.optString("date")))      todayHasIn     = true;
                    if (sameDateKey(yesterdayKey, rec.optString("date"))) yesterdayHasIn = true;
                }
            }
            if (!todayHasIn && yesterdayHasIn) {
                dateKey = yesterdayKey;
                android.util.Log.d("NativeGps", "Ca qua đêm — checkout gắn vào ngày hôm qua: " + dateKey);
            }
        } catch (Exception ignored) {}

        Calendar yestJs = Calendar.getInstance();
        yestJs.add(Calendar.DATE, -1);
        String yesterdayKeyJs = makeDateKey(yestJs);
        AttendanceFlags todayFlags = readAttendanceFlags(dateKey);
        AttendanceFlags yesterdayFlags = readAttendanceFlags(yesterdayKeyJs);
        if (!todayFlags.hasIn && yesterdayFlags.hasIn && !yesterdayFlags.hasOut) {
            dateKey = yesterdayKeyJs;
        }
        AttendanceFlags checkoutFlags = readAttendanceFlags(dateKey);
        if (!checkoutFlags.hasIn || checkoutFlags.hasOut) { clearPendingSignal(KEY_PENDING_GPS_CHECKOUT_TS); return; }

        boolean saved = saveAttRecord("OUT", dateKey, timeStr, c.getTimeInMillis());
        clearPendingSignal(KEY_PENDING_GPS_CHECKOUT_TS);
        if (!saved) return;
        sendAutoNotif(1002, NotifTranslations.tr(this, "checkoutNotifTitle"),
            NotifTranslations.tr(this, "checkoutBodyGps", timeStr));
        updateNotif(NotifTranslations.tr(this, "notifAfterCheckout", timeStr, "GPS"));
        android.util.Log.d("NativeGps", "Auto CHECKOUT " + dateKey + " " + timeStr);
    }

    private void doInsideScheduleCheckout() {
        SharedPreferences prefs = getSharedPreferences(GPS_PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean("insideScheduleOut", false)) return;

        String dateKey = findOpenAttendanceKeyForSchedule();
        if (dateKey == null) return;

        Calendar target = buildInsideScheduleTarget(dateKey);
        if (target == null) return;
        if (target.getTimeInMillis() > System.currentTimeMillis() + 5000L) {
            scheduleInsideScheduleCheckout();
            return;
        }

        AttendanceFlags flags = readAttendanceFlags(dateKey);
        if (!flags.hasIn || flags.hasOut) return;
        if (!hasFreshInsideFixForSchedule()) {
            updateNotif(NotifTranslations.tr(this, "skipScheduleOut"));
            return;
        }

        String timeStr = makeTimeStr(target);
        boolean saved = saveAttRecord("OUT", dateKey, timeStr);
        if (!saved) return;
        sendAutoNotif(1004, NotifTranslations.tr(this, "checkoutNotifTitle"),
            NotifTranslations.tr(this, "checkoutBodyGps", timeStr));
        updateNotif(NotifTranslations.tr(this, "scheduleOutDone", timeStr));
        android.util.Log.d("NativeGps", "Inside schedule CHECKOUT " + dateKey + " " + timeStr);
    }

    private boolean saveAttRecord(String type, String dateKey, String timeStr) {
        return saveAttRecord(type, dateKey, timeStr, System.currentTimeMillis());
    }

    private boolean saveAttRecord(String type, String dateKey, String timeStr, long recordTs) {
        dateKey = normalizeDateKey(dateKey);
        AttendanceFlags flags = readAttendanceFlags(dateKey);
        if ("IN".equals(type) && flags.hasIn) return false;
        if ("OUT".equals(type) && flags.hasOut) return false;

        SharedPreferences prefs = getSharedPreferences(ATT_PREFS, MODE_PRIVATE);
        String raw = prefs.getString(ATT_KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject existing = arr.getJSONObject(i);
                if (type.equals(existing.optString("type")) && sameDateKey(dateKey, existing.optString("date"))) {
                    android.util.Log.d("NativeGps", "Đã có record " + type + " cho " + dateKey + " — bỏ qua");
                    return false;
                }
            }
            JSONObject rec = new JSONObject();
            rec.put("type", type); rec.put("date", dateKey);
            rec.put("time", timeStr);
            rec.put("ts", recordTs > 0L ? recordTs : System.currentTimeMillis());
            arr.put(rec);
            prefs.edit().putString(ATT_KEY, arr.toString()).apply();
            if ("OUT".equals(type) && isSmartAttendanceMode()) {
                markSmartPostCheckoutSleep(recordTs > 0L ? recordTs : System.currentTimeMillis());
                removeLocationUpdatesOnly();
            }
            return true;
        } catch (Exception e) {
            android.util.Log.e("NativeGps", "saveAttRecord lỗi: " + e.getMessage());
            return false;
        }
    }

    // ──────────────────────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────────────────────

    private String makeDateKey(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d",
            c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private String normalizeDateKey(String dateKey) {
        Calendar c = calendarFromDateKey(dateKey);
        return c != null ? makeDateKey(c) : (dateKey == null ? "" : dateKey);
    }

    private boolean sameDateKey(String a, String b) {
        String na = normalizeDateKey(a);
        String nb = normalizeDateKey(b);
        return !na.isEmpty() && na.equals(nb);
    }

    private String makeTimeStr(Calendar c) {
        return String.format(Locale.US, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
    }

    /**
     * Đọc và lưu tín hiệu Wi-Fi + BTS hiện tại vào SharedPreferences.
     * smart-attendance.js đọc khi app mở lại để khôi phục trạng thái.
     * Gọi mỗi lần nhận GPS update (~30s) để dữ liệu luôn cập nhật.
     */
    private void readAndStoreSmartSignals() {
        try {
            SharedPreferences.Editor ed = getSharedPreferences(SIGNAL_PREFS, MODE_PRIVATE).edit();

            // ── Wi-Fi: đọc SSID/BSSID kết nối hiện tại ──
            try {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null && wm.isWifiEnabled()) {
                    WifiInfo wi = wm.getConnectionInfo();
                    if (wi != null && wi.getNetworkId() != -1) {
                        String ssid = wi.getSSID();
                        // Android trả SSID trong ngoặc kép, loại bỏ
                        if (ssid != null && ssid.startsWith("\"") && ssid.endsWith("\""))
                            ssid = ssid.substring(1, ssid.length() - 1);
                        if ("<unknown ssid>".equals(ssid)) ssid = "";
                        ed.putString("wifiSsid", ssid != null ? ssid : "");
                        ed.putString("wifiBssid", wi.getBSSID() != null ? wi.getBSSID() : "");
                        ed.putBoolean("wifiConnected", ssid != null && !ssid.isEmpty());
                    } else {
                        ed.putBoolean("wifiConnected", false).putString("wifiSsid", "").putString("wifiBssid", "");
                    }
                } else {
                    ed.putBoolean("wifiConnected", false).putString("wifiSsid", "").putString("wifiBssid", "");
                }
            } catch (Exception we) {
                android.util.Log.w("NativeGps", "Smart signals Wi-Fi: " + we.getMessage());
            }

            // ── BTS: đọc Cell ID + LAC từ cell tower đang kết nối ──
            try {
                TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
                if (tm != null && hasLocationPermission()) {
                    List<CellInfo> cells = tm.getAllCellInfo();
                    boolean found = false;
                    if (cells != null) {
                        for (CellInfo ci : cells) {
                            if (!ci.isRegistered()) continue;
                            if (ci instanceof CellInfoLte) {
                                CellIdentityLte id = ((CellInfoLte) ci).getCellIdentity();
                                ed.putLong("cellId", id.getCi());
                                ed.putInt("lac", id.getTac());
                                ed.putString("cellType", "LTE");
                                found = true; break;
                            }
                            if (ci instanceof CellInfoGsm) {
                                CellIdentityGsm id = ((CellInfoGsm) ci).getCellIdentity();
                                ed.putLong("cellId", id.getCid());
                                ed.putInt("lac", id.getLac());
                                ed.putString("cellType", "GSM");
                                found = true; break;
                            }
                            if (ci instanceof CellInfoWcdma) {
                                CellIdentityWcdma id = ((CellInfoWcdma) ci).getCellIdentity();
                                ed.putLong("cellId", id.getCid());
                                ed.putInt("lac", id.getLac());
                                ed.putString("cellType", "WCDMA");
                                found = true; break;
                            }
                        }
                    }
                    if (!found) {
                        ed.putLong("cellId", -1L);
                        ed.putInt("lac", -1);
                    }
                }
            } catch (Exception ce) {
                android.util.Log.w("NativeGps", "Smart signals BTS: " + ce.getMessage());
            }

            ed.putLong("signalTs", System.currentTimeMillis());
            ed.apply();
        } catch (Exception e) {
            android.util.Log.w("NativeGps", "readAndStoreSmartSignals: " + e.getMessage());
        }
    }

    // ──────────────────────────────────────────────────────────────
    //  Notifications
    // ──────────────────────────────────────────────────────────────

    private void sendKillNotif() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                "chamcongpro_alert", NotifTranslations.tr(this, "channelAlert"), NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription(NotifTranslations.tr(this, "channelAlertDesc"));
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }
        String body = NotifTranslations.tr(this, "killNotifBody");
        PendingIntent pi = getLaunchPendingIntent(9999);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, "chamcongpro_alert")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(NotifTranslations.tr(this, "killNotifTitle"))
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true).setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(new long[]{0, 500, 200, 500});
        if (pi != null) b.setContentIntent(pi);
        nm.notify(9002, b.build());
    }

    private void sendGpsUnavailableNotif(String title, String body) {
        long now = System.currentTimeMillis();
        if (now - lastGpsAlertAt < 30L * 60L * 1000L) return;
        lastGpsAlertAt = now;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                "chamcongpro_alert", NotifTranslations.tr(this, "channelAlert"), NotificationManager.IMPORTANCE_HIGH);
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }
        PendingIntent pi = getLaunchPendingIntent(9003);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, "chamcongpro_alert")
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentTitle(title).setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true).setDefaults(NotificationCompat.DEFAULT_ALL);
        if (pi != null) b.setContentIntent(pi);
        nm.notify(9003, b.build());
    }

    private void sendAutoNotif(int id, String title, String body) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        // Tạo channel riêng cho thông báo chấm công thành công để Samsung/Android bật pop-up rõ hơn.
        // trước khi ChamCongNativePlugin.load() tạo channel (vd: sau reboot, hoặc app bị kill).
        // createNotificationChannel() là idempotent, gọi nhiều lần vẫn an toàn.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                ATTENDANCE_ALERT_CHANNEL_ID, "Chấm công thành công", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Thông báo bật lên khi tự động vào ca hoặc ra ca thành công");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 350, 120, 350});
            ch.setShowBadge(true);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
        PendingIntent pi = getLaunchPendingIntent(id);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, ATTENDANCE_ALERT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(title).setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setTicker(title)
            .setVibrate(new long[]{0, 350, 120, 350})
            .setAutoCancel(true).setDefaults(NotificationCompat.DEFAULT_ALL);
        if (pi != null) {
            b.setContentIntent(pi);
            b.setFullScreenIntent(pi, true);
        }
        nm.notify(id, b.build());
    }

    private void updateNotif(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotif(text));
    }

    private Notification buildNotif(String text) {
        PendingIntent pi = getLaunchPendingIntent(0);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(NotifTranslations.tr(this, "fgNotifTitle"))
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true);
        if (pi != null) b.setContentIntent(pi);
        return b.build();
    }

    private PendingIntent getLaunchPendingIntent(int reqCode) {
        Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (i == null) return null;
        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, reqCode, i, flags);
    }

    private void createGpsChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;
            // Kênh foreground GPS — IMPORTANCE_LOW (không âm thanh, chỉ hiện icon)
            NotificationChannel gpsChannel = new NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW);
            gpsChannel.setDescription("Theo dõi vị trí GPS để chấm công tự động");
            gpsChannel.setShowBadge(false);
            nm.createNotificationChannel(gpsChannel);
            // Kênh thông báo chấm công — IMPORTANCE_HIGH (có âm thanh + rung)
            // Phải tạo ở đây vì sendAutoNotif() gọi kênh này ngay cả khi app chưa mở
            // (ChamCongNativePlugin chỉ tạo kênh này khi plugin load, tức là khi app mở)
            NotificationChannel mainChannel = new NotificationChannel(
                "chamcongpro_main", "Chấm Công Pro", NotificationManager.IMPORTANCE_HIGH);
            mainChannel.setDescription("Thông báo chấm công tự động GPS");
            mainChannel.enableVibration(true);
            mainChannel.setShowBadge(true);
            nm.createNotificationChannel(mainChannel);

            NotificationChannel attendanceChannel = new NotificationChannel(
                ATTENDANCE_ALERT_CHANNEL_ID, "Chấm công thành công", NotificationManager.IMPORTANCE_HIGH);
            attendanceChannel.setDescription("Thông báo bật lên khi tự động vào ca hoặc ra ca thành công");
            attendanceChannel.enableVibration(true);
            attendanceChannel.setVibrationPattern(new long[]{0, 350, 120, 350});
            attendanceChannel.setShowBadge(true);
            attendanceChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(attendanceChannel);
        }
    }
}
