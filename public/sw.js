// Service worker: a app abre mesmo sem rede (ficheiros da app guardados), mostra as notificacoes push e nunca guarda a API.
const CACHE = "frota-casca-v3";
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())),
);

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Ficheiros com nome unico (hash) e a marca: ficam guardados e abrem logo, mesmo sem rede.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/brand/")) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
      return resp;
    })));
    return;
  }
  // Pagina: usa a rede; sem rede, abre a ultima copia guardada.
  e.respondWith(fetch(e.request).then((resp) => {
    if (resp.ok && (e.request.mode === "navigate" || url.pathname === "/" || url.pathname === "/manifest.webmanifest")) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(url.pathname === "/" || e.request.mode === "navigate" ? "/" : e.request, copia)); }
    return resp;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
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
