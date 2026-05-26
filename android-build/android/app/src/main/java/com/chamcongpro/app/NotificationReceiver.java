package com.chamcongpro.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

/**
 * NotificationReceiver — nhận alarm và hiển thị notification lên thanh thông báo.
 * Được AlarmManager gọi đúng giờ đã lên lịch.
 */
public class NotificationReceiver extends BroadcastReceiver {
    private static final String ATTENDANCE_ALERT_CHANNEL_ID = "chamcongpro_attendance_alert";

    private boolean isAttendanceAlert(int id, String channelId) {
        return ATTENDANCE_ALERT_CHANNEL_ID.equals(channelId)
            || id == 1001 || id == 1002 || id == 2001 || id == 2002
            || id == 2003 || id == 2004 || id == 9101 || id == 9102;
    }

    /**
     * Kiểm tra ca làm việc đã được checkout chưa (dùng SharedPreferences "cc_open_shift_closed").
     * Trả về true nếu ca đã đóng → không nên hiện thông báo nữa.
     */
    /**
     * Khi AlarmManager fire alarm ID 9101 (deadline checkout tự động),
     * ghi pending checkout vào CapacitorStorage để JS áp dụng khi app thức dậy.
     */
    private void handleSmartCheckoutTimeout(Context context, Intent intent) {
        try {
            String dataStr = intent.getStringExtra("data");
            if (dataStr == null || dataStr.isEmpty()) return;
            org.json.JSONObject data = new org.json.JSONObject(dataStr);
            long windowStartMs = data.getLong("windowStartMs");
            java.util.Date t = new java.util.Date(windowStartMs);
            String hm = String.format(java.util.Locale.getDefault(),
                "%02d:%02d", t.getHours(), t.getMinutes());
            String dateKey = new java.text.SimpleDateFormat(
                "yyyy-MM-dd", java.util.Locale.getDefault()).format(t);
            String pending = new org.json.JSONObject()
                .put("time", hm)
                .put("date", dateKey)
                .put("method", "timeout")
                .put("ts", System.currentTimeMillis())
                .toString();
            context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                .edit()
                .putString("cp22_sa_pending_checkout", pending)
                .apply();
            android.util.Log.d("NotificationReceiver",
                "Smart checkout pending written: " + dateKey + " " + hm);
        } catch (Exception e) {
            android.util.Log.e("NotificationReceiver",
                "handleSmartCheckoutTimeout: " + e.getMessage());
        }
    }

    private boolean isOpenShiftClosed(Context context, String dateKey, String job) {
        if (dateKey == null || dateKey.isEmpty()) return false;
        String key = (job != null ? job : "main") + "_" + dateKey;
        return context
            .getSharedPreferences("cc_open_shift_closed", Context.MODE_PRIVATE)
            .getBoolean(key, false);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String title     = intent.getStringExtra("title");
        String body      = intent.getStringExtra("body");
        int    id        = intent.getIntExtra("id", 1);
        String channelId = intent.getStringExtra("channelId");
        if (channelId == null) channelId = "chamcongpro_main";
        boolean attendanceAlert = isAttendanceAlert(id, channelId);

        // Smart checkout timeout: Java ghi pending vào CapacitorStorage để JS đọc khi thức dậy
        if (id == 9101) handleSmartCheckoutTimeout(context, intent);

        // Validate trước khi hiện: nếu là reminder ca mở (ID 52000–61999)
        // và ca đã được checkout → bỏ qua, không hiện thông báo
        String dateKey = intent.getStringExtra("dateKey");
        String job     = intent.getStringExtra("job");
        if (id >= 52000 && id < 62000 && dateKey != null && !dateKey.isEmpty()) {
            if (isOpenShiftClosed(context, dateKey, job)) {
                android.util.Log.d("NotificationReceiver",
                    "Bỏ qua reminder id=" + id + " — ca " + job + "/" + dateKey + " đã checkout");
                // Xoá khỏi pending list cho sạch
                try {
                    android.content.SharedPreferences prefs =
                        context.getSharedPreferences("cc_pending_notifs", Context.MODE_PRIVATE);
                    java.util.Set<String> raw = new java.util.HashSet<>(
                        prefs.getStringSet("pending_ids", new java.util.HashSet<>()));
                    final int notifId = id;
                    raw.removeIf(s -> {
                        try { return new org.json.JSONObject(s).getInt("id") == notifId; }
                        catch (Exception e) { return false; }
                    });
                    prefs.edit().putStringSet("pending_ids", raw).apply();
                } catch (Exception ignored) {}
                return; // không hiện thông báo
            }
        }

        // Đảm bảo channel tồn tại
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId,
                attendanceAlert ? "Chấm công thành công" : "Chấm Công Pro",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(attendanceAlert
                ? "Thông báo bật lên khi tự động vào ca hoặc ra ca thành công"
                : "Thông báo chấm công và nhắc ca làm việc");
            channel.enableVibration(true);
            if (attendanceAlert) {
                channel.setVibrationPattern(new long[]{0, 350, 120, 350});
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            }
            channel.setShowBadge(true);
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }

        // Tạo notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title != null ? title : "Chấm Công Pro")
            .setContentText(body != null ? body : "")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
            .setPriority(attendanceAlert ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_HIGH)
            .setCategory(attendanceAlert ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setTicker(title != null ? title : "Chấm Công Pro")
            .setVibrate(attendanceAlert ? new long[]{0, 350, 120, 350} : null)
            .setAutoCancel(true)
            .setDefaults(NotificationCompat.DEFAULT_ALL);

        // Tap → mở app
        Intent launchIntent = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getActivity(context, id, launchIntent, flags);
            builder.setContentIntent(pi);
            if (attendanceAlert) {
                builder.setFullScreenIntent(pi, true);
            }
        }

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(id, builder.build());

        // Xóa id khỏi SharedPreferences (đã fire rồi)
        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences("cc_pending_notifs", Context.MODE_PRIVATE);
            java.util.Set<String> raw = new java.util.HashSet<>(prefs.getStringSet("pending_ids", new java.util.HashSet<>()));
            final int notifId = id;
            raw.removeIf(s -> {
                try { return new org.json.JSONObject(s).getInt("id") == notifId; }
                catch (Exception e) { return false; }
            });
            prefs.edit().putStringSet("pending_ids", raw).apply();
        } catch (Exception ignored) {}
    }
}
