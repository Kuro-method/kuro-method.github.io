/* =====================================================================
 * KURO METHOD 1.5.4 — VIDEO COMPRESSOR (Kuro FFmpeg WASM)
 * ---------------------------------------------------------------------
 * Fitur kompres video di dalam ekstensi. Logika parameter mengikuti
 * videokompres1_7.sh SELENGKAPNYA (codec/profile/pix_fmt, level,
 * CRF/bitrate, aspect ratio, resolusi, FPS, preset, audio codec,
 * profil AAC, bitrate audio, sample rate, metadata, faststart,
 * container) TERMASUK Turbo Boost yang thread/pool-nya dibatasi aman
 * mengikuti README Kuro FFmpeg Core (pthread pool 64, av_cpu_count cap 2).
 *
 * - Input  : file picker (cara lama fitur upload langsung di ekstensi)
 * - Proses : Kuro FFmpeg (worker mode) + overlay progress 16:9
 * - Output : TIDAK memakai path output di disk — hasil dibaca dari
 *            MEMFS lalu diunduh langsung di browser.
 * ===================================================================== */
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };

    /* ------------------------------------------------ i18n (EN / ID) ----
       Semua teks tab Kompres, composer, panduan & pesan status mengikuti
       bahasa yang dipilih di tab Language (sistem I18N bawaan script.js). */
    var CX_KEY = {
            "🚀 Upload ke TikTok Studio": "cx_001",
            "Cara mulai upload yang asli tetap di sini. Tekan tombol di bawah untuk membuka <b>TikTok Studio Upload</b> di tab baru.": "cx_002",
            "⚡ Kompresor Video Kuro <span class=\"version-pill\">V1.5.4</span>": "cx_003",
            "🎬 KOMPRES VIDEO DI BROWSER": "cx_004",
            "Pilih video, lalu halaman pengaturan kompres akan terbuka. Semua opsi <b>videokompres2.3.sh</b> tersedia: codec, level, CRF/bitrate, aspect ratio, resolusi, FPS, GOP/keyframe, preset, audio, sample rate, metadata, faststart, dan container. Sebelum kompres kamu melihat <b>info video asli</b> + <b>ringkasan pilihan</b>, dan hasilnya dibandingkan lewat <b>slider sebelum/sesudah</b>. Hasil kompres langsung diunduh. Tanpa login, tanpa upload ke server.": "cx_005",
            "INPUT VIDEO": "cx_006",
            "Pilih video untuk dikompres": "cx_007",
            "atau seret & lepas file ke sini": "cx_008",
            "Pilih video": "cx_009",
            "MP4, MOV, M4V, 3GP, MKV, WebM, AVI · diproses lokal di perangkatmu": "cx_010",
            "Setelah memilih video, halaman pengaturan kompres terbuka otomatis.": "cx_011",
            "KOMPRES VIDEO TANPA LOGIN (ALTERNATIF)": "cx_012",
            "Kalau perangkatmu berat untuk kompres lokal, buka pencarian Google untuk kompresor online tanpa login, atau pakai rekomendasi web di bawah ini.": "cx_013",
            "🔎 Cari Kompres Video Tanpa Login di Google": "cx_014",
            "Analisa Video (V1)": "cx_015",
            "🎬 Kompres Video": "cx_016",
            "Atur pengaturan lalu kompres": "cx_017",
            "📖 Panduan": "cx_018",
            "Ganti": "cx_019",
            "🔍 Sebelum & Sesudah Kompres": "cx_020",
            "Pilih video dulu": "cx_021",
            "Hasil kompres muncul di sini": "cx_022",
            "SEBELUM": "cx_023",
            "SESUDAH": "cx_024",
            "✨ Ini tampilan <b>SESUDAH</b> kompres — geser ke kanan untuk kembali ke <b>SEBELUM</b>": "cx_025",
            "lebih kecil dari file asli": "cx_026",
            "📊 Hasil Kompres": "cx_027",
            "BERHASIL": "cx_028",
            "Kualitas": "cx_029",
            "Resolusi Output": "cx_030",
            "FPS Output": "cx_031",
            "Ukuran Awal": "cx_032",
            "Ukuran Akhir": "cx_033",
            "Penghematan": "cx_034",
            "Durasi Encode": "cx_035",
            "Nama File Hasil": "cx_036",
            "Hasil kompres diunduh otomatis. Geser slider ke kiri untuk melihat SESUDAH.": "cx_037",
            "📋 Info Video Asli": "cx_038",
            "Nama File": "cx_039",
            "Ukuran": "cx_040",
            "Resolusi": "cx_041",
            "Durasi": "cx_042",
            "Bitrate Total": "cx_043",
            "🧾 Ringkasan Pilihan": "cx_044",
            "📖 Panduan Lengkap": "cx_045",
            "Bitrate · Level · CRF · Preset · Resolusi · FPS · GOP · Audio": "cx_046",
            "🎯 Mode Kompres": "cx_047",
            "<b>CRF</b> — kualitas tetap, ukuran menyesuaikan isi video. Paling aman untuk sebagian besar pengguna. <b>Bitrate</b> — ukuran lebih terprediksi, cocok untuk target ukuran / upload / arsip.": "cx_048",
            "🎚️ Kualitas CRF": "cx_049",
            "Hampir lossless, ukuran sangat besar": "cx_050",
            "Kualitas sangat tinggi": "cx_051",
            "Seimbang ⭐ rekomendasi": "cx_052",
            "Ukuran lebih kecil": "cx_053",
            "Kompresi tinggi": "cx_054",
            "Ukuran sangat kecil, detail berkurang": "cx_055",
            "MPEG-4 memakai skala <b>q:v</b> yang otomatis dikonversi dari CRF (CRF 18→q2, 21→q4, 24→q6, 27→q8, 30→q10, 33→q12).": "cx_056",
            "📶 Bitrate Video — rekomendasi per resolusi & FPS": "cx_057",
            "H.265 / VP9 / AV1 hemat <b>±40–50%</b> bitrate dibanding H.264 untuk kualitas visual setara. Jadi <b>720p 60fps H.265 Main cukup 3M–5M</b> (H.264 butuh 6M–8M).": "cx_058",
            "Resolusi / FPS": "cx_059",
            "Berlaku untuk 1:1 / 9:16 / 16:9 / 21:9 — rasio tidak mengubah angka bitrate karena yang dihitung adalah pixel rate.": "cx_060",
            "✍️ Bitrate Custom & kesetaraannya": "cx_061",
            "Format: <b>1500k</b>, <b>1.5M</b>, <b>10M</b> (minimal 100k).": "cx_062",
            "Sangat hemat / low quality": "cx_063",
            "Bitrate tinggi / mastering": "cx_064",
            "📏 Level per Codec — batas resolusi & FPS": "cx_065",
            "Level menentukan batas maksimum resolusi × FPS × bitrate. Pilih level <b>terendah yang masih menampung</b> resolusi/FPS kamu — level terlalu rendah = encoder menolak / hasil rusak, level terlalu tinggi = boros & tidak kompatibel dengan pemutar lama.": "cx_066",
            "Arti pilihan level di dropdown: <b>4.0</b> ≈ 1080p30 · <b>4.1</b> ≈ 1080p60 (rekomendasi umum) · <b>4.2</b> ≈ 1440p30 · <b>5.0</b> ≈ 4K30 · <b>5.1</b> ≈ 4K60 · <b>5.2</b> ≈ 4K120 · <b>6.0/6.1/6.2</b> ≈ 8K. Format custom: <b>4.2</b>, <b>5.1</b>, <b>6.2</b>.": "cx_067",
            "<b>MPEG-4</b> tidak memakai level angka, tapi profil: <b>Simple</b> (kompatibilitas maksimum, perangkat lama) atau <b>Advanced Simple</b> (kompresi lebih efisien, didukung DivX/Xvid ⭐).": "cx_068",
            "⚙️ Preset Encoder": "cx_069",
            "Paling cepat, beban CPU ringan, file paling besar — cocok testing / perangkat lemah": "cx_070",
            "Cepat, pemakaian harian, efisiensi sedang": "cx_071",
            "Seimbang kecepatan vs ukuran": "cx_072",
            "Default FFmpeg, keseimbangan terbaik ⭐": "cx_073",
            "File lebih kecil, kualitas tetap tinggi, encode lebih lama": "cx_074",
            "Efisiensi maksimum, file paling kecil, encode sangat lama": "cx_075",
            "Preset ini dipetakan otomatis: SVT-AV1 → angka 0–13, libaom → <b>cpu-used</b>, VP9 → <b>cpu-used</b>.": "cx_076",
            "🖼️ Resolusi & FPS": "cx_077",
            "<b>Resolusi:</b> Original · 480p (hemat) · 720p (HD) · <b>1080p (Full HD ⭐)</b> · 1440p (QHD) · 2160p (4K) · Custom (720–3840 px).<br/> <b>FPS:</b> Original · 24 (gaya film) · 30 (standar) · <b>60 (gerakan halus ⭐ gaming)</b> · 120 (sangat halus, file lebih besar) · Custom 15–240.": "cx_078",
            "FPS diproses lewat filter <b>fps=fps=</b> (bukan <b>-r</b>) agar hasil CFR stabil seperti skrip v2.3.": "cx_079",
            "Otomatis": "cx_080",
            "Diatur encoder, aman semua codec ⭐": "cx_081",
            "1 detik": "cx_082",
            "Seek cepat, cocok streaming & sosmed, bitrate sedikit boros": "cx_083",
            "2 detik": "cx_084",
            "Standar streaming, seimbang": "cx_085",
            "5 detik": "cx_086",
            "Hemat bitrate, seek & editing lebih berat": "cx_087",
            "0.5–60 detik → <b>-g = detik × FPS</b>": "cx_088",
            "<b>Copy</b> — audio asli tanpa re-encode (paling aman). <b>AAC/M4A</b> — AAC-LC (kompatibilitas terbaik ⭐), HE-AAC (efisien di 64–96 kbps), HE-AAC v2 (32–64 kbps). <b>MP3 · Opus · Vorbis · FLAC</b> (lossless).": "cx_089",
            "AAC-LC: 64k (kecil) · 96k (hemat) · 128k (standar) · <b>192k (bagus ⭐)</b> · 256k (tinggi) · 320k (maksimum). HE-AAC: 32k · 48k · 64k · 96k. Sample rate: 44.1 kHz / 48 kHz / Custom.": "cx_090",
            "<b>MP4</b> — kompatibilitas terbaik (Android, iPhone, TV, YouTube) ⭐. <b>MKV</b> — banyak audio/subtitle, cocok koleksi film. <b>WEBM</b> — VP9/AV1, file kecil, cocok web & streaming. <b>MOV</b> — format Apple, editing. <b>AVI</b> — format lawas, kompatibilitas luas.": "cx_091",
            "1. Aktif — 80%": "cx_092",
            "Memakai 80% thread aman: cepat, perangkat tetap responsif, kualitas sama ⭐": "cx_093",
            "2. Max — 100%": "cx_094",
            "Semua thread aman: encode paling cepat, perangkat bisa panas": "cx_095",
            "3. Nonaktif": "cx_096",
            "1 thread (mode normal): paling lambat, paling ringan": "cx_097",
            "Di WASM thread dibatasi (pthread pool 64, uji: 4–8 thread OK, 12+ gagal). <b>sliced-threads=1</b> tidak dipakai karena gagal di build ini; SVT-AV1 memakai <b>-svtav1-params lp=N</b>, VP9/AV1 memakai <b>-row-mt 1</b>.": "cx_098",
            "🎞️ Video": "cx_099",
            "Codec Video": "cx_100",
            "3. H.264 High (rekomendasi)": "cx_101",
            "4.1 (rekomendasi)": "cx_102",
            "Custom…": "cx_103",
            "Profil MPEG-4": "cx_104",
            "Advanced Simple (rekomendasi)": "cx_105",
            "Mode Kualitas": "cx_106",
            "CRF (kualitas tetap)": "cx_107",
            "Bitrate (ukuran terprediksi)": "cx_108",
            "Kualitas / CRF": "cx_109",
            "100% — hampir lossless (CRF 18)": "cx_110",
            "90% — sangat tinggi (CRF 21)": "cx_111",
            "80% — seimbang (CRF 24)": "cx_112",
            "70% — lebih kecil (CRF 27)": "cx_113",
            "60% — kompresi tinggi (CRF 30)": "cx_114",
            "50% — sangat kecil (CRF 33)": "cx_115",
            "Bitrate Video": "cx_116",
            "8 Mbps (1080p hemat)": "cx_117",
            "10 Mbps (1080p standar)": "cx_118",
            "12 Mbps (1080p tinggi)": "cx_119",
            "14 Mbps (1080p sangat tinggi)": "cx_120",
            "16 Mbps (1440p standar)": "cx_121",
            "18 Mbps (1440p tinggi)": "cx_122",
            "20 Mbps (1440p sangat tinggi)": "cx_123",
            "24 Mbps (4K hemat)": "cx_124",
            "30 Mbps (4K standar)": "cx_125",
            "40 Mbps (4K tinggi)": "cx_126",
            "Original (rasio asli)": "cx_127",
            "Lewati (jangan ubah)": "cx_128",
            "1080p (rekomendasi)": "cx_129",
            "medium (rekomendasi)": "cx_130",
            "1. Aktif — 80% CPU Core (⭐ rekomendasi)": "cx_131",
            "2. Max — 100% CPU Core / Full Power": "cx_132",
            "3. Nonaktif — mode normal (1 thread)": "cx_133",
            "Thread dibatasi aman sesuai README Kuro FFmpeg (pthread pool 64).": "cx_134",
            "Codec Audio": "cx_135",
            "Copy (audio asli)": "cx_136",
            "Profil AAC": "cx_137",
            "AAC-LC (standar)": "cx_138",
            "HE-AAC (bitrate rendah)": "cx_139",
            "HE-AAC v2 (sangat efisien)": "cx_140",
            "Bitrate Audio": "cx_141",
            "192 kbps (rekomendasi)": "cx_142",
            "Custom Bitrate Audio": "cx_143",
            "📦 Output": "cx_144",
            "Container Output": "cx_145",
            "Otomatis (MP4/MKV)": "cx_146",
            "Pertahankan metadata": "cx_147",
            "Hapus metadata": "cx_148",
            "Aktif (cocok upload)": "cx_149",
            "Nonaktif": "cx_150",
            "GOP / Keyframe Interval": "cx_151",
            "Otomatis (default encoder)": "cx_152",
            "Custom GOP (detik, 0.5–60)": "cx_153",
            "Pilih video untuk mulai.": "cx_154",
            "← Kembali": "cx_155",
            "🗜️ LANJUT KOMPRES": "cx_156",
            "⬇️ Unduh Lagi": "cx_157",
            "🧾 Ringkasan Sebelum Kompres": "cx_158",
            "Periksa info video asli & pilihanmu. Mau ganti? Tekan Kembali.": "cx_159",
            "💡 Kalau mau mengubah pilihan, tekan <b>← Kembali</b> — kamu akan kembali ke halaman pengaturan kompres (bukan ke tampilan awal ekstensi).": "cx_160",
            "🗜️ Mulai Kompres": "cx_161",
            "● MEMPROSES VIDEO": "cx_162",
            "Ukuran hasil": "cx_163",
            "Kecepatan": "cx_164",
            "Membaca file": "cx_165",
            "Mengompres": "cx_166",
            "Menyiapkan hasil": "cx_167",
            "Batalkan kompres": "cx_168"
    };
    (function registerI18n() {
        if (typeof I18N === 'undefined') return;
        var en = {
            cx_001: "🚀 Upload to TikTok Studio",
            cx_002: "The original way to start an upload stays right here. Tap the button below to open <b>TikTok Studio Upload</b> in a new tab.",
            cx_003: "⚡ Kuro Video Compressor <span class=\"version-pill\">V1.5.4</span>",
            cx_004: "🎬 COMPRESS VIDEO IN THE BROWSER",
            cx_005: "Pick a video and the compression settings page opens (similar to the upload composer). Every <b>videokompres2.3.sh</b> option is available: codec, level, CRF/bitrate, aspect ratio, resolution, FPS, GOP/keyframe, preset, audio, sample rate, metadata, faststart and container. Before compressing you see the <b>original video info</b> + a <b>summary of your choices</b>, and the result is compared with a <b>before/after slider</b>. The compressed file downloads right away. No login, no upload to any server.",
            cx_006: "VIDEO INPUT",
            cx_007: "Choose a video to compress",
            cx_008: "or drag & drop a file here",
            cx_009: "Choose video",
            cx_010: "MP4, MOV, M4V, 3GP, MKV, WebM, AVI · processed locally on your device",
            cx_011: "After you choose a video, the compression settings page opens automatically.",
            cx_012: "COMPRESS VIDEO WITHOUT LOGIN (ALTERNATIVE)",
            cx_013: "If your device is too slow for local compression, open a Google search for online compressors that need no login, or use the recommended sites below.",
            cx_014: "🔎 Search “Compress Video Without Login” on Google",
            cx_015: "Video Analysis (V1)",
            cx_016: "🎬 Compress Video",
            cx_017: "Adjust the settings, then compress",
            cx_018: "📖 Guide",
            cx_019: "Change",
            cx_020: "🔍 Before & After Compression",
            cx_021: "Choose a video first",
            cx_022: "The compressed result appears here",
            cx_023: "BEFORE",
            cx_024: "AFTER",
            cx_025: "✨ This is the <b>AFTER</b> view — drag right to go back to <b>BEFORE</b>",
            cx_026: "smaller than the original file",
            cx_027: "📊 Compression Result",
            cx_028: "SUCCESS",
            cx_029: "Quality",
            cx_030: "Output Resolution",
            cx_031: "Output FPS",
            cx_032: "Original Size",
            cx_033: "Final Size",
            cx_034: "Saved",
            cx_035: "Encode Time",
            cx_036: "Output File Name",
            cx_037: "The compressed file downloads automatically. Drag the slider left to see AFTER.",
            cx_038: "📋 Original Video Info",
            cx_039: "File Name",
            cx_040: "Size",
            cx_041: "Resolution",
            cx_042: "Duration",
            cx_043: "Total Bitrate",
            cx_044: "🧾 Summary of Choices",
            cx_045: "📖 Full Guide",
            cx_046: "Bitrate · Level · CRF · Preset · Resolution · FPS · GOP · Audio",
            cx_047: "🎯 Compression Mode",
            cx_048: "<b>CRF</b> — constant quality, size adapts to the video content. The safest choice for most users. <b>Bitrate</b> — more predictable size, good for a target size / uploads / archiving.",
            cx_049: "🎚️ CRF Quality",
            cx_050: "Nearly lossless, very large file",
            cx_051: "Very high quality",
            cx_052: "Balanced ⭐ recommended",
            cx_053: "Smaller file",
            cx_054: "Heavy compression",
            cx_055: "Very small file, less detail",
            cx_056: "MPEG-4 uses the <b>q:v</b> scale, converted automatically from CRF (CRF 18→q2, 21→q4, 24→q6, 27→q8, 30→q10, 33→q12).",
            cx_057: "📶 Video Bitrate — recommendations per resolution & FPS",
            cx_058: "H.265 / VP9 / AV1 save <b>±40–50%</b> bitrate compared to H.264 at the same visual quality. So <b>720p 60fps H.265 Main only needs 3M–5M</b> (H.264 needs 6M–8M).",
            cx_059: "Resolution / FPS",
            cx_060: "Applies to 1:1 / 9:16 / 16:9 / 21:9 — the ratio does not change the bitrate figures because what counts is the pixel rate.",
            cx_061: "✍️ Custom Bitrate & equivalents",
            cx_062: "Format: <b>1500k</b>, <b>1.5M</b>, <b>10M</b> (minimum 100k).",
            cx_063: "Very economical / low quality",
            cx_064: "High bitrate / mastering",
            cx_065: "📏 Level per Codec — resolution & FPS limits",
            cx_066: "The level sets the maximum resolution × FPS × bitrate. Choose the <b>lowest level that still fits</b> your resolution/FPS — a level that is too low = the encoder refuses / broken output, a level that is too high = wasteful & incompatible with older players.",
            cx_067: "What the level options in the dropdown mean: <b>4.0</b> ≈ 1080p30 · <b>4.1</b> ≈ 1080p60 (general recommendation) · <b>4.2</b> ≈ 1440p30 · <b>5.0</b> ≈ 4K30 · <b>5.1</b> ≈ 4K60 · <b>5.2</b> ≈ 4K120 · <b>6.0/6.1/6.2</b> ≈ 8K. Custom format: <b>4.2</b>, <b>5.1</b>, <b>6.2</b>.",
            cx_068: "<b>MPEG-4</b> does not use numeric levels but profiles: <b>Simple</b> (maximum compatibility, older devices) or <b>Advanced Simple</b> (more efficient compression, supported by DivX/Xvid ⭐).",
            cx_069: "⚙️ Encoder Preset",
            cx_070: "Fastest, light CPU load, largest file — good for testing / weak devices",
            cx_071: "Fast, everyday use, moderate efficiency",
            cx_072: "Balance of speed vs size",
            cx_073: "FFmpeg default, best balance ⭐",
            cx_074: "Smaller file, quality stays high, longer encode",
            cx_075: "Maximum efficiency, smallest file, very long encode",
            cx_076: "These presets are mapped automatically: SVT-AV1 → number 0–13, libaom → <b>cpu-used</b>, VP9 → <b>cpu-used</b>.",
            cx_077: "🖼️ Resolution & FPS",
            cx_078: "<b>Resolution:</b> Original · 480p (economical) · 720p (HD) · <b>1080p (Full HD ⭐)</b> · 1440p (QHD) · 2160p (4K) · Custom (720–3840 px).<br/> <b>FPS:</b> Original · 24 (film look) · 30 (standard) · <b>60 (smooth motion ⭐ gaming)</b> · 120 (ultra smooth, larger file) · Custom 15–240.",
            cx_079: "FPS is applied through the <b>fps=fps=</b> filter (not <b>-r</b>) so the output is a stable CFR, like the v2.3 script.",
            cx_080: "Automatic",
            cx_081: "Chosen by the encoder, safe for every codec ⭐",
            cx_082: "1 second",
            cx_083: "Fast seeking, good for streaming & social media, slightly higher bitrate",
            cx_084: "2 seconds",
            cx_085: "Streaming standard, balanced",
            cx_086: "5 seconds",
            cx_087: "Saves bitrate, seeking & editing are heavier",
            cx_088: "0.5–60 seconds → <b>-g = seconds × FPS</b>",
            cx_089: "<b>Copy</b> — original audio without re-encoding (safest). <b>AAC/M4A</b> — AAC-LC (best compatibility ⭐), HE-AAC (efficient at 64–96 kbps), HE-AAC v2 (32–64 kbps). <b>MP3 · Opus · Vorbis · FLAC</b> (lossless).",
            cx_090: "AAC-LC: 64k (small) · 96k (economical) · 128k (standard) · <b>192k (good ⭐)</b> · 256k (high) · 320k (maximum). HE-AAC: 32k · 48k · 64k · 96k. Sample rate: 44.1 kHz / 48 kHz / Custom.",
            cx_091: "<b>MP4</b> — best compatibility (Android, iPhone, TV, YouTube) ⭐. <b>MKV</b> — many audio/subtitle tracks, great for movie collections. <b>WEBM</b> — VP9/AV1, small files, good for web & streaming. <b>MOV</b> — Apple format, editing. <b>AVI</b> — legacy format, wide compatibility.",
            cx_092: "1. On — 80%",
            cx_093: "Uses 80% of the safe threads: fast, device stays responsive, same quality ⭐",
            cx_094: "2. Max — 100%",
            cx_095: "All safe threads: fastest encode, device may get hot",
            cx_096: "3. Off",
            cx_097: "1 thread (normal mode): slowest, lightest",
            cx_098: "In WASM, threads are limited (pthread pool 64, tested: 4–8 threads OK, 12+ fail). <b>sliced-threads=1</b> is not used because it fails in this build; SVT-AV1 uses <b>-svtav1-params lp=N</b>, VP9/AV1 use <b>-row-mt 1</b>.",
            cx_099: "🎞️ Video",
            cx_100: "Video Codec",
            cx_101: "3. H.264 High (recommended)",
            cx_102: "4.1 (recommended)",
            cx_103: "Custom…",
            cx_104: "MPEG-4 Profile",
            cx_105: "Advanced Simple (recommended)",
            cx_106: "Quality Mode",
            cx_107: "CRF (constant quality)",
            cx_108: "Bitrate (predictable size)",
            cx_109: "Quality / CRF",
            cx_110: "100% — nearly lossless (CRF 18)",
            cx_111: "90% — very high (CRF 21)",
            cx_112: "80% — balanced (CRF 24)",
            cx_113: "70% — smaller (CRF 27)",
            cx_114: "60% — heavy compression (CRF 30)",
            cx_115: "50% — very small (CRF 33)",
            cx_116: "Video Bitrate",
            cx_117: "8 Mbps (1080p economical)",
            cx_118: "10 Mbps (1080p standard)",
            cx_119: "12 Mbps (1080p high)",
            cx_120: "14 Mbps (1080p very high)",
            cx_121: "16 Mbps (1440p standard)",
            cx_122: "18 Mbps (1440p high)",
            cx_123: "20 Mbps (1440p very high)",
            cx_124: "24 Mbps (4K economical)",
            cx_125: "30 Mbps (4K standard)",
            cx_126: "40 Mbps (4K high)",
            cx_127: "Original (source ratio)",
            cx_128: "Skip (don't change)",
            cx_129: "1080p (recommended)",
            cx_130: "medium (recommended)",
            cx_131: "1. On — 80% CPU cores (⭐ recommended)",
            cx_132: "2. Max — 100% CPU cores / full power",
            cx_133: "3. Off — normal mode (1 thread)",
            cx_134: "Threads are capped at a safe limit per the Kuro FFmpeg README (pthread pool 64).",
            cx_135: "Audio Codec",
            cx_136: "Copy (original audio)",
            cx_137: "AAC Profile",
            cx_138: "AAC-LC (standard)",
            cx_139: "HE-AAC (low bitrate)",
            cx_140: "HE-AAC v2 (very efficient)",
            cx_141: "Audio Bitrate",
            cx_142: "192 kbps (recommended)",
            cx_143: "Custom Audio Bitrate",
            cx_144: "📦 Output",
            cx_145: "Output Container",
            cx_146: "Automatic (MP4/MKV)",
            cx_147: "Keep metadata",
            cx_148: "Remove metadata",
            cx_149: "On (good for uploading)",
            cx_150: "Off",
            cx_151: "GOP / Keyframe Interval",
            cx_152: "Automatic (encoder default)",
            cx_153: "Custom GOP (seconds, 0.5–60)",
            cx_154: "Choose a video to start.",
            cx_155: "← Back",
            cx_156: "🗜️ CONTINUE TO COMPRESS",
            cx_157: "⬇️ Download Again",
            cx_158: "🧾 Summary Before Compressing",
            cx_159: "Check the original video info & your choices. Want to change something? Tap Back.",
            cx_160: "💡 To change your choices, tap <b>← Back</b> — you'll return to the compression settings page (not the extension's start screen).",
            cx_161: "🗜️ Start Compressing",
            cx_162: "● PROCESSING VIDEO",
            cx_163: "Result size",
            cx_164: "Speed",
            cx_165: "Reading file",
            cx_166: "Compressing",
            cx_167: "Preparing result",
            cx_168: "Cancel compression",
            cxa_01: "Choose a video to compress",
            cxa_02: "Open the full guide",
            cxa_03: "Drag to compare before and after compression",
            cxa_04: "e.g. 4.2",
            cxa_05: "e.g. 1.5M / 1500k",
            cxa_06: "e.g. 160k",
            cmpj_st_start: "Choose a video to start.",
            cmpj_st_notvideo: "This file is not a supported video.",
            cmpj_st_ready: "Ready to compress. Adjust the settings, then tap CONTINUE TO COMPRESS to see the summary.",
            cmpj_st_pickfirst: "Choose a video file first.",
            cmpj_st_unreadable: "The video could not be read. The file may be corrupted or its format is not supported by the browser.",
            cmpj_st_mpeg4webm: "MPEG-4 is not supported in a WebM container. Choose MP4/MKV/MOV/AVI.",
            cmpj_st_webmcodec: "WebM only supports VP9/AV1 video. Choose an MKV/MP4 container or a VP9/AV1 codec.",
            cmpj_st_done: "Compression finished. {a} → {b}{save}. The file was downloaded automatically.",
            cmpj_st_saved: " (saved {p}%)",
            cmpj_st_cancelled: "Compression cancelled. No output file was created.",
            cmpj_st_failed: "Compression failed: {e}",
            cmpj_st_cleared: "Result cleared. Change the settings, then compress again.",
            cmpj_stg_prep: "Preparing file…",
            cmpj_stg_compress: "Compressing video… {n}%",
            cmpj_stg_reading: "Reading video file…",
            cmpj_stg_reading_pct: "Reading video file… {n}%",
            cmpj_stg_loading: "Loading Kuro FFmpeg (WASM)…",
            cmpj_stg_writing: "Writing file to FFmpeg memory…",
            cmpj_stg_ready: "File is ready to compress.",
            cmpj_stg_done: "Compression finished.",
            cmpj_stg_prepres: "Preparing the compressed result…",
            cmpj_stg_download: "Downloading the result in the browser…",
            cmpj_stg_finished: "Done — the result has been downloaded.",
            cmpj_stg_cancelling: "Cancelling compression…",
            cmpj_err_unknown: "unknown error",
            cmpj_err_ffmpeg: "FFmpeg rejected this file (unsupported format or corrupted file)",
            cmpj_err_noffmpeg: "Kuro FFmpeg was not found. Make sure encoder/ffmpeg/ffmpeg.js is loaded.",
            cmpj_err_read: "Failed to read the file.",
            cmpj_err_empty: "FFmpeg produced an empty file. Try another codec/container.",
            cmpj_turbo_on: "On (80% CPU)",
            cmpj_turbo_max: "Max (100% CPU)",
            cmpj_turbo_off: "Off",
            cmpj_turbo_n1: "{head} — <b>1 thread</b>, normal mode (slowest, lightest).",
            cmpj_turbo_svt: "{head} — <b>lp={tn}</b> for SVT-AV1, {tf} filter thread(s).",
            cmpj_turbo_vpx: "{head} — <b>{tn} threads</b> + row-mt, {tf} filter thread(s).",
            cmpj_turbo_enc: "{head} — <b>{tn} encoder threads</b>, {tf} filter thread(s).",
            cmpj_sum_skip: "Skip",
            cmpj_sum_auto: "Automatic",
            cmpj_sum_sec: "{n} s",
            cmpj_sum_on80: "On 80%",
            cmpj_sum_max100: "Max 100%",
            cmpj_sum_off: "Off",
            cmpj_sum_copy: "Copy (original)",
            cmpj_sum_keep: "Keep",
            cmpj_sum_remove: "Remove",
            cmpj_sum_on: "On",
            cmpj_res_orig: "Original",
            cmpj_res_gop: "{s} s ({f} frames)",
            cmpj_res_gopauto: "Automatic (encoder default)",
            cmpj_res_saved: "(saved)",
            cmpj_res_grew: "(increased)",
            cmpj_res_nometa: "— (metadata removed)",
            cmpj_res_elapsed: "{m} min {s} s",
            cmpj_res_target: "Target {v}"
        };
        var id = {
            cx_001: "🚀 Upload ke TikTok Studio",
            cx_002: "Cara mulai upload yang asli tetap di sini. Tekan tombol di bawah untuk membuka <b>TikTok Studio Upload</b> di tab baru.",
            cx_003: "⚡ Kompresor Video Kuro <span class=\"version-pill\">V1.5.4</span>",
            cx_004: "🎬 KOMPRES VIDEO DI BROWSER",
            cx_005: "Pilih video, lalu halaman pengaturan kompres akan terbuka. Semua opsi <b>videokompres2.3.sh</b> tersedia: codec, level, CRF/bitrate, aspect ratio, resolusi, FPS, GOP/keyframe, preset, audio, sample rate, metadata, faststart, dan container. Sebelum kompres kamu melihat <b>info video asli</b> + <b>ringkasan pilihan</b>, dan hasilnya dibandingkan lewat <b>slider sebelum/sesudah</b>. Hasil kompres langsung diunduh. Tanpa login, tanpa upload ke server.",
            cx_006: "INPUT VIDEO",
            cx_007: "Pilih video untuk dikompres",
            cx_008: "atau seret & lepas file ke sini",
            cx_009: "Pilih video",
            cx_010: "MP4, MOV, M4V, 3GP, MKV, WebM, AVI · diproses lokal di perangkatmu",
            cx_011: "Setelah memilih video, halaman pengaturan kompres terbuka otomatis.",
            cx_012: "KOMPRES VIDEO TANPA LOGIN (ALTERNATIF)",
            cx_013: "Kalau perangkatmu berat untuk kompres lokal, buka pencarian Google untuk kompresor online tanpa login, atau pakai rekomendasi web di bawah ini.",
            cx_014: "🔎 Cari Kompres Video Tanpa Login di Google",
            cx_015: "Analisa Video (V1)",
            cx_016: "🎬 Kompres Video",
            cx_017: "Atur pengaturan lalu kompres",
            cx_018: "📖 Panduan",
            cx_019: "Ganti",
            cx_020: "🔍 Sebelum & Sesudah Kompres",
            cx_021: "Pilih video dulu",
            cx_022: "Hasil kompres muncul di sini",
            cx_023: "SEBELUM",
            cx_024: "SESUDAH",
            cx_025: "✨ Ini tampilan <b>SESUDAH</b> kompres — geser ke kanan untuk kembali ke <b>SEBELUM</b>",
            cx_026: "lebih kecil dari file asli",
            cx_027: "📊 Hasil Kompres",
            cx_028: "BERHASIL",
            cx_029: "Kualitas",
            cx_030: "Resolusi Output",
            cx_031: "FPS Output",
            cx_032: "Ukuran Awal",
            cx_033: "Ukuran Akhir",
            cx_034: "Penghematan",
            cx_035: "Durasi Encode",
            cx_036: "Nama File Hasil",
            cx_037: "Hasil kompres diunduh otomatis. Geser slider ke kiri untuk melihat SESUDAH.",
            cx_038: "📋 Info Video Asli",
            cx_039: "Nama File",
            cx_040: "Ukuran",
            cx_041: "Resolusi",
            cx_042: "Durasi",
            cx_043: "Bitrate Total",
            cx_044: "🧾 Ringkasan Pilihan",
            cx_045: "📖 Panduan Lengkap",
            cx_046: "Bitrate · Level · CRF · Preset · Resolusi · FPS · GOP · Audio",
            cx_047: "🎯 Mode Kompres",
            cx_048: "<b>CRF</b> — kualitas tetap, ukuran menyesuaikan isi video. Paling aman untuk sebagian besar pengguna. <b>Bitrate</b> — ukuran lebih terprediksi, cocok untuk target ukuran / upload / arsip.",
            cx_049: "🎚️ Kualitas CRF",
            cx_050: "Hampir lossless, ukuran sangat besar",
            cx_051: "Kualitas sangat tinggi",
            cx_052: "Seimbang ⭐ rekomendasi",
            cx_053: "Ukuran lebih kecil",
            cx_054: "Kompresi tinggi",
            cx_055: "Ukuran sangat kecil, detail berkurang",
            cx_056: "MPEG-4 memakai skala <b>q:v</b> yang otomatis dikonversi dari CRF (CRF 18→q2, 21→q4, 24→q6, 27→q8, 30→q10, 33→q12).",
            cx_057: "📶 Bitrate Video — rekomendasi per resolusi & FPS",
            cx_058: "H.265 / VP9 / AV1 hemat <b>±40–50%</b> bitrate dibanding H.264 untuk kualitas visual setara. Jadi <b>720p 60fps H.265 Main cukup 3M–5M</b> (H.264 butuh 6M–8M).",
            cx_059: "Resolusi / FPS",
            cx_060: "Berlaku untuk 1:1 / 9:16 / 16:9 / 21:9 — rasio tidak mengubah angka bitrate karena yang dihitung adalah pixel rate.",
            cx_061: "✍️ Bitrate Custom & kesetaraannya",
            cx_062: "Format: <b>1500k</b>, <b>1.5M</b>, <b>10M</b> (minimal 100k).",
            cx_063: "Sangat hemat / low quality",
            cx_064: "Bitrate tinggi / mastering",
            cx_065: "📏 Level per Codec — batas resolusi & FPS",
            cx_066: "Level menentukan batas maksimum resolusi × FPS × bitrate. Pilih level <b>terendah yang masih menampung</b> resolusi/FPS kamu — level terlalu rendah = encoder menolak / hasil rusak, level terlalu tinggi = boros & tidak kompatibel dengan pemutar lama.",
            cx_067: "Arti pilihan level di dropdown: <b>4.0</b> ≈ 1080p30 · <b>4.1</b> ≈ 1080p60 (rekomendasi umum) · <b>4.2</b> ≈ 1440p30 · <b>5.0</b> ≈ 4K30 · <b>5.1</b> ≈ 4K60 · <b>5.2</b> ≈ 4K120 · <b>6.0/6.1/6.2</b> ≈ 8K. Format custom: <b>4.2</b>, <b>5.1</b>, <b>6.2</b>.",
            cx_068: "<b>MPEG-4</b> tidak memakai level angka, tapi profil: <b>Simple</b> (kompatibilitas maksimum, perangkat lama) atau <b>Advanced Simple</b> (kompresi lebih efisien, didukung DivX/Xvid ⭐).",
            cx_069: "⚙️ Preset Encoder",
            cx_070: "Paling cepat, beban CPU ringan, file paling besar — cocok testing / perangkat lemah",
            cx_071: "Cepat, pemakaian harian, efisiensi sedang",
            cx_072: "Seimbang kecepatan vs ukuran",
            cx_073: "Default FFmpeg, keseimbangan terbaik ⭐",
            cx_074: "File lebih kecil, kualitas tetap tinggi, encode lebih lama",
            cx_075: "Efisiensi maksimum, file paling kecil, encode sangat lama",
            cx_076: "Preset ini dipetakan otomatis: SVT-AV1 → angka 0–13, libaom → <b>cpu-used</b>, VP9 → <b>cpu-used</b>.",
            cx_077: "🖼️ Resolusi & FPS",
            cx_078: "<b>Resolusi:</b> Original · 480p (hemat) · 720p (HD) · <b>1080p (Full HD ⭐)</b> · 1440p (QHD) · 2160p (4K) · Custom (720–3840 px).<br/> <b>FPS:</b> Original · 24 (gaya film) · 30 (standar) · <b>60 (gerakan halus ⭐ gaming)</b> · 120 (sangat halus, file lebih besar) · Custom 15–240.",
            cx_079: "FPS diproses lewat filter <b>fps=fps=</b> (bukan <b>-r</b>) agar hasil CFR stabil seperti skrip v2.3.",
            cx_080: "Otomatis",
            cx_081: "Diatur encoder, aman semua codec ⭐",
            cx_082: "1 detik",
            cx_083: "Seek cepat, cocok streaming & sosmed, bitrate sedikit boros",
            cx_084: "2 detik",
            cx_085: "Standar streaming, seimbang",
            cx_086: "5 detik",
            cx_087: "Hemat bitrate, seek & editing lebih berat",
            cx_088: "0.5–60 detik → <b>-g = detik × FPS</b>",
            cx_089: "<b>Copy</b> — audio asli tanpa re-encode (paling aman). <b>AAC/M4A</b> — AAC-LC (kompatibilitas terbaik ⭐), HE-AAC (efisien di 64–96 kbps), HE-AAC v2 (32–64 kbps). <b>MP3 · Opus · Vorbis · FLAC</b> (lossless).",
            cx_090: "AAC-LC: 64k (kecil) · 96k (hemat) · 128k (standar) · <b>192k (bagus ⭐)</b> · 256k (tinggi) · 320k (maksimum). HE-AAC: 32k · 48k · 64k · 96k. Sample rate: 44.1 kHz / 48 kHz / Custom.",
            cx_091: "<b>MP4</b> — kompatibilitas terbaik (Android, iPhone, TV, YouTube) ⭐. <b>MKV</b> — banyak audio/subtitle, cocok koleksi film. <b>WEBM</b> — VP9/AV1, file kecil, cocok web & streaming. <b>MOV</b> — format Apple, editing. <b>AVI</b> — format lawas, kompatibilitas luas.",
            cx_092: "1. Aktif — 80%",
            cx_093: "Memakai 80% thread aman: cepat, perangkat tetap responsif, kualitas sama ⭐",
            cx_094: "2. Max — 100%",
            cx_095: "Semua thread aman: encode paling cepat, perangkat bisa panas",
            cx_096: "3. Nonaktif",
            cx_097: "1 thread (mode normal): paling lambat, paling ringan",
            cx_098: "Di WASM thread dibatasi (pthread pool 64, uji: 4–8 thread OK, 12+ gagal). <b>sliced-threads=1</b> tidak dipakai karena gagal di build ini; SVT-AV1 memakai <b>-svtav1-params lp=N</b>, VP9/AV1 memakai <b>-row-mt 1</b>.",
            cx_099: "🎞️ Video",
            cx_100: "Codec Video",
            cx_101: "3. H.264 High (rekomendasi)",
            cx_102: "4.1 (rekomendasi)",
            cx_103: "Custom…",
            cx_104: "Profil MPEG-4",
            cx_105: "Advanced Simple (rekomendasi)",
            cx_106: "Mode Kualitas",
            cx_107: "CRF (kualitas tetap)",
            cx_108: "Bitrate (ukuran terprediksi)",
            cx_109: "Kualitas / CRF",
            cx_110: "100% — hampir lossless (CRF 18)",
            cx_111: "90% — sangat tinggi (CRF 21)",
            cx_112: "80% — seimbang (CRF 24)",
            cx_113: "70% — lebih kecil (CRF 27)",
            cx_114: "60% — kompresi tinggi (CRF 30)",
            cx_115: "50% — sangat kecil (CRF 33)",
            cx_116: "Bitrate Video",
            cx_117: "8 Mbps (1080p hemat)",
            cx_118: "10 Mbps (1080p standar)",
            cx_119: "12 Mbps (1080p tinggi)",
            cx_120: "14 Mbps (1080p sangat tinggi)",
            cx_121: "16 Mbps (1440p standar)",
            cx_122: "18 Mbps (1440p tinggi)",
            cx_123: "20 Mbps (1440p sangat tinggi)",
            cx_124: "24 Mbps (4K hemat)",
            cx_125: "30 Mbps (4K standar)",
            cx_126: "40 Mbps (4K tinggi)",
            cx_127: "Original (rasio asli)",
            cx_128: "Lewati (jangan ubah)",
            cx_129: "1080p (rekomendasi)",
            cx_130: "medium (rekomendasi)",
            cx_131: "1. Aktif — 80% CPU Core (⭐ rekomendasi)",
            cx_132: "2. Max — 100% CPU Core / Full Power",
            cx_133: "3. Nonaktif — mode normal (1 thread)",
            cx_134: "Thread dibatasi aman sesuai README Kuro FFmpeg (pthread pool 64).",
            cx_135: "Codec Audio",
            cx_136: "Copy (audio asli)",
            cx_137: "Profil AAC",
            cx_138: "AAC-LC (standar)",
            cx_139: "HE-AAC (bitrate rendah)",
            cx_140: "HE-AAC v2 (sangat efisien)",
            cx_141: "Bitrate Audio",
            cx_142: "192 kbps (rekomendasi)",
            cx_143: "Custom Bitrate Audio",
            cx_144: "📦 Output",
            cx_145: "Container Output",
            cx_146: "Otomatis (MP4/MKV)",
            cx_147: "Pertahankan metadata",
            cx_148: "Hapus metadata",
            cx_149: "Aktif (cocok upload)",
            cx_150: "Nonaktif",
            cx_151: "GOP / Keyframe Interval",
            cx_152: "Otomatis (default encoder)",
            cx_153: "Custom GOP (detik, 0.5–60)",
            cx_154: "Pilih video untuk mulai.",
            cx_155: "← Kembali",
            cx_156: "🗜️ LANJUT KOMPRES",
            cx_157: "⬇️ Unduh Lagi",
            cx_158: "🧾 Ringkasan Sebelum Kompres",
            cx_159: "Periksa info video asli & pilihanmu. Mau ganti? Tekan Kembali.",
            cx_160: "💡 Kalau mau mengubah pilihan, tekan <b>← Kembali</b> — kamu akan kembali ke halaman pengaturan kompres (bukan ke tampilan awal ekstensi).",
            cx_161: "🗜️ Mulai Kompres",
            cx_162: "● MEMPROSES VIDEO",
            cx_163: "Ukuran hasil",
            cx_164: "Kecepatan",
            cx_165: "Membaca file",
            cx_166: "Mengompres",
            cx_167: "Menyiapkan hasil",
            cx_168: "Batalkan kompres",
            cxa_01: "Pilih video untuk dikompres",
            cxa_02: "Buka panduan lengkap",
            cxa_03: "Geser pembanding sebelum dan sesudah kompres",
            cxa_04: "contoh: 4.2",
            cxa_05: "contoh: 1.5M / 1500k",
            cxa_06: "contoh: 160k",
            cmpj_st_start: "Pilih video untuk mulai.",
            cmpj_st_notvideo: "File ini bukan video yang didukung.",
            cmpj_st_ready: "Siap dikompres. Atur pengaturan lalu tekan LANJUT KOMPRES untuk melihat ringkasan.",
            cmpj_st_pickfirst: "Pilih file video dulu.",
            cmpj_st_unreadable: "Video tidak bisa dibaca. File mungkin rusak atau formatnya tidak didukung browser.",
            cmpj_st_mpeg4webm: "MPEG-4 tidak didukung di container WebM. Pilih MP4/MKV/MOV/AVI.",
            cmpj_st_webmcodec: "WebM hanya mendukung video VP9/AV1. Pilih container MKV/MP4 atau codec VP9/AV1.",
            cmpj_st_done: "Kompres selesai. {a} → {b}{save}. File diunduh otomatis.",
            cmpj_st_saved: " (hemat {p}%)",
            cmpj_st_cancelled: "Kompres dibatalkan. Tidak ada file hasil yang dibuat.",
            cmpj_st_failed: "Gagal mengompres: {e}",
            cmpj_st_cleared: "Hasil dibersihkan. Ubah pengaturan lalu kompres lagi.",
            cmpj_stg_prep: "Menyiapkan file…",
            cmpj_stg_compress: "Mengompres video… {n}%",
            cmpj_stg_reading: "Membaca file video…",
            cmpj_stg_reading_pct: "Membaca file video… {n}%",
            cmpj_stg_loading: "Memuat Kuro FFmpeg (WASM)…",
            cmpj_stg_writing: "Menulis file ke memori FFmpeg…",
            cmpj_stg_ready: "File siap dikompres.",
            cmpj_stg_done: "Kompres selesai.",
            cmpj_stg_prepres: "Menyiapkan hasil kompres…",
            cmpj_stg_download: "Mengunduh hasil ke browser…",
            cmpj_stg_finished: "Selesai — hasil sudah diunduh.",
            cmpj_stg_cancelling: "Membatalkan kompres…",
            cmpj_err_unknown: "kesalahan tidak diketahui",
            cmpj_err_ffmpeg: "FFmpeg menolak file ini (format tidak didukung atau file rusak)",
            cmpj_err_noffmpeg: "Kuro FFmpeg tidak ditemukan. Pastikan encoder/ffmpeg/ffmpeg.js dimuat.",
            cmpj_err_read: "Gagal membaca file.",
            cmpj_err_empty: "FFmpeg menghasilkan file kosong. Coba codec/container lain.",
            cmpj_turbo_on: "Aktif (80% CPU)",
            cmpj_turbo_max: "Max (100% CPU)",
            cmpj_turbo_off: "Nonaktif",
            cmpj_turbo_n1: "{head} — <b>1 thread</b>, mode normal (paling lambat, paling ringan).",
            cmpj_turbo_svt: "{head} — <b>lp={tn}</b> untuk SVT-AV1, {tf} filter thread.",
            cmpj_turbo_vpx: "{head} — <b>{tn} thread</b> + row-mt, {tf} filter thread.",
            cmpj_turbo_enc: "{head} — <b>{tn} thread</b> encoder, {tf} filter thread.",
            cmpj_sum_skip: "Lewati",
            cmpj_sum_auto: "Otomatis",
            cmpj_sum_sec: "{n} detik",
            cmpj_sum_on80: "Aktif 80%",
            cmpj_sum_max100: "Max 100%",
            cmpj_sum_off: "Nonaktif",
            cmpj_sum_copy: "Copy (asli)",
            cmpj_sum_keep: "Pertahankan",
            cmpj_sum_remove: "Hapus",
            cmpj_sum_on: "Aktif",
            cmpj_res_orig: "Asli",
            cmpj_res_gop: "{s} detik ({f} frame)",
            cmpj_res_gopauto: "Otomatis (default encoder)",
            cmpj_res_saved: "(hemat)",
            cmpj_res_grew: "(bertambah)",
            cmpj_res_nometa: "— (metadata dihapus)",
            cmpj_res_elapsed: "{m} menit {s} detik",
            cmpj_res_target: "Target {v}"
        };
        Object.assign(I18N.en, en);
        Object.assign(I18N.id, id);
    })();
    var T = function (k, v) { return (typeof t === 'function') ? t('cmpj_' + k, v) : k; };
    var LX = function (s) {
        var k = CX_KEY[s];
        return (k && typeof t === 'function') ? t(k) : s;
    };

    /* ------------------------------------------------------------ state */
    var sourceFile = null;
    var sourceURL = null;
    var beforeMeta = { w: 0, h: 0, duration: 0, fps: 30 };
    var metaReady = false;
    var ffmpeg = null;
    var ffmpegLoading = null;
    /* web: bagikan instance FFmpeg dengan tab Patch / Optimizer / Multiplier 2x (tools.js) */
    window.__kuroGetFFmpeg = function () { return getFFmpeg(); };
    window.__kuroResetFFmpeg = function () {
        try { if (ffmpeg && typeof ffmpeg.terminate === 'function') ffmpeg.terminate(); } catch (e) {}
        ffmpeg = null; ffmpegLoading = null;
    };
    var busy = false;
    var lastBlob = null;
    var lastURL = null;
    var lastFileName = '';
    var lastFfmpegError = '';
    var stageVal = { 1: 0, 2: 0, 3: 0 };

    /* info video asli + ringkasan pilihan (fitur baru v2.3) */
    var infoData = { name: '', container: '', size: 0, w: 0, h: 0, duration: 0,
                     fps: 0, vcodec: '', acodec: '', bitrate: 0, aspect: '' };
    var reviewOpen = false;

    /* hasil kompres terakhir (mirror "HASIL KOMPRES" videokompres2.3.sh) */
    var resultInfo = null;
    var lastBuild = { fpsVal: 0, gopSec: 0, gopFrames: 0, aspect: '', resW: 0, resH: 0 };

    /* live stats (MB hasil / kecepatan / ETA) — seperti videokompres1.7.sh */
    var liveSizeBytes = 0;     // dari "total_size=" (progress pipe:1)
    var liveSpeedX = 0;        // dari "speed=1.02x"
    var liveMediaTime = 0;     // detik media yang sudah diproses
    var totalDuration = 0;     // durasi total video
    var execStartedAt = 0;     // performance.now() saat encode mulai
    var estFinalBytes = 0;     // perkiraan ukuran akhir (fallback)
    var lastStatsPaint = 0;

    /* turbo boost — batas thread aman sesuai README Kuro FFmpeg Core:
       pool pthread 64 worker, default av_cpu_count() di-cap 2. */
    var TURBO_FILTER_THREADS = 2;   /* 2 filter thread (mode 80%) */

    /* pembatalan kompres */
    var cancelRequested = false;
    var cancelReject = null;

    /* -------------------------------------------------------- codec map */
    var CODECS = {
        'x264-baseline':   { codec: 'libx264',    mode: 'H264',  profile: 'baseline',    pix: 'yuv420p' },
        'x264-main':       { codec: 'libx264',    mode: 'H264',  profile: 'main',        pix: 'yuv420p' },
        'x264-high':       { codec: 'libx264',    mode: 'H264',  profile: 'high',        pix: 'yuv420p' },
        'x264-high10':     { codec: 'libx264',    mode: 'H264',  profile: 'high10',      pix: 'yuv420p10le' },
        'x264-high422':    { codec: 'libx264',    mode: 'H264',  profile: 'high422',     pix: 'yuv422p' },
        'x264-high444':    { codec: 'libx264',    mode: 'H264',  profile: 'high444',     pix: 'yuv444p' },
        'x265-main':       { codec: 'libx265',    mode: 'H265',  profile: 'main',        pix: 'yuv420p' },
        'x265-main10':     { codec: 'libx265',    mode: 'H265',  profile: 'main10',      pix: 'yuv420p10le' },
        'x265-main422-10': { codec: 'libx265',    mode: 'H265',  profile: 'main422-10',  pix: 'yuv422p10le' },
        'x265-main444-10': { codec: 'libx265',    mode: 'H265',  profile: 'main444-10',  pix: 'yuv444p10le' },
        'vp9-0':           { codec: 'libvpx-vp9', mode: 'VP9',   profile: '0',           pix: 'yuv420p' },
        'vp9-1':           { codec: 'libvpx-vp9', mode: 'VP9',   profile: '1',           pix: 'yuv444p' },
        'vp9-2':           { codec: 'libvpx-vp9', mode: 'VP9',   profile: '2',           pix: 'yuv420p10le' },
        'vp9-3':           { codec: 'libvpx-vp9', mode: 'VP9',   profile: '3',           pix: 'yuv444p10le' },
        'av1-svt':         { codec: 'libsvtav1',  mode: 'AV1',   profile: 'main',        pix: 'yuv420p10le' },
        'av1-aom':         { codec: 'libaom-av1', mode: 'AV1',   profile: 'main',        pix: 'yuv420p10le' },
        'mpeg4':           { codec: 'mpeg4',      mode: 'MPEG4', profile: '3',           pix: 'yuv420p' }
    };

    var AV1_PRESET = {
        ultrafast: 12, superfast: 11, veryfast: 10, faster: 8, fast: 6,
        medium: 4, slow: 3, slower: 2, veryslow: 1
    };
    var AOM_CPU = {
        ultrafast: 8, superfast: 7, veryfast: 6, faster: 5, fast: 4,
        medium: 3, slow: 2, slower: 1, veryslow: 0
    };
    var VP9_CPU = {
        ultrafast: 8, superfast: 7, veryfast: 6, faster: 5, fast: 4,
        medium: 2, slow: 1, slower: 0, veryslow: 0
    };

    /* ------------------------------------------------------------ utils */
    function fmtBytes(b) {
        if (!b && b !== 0) return '—';
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
        if (b < 1073741824) return (b / 1048576).toFixed(2) + ' MB';
        return (b / 1073741824).toFixed(2) + ' GB';
    }

    function baseName(name) {
        return String(name || 'video').replace(/\.[^.]+$/, '');
    }

    function extOf(name) {
        var m = String(name || '').match(/\.([a-z0-9]+)$/i);
        return m ? m[1].toLowerCase() : 'mp4';
    }

    function gcd(a, b) {
        a = Math.abs(a); b = Math.abs(b);
        while (b) { var t = b; b = a % b; a = t; }
        return a || 1;
    }

    var statusState = { key: 'st_start', vars: null, kind: '' };
    function setStatus(key, kind, vars) {
        statusState = { key: key, vars: vars || null, kind: kind || '' };
        var el = $('cmp-status');
        if (!el) return;
        el.textContent = T(key, vars);
        el.classList.remove('ok', 'err');
        if (kind === 'ok') el.classList.add('ok');
        if (kind === 'err') el.classList.add('err');
    }

    /* --------------------------------------------------- overlay control */
    function showOverlay() {
        var ov = $('upload-overlay');
        if (!ov) return;
        ov.classList.remove('hidden');
        var v = $('upload-overlay-video');
        if (v && sourceURL) {
            v.src = sourceURL;
            v.loop = true;
            v.muted = true;
            try { v.play().catch(function () {}); } catch (e) {}
        }
        if ($('upload-overlay-file')) {
            $('upload-overlay-file').textContent = sourceFile
                ? sourceFile.name + ' · ' + fmtBytes(sourceFile.size)
                : '—';
        }
        setStage(1, 0); setStage(2, 0); setStage(3, 0);
        setOverall(0, T('stg_prep'));
        resetStats();
        cancelRequested = false;
        var cb = $('ov-cancel');
        if (cb) { cb.disabled = false; cb.classList.remove('hidden'); }
    }

    function hideOverlay() {
        var ov = $('upload-overlay');
        if (ov) ov.classList.add('hidden');
        var v = $('upload-overlay-video');
        if (v) { try { v.pause(); } catch (e) {} }
    }

    function setStage(n, pct) {
        var bar = $('upload-bar-' + n);
        var pctEl = $('upload-pct-' + n);
        var step = $('upload-step-' + n);
        pct = Math.max(0, Math.min(100, pct));
        if (bar) bar.style.width = pct + '%';
        if (pctEl) pctEl.textContent = Math.round(pct) + '%';
        if (step) {
            step.classList.toggle('active', pct > 0 && pct < 100);
            step.classList.toggle('done', pct >= 100);
        }
    }

    function setOverall(pct, label) {
        pct = Math.max(0, Math.min(100, pct));
        var op = $('upload-overlay-percent');
        if (op) op.textContent = Math.round(pct) + '%';
        if (label) {
            var st = $('upload-overlay-status');
            if (st) st.textContent = label;
        }
    }

    function overallFromStages(s1, s2, s3) {
        return (s1 * 0.10) + (s2 * 0.80) + (s3 * 0.10);
    }

    function stage(n, pct, label) {
        stageVal[n] = Math.max(0, Math.min(100, pct));
        setStage(n, stageVal[n]);
        setOverall(overallFromStages(stageVal[1], stageVal[2], stageVal[3]), label);
    }

    /* -------------------------------------------------- stats (MB/speed/ETA) */
    function fmtMB(bytes) {
        var mb = bytes / (1024 * 1024);
        if (mb >= 100) return mb.toFixed(0) + ' MB';
        if (mb >= 10) return mb.toFixed(1) + ' MB';
        return mb.toFixed(2) + ' MB';
    }

    function fmtClock(sec) {
        if (!isFinite(sec) || sec < 0) return '–';
        sec = Math.round(sec);
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        if (m >= 60) {
            var h = Math.floor(m / 60);
            return h + 'j ' + (m % 60) + 'm';
        }
        return (m > 0 ? m + 'm ' : '') + (s < 10 && m > 0 ? '0' : '') + s + 's';
    }

    function resetStats() {
        liveSizeBytes = 0;
        liveMediaTime = 0;
        liveSpeedX = 0;
        execStartedAt = 0;
        lastStatsPaint = 0;
        var mb = $('ov-mb'); if (mb) mb.textContent = '0 MB';
        var sp = $('ov-speed'); if (sp) sp.textContent = '–';
        var et = $('ov-eta'); if (et) et.textContent = '–';
        var box = $('upload-overlay-stats'); if (box) box.classList.remove('hidden');
    }

    function paintStats(ratio, mediaTime, duration) {
        var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (now - lastStatsPaint < 120) return;
        lastStatsPaint = now;

        /* ukuran hasil: pakai angka asli FFmpeg kalau ada, kalau belum pakai estimasi */
        var est = duration > 0 ? estimateFinalBytes(duration) : estFinalBytes;
        var bytes = liveSizeBytes > 0 ? liveSizeBytes : Math.max(0, est * ratio);
        var mbEl = $('ov-mb');
        if (mbEl) mbEl.textContent = (liveSizeBytes > 0 ? '' : '≈ ') + fmtMB(bytes);

        /* kecepatan proses (x realtime) */
        var speed = liveSpeedX;
        if (!speed && execStartedAt && mediaTime > 0) {
            var wall = (now - execStartedAt) / 1000;
            if (wall > 0.25) speed = mediaTime / wall;
        }
        var spEl = $('ov-speed');
        if (spEl) spEl.textContent = speed > 0 ? speed.toFixed(2) + '×' : '–';

        /* ETA sisa waktu */
        var etEl = $('ov-eta');
        if (etEl) {
            if (speed > 0 && duration > 0 && mediaTime < duration) {
                etEl.textContent = fmtClock((duration - mediaTime) / speed);
            } else if (ratio >= 1) {
                etEl.textContent = '0s';
            } else {
                etEl.textContent = '–';
            }
        }
    }

    /* dipanggil tiap baris "progress=continue|end" dari stdout ffmpeg */
    function tickProgress() {
        if (!busy) return;
        var dur = totalDuration || (beforeMeta && beforeMeta.duration) || 0;
        var ratio = dur > 0 ? Math.min(1, liveMediaTime / dur) : 0;
        if (ratio > 0) {
            stage(2, Math.min(99, ratio * 100), T('stg_compress', { n: Math.round(ratio * 100) }));
        }
        paintStats(ratio, liveMediaTime, dur);
    }

    /* ubah error apa pun (Error / object / string) jadi teks yang enak dibaca */
    function errText(err) {
        if (!err) return T('err_unknown');
        if (typeof err === 'string') return err;
        if (err.message) {
            var msg = String(err.message);
            if (msg === '[object Object]' || msg === 'undefined' || msg === 'null') {
                return T('err_ffmpeg');
            }
            return msg;
        }
        try {
            var j = JSON.stringify(err);
            if (j && j !== '{}') return j;
        } catch (e) {}
        if (err.toString && err.toString() !== '[object Object]') return err.toString();
        return T('err_ffmpeg');
    }

    /* ------------------------------------------------------------- sounds */
    function playSound(kind) {
        try {
            if (typeof window.playSfx === 'function') {
                window.playSfx(kind);
                return;
            }
        } catch (e) { /* fallback di bawah */ }
        try {
            var file = kind === 'success'
                ? 'assets/MATTA_MATTA_SUOU_YUKI.mp3'
                : 'assets/Ara_Ara_Anime_Ara_Ara_Kurumi_Message.mp3';
            var src = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
                ? chrome.runtime.getURL(encodeURI(file))
                : encodeURI(file);
            var a = new Audio(src);
            a.volume = 1;
            var p = a.play();
            if (p && p.catch) p.catch(function () {});
        } catch (e2) { /* noop */ }
    }

    /* --------------------------------------------------- composer control */
    function openComposer() {
        var c = $('kompres-composer');
        if (c) c.classList.remove('hidden');
        var sc = c && c.querySelector('.composer-scroll');
        if (sc) sc.scrollTop = 0;
        syncUI();
    }

    function closeComposer() {
        var c = $('kompres-composer');
        if (c) c.classList.add('hidden');
    }

    /* ------------------------------------------------ file picker / input */
    function onFilePicked(file) {
        if (!file) return;
        if (file.type && file.type.indexOf('video/') !== 0 &&
            !/\.(mp4|mov|m4v|3gp|mkv|webm|avi)$/i.test(file.name)) {
            setStatus('st_notvideo', 'err');
            return;
        }

        sourceFile = file;
        beforeMeta = { w: 0, h: 0, duration: 0, fps: 30 };
        metaReady = false;

        /* reset info + ringkasan untuk file baru */
        infoData = { name: file.name, container: extOf(file.name), size: file.size,
                     w: 0, h: 0, duration: 0, fps: 0, vcodec: '', acodec: '', bitrate: 0, aspect: '' };
        gatherSourceInfo(file);

        if (sourceURL) { try { URL.revokeObjectURL(sourceURL); } catch (e) {} }
        sourceURL = URL.createObjectURL(file);

        var bv = $('cmp-before-video');
        if (bv) {
            bv.src = sourceURL;
            bv.load();
            bv.onerror = function () { metaReady = true; };
            bv.onloadedmetadata = function () {
                metaReady = true;
                beforeMeta.w = bv.videoWidth || 0;
                beforeMeta.h = bv.videoHeight || 0;
                beforeMeta.duration = bv.duration || 0;
                beforeMeta.fps = 30;

                /* lengkapi info video asli dari elemen <video> */
                infoData.w = beforeMeta.w || infoData.w;
                infoData.h = beforeMeta.h || infoData.h;
                infoData.duration = beforeMeta.duration || infoData.duration;
                infoData.aspect = computeAspect(infoData.w, infoData.h) || infoData.aspect;
                if (infoData.duration > 0 && infoData.size > 0) {
                    infoData.bitrate = Math.round((infoData.size * 8) / infoData.duration);
                }
                fillInfoCard();
                syncUI();

                /* putar preview sebelum (muted, loop) */
                try { bv.play().catch(function () {}); } catch (e) {}

                /* FPS asli diukur dari tabel sample (KuroMp4.inspect) */
                measureSourceFps(file);
                var res = $('cmp-before-res');
                if (res) res.textContent = (beforeMeta.w && beforeMeta.h)
                    ? beforeMeta.w + '×' + beforeMeta.h
                    : '—';
            };
        }

        var empty = $('cmp-before-empty');
        if (empty) empty.classList.add('hidden');

        var nameEl = $('cmp-filename');
        if (nameEl) nameEl.textContent = file.name;
        var metaEl = $('cmp-filemeta');
        if (metaEl) metaEl.textContent = extOf(file.name).toUpperCase() + ' · ' + fmtBytes(file.size);
        var sizeEl = $('cmp-before-size');
        if (sizeEl) sizeEl.textContent = fmtBytes(file.size);

        clearResult();

        var startBtn = $('cmp-start');
        if (startBtn) startBtn.disabled = false;
        setStatus('st_ready', 'ok');

        openComposer();
    }

    function measureSourceFps(file) {
        try {
            if (!window.KuroMp4 || typeof window.KuroMp4.inspect !== 'function') return;
            window.KuroMp4.inspect(file).then(function (m) {
                if (sourceFile !== file) return;
                var f = m && m.video && m.video.fps;
                if (f && f > 0) {
                    beforeMeta.fps = Math.round(f);
                    infoData.fps = Math.round(f);
                    fillInfoCard();
                    syncUI();
                }
            }).catch(function () {});
        } catch (e) {}
    }

    function clearResult() {
        lastBlob = null;
        lastFileName = '';
        if (lastURL) { try { URL.revokeObjectURL(lastURL); } catch (e) {} }
        lastURL = null;
        var av = $('cmp-after-video');
        if (av) { av.removeAttribute('src'); try { av.load(); } catch (e) {} }
        var ae = $('cmp-after-empty');
        if (ae) ae.classList.remove('hidden');
        var as = $('cmp-after-size');
        if (as) as.textContent = '—';
        var ar = $('cmp-after-res');
        if (ar) ar.textContent = '—';
        var sv = $('cmp-saving');
        if (sv) sv.classList.add('hidden');
        var dl = $('cmp-download');
        if (dl) dl.classList.add('hidden');
        clearResultCard();
        resetSlider();
    }

    /* -------------------------------------------------- settings helpers */
    function getVal(id) { var el = $(id); return el ? el.value : ''; }

    function levelValue() {
        var lv = getVal('cmp-level');
        if (lv === 'custom') lv = (getVal('cmp-custom-level') || '').trim();
        return lv;
    }

    function bitrateValue() {
        var b = getVal('cmp-bitrate');
        if (b === 'custom') b = (getVal('cmp-custom-bitrate') || '').trim();
        return b || '10M';
    }

    function audioBitrateValue() {
        var a = getVal('cmp-audio-bitrate');
        if (a === 'custom') a = (getVal('cmp-custom-abit') || '').trim();
        return a || '192k';
    }

    function sampleRateValue() {
        var s = getVal('cmp-samplerate');
        if (s === 'custom') s = (getVal('cmp-custom-samplerate') || '').trim();
        if (s === 'original') return '';
        return s || '';
    }

    /* ubah "10M" / "3000k" / "192k" menjadi bit per detik */
    function bpsOf(str) {
        if (!str) return 0;
        var m = String(str).trim().toLowerCase().match(/^([\d.]+)\s*([kmg]?)/);
        if (!m) return 0;
        var n = parseFloat(m[1]);
        if (!isFinite(n)) return 0;
        var u = m[2];
        if (u === 'k') n *= 1000;
        else if (u === 'm') n *= 1000000;
        else if (u === 'g') n *= 1000000000;
        return n;
    }

    /* perkiraan ukuran hasil akhir — dipakai sebelum FFmpeg melaporkan size asli */
    function estimateFinalBytes(durArg) {
        var dur = durArg || beforeMeta.duration || 0;
        var src = sourceFile ? sourceFile.size : 0;
        if (!dur) return src * 0.6;
        if ((getVal('cmp-mode') || 'crf') === 'bitrate') {
            var vb = bpsOf(bitrateValue());
            var ak = getVal('cmp-audio');
            var ab = (ak === 'copy' || ak === 'flac') ? 0 : bpsOf(audioBitrateValue());
            var total = (vb + ab) * dur / 8;
            if (total > 0) return total;
        }
        return src * 0.6;
    }

    function resolveContainer(codecKey, audioKey) {
        var chosen = getVal('cmp-container') || 'auto';
        if (chosen !== 'auto') return chosen;
        var c = CODECS[codecKey] || CODECS['x264-high'];
        if (c.mode === 'VP9' || c.mode === 'AV1') return 'mkv';
        if (audioKey === 'flac' || audioKey === 'vorbis' || audioKey === 'opus') return 'mkv';
        return 'mp4';
    }

    function syncUI() {
        var codecKey = getVal('cmp-codec') || 'x264-high';
        var c = CODECS[codecKey] || CODECS['x264-high'];

        var mode = getVal('cmp-mode');
        toggle('cmp-crf-field', mode === 'crf');
        toggle('cmp-bitrate-field', mode === 'bitrate');
        toggle('cmp-custom-bitrate-field', mode === 'bitrate' && getVal('cmp-bitrate') === 'custom');

        var aspect = getVal('cmp-aspect');
        toggle('cmp-custom-aspect-field', aspect === 'custom');

        toggle('cmp-custom-res-field', getVal('cmp-res') === 'custom');
        toggle('cmp-custom-fps-field', getVal('cmp-fps') === 'custom');

        var hasLevel = (c.mode === 'H264' || c.mode === 'H265');
        toggle('cmp-level-field', hasLevel);
        toggle('cmp-custom-level-field', hasLevel && getVal('cmp-level') === 'custom');
        toggle('cmp-mpeg4-profile-field', c.mode === 'MPEG4');

        var audio = getVal('cmp-audio');
        toggle('cmp-aac-profile-field', audio === 'aac' || audio === 'm4a');
        var hasAbit = (audio !== 'copy' && audio !== 'flac');
        toggle('cmp-audio-bitrate-field', hasAbit);
        toggle('cmp-custom-abit-field', hasAbit && getVal('cmp-audio-bitrate') === 'custom');
        toggle('cmp-custom-samplerate-field', getVal('cmp-samplerate') === 'custom');
        toggle('cmp-custom-gop-field', getVal('cmp-gop') === 'custom');

        /* keterangan turbo boost sesuai codec terpilih */
        var note = $('cmp-turbo-note');
        if (note) {
            var tm = turboMode();
            var tn = turboThreads();
            var tf = tm === '3' ? 1 : (tm === '2' ? TURBO_FILTER_SAFE_MAX : TURBO_FILTER_THREADS);
            var head = tm === '1' ? T('turbo_on')
                : tm === '2' ? T('turbo_max') : T('turbo_off');
            var tv = { head: head, tn: tn, tf: tf };
            if (tm === '3') {
                note.innerHTML = T('turbo_n1', tv);
            } else if (c.codec === 'libsvtav1') {
                note.innerHTML = T('turbo_svt', tv);
            } else if (c.codec === 'libvpx-vp9' || c.codec === 'libaom-av1') {
                note.innerHTML = T('turbo_vpx', tv);
            } else {
                note.innerHTML = T('turbo_enc', tv);
            }
        }

        /* ringkasan pilihan live */
        fillSummaryGrid('cmp-sum');
    }

    function toggle(id, show) {
        var el = $(id);
        if (el) el.classList.toggle('hidden', !show);
    }

    /* --------------------------------------------------- info video asli */
    function fmtDuration(sec) {
        if (!isFinite(sec) || sec <= 0) return '\u2014';
        sec = Math.round(sec);
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        var mm = (m < 10 && h > 0 ? '0' : '') + m;
        var ss = (s < 10 ? '0' : '') + s;
        return (h > 0 ? h + ':' + mm : m) + ':' + ss;
    }

    function setInfoField(id, val) {
        var el = $(id);
        if (el) el.textContent = (val === '' || val == null) ? '\u2014' : String(val);
    }

    function fillInfoCard() {
        setInfoField('cmp-info-name', infoData.name);
        setInfoField('cmp-info-container', infoData.container ? '.' + infoData.container : '\u2014');
        setInfoField('cmp-info-size', infoData.size ? fmtBytes(infoData.size) : '\u2014');
        setInfoField('cmp-info-res', (infoData.w && infoData.h) ? infoData.w + '\u00d7' + infoData.h : '\u2014');
        setInfoField('cmp-info-aspect', infoData.aspect || '\u2014');
        setInfoField('cmp-info-duration', fmtDuration(infoData.duration));
        setInfoField('cmp-info-fps', infoData.fps ? infoData.fps + ' FPS' : '\u2014');
        setInfoField('cmp-info-vcodec', infoData.vcodec || '\u2014');
        setInfoField('cmp-info-acodec', infoData.acodec || '\u2014');
        setInfoField('cmp-info-bitrate', infoData.bitrate > 0 ? (infoData.bitrate / 1000000).toFixed(2) + ' Mbps' : '\u2014');
    }

    function computeAspect(w, h) {
        if (!w || !h) return '';
        var g = gcd(w, h);
        return (w / g) + ':' + (h / g);
    }

    /* ambil info codec/fps/resolusi dari file (KuroMp4.inspect bila ada) */
    function gatherSourceInfo(file) {
        infoData.name = file.name;
        infoData.container = extOf(file.name);
        infoData.size = file.size;
        fillInfoCard();
        try {
            if (!window.KuroMp4 || typeof window.KuroMp4.inspect !== 'function') return;
            window.KuroMp4.inspect(file).then(function (m) {
                if (!m || sourceFile !== file) return;
                if (m.video) {
                    if (m.video.width) infoData.w = m.video.width;
                    if (m.video.height) infoData.h = m.video.height;
                    if (m.video.fps) infoData.fps = Math.round(m.video.fps);
                    if (m.video.codec) infoData.vcodec = m.video.codec;
                }
                if (m.audio && m.audio.codec) infoData.acodec = m.audio.codec;
                infoData.aspect = computeAspect(infoData.w, infoData.h) || infoData.aspect;
                fillInfoCard();
                syncUI();
            }).catch(function () {});
        } catch (e) { /* noop */ }
    }

    /* ---------------------------------------------- ringkasan pilihan */
    function summaryData() {
        var codecKey = getVal('cmp-codec') || 'x264-high';
        var c = CODECS[codecKey] || CODECS['x264-high'];
        var mode = getVal('cmp-mode') || 'crf';
        var quality;
        if (mode === 'bitrate') {
            quality = 'Bitrate ' + bitrateValue();
        } else {
            quality = 'CRF ' + (getVal('cmp-crf') || '24');
        }

        var res = getVal('cmp-res') || 'original';
        var resTxt = res === 'original' ? 'Original'
            : res === 'custom' ? (getVal('cmp-width') || '?') + '\u00d7' + (getVal('cmp-height') || '?')
            : res + 'p';

        var fps = getVal('cmp-fps') || 'original';
        var fpsTxt = fps === 'original' ? 'Original'
            : fps === 'custom' ? (getVal('cmp-custom-fps') || '30') + ' FPS'
            : fps + ' FPS';

        var asp = getVal('cmp-aspect') || 'original';
        var aspTxt = asp === 'original' ? 'Original'
            : asp === 'custom' ? (getVal('cmp-ar-w') || '16') + ':' + (getVal('cmp-ar-h') || '9')
            : asp === 'skip' ? T('sum_skip')
            : asp;

        var gop = getVal('cmp-gop') || 'auto';
        var gopTxt = gop === 'auto' ? T('sum_auto')
            : gop === 'custom' ? T('sum_sec', { n: (getVal('cmp-custom-gop') || '1') })
            : T('sum_sec', { n: gop });

        var preset = getVal('cmp-preset') || 'medium';
        var turbo = turboMode() === '1' ? T('sum_on80')
            : turboMode() === '2' ? T('sum_max100') : T('sum_off');

        var audio = getVal('cmp-audio') || 'copy';
        var audioTxt = audio === 'copy' ? T('sum_copy')
            : audio === 'm4a' ? 'M4A (AAC)'
            : audio.toUpperCase();
        if (audio !== 'copy' && audio !== 'flac') audioTxt += ' \u00b7 ' + audioBitrateValue();

        var container = resolveContainer(codecKey, audio);
        var meta = (getVal('cmp-metadata') || 'keep') === 'keep' ? T('sum_keep') : T('sum_remove');
        var fast = (getVal('cmp-faststart') || 'on') === 'on' ? T('sum_on') : T('sum_off');

        return {
            codec: c.mode + (c.profile ? ' \u00b7 ' + c.profile : ''),
            quality: quality,
            res: resTxt,
            fps: fpsTxt,
            aspect: aspTxt,
            gop: gopTxt,
            preset: preset,
            turbo: turbo,
            audio: audioTxt,
            container: container.toUpperCase(),
            metadata: meta,
            faststart: fast
        };
    }

    function fillSummaryGrid(prefix) {
        var s = summaryData();
        var map = {
            codec: s.codec, quality: s.quality, res: s.res, fps: s.fps,
            aspect: s.aspect, gop: s.gop, preset: s.preset, turbo: s.turbo,
            audio: s.audio, container: s.container, metadata: s.metadata,
            faststart: s.faststart
        };
        Object.keys(map).forEach(function (k) {
            var el = $(prefix + '-' + k);
            if (el) el.textContent = map[k];
        });
        return s;
    }

    /* ------------------------------------------------ hasil kompres (v2.3) */
    function codecLabel(key) {
        if (/^x264/.test(key)) return 'H.264 (libx264)';
        if (/^x265/.test(key)) return 'H.265 (libx265)';
        if (/^vp9/.test(key)) return 'VP9 (libvpx-vp9)';
        if (key === 'av1-svt') return 'AV1 (SVT-AV1)';
        if (key === 'av1-aom') return 'AV1 (libaom)';
        if (key === 'mpeg4') return 'MPEG-4 Part 2';
        return key;
    }

    function audioLabel(audio, aacProf) {
        if (audio === 'copy') return T('sum_copy');
        if (audio === 'm4a' || audio === 'aac') {
            return aacProf === 'HE' ? 'AAC HE (libfdk_aac)'
                : aacProf === 'HEv2' ? 'AAC HEv2 (libfdk_aac)'
                : 'AAC-LC (native)';
        }
        if (audio === 'mp3') return 'MP3 (libmp3lame)';
        if (audio === 'opus') return 'Opus (libopus)';
        if (audio === 'vorbis') return 'Vorbis (libvorbis)';
        if (audio === 'flac') return 'FLAC (lossless)';
        return audio.toUpperCase();
    }

    function fmtElapsed(ms) {
        if (!ms || ms < 0) return '\u2014';
        var total = Math.round(ms / 1000);
        var m = Math.floor(total / 60);
        var s = total % 60;
        return T('res_elapsed', { m: m, s: s });
    }

    function fillResultCard(blob, elapsedMs) {
        var card = $('cmp-result-card');
        if (!card || !blob) return;
        var codecKey = getVal('cmp-codec') || 'x264-high';
        var c = CODECS[codecKey] || CODECS['x264-high'];
        var mode = getVal('cmp-mode') || 'crf';
        var crf = getVal('cmp-crf') || '24';
        var audio = getVal('cmp-audio') || 'copy';
        var aacProf = getVal('cmp-aac-profile') || 'LC';
        var container = (lastFileName.split('.').pop() || 'mp4').toLowerCase();

        var profile = c.profile || '\u2014';
        if (c.mode === 'VP9') profile = 'Profile ' + c.profile;
        else if (c.mode === 'MPEG4') profile = 'Profile ' + (getVal('cmp-mpeg4-profile') || '3');
        else if (c.mode === 'AV1') profile = 'Main';

        var lv = levelValue();
        var dur = (beforeMeta && beforeMeta.duration) ? beforeMeta.duration : 0;
        var totalKbps = dur > 0 ? Math.round((blob.size * 8) / dur / 1000) : 0;
        var aKbps = 0;
        if (audio !== 'copy' && audio !== 'flac') aKbps = Math.round(bpsOf(audioBitrateValue()) / 1000);
        var vKbps = totalKbps > aKbps ? totalKbps - aKbps : totalKbps;

        var resW = lastBuild.resW, resH = lastBuild.resH;
        if (!resW || !resH) {
            var arEl = $('cmp-after-res');
            var arTxt = arEl ? arEl.textContent : '';
            if (arTxt && arTxt.indexOf('\u00d7') > -1) {
                resW = parseInt(arTxt.split('\u00d7')[0], 10) || 0;
                resH = parseInt(arTxt.split('\u00d7')[1], 10) || 0;
            }
        }
        if (!resW || !resH) { resW = beforeMeta.w; resH = beforeMeta.h; }

        var aspectTxt = lastBuild.aspect || computeAspect(resW, resH) || T('res_orig');
        var fpsTxt = lastBuild.fpsVal ? (Math.round(lastBuild.fpsVal * 100) / 100) + ' FPS' : '\u2014';
        var gopTxt = lastBuild.gopSec > 0
            ? T('res_gop', { s: lastBuild.gopSec, f: lastBuild.gopFrames })
            : T('res_gopauto');

        var saved = sourceFile ? sourceFile.size - blob.size : 0;
        var pct = (sourceFile && sourceFile.size > 0) ? (saved / sourceFile.size) * 100 : 0;
        var savedTxt = pct >= 0
            ? '\u2193 ' + Math.abs(pct).toFixed(2) + '% ' + T('res_saved')
            : '\u2191 ' + Math.abs(pct).toFixed(2) + '% ' + T('res_grew');

        var set = function (id, v) { var el = $(id); if (el) el.textContent = v; };
        set('cmp-res-container', '.' + container);
        set('cmp-res-vcodec', codecLabel(codecKey));
        set('cmp-res-profile', profile);
        set('cmp-res-level', lv || '\u2014');
        set('cmp-res-pixfmt', c.pix || '\u2014');
        set('cmp-res-mode', mode === 'bitrate' ? 'Bitrate' : 'CRF');
        set('cmp-res-quality', mode === 'bitrate' ? T('res_target', { v: bitrateValue() }) : ('CRF ' + crf));
        set('cmp-res-res', (resW && resH) ? resW + '\u00d7' + resH : '\u2014');
        set('cmp-res-aspect', aspectTxt);
        set('cmp-res-fps', fpsTxt);
        set('cmp-res-gop', gopTxt);
        set('cmp-res-vbitrate', vKbps > 0 ? vKbps + ' kbps' : '\u2014');
        set('cmp-res-acodec', audioLabel(audio, aacProf));
        set('cmp-res-aprofile', (audio === 'm4a' || audio === 'aac') ? aacProf : '\u2014');
        set('cmp-res-abitrate', (audio === 'copy') ? T('sum_copy')
            : (audio === 'flac') ? 'Lossless' : audioBitrateValue());
        set('cmp-res-samplerate', sampleRateValue() ? (parseInt(sampleRateValue(), 10) / 1000).toFixed(1) + ' kHz' : T('res_orig'));
        set('cmp-res-desc', (getVal('cmp-metadata') || 'keep') === 'keep' ? 'Kurokompresor' : T('res_nometa'));
        set('cmp-res-in', sourceFile ? fmtBytes(sourceFile.size) : '\u2014');
        set('cmp-res-out', fmtBytes(blob.size));
        set('cmp-res-saved', savedTxt);
        set('cmp-res-time', fmtElapsed(elapsedMs));
        set('cmp-res-filename', lastFileName || '\u2014');
        set('cmp-res-status', LX('BERHASIL'));

        resultInfo = {
            container: container, vcodec: codecLabel(codecKey), profile: profile,
            level: lv, pixfmt: c.pix, mode: mode, quality: mode === 'bitrate' ? bitrateValue() : crf,
            res: (resW && resH) ? resW + '\u00d7' + resH : '', aspect: aspectTxt, fps: fpsTxt,
            gop: gopTxt, vbitrate: vKbps, acodec: audioLabel(audio, aacProf),
            abitrate: audio === 'copy' ? 'copy' : audioBitrateValue(),
            samplerate: sampleRateValue(), desc: 'Kurokompresor',
            inSize: sourceFile ? sourceFile.size : 0, outSize: blob.size,
            savedPct: pct, elapsedMs: elapsedMs, fileName: lastFileName
        };

        card.classList.remove('hidden');
        try { if (typeof window.kuroLogResult === 'function') window.kuroLogResult(resultInfo); } catch (e) {}
    }

    function clearResultCard() {
        resultInfo = null;
        var card = $('cmp-result-card');
        if (card) card.classList.add('hidden');
    }

    function fillReview() {        var infoGrid = $('cmp-review-info');
        if (infoGrid) {
            infoGrid.innerHTML =
                item(LX('Nama File'), infoData.name) +
                item('Container', infoData.container ? '.' + infoData.container : '\u2014') +
                item(LX('Ukuran'), infoData.size ? fmtBytes(infoData.size) : '\u2014') +
                item(LX('Resolusi'), (infoData.w && infoData.h) ? infoData.w + '\u00d7' + infoData.h : '\u2014') +
                item('Aspect Ratio', infoData.aspect || '\u2014') +
                item(LX('Durasi'), fmtDuration(infoData.duration)) +
                item('FPS', infoData.fps ? infoData.fps + ' FPS' : '\u2014') +
                item('Video Codec', infoData.vcodec || '\u2014') +
                item('Audio Codec', infoData.acodec || '\u2014') +
                item(LX('Bitrate Total'), infoData.bitrate > 0 ? (infoData.bitrate / 1000000).toFixed(2) + ' Mbps' : '\u2014');
        }
        var sumGrid = $('cmp-review-summary');
        if (sumGrid) {
            var s = summaryData();
            sumGrid.innerHTML =
                item('Codec', s.codec) + item(LX('Kualitas'), s.quality) +
                item(LX('Resolusi'), s.res) + item('FPS', s.fps) +
                item('Aspect', s.aspect) + item('GOP', s.gop) +
                item('Preset', s.preset) +
                item('Audio', s.audio) + item('Container', s.container) +
                item('Metadata', s.metadata) + item('Faststart', s.faststart);
        }
    }

    function item(label, val) {
        return '<div class="cmp-info-item"><span>' + label + '</span><b>' +
            String(val == null ? '\u2014' : val) + '</b></div>';
    }

    /* -------------------------------------------------- review overlay */
    function openReview() {
        if (!sourceFile) return;
        fillReview();
        reviewOpen = true;
        var r = $('cmp-review');
        if (r) r.classList.remove('hidden');
        var sc = r && r.querySelector('.cmp-review-scroll');
        if (sc) sc.scrollTop = 0;
    }

    function closeReview() {
        reviewOpen = false;
        var r = $('cmp-review');
        if (r) r.classList.add('hidden');
    }

    /* --------------------------------------------- before/after slider */
    /* notif slider: muncul saat geser ke kiri (SESUDAH), lalu hilang
       otomatis setelah 5 detik dengan fade in/out 0.5s */
    var noteTimer = null;
    var noteShown = false;

    function showSliderNote() {
        var note = $('cmp-slider-note');
        if (!note) return;
        note.classList.remove('hidden');
        void note.offsetWidth;           /* paksa reflow supaya fade-in jalan */
        note.classList.add('is-visible');
        if (noteTimer) clearTimeout(noteTimer);
        noteTimer = setTimeout(function () {
            noteTimer = null;
            note.classList.remove('is-visible');   /* fade out 0.5s */
        }, 5000);
    }

    function hideSliderNote() {
        var note = $('cmp-slider-note');
        if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; }
        if (note) note.classList.remove('is-visible');
    }

    function applySlider(value) {
        value = Math.max(0, Math.min(100, value));
        var afterLayer = $('cmp-after-layer');
        var divider = $('cmp-divider');
        var beforeLabel = $('cmp-slider-before-label');
        var afterLabel = $('cmp-slider-after-label');
        if (afterLayer) afterLayer.style.clipPath = 'inset(0 0 0 ' + value + '%)';
        if (divider) divider.style.left = value + '%';
        if (beforeLabel) beforeLabel.style.opacity = value <= 0 ? '0' : '1';
        if (afterLabel) afterLabel.style.opacity = value >= 100 ? '0' : '1';
        /* geser ke kiri → tampilkan notif (auto hilang 5 detik) */
        var isLeft = value < 50;
        if (isLeft && !noteShown) {
            noteShown = true;
            showSliderNote();
        } else if (!isLeft && noteShown) {
            noteShown = false;
            hideSliderNote();
        }
    }

    function resetSlider() {
        var range = $('cmp-slider-range');
        if (range) range.value = '100';
        noteShown = false;
        hideSliderNote();
        applySlider(100);
    }

    function bindSlider() {
        var range = $('cmp-slider-range');
        if (range) {
            range.addEventListener('input', function () { applySlider(parseFloat(range.value)); });
        }
        /* geser langsung di area video juga bisa (drag) */
        var stage = $('cmp-slider-stage');
        if (stage) {
            var dragging = false;
            var move = function (clientX) {
                var rect = stage.getBoundingClientRect();
                if (!rect.width) return;
                var v = ((clientX - rect.left) / rect.width) * 100;
                v = Math.max(0, Math.min(100, v));
                if (range) range.value = String(v);
                applySlider(v);
            };
            stage.addEventListener('pointerdown', function (e) {
                dragging = true;
                try { stage.setPointerCapture(e.pointerId); } catch (err) {}
                move(e.clientX);
            });
            stage.addEventListener('pointermove', function (e) { if (dragging) move(e.clientX); });
            var stop = function () { dragging = false; };
            stage.addEventListener('pointerup', stop);
            stage.addEventListener('pointercancel', stop);
        }
        resetSlider();
    }

    /* ------------------------------------------------------ turbo boost
       Diturunkan dari videokompres1_7.sh, tapi nilai thread-nya dibatasi
       supaya aman terhadap pthread pool 64 milik Kuro FFmpeg Core
       (README §7: pool 64 worker, av_cpu_count() di-cap 2).

       Hasil uji langsung di WASM build ini (penting!):
         - `-threads 12` / `-threads 16`  → gagal "unwind" (pool kelebihan)
         - `-threads 4/6/8`               → OK
         - `-x264-params sliced-threads=1`→ gagal "unwind" (tidak dipakai)
         - libsvtav1 tidak punya `-lp`, harus `-svtav1-params lp=2`
       Jadi batas aman: maks 6 encoder thread + 3 filter thread (total ≪ 64).
       Mode 1 (80%) = 5 thread, mode 2 (Max) = 6 thread, mode 3 = 1 thread. */
    /* 3 mode seperti videokompres2.3.sh:
         1 = Aktif  (80% CPU core)   → thread = round(SAFE_MAX * 0.8)
         2 = Max    (100% CPU core)  → thread = SAFE_MAX
         3 = Nonaktif                → 1 thread
       SAFE_MAX = 6 karena uji di build WASM ini: 4/6/8 OK, 12/16 gagal unwind. */
    var TURBO_SAFE_MAX = 6;
    var TURBO_FILTER_SAFE_MAX = 3;

    function turboMode() {
        var v = getVal('cmp-turbo') || '1';
        return (v === '2' || v === '3') ? v : '1';
    }

    function turboThreads() {
        var m = turboMode();
        if (m === '3') return 1;
        if (m === '2') return TURBO_SAFE_MAX;
        var n = Math.round(TURBO_SAFE_MAX * 0.8);
        return Math.max(1, Math.min(TURBO_SAFE_MAX, n));   /* 5 thread */
    }

    function turboArgs(c) { return { pre: [], post: [] }; } /* Turbo Boost dihapus: thread otomatis (ffmpeg default), kecepatan mengikuti perangkat */

    /* --------------------------------------------- build ffmpeg argument */
    function buildArgs(inputPath, outputPath, container) {
        var codecKey = getVal('cmp-codec') || 'x264-high';
        var c = CODECS[codecKey] || CODECS['x264-high'];
        var mode = getVal('cmp-mode') || 'crf';
        var crf = parseInt(getVal('cmp-crf') || '24', 10);
        var preset = getVal('cmp-preset') || 'medium';

        var turbo = turboArgs(c);
        var args = ['-hide_banner', '-y'].concat(turbo.pre).concat(['-i', inputPath]);

        /* ---- VF chain: scale + fps (persis videokompres2.3.sh) ---- */
        var vfParts = [];
        var res = getVal('cmp-res') || 'original';
        lastBuild.resW = 0; lastBuild.resH = 0;
        if (res === 'custom') {
            var w = parseInt(getVal('cmp-width') || '1080', 10);
            var h = parseInt(getVal('cmp-height') || '1920', 10);
            if (w > 0 && h > 0) { vfParts.push('scale=' + w + ':' + h); lastBuild.resW = w; lastBuild.resH = h; }
        } else if (res !== 'original') {
            vfParts.push('scale=-2:' + res);
            lastBuild.resH = parseInt(res, 10) || 0;
            if (beforeMeta.w && beforeMeta.h && lastBuild.resH) {
                lastBuild.resW = Math.round((beforeMeta.w * lastBuild.resH) / beforeMeta.h / 2) * 2;
            }
        }

        /* ---- fps (pakai filter fps=, bukan -r, seperti script v2.3) ---- */
        var fpsVal = beforeMeta.fps || 30;
        var fps = getVal('cmp-fps') || 'original';
        if (fps === 'custom') {
            var cf = parseInt(getVal('cmp-custom-fps') || '30', 10);
            if (cf >= 15 && cf <= 240) {
                vfParts.push('fps=fps=' + cf);
                fpsVal = cf;
            }
        } else if (fps !== 'original') {
            vfParts.push('fps=fps=' + fps);
            var parsedFps = parseFloat(fps);
            if (!isNaN(parsedFps)) fpsVal = parsedFps;
        }
        if (vfParts.length) args.push('-vf', vfParts.join(','));
        lastBuild.fpsVal = fpsVal;

        /* ---- aspect ratio ---- */
        var asp = getVal('cmp-aspect') || 'original';
        if (asp !== 'skip') {
            var ar = null;
            if (asp === 'original') {
                if (beforeMeta.w && beforeMeta.h) {
                    var g = gcd(beforeMeta.w, beforeMeta.h);
                    ar = (beforeMeta.w / g) + ':' + (beforeMeta.h / g);
                }
            } else if (asp === 'custom') {
                var aw = parseInt(getVal('cmp-ar-w') || '16', 10);
                var ah = parseInt(getVal('cmp-ar-h') || '9', 10);
                if (aw > 0 && ah > 0) ar = aw + ':' + ah;
            } else {
                ar = asp;
            }
            if (ar) args.push('-aspect', ar);
            lastBuild.aspect = ar || '';
        } else {
            lastBuild.aspect = '';
        }

        /* ---- video codec ---- */
        args.push('-c:v', c.codec);

        /* ---- GOP / KEYFRAME (persis videokompres2.3.sh: -g hanya bila dipilih) ---- */
        var gopSel = getVal('cmp-gop') || 'auto';
        var gopSec = 0;
        if (gopSel === 'custom') gopSec = parseFloat(getVal('cmp-custom-gop') || '1');
        else if (gopSel !== 'auto') gopSec = parseFloat(gopSel);
        if (gopSec > 0 && isFinite(gopSec)) {
            var gopFrames = Math.max(1, Math.round(gopSec * fpsVal));
            args.push('-g', String(gopFrames));
            lastBuild.gopSec = gopSec;
            lastBuild.gopFrames = gopFrames;
        } else {
            lastBuild.gopSec = 0;
            lastBuild.gopFrames = 0;
        }
        var x265Params = [];

        /* ---- codec specific preset ---- */
        if (c.codec === 'libsvtav1') {
            args.push('-preset', String(AV1_PRESET[preset] != null ? AV1_PRESET[preset] : 4));
        } else if (c.codec === 'libaom-av1') {
            args.push('-cpu-used', String(AOM_CPU[preset] != null ? AOM_CPU[preset] : 3));
        } else if (c.codec === 'libx264' || c.codec === 'libx265') {
            args.push('-preset', preset);
        } else if (c.codec === 'libvpx-vp9') {
            args.push('-deadline', 'good', '-cpu-used', String(VP9_CPU[preset] != null ? VP9_CPU[preset] : 0));
        }

        /* ---- turbo boost (thread encoder) ---- */
        if (turbo.post.length) args = args.concat(turbo.post);

        /* ---- quality / bitrate ---- */
        if (c.mode === 'MPEG4' && mode === 'crf') {
            var q = Math.floor((crf - 18) / 3) * 2 + 2;
            args.push('-q:v', String(q));
        } else if (mode === 'crf') {
            if (c.codec === 'libvpx-vp9' || c.codec === 'libaom-av1') {
                args.push('-crf', String(crf), '-b:v', '0');
            } else {
                args.push('-crf', String(crf));
            }
        } else {
            var br = bitrateValue();
            args.push('-b:v', br, '-maxrate', br, '-bufsize', br);
        }

        /* ---- profile / pixel format / level ---- */
        if (c.mode === 'H264') {
            args.push('-profile:v', c.profile, '-pix_fmt', c.pix);
            var lvH = levelValue();
            if (lvH) args.push('-level:v', lvH);
        } else if (c.mode === 'H265') {
            args.push('-profile:v', c.profile, '-pix_fmt', c.pix);
            var lvX = levelValue();
            if (lvX) x265Params.push('level-idc=' + lvX.replace(/\./g, ''));
            if (x265Params.length) args.push('-x265-params', x265Params.join(':'));
        } else if (c.mode === 'VP9') {
            args.push('-profile:v', c.profile, '-pix_fmt', c.pix);
        } else if (c.mode === 'MPEG4') {
            var mp = getVal('cmp-mpeg4-profile') || '3';
            args.push('-profile:v', mp, '-pix_fmt', c.pix);
        } else if (c.mode === 'AV1') {
            args.push('-pix_fmt', c.pix);
        }

        /* ---- audio ---- */
        var audio = getVal('cmp-audio') || 'copy';
        var abit = audioBitrateValue();
        var sr = sampleRateValue();
        var aacProf = getVal('cmp-aac-profile') || 'LC';

        // WebM hanya menerima Opus/Vorbis. Paksa Opus bila perlu.
        if (container === 'webm' && audio !== 'opus' && audio !== 'vorbis') {
            audio = 'opus';
        }

        if (audio === 'copy') {
            args.push('-c:a', 'copy');
        } else if (audio === 'flac') {
            args.push('-c:a', 'flac', '-compression_level', '8');
            if (sr) args.push('-ar', sr);
        } else {
            if (audio === 'aac' || audio === 'm4a') {
                if (aacProf === 'HE') {
                    args.push('-c:a', 'libfdk_aac', '-profile:a', 'aac_he');
                } else if (aacProf === 'HEv2') {
                    args.push('-c:a', 'libfdk_aac', '-profile:a', 'aac_he_v2', '-ac', '2');
                } else {
                    args.push('-c:a', 'aac');
                }
            } else if (audio === 'mp3') {
                args.push('-c:a', 'libmp3lame');
            } else if (audio === 'opus') {
                args.push('-c:a', 'libopus');
            } else if (audio === 'vorbis') {
                args.push('-c:a', 'libvorbis');
            }
            if (abit) args.push('-b:a', abit);
            if (sr) args.push('-ar', sr);
        }

        /* ---- metadata (persis videokompres2.3.sh: tag deskripsi Kurokompresor) ---- */
        var meta = getVal('cmp-metadata') || 'keep';
        var APP_DESC = 'Kurokompresor';
        args.push('-map_metadata', meta === 'strip' ? '-1' : '0');
        args.push('-metadata', 'description=' + APP_DESC);
        args.push('-metadata', 'comment=' + APP_DESC);

        /* ---- faststart (hanya mp4/mov) ---- */
        var fast = getVal('cmp-faststart') || 'on';
        if (fast === 'on' && (container === 'mp4' || container === 'mov')) {
            args.push('-movflags', '+faststart');
        }

        /* ---- progress realtime ke stdout (diparse jadi MB/speed/ETA) ---- */
        args.push('-progress', 'pipe:1', '-stats_period', '0.4');

        args.push(outputPath);
        return args;
    }

    /* --------------------------------------------------- ffmpeg lifecycle */
    function getFFmpeg() {
        if (ffmpeg && ffmpeg.loaded) return Promise.resolve(ffmpeg);
        if (ffmpegLoading) return ffmpegLoading;

        ffmpegLoading = (async function () {
            if (typeof FFmpegWASM === 'undefined' || !FFmpegWASM.FFmpeg) {
                throw new Error(T('err_noffmpeg'));
            }
            var inst = new FFmpegWASM.FFmpeg();
            inst.on('log', function (e) {
                if (!e || !e.message) return;
                var msg = e.message;
                if (e.type === 'stderr' && /error|invalid|failed/i.test(msg)) {
                    lastFfmpegError = msg;
                }
                /* ---- progress realtime dari "-progress pipe:1" (stdout) ---- */
                if (e.type === 'stdout') {
                    var mSize = msg.match(/total_size=\s*(\d+)/);
                    if (mSize) liveSizeBytes = parseInt(mSize[1], 10);
                    var mSp = msg.match(/speed=\s*([\d.]+)\s*x/);
                    if (mSp) {
                        var sx = parseFloat(mSp[1]);
                        if (sx > 0) liveSpeedX = sx;
                    }
                    var mUs = msg.match(/out_time_us=\s*(\d+)/) || msg.match(/out_time_ms=\s*(\d+)/);
                    if (mUs) liveMediaTime = parseInt(mUs[1], 10) / 1000000;
                    if (/progress=(continue|end)/.test(msg)) tickProgress();
                    return;
                }
                /* fallback: stats stderr "size= 1234KiB ... speed=1.02x" */
                var sizes = msg.match(/size=\s*(\d+)\s*[Kk]i?B/g);
                if (sizes && sizes.length) {
                    var lastSize = sizes[sizes.length - 1].match(/(\d+)/);
                    var kb = lastSize ? parseInt(lastSize[1], 10) : 0;
                    if (kb > 0) liveSizeBytes = kb * 1024;
                }
                var speeds = msg.match(/speed=\s*([\d.]+)\s*x/gi);
                if (speeds && speeds.length) {
                    var lastSp = speeds[speeds.length - 1].match(/([\d.]+)/);
                    var spx = lastSp ? parseFloat(lastSp[1]) : 0;
                    if (spx > 0) liveSpeedX = spx;
                }
            });
            inst.on('progress', function (p) {
                if (!busy || !p) return;
                var ratio = typeof p.progress === 'number' ? p.progress : 0;
                if (!liveMediaTime && typeof p.time === 'number') liveMediaTime = p.time;
                stage(2, Math.min(99, ratio * 100), T('stg_compress', { n: Math.round(ratio * 100) }));
                paintStats(ratio, liveMediaTime,
                    typeof p.duration === 'number' && p.duration > 0 ? p.duration : totalDuration);
            });
            await inst.load();
            ffmpeg = inst;
            return inst;
        })();

        ffmpegLoading.catch(function () { ffmpegLoading = null; });
        return ffmpegLoading;
    }

    function readFileWithProgress(file, onProgress) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onprogress = function (e) {
                if (e.lengthComputable && onProgress) {
                    onProgress(e.loaded / e.total);
                }
            };
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(reader.error || new Error(T('err_read'))); };
            reader.readAsArrayBuffer(file);
        });
    }

    /* --------------------------------------------------- batalkan kompres */
    function cancelCompress() {
        if (!busy || cancelRequested) return;
        cancelRequested = true;

        var btn = $('ov-cancel');
        if (btn) btn.disabled = true;
        var st = $('upload-overlay-status');
        if (st) st.textContent = T('stg_cancelling');

        /* hentikan worker FFmpeg seketika (encode di dalam worker) */
        try {
            if (ffmpeg && typeof ffmpeg.terminate === 'function') ffmpeg.terminate();
        } catch (e) {}
        ffmpeg = null;
        ffmpegLoading = null;

        /* lepaskan await engine.exec() kalau worker mati tanpa reject */
        if (cancelReject) {
            try { cancelReject(new Error('__cancelled__')); } catch (e) {}
            cancelReject = null;
        }
    }

    /* ------------------------------------------------------- main process */
    async function startCompress() {
        if (busy) return;
        cancelRequested = false;
        cancelReject = null;
        if (!sourceFile) { setStatus('st_pickfirst', 'err'); return; }
        if (metaReady && (!beforeMeta.duration || beforeMeta.duration <= 0)) {
            setStatus('st_unreadable', 'err');
            playSound('error');
            return;
        }

        var codecKey = getVal('cmp-codec') || 'x264-high';
        var c = CODECS[codecKey] || CODECS['x264-high'];
        var container = resolveContainer(codecKey, getVal('cmp-audio'));
        if (c.mode === 'MPEG4' && container === 'webm') {
            setStatus('st_mpeg4webm', 'err');
            return;
        }
        if (container === 'webm' && c.mode !== 'VP9' && c.mode !== 'AV1') {
            setStatus('st_webmcodec', 'err');
            return;
        }

        busy = true;
        lastFfmpegError = '';
        var startBtn = $('cmp-start');
        if (startBtn) startBtn.disabled = true;
        var dlBtn = $('cmp-download');
        if (dlBtn) dlBtn.classList.add('hidden');

        showOverlay();
        var inputPath = 'input.' + extOf(sourceFile.name);
        var outputPath = 'output.' + container;

        try {
            /* ---------- STAGE 1: read + load engine ---------- */
            stage(1, 1, T('stg_reading'));
            var buf = await readFileWithProgress(sourceFile, function (r) {
                stage(1, Math.min(55, r * 55), T('stg_reading_pct', { n: Math.round(r * 100) }));
            });
            stage(1, 58, T('stg_loading'));

            var enginePromise = getFFmpeg();
            var loadTick = setInterval(function () {
                if (stageVal[1] < 96) stage(1, stageVal[1] + 1.5, T('stg_loading'));
            }, 220);

            var engine = await enginePromise;
            clearInterval(loadTick);

            stage(1, 92, T('stg_writing'));
            await engine.writeFile(inputPath, new Uint8Array(buf));
            stage(1, 100, T('stg_ready'));

            /* ---------- STAGE 2: encode ---------- */
            stage(2, 0, T('stg_compress', { n: 0 }));
            estFinalBytes = estimateFinalBytes();
            totalDuration = (beforeMeta && beforeMeta.duration) ? beforeMeta.duration : 0;
            liveSizeBytes = 0;
            liveMediaTime = 0;
            liveSpeedX = 0;
            execStartedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            var args = buildArgs(inputPath, outputPath, container);
            var cancelPromise = new Promise(function (resolve, reject) { cancelReject = reject; });
            try {
                await Promise.race([engine.exec(args), cancelPromise]);
            } catch (err) {
                cancelReject = null;
                if (cancelRequested) throw new Error('__cancelled__');
                var detail = errText(err);
                if (lastFfmpegError && detail.indexOf(lastFfmpegError) === -1) { detail = lastFfmpegError; }
                throw new Error(detail);
            }
            stage(2, 100, T('stg_done'));
            paintStats(1, beforeMeta.duration || 0, beforeMeta.duration || 0);

            /* ---------- STAGE 3: read result + download ---------- */
            stage(3, 5, T('stg_prepres'));
            var out = await engine.readFile(outputPath);
            var bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
            var mime = container === 'webm' ? 'video/webm'
                : container === 'mkv' ? 'video/x-matroska'
                : container === 'mov' ? 'video/quicktime'
                : container === 'avi' ? 'video/x-msvideo'
                : 'video/mp4';
            var blob = new Blob([bytes], { type: mime });
            if (!blob.size) throw new Error(T('err_empty'));

            lastBlob = blob;
            lastFileName = '[kompres] ' + baseName(sourceFile.name) + '.' + container;

            if (lastURL) { try { URL.revokeObjectURL(lastURL); } catch (e) {} }
            lastURL = URL.createObjectURL(blob);

            var av = $('cmp-after-video');
            if (av) {
                av.src = lastURL;
                av.load();
                av.onloadedmetadata = function () {
                    var ar = $('cmp-after-res');
                    if (ar) ar.textContent = (av.videoWidth && av.videoHeight)
                        ? av.videoWidth + '×' + av.videoHeight
                        : '—';
                };
                try { av.play().catch(function () {}); } catch (e) {}
            }
            var ae = $('cmp-after-empty');
            if (ae) ae.classList.add('hidden');
            var as = $('cmp-after-size');
            if (as) as.textContent = fmtBytes(blob.size);

            /* mulai dari posisi SEBELUM (100) — geser ke kiri untuk lihat SESUDAH */
            resetSlider();
            var bv2 = $('cmp-before-video');
            if (bv2) { try { bv2.play().catch(function () {}); } catch (e) {} }

            var saved = sourceFile.size - blob.size;
            var pct = sourceFile.size > 0 ? Math.round((saved / sourceFile.size) * 100) : 0;
            var saving = $('cmp-saving');
            var savingPct = $('cmp-saving-pct');
            if (saving) saving.classList.remove('hidden');
            if (savingPct) savingPct.textContent = Math.max(0, pct) + '%';

            /* ---- kartu HASIL KOMPRES (mirror videokompres2.3.sh) ---- */
            var elapsedMs = execStartedAt ? ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - execStartedAt) : 0;
            fillResultCard(blob, elapsedMs);

            stage(3, 70, T('stg_download'));
            downloadBlob(blob, lastFileName);
            stage(3, 100, T('stg_finished'));
            /* hapus file input setelah hasil terunduh */
            try { clearCompressInputAfterDone(); } catch (e) {}

            if (dlBtn) dlBtn.classList.remove('hidden');
            setStatus('st_done', 'ok', { a: fmtBytes(sourceFile.size), b: fmtBytes(blob.size),
                save: (pct > 0 ? T('st_saved', { p: pct }) : '') });
            playSound('success');

            var comp = $('kompres-composer');
            var sc = comp && comp.querySelector('.composer-scroll');
            if (sc) { try { sc.scrollTop = 0; } catch (e) {} }

            /* cleanup MEMFS */
            try { await engine.deleteFile(inputPath); } catch (e) {}
            try { await engine.deleteFile(outputPath); } catch (e) {}

            await new Promise(function (r) { setTimeout(r, 700); });
        } catch (err) {
            if (cancelRequested) {
                setStatus('st_cancelled', 'err');
            } else {
                console.error('[Kuro Compress]', err);
                setStatus('st_failed', 'err', { e: errText(err) });
                playSound('error');
            }
            if (ffmpeg) { try { ffmpeg.terminate(); } catch (e) {} }
            ffmpeg = null; ffmpegLoading = null;
            await new Promise(function (r) { setTimeout(r, 400); });
        } finally {
            hideOverlay();
            busy = false;
            cancelRequested = false;
            cancelReject = null;
            if (startBtn) startBtn.disabled = !sourceFile;
        }
    }

    function clearCompressInputAfterDone() {
        /* Bebaskan memori browser setelah hasil diunduh
         * (hindari kuota storage / memory pressure di GitHub Pages & Cloudflare). */
        try {
            var input = $('cmp-file-input');
            if (input) input.value = '';
        } catch (e) {}
        try {
            if (sourceURL) { URL.revokeObjectURL(sourceURL); sourceURL = null; }
        } catch (e) {}
        try {
            if (lastURL) { URL.revokeObjectURL(lastURL); lastURL = null; }
        } catch (e) {}
        sourceFile = null;
        lastBlob = null;
        lastFileName = '';
        try {
            var bv = $('cmp-before-video');
            if (bv) { bv.removeAttribute('src'); bv.load(); }
        } catch (e) {}
        try {
            var av = $('cmp-after-video');
            if (av) { av.removeAttribute('src'); av.load(); }
        } catch (e) {}
        try {
            var dzTitle = document.querySelector('#cmp-dropzone .tt-dz-title');
            if (dzTitle) dzTitle.textContent = (typeof T === 'function' ? T('cx_007') : null) || 'Pilih video untuk dikompres';
        } catch (e) {}
        try {
            var startBtn = $('cmp-start') || document.querySelector('#kompres-composer [data-action="start"], #kc-start, .composer-start-btn');
            if (startBtn) startBtn.disabled = true;
        } catch (e) {}
        try {
            var dlBtn = $('cmp-download');
            if (dlBtn) dlBtn.classList.add('hidden');
        } catch (e) {}
        /* dorong GC bila tersedia */
        try {
            if (window.__kuroResetFFmpeg) window.__kuroResetFFmpeg();
        } catch (e) {}
    }

    function downloadBlob(blob, filename) {
        try {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename || 'kompres.mp4';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                try { a.remove(); } catch (e) {}
                try { URL.revokeObjectURL(url); } catch (e) {}
            }, 1500);
        } catch (e) {
            try {
                if (chrome && chrome.downloads && chrome.downloads.download) {
                    chrome.downloads.download({ url: URL.createObjectURL(blob), filename: filename, saveAs: false });
                }
            } catch (e2) { /* noop */ }
        }
    }

    /* --------------------------------------------------------------- init */
    function bind() {
        var input = $('cmp-file-input');
        if (input) {
            input.addEventListener('change', function (e) {
                var f = e.target.files && e.target.files[0];
                if (f) onFilePicked(f);
                try { input.value = ''; } catch (e2) {}
            });
        }

        /* Tombol "Pilih video" hanya fallback (mis. aktivasi keyboard).
           Tap normal sudah ditangkap input file transparan yang menutupi
           seluruh dropzone -> file picker native / chooser file manager. */
        var pickBtn = $('cmp-pick-btn');
        if (pickBtn && input) {
            pickBtn.addEventListener('click', function (e) {
                e.preventDefault();
                try { input.click(); } catch (e2) {}
            });
        }

        var changeBtn = $('kc-change-file');
        if (changeBtn && input) {
            changeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                try { input.click(); } catch (e2) {}
            });
        }

        /* tombol batalkan kompres di overlay progres */
        var cancelBtn = $('ov-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', cancelCompress);

        /* drag & drop (mirip dropzone TikTok) */
        var dz = $('cmp-dropzone');
        if (dz) {
            var stop = function (e) { e.preventDefault(); e.stopPropagation(); };
            ['dragenter', 'dragover'].forEach(function (ev) {
                dz.addEventListener(ev, function (e) {
                    stop(e);
                    dz.classList.add('dragover');
                });
            });
            ['dragleave', 'dragend'].forEach(function (ev) {
                dz.addEventListener(ev, function (e) {
                    stop(e);
                    dz.classList.remove('dragover');
                });
            });
            dz.addEventListener('drop', function (e) {
                stop(e);
                dz.classList.remove('dragover');
                var dt = e.dataTransfer;
                var f = dt && dt.files && dt.files[0];
                if (f) onFilePicked(f);
            });
        }
        /* cegah browser membuka file saat drop di luar dropzone */
        ['dragover', 'drop'].forEach(function (ev) {
            window.addEventListener(ev, function (e) {
                if (!dz || !dz.contains(e.target)) e.preventDefault();
            }, false);
        });

        ['cmp-mode', 'cmp-res', 'cmp-fps', 'cmp-audio', 'cmp-codec', 'cmp-container',
         'cmp-level', 'cmp-aspect', 'cmp-bitrate', 'cmp-audio-bitrate', 'cmp-samplerate',
         'cmp-metadata', 'cmp-faststart', 'cmp-mpeg4-profile', 'cmp-aac-profile', 'cmp-turbo',
         'cmp-gop']
            .forEach(function (id) {
                var el = $(id);
                if (el) el.addEventListener('change', syncUI);
            });

        ['cmp-custom-level', 'cmp-custom-bitrate', 'cmp-ar-w', 'cmp-ar-h',
         'cmp-custom-abit', 'cmp-custom-samplerate', 'cmp-custom-gop']
            .forEach(function (id) {
                var el = $(id);
                if (el) el.addEventListener('input', syncUI);
            });

        /* tombol utama membuka review (info + ringkasan) dulu */
        var start = $('cmp-start');
        if (start) start.addEventListener('click', openReview);

        /* tombol di layar review */
        var reviewStart = $('cmp-review-start');
        if (reviewStart) reviewStart.addEventListener('click', function () {
            closeReview();
            startCompress();
        });
        var reviewBack = $('cmp-review-back');
        if (reviewBack) reviewBack.addEventListener('click', closeReview);
        var reviewX = $('cmp-review-x');
        if (reviewX) reviewX.addEventListener('click', closeReview);

        var dl = $('cmp-download');
        if (dl) dl.addEventListener('click', function () {
            if (lastBlob) { downloadBlob(lastBlob, lastFileName); try { clearCompressInputAfterDone(); } catch (e) {} }
        });

        /* X = keluar ke tab utama */
        var closeBtn = $('kc-close');
        if (closeBtn) closeBtn.addEventListener('click', closeComposer);

        /* Kembali = tetap di alur kompres: bila ada hasil, balik ke pengaturan
           (reset hasil + scroll atas). Bila belum ada hasil, tutup ke tab. */
        var backBtn = $('kc-back');
        if (backBtn) backBtn.addEventListener('click', function () {
            if (reviewOpen) { closeReview(); return; }
            if (lastBlob) {
                clearResult();
                setStatus('st_cleared', 'ok');
                var c = $('kompres-composer');
                var sc = c && c.querySelector('.composer-scroll');
                if (sc) { try { sc.scrollTop = 0; } catch (e) {} }
                return;
            }
            closeComposer();
        });

        /* tombol 📖 Panduan di topbar composer: buka panel panduan + scroll ke sana */
        var guideBtn = $('kc-guide-btn');
        if (guideBtn) {
            guideBtn.addEventListener('click', function () {
                var g = $('cmp-guide');
                if (!g) return;
                g.open = true;
                var c = $('kompres-composer');
                var sc = c && c.querySelector('.composer-scroll');
                if (sc) {
                    try {
                        sc.scrollTo({ top: g.offsetTop - 12, behavior: 'smooth' });
                    } catch (e) { sc.scrollTop = g.offsetTop - 12; }
                }
                g.classList.remove('kc-flash');
                void g.offsetWidth;
                g.classList.add('kc-flash');
            });
        }

        bindSlider();
        syncUI();

        /* ganti bahasa -> segarkan teks dinamis (status, catatan turbo, ringkasan) */
        document.addEventListener('kuro-lang-changed', function () {
            var el = $('cmp-status');
            if (el) el.textContent = T(statusState.key, statusState.vars);
            syncUI();
            if (reviewOpen) fillReview();
        });
        if (typeof applyLanguage === 'function') { try { applyLanguage(); } catch (e) {} }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
