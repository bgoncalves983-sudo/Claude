// Service worker: guarda a "casca" da app para abrir depressa, mostra as notificacoes push e nunca guarda a API.
const CACHE = "frota-casca-v2";
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())),
);
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
});

// Notificacao push: o servidor envia {titulo, corpo, url, tag} cifrado.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { /* mensagem invalida: mostra o texto por omissao */ }
  e.waitUntil(self.registration.showNotification(d.titulo || "Frota Radical", {
    body: d.corpo || "Há novidades na aplicação.",
    icon: "/brand/icon-192.png", badge: "/brand/favicon.png",
    tag: d.tag || "frota", renotify: true, data: { url: d.url || "/#/avarias" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
    for (const c of lista) { if ("focus" in c) { if ("navigate" in c) c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
