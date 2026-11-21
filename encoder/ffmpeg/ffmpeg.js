/* KURO METHOD EXTENSION - MODIFIED FFMPEG WASM WRAPPER
 * ------------------------------------------------------------------
 * v2: menambahkan "worker mode".
 *
 * Build ffmpeg-core memakai pthreads (SharedArrayBuffer). Di main thread
 * sebuah document, Atomics.wait() dilarang browser sehingga Emscripten
 * jatuh ke busy-spin dan encode bisa menggantung. Karena itu core
 * dijalankan di dedicated Worker (ffmpeg-core.worker.js).
 *
 * API publik TIDAK berubah:
 *   const ffmpeg = new FFmpegWASM.FFmpeg();
 *   await ffmpeg.load();                       // worker mode (default)
 *   await ffmpeg.load({ useWorker: false });   // mode lama (direct)
 *   ffmpeg.on('log', cb); ffmpeg.on('progress', cb);
 *   await ffmpeg.writeFile(path, data);
 *   await ffmpeg.readFile(path, 'binary'|'utf8');
 *   await ffmpeg.deleteFile(path);
 *   await ffmpeg.exec([...args]);
 *   ffmpeg.terminate();
 * ------------------------------------------------------------------ */
(function (global, factory) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = factory();
    } else if (typeof define === "function" && define.amd) {
        define([], factory);
    } else {
        global.FFmpegWASM = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    const FFFSType = {
        MEMFS: "MEMFS",
        NODEFS: "NODEFS",
        NODERAWFS: "NODERAWFS",
        IDBFS: "IDBFS",
        WORKERFS: "WORKERFS",
        PROXYFS: "PROXYFS"
    };

    class FFmpeg {
        #core = null;          // instance core (direct mode)
        #worker = null;        // Worker (worker mode)
        #loaded = false;
        #logCallbacks = [];
        #progressCallbacks = [];
        #duration = 0;

        // worker-mode plumbing
        #nextId = 1;
        #pending = new Map();

        constructor() {}

        get loaded() {
            return this.#loaded;
        }

        on(event, callback) {
            if (event === "log") this.#logCallbacks.push(callback);
            if (event === "progress") this.#progressCallbacks.push(callback);
        }

        off(event, callback) {
            if (event === "log") {
                this.#logCallbacks = this.#logCallbacks.filter(cb => cb !== callback);
            } else if (event === "progress") {
                this.#progressCallbacks = this.#progressCallbacks.filter(cb => cb !== callback);
            }
        }

        /**
         * Helper internal untuk mem-parse progress ffmpeg dari log output
         */
        #parseProgress(message) {
            if (typeof message !== "string") return;

            if (message.includes("Duration:")) {
                const match = message.match(/Duration:\s(\d+):(\d+):(\d+\.\d+)/);
                if (match) {
                    const hours = parseFloat(match[1]);
                    const minutes = parseFloat(match[2]);
                    const seconds = parseFloat(match[3]);
                    this.#duration = hours * 3600 + minutes * 60 + seconds;
                }
            }

            if (message.includes("time=") && this.#duration > 0) {
                const match = message.match(/time=(\d+):(\d+):(\d+\.\d+)/);
                if (match) {
                    const hours = parseFloat(match[1]);
                    const minutes = parseFloat(match[2]);
                    const seconds = parseFloat(match[3]);
                    const currentTime = hours * 3600 + minutes * 60 + seconds;
                    const ratio = Math.min(currentTime / this.#duration, 1);

                    this.#progressCallbacks.forEach(cb => cb({
                        progress: ratio,
                        time: currentTime,
                        duration: this.#duration
                    }));
                }
            }
        }

        #emitLog(type, text) {
            this.#logCallbacks.forEach(cb => cb({ type: type, message: text }));
            this.#parseProgress(text);
        }

        /* ---------------------- worker helpers ---------------------- */

        #workerCall(cmd, payload, transfer) {
            const id = this.#nextId++;
            return new Promise((resolve, reject) => {
                this.#pending.set(id, { resolve, reject });
                try {
                    this.#worker.postMessage({ id: id, cmd: cmd, payload: payload || {} }, transfer || []);
                } catch (err) {
                    this.#pending.delete(id);
                    reject(err);
                }
            });
        }

        #attachWorkerHandlers() {
            this.#worker.onmessage = (e) => {
                const m = e.data || {};
                if (m.type === "log") {
                    this.#emitLog(m.stream === "stderr" ? "stderr" : "stdout", m.text);
                    return;
                }
                if (m.type === "done") {
                    const p = this.#pending.get(m.id);
                    if (!p) return;
                    this.#pending.delete(m.id);
                    if (m.error) p.reject(new Error(m.error));
                    else p.resolve(m.result);
                }
            };
            this.#worker.onerror = (e) => {
                const err = new Error("Worker FFmpeg error: " + (e.message || "unknown"));
                this.#pending.forEach(p => p.reject(err));
                this.#pending.clear();
            };
        }

        /* ------------------------- load ------------------------- */

        async load(options = {}) {
            if (this.#loaded) return true;

            const coreJSPath = options.coreURL || chrome.runtime.getURL("encoder/ffmpeg/ffmpeg-core.js");
            const wasmPath = options.wasmURL || chrome.runtime.getURL("encoder/ffmpeg/ffmpeg-core.wasm");
            const workerPath = options.workerURL || chrome.runtime.getURL("encoder/ffmpeg/ffmpeg-core.worker.js");

            // Default: worker mode ON. Bisa dimatikan dengan { useWorker: false }.
            const useWorker = options.useWorker !== false;

            if (useWorker && typeof Worker !== "undefined") {
                try {
                    this.#worker = new Worker(workerPath);
                    this.#attachWorkerHandlers();
                    await this.#workerCall("load", { coreURL: coreJSPath, wasmURL: wasmPath });
                    this.#loaded = true;
                    return true;
                } catch (err) {
                    // Bersihkan lalu jatuh ke direct mode.
                    if (this.#worker) { try { this.#worker.terminate(); } catch (e) {} }
                    this.#worker = null;
                    this.#pending.clear();
                    console.warn("[Kuro FFmpeg] Worker mode gagal, fallback ke direct mode:", err && err.message);
                }
            }

            return this.#loadDirect(coreJSPath, wasmPath);
        }

        /**
         * Mode lama: muat core di thread saat ini (butuh main thread yang
         * mengizinkan Atomics.wait — biasanya hanya di dalam Worker).
         */
        #loadDirect(coreJSPath, wasmPath) {
            const coreLocator = coreJSPath + "#" + btoa(JSON.stringify({
                wasmURL: wasmPath,
                workerURL: ""
            }));

            return new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = coreJSPath;
                script.onload = async () => {
                    const coreFactory = window.createFFmpegCore || window.FFmpegCore;

                    if (typeof coreFactory === "function") {
                        try {
                            this.#core = await coreFactory({
                                mainScriptUrlOrBlob: coreLocator,
                                locateFile: (path) => {
                                    if (path.endsWith(".wasm")) return wasmPath;
                                    return chrome.runtime.getURL(`encoder/ffmpeg/${path}`);
                                },
                                print: (text) => this.#emitLog("stdout", text),
                                printErr: (text) => this.#emitLog("stderr", text)
                            });
                            this.#loaded = true;
                            resolve(true);
                        } catch (err) {
                            reject(new Error("Gagal menginisialisasi FFmpegCore WASM: " + err.message));
                        }
                    } else {
                        reject(new Error("FFmpegCore / createFFmpegCore tidak terdeteksi pada window object."));
                    }
                };
                script.onerror = () => reject(new Error("Gagal memuat script FFmpeg Core dari path: " + coreJSPath));
                document.head.appendChild(script);
            });
        }

        /* ------------------------ file ops ------------------------ */

        async writeFile(path, data) {
            if (!this.#loaded) throw new Error("FFmpeg belum dimuat, panggil `await ffmpeg.load()` terlebih dahulu.");

            let buffer = data;
            if (data instanceof ArrayBuffer) {
                buffer = new Uint8Array(data);
            }

            if (this.#worker) {
                // Transfer buffer supaya tidak ada salinan ganda untuk file besar.
                const transfer = (buffer && buffer.buffer instanceof ArrayBuffer) ? [buffer.buffer] : [];
                await this.#workerCall("writeFile", { path: path, data: buffer }, transfer);
                return true;
            }

            this.#core.FS.writeFile(path, buffer);
            return true;
        }

        async readFile(path, encoding = "binary") {
            if (!this.#loaded) throw new Error("FFmpeg belum dimuat.");

            if (this.#worker) {
                return await this.#workerCall("readFile", { path: path, encoding: encoding });
            }

            const fileData = this.#core.FS.readFile(path);
            if (encoding === "utf8") {
                return new TextDecoder().decode(fileData);
            }
            return fileData;
        }

        async deleteFile(path) {
            if (!this.#loaded) throw new Error("FFmpeg belum dimuat.");

            if (this.#worker) {
                await this.#workerCall("unlink", { path: path });
                return true;
            }

            this.#core.FS.unlink(path);
            return true;
        }

        /* -------------------------- exec -------------------------- */

        async exec(args = []) {
            if (!this.#loaded) throw new Error("FFmpeg belum dimuat.");

            try {
                this.#duration = 0; // Reset durasi sebelum eksekusi

                if (this.#worker) {
                    return await this.#workerCall("exec", { args: args });
                }

                if (typeof this.#core.reset === "function") this.#core.reset();
                const exitCode = this.#core.exec(...args);
                return exitCode;
            } catch (err) {
                console.warn("[Kuro FFmpeg Exec Output]:", err);
                throw err;
            }
        }

        terminate() {
            if (this.#worker) {
                try { this.#worker.postMessage({ id: this.#nextId++, cmd: "terminate" }); } catch (e) {}
                try { this.#worker.terminate(); } catch (e) {}
                this.#worker = null;
                this.#pending.clear();
            }
            this.#core = null;
            this.#loaded = false;
            this.#duration = 0;
        }
    }

    return {
        FFmpeg: FFmpeg,
        FFFSType: FFFSType
    };
});
