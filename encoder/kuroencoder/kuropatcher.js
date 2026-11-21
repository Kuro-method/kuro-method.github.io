// ============================================================================
// KURO METHOD EXTENSION - MP4 CONTAINER VALIDATOR & STREAM-COPY PATCHER
// (kuropatcher.js)
//
// Fitur:
//  1. Pemeriksaan ekstensi file (.mp4 .m4v .mov .3gp .m4a .webm .mkv)
//  2. Parsing atom/box MP4: ftyp, moov, mdat, trak, mdia, hdlr, stsd, stco/co64
//  3. Validasi codec: Video H.264 / HEVC / MPEG-4 / VP9 / AV1  +  Audio AAC-LC / HE-AAC /
//     HE-AAC v2 / Opus  (.m4a = audio-only, tanpa track video). Container MKV / WebM
//     dibaca lewat parser EBML ringan (codec terdeteksi, lalu di-remux ke MP4 stream-copy).
//  4. Deteksi bit depth (8 / 10 / 12-bit) & profil warna (SDR, HDR10/PQ, HLG, Dolby Vision)
//  5. Auto-Patch (stream-copy, TANPA re-encode):
//       moov dipindah ke depan file (faststart) + kalkulasi ulang offset
//       chunk (stco/co64). Isi mdat 100% identik byte-per-byte.
//  6. Verifikasi hasil patch (ukuran sama, mdat identik, offset chunk valid)
//  7. Compatible Old Devices -> OTOMATIS per file (tanpa peringatan):
//       deteksi container dari isi file (bukan sekadar ekstensi). MP4 family -> ON
//       (videoTag avc1 / hvc1 dipakai uploadhd.js saat remux). MKV / WebM -> OFF.
//
//  8. Validasi TABEL SAMPLE per track (video & audio):
//       stts (jumlah sample) = stsz (jumlah sample) = stsc x stco/co64 (jumlah sample)
//       mdhd (timescale + durasi) cocok dengan total durasi stts
//       tiap chunk (offset stco/co64 + ukuran sample stsz) berada utuh di dalam mdat
//     Tabel tidak konsisten -> file TIDAK dipatch lokal (patch metadata-only; tabel
//     rusak tidak ditambal). Pipeline upload tidak lagi mem-remux; file dipakai apa adanya
//     dicek ulang (jumlah sample & durasi harus sama dengan file asli).
//
//  9. Tag encoder FFmpeg (©too = "Lavf63.1.102", ident FFmpeg WASM bawaan Kuro) ditulis ke
//     moov/udta/meta/ilst pada file hasil patch metadata / pass-through (opsional).
//     Isi mdat tidak disentuh. Pipeline upload tidak memaksa faststart/remux.
//
// 10. KURO METHOD (di akhir file): KuroMethod.patchKuroMethodMp4 + KuroMp4Patcher.processAndReport / processFile.
//     Menyatu dengan High Quality Uploaders, aktif permanen (tanpa saklar terpisah).
//     Mendukung video H.264 (avc1) + H.265/HEVC (hvc1/hev1) dan audio AAC (mp4a: AAC-LC / HE-AAC / HE-AAC v2).
//     Susunan hasil: ftyp + moov + free + mdat (FastStart), timestamp dinolkan, compressorname dikosongkan,
//     timescale film 1000, tag Kuro Method. Track video + track audio ASLI saja (tanpa track tambahan);
//     isi video identik byte-per-byte; 4 sample audio terakhir ditimpa filler AAC (ukuran sample tetap).
//     Fitur 1-9 di atas tidak diubah.
//
// Berjalan sebagai content script (isolated world). Tidak butuh FFmpeg WASM
// sehingga cepat & hemat memori (memakai Blob.slice, file tidak dimuat penuh).
// ============================================================================

(function (global) {
    'use strict';

    const VIDEO_EXTS = ['.mp4', '.m4v', '.mov', '.3gp', '.m4a', '.webm', '.mkv'];
    const MP4_FAMILY_EXTS = ['.mp4', '.m4v', '.mov', '.3gp', '.m4a'];
    const AUDIO_ONLY_EXTS = ['.m4a'];
    const AAC_OTIS = [0x40, 0x66, 0x67, 0x68]; // MPEG-4 Audio (LC/HE/HEv2) + MPEG-2 AAC Main/LC/SSR
    const AOT_NAMES = { 1: 'AAC Main', 2: 'AAC-LC', 3: 'AAC SSR', 4: 'AAC LTP', 5: 'HE-AAC', 23: 'AAC-LD', 29: 'HE-AAC v2', 39: 'AAC-ELD', 42: 'USAC' };
    const MAX_MOOV_BYTES = 256 * 1024 * 1024; // batas aman baca moov

    const VIDEO_FOURCC = {
        avc1: 'H.264', avc3: 'H.264',
        hvc1: 'HEVC', hev1: 'HEVC',
        mp4v: 'MPEG-4',
        vp09: 'VP9', av01: 'AV1',
        dvh1: 'HEVC (Dolby Vision)', dvhe: 'HEVC (Dolby Vision)'
    };
    const CONTAINER_BOXES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta']);

    // ------------------------------------------------------------------ utils
    // Nama hasil proses: nama asli + "_kuro_patched" tepat sebelum ekstensi (.mp4 / .m4a).
    // Tidak digandakan bila file sudah membawa akhiran itu (mis. hasil patch lalu di-remux).
    function patchedName(name, isM4a) {
        const base = String(name || 'video').replace(/\.[^./\\]+$/, '').replace(/_kuro_patched$/i, '') || 'video';
        return base + '_kuro_patched' + (isM4a ? '.m4a' : '.mp4');
    }

    function getExt(name) {
        const i = String(name || '').lastIndexOf('.');
        return i < 0 ? '' : name.slice(i).toLowerCase();
    }

    function isVideoFile(file) {
        if (!file) return false;
        return VIDEO_EXTS.includes(getExt(file.name)) ||
            (typeof file.type === 'string' && (file.type.startsWith('video/') ||
                file.type === 'audio/mp4' || file.type === 'audio/x-m4a' || file.type === 'audio/m4a'));
    }

    function isAudioOnlyFile(file) {
        return !!file && AUDIO_ONLY_EXTS.includes(getExt(file.name));
    }

    function fourcc(dv, off) {
        return String.fromCharCode(
            dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3)
        );
    }

    async function readRange(file, start, end) {
        return new Uint8Array(await file.slice(start, end).arrayBuffer());
    }

    // ------------------------------------------- top-level box scanner (lazy)
    // Hanya membaca header (16 byte) tiap box, sehingga mdat 2GB tidak dimuat.
    async function scanTopLevel(file) {
        const boxes = [];
        let pos = 0;
        while (pos + 8 <= file.size) {
            const head = await readRange(file, pos, Math.min(pos + 16, file.size));
            const dv = new DataView(head.buffer);
            let size = dv.getUint32(0);
            const type = fourcc(dv, 4);
            let headerSize = 8;
            if (size === 1) {
                if (head.length < 16) break;
                size = Number(dv.getBigUint64(8));
                headerSize = 16;
            } else if (size === 0) {
                size = file.size - pos; // sampai akhir file
            }
            if (size < headerSize || pos + size > file.size) {
                boxes.push({ type, start: pos, size: Math.min(size, file.size - pos), headerSize, truncated: true });
                break;
            }
            boxes.push({ type, start: pos, size, headerSize });
            pos += size;
        }
        return { boxes, endPos: pos };
    }

    // ----------------------------------------------------- moov box parsing
    function* iterChildren(buf, start, end) {
        const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let p = start;
        while (p + 8 <= end) {
            let size = dv.getUint32(p);
            const type = fourcc(dv, p + 4);
            let hs = 8;
            if (size === 1) { size = Number(dv.getBigUint64(p + 8)); hs = 16; }
            else if (size === 0) size = end - p;
            if (size < hs || p + size > end) return;
            yield { type, start: p, size, hs, bodyStart: p + hs, end: p + size };
            p += size;
        }
    }

    function findChild(buf, parent, type) {
        for (const c of iterChildren(buf, parent.bodyStart, parent.end)) if (c.type === type) return c;
        return null;
    }

    // Offset awal child di dalam sample entry (setelah field SampleEntry/Visual/Audio)
    function parseVideoEntry(buf, entry) {
        // VisualSampleEntry: 6 reserved + 2 dref + 70 byte field visual = 78 byte body sebelum child
        const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const info = { bitDepth: 8, transfer: null, primaries: null, dolbyVision: false, profile: null, width: null, height: null };
        // VisualSampleEntry: width/height (uint16) berada di offset 24 & 26 dari awal body
        if (entry.bodyStart + 28 <= entry.end) { info.width = dv.getUint16(entry.bodyStart + 24); info.height = dv.getUint16(entry.bodyStart + 26); }
        const kidsStart = entry.bodyStart + 78;
        if (kidsStart > entry.end) return info;
        for (const k of iterChildren(buf, kidsStart, entry.end)) {
            if (k.type === 'avcC' && k.bodyStart + 4 <= k.end) {
                const profileIdc = dv.getUint8(k.bodyStart + 1);
                info.profile = profileIdc;
                // Bit depth asli ada di ekstensi avcC (profil High / 10 / 4:2:2 / 4:4:4), setelah daftar SPS & PPS.
                // Profil nilai tinggi saja (mis. 244) belum tentu >8-bit, jadi dibaca dari field-nya.
                if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134].includes(profileIdc)) {
                    try {
                        let q = k.bodyStart + 5;
                        const nSps = dv.getUint8(q++) & 0x1f;
                        for (let i = 0; i < nSps; i++) q += 2 + dv.getUint16(q);
                        const nPps = dv.getUint8(q++);
                        for (let i = 0; i < nPps; i++) q += 2 + dv.getUint16(q);
                        if (q + 3 <= k.end) info.bitDepth = (dv.getUint8(q + 1) & 0x07) + 8;
                        else if (profileIdc === 110 || profileIdc === 122) info.bitDepth = 10;
                    } catch (e) {
                        if (profileIdc === 110 || profileIdc === 122) info.bitDepth = 10;
                    }
                }
            } else if (k.type === 'hvcC' && k.bodyStart + 18 <= k.end) {
                info.profile = dv.getUint8(k.bodyStart + 1) & 0x1f;
                info.bitDepth = (dv.getUint8(k.bodyStart + 17) & 0x07) + 8;
            } else if (k.type === 'colr' && k.bodyStart + 10 <= k.end) {
                const ct = fourcc(dv, k.bodyStart);
                if (ct === 'nclx' || ct === 'nclc') {
                    info.primaries = dv.getUint16(k.bodyStart + 4);
                    info.transfer = dv.getUint16(k.bodyStart + 6);
                }
            } else if (k.type === 'vpcC' && k.bodyStart + 7 <= k.end) {
                // FullBox(4) + profile(1) + level(1) + [bitDepth(4)|chroma(3)|fullRange(1)]
                info.profile = dv.getUint8(k.bodyStart + 4);
                const bd = dv.getUint8(k.bodyStart + 6) >> 4;
                if (bd === 8 || bd === 10 || bd === 12) info.bitDepth = bd;
            } else if (k.type === 'av1C' && k.bodyStart + 3 <= k.end) {
                // marker/version(1) + seq_profile/level(1) + [tier(1) high_bitdepth(1) twelve_bit(1) ...]
                const b2 = dv.getUint8(k.bodyStart + 2);
                info.profile = dv.getUint8(k.bodyStart + 1) >> 5;
                info.bitDepth = ((b2 >> 5) & 1) ? 12 : (((b2 >> 6) & 1) ? 10 : 8);
            } else if (k.type === 'dvcC' || k.type === 'dvvC') {
                info.dolbyVision = true;
            }
        }
        return info;
    }

    // AudioSpecificConfig (ISO 14496-3): bedakan AAC-LC, HE-AAC (SBR) dan HE-AAC v2 (SBR+PS).
    // Mendukung signaling eksplisit (AOT 5 / 29) maupun backward-compatible (sync 0x2b7 / 0x548).
    function parseAudioSpecificConfig(bytes) {
        const r = { audioObjectType: null, audioProfile: null, sbr: false, ps: false };
        const total = bytes.length * 8;
        let bit = 0;
        const read = (n) => {
            if (bit + n > total) throw new RangeError('ASC habis');
            let v = 0;
            for (let i = 0; i < n; i++, bit++) v = (v << 1) | ((bytes[bit >> 3] >> (7 - (bit & 7))) & 1);
            return v;
        };
        const left = () => total - bit;
        try {
            let aot = read(5); if (aot === 31) aot = 32 + read(6);
            r.audioObjectType = aot;
            const sfi = read(4); if (sfi === 15) read(24);
            const ch = read(4);
            if (aot === 5 || aot === 29) {
                // signaling eksplisit
                r.sbr = true; r.ps = aot === 29;
            } else if ([1, 2, 3, 4, 6, 7, 17, 19, 20, 21, 22, 23].includes(aot) && ch !== 0) {
                // GASpecificConfig
                read(1);                       // frameLengthFlag
                if (read(1)) read(14);         // dependsOnCoreCoder -> coreCoderDelay
                const ext = read(1);           // extensionFlag
                if (aot === 6 || aot === 20) read(3);
                if (ext) {
                    if (aot === 22) { read(5); read(11); }
                    if (aot === 17 || aot === 19 || aot === 20 || aot === 23) { read(3); }
                    read(1);
                }
                // backward-compatible: sync extension HE-AAC / HE-AAC v2
                if (left() >= 16 && read(11) === 0x2b7) {
                    const extAot = read(5);
                    if (extAot === 5 && read(1)) {
                        r.sbr = true;
                        const esfi = read(4); if (esfi === 15) read(24);
                        if (left() >= 12 && read(11) === 0x548 && read(1)) r.ps = true;
                    }
                }
            }
        } catch (e) { /* ASC terpotong: pakai hasil sejauh ini */ }
        if (r.audioObjectType !== null) {
            r.audioProfile = r.ps ? 'HE-AAC v2' : (r.sbr ? 'HE-AAC' : (AOT_NAMES[r.audioObjectType] || 'AAC (AOT ' + r.audioObjectType + ')'));
        }
        return r;
    }

    function parseAudioEntry(buf, entry) {
        // AudioSampleEntry: 6 + 2 + 8 reserved + channels/size/etc = 28 byte body (v0)
        const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const info = { aacObjectType: null, audioObjectType: null, audioProfile: null };
        let kidsStart = entry.bodyStart + 28;
        if (kidsStart > entry.end) return info;
        // QuickTime sound version 1/2 punya field tambahan
        const ver = dv.getUint16(entry.bodyStart + 8);
        if (ver === 1) kidsStart += 16;
        else if (ver === 2) kidsStart += 36;
        for (const k of iterChildren(buf, kidsStart, entry.end)) {
            if (k.type === 'esds') {
                // FullBox(4) lalu descriptor: 0x03 ES_Desc -> 0x04 DecoderConfig -> objectTypeIndication
                let p = k.bodyStart + 4;
                const readLen = () => {
                    let len = 0;
                    for (let i = 0; i < 4 && p < k.end; i++) {
                        const b = dv.getUint8(p++);
                        len = (len << 7) | (b & 0x7f);
                        if (!(b & 0x80)) break;
                    }
                    return len;
                };
                while (p < k.end) {
                    const tag = dv.getUint8(p++);
                    readLen();
                    if (tag === 0x03) {
                        // ES_ID(2) + flags(1) [+ dependsOn(2)] [+ URL] [+ OCR(2)]
                        const fl = dv.getUint8(p + 2); p += 3;
                        if (fl & 0x80) p += 2;
                        if (fl & 0x40) p += 1 + dv.getUint8(p);
                        if (fl & 0x20) p += 2;
                    }
                    else if (tag === 0x04) {
                        info.aacObjectType = dv.getUint8(p);
                        p += 13; // OTI, streamType, bufferSize, maxBitrate, avgBitrate
                        if (p < k.end && dv.getUint8(p) === 0x05) {
                            p++;
                            const dsiLen = readLen();
                            const asc = new Uint8Array(buf.buffer, buf.byteOffset + p, Math.max(0, Math.min(dsiLen, k.end - p)));
                            Object.assign(info, parseAudioSpecificConfig(asc));
                        }
                        break;
                    }
                    else break;
                }
            }
        }
        return info;
    }

    // FPS rata-rata dari mdhd (timescale) + stts (jumlah & durasi sample). null bila tidak terbaca (mis. fragmented MP4).
    function readFps(dv, mdhd, stts) {
        try {
            if (!mdhd || !stts) return null;
            const ver = dv.getUint8(mdhd.bodyStart);
            const timescale = ver === 1 ? dv.getUint32(mdhd.bodyStart + 20) : dv.getUint32(mdhd.bodyStart + 12);
            const n = dv.getUint32(stts.bodyStart + 4);
            let samples = 0;
            let dur = 0;
            for (let i = 0, q = stts.bodyStart + 8; i < n && q + 8 <= stts.end; i++, q += 8) {
                const c = dv.getUint32(q);
                const d = dv.getUint32(q + 4);
                samples += c;
                dur += c * d;
            }
            if (!timescale || !dur || samples < 2) return null;
            return Math.round((samples * timescale / dur) * 100) / 100;
        } catch (e) { return null; }
    }

    // ------------------------------------------------ TABEL SAMPLE (mdhd / stts / stsz / stsc / stco)
    function readMdhd(dv, box) {
        try {
            if (!box) return null;
            const ver = dv.getUint8(box.bodyStart);
            if (box.end - box.bodyStart < (ver === 1 ? 32 : 20)) return null;
            return ver === 1
                ? { timescale: dv.getUint32(box.bodyStart + 20), duration: Number(dv.getBigUint64(box.bodyStart + 24)) }
                : { timescale: dv.getUint32(box.bodyStart + 12), duration: dv.getUint32(box.bodyStart + 16) };
        } catch (e) { return null; }
    }

    function readStts(dv, box) {
        if (!box || box.end - box.bodyStart < 8) return null;
        const declared = dv.getUint32(box.bodyStart + 4);
        const avail = Math.floor((box.end - box.bodyStart - 8) / 8);
        const n = Math.min(declared, avail);
        let samples = 0, duration = 0;
        for (let i = 0, q = box.bodyStart + 8; i < n; i++, q += 8) {
            const c = dv.getUint32(q);
            samples += c;
            duration += c * dv.getUint32(q + 4);
        }
        return { samples, duration, truncated: declared > avail };
    }

    function readStsz(dv, box) {
        // FullBox(4) + sample_size(4) + sample_count(4) + [entry_size(4) x count]
        if (!box || box.end - box.bodyStart < 12) return null;
        const uniform = dv.getUint32(box.bodyStart + 4);
        const count = dv.getUint32(box.bodyStart + 8);
        const r = { uniform, count, sizes: null, truncated: false };
        if (uniform === 0) {
            const avail = Math.floor((box.end - box.bodyStart - 12) / 4);
            r.truncated = avail < count;
            const n = Math.min(count, avail);
            r.sizes = new Uint32Array(n);
            for (let i = 0, q = box.bodyStart + 12; i < n; i++, q += 4) r.sizes[i] = dv.getUint32(q);
        }
        return r;
    }

    function readStsc(dv, box) {
        if (!box || box.end - box.bodyStart < 8) return null;
        const declared = dv.getUint32(box.bodyStart + 4);
        const avail = Math.floor((box.end - box.bodyStart - 8) / 12);
        const n = Math.min(declared, avail);
        const first = new Uint32Array(n), spc = new Uint32Array(n);
        for (let i = 0, q = box.bodyStart + 8; i < n; i++, q += 12) {
            first[i] = dv.getUint32(q);
            spc[i] = dv.getUint32(q + 4);
        }
        return { n, first, spc, truncated: declared > avail };
    }

    function readChunkOffsets(dv, box) {
        if (!box || box.end - box.bodyStart < 8) return null;
        const is64 = box.type === 'co64';
        const w = is64 ? 8 : 4;
        const declared = dv.getUint32(box.bodyStart + 4);
        const avail = Math.floor((box.end - box.bodyStart - 8) / w);
        const n = Math.min(declared, avail);
        const off = new Float64Array(n);
        for (let i = 0, q = box.bodyStart + 8; i < n; i++, q += w) off[i] = is64 ? Number(dv.getBigUint64(q)) : dv.getUint32(q);
        return { count: n, offsets: off, truncated: declared > avail };
    }

    // Satu track -> ringkasan + daftar masalah. ctx = { mdats:[{start,headerSize,size}], fragmented }
    function analyzeTables(buf, dv, mdia, stbl, ctx) {
        const T = {
            ok: true, skipped: false, problems: [],
            samples: null, chunks: null, timescale: null, duration: null, durationSec: null,
            sttsSamples: null, sttsDuration: null
        };
        const mdhd = readMdhd(dv, findChild(buf, mdia, 'mdhd'));
        if (mdhd) {
            T.timescale = mdhd.timescale; T.duration = mdhd.duration;
            T.durationSec = mdhd.timescale ? Math.round((mdhd.duration / mdhd.timescale) * 1000) / 1000 : null;
        }
        if (ctx && ctx.fragmented) { T.skipped = true; return T; } // fragmented: tabel memang kosong
        const bad = (m) => { T.ok = false; T.problems.push(m); };
        const stts = readStts(dv, stbl && findChild(buf, stbl, 'stts'));
        const stsz = readStsz(dv, stbl && findChild(buf, stbl, 'stsz'));
        const stsc = readStsc(dv, stbl && findChild(buf, stbl, 'stsc'));
        const co = stbl && (findChild(buf, stbl, 'stco') || findChild(buf, stbl, 'co64'));
        const chunks = readChunkOffsets(dv, co);

        if (!mdhd) bad('mdhd tidak ada / terpotong');
        else if (!mdhd.timescale) bad('mdhd timescale = 0');
        const missing = [];
        if (!stts) missing.push('stts');
        if (!stsz) missing.push('stsz');
        if (!stsc) missing.push('stsc');
        if (!chunks) missing.push('stco/co64');
        if (missing.length) { bad('tabel ' + missing.join('/') + ' tidak ada / terpotong'); return T; }
        if (stts.truncated || stsz.truncated || stsc.truncated || chunks.truncated) bad('isi tabel sample terpotong');

        T.sttsSamples = stts.samples; T.sttsDuration = stts.duration;
        T.samples = stsz.count; T.chunks = chunks.count;

        // 1) stts vs stsz
        if (stts.samples !== stsz.count) bad('stts ≠ stsz (' + stts.samples + ' vs ' + stsz.count + ' sample)');

        // 2) stsc x stco vs stsz
        let derived = 0, stscOk = true;
        for (let i = 0; i < stsc.n; i++) {
            const first = stsc.first[i];
            const next = i + 1 < stsc.n ? stsc.first[i + 1] : chunks.count + 1;
            if ((i === 0 && first !== 1) || next < first || stsc.spc[i] === 0) { stscOk = false; bad('stsc tidak berurutan / tidak valid'); break; }
            if (first > chunks.count) { stscOk = false; bad('stsc merujuk chunk di luar stco (' + first + ' > ' + chunks.count + ')'); break; }
            derived += (next - first) * stsc.spc[i];
        }
        if (stscOk && derived !== stsz.count) bad('stsc×stco ≠ stsz (' + derived + ' vs ' + stsz.count + ' sample)');

        // 3) mdhd vs stts (durasi)
        if (mdhd && mdhd.timescale && stts.samples > 0) {
            const avg = stts.duration / stts.samples;
            const tol = Math.max(avg * 2, stts.duration * 0.01, 1);
            if (!mdhd.duration) bad('mdhd durasi = 0');
            else if (Math.abs(mdhd.duration - stts.duration) > tol) bad('mdhd ≠ stts (' + mdhd.duration + ' vs ' + stts.duration + ' tick)');
        }

        // 4) tiap chunk harus utuh di dalam mdat
        const mdats = (ctx && ctx.mdats) || [];
        if (stscOk && mdats.length && stsz.count === stts.samples && derived === stsz.count) {
            let s = 0, run = 0, hit = 0;
            for (let c = 1; c <= chunks.count; c++) {
                while (run + 1 < stsc.n && stsc.first[run + 1] <= c) run++;
                const spc = stsc.spc[run];
                let bytes = 0;
                if (stsz.sizes) { for (let k = 0; k < spc; k++) bytes += stsz.sizes[s + k] || 0; }
                else bytes = spc * stsz.uniform;
                s += spc;
                const off = chunks.offsets[c - 1];
                let m = mdats[hit];
                if (!(m && off >= m.start + m.headerSize && off + bytes <= m.start + m.size)) {
                    hit = mdats.findIndex(x => off >= x.start + x.headerSize && off + bytes <= x.start + x.size);
                    if (hit < 0) { hit = 0; bad('chunk ke-' + c + ' (offset ' + off + ', ' + bytes + ' byte) di luar mdat'); break; }
                }
            }
        }
        return T;
    }

    function parseTracks(buf, ctx) {
        const tracks = [];
        const moov = { bodyStart: 8, end: buf.length };
        // moov header bisa 16 byte bila largesize
        const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        if (dv.getUint32(0) === 1) moov.bodyStart = 16;
        for (const trak of iterChildren(buf, moov.bodyStart, moov.end)) {
            if (trak.type !== 'trak') continue;
            const mdia = findChild(buf, trak, 'mdia');
            if (!mdia) continue;
            const hdlr = findChild(buf, mdia, 'hdlr');
            const handler = hdlr ? fourcc(dv, hdlr.bodyStart + 8) : '';
            const minf = findChild(buf, mdia, 'minf');
            const stbl = minf && findChild(buf, minf, 'stbl');
            const stsd = stbl && findChild(buf, stbl, 'stsd');
            const tables = (stbl && (handler === 'vide' || handler === 'soun')) ? analyzeTables(buf, dv, mdia, stbl, ctx) : null;
            if (!stsd) { tracks.push({ handler, tables }); continue; }
            // stsd: FullBox(4) + entry_count(4) lalu sample entry pertama
            const first = iterChildren(buf, stsd.bodyStart + 8, stsd.end).next().value;
            const t = { handler, codec: first ? first.type : null, tables };
            if (first && handler === 'vide') {
                Object.assign(t, parseVideoEntry(buf, first));
                t.fps = readFps(dv, findChild(buf, mdia, 'mdhd'), findChild(buf, stbl, 'stts'));
            }
            if (first && handler === 'soun') {
                if (first.type === 'Opus') Object.assign(t, { audioProfile: 'Opus', isOpus: true });
                else Object.assign(t, parseAudioEntry(buf, first));
            }
            tracks.push(t);
        }
        return tracks;
    }

    // ------------------------------------------- EBML (MKV / WebM) parser ringan
    // Hanya membaca elemen Tracks di awal file untuk mengenali codec (VP9 / AV1 / Opus / dst).
    function ebmlId(b, p) {
        const first = b[p];
        if (first === undefined) return null;
        let len = 1, mask = 0x80;
        while (len <= 4 && !(first & mask)) { len++; mask >>= 1; }
        if (len > 4 || p + len > b.length) return null;
        let id = 0;
        for (let i = 0; i < len; i++) id = id * 256 + b[p + i];
        return { id, len };
    }

    function ebmlSize(b, p) {
        const first = b[p];
        if (first === undefined) return null;
        let len = 1, mask = 0x80;
        while (len <= 8 && !(first & mask)) { len++; mask >>= 1; }
        if (len > 8 || p + len > b.length) return null;
        let val = first & (mask - 1);
        let allOnes = val === (mask - 1);
        for (let i = 1; i < len; i++) {
            val = val * 256 + b[p + i];
            if (b[p + i] !== 0xFF) allOnes = false;
        }
        return { size: allOnes ? -1 : val, len };
    }

    // Jalankan fn(id, dataStart, dataEnd) untuk tiap elemen anak; fn return true = berhenti.
    function ebmlWalk(b, start, end, fn) {
        let p = start;
        while (p < end) {
            const id = ebmlId(b, p);
            if (!id) return false;
            const sz = ebmlSize(b, p + id.len);
            if (!sz) return false;
            const dataStart = p + id.len + sz.len;
            const dataEnd = sz.size < 0 ? end : Math.min(end, dataStart + sz.size);
            if (fn(id.id, dataStart, dataEnd)) return true;
            p = dataEnd;
        }
        return false;
    }

    function ebmlUint(b, s, e) { let v = 0; for (let i = s; i < e; i++) v = v * 256 + b[i]; return v; }
    function ebmlStr(b, s, e) { let r = ''; for (let i = s; i < e && b[i] !== 0; i++) r += String.fromCharCode(b[i]); return r; }

    const MKV_VIDEO_CODECS = { 'V_VP9': 'VP9', 'V_VP8': 'VP8', 'V_AV1': 'AV1', 'V_MPEG4/ISO/AVC': 'H.264', 'V_MPEGH/ISO/HEVC': 'HEVC', 'V_MPEG4/ISO/ASP': 'MPEG-4', 'V_MPEG4/ISO/SP': 'MPEG-4', 'V_MPEG4/ISO/AP': 'MPEG-4' };
    const MKV_AUDIO_CODECS = { 'A_OPUS': 'Opus', 'A_VORBIS': 'Vorbis', 'A_FLAC': 'FLAC', 'A_AC3': 'AC-3', 'A_EAC3': 'E-AC-3', 'A_MPEG/L3': 'MP3' };
    // Codec yang bisa dikemas ulang ke MP4 lewat stream-copy (muxer MP4 FFmpeg)
    const MP4_COPY_VIDEO = ['H.264', 'HEVC', 'MPEG-4', 'VP9', 'AV1'];
    const MP4_COPY_AUDIO = ['AAC', 'AAC-LC', 'HE-AAC', 'HE-AAC v2', 'Opus', 'MP3', 'AC-3', 'E-AC-3', 'FLAC'];

    function parseMatroska(b) {
        const out = { docType: null, tracks: [] };
        ebmlWalk(b, 0, b.length, (id, s, e) => {
            if (id === 0x1A45DFA3) { // EBML header
                ebmlWalk(b, s, e, (cid, cs, ce) => { if (cid === 0x4282) out.docType = ebmlStr(b, cs, ce); });
            } else if (id === 0x18538067) { // Segment
                return ebmlWalk(b, s, e, (sid, ss, se) => {
                    if (sid !== 0x1654AE6B) return false; // Tracks
                    ebmlWalk(b, ss, se, (tid, ts, te) => {
                        if (tid !== 0xAE) return false; // TrackEntry
                        const tr = { type: 0, codecId: '', width: 0, height: 0 };
                        ebmlWalk(b, ts, te, (eid, es, ee) => {
                            if (eid === 0x83) tr.type = ebmlUint(b, es, ee);
                            else if (eid === 0x86) tr.codecId = ebmlStr(b, es, ee);
                            else if (eid === 0xE0) ebmlWalk(b, es, ee, (vid, vs, ve) => {
                                if (vid === 0xB0) tr.width = ebmlUint(b, vs, ve);
                                else if (vid === 0xBA) tr.height = ebmlUint(b, vs, ve);
                            });
                        });
                        out.tracks.push(tr);
                    });
                    return true; // Tracks sudah dibaca
                });
            }
            return false;
        });
        return out;
    }

    // Deteksi container dari ISI file (magic bytes), ekstensi hanya cadangan.
    async function sniffContainer(file) {
        const ext = getExt(file.name);
        const head = await readRange(file, 0, Math.min(file.size, 16));
        if (head.length >= 4 && head[0] === 0x1A && head[1] === 0x45 && head[2] === 0xDF && head[3] === 0xA3) return 'matroska';
        if (head.length >= 8 && String.fromCharCode(head[4], head[5], head[6], head[7]) === 'ftyp') return 'mp4';
        if (MP4_FAMILY_EXTS.includes(ext)) return 'mp4';
        if (ext === '.webm' || file.type === 'video/webm') return 'webm';
        if (ext === '.mkv' || file.type === 'video/x-matroska') return 'mkv';
        return 'unknown';
    }

    // --------------------------------------------------------- inspect()
    async function inspect(file, opts) {
        // Compatible Old Devices = OTOMATIS per file (MP4 family -> ON, MKV/WebM -> OFF).
        // opts.compatibleOldDevices === false hanya bila fitur dimatikan total dari luar.
        const featureOn = !opts || opts.compatibleOldDevices !== false;
        const result = {
            fileName: file.name, size: file.size, ext: getExt(file.name),
            isVideoExt: VIDEO_EXTS.includes(getExt(file.name)),
            container: 'unknown',       // mp4 | webm | mkv | unknown (hasil sniff isi file)
            audioOnly: false,           // .m4a: hanya track audio
            isMp4Family: false, brand: null,
            moovAtEnd: false, fragmented: false,
            video: null, audio: null,
            colorProfile: 'SDR', bitDepth: 8,
            issues: [],                 // masalah struktur nyata (file rusak / tidak bisa dibaca)
            warnings: [],               // dipertahankan untuk kompatibilitas, tidak lagi diisi saran perangkat lama
            notes: [],                  // info netral (bukan peringatan)
            needsPatch: false, patchable: false, compatible: false,
            remuxable: true,            // false bila codec tidak bisa di-stream-copy ke MP4
            compat: { on: false, auto: true, reason: '' },
            compatibleOldDevices: false, // alias dari compat.on
            oldDeviceOk: true, videoTag: null,
            tables: null,               // ringkasan tabel sample { video, audio } (mdhd/stts/stsz/stsc/stco)
            tablesOk: true,             // false bila tabel sample tidak konsisten
            tableProblems: [],
            needsRebuild: false,        // true -> tabel harus dibangun ulang (remux FFmpeg), bukan sekadar dipatch
            _layout: null
        };

        const sniffed = await sniffContainer(file);
        if (sniffed === 'unknown' && !result.isVideoExt) {
            result.issues.push('Ekstensi file bukan video yang didukung (.mp4/.m4v/.mov/.3gp/.m4a/.webm/.mkv).');
            return result;
        }

        // ---------------- MKV / WebM ----------------
        if (sniffed === 'matroska' || sniffed === 'webm' || sniffed === 'mkv') {
            const buf = await readRange(file, 0, Math.min(file.size, 4 * 1024 * 1024));
            const mk = parseMatroska(buf);
            result.container = (mk.docType === 'webm' || (sniffed === 'webm')) ? 'webm' : 'mkv';
            const vt = mk.tracks.find(t => t.type === 1);
            const at = mk.tracks.find(t => t.type === 2);
            if (vt) result.video = { codec: MKV_VIDEO_CODECS[vt.codecId] || vt.codecId || '?', fourcc: null, bitDepth: null, width: vt.width, height: vt.height, fps: null };
            if (at) result.audio = { codec: MKV_AUDIO_CODECS[at.codecId] || (/^A_AAC/.test(at.codecId || '') ? 'AAC' : (at.codecId || '?')), objectType: null, heAac: false };
            result.compat = { on: false, auto: true, reason: result.container };
            result.compatibleOldDevices = false;
            if (mk.tracks.length) {
                result.remuxable = (!result.video || MP4_COPY_VIDEO.includes(result.video.codec)) &&
                                   (!result.audio || MP4_COPY_AUDIO.includes(result.audio.codec));
            }
            result.notes.push(result.remuxable
                ? `Container ${result.container.toUpperCase()} terdeteksi — dikemas ke MP4 via stream-copy, tanpa re-encode.`
                : `Container ${result.container.toUpperCase()} (${result.video ? result.video.codec : '?'} + ${result.audio ? result.audio.codec : 'no audio'}) tidak bisa dikemas ke MP4 tanpa re-encode — file asli dipakai.`);
            result.compatible = true;
            return result;
        }

        // ---------------- MP4 family ----------------
        const { boxes, endPos } = await scanTopLevel(file);
        const ftyp = boxes.find(b => b.type === 'ftyp');
        const moov = boxes.find(b => b.type === 'moov');
        const mdats = boxes.filter(b => b.type === 'mdat');

        if (!ftyp || !moov || !mdats.length) {
            result.issues.push('Struktur MP4 tidak valid (ftyp/moov/mdat tidak lengkap).');
            return result;
        }
        result.container = 'mp4';
        result.isMp4Family = true;
        const ftypBuf = await readRange(file, ftyp.start + ftyp.headerSize, ftyp.start + Math.min(ftyp.size, ftyp.headerSize + 4));
        result.brand = String.fromCharCode(...ftypBuf);
        result.fragmented = boxes.some(b => b.type === 'moof');
        result.moovAtEnd = moov.start > mdats[0].start;

        // Compatible Old Devices: container MP4 -> ON otomatis
        result.compat = { on: featureOn, auto: true, reason: 'mp4' };
        result.compatibleOldDevices = featureOn;

        if (moov.size > MAX_MOOV_BYTES) {
            result.issues.push('Box moov terlalu besar untuk diproses di browser.');
            return result;
        }
        const moovBuf = await readRange(file, moov.start, moov.start + moov.size);
        const tracks = parseTracks(moovBuf, { mdats, fragmented: result.fragmented });
        const v = tracks.find(t => t.handler === 'vide');
        const a = tracks.find(t => t.handler === 'soun');

        if (!v) {
            if (AUDIO_ONLY_EXTS.includes(result.ext) && a) result.audioOnly = true;
            else result.issues.push('Track video tidak ditemukan.');
        }
        else {
            // Codec apa pun diteruskan apa adanya (stream-copy); yang dikenali diberi nama.
            result.video = { codec: VIDEO_FOURCC[v.codec] || String(v.codec || '?'), fourcc: v.codec, bitDepth: v.bitDepth, width: v.width || null, height: v.height || null, fps: v.fps || null };
            if (v.tables) Object.assign(result.video, { samples: v.tables.samples, timescale: v.tables.timescale, durationSec: v.tables.durationSec });
        }

        if (!a) result.notes.push('Tidak ada track audio.');
        else if (a.isOpus) result.audio = { codec: 'Opus', objectType: null, heAac: false };
        else if (a.codec === 'mp4a' && (a.aacObjectType === null || AAC_OTIS.includes(a.aacObjectType)))
            result.audio = {
                codec: a.audioProfile || 'AAC',   // AAC-LC / HE-AAC / HE-AAC v2
                objectType: a.audioObjectType,
                heAac: !!a.audioProfile && a.audioProfile.startsWith('HE-AAC')
            };
        else result.audio = { codec: String(a.codec || '?'), objectType: null, heAac: false };

        if (result.audio && a && a.tables) Object.assign(result.audio, { samples: a.tables.samples, timescale: a.tables.timescale, durationSec: a.tables.durationSec });

        // Tabel sample (mdhd / stts / stsz / stsc / stco): harus saling cocok.
        result.tables = { video: v && v.tables || null, audio: a && a.tables || null };
        tracks.forEach((t, i) => {
            if (!t.tables || (t.handler !== 'vide' && t.handler !== 'soun')) return;
            const label = (t.handler === 'vide' ? 'video' : 'audio') + (tracks.filter(x => x.handler === t.handler).length > 1 ? '#' + (tracks.filter(x => x.handler === t.handler).indexOf(t) + 1) : '');
            t.tables.problems.forEach(p => result.tableProblems.push(label + ': ' + p));
        });
        result.tablesOk = result.tableProblems.length === 0;
        result.needsRebuild = !result.tablesOk;

        if (v) {
            result.bitDepth = v.bitDepth || 8;
            if (v.dolbyVision) result.colorProfile = 'Dolby Vision';
            else if (v.transfer === 16) result.colorProfile = 'HDR10 / PQ (BT.2020)';
            else if (v.transfer === 18) result.colorProfile = 'HLG (BT.2020)';
            else if (v.primaries === 9) result.colorProfile = 'BT.2020 (SDR)';
        }
        if (result.audioOnly) result.notes.push('File audio-only (.m4a): tidak ada track video.');

        // Tag sample entry yang aman untuk perangkat lama (hanya bila Compatible ON).
        // VP9 / AV1 / Opus tidak punya tag alternatif: dibiarkan apa adanya.
        if (result.compat.on && result.video) {
            if (result.video.fourcc === 'avc1' || result.video.fourcc === 'avc3') result.videoTag = 'avc1';
            else if (result.video.fourcc === 'hvc1' || result.video.fourcc === 'hev1') result.videoTag = 'hvc1';
        }

        result.needsPatch = result.moovAtEnd;
        // Tabel sample rusak tidak ditambal; pipeline upload memakai file apa adanya (tanpa remux).
        result.patchable = result.moovAtEnd && !result.fragmented && !boxes.some(b => b.truncated) && result.tablesOk;
        if (result.fragmented) result.notes.push('Fragmented MP4 (moof): layout asli dibiarkan.');
        result.compatible = result.issues.length === 0;
        result._layout = { boxes, endPos, ftyp, moov };
        return result;
    }

    // Bandingkan tabel sample file asli vs hasil proses (stream-copy: jumlah sample & durasi harus sama).
    function compareTables(src, out) {
        const probs = [];
        if (!src || !out) return probs;
        for (const k of ['video', 'audio']) {
            const a = src.tables && src.tables[k];
            const b = out.tables && out.tables[k];
            if (!a || a.skipped || a.samples === null) continue;
            if (!b || b.skipped) { probs.push(k + ': track hilang di hasil'); continue; }
            if (a.samples !== b.samples) { probs.push(k + ': jumlah sample berubah (' + a.samples + ' → ' + b.samples + ')'); continue; }
            if (a.durationSec !== null && b.durationSec !== null && Math.abs(a.durationSec - b.durationSec) > Math.max(0.1, a.durationSec * 0.01)) {
                probs.push(k + ': durasi mdhd berubah (' + a.durationSec + ' s → ' + b.durationSec + ' s)');
            }
        }
        return probs;
    }

    // ------------------------------------------- stco/co64 offset recalculation
    // Semua offset yang menunjuk ke data SETELAH posisi lama moov maupun sebelum
    // (mdat sebelum moov) bergeser +moovSize karena moov dipindah ke depan mdat.
    function shiftChunkOffsets(moovBuf, oldMoovStart, moovSize) {
        const dv = new DataView(moovBuf.buffer, moovBuf.byteOffset, moovBuf.byteLength);
        let tablesPatched = 0, entriesPatched = 0;
        const moovHs = dv.getUint32(0) === 1 ? 16 : 8;

        const walk = (start, end) => {
            for (const b of iterChildren(moovBuf, start, end)) {
                if (b.type === 'stco' || b.type === 'co64') {
                    const is64 = b.type === 'co64';
                    const count = dv.getUint32(b.bodyStart + 4);
                    let p = b.bodyStart + 8;
                    for (let i = 0; i < count; i++) {
                        if (is64) {
                            const old = dv.getBigUint64(p);
                            const nu = old < BigInt(oldMoovStart) ? old + BigInt(moovSize) : old;
                            dv.setBigUint64(p, nu);
                            p += 8;
                        } else {
                            const old = dv.getUint32(p);
                            const nu = old < oldMoovStart ? old + moovSize : old;
                            if (nu > 0xFFFFFFFF) throw new Error('Offset stco melebihi 4GB (butuh upgrade ke co64).');
                            dv.setUint32(p, nu);
                            p += 4;
                        }
                        entriesPatched++;
                    }
                    tablesPatched++;
                } else if (CONTAINER_BOXES.has(b.type)) {
                    walk(b.bodyStart, b.end);
                }
            }
        };
        walk(moovHs, moovBuf.length);
        return { tablesPatched, entriesPatched };
    }

    // Ambil offset chunk pertama tiap track (untuk verifikasi)
    function firstChunkOffsets(moovBuf) {
        const dv = new DataView(moovBuf.buffer, moovBuf.byteOffset, moovBuf.byteLength);
        const out = [];
        const moovHs = dv.getUint32(0) === 1 ? 16 : 8;
        const walk = (start, end) => {
            for (const b of iterChildren(moovBuf, start, end)) {
                if (b.type === 'stco' || b.type === 'co64') {
                    const count = dv.getUint32(b.bodyStart + 4);
                    if (count > 0) {
                        out.push(b.type === 'co64'
                            ? Number(dv.getBigUint64(b.bodyStart + 8))
                            : dv.getUint32(b.bodyStart + 8));
                    }
                } else if (CONTAINER_BOXES.has(b.type)) walk(b.bodyStart, b.end);
            }
        };
        walk(moovHs, moovBuf.length);
        return out;
    }

    // ------------------------------------------------------------- patch()
    async function patch(file, inspected) {
        const info = inspected || await inspect(file);
        if (!info.patchable) throw new Error('File tidak memerlukan / tidak bisa dipatch.');
        const { boxes, endPos, ftyp, moov } = info._layout;

        const moovBuf = await readRange(file, moov.start, moov.start + moov.size);
        const stats = shiftChunkOffsets(moovBuf, moov.start, moov.size);
        if (!stats.tablesPatched) throw new Error('Tabel stco/co64 tidak ditemukan.');

        // Susun ulang: ftyp -> moov -> sisa box (urutan asli, tanpa moov lama)
        const parts = [file.slice(ftyp.start, ftyp.start + ftyp.size), moovBuf];
        for (const b of boxes) {
            if (b === ftyp || b === moov) continue;
            parts.push(file.slice(b.start, b.start + b.size));
        }
        if (endPos < file.size) parts.push(file.slice(endPos, file.size)); // sisa byte (jika ada)

        const isM4a = info.audioOnly || AUDIO_ONLY_EXTS.includes(info.ext);
        const out = new File(parts, patchedName(file.name, isM4a), { type: isM4a ? 'audio/mp4' : 'video/mp4', lastModified: file.lastModified || Date.now() });

        // ---- verifikasi ----
        const checks = { sizeIdentical: out.size === file.size, mdatByteIdentical: true, chunkOffsetsValid: true };
        const verify = await scanTopLevel(out);
        const newMoov = verify.boxes.find(b => b.type === 'moov');
        const newMdats = verify.boxes.filter(b => b.type === 'mdat');
        checks.moovBeforeMdat = !!newMoov && newMdats.length > 0 && newMoov.start < newMdats[0].start;

        // mdat harus identik: bandingkan ukuran + sampel byte awal/akhir tiap mdat
        const oldMdats = boxes.filter(b => b.type === 'mdat');
        if (oldMdats.length !== newMdats.length) checks.mdatByteIdentical = false;
        else {
            for (let i = 0; i < oldMdats.length; i++) {
                const o = oldMdats[i], n = newMdats[i];
                if (o.size !== n.size) { checks.mdatByteIdentical = false; break; }
                const probe = Math.min(o.size, 1024 * 1024);
                const [a1, b1, a2, b2] = await Promise.all([
                    readRange(file, o.start, o.start + probe), readRange(out, n.start, n.start + probe),
                    readRange(file, o.start + o.size - probe, o.start + o.size), readRange(out, n.start + n.size - probe, n.start + n.size)
                ]);
                const eq = (x, y) => x.length === y.length && x.every((v, k) => v === y[k]);
                if (!eq(a1, b1) || !eq(a2, b2)) { checks.mdatByteIdentical = false; break; }
            }
        }

        // offset chunk pertama tiap track harus jatuh di dalam salah satu mdat baru
        const newMoovBuf = await readRange(out, newMoov.start, newMoov.start + newMoov.size);
        for (const off of firstChunkOffsets(newMoovBuf)) {
            if (!newMdats.some(m => off >= m.start + m.headerSize && off < m.start + m.size)) {
                checks.chunkOffsetsValid = false; break;
            }
        }

        // tabel sample hasil patch: mdhd/stts/stsz/stsc/stco konsisten, tiap chunk di dalam mdat, sample & durasi sama dengan aslinya
        const post = await inspect(out);
        checks.sampleTablesValid = post.tablesOk;
        checks.sampleTablesSame = compareTables(info, post).length === 0;

        const ok = checks.sizeIdentical && checks.mdatByteIdentical && checks.moovBeforeMdat && checks.chunkOffsetsValid &&
            checks.sampleTablesValid && checks.sampleTablesSame;
        if (!ok) throw new Error('Verifikasi hasil patch gagal: ' + JSON.stringify(checks));
        return { file: out, stats, checks };
    }

    // ------------------------------------------------------- rewriteBrands()
    // Tulis ulang ftyp: major brand mp42, minor 0, compatible brands digabung
    // (isom, iso2, avc1, mp41 + brand asli). Panjang ftyp berubah -> semua offset
    // stco/co64 digeser sebesar delta. Isi mdat tidak disentuh (byte identik).
    const EXTRA_BRANDS = ['isom', 'iso2', 'avc1', 'mp41'];

    function shiftAllOffsets(moovBuf, delta) {
        const dv = new DataView(moovBuf.buffer, moovBuf.byteOffset, moovBuf.byteLength);
        let entries = 0;
        const moovHs = dv.getUint32(0) === 1 ? 16 : 8;
        const walk = (start, end) => {
            for (const b of iterChildren(moovBuf, start, end)) {
                if (b.type === 'stco' || b.type === 'co64') {
                    const is64 = b.type === 'co64';
                    const count = dv.getUint32(b.bodyStart + 4);
                    let p = b.bodyStart + 8;
                    for (let i = 0; i < count; i++) {
                        if (is64) { dv.setBigUint64(p, dv.getBigUint64(p) + BigInt(delta)); p += 8; }
                        else {
                            const nu = dv.getUint32(p) + delta;
                            if (nu > 0xFFFFFFFF) throw new Error('Offset stco melebihi 4GB (butuh co64).');
                            dv.setUint32(p, nu); p += 4;
                        }
                        entries++;
                    }
                } else if (CONTAINER_BOXES.has(b.type)) walk(b.bodyStart, b.end);
            }
        };
        walk(moovHs, moovBuf.length);
        return entries;
    }

    async function rewriteBrands(file) {
        const { boxes, endPos } = await scanTopLevel(file);
        const ftyp = boxes.find(b => b.type === 'ftyp');
        const moov = boxes.find(b => b.type === 'moov');
        if (!ftyp || !moov) throw new Error('ftyp/moov tidak ditemukan.');

        const oldBuf = await readRange(file, ftyp.start, ftyp.start + ftyp.size);
        const od = new DataView(oldBuf.buffer, oldBuf.byteOffset, oldBuf.byteLength);
        const brands = [...EXTRA_BRANDS];
        for (let p = 16; p + 4 <= oldBuf.length; p += 4) {
            const b = fourcc(od, p);
            if (b !== 'mp42' && !brands.includes(b)) brands.push(b);
        }
        const nf = new Uint8Array(16 + brands.length * 4);
        const nd = new DataView(nf.buffer);
        const put = (o, str) => { for (let i = 0; i < 4; i++) nf[o + i] = str.charCodeAt(i); };
        nd.setUint32(0, nf.length); put(4, 'ftyp'); put(8, 'mp42'); nd.setUint32(12, 0);
        brands.forEach((b, i) => put(16 + i * 4, b));

        const delta = nf.length - ftyp.size;
        const moovBuf = await readRange(file, moov.start, moov.start + moov.size);
        const entries = delta ? shiftAllOffsets(moovBuf, delta) : 0;

        const parts = [];
        for (const b of boxes) {
            if (b === ftyp) parts.push(nf);
            else if (b === moov) parts.push(moovBuf);
            else parts.push(file.slice(b.start, b.start + b.size));
        }
        if (endPos < file.size) parts.push(file.slice(endPos, file.size));
        const out = new File(parts, file.name, { type: file.type || 'video/mp4', lastModified: file.lastModified || Date.now() });
        return { file: out, stats: { brands, delta, entriesShifted: entries } };
    }

    // ------------------------------------------------------------ setEncoderTag()
    // Tulis tag encoder ala FFmpeg (©too) ke moov/udta/meta/ilst. Idempoten: bila nilainya sudah sama,
    // file dikembalikan apa adanya. Hanya MP4 non-fragmented. mdat byte-identik; offset chunk digeser.
    const ENCODER_TAG = 'Lavf63.1.102'; // sama dengan ident FFmpeg WASM bawaan (hasil remux menulis nilai ini)

    function boxBytes(type, ...parts) {
        let len = 8; for (const p of parts) len += p.length;
        const out = new Uint8Array(len);
        new DataView(out.buffer).setUint32(0, len);
        for (let i = 0; i < 4; i++) out[4 + i] = typeof type === 'string' ? type.charCodeAt(i) : type[i];
        let o = 8; for (const p of parts) { out.set(p, o); o += p.length; }
        return out;
    }
    function u32b(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0); return b; }
    function cat(parts) {
        let n = 0; for (const p of parts) n += p.length;
        const o = new Uint8Array(n); let q = 0; for (const p of parts) { o.set(p, q); q += p.length; }
        return o;
    }
    function ilstItemToo(tag) {
        const text = new TextEncoder().encode(tag);
        return boxBytes([0xA9, 0x74, 0x6F, 0x6F], boxBytes('data', u32b(1), u32b(0), text));
    }
    function isToo(k, buf) { return buf[k.start + 4] === 0xA9 && buf[k.start + 5] === 0x74 && buf[k.start + 6] === 0x6F && buf[k.start + 7] === 0x6F; }

    // Kembalikan { meta: Uint8Array, same: bool } atau null bila meta tidak dikenali (mis. mdta berbasis keys).
    function rebuildMeta(buf, meta, tag) {
        const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const full = meta.bodyStart + 8 <= meta.end && fourcc(dv, meta.bodyStart + 8) === 'hdlr'; // FullBox (ISO)
        const qt = !full && meta.bodyStart + 4 <= meta.end && fourcc(dv, meta.bodyStart + 4) === 'hdlr'; // QuickTime
        if (!full && !qt) return null;
        const head = full ? buf.slice(meta.bodyStart, meta.bodyStart + 4) : new Uint8Array(0);
        const kids = [];
        let sawIlst = false, hdlrOk = false, same = false;
        for (const k of iterChildren(buf, meta.bodyStart + head.length, meta.end)) {
            if (k.type === 'hdlr') {
                const sub = fourcc(dv, k.bodyStart + 8);
                if (sub !== 'mdir') return null; // mdta/keys: indeks bukan fourcc, jangan disentuh
                hdlrOk = true; kids.push(buf.slice(k.start, k.end));
            } else if (k.type === 'ilst') {
                sawIlst = true;
                const items = [];
                for (const it of iterChildren(buf, k.bodyStart, k.end)) {
                    if (isToo(it, buf)) {
                        const d = findChild(buf, it, 'data');
                        if (d && d.end - d.bodyStart >= 8) {
                            const cur = new TextDecoder().decode(buf.subarray(d.bodyStart + 8, d.end)).replace(/\0+$/, '');
                            if (cur === tag) same = true;
                        }
                    } else items.push(buf.slice(it.start, it.end));
                }
                items.push(ilstItemToo(tag));
                kids.push(boxBytes('ilst', ...items));
            } else kids.push(buf.slice(k.start, k.end));
        }
        if (!hdlrOk) kids.unshift(boxBytes('hdlr', u32b(0), u32b(0), new TextEncoder().encode('mdir'), new TextEncoder().encode('appl'), new Uint8Array(9)));
        if (!sawIlst) kids.push(boxBytes('ilst', ilstItemToo(tag)));
        return { meta: boxBytes('meta', head, ...kids), same: same && sawIlst };
    }

    // Moov baru dengan ©too = tag. Mengembalikan null bila sudah sama / tidak aman diubah.
    function moovWithEncoderTag(moovBuf, tag) {
        const dv = new DataView(moovBuf.buffer, moovBuf.byteOffset, moovBuf.byteLength);
        const hs = dv.getUint32(0) === 1 ? 16 : 8;
        const kids = [];
        let sawUdta = false, noChange = false;
        for (const k of iterChildren(moovBuf, hs, moovBuf.length)) {
            if (k.type !== 'udta') { kids.push(moovBuf.slice(k.start, k.end)); continue; }
            sawUdta = true;
            const uk = [];
            let sawMeta = false;
            for (const u of iterChildren(moovBuf, k.bodyStart, k.end)) {
                if (u.type !== 'meta') { uk.push(moovBuf.slice(u.start, u.end)); continue; }
                const r = rebuildMeta(moovBuf, u, tag);
                if (!r) throw new Error('meta udta tidak dikenali (bukan mdir) — tag encoder dilewati.');
                sawMeta = true; noChange = r.same; uk.push(r.meta);
            }
            if (!sawMeta) uk.push(boxBytes('meta', new Uint8Array(4),
                boxBytes('hdlr', u32b(0), u32b(0), new TextEncoder().encode('mdir'), new TextEncoder().encode('appl'), new Uint8Array(9)),
                boxBytes('ilst', ilstItemToo(tag))));
            kids.push(boxBytes('udta', ...uk));
        }
        if (!sawUdta) kids.push(boxBytes('udta', boxBytes('meta', new Uint8Array(4),
            boxBytes('hdlr', u32b(0), u32b(0), new TextEncoder().encode('mdir'), new TextEncoder().encode('appl'), new Uint8Array(9)),
            boxBytes('ilst', ilstItemToo(tag)))));
        if (noChange) return null;
        return boxBytes('moov', ...kids);
    }

    // Geser semua offset chunk yang menunjuk ke data SETELAH akhir moov lama sebesar delta.
    function shiftOffsetsAfter(moovBuf, threshold, delta) {
        const dv = new DataView(moovBuf.buffer, moovBuf.byteOffset, moovBuf.byteLength);
        const walk = (start, end) => {
            for (const b of iterChildren(moovBuf, start, end)) {
                if (b.type === 'stco' || b.type === 'co64') {
                    const is64 = b.type === 'co64';
                    const count = dv.getUint32(b.bodyStart + 4);
                    let p = b.bodyStart + 8;
                    for (let i = 0; i < count; i++) {
                        if (is64) { const o = dv.getBigUint64(p); if (o >= BigInt(threshold)) dv.setBigUint64(p, o + BigInt(delta)); p += 8; }
                        else {
                            const o = dv.getUint32(p);
                            if (o >= threshold) { const nu = o + delta; if (nu > 0xFFFFFFFF) throw new Error('Offset stco melebihi 4GB (butuh co64).'); dv.setUint32(p, nu); }
                            p += 4;
                        }
                    }
                } else if (CONTAINER_BOXES.has(b.type)) walk(b.bodyStart, b.end);
            }
        };
        walk(dv.getUint32(0) === 1 ? 16 : 8, moovBuf.length);
    }

    async function setEncoderTag(file, tag) {
        tag = tag || ENCODER_TAG;
        const { boxes, endPos } = await scanTopLevel(file);
        if (boxes.some(b => b.type === 'moof')) return { file, changed: false, reason: 'fragmented' };
        if (boxes.some(b => b.truncated)) throw new Error('Struktur MP4 terpotong.');
        const moov = boxes.find(b => b.type === 'moov');
        if (!moov || !boxes.some(b => b.type === 'mdat')) throw new Error('moov/mdat tidak ditemukan.');
        if (moov.size > MAX_MOOV_BYTES) throw new Error('Box moov terlalu besar.');
        const oldMoov = await readRange(file, moov.start, moov.start + moov.size);
        const nb = moovWithEncoderTag(oldMoov, tag);
        if (!nb) return { file, changed: false, reason: 'sudah sama' };
        const delta = nb.length - moov.size;
        if (delta) shiftOffsetsAfter(nb, moov.start + moov.size, delta);
        const parts = [];
        for (const b of boxes) parts.push(b === moov ? nb : file.slice(b.start, b.start + b.size));
        if (endPos < file.size) parts.push(file.slice(endPos, file.size));
        const out = new File(parts, file.name, { type: file.type || 'video/mp4', lastModified: file.lastModified || Date.now() });
        return { file: out, changed: true, stats: { tag, delta } };
    }

    global.KuroMp4 = { setEncoderTag, ENCODER_TAG, compareTables, VIDEO_EXTS, isVideoFile, isAudioOnlyFile, parseAudioSpecificConfig, getExt, inspect, patch, rewriteBrands, sniffContainer, patchedName, DEFAULT_COMPATIBLE_OLD_DEVICES: true };
    if (typeof module !== 'undefined' && module.exports) module.exports = global.KuroMp4;

})(typeof self !== 'undefined' ? self : globalThis);


// ============================================================================
/* Kuro FastStart — mesin patch container (stream-copy, tanpa re-encode). */
'use strict';
/*
 * Kuro FastStart Patch.
 *
 * Teknik:
 *  - Susunan file jadi "fast start" klasik: ftyp, moov, spacer `free` kecil, lalu mdat
 *    (moov dipindah SEBELUM data media).
 *  - Timestamp pembuatan/modifikasi (mvhd / tkhd / mdhd) dinolkan, field compressorname
 *    pada sample entry video dikosongkan (sisa nama encoder/perangkat dari ekspor asli).
 *  - Timescale film (mvhd) dibulatkan ke 1000; durasi tkhd + semua entri elst yang
 *    memakai timescale film ikut diskalakan proporsional.
 *  - Semua offset chunk (stco/co64) digeser dengan delta tetap karena moov pindah — tabel
 *    sample tidak ditulis ulang, tidak ada track ditambah / digandakan, tidak ada sample
 *    disisipkan.
 *  - Metadata perangkat di level moov (meta / udta) diganti satu tag udta/meta/ilst.
 *  - VIDEO 100% asli. AUDIO: kodec, channel, sample rate, jumlah sample dan ukuran tiap sample sama
 *    dengan sumber; hanya 4 sample audio paling akhir isinya ditimpa pola filler AAC.
 */
const KuroFastStartEngine = (function () {
  const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta', 'ilst']);
  const TAG_TEXT = 'KuroUploadersHD+++';
  const MOVIE_TIMESCALE = 1000;
  // Pola filler AAC (16 byte) untuk menimpa sample audio paling akhir; panjang tiap sample asli dipertahankan.
  const AUDIO_TAIL_FILLER = Uint8Array.from([
    0xa0, 0x98, 0x00, 0x40, 0x01, 0x28, 0x00, 0x64, 0x00, 0x00, 0x03, 0x50, 0x00, 0x00, 0x38, 0x00
  ]);
  const AUDIO_TAIL_SAMPLE_COUNT = 4;
  const AUDIO_TAIL_MODE = 'zero'; // 'zero' = 16 byte pola lalu 0x00 ; 'repeat' = pola diulang sampai penuh

  function u16(b, o) { return new DataView(b.buffer, b.byteOffset + o, 2).getUint16(0, false); }
  function u32(b, o) { return new DataView(b.buffer, b.byteOffset + o, 4).getUint32(0, false); }
  function u64(b, o) { return Number(new DataView(b.buffer, b.byteOffset + o, 8).getBigUint64(0, false)); }
  function wU32(b, o, v) { new DataView(b.buffer, b.byteOffset + o, 4).setUint32(0, v >>> 0, false); }
  function wU64(b, o, v) { new DataView(b.buffer, b.byteOffset + o, 8).setBigUint64(0, BigInt(Math.round(v)), false); }
  function typeOf(b, o) { return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]); }
  function setType(b, o, t) { for (let i = 0; i < 4; i++) b[o + i] = t.charCodeAt(i); }
  function concat(parts) {
    let n = 0; for (const p of parts) n += p.length;
    const out = new Uint8Array(n); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  function box(type, payload) {
    const size = 8 + payload.length;
    if (size > 0xffffffff) throw new Error('Kuro FastStart: box ' + type + ' terlalu besar.');
    const out = new Uint8Array(size);
    wU32(out, 0, size); setType(out, 4, type); out.set(payload, 8);
    return out;
  }
  function readHeader(data, offset, limit) {
    if (offset + 8 > limit) return null;
    let size = u32(data, offset);
    const type = typeOf(data, offset + 4);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > limit) throw new Error('Kuro FastStart: box ' + type + ' terpotong.');
      size = u64(data, offset + 8); header = 16;
    } else if (size === 0) size = limit - offset;
    if (size < header || offset + size > limit) throw new Error('Kuro FastStart: box ' + type + ' tidak valid.');
    return { type, offset, size, header, end: offset + size };
  }
  function parseTree(data, start, end) {
    const out = []; let o = start;
    while (o + 8 <= end) {
      const h = readHeader(data, o, end);
      if (!h) break;
      const node = { type: h.type, raw: data.slice(h.offset, h.end), children: null };
      if (CONTAINERS.has(h.type)) node.children = parseTree(data, h.offset + h.header, h.end);
      out.push(node); o = h.end;
    }
    return out;
  }
  function child(n, t) { return n && n.children ? n.children.find(c => c.type === t) || null : null; }
  function path(n, ts) { let c = n; for (const t of ts) { c = child(c, t); if (!c) return null; } return c; }
  function payloadStart(leaf) { return u32(leaf.raw, 0) === 1 ? 16 : 8; }
  function serialize(n) { return n.children ? box(n.type, concat(n.children.map(serialize))) : n.raw; }
  function cloneTree(n) { return { type: n.type, raw: n.raw ? n.raw.slice() : null, children: n.children ? n.children.map(cloneTree) : null }; }
  function tracks(moov) { return moov.children.filter(c => c.type === 'trak'); }
  function handlerOf(trak) {
    const h = path(trak, ['mdia', 'hdlr']);
    if (!h) return '';
    return typeOf(h.raw, payloadStart(h) + 8);
  }

  // ---- header waktu (mvhd / mdhd) + durasi tkhd ----------------------------------------------
  function readTimeHeader(leaf) {
    const p = payloadStart(leaf); const v = leaf.raw[p];
    return v === 1
      ? { width: 8, timescaleOffset: p + 20, durationOffset: p + 24, timescale: u32(leaf.raw, p + 20), duration: u64(leaf.raw, p + 24) }
      : { width: 4, timescaleOffset: p + 12, durationOffset: p + 16, timescale: u32(leaf.raw, p + 12), duration: u32(leaf.raw, p + 16) };
  }
  function readTkhdDuration(tkhd) {
    const p = payloadStart(tkhd); const v = tkhd.raw[p];
    const offset = v === 1 ? p + 28 : p + 20;
    return v === 1 ? { width: 8, offset, duration: u64(tkhd.raw, offset) } : { width: 4, offset, duration: u32(tkhd.raw, offset) };
  }
  function writeSized(raw, offset, width, value) {
    if (width === 8) wU64(raw, offset, value); else wU32(raw, offset, value);
  }

  // Nolkan creation_time / modification_time pada mvhd, tkhd, mdhd.
  function zeroTimestamps(node) {
    if (node.type === 'mvhd' || node.type === 'tkhd' || node.type === 'mdhd') {
      const raw = node.raw.slice();
      const p = payloadStart(node);
      if (raw[p] === 1) { wU64(raw, p + 4, 0); wU64(raw, p + 12, 0); }
      else { wU32(raw, p + 4, 0); wU32(raw, p + 8, 0); }
      node.raw = raw;
      return;
    }
    if (node.children) for (const c of node.children) zeroTimestamps(c);
  }

  // Kosongkan compressorname (32 byte) di sample entry video (avc1 / hvc1 / dll).
  function zeroCompressorName(outMoov) {
    for (const trak of tracks(outMoov)) {
      if (handlerOf(trak) !== 'vide') continue;
      const stsd = path(trak, ['mdia', 'minf', 'stbl', 'stsd']);
      if (!stsd) continue;
      const entryStart = payloadStart(stsd) + 8;          // version/flags(4) + entry_count(4)
      const compressorOffset = entryStart + 8 + 42;       // header entry(8) + 42 byte field visual
      if (compressorOffset + 32 > stsd.raw.byteLength) continue;
      const raw = stsd.raw.slice();
      for (let i = 0; i < 32; i++) raw[compressorOffset + i] = 0;
      stsd.raw = raw;
    }
  }

  // Timescale film -> 1000 (hanya mvhd, tkhd.duration, elst.segment_duration).
  function rescaleMovieTimescale(outMoov, newTimescale) {
    const mvhd = child(outMoov, 'mvhd');
    if (!mvhd) throw new Error('Kuro FastStart: mvhd tidak ditemukan.');
    const info = readTimeHeader(mvhd);
    const oldTimescale = info.timescale;
    if (!oldTimescale || oldTimescale === newTimescale) return;
    const ratio = newTimescale / oldTimescale;

    const mraw = mvhd.raw.slice();
    wU32(mraw, info.timescaleOffset, newTimescale);
    writeSized(mraw, info.durationOffset, info.width, Math.round(info.duration * ratio));
    mvhd.raw = mraw;

    for (const trak of tracks(outMoov)) {
      const tkhd = child(trak, 'tkhd');
      if (tkhd) {
        const d = readTkhdDuration(tkhd);
        const traw = tkhd.raw.slice();
        writeSized(traw, d.offset, d.width, Math.round(d.duration * ratio));
        tkhd.raw = traw;
      }
      const elst = path(trak, ['edts', 'elst']);
      if (elst) {
        const p = payloadStart(elst);
        const version = elst.raw[p];
        const count = u32(elst.raw, p + 4);
        const entryWidth = version === 1 ? 20 : 12;
        const raw = elst.raw.slice();
        for (let i = 0; i < count; i++) {
          const eo = p + 8 + i * entryWidth;
          if (version === 1) wU64(raw, eo, u64(raw, eo) * ratio);
          else wU32(raw, eo, Math.round(u32(raw, eo) * ratio));
        }
        elst.raw = raw;
      }
    }
  }

  // ---- tabel sample ----------------------------------------------------------------------------
  function chunkOffsetNode(trak) {
    const stbl = path(trak, ['mdia', 'minf', 'stbl']);
    if (!stbl) return null;
    return stbl.children.find(c => c.type === 'stco' || c.type === 'co64') || null;
  }
  function readChunkOffsets(trak) {
    const n = chunkOffsetNode(trak);
    if (!n) return null;
    const is64 = n.type === 'co64'; const p = payloadStart(n); const count = u32(n.raw, p + 4);
    const offs = new Array(count); let o = p + 8;
    for (let i = 0; i < count; i++) { offs[i] = is64 ? u64(n.raw, o) : u32(n.raw, o); o += is64 ? 8 : 4; }
    return { is64, offsets: offs };
  }
  function setChunkOffsets(trak, offsets, forceUse64) {
    const stbl = path(trak, ['mdia', 'minf', 'stbl']);
    const idx = stbl.children.findIndex(c => c.type === 'stco' || c.type === 'co64');
    const old = stbl.children[idx];
    const use64 = forceUse64 || offsets.some(v => v > 0xffffffff);
    const step = use64 ? 8 : 4;
    const p = payloadStart(old);
    const payload = new Uint8Array(8 + offsets.length * step);
    payload.set(old.raw.slice(p, p + 4), 0);
    wU32(payload, 4, offsets.length);
    let o = 8;
    for (const v of offsets) { if (use64) wU64(payload, o, v); else wU32(payload, o, v); o += step; }
    const type = use64 ? 'co64' : 'stco';
    stbl.children[idx] = { type, raw: box(type, payload), children: null };
  }
  function readStsz(trak) {
    const n = path(trak, ['mdia', 'minf', 'stbl', 'stsz']);
    if (!n) return null;
    const p = payloadStart(n);
    const defSize = u32(n.raw, p + 4), count = u32(n.raw, p + 8);
    const sizes = new Array(count);
    if (defSize) sizes.fill(defSize);
    else { let o = p + 12; for (let i = 0; i < count; i++, o += 4) sizes[i] = u32(n.raw, o); }
    return sizes;
  }
  function readStsc(trak) {
    const n = path(trak, ['mdia', 'minf', 'stbl', 'stsc']);
    if (!n) return null;
    const p = payloadStart(n); const count = u32(n.raw, p + 4); const rows = [];
    let o = p + 8; for (let i = 0; i < count; i++, o += 12) rows.push([u32(n.raw, o), u32(n.raw, o + 4), u32(n.raw, o + 8)]);
    return rows;
  }
  // [offsetAbsolut, ukuran] tiap sample di file yang memuat track tsb.
  function getSampleSpans(trak) {
    const sizes = readStsz(trak), stsc = readStsc(trak), co = readChunkOffsets(trak);
    if (!sizes || !stsc || !stsc.length || !co) return [];
    const spans = [];
    let idx = 0;
    for (let chunk = 1; chunk <= co.offsets.length && idx < sizes.length; chunk++) {
      let entry = stsc[0];
      for (const e of stsc) if (e[0] <= chunk) entry = e;
      const count = Math.min(entry[1], sizes.length - idx);
      let pos = co.offsets[chunk - 1];
      for (let j = 0; j < count; j++) { const len = sizes[idx++]; spans.push([pos, len]); pos += len; }
    }
    return spans;
  }

  // Timpa N sample audio terakhir di salinan isi mdat (offset relatif terhadap awal isi mdat).
  function overwriteAudioTail(payload, audioTrak, mdatContentStart, count) {
    const spans = getSampleSpans(audioTrak);
    const n = Math.min(count, spans.length);
    for (let i = spans.length - n; i < spans.length; i++) {
      const rel = spans[i][0] - mdatContentStart, size = spans[i][1];
      if (rel < 0 || rel + size > payload.length) throw new Error('Kuro FastStart: sample audio akhir di luar mdat.');
      for (let b = 0; b < size; b++) {
        payload[rel + b] = AUDIO_TAIL_MODE === 'repeat'
          ? AUDIO_TAIL_FILLER[b % AUDIO_TAIL_FILLER.length]
          : (b < AUDIO_TAIL_FILLER.length ? AUDIO_TAIL_FILLER[b] : 0);
      }
    }
    return n;
  }

  // ---- tag metadata -------------------------------------------------------------------------------
  function makeDataAtom(text) {
    const utf8 = new TextEncoder().encode(text);
    const payload = new Uint8Array(8 + utf8.byteLength);
    wU32(payload, 0, 1); wU32(payload, 4, 0); payload.set(utf8, 8);
    return box('data', payload);
  }
  function makeUdtaBox(tagText) {
    const hdlrPayload = new Uint8Array(20); hdlrPayload.set(new TextEncoder().encode('mdir'), 8);
    const hdlr = box('hdlr', hdlrPayload);
    const ilst = box('ilst', box('\u00a9too', makeDataAtom(tagText)));
    const meta = box('meta', concat([new Uint8Array(4), hdlr, ilst]));
    return box('udta', meta);
  }
  function makeMdatHeader(payloadLength) {
    const size8 = 8 + payloadLength;
    if (size8 <= 0xffffffff) { const h = new Uint8Array(8); wU32(h, 0, size8); setType(h, 4, 'mdat'); return h; }
    const h = new Uint8Array(16); wU32(h, 0, 1); setType(h, 4, 'mdat'); wU64(h, 8, 16 + payloadLength); return h;
  }

  // Ringkasan track dari moov (untuk log): fourcc video, sample rate audio, jumlah sample, dst.
  function describeMovie(moov) {
    const out = { tracks: 0, videoFourcc: '', audioFourcc: '', audioProfile: '', sampleRate: 0, channels: 0, videoSamples: 0, audioSamples: 0 };
    for (const t of tracks(moov)) {
      const h = handlerOf(t);
      if (h !== 'vide' && h !== 'soun') continue;
      out.tracks++;
      const stsd = path(t, ['mdia', 'minf', 'stbl', 'stsd']);
      const sizes = readStsz(t);
      let fourcc = '';
      if (stsd) { const p = payloadStart(stsd); if (stsd.raw.length >= p + 16) fourcc = typeOf(stsd.raw, p + 12); }
      if (h === 'vide') { out.videoFourcc = fourcc; out.videoSamples = sizes ? sizes.length : 0; }
      else {
        out.audioFourcc = fourcc; out.audioSamples = sizes ? sizes.length : 0;
        out.audioProfile = fourcc === 'mp4a' ? 'AAC' : fourcc;
        if (stsd) {
          const base = payloadStart(stsd) + 16;
          if (stsd.raw.length >= base + 28) { out.channels = u16(stsd.raw, base + 16); out.sampleRate = u32(stsd.raw, base + 24) >>> 16; }
        }
      }
    }
    return out;
  }

  // ---- patch utama -----------------------------------------------------------------------------------
  function patchContainer(input) {
    const data = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (data.length < 16) throw new Error('Kuro FastStart: file terlalu kecil.');

    const top = []; let o = 0;
    while (o + 8 <= data.length) {
      const h = readHeader(data, o, data.length);
      if (!h) break;
      top.push(h); o = h.end;
    }
    const ftyp = top.find(x => x.type === 'ftyp');
    const moovTop = top.find(x => x.type === 'moov');
    const mdats = top.filter(x => x.type === 'mdat');
    if (!ftyp || !moovTop || mdats.length !== 1) {
      throw new Error('Kuro FastStart: membutuhkan ftyp, moov, dan tepat satu mdat.');
    }
    if (top.some(x => x.type === 'moof' || x.type === 'sidx' || x.type === 'mfra')) {
      throw new Error('Kuro FastStart: fragmented MP4 tidak didukung.');
    }
    const mdat = mdats[0];
    const mdatContentStart = mdat.offset + mdat.header;
    const mediaPayload = data.slice(mdatContentStart, mdat.end); // salinan isi mdat (input tidak diubah)

    const moov = { type: 'moov', raw: data.slice(moovTop.offset, moovTop.end), children: parseTree(data, moovTop.offset + moovTop.header, moovTop.end) };
    if (!tracks(moov).length) throw new Error('Kuro FastStart: tidak ada track.');
    const summary = describeMovie(moov);
    const outMoov = cloneTree(moov);

    // Sample audio terakhir ditimpa filler (video + sample audio lainnya tetap asli).
    const audioTrak = tracks(moov).find(t => handlerOf(t) === 'soun');
    const tailDone = audioTrak ? overwriteAudioTail(mediaPayload, audioTrak, mdatContentStart, AUDIO_TAIL_SAMPLE_COUNT) : 0;

    // Metadata level moov (meta / udta perangkat) diganti satu tag Kuro Method.
    outMoov.children = outMoov.children.filter(c => c.type !== 'meta' && c.type !== 'udta');
    zeroTimestamps(outMoov);
    zeroCompressorName(outMoov);
    rescaleMovieTimescale(outMoov, MOVIE_TIMESCALE);
    outMoov.children.push({ type: 'udta', raw: makeUdtaBox(TAG_TEXT), children: null });

    const ftypBytes = data.slice(ftyp.offset, ftyp.end);
    const free = box('free', new Uint8Array(0));
    const mdatHeader = makeMdatHeader(mediaPayload.length);

    // Pass 1: offset sementara (0) hanya untuk mengukur ukuran moov.
    const trs = tracks(outMoov);
    const original = trs.map(t => readChunkOffsets(t));
    trs.forEach((t, i) => { if (original[i]) setChunkOffsets(t, original[i].offsets.map(() => 0), original[i].is64); });
    const moovPlaceholder = serialize(outMoov);

    const newMediaStart = ftypBytes.length + moovPlaceholder.length + free.length + mdatHeader.length;
    const shift = newMediaStart - (mdat.offset + mdat.header);

    // Pass 2: geser semua offset chunk asli dengan delta tetap.
    trs.forEach((t, i) => {
      if (!original[i]) return;
      const shifted = original[i].offsets.map(v => v + shift);
      setChunkOffsets(t, shifted, original[i].is64 || shifted.some(v => v > 0xffffffff));
    });
    const moovBytes = serialize(outMoov);
    if (moovBytes.length !== moovPlaceholder.length) {
      throw new Error('Kuro FastStart: ukuran moov berubah setelah finalisasi offset.');
    }

    const bytes = concat([ftypBytes, moovBytes, free, mdatHeader, mediaPayload]);
    const mvhdInfo = readTimeHeader(child(outMoov, 'mvhd'));

    return {
      bytes,
      report: {
        engine: 'Kuro FastStart',
        videoUntouched: true,
        audioUntouched: tailDone === 0,
        audioTailOverwritten: tailDone,
        moovMovedBeforeMdat: true,
        movieTimescale: MOVIE_TIMESCALE,
        tracks: summary.tracks,
        videoFourcc: summary.videoFourcc,
        audioFourcc: summary.audioFourcc,
        audioProfile: summary.audioProfile,
        sampleRate: summary.sampleRate,
        channels: summary.channels,
        videoSamples: summary.videoSamples,
        audioSamples: summary.audioSamples,
        durationMs: mvhdInfo.timescale ? Math.round(mvhdInfo.duration * 1000 / mvhdInfo.timescale) : 0
      }
    };
  }

  function parseFile(buf) {
    const top = []; let o = 0;
    while (o + 8 <= buf.length) {
      const h = readHeader(buf, o, buf.length);
      if (!h) break;
      top.push(h); o = h.end;
    }
    const moovTop = top.find(x => x.type === 'moov');
    if (!moovTop) throw new Error('moov tidak ada');
    return { buf, moov: { type: 'moov', raw: buf.slice(moovTop.offset, moovTop.end), children: parseTree(buf, moovTop.offset + moovTop.header, moovTop.end) } };
  }

  // Video harus identik byte-per-byte; audio identik kecuali N sample terakhir yang sengaja ditimpa filler.
  function verifyUntouched(originalInput, outputInput) {
    try {
      const a = originalInput instanceof Uint8Array ? originalInput : new Uint8Array(originalInput);
      const b = outputInput instanceof Uint8Array ? outputInput : new Uint8Array(outputInput);
      const fa = parseFile(a), fb = parseFile(b);
      for (const kind of ['vide', 'soun']) {
        const ta = tracks(fa.moov).find(t => handlerOf(t) === kind);
        const tb = tracks(fb.moov).find(t => handlerOf(t) === kind);
        if (!ta || !tb) { if (!!ta !== !!tb) return false; continue; }
        const sa = getSampleSpans(ta), sb = getSampleSpans(tb);
        if (sa.length !== sb.length) return false;
        const upto = kind === 'soun' ? Math.max(0, sa.length - AUDIO_TAIL_SAMPLE_COUNT) : sa.length;
        for (let i = 0; i < sa.length; i++) {
          if (sa[i][1] !== sb[i][1]) return false;
          if (i >= upto) continue;
          const x = a.subarray(sa[i][0], sa[i][0] + sa[i][1]);
          const y = b.subarray(sb[i][0], sb[i][0] + sb[i][1]);
          for (let j = 0; j < x.length; j++) if (x[j] !== y[j]) return false;
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  // Cek struktur hasil patch dari bagian awal file: ftyp -> moov -> (free) -> mdat, tag Kuro ada.
  function verifyHead(headInput) {
    try {
      const h = headInput instanceof Uint8Array ? headInput : new Uint8Array(headInput);
      const seen = []; let o = 0;
      while (o + 8 <= h.length) {
        let size = u32(h, o); const type = typeOf(h, o + 4);
        if (size === 1) { if (o + 16 > h.length) break; size = u64(h, o + 8); }
        else if (size === 0) size = h.length - o;
        if (size < 8) return { ok: false, reason: 'box ' + type + ' tidak valid' };
        seen.push({ type, offset: o, end: o + size });
        if (type === 'mdat') break;
        o += size;
      }
      if (!seen.length || seen[0].type !== 'ftyp') return { ok: false, reason: 'ftyp tidak di awal file' };
      const moov = seen.find(x => x.type === 'moov');
      const mdat = seen.find(x => x.type === 'mdat');
      if (!moov) return { ok: false, reason: 'moov tidak berada di depan mdat' };
      if (!mdat) return { ok: false, reason: 'mdat tidak ditemukan setelah moov' };
      if (moov.offset > mdat.offset) return { ok: false, reason: 'moov berada setelah mdat' };
      const tag = new TextEncoder().encode(TAG_TEXT);
      const end = Math.min(moov.end, h.length);
      let found = false;
      outer: for (let i = moov.offset; i + tag.length <= end; i++) {
        for (let j = 0; j < tag.length; j++) if (h[i + j] !== tag[j]) continue outer;
        found = true; break;
      }
      if (!found) return { ok: false, reason: 'tag KuroUploadersHD+++ tidak ada' };
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e && e.message ? e.message : String(e) };
    }
  }

  return { patchContainer, verifyUntouched, verifyHead };
})();

// Expose
if (typeof self !== 'undefined') self.KuroFastStart = KuroFastStartEngine;
if (typeof globalThis !== 'undefined') globalThis.KuroFastStart = KuroFastStartEngine;

/* ======================================================================
 * Kuro Method - adapter (KuroMp4Patcher)
 * Compatible interface for content.js / upload pipeline.
 * ====================================================================== */
(function (g) {
  'use strict';
  const E = g.KuroFastStart;
  if (!E) return;
  const toU8 = (x) => {
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    throw new Error('Buffer video tidak valid.');
  };

  function processAndReport(input) {
    const u8 = toU8(input);
    if (!u8.length) throw new Error('File video kosong.');
    return E.patchContainer(u8);
  }

  async function processFile(file, opts) {
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Input bukan File/Blob.');
    const u8 = new Uint8Array(await file.arrayBuffer());
    const result = processAndReport(u8);
    const name = (g.KuroMp4 && typeof g.KuroMp4.patchedName === 'function')
      ? g.KuroMp4.patchedName(file.name || 'video.mp4', false)
      : (file.name || 'video.mp4').replace(/(\.[^.]+)?$/, '_kuro_patched.mp4');
    const out = new File([result.bytes], name, { type: 'video/mp4', lastModified: file.lastModified || Date.now() });
    return { file: out, report: result.report };
  }

  function checkCompatibility(input) {
    try {
      const u8 = toU8(input);
      // Basic check: has ftyp + moov + mdat
      let hasFtyp = false, hasMoov = false, hasMdat = false;
      let o = 0;
      while (o + 8 <= u8.length) {
        const size = new DataView(u8.buffer, u8.byteOffset + o, 4).getUint32(0);
        const type = String.fromCharCode(u8[o+4], u8[o+5], u8[o+6], u8[o+7]);
        if (type === 'ftyp') hasFtyp = true;
        if (type === 'moov') hasMoov = true;
        if (type === 'mdat') hasMdat = true;
        if (size < 8) break;
        o += size === 1 ? (Number(new DataView(u8.buffer, u8.byteOffset + o + 8, 8).getBigUint64(0))) : size;
        if (size === 0) break;
      }
      return { compatible: hasFtyp && hasMoov && hasMdat, reason: hasFtyp && hasMoov && hasMdat ? '' : 'Bukan MP4 non-fragmented yang valid' };
    } catch (e) {
      return { compatible: false, reason: e.message };
    }
  }

  g.KuroMethod = {
    VERSION: '1.5.4',
    patchKuroMethodMp4: (b) => processAndReport(b).bytes,
    processAndReport
  };

  g.KuroMp4Patcher = {
    version: '1.5.4',
    engine: 'Kuro Method',
    processAndReport,
    patchWithReport: processAndReport,
    quickPatch: (b) => processAndReport(b).bytes,
    patchContainer: (b) => processAndReport(b).bytes,
    processFile,
    checkCompatibility,
    verifyOutput: (src, res) => ({ ok: E.verifyUntouched(toU8(src), toU8(res)) }),
    verifyHead: (head) => E.verifyHead(toU8(head)),
    patchKuroMethodMp4: (b) => processAndReport(b).bytes
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports.KuroMethod = g.KuroMethod;
    module.exports.KuroMp4Patcher = g.KuroMp4Patcher;
  }
})(typeof self !== 'undefined' ? self : globalThis);
