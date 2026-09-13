package com.ladle.recipebox;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

/**
 * Adds share-sheet support on top of Capacitor's WebView host.
 *
 * When you share an Instagram or TikTok post to Ladle, Android delivers the
 * caption and link as an ACTION_SEND intent. We hand that text to the web
 * layer, which routes it into the importer.
 */
public class MainActivity extends BridgeActivity {

    /** Delays to retry the hand-off on, in milliseconds. */
    private static final long[] RETRY_DELAYS = {250, 900, 2200};

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleShare(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // The activity is singleTask, so a second share reuses this instance.
        setIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;

        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty()) return;

        String payload;
        try {
            // JSONObject.quote handles the escaping, so a caption full of
            // quotes and newlines can't break out of the script.
            payload = JSONObject.quote(text);
        } catch (Exception e) {
            return;
        }

        // Setting the property as well as firing the event covers both orders:
        // the web app may boot before or after this runs.
        final String script =
            "window.__ladleShared = " + payload + ";" +
            "window.dispatchEvent(new CustomEvent('ladle:shared', { detail: " + payload + " }));";

        deliver(script, 0);
    }

    /**
     * The WebView may still be loading when a share arrives, and a navigation
     * wipes anything set beforehand. Rather than guess at a single safe moment,
     * deliver a few times — the web side ignores a repeat of what it has
     * already handled.
     */
    private void deliver(final String script, final int attempt) {
        if (attempt >= RETRY_DELAYS.length) return;

        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                if (getBridge() != null) {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.evaluateJavascript(script, null);
                    }
                }
                deliver(script, attempt + 1);
            }
        }, RETRY_DELAYS[attempt]);
    }
}
