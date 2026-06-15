package com.plume.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Service FCM personnalisé : construit les notifications côté natif afin de
 * pouvoir ajouter les actions « Répondre » (saisie en ligne via RemoteInput) et
 * « Marquer comme lu » directement dans la notification — même application
 * fermée, sans l'ouvrir. Les messages sont reçus en DATA-ONLY depuis le serveur.
 */
public class PlumeMessagingService extends FirebaseMessagingService {

    public static final String CHANNEL_ID = "plume_default";
    public static final String KEY_TEXT_REPLY = "plume_key_text_reply";
    public static final String EXTRA_CONVERSATION_ID = "conversationId";
    public static final String EXTRA_NOTIFICATION_ID = "notificationId";
    public static final String ACTION_REPLY = "com.plume.app.ACTION_REPLY";
    public static final String ACTION_MARK_READ = "com.plume.app.ACTION_MARK_READ";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (data == null || data.isEmpty()) {
            return;
        }

        String title = data.get("title");
        String body = data.get("body");
        if (title == null) title = "PLUME";
        if (body == null) body = "";
        String category = data.get("category");
        String conversationId = data.get("conversationId");

        createChannel();

        int notifId = conversationId != null ? conversationId.hashCode() : (int) System.currentTimeMillis();

        // Intent d'ouverture de l'app au tap.
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (conversationId != null) openIntent.putExtra("conversationId", conversationId);
        PendingIntent openPending = PendingIntent.getActivity(
                this, notifId, openIntent, pendingFlags(false));

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(openPending)
                .setPriority(NotificationCompat.PRIORITY_HIGH);

        // Actions « Répondre » + « Marquer comme lu » uniquement pour les messages.
        if ("message".equals(category) && conversationId != null) {
            // --- Répondre (saisie en ligne) ---
            RemoteInput remoteInput = new RemoteInput.Builder(KEY_TEXT_REPLY)
                    .setLabel("Répondre")
                    .build();

            Intent replyIntent = new Intent(this, NotificationActionReceiver.class);
            replyIntent.setAction(ACTION_REPLY);
            replyIntent.putExtra(EXTRA_CONVERSATION_ID, conversationId);
            replyIntent.putExtra(EXTRA_NOTIFICATION_ID, notifId);
            PendingIntent replyPending = PendingIntent.getBroadcast(
                    this, notifId, replyIntent, pendingFlags(true));

            NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                    R.mipmap.ic_launcher, "Répondre", replyPending)
                    .addRemoteInput(remoteInput)
                    .setAllowGeneratedReplies(true)
                    .build();
            builder.addAction(replyAction);

            // --- Marquer comme lu ---
            Intent readIntent = new Intent(this, NotificationActionReceiver.class);
            readIntent.setAction(ACTION_MARK_READ);
            readIntent.putExtra(EXTRA_CONVERSATION_ID, conversationId);
            readIntent.putExtra(EXTRA_NOTIFICATION_ID, notifId);
            PendingIntent readPending = PendingIntent.getBroadcast(
                    this, notifId + 1, readIntent, pendingFlags(false));

            builder.addAction(new NotificationCompat.Action.Builder(
                    R.mipmap.ic_launcher, "Marquer comme lu", readPending).build());
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(notifId, builder.build());
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID, "Messages & activité", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Notifications PLUME");
                nm.createNotificationChannel(channel);
            }
        }
    }

    /** FLAG_MUTABLE requis pour RemoteInput (réponse) ; sinon FLAG_IMMUTABLE. */
    private int pendingFlags(boolean mutable) {
        int base = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            base |= (mutable ? PendingIntent.FLAG_MUTABLE : PendingIntent.FLAG_IMMUTABLE);
        }
        return base;
    }
}
