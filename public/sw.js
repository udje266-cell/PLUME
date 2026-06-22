/*
 * PLUME — Service Worker (PWA)
 * - Notifications push (navigateur / iOS PWA / Android).
 * - Clic sur une notification → ouvre directement la conversation concernée.
 * - Cache LÉGER de la coquille pour un démarrage rapide hors-ligne / réseau lent.
 */

const CACHE = 'plume-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/app-icon.png', '/plume-icon.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Réseau d'abord pour la navigation (toujours frais), repli sur le cache hors-ligne.
// On NE touche PAS aux requêtes API ni aux modules JS hashés (toujours réseau).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('/index.html', res.clone())).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Modules JS / styles HASHÉS (immuables) : cache-first + mise en cache au vol.
  // Indispensable pour que l'app DÉMARRE hors-ligne (lecture des livres
  // téléchargés) : sinon index.html se chargeait mais ses /assets/* faisaient
  // 404 → page blanche.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) { const clone = res.clone(); caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {}); }
        return res;
      } catch {
        return (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  // Icônes / manifeste : cache d'abord (rarement modifiés).
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});

// Réception d'une notification push (app fermée ou en arrière-plan).
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data && event.data.text ? event.data.text() : '' }; }

  const title = payload.title || 'PLUME';
  const options = {
    body: payload.body || '',
    icon: '/app-icon.png',
    badge: '/app-icon.png',
    tag: payload.tag || payload.conversationId || payload.groupId || 'plume',
    renotify: true,
    data: {
      conversationId: payload.conversationId || '',
      groupId: payload.groupId || '',
      type: payload.type || '',
      url: payload.url || '/',
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // Met à jour le badge d'icône (nombre de non-lus) si fourni.
      if (typeof payload.unread === 'number' && self.registration.navigator && 'setAppBadge' in self.navigator) {
        try { payload.unread > 0 ? await self.navigator.setAppBadge(payload.unread) : await self.navigator.clearAppBadge(); } catch {}
      }
    })(),
  );
});

// Clic sur la notification → focalise / ouvre l'app sur la bonne conversation.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = '/?' + (data.conversationId ? 'chat=' + encodeURIComponent(data.conversationId)
    : data.groupId ? 'group=' + encodeURIComponent(data.groupId)
    : 'tab=messages');

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        // Une fenêtre PLUME est déjà ouverte : on la focalise et on lui dit d'ouvrir le chat.
        client.postMessage({ type: 'plume-open-chat', conversationId: data.conversationId, groupId: data.groupId });
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});
