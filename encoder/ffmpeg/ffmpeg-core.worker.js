/* KURO METHOD EXTENSION - FFMPEG CORE WORKER
 * ------------------------------------------------------------------
 * Wrapper Worker yang menjalankan ffmpeg-core.js + ffmpeg-core.wasm
 * di dalam dedicated Worker.
 *
 * Kenapa perlu Worker?
 *   Build ini memakai pthreads (SharedArrayBuffer). Emscripten TIDAK
 *   boleh melakukan Atomics.wait() di main thread sebuah document
 *   (offscreen.html / page). Kalau dipaksa, ia jatuh ke busy-spin
 *   fallback dan encode akan menggantung.
 *   Di dalam Worker, Atomics.wait() legal sehingga pthread berjalan
 *   normal.
 *
 * Protokol pesan (main thread -> worker):
 *   { id, cmd: 'load',      payload: { coreURL, wasmURL } }
 *   { id, cmd: 'exec',      payload: { args: [...] } }
 *   { id, cmd: 'writeFile', payload: { path, data } }
 *   { id, cmd: 'readFile',  payload: { path, encoding } }
 *   { id, cmd: 'unlink',    payload: { path } }
 *   { id, cmd: 'reset' }
 *   { id, cmd: 'terminate' }
 *
 * Balasan (worker -> main thread):
 *   { type: 'log',  id, stream: 'stdout'|'stderr', text }
 *   { type: 'done', id, result }   atau   { type: 'done', id, error }
 * ------------------------------------------------------------------ */
'use strict';

var core = null;
var coreURLRef = null;

function post(type, payload) {
    self.postMessage(Object.assign({ type: type }, payload || {}));
}

self.onmessage = function (e) {
    var msg = e.data || {};
    var id = msg.id;
    var cmd = msg.cmd;
    var payload = msg.payload || {};

    if (cmd === 'load') {
        try {
            coreURLRef = payload.coreURL;
            // Muat glue Emscripten ke scope worker ini.
            importScripts(coreURLRef);
            var factory = self.createFFmpegCore || self.FFmpegCore;
            if (typeof factory !== 'function') {
                throw new Error('createFFmpegCore / FFmpegCore tidak ditemukan setelah importScripts.');
            }
            factory({
                mainScriptUrlOrBlob: coreURLRef,
                locateFile: function (path) {
                    if (path.slice(-5) === '.wasm') return payload.wasmURL;
                    return new URL(path, coreURLRef).href;
                },
                print: function (text) {
                    post('log', { id: id, stream: 'stdout', text: String(text) });
                },
                printErr: function (text) {
                    post('log', { id: id, stream: 'stderr', text: String(text) });
                }
            }).then(function (instance) {
                core = instance;
                post('done', { id: id, result: true });
            }).catch(function (err) {
                post('done', { id: id, error: String(err && (err.stack || err.message || err)) });
            });
        } catch (err) {
            post('done', { id: id, error: String(err && (err.stack || err.message || err)) });
        }
        return;
    }

    // Semua command lain butuh core yang sudah siap.
    if (!core) {
        post('done', { id: id, error: 'Core belum dimuat. Kirim cmd "load" lebih dulu.' });
        return;
    }

    try {
        switch (cmd) {
            case 'exec': {
                var args = payload.args || [];
                var ret = core.exec.apply(core, args);
                // exec() mengembalikan Module.ret; -1 / undefined = core abort sebelum selesai.
                if (typeof ret !== 'number') ret = (typeof core.ret === 'number') ? core.ret : -1;
                // Kembalikan state core (ret/timeout) agar exec berikutnya bersih.
                if (typeof core.reset === 'function') core.reset();
                post('done', { id: id, result: ret });
                break;
            }
            case 'writeFile': {
                var data = payload.data;
                if (data instanceof ArrayBuffer) data = new Uint8Array(data);
                core.FS.writeFile(payload.path, data);
                post('done', { id: id, result: true });
                break;
            }
            case 'readFile': {
                var bytes = core.FS.readFile(payload.path);
                if (payload.encoding === 'utf8') {
                    post('done', { id: id, result: new TextDecoder().decode(bytes) });
                } else {
                    // Uint8Array bisa di-structured-clone; kirim salinan agar
                    // buffer MEMFS tidak ikut ter-transfer/detach.
                    post('done', { id: id, result: new Uint8Array(bytes) });
                }
                break;
            }
            case 'unlink': {
                core.FS.unlink(payload.path);
                post('done', { id: id, result: true });
                break;
            }
            case 'reset': {
                if (typeof core.reset === 'function') core.reset();
                post('done', { id: id, result: true });
                break;
            }
            case 'terminate': {
                post('done', { id: id, result: true });
                core = null;
                self.close();
                break;
            }
            default:
                post('done', { id: id, error: 'Command tidak dikenal: ' + cmd });
        }
    } catch (err) {
        post('done', { id: id, error: String(err && (err.stack || err.message || err)) });
    }
};
