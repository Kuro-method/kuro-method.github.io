/*! coi-serviceworker (Kuro patch) - based on v0.1.7 by Guido Zoubobidou | MIT License
 *  Tambahan: auto-reload SATU kali setelah service worker aktif, supaya
 *  crossOriginIsolated (SharedArrayBuffer) langsung aktif di kunjungan pertama. */
if (typeof window === "undefined") {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
  self.addEventListener("fetch", (event) => {
    if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") return;
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.status === 0) return response;
        const h = new Headers(response.headers);
        h.set("Cross-Origin-Embedder-Policy", "require-corp");
        h.set("Cross-Origin-Opener-Policy", "same-origin");
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
      })
    );
  });
} else {
  (() => {
    const s = document.currentScript;
    if (!s || !s.hasAttribute("data-coi-register")) return;
    if (window.crossOriginIsolated || !("serviceWorker" in navigator)) return;
    const KEY = "kuro-coi-reloaded";
    navigator.serviceWorker.register(s.src).then(() => navigator.serviceWorker.ready).then(() => {
      if (!navigator.serviceWorker.controller || !window.crossOriginIsolated) {
        if (!sessionStorage.getItem(KEY)) { sessionStorage.setItem(KEY, "1"); location.reload(); }
      }
    }).catch((e) => console.warn("[coi] gagal register service worker:", e));
  })();
}
