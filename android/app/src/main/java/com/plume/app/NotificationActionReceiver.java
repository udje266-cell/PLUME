package com.plume.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Traite les actions de notification SANS ouvrir l'application :
 *   - « Répondre »  → POST /api/messages { conversationId, content }
 *   - « Marquer comme lu » → PUT /api/messages/read { conversationId }
 * Le jeton d'authentification est lu dans le stockage de Capacitor Preferences.
 */
public class NotificationActionReceiver extends BroadcastReceiver {

    private static final String BACKEND = "https://plume-app-fudd.onrender.com";

    @Override
    public void onReceive(final Context context, final Intent intent) {
        final String action = intent.getAction();
        final String conversationId = intent.getStringExtra(PlumeMessagingService.EXTRA_CONVERSATION_ID);
        final int notifId = intent.getIntExtra(PlumeMessagingService.EXTRA_NOTIFICATION_ID, 0);
        if (action == null || conversationId == null) return;

        String reply = null;
        if (PlumeMessagingService.ACTION_REPLY.equals(action)) {
            Bundle results = RemoteInput.getResultsFromIntent(intent);
            if (results != null) {
                CharSequence cs = results.getCharSequence(PlumeMessagingService.KEY_TEXT_REPLY);
                if (cs != null) reply = cs.toString().trim();
            }
            if (reply == null || reply.isEmpty()) return;
        }

        final String token = readAuthToken(context);
        final String replyContent = reply;

        // Le travail réseau doit survivre à onReceive → goAsync().
        final PendingResult pending = goAsync();
        final boolean isReply = PlumeMessagingService.ACTION_REPLY.equals(action);
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (token == null) return;
                    if (isReply) {
                        httpSend(BACKEND + "/api/messages", "POST", token,
                                "{\"conversationId\":\"" + jsonEsc(conversationId) + "\",\"content\":\"" + jsonEsc(replyContent) + "\"}");
                        // Met à jour la notification pour confirmer l'envoi.
                        showReplied(context, notifId, replyContent);
                    } else { // marquer comme lu
                        httpSend(BACKEND + "/api/messages/read", "PUT", token,
                                "{\"conversationId\":\"" + jsonEsc(conversationId) + "\"}");
                        NotificationManagerCompat.from(context).cancel(notifId);
                    }
                } catch (Exception ignored) {
                } finally {
                    pending.finish();
                }
            }
        }).start();
    }

    private void showReplied(Context context, int notifId, String reply) {
        try {
            NotificationCompat.Builder b = new NotificationCompat.Builder(context, PlumeMessagingService.CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("Réponse envoyée")
                    .setContentText("Vous : " + reply)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_LOW);
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(notifId, b.build());
        } catch (Exception ignored) {
        }
    }

    private void httpSend(String urlStr, String method, String token, String body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Authorization", "Bearer " + token);
        conn.setDoOutput(true);
        OutputStream os = conn.getOutputStream();
        os.write(body.getBytes("UTF-8"));
        os.flush();
        os.close();
        conn.getResponseCode(); // déclenche l'envoi
        conn.disconnect();
    }

    /** Lit le jeton stocké par @capacitor/preferences (SharedPreferences « CapacitorStorage »). */
    private String readAuthToken(Context context) {
        try {
            return context
                    .getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                    .getString("plume_auth_token", null);
        } catch (Exception e) {
            return null;
        }
    }

    private String jsonEsc(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default: sb.append(c);
            }
        }
        return sb.toString();
    }
}
