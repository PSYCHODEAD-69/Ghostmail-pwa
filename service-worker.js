const CACHE_NAME = "ghostmail-v4";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  // Network first for API calls
  if (e.request.url.includes("workers.dev")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Cache first for assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── PUSH NOTIFICATION RECEIVE ─────────────────────────────────
self.addEventListener("push", e => {
  if (!e.data) return;

  let data = {};
  try { data = e.data.json(); } catch { data = { title: "New Mail!", body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || "📬 New Mail!", {
      body:      data.body  || "Naya mail aaya hai",
      icon:      "https://i.ibb.co/ZpVSc1Jv/photo-2026-04-06-16-58-54.jpg",
      badge:     "https://i.ibb.co/ZpVSc1Jv/photo-2026-04-06-16-58-54.jpg",
      tag:       "ghostmail-inbox",
      renotify:  true,
      vibrate:   [200, 100, 200],
      data:      { url: "https://ghostmail.psychodead.qzz.io" },
      actions: [
        { action: "open",    title: "📬 Open Mail" },
        { action: "dismiss", title: "✕ Dismiss"   },
      ],
    })
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();
  if (e.action === "dismiss") return;

  const targetUrl = (e.notification.data && e.notification.data.url)
    ? e.notification.data.url
    : "https://ghostmail.psychodead.qzz.io";

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes("ghostmail.psychodead.qzz.io") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
