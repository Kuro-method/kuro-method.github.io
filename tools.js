/* Kuro Method Web — Kuro Transcode
 * Mode: HQ Upscale, 2x FPS, Patcher, FastStart, Kompres+FastStart, All-In-One
 * SFX: start=link start | done=MATTA | error=Ara Ara | UI=game sette | HQ=huwaw | dl=arigatou | welcome=konnichiwa
 */
(function () {
  'use strict';

  var activeBlobUrl = null;
  var activeFilename = '';
  var currentVideoFps = 30;

  function log(msg) {
    var logBox = document.getElementById('tc-logBox');
    if (!logBox) return;
    var line = document.createElement('div');
    line.innerHTML = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function playTcSfx(name) {
    var map = {
      start: 'assets/link start-Sinon.mp3',
      done: 'assets/MATTA_MATTA_SUOU_YUKI.mp3',
      error: 'assets/Ara_Ara_Anime_Ara_Ara_Kurumi_Message.mp3',
      konnichiwa: 'assets/konnichiwa-Sinon.mp3',
      huwaw: 'assets/huwaw-Sinon.mp3',
      game: 'assets/game sette ne-Sinon.mp3',
      arigatou: 'assets/arigatou-sinon.mp3'
    };
    try {
      if (!map[name]) return;
      var a = new Audio(encodeURI(map[name]));
      a.volume = 1;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function fileToUint8(file) {
    return file.arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  var ownFFmpeg = null;

  async function getFFmpegInstance() {
    if (typeof window.__kuroGetFFmpeg === 'function') {
      try {
        var shared = await window.__kuroGetFFmpeg();
        if (shared && shared.loaded) {
          log('Menggunakan FFmpeg instance bersama (compress).');
          return shared;
        }
      } catch (e) {
        log('Shared FFmpeg belum siap, load sendiri...');
      }
    }
    if (ownFFmpeg && ownFFmpeg.loaded) return ownFFmpeg;
    if (typeof FFmpegWASM === 'undefined' || !FFmpegWASM.FFmpeg) {
      throw new Error('FFmpegWASM belum termuat. Pastikan encoder/ffmpeg/ffmpeg.js sudah diload.');
    }
    log('Loading FFmpeg WASM Engine (Transcode)...');
    var inst = new FFmpegWASM.FFmpeg();
    inst.on('progress', function (p) {
      if (!p) return;
      var ratio = typeof p.progress === 'number' ? p.progress : 0;
      var pct = Math.max(0, Math.min(99, Math.round(ratio * 100)));
      updateOverlayProgress(pct);
    });
    await inst.load();
    ownFFmpeg = inst;
    log('FFmpeg WASM siap.');
    return inst;
  }

  function getScaleFilter(targetRes) {
    if (targetRes === '720') return 'scale=-2:720:flags=lanczos';
    if (targetRes === '1080') return 'scale=-2:1080:flags=lanczos';
    if (targetRes === '1440') return 'scale=-2:1440:flags=lanczos';
    if (targetRes === '2160') return 'scale=-2:2160:flags=lanczos';
    if (targetRes === '4320') return 'scale=-2:4320:flags=lanczos';
    return null;
  }

  function showOverlay(title) {
    var ov = document.getElementById('tc-progressOverlay');
    var st = document.getElementById('tc-overlayStatus');
    var bar = document.getElementById('tc-progressBar');
    var pct = document.getElementById('tc-progressPercent');
    var dl = document.getElementById('tc-dlBtn');
    if (st) st.textContent = title;
    if (bar) bar.style.width = '0%';
    if (pct) pct.textContent = '0%';
    if (dl) dl.classList.add('hidden');
    if (ov) ov.classList.remove('hidden');
    var bg = document.getElementById('tc-overlayBgVideo');
    if (bg) bg.play().catch(function () {});
  }

  function updateOverlayProgress(percent) {
    var bar = document.getElementById('tc-progressBar');
    var pct = document.getElementById('tc-progressPercent');
    if (bar) bar.style.width = percent + '%';
    if (pct) pct.textContent = percent + '%';
  }

  function hideOverlay() {
    var ov = document.getElementById('tc-progressOverlay');
    if (ov) ov.classList.add('hidden');
  }

  function prepareDownload(outData, filename) {
    updateOverlayProgress(100);
    log('Proses Encoding Selesai!');
    var blob = new Blob([outData.buffer || outData], { type: 'video/mp4' });
    if (activeBlobUrl) {
      try { URL.revokeObjectURL(activeBlobUrl); } catch (e) {}
    }
    activeBlobUrl = URL.createObjectURL(blob);
    activeFilename = filename;
    playTcSfx('done');
    var st = document.getElementById('tc-overlayStatus');
    if (st) st.textContent = 'PROSES SELESAI!';
    var dl = document.getElementById('tc-dlBtn');
    if (dl) dl.classList.remove('hidden');
  }

  function clearTranscodeInput() {
    /* Bebaskan input + referensi file di memori browser */
    try {
      var inp = document.getElementById('tc-videoInput');
      if (inp) inp.value = '';
    } catch (e) {}
    activeFilename = '';
    currentVideoFps = 30;
  }

  function triggerDownload() {
    if (!activeBlobUrl) return;
    var a = document.createElement('a');
    a.href = activeBlobUrl;
    a.download = activeFilename || 'kuro_transcode.mp4';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      a.remove();
      try { URL.revokeObjectURL(activeBlobUrl); } catch (e) {}
      activeBlobUrl = null;
    }, 1500);
    hideOverlay();
    log('File berhasil diunduh: ' + activeFilename);
    playTcSfx('arigatou');
    /* auto-hapus file input + lepas memori (aman untuk GitHub Pages / Cloudflare) */
    clearTranscodeInput();
    try {
      if (window.__kuroResetFFmpeg) window.__kuroResetFFmpeg();
    } catch (e) {}
    log('Penyimpanan lokal dibersihkan. Siap pilih video baru.');
  }

  async function runTranscode() {
    var fileInput = document.getElementById('tc-videoInput');
    var modeSel = document.getElementById('tc-modeSelect');
    var resSel = document.getElementById('tc-resolutionTarget');
    var btn = document.getElementById('tc-processBtn');
    if (!fileInput || !modeSel) return;

    if (!fileInput.files || !fileInput.files.length) {
      alert('Pilih file video terlebih dahulu!');
      playTcSfx('error');
      return;
    }

    var file = fileInput.files[0];
    var mode = modeSel.value;
    var targetRes = resSel ? resSel.value : 'original';

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Memproses...';
    }
    playTcSfx('start');
    log('Memulai Kuro Transcode: <b>' + mode + '</b>');
    log('File: ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)');
    showOverlay('PROSES KURO TRANSCODE [' + mode.toUpperCase() + ']');

    var inName = 'tc_in_' + Date.now() + '.mp4';
    var outName = 'tc_out_' + Date.now() + '.mp4';

    try {
      var ffmpeg = await getFFmpegInstance();
      var data = await fileToUint8(file);
      log('Menulis file ke memori WASM...');
      await ffmpeg.writeFile(inName, data);

      var scaleFilter = getScaleFilter(targetRes);
      var args;
      var meta = ['-metadata', 'encoder=KuroPatcherTranscode'];

      if (mode === 'hq_upscale') {
        log('Mode: HQ Upscale → ' + targetRes);
        if (scaleFilter) {
          args = ['-i', inName, '-vf', scaleFilter, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-c:a', 'copy'].concat(meta, [outName]);
        } else {
          args = ['-i', inName, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-c:a', 'copy'].concat(meta, [outName]);
        }
      } else if (mode === 'fps_2x') {
        var targetFps = Math.max(24, Math.round(currentVideoFps * 2));
        log('Mode: Multiplier 2x FPS → ~' + targetFps + ' fps');
        args = ['-i', inName, '-filter:v', 'fps=fps=' + targetFps, '-c:v', 'libx264', '-crf', '20', '-preset', 'faster', '-c:a', 'copy'].concat(meta, [outName]);
      } else if (mode === 'patch_video') {
        log('Mode: Kuro MP4 Patcher (h264_mp4toannexb)...');
        args = ['-i', inName, '-bsf:v', 'h264_mp4toannexb', '-c', 'copy', '-f', 'mp4'].concat(meta, [outName]);
      } else if (mode === 'optimize_moov') {
        log('Mode: Optimizer FastStart (MOOV)...');
        args = ['-i', inName, '-c', 'copy', '-movflags', '+faststart'].concat(meta, [outName]);
      } else if (mode === 'compress_faststart') {
        log('Mode: Kompres + FastStart (CRF 23)...');
        args = ['-i', inName, '-c:v', 'libx264', '-crf', '23', '-preset', 'faster', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k'].concat(meta, [outName]);
      } else if (mode === 'all_in_one') {
        var tFps = Math.max(24, Math.round(currentVideoFps * 2));
        var filters = ['fps=fps=' + tFps];
        if (scaleFilter) filters.push(scaleFilter);
        log('Mode: All-In-One (HQ ' + targetRes + ' + ' + tFps + 'fps + Patcher + FastStart)...');
        args = ['-i', inName, '-vf', filters.join(','), '-bsf:v', 'h264_mp4toannexb', '-movflags', '+faststart',
          '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k'].concat(meta, [outName]);
      } else {
        throw new Error('Mode tidak dikenal: ' + mode);
      }

      log('Menjalankan FFmpeg...');
      await ffmpeg.exec(args);

      log('Membaca hasil...');
      var outData = await ffmpeg.readFile(outName);
      try { await ffmpeg.deleteFile(inName); } catch (e) {}
      try { await ffmpeg.deleteFile(outName); } catch (e) {}

      var base = (file.name || 'video').replace(/\.[^.]+$/, '');
      prepareDownload(outData, 'kuro_' + mode + '_' + base + '.mp4');
    } catch (err) {
      console.error(err);
      log('ERROR: ' + (err && err.message ? err.message : err));
      playTcSfx('error');
      hideOverlay();
      alert('Gagal memproses: ' + (err && err.message ? err.message : err));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'PROSES VIDEO SEKARANG';
      }
    }
  }

  function switchEncoderMode(mode) {
    var kompres = document.getElementById('mode-kompres');
    var transcode = document.getElementById('mode-transcode');
    var btnKompres = document.getElementById('btn-mode-kompres');
    var btnTrans = document.getElementById('btn-mode-transcode');
    if (!kompres || !transcode) return;
    if (mode === 'kompres') {
      kompres.classList.remove('hidden');
      transcode.classList.add('hidden');
      if (btnKompres) btnKompres.classList.add('active');
      if (btnTrans) btnTrans.classList.remove('active');
    } else {
      kompres.classList.add('hidden');
      transcode.classList.remove('hidden');
      if (btnKompres) btnKompres.classList.remove('active');
      if (btnTrans) btnTrans.classList.add('active');
      playTcSfx('konnichiwa');
    }
  }

  function probeFps(file) {
    try {
      var v = document.createElement('video');
      v.preload = 'metadata';
      v.src = URL.createObjectURL(file);
      v.onloadedmetadata = function () {
        try { URL.revokeObjectURL(v.src); } catch (e) {}
        // browser tidak selalu expose fps; fallback 30
        currentVideoFps = 30;
      };
    } catch (e) {
      currentVideoFps = 30;
    }
  }

  function initNoticeCard() {
    var card = document.getElementById('kuroNoticeCard');
    var timerEl = document.getElementById('kuroNoticeTimer');
    if (!card) return;
    var left = 5;
    var iv = setInterval(function () {
      left -= 1;
      if (left > 0) {
        if (timerEl) timerEl.textContent = 'Auto Close: ' + left + 's';
      } else {
        clearInterval(iv);
        card.classList.add('kuro-notice-closing');
        setTimeout(function () {
          card.style.display = 'none';
        }, 500);
      }
    }, 1000);
  }

  function initTools() {
    initNoticeCard();

    // welcome SFX sekali (first interaction)
    var welcomed = false;
    document.addEventListener('click', function welcomeOnce() {
      if (welcomed) return;
      welcomed = true;
      playTcSfx('konnichiwa');
    }, { once: true });

    var btn = document.getElementById('tc-processBtn');
    if (btn) btn.addEventListener('click', runTranscode);

    var dl = document.getElementById('tc-dlBtn');
    if (dl) dl.addEventListener('click', triggerDownload);

    var b1 = document.getElementById('btn-mode-kompres');
    var b2 = document.getElementById('btn-mode-transcode');
    if (b1) b1.addEventListener('click', function () { switchEncoderMode('kompres'); });
    if (b2) b2.addEventListener('click', function () { switchEncoderMode('transcode'); });

    var modeSel = document.getElementById('tc-modeSelect');
    if (modeSel) {
      modeSel.addEventListener('change', function () {
        var v = modeSel.value;
        if (v === 'all_in_one' || v === 'hq_upscale') playTcSfx('huwaw');
        else playTcSfx('game');
      });
    }
    var resSel = document.getElementById('tc-resolutionTarget');
    if (resSel) {
      resSel.addEventListener('change', function () { playTcSfx('game'); });
    }

    var drop = document.getElementById('tc-dropzone');
    var inp = document.getElementById('tc-videoInput');
    if (drop && inp) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          drop.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          drop.classList.remove('dragover');
        });
      });
      drop.addEventListener('drop', function (e) {
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) {
          try {
            var dt = new DataTransfer();
            dt.items.add(files[0]);
            inp.files = dt.files;
          } catch (err) {}
          log('File dipilih: ' + files[0].name);
          probeFps(files[0]);
          playTcSfx('game');
        }
      });
      inp.addEventListener('change', function () {
        if (inp.files && inp.files.length) {
          log('File dipilih: ' + inp.files[0].name);
          probeFps(inp.files[0]);
          playTcSfx('game');
        }
      });
    }

    switchEncoderMode('kompres');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTools);
  } else {
    initTools();
  }
})();
