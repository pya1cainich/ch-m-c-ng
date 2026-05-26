package com.chamcongpro.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.DetectedActivity;

import java.util.ArrayList;
import java.util.List;

/**
 * ════════════════════════════════════════════════════════
 *  MODULE 5: MOTION TRANSITION MANAGER
 *  Xương cá tầng 2: Motion Transition
 * ════════════════════════════════════════════════════════
 *
 *  Đăng ký Activity Recognition API để nhận sự kiện:
 *   - STILL (đứng yên)
 *   - WALKING / RUNNING / ON_BICYCLE / IN_VEHICLE (đang di chuyển)
 *
 *  Nguyên tắc:
 *   - MOVING  → bật GPS ngắn hạn (công tắc GPS)
 *   - STILL   → giảm/tắt GPS mạnh
 *   - Không tự quyết định check-in/out — chỉ điều phối GPS
 *
 *  Yêu cầu:
 *   - Quyền: android.permission.ACTIVITY_RECOGNITION (Android 10+)
 *   - Dependency: com.google.android.gms:play-services-location
 */
public class MotionTransitionManager {

    private static final String TAG = "MotionManager";

    // ─── Singleton ────────────────────────────────────────────────────────────
    private static MotionTransitionManager instance;
    public static synchronized MotionTransitionManager get() {
        if (instance == null) instance = new MotionTransitionManager();
        return instance;
    }

    private static final int RC_MOTION = 4001;

    // ══════════════════════════════════════════════════════════════════════════
    //  Đăng ký nhận motion transitions
    // ══════════════════════════════════════════════════════════════════════════

    public void register(Context ctx) {
        try {
            List<ActivityTransition> transitions = buildTransitionList();
            ActivityTransitionRequest request = new ActivityTransitionRequest(transitions);
            PendingIntent pi = buildPendingIntent(ctx);

            ActivityRecognition.getClient(ctx)
                .requestActivityTransitionUpdates(request, pi)
                .addOnSuccessListener(v -> {
                    Log.d(TAG, "Motion transitions registered");
                    AttendanceState.prefs(ctx).edit()
                        .putString(AttendanceState.KEY_MOTION_STATUS,
                            AttendanceState.MOTION_UNKNOWN)
                        .apply();
                })
                .addOnFailureListener(e ->
                    Log.w(TAG, "Motion register failed: " + e.getMessage()));

        } catch (Exception e) {
            Log.e(TAG, "register() error: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Huỷ đăng ký
    // ══════════════════════════════════════════════════════════════════════════

    public void unregister(Context ctx) {
        try {
            PendingIntent pi = buildPendingIntent(ctx);
            ActivityRecognition.getClient(ctx)
                .removeActivityTransitionUpdates(pi)
                .addOnSuccessListener(v -> Log.d(TAG, "Motion transitions unregistered"))
                .addOnFailureListener(e ->
                    Log.w(TAG, "Motion unregister failed: " + e.getMessage()));
        } catch (Exception e) {
            Log.e(TAG, "unregister() error: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Build danh sách transitions cần lắng nghe
    // ══════════════════════════════════════════════════════════════════════════

    private List<ActivityTransition> buildTransitionList() {
        List<ActivityTransition> list = new ArrayList<>();

        // Nhóm "MOVING" — bất kỳ hoạt động nào bắt đầu di chuyển
        int[] movingTypes = {
            DetectedActivity.WALKING,
            DetectedActivity.RUNNING,
            DetectedActivity.ON_BICYCLE,
            DetectedActivity.IN_VEHICLE
        };
        for (int type : movingTypes) {
            list.add(new ActivityTransition.Builder()
                .setActivityType(type)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                .build());
            list.add(new ActivityTransition.Builder()
                .setActivityType(type)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
                .build());
        }

        // STILL — đứng yên
        list.add(new ActivityTransition.Builder()
            .setActivityType(DetectedActivity.STILL)
            .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
            .build());
        list.add(new ActivityTransition.Builder()
            .setActivityType(DetectedActivity.STILL)
            .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
            .build());

        return list;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Helper: phân loại activity type → MOVING hay STILL
    // ──────────────────────────────────────────────────────────────────────────

    public static boolean isMovingActivity(int activityType) {
        return activityType == DetectedActivity.WALKING
            || activityType == DetectedActivity.RUNNING
            || activityType == DetectedActivity.ON_BICYCLE
            || activityType == DetectedActivity.IN_VEHICLE;
    }

    // ──────────────────────────────────────────────────────────────────────────

    private PendingIntent buildPendingIntent(Context ctx) {
        Intent intent = new Intent(ctx, MotionTransitionReceiver.class);
        intent.setAction("com.chamcongpro.MOTION_TRANSITION");

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(ctx, RC_MOTION, intent, flags);
    }
}
