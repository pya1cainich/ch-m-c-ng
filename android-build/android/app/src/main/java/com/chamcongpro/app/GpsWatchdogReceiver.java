package com.chamcongpro.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

/**
 * GpsWatchdogReceiver — Lớp bảo vệ thứ 4 cho NativeGpsService.
 *
 * Trên MIUI/Samsung/OPPO, cả START_STICKY lẫn AlarmManager restart đều có thể
 * bị OEM battery optimizer cancel. Receiver này lắng nghe các system broadcast
 * thường xuyên để đảm bảo service được khởi động lại nếu đã chết.
 *
 * Các intent được dùng:
 *   - SCREEN_ON/OFF        → user dùng điện thoại → kiểm tra service
 *   - CONNECTIVITY_CHANGE  → mạng thay đổi → kiểm tra service + trigger Brain v2
 *   - USER_PRESENT         → user mở khoá → kiểm tra service
 *
 * Brain v2: khi CONNECTIVITY_CHANGE (WiFi kết nối/ngắt), nếu Brain v2 đang
 * enabled thì trigger AttendanceBrain.evaluate() ngay — không đợi alarm.
 * Đây là "WiFi change trigger" quan trọng nhất của kiến trúc xương cá.
 */
public class GpsWatchdogReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        final Context ctx = context.getApplicationContext();
        final String action = intent.getAction();

        // ── Brain v2: WiFi change trigger ────────────────────────────────────
        // Khi mạng thay đổi (WiFi connect/disconnect), đánh thức Brain ngay.
        // Đây là sự kiện quan trọng nhất: user vào CT kết nối WiFi cần check-in,
        // hoặc rời CT WiFi mất cần chuyển MAYBE_LEFT_WORK.
        if ("android.net.conn.CONNECTIVITY_CHANGE".equals(action)) {
            if (AttendanceState.isEnabled(ctx)) {
                final PendingResult pendingResult = goAsync();
                new Thread(() -> {
                    try {
                        android.util.Log.d("GpsWatchdog",
                            "[Brain] WiFi/network changed → evaluate()");
                        AttendanceBrain.get().evaluate(ctx, "wifi_change");
                    } finally {
                        pendingResult.finish();
                    }
                }, "Brain-wifi-change").start();
                // Vẫn tiếp tục xuống để kiểm tra NativeGpsService watchdog
            }
        }

        // ── Watchdog NativeGpsService (logic cũ giữ nguyên) ─────────────────
        SharedPreferences prefs = ctx.getSharedPreferences(
            NativeGpsService.GPS_PREFS, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("enabled", false);
        if (!enabled) return;

        if (isServiceRunning(ctx)) return;

        android.util.Log.d("GpsWatchdog",
            "Service not running, action=" + action + " — restarting");
        try {
            Intent svcIntent = new Intent(ctx, NativeGpsService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(svcIntent);
            } else {
                ctx.startService(svcIntent);
            }
        } catch (Exception e) {
            android.util.Log.e("GpsWatchdog", "Restart failed: " + e.getMessage());
        }
    }

    /**
     * Kiểm tra NativeGpsService có đang chạy không.
     * Dùng ActivityManager (deprecated từ API 26 nhưng vẫn hoạt động với
     * service của chính app mình theo tài liệu Android).
     */
    @SuppressWarnings("deprecation")
    private boolean isServiceRunning(Context context) {
        try {
            android.app.ActivityManager am =
                (android.app.ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) return false;
            for (android.app.ActivityManager.RunningServiceInfo svc :
                    am.getRunningServices(Integer.MAX_VALUE)) {
                if (NativeGpsService.class.getName().equals(svc.service.getClassName())) {
                    return true;
                }
            }
        } catch (Exception e) {
            // Nếu không check được → giả định đang chạy (an toàn hơn)
            return true;
        }
        return false;
    }
}
