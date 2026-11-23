/* Kuro Method Web — Kuro Transcode (multi-select)
 * Fitur bisa dikombinasi bebas: HQ Upscale, Kompres, Kuro Patcher, FastStart, Multiplier x2 / x4 FPS.
 * Progres memakai overlay 16:9 milik ekstensi (#upload-overlay), engine = Kuro FFmpeg + kuropatcher.js.
 * SFX: start=link start | done=MATTA | error=Ara Ara | UI=game sette | HQ=huwaw | dl=arigatou | welcome=konnichiwa
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var isEn = function () { return window.currentLang === 'en'; };
  var L = function (id, en) { return isEn() ? en : id; };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };

  /* ------------------------------------------------------------ util */
  function log(msg) {
    var box = $('tc-logBox'); if (!box) return;
    var d = document.createElement('div');
    d.innerHTML = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    box.appendChild(d); box.scrollTop = box.scrollHeight;
  }
  function playTcSfx(name) {
    var map = {
      start: 'assets/link start-Sinon.mp3', done: 'assets/MATTA_MATTA_SUOU_YUKI.mp3',
      error: 'assets/Ara_Ara_Anime_Ara_Ara_Kurumi_Message.mp3', konnichiwa: 'assets/konnichiwa-Sinon.mp3',
      huwaw: 'assets/huwaw-Sinon.mp3', game: 'assets/game sette ne-Sinon.mp3', arigatou: 'assets/arigatou-sinon.mp3'
    };
    try {
      if (!map[name]) return;
      var a = new Audio(encodeURI(map[name])); a.volume = 1;
      var p = a.play(); if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function toast(msg) {
    try { var t = $('kuro-toast'), x = $('kuro-toast-text'); if (!t || !x) return alert(msg);
      x.textContent = msg; t.classList.remove('hidden'); setTimeout(function () { t.classList.add('hidden'); }, 3200); }
    catch (e) { alert(msg); }
  }
  function fmtSize(n) {
    if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
    if (n >= 1048576) return (n / 1048576).toFixed(2) + ' MB';
    return (n / 1024).toFixed(1) + ' KB';
  }
  function fmtMB(b) { var mb = b / 1048576; return (mb >= 100 ? mb.toFixed(0) : mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)) + ' MB'; }
  function fmtClock(sec) {
    if (!isFinite(sec) || sec < 0) return '–';
    sec = Math.round(sec); var m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) return Math.floor(m / 60) + 'j ' + (m % 60) + 'm';
    return (m > 0 ? m + 'm ' : '') + (s < 10 && m > 0 ? '0' : '') + s + 's';
  }
  function fmtFps(v) { return String(Math.round(v * 100) / 100); }
  function getExt(name) { var m = String(name).match(/\.([A-Za-z0-9]{2,5})$/); return m ? m[1].toLowerCase() : 'mp4'; }
  function refreshText() {
    document.querySelectorAll('[data-ti]').forEach(function (el) { el.textContent = el.getAttribute(isEn() ? 'data-te' : 'data-ti'); });
  }

  /* ------------------------------------------------------------ state */
  var S = {
    file: null, url: '', fps: 0, duration: 0,
    opts: { hq: false, compress: false, optimize: false, patch: true, faststart: true },
    res: '1080', mult: 0, method: 'dup', codec: 'auto', pw: 0, ph: 0,
    running: false, cancel: null, blobUrl: '', outName: ''
  };
  var META_DESC = 'KuroPatcher';   /* tag Description (terbaca di MX Player) */
  var RES_LABEL = { original: 'asli', '720': '720p', '1080': '1080p', '1440': '2K', '2160': '4K', '4320': '8K' };

  /* ------------------------------------------------------------ overlay progres (ekstensi) */
  var OV = {
    vals: [0, 0, 0], last: 0, saved: [], cancelTxt: '',
    show: function (file, url) {
      var ov = $('upload-overlay'); if (!ov) return;
      ov.classList.remove('hidden');
      /* latar: assets/overlay-bg.mp4 (hanya untuk Kuro Transcode) */
      var bg = $('tc-ov-bg');
      if (bg) {
        if (!bg.getAttribute('src')) bg.setAttribute('src', 'assets/overlay-bg.mp4');
        ov.classList.add('tc-bgmode');
        try { var bp = bg.play(); if (bp && bp.catch) bp.catch(function () {}); } catch (e) {}
      }
      var v = $('upload-overlay-video');
      if (v && url) { v.src = url; v.loop = true; v.muted = true; try { v.play().catch(function () {}); } catch (e) {} }
      if ($('upload-overlay-file')) $('upload-overlay-file').textContent = file.name + ' · ' + fmtSize(file.size);
      var names = [L('Membaca file', 'Reading file'), L('Transcode', 'Transcode'), L('Menyiapkan hasil', 'Preparing result')];
      OV.saved = [];
      for (var i = 1; i <= 3; i++) {
        var lab = $('upload-step-' + i) && $('upload-step-' + i).children[1];
        if (lab) { OV.saved[i] = lab.textContent; lab.textContent = names[i - 1]; }
        OV.vals[i - 1] = 0; OV.setBar(i, 0);
      }
      OV.overall(L('Menyiapkan…', 'Preparing…'));
      OV.statsReset();
      var cb = $('ov-cancel');
      if (cb) { cb.disabled = false; cb.classList.remove('hidden'); var sp = cb.querySelector('span'); if (sp) { OV.cancelTxt = sp.textContent; sp.textContent = L('Batalkan proses', 'Cancel'); } }
    },
    hide: function () {
      var ov = $('upload-overlay'); if (ov) { ov.classList.add('hidden'); ov.classList.remove('tc-bgmode'); }
      var bg = $('tc-ov-bg'); if (bg) { try { bg.pause(); } catch (e) {} }
      var v = $('upload-overlay-video'); if (v) { try { v.pause(); } catch (e) {} }
      for (var i = 1; i <= 3; i++) {
        var lab = $('upload-step-' + i) && $('upload-step-' + i).children[1];
        if (lab && OV.saved[i] !== undefined) lab.textContent = OV.saved[i];
      }
      var cb = $('ov-cancel'), sp = cb && cb.querySelector('span'); if (sp && OV.cancelTxt) sp.textContent = OV.cancelTxt;
    },
    setBar: function (n, pct) {
      pct = Math.max(0, Math.min(100, pct));
      var bar = $('upload-bar-' + n), pe = $('upload-pct-' + n), st = $('upload-step-' + n);
      if (bar) bar.style.width = pct + '%'; if (pe) pe.textContent = Math.round(pct) + '%';
      if (st) { st.classList.toggle('active', pct > 0 && pct < 100); st.classList.toggle('done', pct >= 100); }
    },
    overall: function (label) {
      var p = OV.vals[0] * 0.10 + OV.vals[1] * 0.80 + OV.vals[2] * 0.10;
      if ($('upload-overlay-percent')) $('upload-overlay-percent').textContent = Math.round(p) + '%';
      if (label && $('upload-overlay-status')) $('upload-overlay-status').textContent = label;
    },
    stage: function (n, pct, label) { OV.vals[n - 1] = Math.max(0, Math.min(100, pct)); OV.setBar(n, OV.vals[n - 1]); OV.overall(label); },
    statsReset: function () {
      if ($('ov-mb')) $('ov-mb').textContent = '0 MB'; if ($('ov-speed')) $('ov-speed').textContent = '–'; if ($('ov-eta')) $('ov-eta').textContent = '–';
      OV.last = 0;
    },
    stats: function (ratio, live, dur, startedAt) {
      var now = performance.now(); if (now - OV.last < 120) return; OV.last = now;
      if ($('ov-mb')) $('ov-mb').textContent = live.size > 0 ? fmtMB(live.size) : '–';
      var sp = live.speed;
      if (!sp && startedAt && live.time > 0) { var w = (now - startedAt) / 1000; if (w > 0.25) sp = live.time / w; }
      if ($('ov-speed')) $('ov-speed').textContent = sp > 0 ? sp.toFixed(2) + '×' : '–';
      if ($('ov-eta')) $('ov-eta').textContent = (sp > 0 && dur > 0 && live.time < dur) ? fmtClock((dur - live.time) / sp) : (ratio >= 1 ? '0s' : '–');
    }
  };
  function applyOverlayZoom() {
    var z = 1;
    try {
      var iw = window.innerWidth, sw = (window.screen && screen.width) || iw;
      var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
      if (coarse && sw > 0 && iw / sw > 1.25) z = Math.min(3.6, (iw / sw) * 0.92);
    } catch (e) {}
    document.documentElement.style.setProperty('--ov-zoom', z > 1 ? z.toFixed(2) : '1');
  }
  function overlayBusy() { var o = $('upload-overlay'); return !!(o && !o.classList.contains('hidden')); }

  /* ------------------------------------------------------------ FPS multiplier */
  function mulFps(f, k) {
    var ns = [24, 30, 60, 120];
    for (var i = 0; i < ns.length; i++) if (Math.abs(f - ns[i] * 1000 / 1001) < 0.01) return { expr: (ns[i] * k * 1000) + '/1001', val: f * k };
    var o = f * k; return { expr: String(Math.round(o * 1000) / 1000), val: o };
  }
  async function probeStream(ff, inN) {
    var txt = '', cb = function (e) { if (e && e.message) txt += e.message + '\n'; };
    ff.on('log', cb);
    try { await ff.exec(['-hide_banner', '-i', inN]); } catch (e) {}
    ff.off('log', cb);
    var line = (txt.match(/Video:[^\n]*/) || [''])[0];
    var fm = line.match(/(\d+(?:\.\d+)?)\s*fps/) || line.match(/(\d+(?:\.\d+)?)\s*tbr/);
    var cm = line.match(/Video:\s*([A-Za-z0-9_]+)/);
    return { fps: fm ? parseFloat(fm[1]) : 0, codec: cm ? cm[1].toLowerCase() : '' };
  }
  function codecKey(name) {
    var n = String(name || '').toLowerCase();
    if (/264|avc/.test(n)) return 'h264';
    if (/hevc|265|hvc|hev1/.test(n)) return 'hevc';
    return n;
  }
  function codecLabel(k) { return k === 'h264' ? 'H.264' : k === 'hevc' ? 'HEVC' : (k ? k.toUpperCase() : '?'); }

  /* ------------------------------------------------------------ rencana proses */
  function buildPlan() {
    var o = S.opts, p = { codec: S.codec === 'auto' ? null : S.codec, hq: o.hq, compress: o.compress, optimize: !!o.optimize, patch: o.patch, faststart: o.faststart, mult: S.mult, method: S.method };
    p.scale = (o.hq && S.res !== 'original') ? S.res : null;
    p.encode = !!(o.hq || o.compress || o.optimize || S.mult || p.codec);
    p.count = (p.codec ? 1 : 0) + (o.hq ? 1 : 0) + (o.compress ? 1 : 0) + (o.optimize ? 1 : 0) + (o.patch ? 1 : 0) + (o.faststart ? 1 : 0) + (S.mult ? 1 : 0);
    return p;
  }
  function planText(p) {
    var a = [];
    if (p.mult) a.push(L('Multiplier x', 'Multiplier x') + p.mult + (S.fps ? ' (' + fmtFps(S.fps) + '→' + fmtFps(S.fps * p.mult) + ' fps)' : ''));
    if (p.codec) a.push(p.codec === 'hevc' ? 'H.265 Main' : 'H.264 High');
    if (p.hq) a.push('HQ Upscale' + (p.scale ? ' ' + RES_LABEL[p.scale] : ' (' + L('resolusi asli', 'original res') + ')'));
    if (p.compress) a.push(L('Kompres', 'Compress'));
    if (p.optimize) a.push('Optimizer');
    if (p.faststart) a.push('FastStart');
    if (p.patch) a.push('Kuro Patcher');
    return a.join(' → ');
  }
  function tagText(p) {
    var t = [];
    if (p.codec) t.push(p.codec === 'hevc' ? 'h265' : 'h264');
    if (p.hq) t.push('hq'); if (p.compress) t.push('cmp'); if (p.optimize) t.push('opt'); if (p.mult) t.push('x' + p.mult);
    if (p.faststart) t.push('fs'); if (p.patch) t.push('patch');
    return t.join('-') || 'out';
  }


  /* ------------------------------------------------------------ estimasi ukuran hasil */
  function baseCrf(plan) { return plan.compress ? 23 : (plan.hq ? 18 : (plan.optimize ? 21 : 20)); }
  function srcDims() {
    var v = (S.meta && S.meta.video) || {};
    return { w: v.width || S.pw || 0, h: v.height || S.ph || 0 };
  }
  /* codecOverride: 'h264' | 'hevc' | undefined (pakai pilihan/otomatis). Mengembalikan {mid, low, high, exact, br, ...} atau null */
  function estimateSize(plan, codecOverride) {
    if (!S.file) return null;
    var size = S.file.size, dur = S.duration || 0;
    if (!plan.encode) return { mid: size, low: size, high: size, exact: true, same: true };
    if (!(dur > 0)) return null;
    var sk = codecKey(S.vcodec) || 'h264';
    var outK = codecOverride || plan.codec || (sk === 'hevc' ? 'hevc' : 'h264');
    var d = srcDims(), fpsIn = S.fps || 30, fpsOut = fpsIn * (plan.mult || 1);
    var wIn = d.w || 1280, hIn = d.h || 720;
    var hOut = plan.scale ? parseInt(plan.scale, 10) : hIn;
    var wOut = Math.round(wIn * hOut / hIn / 2) * 2; hOut = Math.round(hOut / 2) * 2;
    var pixOut = wOut * hOut, pixIn = wIn * hIn;
    var q = baseCrf(plan);                                  /* skala x264; x265 sudah +5 di encoder */
    var model = pixOut * 30 * 0.085 * Math.pow(fpsOut / 30, 0.75) * Math.pow(2, (23 - q) / 6);
    if (outK === 'hevc') model *= 0.62;
    var hasAudio = !S.meta || !!S.meta.audio;
    var ext = getExt(S.file.name);
    var audioBr = !hasAudio ? 0 : plan.compress ? 128000 : (/^(mp4|mov|m4v|3gp)$/.test(ext) ? 128000 : 192000);
    var srcVideoBr = Math.max(0, size * 8 / dur - (hasAudio ? 128000 : 0));
    var vbr = model, fromSrc = false;
    if (srcVideoBr > 0) {
      var cf = sk === outK ? 1 : (outK === 'hevc' ? (sk === 'h264' ? 0.65 : 0.85) : (sk === 'hevc' ? 1.5 : 1.2));
      var srcRef = srcVideoBr * (pixOut / pixIn) * Math.pow(fpsOut / fpsIn, 0.6) * cf * Math.pow(2, (20 - q) / 6);
      if (srcRef * 1.15 < model) { vbr = srcRef * 1.15; fromSrc = true; }
    }
    var mid = (vbr + audioBr) * dur / 8 * 1.01;
    return { mid: mid, low: mid * (fromSrc ? 0.75 : 0.75), high: mid * (fromSrc ? 1.2 : 1.6), exact: false,
             br: mid * 8 / dur, w: wOut, h: hOut, fps: fpsOut, codec: outK };
  }
  function renderEstimate(p) {
    var box = $('tc-estimate'); if (!box) return;
    ['auto', 'h264', 'hevc'].forEach(function (k) {
      var el = $('tc-est-' + k); if (!el) return;
      var e = estimateSize(p, k === 'auto' ? undefined : k);
      el.textContent = e ? '≈ ' + fmtMB(e.mid) : (S.file ? '…' : '–');
    });
    var e = estimateSize(p), sz = S.file ? S.file.size : 0;
    if (!e) { $('tc-est-size').textContent = '…'; $('tc-est-fill').style.width = '0%'; $('tc-est-sub').textContent = L('Menunggu info durasi video…', 'Waiting for video duration…'); return; }
    $('tc-est-size').textContent = e.exact ? fmtMB(e.mid) : '≈ ' + fmtMB(e.mid);
    var ratio = sz > 0 ? e.mid / sz : 0;
    var fill = $('tc-est-fill'); fill.style.width = Math.max(4, Math.min(100, ratio * 100)) + '%'; fill.classList.toggle('over', ratio > 1);
    var bits = [];
    if (e.exact) bits.push(L('Tanpa re-encode — ukuran ≈ sama dengan aslinya', 'No re-encode — size ≈ same as the source'));
    else {
      bits.push(L('Kisaran ', 'Range ') + fmtMB(e.low) + ' – ' + fmtMB(e.high));
      bits.push(L('Asli ', 'Source ') + fmtMB(sz));
      var pct = Math.round((1 - ratio) * 100);
      bits.push(pct >= 0 ? L('hemat ~', 'saves ~') + pct + '%' : L('lebih besar ~', 'larger by ~') + Math.abs(pct) + '%');
      bits.push(e.w + '×' + e.h + ' · ' + fmtFps(e.fps) + ' fps · ' + (e.br / 1e6).toFixed(1) + ' Mbps');
    }
    $('tc-est-sub').textContent = bits.join(' · ');
  }

  /* ------------------------------------------------------------ render opsi */
  function render() {
    var p = buildPlan();
    document.querySelectorAll('#tc-features .tc-opt').forEach(function (b) {
      var on = !!S.opts[b.getAttribute('data-opt')]; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('#tc-mult .tc-opt').forEach(function (b) {
      var on = S.mult === parseInt(b.getAttribute('data-mult'), 10); b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('#tc-codec .tc-opt').forEach(function (b) {
      var on = S.codec === b.getAttribute('data-codec'); b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('#tc-res .tc-chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-res') === S.res); });
    $('tc-res-wrap').classList.toggle('hidden', !S.opts.hq);
    $('tc-method-wrap').classList.toggle('hidden', !S.mult);
    [2, 4].forEach(function (k) {
      $('tc-x' + k + '-desc').textContent = S.fps ? L('FPS asli ', 'Source FPS ') + fmtFps(S.fps) + ' × ' + k : L('FPS asli × ', 'Source FPS × ') + k;
      $('tc-x' + k + '-badge').textContent = S.fps ? fmtFps(S.fps * k) + 'FPS' : '×' + k;
    });
    $('tc-summary').innerHTML = p.count ? '<b>' + L('Alur proses', 'Pipeline') + ':</b> ' + esc(planText(p)) : L('Belum ada fitur dipilih — pilih minimal satu.', 'Nothing selected yet — pick at least one.');
    var warn = [];
    if (p.scale === '4320' || p.scale === '2160') warn.push(L('Upscale 4K/8K sangat berat untuk browser — butuh RAM besar dan waktu lama.', '4K/8K upscaling is very heavy for a browser — needs lots of RAM and time.'));
    if (p.mult && p.method === 'mci') warn.push(L('Interpolasi gerak SANGAT lambat di WASM; pakai video pendek.', 'Motion interpolation is VERY slow in WASM; use short videos.'));
    if (p.patch && !p.encode && S.meta && S.meta.container && !S.meta.isMp4Family) warn.push(L('Bukan MP4/MOV — Patcher akan remux ke MP4 dulu.', 'Not MP4/MOV — Patcher will remux to MP4 first.'));
    if (p.codec === 'hevc') warn.push(L('H.265 lebih kecil, tapi sebagian HP/pemutar lama & browser tidak bisa memutarnya, dan encoding x265 di WASM jauh lebih lambat.', 'H.265 is smaller, but some older phones/players/browsers cannot play it, and x265 encoding in WASM is much slower.'));
    $('tc-warn').innerHTML = warn.map(esc).join('<br>'); $('tc-warn').classList.toggle('hidden', !warn.length);
    $('tc-processBtn').disabled = !p.count || S.running;
    renderEstimate(p);
  }

  /* ------------------------------------------------------------ file */
  function releaseResult() {
    if (S.blobUrl) { try { URL.revokeObjectURL(S.blobUrl); } catch (e) {} }
    S.blobUrl = ''; S.outName = ''; if ($('tc-result')) $('tc-result').classList.add('hidden');
  }
  function setFile(file) {
    if (!file) return;
    releaseResult();
    if (S.url) { try { URL.revokeObjectURL(S.url); } catch (e) {} }
    S.file = file; S.fps = 0; S.duration = 0; S.meta = null; S.vcodec = ''; S.pw = 0; S.ph = 0; S.url = URL.createObjectURL(file);
    $('tc-preview').src = S.url;
    $('tc-fileName').textContent = file.name; $('tc-fileInfo').textContent = fmtSize(file.size);
    $('tc-input-card').classList.add('hidden'); $('tc-options').classList.remove('hidden');
    log(L('File dipilih: ', 'File selected: ') + esc(file.name) + ' (' + fmtSize(file.size) + ')');
    playTcSfx('game');
    try {
      if (window.KuroMp4 && typeof KuroMp4.inspect === 'function') {
        KuroMp4.inspect(file).then(function (m) {
          if (S.file !== file || !m) return;
          S.meta = m; var v = m.video || {}; S.fps = v.fps || 0; S.duration = v.durationSec || 0; S.vcodec = v.codec || '';
          var bits = [fmtSize(file.size)];
          if (v.width && v.height) bits.push(v.width + '×' + v.height);
          if (S.fps) bits.push(fmtFps(S.fps) + ' fps');
          if (v.codec) bits.push(v.codec);
          if (S.duration) bits.push(fmtClock(S.duration));
          $('tc-fileInfo').textContent = bits.join(' · ');
          render();
        }).catch(function () {});
      }
    } catch (e) {}
    render();
  }
  function clearFile() {
    if (S.running) return;
    releaseResult();
    if (S.url) { try { URL.revokeObjectURL(S.url); } catch (e) {} }
    S.url = ''; S.file = null; S.fps = 0; S.duration = 0; S.meta = null; S.vcodec = ''; S.pw = 0; S.ph = 0;
    try { $('tc-preview').removeAttribute('src'); $('tc-preview').load(); } catch (e) {}
    try { $('tc-videoInput').value = ''; } catch (e) {}
    $('tc-options').classList.add('hidden'); $('tc-input-card').classList.remove('hidden');
  }

  /* ------------------------------------------------------------ FFmpeg */
  async function ffmpegRun(file, ctx, argsFn) {
    OV.stage(1, 3, L('Memuat FFmpeg…', 'Loading FFmpeg…'));
    var ff = await window.__kuroGetFFmpeg();
    var ext = getExt(file.name), inN = 'tc_in.' + ext, outN = 'tc_out.mp4';
    var live = { size: 0, speed: 0, time: 0 }, startedAt = 0, lastErr = '';
    var tick = function () {
      var dur = ctx.duration || 0, ratio = dur > 0 ? Math.min(1, live.time / dur) : 0;
      if (ratio > 0) OV.stage(2, Math.min(99, ratio * 100), L('Memproses ', 'Processing ') + Math.round(ratio * 100) + '%');
      OV.stats(ratio, live, dur, startedAt);
    };
    var onL = function (e) {
      if (!e || !e.message) return; var m = e.message;
      if (e.type === 'stdout') {
        var a = m.match(/total_size=\s*(\d+)/); if (a) live.size = parseInt(a[1], 10);
        var b = m.match(/speed=\s*([\d.]+)\s*x/); if (b && parseFloat(b[1]) > 0) live.speed = parseFloat(b[1]);
        var c = m.match(/out_time_us=\s*(\d+)/) || m.match(/out_time_ms=\s*(\d+)/); if (c) live.time = parseInt(c[1], 10) / 1e6;
        if (/progress=(continue|end)/.test(m)) tick();
      } else if (/error|invalid|failed|not supported|unable|could not/i.test(m)) lastErr = m;
    };
    var onP = function (p) {
      if (!p || ctx.duration) return;
      if (typeof p.duration === 'number' && p.duration > 0) ctx.duration = p.duration;
    };
    ff.on('log', onL); ff.on('progress', onP);
    try {
      OV.stage(1, 12, L('Membaca file…', 'Reading file…'));
      var data = new Uint8Array(await file.arrayBuffer());
      OV.stage(1, 55, L('Menulis ke memori…', 'Writing to memory…'));
      await ff.writeFile(inN, data); data = null;
      OV.stage(1, 100, L('File siap', 'File ready'));
      var args = await argsFn(ff, inN, outN, ext);
      log(L('Menjalankan FFmpeg: ', 'Running FFmpeg: ') + esc(args.join(' ').replace(' -preset veryfast', '')));
      startedAt = performance.now(); OV.stage(2, 1, L('Memproses…', 'Processing…'));
      var code = await ff.exec(args);
      if (code !== 0 && code !== undefined) throw new Error('FFmpeg exit ' + code + (lastErr ? ' — ' + lastErr : ''));
      OV.stage(2, 100, L('Transcode selesai', 'Transcode done'));
      OV.stage(3, 25, L('Membaca hasil…', 'Reading result…'));
      var out = await ff.readFile(outN, 'binary');
      try { await ff.deleteFile(inN); } catch (e) {} try { await ff.deleteFile(outN); } catch (e) {}
      return out;
    } finally { try { ff.off('log', onL); ff.off('progress', onP); } catch (e) {} }
  }

  function encodeArgs(plan, ctx, info) {
    return async function (ff, inN, outN, ext) {
      var f = S.fps, ck = codecKey(S.vcodec);
      if ((plan.mult && !f) || !ck) {
        OV.overall(L('Membaca info video…', 'Reading video info…'));
        var pr = await probeStream(ff, inN);
        if (!f) f = pr.fps; if (!ck) ck = codecKey(pr.codec);
      }
      if (plan.mult && !f) throw new Error(L('FPS video tidak bisa dideteksi.', 'Could not detect the video FPS.'));
      /* codec output = codec input (H.264 -> libx264, HEVC -> libx265); codec lain (VP9/AV1/dll) -> H.264 agar aman di MP4 */
      var enc = plan.codec ? (plan.codec === 'hevc' ? 'libx265' : 'libx264') : (ck === 'hevc' ? 'libx265' : 'libx264');
      info.codec = [codecLabel(ck), enc === 'libx265' ? 'H.265 Main' : 'H.264 High'];
      info.same = ck === (enc === 'libx265' ? 'hevc' : 'h264');
      var vf = [];
      if (plan.mult) {
        var d = mulFps(f, plan.mult); info.fps = [f, d.val];
        vf.push(plan.method === 'mci' ? 'minterpolate=fps=' + d.expr + ':mi_mode=mci:mc_mode=obmc:me_mode=bidir:me=hexbs'
          : plan.method === 'blend' ? 'framerate=fps=' + d.expr : 'fps=fps=' + d.expr);
      }
      if (plan.scale) vf.push('scale=-2:' + plan.scale + ':flags=lanczos');
      else if (plan.optimize) vf.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');   /* dimensi genap: wajib untuk yuv420p */
      if (plan.optimize) vf.push('setsar=1');
      vf.push('format=yuv420p');
      var crf = baseCrf(plan);
      if (enc === 'libx265') crf += 5;            /* skala CRF x265 ~ +5 dari x264 untuk kualitas setara */
      var a = ['-hide_banner', '-y', '-i', inN, '-map', '0:v:0', '-map', '0:a:0?', '-vf', vf.join(','), '-c:v', enc, '-preset', (enc === 'libx264' && plan.optimize) ? 'faster' : 'veryfast',   /* Optimizer: x264 = faster, x265 = veryfast */ '-crf', String(crf), '-pix_fmt', 'yuv420p'];
      if (enc === 'libx265') a.push('-tag:v', 'hvc1', '-x265-params', 'log-level=error:profile=main' + (plan.optimize ? ':aq-mode=3:rc-lookahead=30:deblock=1,1' : ''));
      else a.push('-profile:v', 'high');
      if (plan.optimize) {
        /* Optimizer (H.264 High = preset faster, H.265 Main = preset veryfast): AQ adaptif, lookahead, keyframe tiap ~2 detik (seek cepat), buang chapter/stream ekstra */
        if (enc === 'libx264') a.push('-x264-params', 'aq-mode=3:rc-lookahead=30:deblock=1,1');
        var outFps = f ? (plan.mult ? f * plan.mult : f) : 0;
        if (outFps > 0) a.push('-g', String(Math.max(12, Math.round(outFps * 2))));
        a.push('-map_chapters', '-1');
      }
      if (plan.compress || !/^(mp4|mov|m4v|3gp)$/.test(ext)) a.push('-c:a', 'aac', '-b:a', plan.compress ? '128k' : '192k'); else a.push('-c:a', 'copy');
      if (plan.faststart || plan.optimize) a.push('-movflags', '+faststart');
      a.push('-metadata', 'description=' + META_DESC, '-metadata', 'comment=' + META_DESC);
      a.push('-metadata', 'encoder=KuroPatcherTranscode', '-progress', 'pipe:1', '-stats_period', '0.4', outN);
      return a;
    };
  }
  function remuxArgs(plan) {
    return async function (ff, inN, outN) {
      var a = ['-hide_banner', '-y', '-i', inN, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-map_metadata', '0'];
      if (plan.faststart) a.push('-movflags', '+faststart');
      a.push('-metadata', 'description=' + META_DESC, '-metadata', 'comment=' + META_DESC);
      a.push('-progress', 'pipe:1', '-stats_period', '0.4', outN); return a;
    };
  }

  function patchStep(bytes, rows) {
    var P = window.KuroMp4Patcher;
    if (!P) throw new Error(L('kuropatcher.js tidak termuat.', 'kuropatcher.js did not load.'));
    var chk = P.checkCompatibility(bytes);
    if (!chk.compatible) throw new Error(L('Kuro Patcher: bukan MP4/MOV non-fragmented yang valid', 'Kuro Patcher: not a valid non-fragmented MP4/MOV') + ' (' + (chk.reason || '-') + ')');
    var res = P.processAndReport(bytes), ok = null;
    try { ok = P.verifyOutput(bytes, res.bytes).ok; } catch (e) {}
    var r = res.report || {};
    rows.push(['Kuro Patcher', (ok === null ? '—' : ok ? 'OK ✔' : L('GAGAL ✘', 'FAILED ✘')) + (r.moovMovedBeforeMdat ? ' · MOOV ' + L('di depan', 'up front') : '') + (r.videoUntouched ? ' · ' + L('video tidak disentuh', 'video untouched') : '')]);
    log('Kuro Patcher: ' + esc(JSON.stringify(r).slice(0, 400)));
    if (ok === false) throw new Error(L('Verifikasi Kuro Patcher gagal.', 'Kuro Patcher verification failed.'));
    return res.bytes;
  }

  async function pipeline(file, plan, rows) {
    var ctx = { duration: S.duration || 0 }, info = {}, bytes = null;
    OV.stage(1, 2, L('Menyiapkan…', 'Preparing…'));
    if (plan.encode) {
      log(L('Transcode: ', 'Transcode: ') + esc(planText(plan)));
      bytes = await ffmpegRun(file, ctx, encodeArgs(plan, ctx, info));
      if (plan.optimize) {
        var before = file.size, after = bytes.length;
        if (!plan.hq && !plan.mult && !plan.compress && after >= before) {
          /* Optimizer-saja: kalau hasil encode malah lebih besar, pakai remux (copy stream) agar tidak rugi */
          log(L('Optimizer: hasil encode lebih besar dari aslinya — pakai remux tanpa re-encode.', 'Optimizer: encoded result is larger than the source — using a stream-copy remux instead.'));
          try {
            bytes = await ffmpegRun(file, { duration: S.duration || 0 }, remuxArgs({ faststart: true }));
            rows.push(['Optimizer', L('Sudah efisien — remux + FastStart (tanpa re-encode)', 'Already efficient — remux + FastStart (no re-encode)')]);
          } catch (e) {
            log(L('Remux gagal, pakai hasil encode.', 'Remux failed, keeping the encoded result.') + ' ' + esc(e && e.message || ''));
            rows.push(['Optimizer', fmtSize(before) + ' → ' + fmtSize(after)]);
          }
        } else {
          var pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
          rows.push(['Optimizer', fmtSize(before) + ' → ' + fmtSize(after) + (pct > 0 ? '  (−' + pct + '%)' : pct < 0 ? '  (+' + Math.abs(pct) + '%)' : '')]);
        }
      }
      if (info.codec) rows.push(['Codec', info.same ? info.codec[1] + ' (' + L('sama dengan input', 'same as input') + ')' : info.codec[0] + ' → ' + info.codec[1] + ' (MP4)']);
      rows.push([L('Metadata', 'Metadata'), 'Description: ' + META_DESC]);
      if (info.fps) rows.push(['FPS', fmtFps(info.fps[0]) + ' → ' + fmtFps(info.fps[1]) + '  (×' + plan.mult + ')']);
    } else if (plan.patch) {
      OV.stage(1, 20, L('Membaca file…', 'Reading file…'));
      var u8 = new Uint8Array(await file.arrayBuffer());
      OV.stage(1, 100, L('File siap', 'File ready'));
      var chk = window.KuroMp4Patcher ? KuroMp4Patcher.checkCompatibility(u8) : { compatible: false, reason: 'no patcher' };
      if (chk.compatible) { bytes = u8; OV.stage(2, 100, L('Struktur MP4 valid', 'MP4 structure valid')); }
      else {
        log(L('Bukan MP4 yang bisa dipatch langsung (', 'Not directly patchable (') + esc(chk.reason || '-') + L(') — remux ke MP4 dulu…', ') — remuxing to MP4 first…'));
        u8 = null; bytes = await ffmpegRun(file, ctx, remuxArgs({ faststart: true }));
      }
    } else if (plan.faststart) {
      bytes = await ffmpegRun(file, ctx, remuxArgs(plan));
      OV.stage(2, 100, L('Remux selesai', 'Remux done'));
    }
    if (plan.patch) {
      OV.stage(2, 100, L('Transcode selesai', 'Transcode done'));
      OV.stage(3, 55, L('Menjalankan Patcher…', 'Running Patcher…'));
      await new Promise(function (r) { setTimeout(r, 40); });
      bytes = patchStep(bytes, rows);
    }
    OV.stage(3, 100, L('Selesai!', 'Done!'));
    return bytes;
  }

  /* ------------------------------------------------------------ jalankan */
  async function runTranscode() {
    if (S.running || !S.file) return;
    var plan = buildPlan();
    if (!plan.count) { toast(L('Pilih minimal satu fitur.', 'Pick at least one feature.')); playTcSfx('error'); return; }
    if (overlayBusy()) { toast(L('Proses lain masih berjalan.', 'Another job is still running.')); return; }
    var file = S.file, rows = [], cancelled = false, t0 = performance.now();
    S.running = true; render(); releaseResult();
    playTcSfx('start');
    log(L('Memulai Kuro Transcode: ', 'Starting Kuro Transcode: ') + '<b>' + esc(planText(plan)) + '</b>');
    applyOverlayZoom(); OV.show(file, S.url);
    var cancelP = new Promise(function (_, rej) { S.cancel = function () { cancelled = true; rej(new Error('__cancelled__')); }; });
    try {
      var job = pipeline(file, plan, rows); job.catch(function () {});
      var bytes = await Promise.race([job, cancelP]);
      var blob = new Blob([bytes], { type: 'video/mp4' });
      S.blobUrl = URL.createObjectURL(blob);
      S.outName = 'kuro_' + tagText(plan) + '_' + file.name.replace(/\.[^.]+$/, '') + '.mp4';
      var items = [[L('Alur proses', 'Pipeline'), planText(plan)]].concat(rows, [
        [L('Ukuran asli', 'Original size'), fmtSize(file.size)], [L('Ukuran hasil', 'Result size'), fmtSize(blob.size)],
        [L('Waktu proses', 'Time taken'), fmtClock((performance.now() - t0) / 1000)]]);
      $('tc-resGrid').innerHTML = items.map(function (r) { return '<div class="cmp-info-item"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('');
      await new Promise(function (r) { setTimeout(r, 450); });
      OV.hide(); $('tc-result').classList.remove('hidden');
      try { $('tc-result').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      log(L('Proses selesai! Ukuran: ', 'Done! Size: ') + fmtSize(file.size) + ' → ' + fmtSize(blob.size));
      playTcSfx('done'); download();
      try { if (window.__kuroResetFFmpeg) window.__kuroResetFFmpeg(); } catch (e) {}   /* lepas memori WASM */
    } catch (err) {
      OV.hide();
      try { if (window.__kuroResetFFmpeg) window.__kuroResetFFmpeg(); } catch (e) {}
      if (cancelled) { log(L('Dibatalkan.', 'Cancelled.')); toast(L('Dibatalkan.', 'Cancelled.')); }
      else {
        var msg = (err && err.message) ? err.message : String(err);
        console.error(err); log('ERROR: ' + esc(msg)); playTcSfx('error');
        alert(L('Gagal memproses: ', 'Processing failed: ') + msg);
      }
    } finally { S.running = false; S.cancel = null; render(); }
  }
  function download() {
    if (!S.blobUrl) return;
    var a = document.createElement('a'); a.href = S.blobUrl; a.download = S.outName || 'kuro_transcode.mp4';
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 800);
  }

  /* ------------------------------------------------------------ mode switch + notice (tetap) */
  function switchEncoderMode(mode) {
    var k = $('mode-kompres'), t = $('mode-transcode'), bk = $('btn-mode-kompres'), bt = $('btn-mode-transcode');
    if (!k || !t) return;
    var tr = mode !== 'kompres';
    k.classList.toggle('hidden', tr); t.classList.toggle('hidden', !tr);
    if (bk) bk.classList.toggle('active', !tr); if (bt) bt.classList.toggle('active', tr);
    if (tr) playTcSfx('konnichiwa');
  }
  function initNoticeCard() {
    var card = $('kuroNoticeCard'), timerEl = $('kuroNoticeTimer'); if (!card) return;
    var left = 5, iv = setInterval(function () {
      left -= 1;
      if (left > 0) { if (timerEl) timerEl.textContent = 'Auto Close: ' + left + 's'; }
      else { clearInterval(iv); card.classList.add('kuro-notice-closing'); setTimeout(function () { card.style.display = 'none'; }, 500); }
    }, 1000);
  }

  /* ------------------------------------------------------------ init */
  function initTools() {
    initNoticeCard();
    var welcomed = false;
    document.addEventListener('click', function () { if (welcomed) return; welcomed = true; playTcSfx('konnichiwa'); }, { once: true });

    var b1 = $('btn-mode-kompres'), b2 = $('btn-mode-transcode');
    if (b1) b1.addEventListener('click', function () { switchEncoderMode('kompres'); });
    if (b2) b2.addEventListener('click', function () { switchEncoderMode('transcode'); });

    document.querySelectorAll('#tc-features .tc-opt').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-opt'); S.opts[k] = !S.opts[k];
        playTcSfx(k === 'hq' && S.opts[k] ? 'huwaw' : 'game'); render();
      });
    });
    document.querySelectorAll('#tc-mult .tc-opt').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = parseInt(b.getAttribute('data-mult'), 10); S.mult = (S.mult === k) ? 0 : k; playTcSfx('game'); render();
      });
    });
    document.querySelectorAll('#tc-codec .tc-opt').forEach(function (b) {
      b.addEventListener('click', function () { S.codec = b.getAttribute('data-codec'); playTcSfx('game'); render(); });
    });
    var pv = $('tc-preview');
    if (pv) pv.addEventListener('loadedmetadata', function () {
      if (pv.videoWidth) { S.pw = pv.videoWidth; S.ph = pv.videoHeight; }
      if (!S.duration && isFinite(pv.duration) && pv.duration > 0) S.duration = pv.duration;
      render();
    });
    document.querySelectorAll('#tc-res .tc-chip').forEach(function (c) {
      c.addEventListener('click', function () { S.res = c.getAttribute('data-res'); playTcSfx('game'); render(); });
    });
    $('tc-method').addEventListener('change', function (e) { S.method = e.target.value; playTcSfx('game'); render(); });
    $('tc-presetAll').addEventListener('click', function () {
      S.opts = { hq: true, compress: false, optimize: true, patch: true, faststart: true }; S.res = '1080'; S.mult = 2; playTcSfx('huwaw'); render();
    });
    $('tc-presetReset').addEventListener('click', function () {
      S.opts = { hq: false, compress: false, optimize: false, patch: false, faststart: false }; S.mult = 0; S.codec = 'auto'; playTcSfx('game'); render();
    });
    $('tc-processBtn').addEventListener('click', runTranscode);
    $('tc-dlBtn').addEventListener('click', function () { download(); playTcSfx('arigatou'); });
    $('tc-newBtn').addEventListener('click', clearFile);
    $('tc-fileClear').addEventListener('click', clearFile);
    var cb = $('ov-cancel'); if (cb) cb.addEventListener('click', function () { if (S.running && S.cancel) S.cancel(); });

    var drop = $('tc-dropzone'), inp = $('tc-videoInput');
    if (drop && inp) {
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('dragover'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('dragover'); }); });
      drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) setFile(f); });
      inp.addEventListener('change', function () { if (inp.files && inp.files[0]) setFile(inp.files[0]); });
    }
    applyOverlayZoom(); window.addEventListener('resize', applyOverlayZoom); window.addEventListener('orientationchange', applyOverlayZoom);
    refreshText(); render();
    document.addEventListener('kuro-lang-changed', function () { refreshText(); render(); });
    switchEncoderMode('kompres');
    window.__kuroTranscode = { setFile: setFile, state: S };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTools); else initTools();
})();
