/* Offline support: everything is cached on the first online visit,
   then the app runs with no internet. Bump VERSION to force a full refresh. */
const VERSION = "menu-v6";

const CORE = [
  "./", "index.html", "styles.css", "script.js", "config.js",
  "manifest.webmanifest", "logo.png",
  "icons/icon-192.png", "icons/icon-512.png",
  "vendor/pdfjs/pdf.min.mjs", "vendor/pdfjs/pdf.worker.min.mjs",
  "fonts/oswald-latin-500-normal.woff2", "fonts/oswald-latin-ext-500-normal.woff2",
  "fonts/outfit-latin-400-normal.woff2", "fonts/outfit-latin-ext-400-normal.woff2",
  "fonts/outfit-latin-600-normal.woff2", "fonts/outfit-latin-ext-600-normal.woff2",
];

async function cacheAll(urls) {
  const cache = await caches.open(VERSION);
  await Promise.allSettled(urls.map((u) => cache.add(new Request(u, { cache: "reload" }))));
}

self.addEventListener("install", (e) => {
  e.waitUntil(cacheAll(CORE).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page sends the list of PDFs from config.js
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "CACHE_URLS") e.waitUntil(cacheAll(e.data.urls));
});

// App files (html, css, js, config): try the network first so edits show up right away,
// and fall back to the saved copy when offline or the connection is slow (2.5 s).
// PDFs and other big files: saved copy first (instant), refreshed in the background.
const FRESH_MS = 2500;
const isPdf = (url) => /\.pdf(\?|$)/i.test(url);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req, { cache: "no-cache" }).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (cached && isPdf(req.url)) { e.waitUntil(network); return cached; }

    if (cached) {
      const timeout = new Promise((r) => setTimeout(() => r(null), FRESH_MS));
      const res = await Promise.race([network, timeout]);
      if (!res) e.waitUntil(network);
      return res || cached;
    }
    const res = await network;
    if (res) return res;
    if (req.mode === "navigate") return (await cache.match("index.html")) || Response.error();
    return Response.error();
  })());
});
