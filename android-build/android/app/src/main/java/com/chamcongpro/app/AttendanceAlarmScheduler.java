package com.chamcongpro.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

/**
 * ════════════════════════════════════════════════════════
 *  MODULE 3: ALARM SCHEDULER — AlarmManager wrapper
 *  Xương cá tầng 4: Alarm / Lịch dự kiến
 * ════════════════════════════════════════════════════════
 *
 *  4 loại alarm:
 *   1. BEFORE_SHIFT_IN   — trước giờ vào ca N phút
 *   2. BEFORE_SHIFT_OUT  — trước giờ tan ca N phút
 *   3. CHECKOUT_REMIND   — nhắc chưa checkout (đúng/sau giờ tan ca)
 *   4. CHECKOUT_DEADLINE — khi checkoutWindowStart + checkoutMin đến hạn
 *
 *  Tất cả alarm gọi AttendanceAlarmReceiver, truyền loại alarm qua extra.
 */
public class AttendanceAlarmScheduler {

    private static final String TAG = "AlarmScheduler";

    // ─── Singleton ────────────────────────────────────────────────────────────
    private static AttendanceAlarmScheduler instance;
    public static synchronized AttendanceAlarmScheduler get() {
        if (instance == null) instance = new AttendanceAlarmScheduler();
        return instance;
    }

    // ─── Alarm type constants ─────────────────────────────────────────────────
    public static final String ALARM_BEFORE_SHIFT_IN   = "BEFORE_SHIFT_IN";
    public static final String ALARM_BEFORE_SHIFT_OUT  = "BEFORE_SHIFT_OUT";
    public static final String ALARM_CHECKOUT_REMIND   = "CHECKOUT_REMIND";
    public static final String ALARM_CHECKOUT_DEADLINE = "CHECKOUT_DEADLINE";

    // ─── Request codes (unique per alarm) ────────────────────────────────────
    private static final int RC_BEFORE_IN   = 3001;
    private static final int RC_BEFORE_OUT  = 3002;
    private static final int RC_REMIND      = 3003;
    private static final int RC_DEADLINE    = 3004;

    // ══════════════════════════════════════════════════════════════════════════
    //  Đặt toàn bộ alarm cho hôm nay (gọi khi app start / ngày mới)
    // ══════════════════════════════════════════════════════════════════════════

    public void scheduleForToday(Context ctx) {
        SharedPreferences p = AttendanceState.prefs(ctx);
        int shiftInHour  = p.getInt(AttendanceState.KEY_SHIFT_START_HOUR, -1);
        int shiftInMin   = p.getInt(AttendanceState.KEY_SHIFT_START_MIN,  0);
        int shiftOutHour = p.getInt(AttendanceState.KEY_SHIFT_END_HOUR,   -1);
        int shiftOutMin  = p.getInt(AttendanceState.KEY_SHIFT_END_MIN,    0);
        int beforeMin    = p.getInt(AttendanceState.KEY_ALARM_BEFORE_MIN, 10);

        if (shiftInHour < 0 || shiftOutHour < 0) {
            Log.d(TAG, "scheduleForToday: no shift config — skip");
            NativeAuditTrail.log(ctx, "ALARM", "scheduleForToday skip", "missing shift config");
            return;
        }
        NativeAuditTrail.log(ctx, "ALARM", "scheduleForToday", "shiftIn=" + shiftInHour + ":" + shiftInMin + " shiftOut=" + shiftOutHour + ":" + shiftOutMin + " beforeMin=" + beforeMin);

        long shiftInMs  = todayTimeMs(shiftInHour,  shiftInMin);
        long shiftOutMs = todayTimeMs(shiftOutHour, shiftOutMin);
        long now        = System.currentTimeMillis();

        // Alarm 1: trước vào ca
        long alarmInAt = shiftInMs - beforeMin * 60_000L;
        if (alarmInAt > now) {
            setExact(ctx, alarmInAt, RC_BEFORE_IN, ALARM_BEFORE_SHIFT_IN);
            Log.d(TAG, "Alarm BEFORE_SHIFT_IN at " + AttendanceBrain.formatTime(alarmInAt));
        }

        // Alarm 2: trước tan ca
        long alarmOutAt = shiftOutMs - beforeMin * 60_000L;
        if (alarmOutAt > now) {
            setExact(ctx, alarmOutAt, RC_BEFORE_OUT, ALARM_BEFORE_SHIFT_OUT);
            Log.d(TAG, "Alarm BEFORE_SHIFT_OUT at " + AttendanceBrain.formatTime(alarmOutAt));
        }

        // Alarm 3: nhắc chưa checkout (đúng giờ tan ca)
        if (shiftOutMs > now) {
            setExact(ctx, shiftOutMs, RC_REMIND, ALARM_CHECKOUT_REMIND);
            Log.d(TAG, "Alarm CHECKOUT_REMIND at " + AttendanceBrain.formatTime(shiftOutMs));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Alarm deadline checkout (động — tính từ lúc mở cửa sổ checkout)
    // ══════════════════════════════════════════════════════════════════════════

    public void scheduleCheckoutDeadline(Context ctx, long deadlineAt) {
        setExact(ctx, deadlineAt, RC_DEADLINE, ALARM_CHECKOUT_DEADLINE);
        Log.d(TAG, "Alarm CHECKOUT_DEADLINE at " + AttendanceBrain.formatTime(deadlineAt));
        NativeAuditTrail.log(ctx, "ALARM", "schedule deadline", "at=" + deadlineAt);
    }

    public void cancelCheckoutDeadline(Context ctx) {
        cancel(ctx, RC_DEADLINE, ALARM_CHECKOUT_DEADLINE);
        Log.d(TAG, "Cancelled CHECKOUT_DEADLINE");
        NativeAuditTrail.log(ctx, "ALARM", "cancel deadline", "");
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Alarm nhắc checkout (đặt sau khi check-in thành công)
    // ══════════════════════════════════════════════════════════════════════════

    public void scheduleCheckoutReminder(Context ctx) {
        SharedPreferences p = AttendanceState.prefs(ctx);
        int shiftOutHour = p.getInt(AttendanceState.KEY_SHIFT_END_HOUR, -1);
        int shiftOutMin  = p.getInt(AttendanceState.KEY_SHIFT_END_MIN,  0);
        if (shiftOutHour < 0) {
            NativeAuditTrail.log(ctx, "ALARM", "schedule remind skip", "shiftOut not configured");
            return;
        }

        long shiftOutMs = todayTimeMs(shiftOutHour, shiftOutMin);
        long now = System.currentTimeMillis();
        if (shiftOutMs > now) {
            setExact(ctx, shiftOutMs, RC_REMIND, ALARM_CHECKOUT_REMIND);
            Log.d(TAG, "Alarm CHECKOUT_REMIND re-scheduled at " + AttendanceBrain.formatTime(shiftOutMs));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Huỷ tất cả alarm
    // ══════════════════════════════════════════════════════════════════════════

    public void cancelAll(Context ctx) {
        cancel(ctx, RC_BEFORE_IN,  ALARM_BEFORE_SHIFT_IN);
        cancel(ctx, RC_BEFORE_OUT, ALARM_BEFORE_SHIFT_OUT);
        cancel(ctx, RC_REMIND,     ALARM_CHECKOUT_REMIND);
        cancel(ctx, RC_DEADLINE,   ALARM_CHECKOUT_DEADLINE);
        Log.d(TAG, "All alarms cancelled");
        NativeAuditTrail.log(ctx, "ALARM", "cancel all", "");
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Internal helpers
    // ══════════════════════════════════════════════════════════════════════════

    private void setExact(Context ctx, long triggerAt, int requestCode, String alarmType) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            NativeAuditTrail.log(ctx, "ALARM", "setExact skip", "AlarmManager null " + alarmType);
            return;
        }

        PendingIntent pi = buildPendingIntent(ctx, requestCode, alarmType);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (am.canScheduleExactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            }
        } catch (SecurityException e) {
            Log.w(TAG, "setExact SecurityException: " + e.getMessage());
            NativeAuditTrail.log(ctx, "ALARM", "setExact security fallback", alarmType + " " + e.getMessage());
            am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi);
        }
    }

    private void cancel(Context ctx, int requestCode, String alarmType) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = buildPendingIntent(ctx, requestCode, alarmType);
        am.cancel(pi);
    }

    private PendingIntent buildPendingIntent(Context ctx, int requestCode, String alarmType) {
        Intent intent = new Intent(ctx, AttendanceAlarmReceiver.class);
        intent.setAction("com.chamcongpro.ATTENDANCE_ALARM");
        intent.putExtra("alarmType", alarmType);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(ctx, requestCode, intent, flags);
    }

    private long todayTimeMs(int hour, int min) {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(java.util.Calendar.HOUR_OF_DAY, hour);
        cal.set(java.util.Calendar.MINUTE, min);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }
}
