/* Service worker do catálogo SHI-TEN.
   Páginas e catálogo: rede primeiro (sem cache HTTP); se a rede demorar mais de 8 s ou falhar, entrega a cópia guardada.
   Google Fonts: cache primeiro. versao.json: sempre da rede. */
const CACHE = "shiten-ab563130dabf";
const FONTES = "shiten-fontes";
const PRAZO = 8000;
const ARQUIVOS = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-64.png", "catalogo.enc"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith("shiten-") && k !== CACHE && k !== FONTES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function guardada(req) {
  return caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined));
}

function redeComPrazo(req) {
  return new Promise(resolve => {
    let feito = false;
    const fim = r => { if (!feito && r) { feito = true; resolve(r); } };
    const timer = setTimeout(() => guardada(req).then(fim), PRAZO);
    fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(r => {
      clearTimeout(timer);
      if (r && r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      if (feito) return;
      if (r && r.ok) return fim(r);
      return guardada(req).then(c => fim(c || r));
    }).catch(() => {
      clearTimeout(timer);
      guardada(req).then(c => { if (!feito) { feito = true; resolve(c || Response.error()); } });
    });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTES).then(c => c.match(req).then(r => r || fetch(req).then(n => { if (n && (n.ok || n.type === "opaque")) c.put(req, n.clone()); return n; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith("versao.json")) return; // sempre da rede
  e.respondWith(redeComPrazo(req));
});
