package com.chamcongpro.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;

/**
 * ════════════════════════════════════════════════════════
 *  MODULE 6: MOTION TRANSITION RECEIVER
 *  Xương cá tầng 2: Motion Transition
 * ════════════════════════════════════════════════════════
 *
 *  Nhận sự kiện motion từ Activity Recognition API.
 *
 *  Logic đơn giản — chỉ là "công tắc GPS":
 *   - MOVING ENTER → lưu MOVING, bật GPS nếu cần
 *   - STILL  ENTER → lưu STILL, giảm/tắt GPS
 *   - Không tự checkout, không tự check-in
 *
 *  Sau khi điều chỉnh GPS → gọi Brain.evaluate() để xem
 *  có cần chuyển state không (ví dụ: MAYBE_LEFT_WORK + GPS verify).
 */
public class MotionTransitionReceiver extends BroadcastReceiver {

    private static final String TAG = "MotionReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (!ActivityTransitionResult.hasResult(intent)) {
            NativeAuditTrail.log(context, "MOTION", "no transition result", "intent without ActivityTransitionResult");
            return;
        }

        final Context ctx = context.getApplicationContext();
        final PendingResult pendingResult = goAsync();

        new Thread(() -> {
            try {
                handleMotionResult(ctx, intent);
            } finally {
                pendingResult.finish();
            }
        }, "MotionReceiver").start();
    }

    private void handleMotionResult(Context ctx, Intent intent) {
        if (!AttendanceState.isEnabled(ctx)) {
            NativeAuditTrail.log(ctx, "MOTION", "ignored", "brain disabled");
            return;
        }

        ActivityTransitionResult result = ActivityTransitionResult.extractResult(intent);
        if (result == null) {
            NativeAuditTrail.log(ctx, "MOTION", "extract result null", "");
            return;
        }

        for (com.google.android.gms.location.ActivityTransitionEvent event :
                result.getTransitionEvents()) {

            int actType    = event.getActivityType();
            int transition = event.getTransitionType();
            String actName = activityName(actType);
            String transName = (transition == ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                ? "ENTER" : "EXIT";

            Log.d(TAG, "Motion: " + actName + " " + transName);
            NativeAuditTrail.log(ctx, "MOTION", actName + " " + transName, "state=" + AttendanceState.getState(ctx));

            if (transition == ActivityTransition.ACTIVITY_TRANSITION_ENTER) {
                handleTransitionEnter(ctx, actType);
            } else {
                NativeAuditTrail.log(ctx, "MOTION", "EXIT ignored", actName);
            }
        }
    }

    private void handleTransitionEnter(Context ctx, int activityType) {
        String state = AttendanceState.getState(ctx);

        if (MotionTransitionManager.isMovingActivity(activityType)) {
            // ─── MOVING ───────────────────────────────────────────────────
            Log.d(TAG, "MOVING detected, state=" + state);
            AttendanceState.prefs(ctx).edit()
                .putString(AttendanceState.KEY_MOTION_STATUS, AttendanceState.MOTION_MOVING)
                .putLong(AttendanceState.KEY_MOTION_LAST_EVENT_AT, System.currentTimeMillis())
                .apply();

            // Bật GPS nếu WiFi không rõ và đang trong trạng thái cần xác minh
            boolean needGps = state.equals(AttendanceState.OUTSIDE)
                || state.equals(AttendanceState.HOME)
                || state.equals(AttendanceState.MAYBE_LEFT_WORK)
                || state.equals(AttendanceState.WAIT_CHECKIN_CONFIRM)
                || state.equals(AttendanceState.WAIT_CHECKOUT_CONFIRM);

            if (needGps) {
                AttendanceBrain.SignalResult sig =
                    AttendanceBrain.get().checkWorkSignal(ctx);
                if (!sig.source.startsWith("wifi")) {
                    Log.d(TAG, "MOVING + no WiFi → request GPS oneshot");
                    NativeAuditTrail.log(ctx, "MOTION", "moving -> request GPS oneshot", "signal=" + sig.source);
                    NativeGpsService.requestOneShot(ctx);
                } else {
                    NativeAuditTrail.log(ctx, "MOTION", "moving but wifi present", "signal=" + sig.source);
                }
            } else {
                NativeAuditTrail.log(ctx, "MOTION", "moving no GPS needed", "state=" + state);
            }

            // Evaluate để Brain có thể cập nhật state nếu cần
            AttendanceBrain.get().evaluate(ctx, "motion:moving");

        } else if (activityType == DetectedActivity.STILL) {
            // ─── STILL ────────────────────────────────────────────────────
            Log.d(TAG, "STILL detected, state=" + state);
            AttendanceState.prefs(ctx).edit()
                .putString(AttendanceState.KEY_MOTION_STATUS, AttendanceState.MOTION_STILL)
                .putLong(AttendanceState.KEY_MOTION_LAST_EVENT_AT, System.currentTimeMillis())
                .apply();

            // Khi đứng yên: lấy GPS lần cuối nếu đang cần, rồi giảm/tắt
            boolean isCriticalState =
                state.equals(AttendanceState.WAIT_CHECKIN_CONFIRM)
                || state.equals(AttendanceState.MAYBE_LEFT_WORK)
                || state.equals(AttendanceState.WAIT_CHECKOUT_CONFIRM);

            if (isCriticalState) {
                // Lấy 1 GPS reading cuối rồi tắt
                NativeAuditTrail.log(ctx, "MOTION", "still -> request final GPS oneshot", "state=" + state);
                NativeGpsService.requestOneShot(ctx);
            } else {
                NativeAuditTrail.log(ctx, "MOTION", "still -> stop GPS", "state=" + state);
                NativeGpsService.stop(ctx);
            }

            AttendanceBrain.get().evaluate(ctx, "motion:still");
        }
    }

    private String activityName(int type) {
        switch (type) {
            case DetectedActivity.WALKING:    return "WALKING";
            case DetectedActivity.RUNNING:    return "RUNNING";
            case DetectedActivity.ON_BICYCLE: return "ON_BICYCLE";
            case DetectedActivity.IN_VEHICLE: return "IN_VEHICLE";
            case DetectedActivity.STILL:      return "STILL";
            default:                          return "UNKNOWN(" + type + ")";
        }
    }
}
