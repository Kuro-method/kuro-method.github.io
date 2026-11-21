/* Kuro Method Web — TikTok Video Analyzer (V1 + V2)
 * Diadaptasi dari script.js / script-v15.js ekstensi agar jalan di GitHub Pages.
 * Sumber data: tikwm.com API + pembacaan moov atom dari stream video.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  // bridge ke global dari web-shim
  function t(key, vars) {
    if (typeof window.t === 'function' && window.t !== t) return window.t(key, vars);
    // fallback: I18N table
    var lang = window.currentLang || 'id';
    var table = (window.I18N && (window.I18N[lang] || window.I18N.en)) || {};
    var s = table[key] !== undefined ? table[key] : key;
    if (vars) Object.keys(vars).forEach(function (k) { s = String(s).split('{' + k + '}').join(vars[k]); });
    return s;
  }
  Object.defineProperty(window, 'currentLang', {
    get: function () { try { return localStorage.getItem('kuro-lang') || 'id'; } catch (e) { return 'id'; } },
    set: function () {},
    configurable: true
  });
  var currentLang = window.currentLang || 'id';
  document.addEventListener('kuro-lang-changed', function (e) {
    currentLang = (e.detail && e.detail.lang) || window.currentLang || 'id';
  });
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escHtml(v) { return esc(v); }

  // pastikan t() tersedia (dari web-shim)
  function T(key, vars) {
    if (typeof window.t === 'function') return window.t(key, vars);
    return key;
  }

  function playSfxSafe(name) {
    if (typeof window.playSfx === 'function') window.playSfx(name);
  }

  /* ---------- i18n strings (analyzer) ---------- */
  function ensureI18n() {
    if (!window.I18N) window.I18N = { en: {}, id: {} };
    var en = {
      an_note_title: '🔍 TIKTOK VIDEO ANALYZER',
      an_note: 'Analyzer V1 gives a quick summary. Analyzer V2 reads the real TikTok stream (moov atom) and shows HD detection, codec, bitrate, audio, aspect ratio and engagement in a complete card.',
      chk_label: 'Paste TikTok video link:',
      chk_paste: '📋 Paste',
      chk_alert: 'Please enter a TikTok video link first!',
      an_run_v1: 'Analyze Video (V1)',
      an_run_v2: 'Analyze Video (V2 · HD)',
      an_loading: 'Analyzing video…',
      chk_loading: 'Loading…',
      chk_p_api: 'Fetching from TikTok…',
      chk_p_stream: 'Reading video stream…',
      chk_p_parse: 'Parsing moov atom…',
      chk_p_render: 'Building result…',
      chk_p_done: 'Done',
      chk_fail_api: 'Failed to fetch video data from the API.',
      chk_err_box: '❌ Error analyzing video:\n{e}',
      chk_start: 'Analyzing: {u}',
      chk_ok: 'OK — {u}',
      chk_err_log: 'Error: {e}',
      r_na: 'N/A',
      r_views: 'Views', r_likes: 'Likes', r_comments: 'Comments', r_shares: 'Shares', r_saves: 'Saves', r_eng: 'Engagement',
      an2_hd_4k: '4K UPLOAD DETECTED', an2_hd_2k: '2K UPLOAD DETECTED', an2_hd_hd: 'HD UPLOAD DETECTED',
      an2_hd_sd: 'STANDARD UPLOAD DETECTED', an2_hd_na: 'VIDEO STREAM DETECTED',
      an2_hd_sub: 'Real TikTok stream read from the moov atom.',
      an2_uploader_default: '@uploader', an2_footer: 'ANALYZER',
      an2_error: 'Failed to analyze the video:\n{e}',
      an2_audio_default: 'Original sound',
      an2_resolution: 'Resolution', an2_duration: 'Duration', an2_fps: 'Frame rate', an2_size: 'File size',
      an2_codec: 'Codec', an2_bitrate: 'Bitrate', an2_audio: 'Audio', an2_aspect: 'Aspect ratio',
      an2_method: 'Upload method', an2_date: 'Upload date', an2_region: 'Region', an2_shadowban: 'Shadowban check',
      an2_metadata: 'VIDEO METADATA', an2_views: 'Views', an2_likes: 'Likes', an2_comments: 'Comments',
      an2_shares: 'Shares', an2_note: 'Engagement rate: {e}',

      chk_paste_fail: 'Cannot read clipboard. Please paste manually (Ctrl+V).',
      chk_btn: '🔎 Check Video', chk_head: 'TIKTOK VIDEO CHECKER',
      r_active: 'Kuro Method Active', r_undetected: 'Undetected', r_safe: 'Safe',
      r_server: '(Server Region)', r_creator: 'TikTok Creator', r_nocaption: 'No Caption',
      r_locale: 'en-US', r_date: '📅 Upload Date', r_region: '🌐 Region', r_shadow: '🛡️ Shadowban',
      r_res: '📐 Resolution', r_fps: '⚡ Frame Rate (FPS)', r_codec: '🎞️ Codec',
      r_bitrate: '📊 Bitrate', r_dur: '⏱️ Duration', r_size: '📦 File Size', r_method: '🔌 Method',
      cx_015: 'Analyze Video (V1)'
    };
    var id = {
      an_note_title: '🔍 TIKTOK VIDEO ANALYZER',
      an_note: 'Analyzer V1 memberi ringkasan cepat. Analyzer V2 membaca stream asli TikTok (moov atom) dan menampilkan deteksi HD, codec, bitrate, audio, rasio aspek, serta engagement dalam kartu yang lengkap.',
      chk_label: 'Tempel Link Video TikTok:',
      chk_paste: '📋 Tempel',
      chk_alert: 'Harap masukkan link video TikTok terlebih dahulu!',
      an_run_v1: 'Analisa Video (V1)',
      an_run_v2: 'Analisa Video (V2 · HD)',
      an_loading: 'Sedang menganalisa video…',
      chk_loading: 'Memuat…',
      chk_p_api: 'Mengambil data dari TikTok…',
      chk_p_stream: 'Membaca stream video…',
      chk_p_parse: 'Mem-parse moov atom…',
      chk_p_render: 'Menyusun hasil…',
      chk_p_done: 'Selesai',
      chk_fail_api: 'Gagal mengambil data video dari API.',
      chk_err_box: '❌ Gagal menganalisa video:\n{e}',
      chk_start: 'Menganalisa: {u}',
      chk_ok: 'OK — {u}',
      chk_err_log: 'Error: {e}',
      r_na: 'N/A',
      r_views: 'Views', r_likes: 'Suka', r_comments: 'Komentar', r_shares: 'Bagikan', r_saves: 'Simpan', r_eng: 'Engagement',
      an2_hd_4k: 'UPLOAD 4K TERDETEKSI', an2_hd_2k: 'UPLOAD 2K TERDETEKSI', an2_hd_hd: 'UPLOAD HD TERDETEKSI',
      an2_hd_sd: 'UPLOAD STANDAR TERDETEKSI', an2_hd_na: 'STREAM VIDEO TERDETEKSI',
      an2_hd_sub: 'Stream TikTok asli dibaca dari moov atom.',
      an2_uploader_default: '@uploader', an2_footer: 'ANALYZER',
      an2_error: 'Gagal menganalisa video:\n{e}',
      an2_audio_default: 'Suara asli',
      an2_resolution: 'Resolusi', an2_duration: 'Durasi', an2_fps: 'Frame rate', an2_size: 'Ukuran file',
      an2_codec: 'Codec', an2_bitrate: 'Bitrate', an2_audio: 'Audio', an2_aspect: 'Rasio aspek',
      an2_method: 'Metode upload', an2_date: 'Tanggal upload', an2_region: 'Region', an2_shadowban: 'Cek shadowban',
      an2_metadata: 'METADATA VIDEO', an2_views: 'Views', an2_likes: 'Suka', an2_comments: 'Komentar',
      an2_shares: 'Bagikan', an2_note: 'Tingkat engagement: {e}',

      chk_paste_fail: 'Tidak bisa membaca clipboard. Silakan tempel manual (Ctrl+V).',
      chk_btn: '🔎 Cek Video', chk_head: 'TIKTOK VIDEO CHECKER',
      r_active: 'Kuro Method Aktif', r_undetected: 'Tidak Terdeteksi', r_safe: 'Aman',
      r_server: '(Server Region)', r_creator: 'Kreator TikTok', r_nocaption: 'Tanpa Caption',
      r_locale: 'id-ID', r_date: '📅 Tanggal Upload', r_region: '🌐 Region', r_shadow: '🛡️ Shadowban',
      r_res: '📐 Resolusi', r_fps: '⚡ Frame Rate (FPS)', r_codec: '🎞️ Codec',
      r_bitrate: '📊 Bitrate', r_dur: '⏱️ Durasi', r_size: '📦 Ukuran File', r_method: '🔌 Metode',
      cx_015: 'Analisa Video (V1)'
    };
    Object.assign(window.I18N.en, en);
    Object.assign(window.I18N.id, id);
  }

  /* ---------- number helpers ---------- */
  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }

  function kuroLocalizeVideo(d) {
    if (!d) return {};
    var eng = (Number(d.engagement) || 0).toFixed(2) + '%';
    var aspect = 'N/A';
    if (d.width && d.height) {
      var g = function (a, b) { return b === 0 ? a : g(b, a % b); };
      var gg = g(d.width, d.height);
      aspect = (d.width / gg) + ':' + (d.height / gg);
    }
    var dateStr = d.createTime ? new Date(d.createTime * 1000).toLocaleString() : 'N/A';
    return {
      views: fmtNum(d.views), likes: fmtNum(d.likes), comments: fmtNum(d.comments),
      shares: fmtNum(d.shares), downloads: fmtNum(d.downloads),
      engagementStr: eng, aspectStr: aspect, uploadDate: dateStr,
      regionStr: d.regionCode || 'N/A',
      methodStatus: d.methodActive ? 'Kuro Method' : 'Standard',
      shadowbanStatus: '—',
      authorName: d.authorName || '',
      resolutionStr: (d.width && d.height) ? (d.width + '×' + d.height) : 'N/A',
      durationStr: d.durationSec ? (d.durationSec + 's') : 'N/A',
      fpsStr: d.fps ? (Math.round(d.fps * 100) / 100 + ' fps') : 'N/A',
      sizeStr: d.sizeMB ? (d.sizeMB.toFixed(2) + ' MB') : 'N/A',
      codecStr: d.codecStr || 'N/A',
      bitrateStr: d.bitrateMbps ? (d.bitrateMbps.toFixed(2) + ' Mbps') : 'N/A'
    };
  }

  function setChkProgress(pct, label) {
    var bar = $('chk-progress-bar');
    var pctEl = $('chk-progress-pct');
    var lab = $('chk-progress-label');
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
    if (lab && label) lab.textContent = label;
  }

  /* ---------- MP4 stream inspector (moov) ---------- */
function absVideoUrl(u) {
    if (!u) return null;
    if (u.startsWith('//')) return 'https:' + u;
    if (u.startsWith('/')) return 'https://www.tikwm.com' + u;
    return u;
}

async function fetchBytes(url, start, end, capBytes = 80 * 1024 * 1024) {
    const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
    if (res.status === 206) {
        const cr = res.headers.get('content-range') || '';
        const m = cr.match(/\/(\d+)$/);
        return { buf: new Uint8Array(await res.arrayBuffer()), total: m ? Number(m[1]) : 0 };
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    // Server tidak mendukung Range -> baca stream sampai batas yang dibutuhkan
    const total = Number(res.headers.get('content-length')) || 0;
    const need = Math.min(end + 1, capBytes);
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    while (got < need) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
    }
    try { reader.cancel(); } catch (e) {}
    const all = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { all.set(c, o); o += c.length; }
    return { buf: all.slice(start, Math.min(end + 1, got)), total };
}

async function loadMoovBox(url) {
    const HEAD = 1024 * 1024;
    const first = await fetchBytes(url, 0, HEAD - 1);
    const total = first.total || first.buf.length;
    const readAt = async (pos, len) => {
        if (pos + len <= first.buf.length) return first.buf.subarray(pos, pos + len);
        return (await fetchBytes(url, pos, pos + len - 1)).buf;
    };
    let pos = 0;
    for (let i = 0; i < 40 && pos + 8 <= total; i++) {
        const hdr = await readAt(pos, 16);
        if (hdr.length < 8) break;
        const dv = new DataView(hdr.buffer, hdr.byteOffset, hdr.byteLength);
        let size = dv.getUint32(0);
        const type = String.fromCharCode(hdr[4], hdr[5], hdr[6], hdr[7]);
        if (size === 1 && hdr.length >= 16) size = Number(dv.getBigUint64(8));
        else if (size === 0) size = total - pos;
        if (size < 8) break;
        if (type === 'moov') return await readAt(pos, size);
        pos += size;
    }
    throw new Error('moov tidak ditemukan');
}

function mp4Children(buf, start, end) {
    const out = [];
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let pos = start;
    while (pos + 8 <= end) {
        let size = dv.getUint32(pos);
        const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
        let hdr = 8;
        if (size === 1) { size = Number(dv.getBigUint64(pos + 8)); hdr = 16; }
        else if (size === 0) size = end - pos;
        if (size < hdr || pos + size > end) break;
        out.push({ type, start: pos + hdr, end: pos + size });
        pos += size;
    }
    return out;
}

function mp4Find(buf, parent, type) {
    return mp4Children(buf, parent.start, parent.end).find(b => b.type === type) || null;
}

function parseMoovVideo(moov) {
    const dv = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
    const root = { start: 8, end: moov.length };
    for (const trak of mp4Children(moov, root.start, root.end).filter(b => b.type === 'trak')) {
        const mdia = mp4Find(moov, trak, 'mdia');
        if (!mdia) continue;
        const hdlr = mp4Find(moov, mdia, 'hdlr');
        if (!hdlr) continue;
        const handler = String.fromCharCode(moov[hdlr.start + 8], moov[hdlr.start + 9], moov[hdlr.start + 10], moov[hdlr.start + 11]);
        if (handler !== 'vide') continue;

        const info = { width: 0, height: 0, fps: 0, durationSec: 0, videoBytes: 0, codecRaw: '', codec: '', profile: '' };

        // durasi track
        const mdhd = mp4Find(moov, mdia, 'mdhd');
        let timescale = 0, mdDur = 0;
        if (mdhd) {
            const v = moov[mdhd.start];
            if (v === 1) { timescale = dv.getUint32(mdhd.start + 20); mdDur = Number(dv.getBigUint64(mdhd.start + 24)); }
            else { timescale = dv.getUint32(mdhd.start + 12); mdDur = dv.getUint32(mdhd.start + 16); }
            if (timescale) info.durationSec = mdDur / timescale;
        }

        // rotasi dari tkhd (portrait yang disimpan rotated)
        let rotated = false;
        const tkhd = mp4Find(moov, trak, 'tkhd');
        if (tkhd) {
            const mo = moov[tkhd.start] === 1 ? 52 : 40;
            const a = dv.getInt32(tkhd.start + mo);
            const b = dv.getInt32(tkhd.start + mo + 4);
            rotated = (a === 0 && b !== 0);
        }

        const minf = mp4Find(moov, mdia, 'minf');
        const stbl = minf && mp4Find(moov, minf, 'stbl');
        if (!stbl) continue;

        // codec + ukuran frame
        const stsd = mp4Find(moov, stbl, 'stsd');
        if (stsd) {
            const eStart = stsd.start + 8;
            const eType = String.fromCharCode(moov[eStart + 4], moov[eStart + 5], moov[eStart + 6], moov[eStart + 7]);
            info.codecRaw = eType;
            info.width = dv.getUint16(eStart + 32);
            info.height = dv.getUint16(eStart + 34);
            const eEnd = Math.min(eStart + dv.getUint32(eStart), stsd.end);
            const kids = mp4Children(moov, eStart + 86, eEnd);
            const hex = (n) => n.toString(16).padStart(2, '0');
            if (/^(avc1|avc3)$/.test(eType)) {
                const c = kids.find(k => k.type === 'avcC');
                let prof = '', lvl = '';
                if (c) {
                    const pi = moov[c.start + 1], lv = moov[c.start + 3];
                    const names = { 66: 'Baseline', 77: 'Main', 88: 'Extended', 100: 'High', 110: 'High 10', 122: 'High 4:2:2', 244: 'High 4:4:4' };
                    prof = names[pi] || ('profile ' + pi);
                    lvl = 'L' + (lv / 10).toFixed(1);
                    info.codecRaw = `avc1.${hex(pi)}${hex(moov[c.start + 2])}${hex(lv)}`;
                }
                info.codec = 'H.264 / AVC';
                info.profile = [prof, lvl].filter(Boolean).join(', ');
            } else if (/^(hvc1|hev1)$/.test(eType)) {
                const c = kids.find(k => k.type === 'hvcC');
                let prof = '', lvl = '';
                if (c) {
                    const pi = moov[c.start + 1] & 0x1f;
                    const tier = (moov[c.start + 1] & 0x20) ? 'High tier' : 'Main tier';
                    const lv = moov[c.start + 12];
                    const names = { 1: 'Main', 2: 'Main 10', 3: 'Main Still Picture', 4: 'RExt' };
                    prof = names[pi] || ('profile ' + pi);
                    lvl = 'L' + (lv / 30).toFixed(1);
                    info.profile = [prof, tier, lvl].join(', ');
                }
                info.codec = 'H.265 / HEVC';
            } else if (eType === 'av01') {
                info.codec = 'AV1';
            } else if (/^vp0?9$/.test(eType)) {
                info.codec = 'VP9';
            } else if (eType === 'mp4v') {
                info.codec = 'MPEG-4 Visual';
            } else {
                info.codec = eType;
            }
        }

        // jumlah sample (frame) -> FPS
        const stts = mp4Find(moov, stbl, 'stts');
        let frames = 0;
        if (stts) {
            const n = dv.getUint32(stts.start + 4);
            for (let i = 0; i < n; i++) frames += dv.getUint32(stts.start + 8 + i * 8);
        }
        if (frames > 0 && info.durationSec > 0) info.fps = frames / info.durationSec;

        // total byte stream video -> bitrate
        const stsz = mp4Find(moov, stbl, 'stsz');
        if (stsz) {
            const fixed = dv.getUint32(stsz.start + 4);
            const cnt = dv.getUint32(stsz.start + 8);
            if (fixed) info.videoBytes = fixed * cnt;
            else for (let i = 0; i < cnt; i++) info.videoBytes += dv.getUint32(stsz.start + 12 + i * 4);
        }

        if (rotated) { const t = info.width; info.width = info.height; info.height = t; }
        return info;
    }
    return null;
}

async function inspectMp4Stream(urls, onProgress) {
    for (const raw of urls) {
        const url = absVideoUrl(raw);
        if (!url) continue;
        try {
            if (onProgress) onProgress(1);
            const moov = await loadMoovBox(url);
            if (onProgress) onProgress(2);
            const info = parseMoovVideo(moov);
            if (info && info.width > 0) return info;
        } catch (e) {
            console.warn('[Kuro Checker] inspect gagal:', url, e);
        }
    }
    return null;
}

// Baca resolusi asli video lewat elemen <video> (hanya metadata, tidak download penuh)
function probeVideoResolution(urls, timeoutMs = 12000) {
    const tryOne = (src) => new Promise((resolve) => {
        if (!src) return resolve(null);
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;
        let done = false;
        const finish = (val) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            v.removeAttribute('src');
            try { v.load(); } catch (e) {}
            resolve(val);
        };
        const timer = setTimeout(() => finish(null), timeoutMs);
        v.onloadedmetadata = () => {
            finish(v.videoWidth > 0 && v.videoHeight > 0
                ? { width: v.videoWidth, height: v.videoHeight } : null);
        };
        v.onerror = () => finish(null);
        v.src = src;
    });
    return (async () => {
        for (const u of urls) {
            const r = await tryOne(absVideoUrl(u));
            if (r) return r;
        }
        return null;
    })();
}

function formatAspectRatio(w, h) {
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const g = gcd(w, h);
    const rw = w / g, rh = h / g;
    if (rw <= 32 && rh <= 32) return `${rw}:${rh}`;
    // rasio tidak "bersih" (mis. 962x720) -> cocokkan ke rasio umum terdekat
    const common = [[1,1],[4,3],[3,4],[3,2],[2,3],[16,9],[9,16],[5,4],[4,5],[21,9],[9,21]];
    const r = w / h;
    let best = common[0], diff = Infinity;
    for (const c of common) {
        const d = Math.abs(r - c[0] / c[1]);
        if (d < diff) { diff = d; best = c; }
    }
    return `~${best[0]}:${best[1]}`;
}

function setChkProgress(pct, label) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    const bar = document.getElementById('chk-progress-bar');
    const pc = document.getElementById('chk-progress-pct');
    const lb = document.getElementById('chk-progress-label');
    if (bar) bar.style.width = pct + '%';
    if (pc) pc.textContent = pct + '%';
    if (lb && label) lb.textContent = label;
}

// 30.1 detik / 1 menit 15 detik / 1 jam 2 menit 5 detik
function formatDuration(sec) {
    sec = Number(sec) || 0;
    const id = currentLang === 'id';
    const U = id ? { h: ['jam', 'jam'], m: ['menit', 'menit'], s: ['detik', 'detik'] }
                 : { h: ['hour', 'hours'], m: ['minute', 'minutes'], s: ['second', 'seconds'] };
    const unit = (n, u) => `${n} ${n === 1 ? u[0] : u[1]}`;
    if (Math.round(sec * 10) / 10 < 60) return `${Math.round(sec * 10) / 10} ${(Math.round(sec * 10) / 10) === 1 ? U.s[0] : U.s[1]}`;
    const total = Math.round(sec);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), r = total % 60;
    const parts = [];
    if (h) parts.push(unit(h, U.h));
    if (m) parts.push(unit(m, U.m));
    if (r) parts.push(unit(r, U.s));
    return parts.join(' ');
}

async function pasteTikTokUrl() {
    const input = document.getElementById('tiktok-url-input');
    try {
        const text = (await navigator.clipboard.readText() || '').trim();
        if (!text) throw new Error('empty');
        if (input) { input.value = text; input.focus(); }
    } catch (e) {
        if (input) input.focus();
        alert(t('chk_paste_fail'));
    }
}

// ============================================================================
// REAL TIKTOK VIDEO CHECKER (V1 + V2)
// Data mentah disimpan TANPA bahasa (angka, kode, boolean). Semua teks hasil
// dibuat saat ditampilkan (kuroLocalizeVideo) sehingga V1 dan V2 selalu
// mengikuti bahasa yang dipilih pengguna, juga saat bahasa diganti setelah
// hasilnya muncul.
// ============================================================================
function escHtml(v) {
    return String(v === undefined || v === null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function kuroRegionName(code) {
    code = String(code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return `${code || '??'} ${t("r_server")}`;
    try {
        if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
            const name = new Intl.DisplayNames([currentLang === 'id' ? 'id' : 'en'], { type: 'region' }).of(code);
            if (name && name !== code) return name;
        }
    } catch (e) { /* fallback below */ }
    return `${code} ${t("r_server")}`;
}

function kuroLocalizeVideo(d) {
    const loc = t('r_locale');
    const na = t('r_na');
    const num = (n) => (Number(n) || 0).toLocaleString(loc);
    let uploadDate = na;
    if (d.createTime > 0) {
        try {
            uploadDate = new Date(d.createTime * 1000).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (e) { uploadDate = na; }
    }
    const hasRes = d.width > 0 && d.height > 0;
    return {
        uploadDate,
        regionStr: kuroRegionName(d.regionCode),
        shadowbanStatus: t("r_safe"),
        methodStatus: d.methodActive ? t("r_active") : t("r_undetected"),
        resolutionStr: hasRes ? `${d.width} x ${d.height} (${formatAspectRatio(d.width, d.height)})` : na,
        aspectStr: hasRes ? formatAspectRatio(d.width, d.height) : na,
        fpsStr: d.fps > 0 ? `${Math.round(d.fps * 100) / 100} fps` : na,
        codecStr: d.codecStr || na,
        bitrateStr: d.bitrateMbps > 0 ? `${d.bitrateMbps.toFixed(2)} Mbps` : na,
        durationStr: d.durationSec > 0 ? formatDuration(d.durationSec) : na,
        sizeStr: `${d.sizeMB.toFixed(2)} MB`,
        views: num(d.views), likes: num(d.likes), comments: num(d.comments),
        shares: num(d.shares), downloads: num(d.downloads),
        engagementStr: d.engagement.toFixed(2) + '%',
        authorName: d.authorName || t("r_creator"),
        captionText: d.captionText || t("r_nocaption")
    };
}


function renderAnalyzerV1() {
    const resultBox = document.getElementById('video-info-result');
    if (!resultBox) return;
    const d = window.__kuroLastVideo;
    if (!d) return;
    const L = kuroLocalizeVideo(d);
    const row = (label, value, extra) =>
        `<div style="display:flex; justify-content:space-between; gap:10px; font-size:0.76rem; margin-bottom:6px;">
            <span style="color:#a0aec0; flex-shrink:0;">${label}</span>
            <span style="font-weight:600; text-align:right; ${extra || ''}">${value}</span>
        </div>`;
    resultBox.style.display = 'block';
    resultBox.style.fontFamily = "'Poppins', sans-serif";
    resultBox.style.whiteSpace = "normal";
    resultBox.innerHTML = `
        <div style="background:#09140e; border:1px solid #00ffaa; border-radius:12px; padding:14px; color:#fff; box-shadow:0 0 15px rgba(0,255,170,0.15);">
            <div style="display:flex; gap:12px; align-items:center; margin-bottom:14px; background:rgba(0,255,170,0.06); padding:10px; border-radius:10px; border:1px solid rgba(0,255,170,0.2);">
                ${d.cover ? `<img src="${escHtml(d.cover)}" alt="" referrerpolicy="no-referrer" style="width:54px; height:54px; border-radius:8px; object-fit:cover; border:1px solid #00ffaa; flex-shrink:0;">` : ''}
                <div style="overflow:hidden;">
                    <div style="font-weight:bold; color:#00ffaa; font-size:0.88rem;">${escHtml(L.authorName)}</div>
                    <div style="font-size:0.74rem; color:#a0aec0;">${escHtml(d.authorHandle)}</div>
                    <div style="font-size:0.72rem; color:#e2e8f0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:3px; line-height:1.3;">${escHtml(L.captionText)}</div>
                </div>
            </div>
            ${row(t("r_date"), escHtml(L.uploadDate))}
            ${row(t("r_region"), escHtml(L.regionStr))}
            ${row(t("r_shadow"), '✔ ' + escHtml(L.shadowbanStatus), 'color:#00ffaa; font-weight:bold;')}
            <hr style="border:0; border-top:1px solid rgba(0,255,170,0.25); margin:10px 0;">
            ${row(t("r_res"), escHtml(L.resolutionStr))}
            ${row(t("r_fps"), escHtml(L.fpsStr))}
            ${row(t("r_codec"), escHtml(L.codecStr))}
            ${row(t("r_bitrate"), escHtml(L.bitrateStr))}
            ${row(t("r_dur"), escHtml(L.durationStr))}
            ${row(t("r_size"), escHtml(L.sizeStr))}
            ${row(t("r_method"), escHtml(L.methodStatus), 'color:' + (d.methodActive ? '#00ffaa' : '#e2e8f0') + ';')}
            <hr style="border:0; border-top:1px solid rgba(0,255,170,0.25); margin:10px 0;">
            ${row(t("r_views"), escHtml(L.views), 'font-weight:bold; color:#00ffaa;')}
            ${row(t("r_likes"), escHtml(L.likes))}
            ${row(t("r_comments"), escHtml(L.comments))}
            ${row(t("r_shares"), escHtml(L.shares))}
            ${row(t("r_saves"), escHtml(L.downloads))}
            ${row(t("r_eng"), escHtml(L.engagementStr), 'font-weight:bold; color:#00ffaa;')}
        </div>`;
}

function renderAnalyzerError() {
    const resultBox = document.getElementById('video-info-result');
    const err = window.__kuroLastVideoError;
    if (!resultBox || !err) return;
    resultBox.style.display = 'block';
    resultBox.style.whiteSpace = "pre-wrap";
    resultBox.style.fontFamily = "monospace";
    resultBox.textContent = t("chk_err_box", { e: err.key ? t(err.key) : (err.message || String(err)) });
}


async function kuroFetchTikwm(cleanUrl) {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`;
    let lastMsg = '';
    // tikwm membatasi 1 request/detik; coba ulang sekali bila terkena limit.
    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const resData = await response.json();
        if (resData && resData.code === 0 && resData.data) return resData.data;
        lastMsg = (resData && resData.msg) || '';
        if (!/limit|second/i.test(lastMsg)) break;
        await new Promise((r) => setTimeout(r, 1300));
    }
    const e = new Error(t("chk_fail_api"));
    e.key = 'chk_fail_api';
    e.detail = lastMsg;
    throw e;
}


async function inspectTikTokVideoUrl() {
    const urlInput = document.getElementById('tiktok-url-input');
    const resultBox = document.getElementById('video-info-result');
    const url = urlInput ? urlInput.value.trim() : '';

    if (!url) {
        alert(t("chk_alert"));
        return;
    }

    window.__kuroLastVideo = null;
    window.__kuroLastVideoError = null;
    document.dispatchEvent(new CustomEvent("kuro-video-start"));

    /*log*/(function(){})(t("chk_start", { u: url }));
    if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.whiteSpace = "normal";
        resultBox.innerHTML = `
            <div style="padding:10px 4px; font-family:sans-serif; color:#00ffaa;">
                <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:6px;">
                    <span id="chk-progress-label">${t("chk_loading")}</span>
                    <span id="chk-progress-pct" style="font-weight:bold;">0%</span>
                </div>
                <div style="width:100%; height:10px; background:rgba(0,255,170,0.15); border-radius:6px; overflow:hidden;">
                    <div id="chk-progress-bar" style="width:0%; height:100%; background:linear-gradient(90deg,#00b377,#00ffaa); transition:width .25s ease;"></div>
                </div>
            </div>`;
    }
    setChkProgress(2, t("chk_p_api"));

    try {
        const cleanUrl = url.split('?')[0];
        const data = await kuroFetchTikwm(cleanUrl);
        setChkProgress(30, t("chk_p_stream"));

        const author = data.author || {};
        const streamUrls = [data.hdplay, data.play].filter(Boolean);
        let mp4 = null;
        try {
            mp4 = await inspectMp4Stream(streamUrls, (st) => {
                if (st === 1) setChkProgress(45, t("chk_p_stream"));
                else setChkProgress(75, t("chk_p_parse"));
            });
        } catch (e) { mp4 = null; }
        setChkProgress(88, t("chk_p_render"));

        let resWidth = mp4 ? mp4.width : (Number(data.width) || 0);
        let resHeight = mp4 ? mp4.height : (Number(data.height) || 0);
        if (!(resWidth > 0 && resHeight > 0)) {
            try {
                const probed = await probeVideoResolution(streamUrls);
                if (probed) { resWidth = probed.width; resHeight = probed.height; }
            } catch (e) { /* biarkan N/A */ }
        }

        const codecStr = mp4 && mp4.codec
            ? `${mp4.codec}${mp4.profile ? ' (' + mp4.profile + ')' : ''}${mp4.codecRaw ? ' · ' + mp4.codecRaw : ''}`
            : '';
        const durationSec = (mp4 && mp4.durationSec > 0) ? Math.round(mp4.durationSec * 10) / 10 : (Number(data.duration) || 0);
        const sizeBytes = Number(data.size) || 0;

        let bitrateMbps = 0;
        if (mp4 && mp4.videoBytes > 0 && mp4.durationSec > 0) {
            bitrateMbps = (mp4.videoBytes * 8) / mp4.durationSec / 1000000;
        } else if (durationSec > 0 && sizeBytes > 0) {
            bitrateMbps = (sizeBytes * 8) / (durationSec * 1000000);
        }

        const plays = Number(data.play_count) || 0;
        const likes = Number(data.digg_count) || 0;
        const comments = Number(data.comment_count) || 0;
        const shares = Number(data.share_count) || 0;
        const engagement = plays > 0 ? ((likes + comments + shares) / plays) * 100 : 0;

        window.__kuroLastVideo = {
            authorName: author.nickname || '',
            authorHandle: '@' + (author.unique_id || 'uploader'),
            authorAvatar: author.avatar || '',
            captionText: data.title || '',
            createTime: Number(data.create_time) || 0,
            regionCode: (data.region || '').toUpperCase(),
            width: resWidth, height: resHeight,
            fps: (mp4 && mp4.fps > 0) ? mp4.fps : 0,
            codecStr, durationSec, sizeMB: sizeBytes / (1024 * 1024), bitrateMbps,
            methodActive: String(data.title || '').includes('@malzzxsinon24'),
            views: plays, likes, comments, shares,
            downloads: Number(data.download_count) || 0,
            engagement,
            cover: data.cover || data.origin_cover || author.avatar || '',
            play: data.play,
            raw: data
        };

        setChkProgress(100, t("chk_p_done"));
        await new Promise((r) => setTimeout(r, 250));

        renderAnalyzerV1();
        /*log*/(function(){})(t("chk_ok", { u: window.__kuroLastVideo.authorHandle }));
        document.dispatchEvent(new CustomEvent("kuro-video-data", { detail: window.__kuroLastVideo }));
    } catch (err) {
        window.__kuroLastVideoError = err;
        /*log*/(function(){})(t("chk_err_log", { e: (err && err.message) || err }));
        renderAnalyzerError();
        document.dispatchEvent(new CustomEvent("kuro-video-error", { detail: err }));
    }
}


  /* ---------- Analyzer V2 UI ---------- */
function hdLabel(d) {
        const w = Number(d.width) || 0;
        const h = Number(d.height) || 0;
        // Use the SHORT edge so portrait 1080x1920 is correctly rated 1080p (HD), not 2K.
        const short = (w && h) ? Math.min(w, h) : (h || w || 0);
        if (short >= 2160) return { title: t('an2_hd_4k'), quality: '2160p · 4K' };
        if (short >= 1440) return { title: t('an2_hd_2k'), quality: '1440p · 2K' };
        if (short >= 1080) return { title: t('an2_hd_hd'), quality: '1080p · HD' };
        if (short >= 720) return { title: t('an2_hd_hd'), quality: '720p · HD' };
        if (short > 0) return { title: t('an2_hd_sd'), quality: short + 'p · SD' };
        return { title: t('an2_hd_na'), quality: t('r_na') };
    }

    function renderAnalyzerV2() {
        const box = $('analyzer-v2-result');
        if (!box) return;
        if (an2State === 'loading') {
            box.innerHTML = '<div class="status-box" style="border-left-color:#00ffaa;color:#00ffaa;">' + esc(t('an_loading')) + '</div>';
            return;
        }
        if (an2State === 'error') {
            const err = window.__kuroLastVideoError;
            const msg = err ? (err.key ? t(err.key) : (err.message || String(err))) : '';
            box.innerHTML = '<div class="status-box" style="border-left-color:#ff0055;color:#ff8aa8;white-space:pre-wrap;">❌ ' +
                esc(t('an2_error', { e: msg })) + '</div>';
            return;
        }
        const d = window.__kuroLastVideo;
        if (an2State !== 'data' || !d) { box.innerHTML = ''; return; }

        const L = (typeof kuroLocalizeVideo === 'function') ? kuroLocalizeVideo(d) : {};
        const hd = hdLabel(d);
        const music = d.raw && d.raw.music_info;
        const audio = (music && music.title)
            ? (music.title + ' — ' + (music.author || 'TikTok'))
            : t('an2_audio_default');
        const cells = [
            [t('an2_resolution'), L.resolutionStr],
            [t('an2_duration'), L.durationStr],
            [t('an2_fps'), L.fpsStr],
            [t('an2_size'), L.sizeStr],
            [t('an2_codec'), L.codecStr],
            [t('an2_bitrate'), L.bitrateStr],
            [t('an2_audio'), audio],
            [t('an2_aspect'), L.aspectStr],
            [t('an2_method'), L.methodStatus],
            [t('an2_date'), L.uploadDate],
            [t('an2_region'), L.regionStr],
            [t('an2_shadowban'), L.shadowbanStatus]
        ];
        const avatar = d.authorAvatar || 'icons/icon48.png';
        box.innerHTML =
            '<div class="analyzer-v2-card">' +
                '<div class="an2-hd-banner">' +
                    '<div class="an2-hd-icon">⚡</div>' +
                    '<div><div class="an2-hd-title">' + esc(hd.title) + '</div>' +
                    '<div class="an2-hd-sub">' + esc(t('an2_hd_sub')) + '</div></div>' +
                '</div>' +
                '<div class="an2-uploader">' +
                    '<img src="' + esc(avatar) + '" alt="" referrerpolicy="no-referrer">' +
                    '<div><div class="an2-handle">' + esc(d.authorHandle || t('an2_uploader_default')) + '</div>' +
                    '<div class="an2-date">' + esc(L.authorName || '') + '</div></div>' +
                '</div>' +
                (d.cover ? '<img class="an2-cover" src="' + esc(d.cover) + '" alt="cover" referrerpolicy="no-referrer">' : '') +
                '<div class="an2-section">' +
                    '<div class="an2-section-title">' + esc(t('an2_metadata')) + '</div>' +
                    '<div class="an2-meta-grid">' +
                        cells.map((c) => '<div class="an2-meta-cell"><span>' + esc(c[0]) + '</span><b>' + esc(c[1]) + '</b></div>').join('') +
                    '</div>' +
                '</div>' +
                '<div class="an2-stats-row">' +
                    '<div class="an2-stat"><b>' + esc(L.views) + '</b><span>' + esc(t('an2_views')) + '</span></div>' +
                    '<div class="an2-stat"><b>' + esc(L.likes) + '</b><span>' + esc(t('an2_likes')) + '</span></div>' +
                    '<div class="an2-stat"><b>' + esc(L.comments) + '</b><span>' + esc(t('an2_comments')) + '</span></div>' +
                    '<div class="an2-stat"><b>' + esc(L.shares) + '</b><span>' + esc(t('an2_shares')) + '</span></div>' +
                '</div>' +
                '<div class="an2-footer"><span>' + esc(t('an2_footer')) + '</span><span class="an2-quality-pill">' + esc(hd.quality) + '</span></div>' +
                '<div class="an2-note">' + esc(t('an2_note', { e: L.engagementStr })) + '</div>' +
            '</div>';
    }

    function runAnalyzer() {
        const url = ($('tiktok-url-input') && $('tiktok-url-input').value || '').trim();
        if (!url) {
            alert(t('chk_alert'));
            return;
        }
        playSfxSafe('check');
        if (typeof inspectTikTokVideoUrl === 'function') inspectTikTokVideoUrl();
    }

    

  /* ---------- mode + events ---------- */
  var analyzerMode = 'v1';
  var an2State = null;

  function setAnalyzerMode(mode) {
    analyzerMode = mode === 'v2' ? 'v2' : 'v1';
    var b1 = $('btn-analyze-v1'), b2 = $('btn-analyze-v2');
    var w1 = $('analyzer-v1-wrap'), w2 = $('analyzer-v2-wrap');
    if (b1) b1.classList.toggle('active', analyzerMode === 'v1');
    if (b2) b2.classList.toggle('active', analyzerMode === 'v2');
    if (w1) w1.classList.toggle('hidden', analyzerMode !== 'v1');
    if (w2) w2.classList.toggle('hidden', analyzerMode !== 'v2');
    updateRunLabel();
    if (analyzerMode === 'v2') renderAnalyzerV2();
    else if (window.__kuroLastVideo) renderAnalyzerV1();
  }

  function updateRunLabel() {
    var lbl = $('analyze-run-label');
    if (lbl) lbl.textContent = analyzerMode === 'v2' ? T('an_run_v2') : T('an_run_v1');
  }

  function runAnalyzer() {
    var url = ($('tiktok-url-input') && $('tiktok-url-input').value || '').trim();
    if (!url) { alert(T('chk_alert')); return; }
    playSfxSafe('check');
    if (analyzerMode === 'v2') {
      an2State = 'loading';
      renderAnalyzerV2();
    }
    inspectTikTokVideoUrl().then(function () {
      if (analyzerMode === 'v2') {
        an2State = window.__kuroLastVideo ? 'data' : (window.__kuroLastVideoError ? 'error' : null);
        renderAnalyzerV2();
      }
    }).catch(function () {
      if (analyzerMode === 'v2') { an2State = 'error'; renderAnalyzerV2(); }
    });
  }

  // hook events after inspect finishes
  document.addEventListener('kuro-video-data', function () {
    if (analyzerMode === 'v2') { an2State = 'data'; renderAnalyzerV2(); }
    playSfxSafe('success');
  });
  document.addEventListener('kuro-video-error', function () {
    if (analyzerMode === 'v2') { an2State = 'error'; renderAnalyzerV2(); }
    playSfxSafe('error');
  });
  document.addEventListener('kuro-lang-changed', function () {
    if (typeof applyLanguage === 'function') { /* already applied */ }
    updateRunLabel();
    if (window.__kuroLastVideo) {
      if (analyzerMode === 'v1') renderAnalyzerV1();
      else { an2State = 'data'; renderAnalyzerV2(); }
    } else if (window.__kuroLastVideoError) {
      if (analyzerMode === 'v1') renderAnalyzerError();
      else { an2State = 'error'; renderAnalyzerV2(); }
    }
    // note text
    var note = document.querySelector('[data-i18n="an_note"]');
    if (note) note.innerHTML = T('an_note');
    var title = document.querySelector('[data-i18n="an_note_title"]');
    if (title) title.textContent = T('an_note_title');
  });

  function initAnalyzer() {
    ensureI18n();
    if (typeof applyLanguage === 'function') applyLanguage();

    var a1 = $('btn-analyze-v1'); if (a1) a1.addEventListener('click', function () { setAnalyzerMode('v1'); });
    var a2 = $('btn-analyze-v2'); if (a2) a2.addEventListener('click', function () { setAnalyzerMode('v2'); });
    var run = $('btn-analyze-run'); if (run) run.addEventListener('click', runAnalyzer);
    var paste = $('btn-paste-url');
    if (paste) paste.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (txt) {
          var inp = $('tiktok-url-input');
          if (inp && txt) { inp.value = txt.trim(); playSfxSafe('check'); }
        }).catch(function () { alert('Tidak bisa membaca clipboard. Tempel manual (Ctrl+V).'); });
      } else {
        alert('Clipboard tidak tersedia. Tempel manual (Ctrl+V).');
      }
    });
    setAnalyzerMode('v1');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAnalyzer);
  else initAnalyzer();
})();
