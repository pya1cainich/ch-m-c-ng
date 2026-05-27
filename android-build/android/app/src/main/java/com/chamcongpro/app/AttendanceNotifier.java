package com.chamcongpro.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * ════════════════════════════════════════════════════════
 *  MODULE 7: NOTIFICATION — Xương cá tầng 7
 * ════════════════════════════════════════════════════════
 *
 *  Chỉ notify khi có kết quả thực sự:
 *   - Đã check-in
 *   - Đã checkout
 *   - Đã checkout bù
 *   - Bạn chưa checkout
 *   - GPS/quyền bị tắt
 *   - Foreground GPS đang chạy (ongoing)
 *
 *  KHÔNG notify khi chỉ kiểm tra nền bình thường.
 */
public class AttendanceNotifier {

    private static final String TAG = "AttendanceNotifier";

    // ─── Channel IDs ──────────────────────────────────────────────────────────
    static final String CH_ATTENDANCE  = "cc_attendance";   // check-in/out results
    static final String CH_REMIND      = "cc_remind";       // nhắc chưa checkout
    static final String CH_ERROR       = "cc_error";        // lỗi quyền/GPS
    static final String CH_FOREGROUND  = "cc_foreground";   // ongoing GPS service

    // ─── Notification IDs ────────────────────────────────────────────────────
    static final int NID_CHECKIN       = 5001;
    static final int NID_CHECKOUT      = 5002;
    static final int NID_REMIND        = 5003;
    static final int NID_PERMISSION    = 5004;
    static final int NID_FOREGROUND    = 5005;

    // ══════════════════════════════════════════════════════════════════════════
    //  Đã check-in
    // ══════════════════════════════════════════════════════════════════════════

    public static void notifyCheckedIn(Context ctx, String timeStr) {
        ensureChannels(ctx);
        show(ctx, CH_ATTENDANCE, NID_CHECKIN,
            "✅ Đã vào ca",
            "Chấm công vào lúc " + timeStr);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Đã checkout
    // ══════════════════════════════════════════════════════════════════════════

    public static void notifyCheckedOut(Context ctx, String timeStr, boolean isCompensate) {
        ensureChannels(ctx);
        String title = isCompensate ? "✅ Đã tự checkout bù" : "✅ Đã checkout";
        String body  = "Chấm công ra lúc " + timeStr;
        show(ctx, CH_ATTENDANCE, NID_CHECKOUT, title, body);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Nhắc chưa checkout
    // ══════════════════════════════════════════════════════════════════════════

    public static void notifyCheckoutRemind(Context ctx) {
        ensureChannels(ctx);
        show(ctx, CH_REMIND, NID_REMIND,
            "⏰ Bạn chưa checkout",
            "Đã đến giờ tan ca. Hãy mở app để kiểm tra.");
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Lỗi quyền / GPS tắt
    // ══════════════════════════════════════════════════════════════════════════

    public static void notifyPermissionError(Context ctx, String detail) {
        ensureChannels(ctx);
        show(ctx, CH_ERROR, NID_PERMISSION,
            "⚠️ Cần bật GPS / quyền vị trí",
            detail != null ? detail : "Chấm công tự động cần quyền vị trí.");
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Foreground GPS đang chạy (ongoing, dùng cho ForegroundService)
    // ══════════════════════════════════════════════════════════════════════════

    public static android.app.Notification buildForegroundNotification(Context ctx) {
        ensureChannels(ctx);
        return new NotificationCompat.Builder(ctx, CH_FOREGROUND)
            .setSmallIcon(getSmallIcon(ctx))
            .setContentTitle("Chấm Công Pro")
            .setContentText("Đang kiểm tra vị trí…")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Internal
    // ══════════════════════════════════════════════════════════════════════════

    private static void show(Context ctx, String channelId, int nid,
                              String title, String body) {
        try {
            NotificationManager nm = (NotificationManager)
                ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            Intent tapIntent = ctx.getPackageManager()
                .getLaunchIntentForPackage(ctx.getPackageName());
            if (tapIntent == null) tapIntent = new Intent();
            tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getActivity(ctx, nid, tapIntent, piFlags);

            NotificationCompat.Builder builder =
                new NotificationCompat.Builder(ctx, channelId)
                    .setSmallIcon(getSmallIcon(ctx))
                    .setContentTitle(title)
                    .setContentText(body)
                    .setAutoCancel(true)
                    .setContentIntent(pi)
                    .setPriority(channelId.equals(CH_REMIND)
                        ? NotificationCompat.PRIORITY_HIGH
                        : NotificationCompat.PRIORITY_DEFAULT);

            nm.notify(nid, builder.build());
            Log.d(TAG, "notify [" + channelId + "] " + title);
            NativeAuditTrail.log(ctx, "NOTIFY", title, "channel=" + channelId + " nid=" + nid + " body=" + body);
        } catch (Exception e) {
            Log.w(TAG, "notify error: " + e.getMessage());
            NativeAuditTrail.log(ctx, "NOTIFY", "error", String.valueOf(e.getMessage()));
        }
    }

    private static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager)
            ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (nm.getNotificationChannel(CH_ATTENDANCE) == null) {
            nm.createNotificationChannel(new NotificationChannel(
                CH_ATTENDANCE, "Chấm công", NotificationManager.IMPORTANCE_DEFAULT));
        }
        if (nm.getNotificationChannel(CH_REMIND) == null) {
            nm.createNotificationChannel(new NotificationChannel(
                CH_REMIND, "Nhắc checkout", NotificationManager.IMPORTANCE_HIGH));
        }
        if (nm.getNotificationChannel(CH_ERROR) == null) {
            nm.createNotificationChannel(new NotificationChannel(
                CH_ERROR, "Lỗi GPS/quyền", NotificationManager.IMPORTANCE_DEFAULT));
        }
        if (nm.getNotificationChannel(CH_FOREGROUND) == null) {
            NotificationChannel ch = new NotificationChannel(
                CH_FOREGROUND, "GPS đang chạy", NotificationManager.IMPORTANCE_LOW);
            ch.setSound(null, null);
            nm.createNotificationChannel(ch);
        }
    }

    private static int getSmallIcon(Context ctx) {
        // Dùng icon app nếu có, fallback về android built-in
        int resId = ctx.getResources().getIdentifier(
            "ic_notification", "drawable", ctx.getPackageName());
        return resId != 0 ? resId : android.R.drawable.ic_menu_mylocation;
    }
}
