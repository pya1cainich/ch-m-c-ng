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
 *   - SCREEN_ON/OFF   → user dùng điện thoại → kiểm tra service
 *   - CONNECTIVITY_CHANGE → mạng thay đổi → kiểm tra service
 *   - USER_PRESENT     → user mở khoá → kiểm tra service
 *
 * Không dùng BATTERY_CHANGED (quá thường xuyên) hay TIME_TICK (cần dynamic).
 */
public class GpsWatchdogReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        SharedPreferences prefs = context.getSharedPreferences(
            NativeGpsService.GPS_PREFS, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("enabled", false);
        if (!enabled) return; // GPS không bật → không cần restart

        // Kiểm tra service có đang chạy không
        if (isServiceRunning(context)) return; // đang chạy → không cần làm gì

        android.util.Log.d("GpsWatchdog",
            "Service not running, action=" + intent.getAction() + " — restarting");
        try {
            Intent svcIntent = new Intent(context, NativeGpsService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svcIntent);
            } else {
                context.startService(svcIntent);
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
