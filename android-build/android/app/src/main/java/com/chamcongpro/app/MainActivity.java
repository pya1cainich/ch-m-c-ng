package com.chamcongpro.app;

import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Đăng ký plugin ChamCongNative TRƯỚC khi gọi super.onCreate
        registerPlugin(ChamCongNativePlugin.class);
        // Đăng ký bộ não chấm công tự động mới
        registerPlugin(AttendanceBrainPlugin.class);
        super.onCreate(savedInstanceState);
        // FIX GPS: cho phép navigator.geolocation hoạt động trong WebView
        enableWebViewGeolocation();
    }

    /**
     * FIX lỗi "application does not have sufficient geolocation permissions" (code 2).
     *
     * Nguyên nhân: Capacitor mặc định TỪ CHỐI navigator.geolocation trong WebView —
     * BridgeWebChromeClient.onGeolocationPermissionsShowPrompt() invoke callback=false,
     * vì Capacitor khuyến nghị dùng plugin @capacitor/geolocation. App này KHÔNG cài
     * plugin đó; smart-attendance.js / checkin.js gọi thẳng navigator.geolocation
     * (getGeoAPI trả 'web') → mọi lần lấy GPS đều bị WebView chặn.
     *
     * Cách sửa: override onGeolocationPermissionsShowPrompt để GRANT. An toàn vì:
     *   - App đã khai báo ACCESS_FINE/COARSE_LOCATION trong AndroidManifest
     *   - Runtime permission vẫn do Android quản lý — WebView chỉ thực sự lấy được
     *     GPS sau khi user đã cấp quyền location cho app (xin qua ChamCongNativePlugin).
     * Vẫn dùng BridgeWebChromeClient (extends) nên giữ nguyên mọi chức năng khác
     * của Capacitor (file upload, camera permission, console log...).
     */
    private void enableWebViewGeolocation() {
        try {
            final Bridge bridge = getBridge();
            if (bridge == null) return;
            final WebView webView = bridge.getWebView();
            if (webView == null) return;
            webView.getSettings().setGeolocationEnabled(true);
            webView.setWebChromeClient(new BridgeWebChromeClient(bridge) {
                @Override
                public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                    if (callback != null) callback.invoke(origin, true, false);
                }
            });
        } catch (Exception e) {
            android.util.Log.w("MainActivity", "enableWebViewGeolocation failed: " + e.getMessage());
        }
    }

    @Override
    public void onBackPressed() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            super.onBackPressed();
            return;
        }

        getBridge().getWebView().evaluateJavascript(
            "(function(){try{return window.appHandleAndroidBack?window.appHandleAndroidBack():'exit';}catch(e){return 'exit';}})();",
            value -> {
                if (value == null || value.contains("exit")) {
                    MainActivity.super.onBackPressed();
                }
            }
        );
    }
}
