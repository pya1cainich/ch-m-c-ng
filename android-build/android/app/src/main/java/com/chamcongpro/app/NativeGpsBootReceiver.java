package com.chamcongpro.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * NativeGpsBootReceiver — nhận sự kiện BOOT_COMPLETED.
 * Nếu người dùng đã bật GPS trước khi tắt máy,
 * tự động restart background geolocation sau khi khởi động lại.
 */
public class NativeGpsBootReceiver extends BroadcastReceiver {

    private static final String GPS_PREFS = "CapacitorStorage";
    private static final String GPS_KEY   = "cp22_gps";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        boolean isBootOrUpdate = action.equals(Intent.ACTION_BOOT_COMPLETED)
            || action.equals("android.intent.action.LOCKED_BOOT_COMPLETED")
            || action.equals(Intent.ACTION_MY_PACKAGE_REPLACED)
            || action.equals("android.intent.action.MY_PACKAGE_REPLACED")
            // MIUI (Xiaomi/Redmi) fast boot
            || action.equals("android.intent.action.QUICKBOOT_POWERON")
            // HTC fast boot
            || action.equals("com.htc.intent.action.QUICKBOOT_POWERON");

        if (!isBootOrUpdate) return;

        // Kiểm tra cc_gps_config (SharedPreferences của NativeGpsService)
        // nếu GPS đang bật thì khởi động lại service ngay không cần mở app
        try {
            SharedPreferences prefs = context.getSharedPreferences(
                NativeGpsService.GPS_PREFS, Context.MODE_PRIVATE);
            boolean enabled = prefs.getBoolean("enabled", false);

            if (enabled) {
                android.util.Log.d("NativeGpsBootReceiver", "GPS was enabled — restarting service");
                Intent svcIntent = new Intent(context, NativeGpsService.class);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(svcIntent);
                } else {
                    context.startService(svcIntent);
                }
            }
        } catch (Exception e) {
            android.util.Log.e("NativeGpsBootReceiver", "onReceive error: " + e.getMessage());
        }
    }
}
