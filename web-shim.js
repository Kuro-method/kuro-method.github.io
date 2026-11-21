/* Kuro Method (web) - shim kecil pengganti script.js + API ekstensi,
 * supaya compress.js / ffmpeg.js ASLI dari ekstensi bisa jalan di GitHub Pages. */
(function () {
  'use strict';
  // 1) chrome.runtime.getURL -> URL absolut relatif ke halaman (dipakai ffmpeg.js & compress.js)
  var getURL = function (p) { return new URL(String(p).replace(/^\//, ''), location.href).href; };
  try {
    if (typeof window.chrome === 'undefined') window.chrome = {};
    if (!window.chrome.runtime) window.chrome.runtime = {};
    if (!window.chrome.runtime.getURL) window.chrome.runtime.getURL = getURL;
  } catch (e) {
    try { Object.defineProperty(window, 'chrome', { value: { runtime: { getURL: getURL } }, configurable: true }); } catch (e2) {}
  }

  // 2) i18n minimal (compress.js mengisi I18N.en / I18N.id sendiri)
  window.I18N = { en: {}, id: {} };
  window.currentLang = 'id';
  try { var saved = localStorage.getItem('kuro-lang'); if (saved === 'en' || saved === 'id') window.currentLang = saved; } catch (e) {}

  function has(k) { return I18N[currentLang] && I18N[currentLang][k] !== undefined || I18N.en[k] !== undefined; }
  window.t = function (key, vars) {
    var table = I18N[currentLang] || I18N.en;
    var s = table[key] !== undefined ? table[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  };
  window.applyLanguage = function () {
    document.documentElement.lang = currentLang;
    var q = function (sel, fn) { document.querySelectorAll(sel).forEach(function (el) { fn(el, el.getAttribute(sel.slice(1, -1))); }); };
    q('[data-i18n]',      function (el, k) { if (has(k)) el.textContent = t(k); });
    q('[data-i18n-html]', function (el, k) { if (has(k)) el.innerHTML = t(k); });
    q('[data-i18n-aria]', function (el, k) { if (has(k)) el.setAttribute('aria-label', t(k)); });
    q('[data-i18n-title]',function (el, k) { if (has(k)) el.title = t(k); });
    document.querySelectorAll('.lang-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-lang') === currentLang); });
    try { document.dispatchEvent(new CustomEvent('kuro-lang-changed', { detail: { lang: currentLang } })); } catch (e) {}
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.lang-btn'); if (!b) return;
    window.currentLang = b.getAttribute('data-lang');
    try { localStorage.setItem('kuro-lang', currentLang); } catch (e2) {}
    applyLanguage();
  });

  // 3) efek suara (sama seperti ekstensi: sukses / error kompres)
  var SFX = {
    /* success = MATTA MATTA | error = Ara Ara (sesuai request) */
    success: 'assets/MATTA_MATTA_SUOU_YUKI.mp3',
    error: 'assets/Ara_Ara_Anime_Ara_Ara_Kurumi_Message.mp3',
    check: 'assets/checkeh-Sinon.mp3',
    start: 'assets/link start-Sinon.mp3',
    on: 'assets/huwaw-Sinon.mp3',
    konnichiwa: 'assets/konnichiwa-Sinon.mp3',
    done: 'assets/MATTA_MATTA_SUOU_YUKI.mp3',
    ara: 'assets/Ara_Ara_Anime_Ara_Ara_Kurumi_Message.mp3'
  };
  window.playSfx = function (name) {
    try { if (!SFX[name]) return null; var a = new Audio(encodeURI(SFX[name])); a.volume = 1;
      var p = a.play(); if (p && p.catch) p.catch(function () {}); return a; } catch (e) { return null; }
  };
  window.kuroLogResult = function () {};

  // 4) peringatan jelas kalau SharedArrayBuffer belum aktif (butuh coi-serviceworker / HTTPS)
  window.addEventListener('load', function () {
    if (window.crossOriginIsolated) return;
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999999;background:#3b0d18;color:#ffb3c1;border:1px solid #ff0055;border-radius:8px;padding:8px 10px;font-size:12px;text-align:center';
    d.textContent = 'Mode aman browser (crossOriginIsolated) belum aktif - halaman reload otomatis sekali. Kalau tetap muncul, buka lewat https:// (GitHub Pages) dan pastikan coi-serviceworker.js ada di root.';
    document.body.appendChild(d);
  });
})();
