package com.chamcongpro.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * ════════════════════════════════════════════════════════
 *  MODULE 4: ALARM RECEIVER — xử lý khi alarm đến hạn
 *  Xương cá tầng 4: Alarm / Lịch dự kiến
 * ════════════════════════════════════════════════════════
 *
 *  Nhận intent từ AlarmManager, chạy trong background thread,
 *  rồi gọi AttendanceBrain.evaluate() theo loại alarm.
 *
 *  Không làm việc nặng ở đây — chỉ dispatch sang Brain.
 */
public class AttendanceAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "AlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String alarmType = intent.getStringExtra("alarmType");
        if (alarmType == null) alarmType = "UNKNOWN";

        Log.d(TAG, "onReceive alarmType=" + alarmType);
        NativeAuditTrail.log(context, "ALARM", "received", alarmType);

        final Context ctx = context.getApplicationContext();
        final String type = alarmType;

        // Chạy trong background thread (BroadcastReceiver main thread có timeout 10s)
        final PendingResult pendingResult = goAsync();
        new Thread(() -> {
            try {
                handleAlarm(ctx, type);
            } finally {
                pendingResult.finish();
            }
        }, "AlarmReceiver-" + type).start();
    }

    private void handleAlarm(Context ctx, String alarmType) {
        if (!AttendanceState.isEnabled(ctx)) {
            Log.d(TAG, alarmType + " — disabled, skip");
            NativeAuditTrail.log(ctx, "ALARM", "skip disabled", alarmType);
            return;
        }

        switch (alarmType) {

            // ─── Trước giờ vào ca ─────────────────────────────────────────
            case AttendanceAlarmScheduler.ALARM_BEFORE_SHIFT_IN:
                Log.d(TAG, "BEFORE_SHIFT_IN: kiểm tra tín hiệu công ty");
                AttendanceBrain.get().evaluate(ctx, "alarm:before_in");
                break;

            // ─── Trước giờ tan ca ─────────────────────────────────────────
            case AttendanceAlarmScheduler.ALARM_BEFORE_SHIFT_OUT:
                Log.d(TAG, "BEFORE_SHIFT_OUT: chuẩn bị xác minh tan ca");
                AttendanceBrain.get().evaluate(ctx, "alarm:before_out");
                // Bật GPS ngắn hạn để sẵn sàng xác minh nếu cần
                NativeGpsService.requestOneShot(ctx);
                break;

            // ─── Nhắc chưa checkout ───────────────────────────────────────
            case AttendanceAlarmScheduler.ALARM_CHECKOUT_REMIND:
                handleCheckoutRemind(ctx);
                break;

            // ─── Deadline checkout ────────────────────────────────────────
            case AttendanceAlarmScheduler.ALARM_CHECKOUT_DEADLINE:
                Log.d(TAG, "CHECKOUT_DEADLINE: chạy evaluate để checkout");
                AttendanceBrain.get().evaluate(ctx, "alarm:checkout_deadline");
                break;

            default:
                Log.w(TAG, "Unknown alarm type: " + alarmType);
                NativeAuditTrail.log(ctx, "ALARM", "unknown type", alarmType);
                break;
        }
    }

    private void handleCheckoutRemind(Context ctx) {
        boolean checkedIn  = AttendanceState.prefs(ctx)
            .getBoolean(AttendanceState.KEY_TODAY_CHECKED_IN, false);
        boolean checkedOut = AttendanceState.prefs(ctx)
            .getBoolean(AttendanceState.KEY_TODAY_CHECKED_OUT, false);

        if (!checkedIn) {
            Log.d(TAG, "CHECKOUT_REMIND: chưa check-in hôm nay — skip");
            NativeAuditTrail.log(ctx, "ALARM", "checkout_remind skip", "not checked in");
            return;
        }

        if (checkedOut) {
            Log.d(TAG, "CHECKOUT_REMIND: đã checkout — skip");
            NativeAuditTrail.log(ctx, "ALARM", "checkout_remind skip", "already checked out");
            return;
        }

        // Đã check-in mà chưa checkout → nhắc
        Log.d(TAG, "CHECKOUT_REMIND: đã check-in nhưng chưa checkout — notify");
        NativeAuditTrail.log(ctx, "ALARM", "checkout_remind evaluate", "checked-in but not checked-out");

        // Chạy evaluate trước (có thể đã rời công ty, cần xử lý)
        AttendanceBrain.EvalResult result =
            AttendanceBrain.get().evaluate(ctx, "alarm:checkout_remind");

        // Nếu evaluate chưa checkout (vẫn đang WORKING) → hiện nhắc
        if (!result.action.equals(AttendanceState.EVENT_CHECKED_OUT)) {
            String state = AttendanceState.getState(ctx);
            if (!state.equals(AttendanceState.CHECKED_OUT) &&
                !state.equals(AttendanceState.WAIT_CHECKOUT_CONFIRM)) {
                AttendanceNotifier.notifyCheckoutRemind(ctx);
                NativeAuditTrail.log(ctx, "ALARM", "checkout_remind notified", "state=" + state);
                AttendanceState.setPendingEvent(ctx,
                    AttendanceState.EVENT_CHECKOUT_REMIND,
                    AttendanceBrain.formatTime(System.currentTimeMillis()));
            }
        }
    }
}
