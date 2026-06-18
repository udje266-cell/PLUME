package com.plume.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Au tap d'une notification, l'intent porte « conversationId ». On le transmet
 * a la couche web (evenement + variable globale) pour ouvrir directement la
 * bonne conversation, que l'app demarre a froid ou soit deja ouverte.
 */
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    handleNotificationIntent(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleNotificationIntent(intent);
  }

  private void handleNotificationIntent(Intent intent) {
    if (intent == null) return;
    final String conversationId = intent.getStringExtra("conversationId");
    if (conversationId == null || conversationId.isEmpty()) return;

    final String idJs = jsString(conversationId);
    final String js =
        "window.__plumePendingChat=" + idJs + ";" +
        "try{window.dispatchEvent(new CustomEvent('plume:push-open',{detail:{conversationId:" + idJs + "}}));}catch(e){}";

    // Laisse la WebView se preparer (demarrage a froid), puis injecte.
    getWindow().getDecorView().postDelayed(new Runnable() {
      @Override
      public void run() {
        try {
          if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(js, null);
          }
        } catch (Exception ignored) {}
      }
    }, 1200);
  }

  private static String jsString(String s) {
    return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
  }
}
