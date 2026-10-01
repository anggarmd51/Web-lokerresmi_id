# Project State - Lokerresmi.id

## Project Status: REBRANDED & LIVE IN PRODUCTION 🚀

### Production Details
- **Production URL:** https://lokerresmi.id (Sebelumnya: pintukarier.vercel.app)
- **Backend / Database:** Supabase (PostgreSQL with RLS & Auth)
- **Deployment Platform:** Vercel (SPA routing configured via `vercel.json`)
- **Current Phase:** Fase Rebranding (Eksekusi Rebranding Massal Lokerresmi.id) - **COMPLETED**

---

### Overview
Lokerresmi.id adalah platform informasi lowongan kerja terverifikasi dan portal rekrutmen B2B terpercaya di Indonesia dengan fitur lowongan dinamis, integrasi Google Structured Data (Jobs Schema), layanan pembuatan CV ATS profesional, dan dashboard Superadmin berbasis Supabase.

---

### Fase Rebranding - Completed Deliverables:

1. **Eksekusi Rebranding Massal (Codebase Clean of "Pintukarier"):**
   - **Teks, Copywriting & Meta SEO:**
     - `index.html`: Mengganti `<title>`, canonical URL, OpenGraph site name, meta title, deskripsi, Twitter card title/image, dan URL ke `lokerresmi.id`.
     - `src/components/JobBoard.jsx`: Mengganti konstanta `siteName = 'Lokerresmi.id'`, `defaultTitle`, `defaultDescription`, teks alt logo (`alt="Logo Lokerresmi"`), badge navbar (`LOKER RESMI`), heading komunitas (`Gabung Komunitas Loker Resmi (Lokerresmi.id)`), slogan footer, copyright (`Lokerresmi.id`), pesan WhatsApp pelamar, pesan WhatsApp pengajuan lowongan mitra, serta header Superadmin (`Lokerresmi.id Control Center`).
     - `src/components/JobPostingSchema.jsx`: Memperbarui schema description, identifier name (`Lokerresmi.id`), hiringOrganization (`Perusahaan Mitra Lokerresmi`), canonical domain URL, dan logo URL.
     - `src/components/QuickShareButton.jsx`: Memperbarui URL default, template pesan share WhatsApp (`📌 Info Lowongan Kerja di Lokerresmi.id:`), dan native share text.
   - **Konfigurasi, Storage Keys & Identifier:**
     - `src/hooks/useDarkMode.js`: Mengganti `THEME_STORAGE_KEY` dari `'pintukarier_theme'` menjadi `'lokerresmi_theme'`.
     - `src/hooks/useSiteStats.js`: Mengganti `SESSION_STORAGE_KEY` dari `'pintukarier_visit_logged_v1'` menjadi `'lokerresmi_visit_logged_v1'`.
     - `src/components/JobPostingSchema.jsx`: Mengganti script ID DOM ke `'lokerresmi-google-jobs-schema'`.
     - `package.json` & `bun.lock`: Mengganti `"name"` dari `"web-pintukarier"` menjadi `"lokerresmi"`.
     - `metadata.json`: Mengganti `"name"` menjadi `"Lokerresmi.id"`.
   - **Tautan, Media Sosial & Narahubung:**
     - Tautan media sosial footer disesuaikan ke akun Lokerresmi.id (`@lokerresmi.id` untuk Instagram & TikTok, `lokerresmiid` untuk LinkedIn, dan Facebook Lokerresmi.id).
     - Nomor admin WhatsApp tetap dipertahankan (`085179905019`) dengan sapaan otomatis diperbarui ke Lokerresmi.id.
   - **Komentar & Panduan Teknis:**
     - `src/lib/utils.js`: Komentar header diubah ke `Lokerresmi`.
     - `src/components/ErrorBoundary.jsx`: Log error exception diubah ke `[Lokerresmi ErrorBoundary]`.
     - `supabase_schema.sql`: Header migrasi diubah ke `LOKERRESMI.ID`.
     - `.github/copilot-instructions.md`: Header panduan koding diubah ke `Lokerresmi`.

2. **Audit Aset & Dokumentasi Rebranding:**
   - Tersedia dokumen detail `REBRANDING_AUDIT_REPORT.md` untuk referensi audit masa depan.
   - File gambar fisik logo baru beresolusi 1617x1617 telah disinkronkan ke `/public/logo.png` dan `/public/logo_og.png`.

3. **Penyempurnaan Teks Navbar & Integrasi Aset Visual:**
   - Memperbarui teks badge navbar pada `src/components/JobBoard.jsx` secara presisi menjadi **"LOKER RESMI.ID"**.
   - Memastikan tag `<img>` logo di `src/components/JobBoard.jsx` menggunakan `src="/logo.png"` dengan atribut `alt="Logo Lokerresmi.id"`.
   - Memverifikasi referensi favicon dan OpenGraph di `index.html` dan `JobBoard.jsx` yang menunjuk secara bersih ke `/logo.png` dan `/logo_og.png`.

4. **Sinkronisasi Tab Favicon & Exact Document Title (`index.html`):**
   - Memperbarui tag `<title>` pada `index.html` menjadi presisi: `Lokerresmi.id - Portal Lowongan Kerja Terverifikasi, CV ATS & Karier Terpercaya`.
   - Memperbarui meta tag `og:title` dan `twitter:title` dengan teks merek baru yang seragam.
   - Memverifikasi dan menyematkan link icon favicon (`<link rel="icon" type="image/png" href="/logo.png" />`, `<link rel="shortcut icon" type="image/png" href="/logo.png" />`, serta `<link rel="apple-touch-icon" href="/logo.png" />`).
   - Memastikan metadata OpenGraph dan Twitter image menunjuk ke asset `/logo_og.png`.

5. **Pembaruan Tautan Resmi Media Sosial / CTA (`src/components/JobBoard.jsx`):**
   - Memperbarui tautan Facebook resmi: `https://www.facebook.com/lokerresmi.id`
   - Memperbarui tautan LinkedIn resmi: `https://www.linkedin.com/company/lokerresmiid/`
   - Memperbarui tautan Instagram resmi: `https://www.instagram.com/lokerresmi_id?stkn=MWtwcTJjbnUydHVsag==` (handle label: `@lokerresmi_id`)
   - Memperbarui tautan TikTok resmi: `https://www.tiktok.com/@lokerresmi_id?_r=1&_t=ZS-9A9A8EQU2js` (handle label: `@lokerresmi_id`)
   - Memastikan seluruh tautan menggunakan `target="_blank"` dan `rel="noopener noreferrer"`.

---

### Fase 3 - Eksekusi Modular (Services Section Refactor & Order Modal) - COMPLETED:
1. **Pembaruan Tombol Lead Magnet CTA:**
   - Mengubah tombol CTA utama dari "Pesan Pembuatan CV Sekarang" menjadi **"Cek Skor CV dengan AI (Gratis)"**.
   - Menghubungkan tombol ke notifikasi toast interaktif yang menginformasikan rilis fitur AI skor CV yang akan datang.

2. **Carousel Slider Horizontal 3 Paket Layanan (Pricing Tiers):**
   - Mengganti pricing card statis menjadi kontainer slider horizontal yang responsif (`flex overflow-x-auto snap-x gap-4 pb-4`).
   - Menyediakan 3 tingkatan paket lengkap:
     - **Tier 1 (Paket Express):** Rp 49.000 (Format ATS Teruji, Template Premium, AI Generated Content).
     - **Tier 2 (Paket Profesional):** Rp 99.000 dengan badge "Populer" (Format ATS Teruji & Lolos HR, Redaksi Bahasa Profesional & SEO, Konsultasi & Revisi Tanpa Batas).
     - **Tier 3 (Paket VIP Mentoring):** Rp 249.000 (Semua di Paket Pro, Simulasi Interview HR, Prioritas Rekomendasi Loker B2B).
   - Setiap kartu paket dilengkapi tombol "Pilih Paket" yang langsung membuka modal pemesanan.

3. **Modal Form Pemesanan & Pre-selection:**
   - Memperbarui `OrderCVModal` dengan dukungan pre-selection otomatis paket yang diklik oleh calon klien melalui state `selectedPackage`.
   - Form mencakup input nama lengkap, nomor WhatsApp aktif, serta dropdown pemilihan paket 3 tier.

4. **Integrasi WhatsApp Redirect & Cloud Persistence:**
   - Tombol "Kirim Pesanan Sekarang" mengeksekusi redirect WhatsApp dengan pesan template terenkode rapi:
     `https://wa.me/6285179905019?text=Halo%20Admin%20Lokerresmi.id,%20saya%20[Nama]%20ingin%20memesan%20[Nama%20Paket].%20Mohon%20info%20selanjutnya.`
   - Secara bersamaan mencatat data pesanan ke database Supabase (`cv_orders`) agar tersinkronisasi dengan dashboard Superadmin.

5. **AI CV ATS Checker Modal with Gemini API & Lead Magnet Upsell (`AICVCheckerModal.jsx`):**
   - Menghubungkan tombol "Cek Skor CV dengan AI (Gratis)" untuk membuka `AICVCheckerModal`.
   - Menyediakan formulir input teks CV (wajib) dengan tombol bantuan "Gunakan Contoh CV" dan input posisi/deskripsi lowongan target (opsional).
   - Integrasi Gemini API (`import.meta.env.VITE_GEMINI_API_KEY`) dengan model cerdas untuk analisis kompatibilitas ATS berstruktur JSON: skor (0-100), ringkasan eksekutif, kelebihan, kekurangan, rekomendasi perbaikan, dan missing keywords.
   - Mekanisme graceful fallback client-side simulator jika API key tidak tersedia atau koneksi offline, menjamin aplikasi tidak pernah crash.
   - Tampilan visual gauge score meter dengan kode warna dinamis (Merah <60, Kuning 60-79, Hijau 80+).
   - Banner Upsell Lead Magnet konversi tinggi dengan tombol aksi langsung yang menutup modal AI dan membuka `OrderCVModal` dengan pre-selected "Paket Profesional (Rp 99.000)".

6. **Pembaruan Fitur Unggah Dokumen PDF pada AI CV ATS Checker (`AICVCheckerModal.jsx`):**
   - Menggantikan input textarea teks manual dengan antarmuka unggah dokumen PDF modern berbasis drag-and-drop dan click-to-browse.
   - Validasi file murni client-side: membatasi format dokumen hanya `.pdf` dan ukuran maksimum 5MB dengan feedback toast interaktif.
   - Menyediakan fitur preview file terpilih (nama dokumen, ukuran file dalam KB/MB, status verifikasi) serta aksi tombol hapus / ganti file.
   - Ekstraksi payload base64 dokumen PDF menggunakan native browser `FileReader` (`readAsDataURL`) tanpa dependensi pustaka parsing pihak ketiga eksternal.
   - Integrasi Gemini API multimodal dengan payload `inlineData` (`application/pdf`) dan model cerdas (`gemini-3.1-flash-lite` & `gemini-3.8-flash`) untuk audit dokumen langsung dan ekstraksi skor ATS terstruktur JSON.
   - Menyediakan tombol pemuatan contoh PDF siap pakai ("Gunakan Contoh PDF") agar pengguna dapat menguji fungsionalitas langsung dengan 1-klik.
   - Mekanisme fail-safe cerdas dengan simulasi analisis client-side jika koneksi terputus atau API key belum terpasang, menjaga UX pengguna tetap mulus dan bebas crash.

7. **Perbaikan Stuck Loading & Penguatan Fail-Safe API Gemini (`AICVCheckerModal.jsx`):**
   - Mengatasi isu loading tak terbatas (*stuck loading*) saat analisis PDF dengan jaminan eksekusi reset state `setAnalyzing(false)` di dalam blok `finally`.
   - Pembersihan respons JSON yang tangguh (*robust JSON parsing*) dari blok format markdown Gemini (` ```json ... ``` `) serta isolasi kurung kurawal terluar `{ ... }`.
   - Menambahkan pelindung batas waktu (*timeout guard*) 15 detik menggunakan `AbortController` pada request `fetch` ke Gemini API dan batas waktu 10 detik pada pembacaan `FileReader`.
   - Validasi ketat integritas data Base64 `inlineData.data` sebelum memicu panggilan jaringan.
   - Pengalihan otomatis (*graceful fallback*) ke simulasi analisis ATS cerdas saat terjadi error status (400, 429, 503) atau timeout, disertai banner peringatan informatif: *"Menggunakan analisis cepat (Mode Standby)"*.

8. **Pengembangan Fitur AI Cover Letter Generator Modal (`AICoverLetterModal.jsx`):**
   - Membangun komponen modal `AICoverLetterModal.jsx` sebagai lead magnet baru untuk pembuatan surat lamaran kerja terpersonalisasi secara instan berbasis AI.
   - Form input terstruktur: Posisi / Judul Pekerjaan (wajib), Nama Perusahaan, Deskripsi / Kualifikasi Pekerjaan, 3 Pilihan Tone of Voice (Profesional & Formal, Santai & Dinamis, Percaya Diri & Tegas), serta Unggah CV PDF (Maks. 5MB) berfitur drag-and-drop dan tombol bantuan muat contoh.
   - Integrasi konversi PDF ke Base64 via native `FileReader`, pemanggilan Gemini API multimodal dengan payload `inlineData`, timeout guard 15 detik menggunakan `AbortController`, dan reset state pemuatan terjamin pada blok `finally`.
   - Mekanisme fail-safe fallback ke draf surat lamaran profesional jika terjadi kendala jaringan/timeout dengan banner peringatan *"Analisis Cepat (Mode Standby Preview)"*.
   - Area hasil surat lamaran yang dapat disunting langsung (*editable textarea*) dan tombol salin teks ke clipboard.
   - Fitur ekspor langsung dokumen ke berkas PDF terformat rapi (A4) menggunakan `html2pdf.js`.
   - Banner Lead Magnet pesanan CV ATS profesional yang membuka modal pemesanan WhatsApp (`OrderCVModal`).
   - Integrasi tombol pemicu pada seksi Layanan Karir (`CVServicePromo` di `JobBoard.jsx`) bersanding dengan tombol AI CV ATS Checker.

9. **Penyempurnaan Ekspor Cover Letter PDF ke Layout A4 Profesional (`AICoverLetterModal.jsx`):**
   - Menyelaraskan instruksi prompt Gemini agar tidak menggunakan pemisah baris kaku (*hard line breaks*) di tengah kalimat, hanya memisahkan paragraf dengan `\n\n`, serta membatasi panjang surat ~250-300 kata agar presisi muat dalam 1 halaman A4.
   - Menjaga antarmuka textarea penyuntingan tetap bersih dan fleksibel bagi pengguna tanpa merusak format PDF yang dihasilkan.

10. **Perbaikan Blank PDF Export dengan Metode HTML String (`AICoverLetterModal.jsx`):**
    - Merefaktor fungsi `downloadPDF` untuk menghindari manipulasi DOM langsung (`createElement`, `document.body.appendChild`, `removeChild`) yang rentan blank screen akibat pembatasan sandbox iframe atau race conditions pada `html2canvas`.
    - Memetakan paragraf dari teks cover letter langsung menjadi variabel HTML string murni dengan wrapper `<div style="padding: 15mm; font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 1.5; text-align: justify; color: #000;">` dan setiap paragraf dibungkus `<p style="margin-bottom: 12px; margin-top: 0;">`.
    - Menghubungkan langsung `html2pdf().set(opt).from(htmlString).save()` dengan konfigurasi `margin: 0`, skala 2, dan orientasi A4 portrait, menjamin dokumen PDF yang dihasilkan terisi penuh, terformat rapi (*justified*), dan tidak blank.

11. **Tuning Prompt AI Cover Letter Standar Rekrutmen Modern 2026 (`AICoverLetterModal.jsx`):**
    - Mengintegrasikan tanggal dinamis aktual (`new Date().toLocaleDateString('id-ID')`) ke dalam prompt sistem dan template simulasi fallback, mencegah pencantuman tahun lampau secara permanen.
    - Menghilangkan frasa pembuka pasif/klise ("melalui surat ini saya bermaksud...") dan menggantinya dengan pembuka lugas yang langsung menargetkan posisi, nama perusahaan, serta proposisi nilai utama.
    - Melarang penggunaan kata-kata klise tanpa bukti ("bertanggung jawab penuh", "disiplin, jujur, pembelajar cepat", "kecepatan menyusun") serta placeholder tanda tangan `(Tanda Tangan)`.
    - Menekankan bukti kompetensi berbasis aksi aktif (*action-oriented evidence* seperti "berperan dalam mengelola...", "terbiasa bekerja secara terstruktur dan teliti") yang selaras dengan kualifikasi lowongan.
    - Menetapkan batasan panjang surat 200–250 kata dengan pemisah `\n\n` agar presisi 1 halaman A4 saat diekspor.

12. **Perbaikan Deadlock Loading Tak Terbatas pada AI Cover Letter Modal (`AICoverLetterModal.jsx`):**
    - Mengoptimalkan timeout pemanggilan Gemini API: alokasi 8 detik untuk `gemini-3.1-flash-lite` dan 6 detik untuk `gemini-3.8-flash` dengan batas pembacaan file 6 detik.
    - Mengimplementasikan `timeoutPromise` 16 detik pada `Promise.race` yang menyelesaikan (*resolve*) draf simulasi standar secara anggun (*graceful fallback*) tanpa melemparkan eksepsi keras (*unhandled hard rejection*).
    - Memastikan eksekusi `setIsGenerating(false)` dipanggil secara pasti di dalam blok `finally`, menjamin tombol aksi selalu kembali aktif (*re-enabled*).
    - Menghilangkan galat `Batas waktu pemrosesan 20 detik terlampaui`: jika pemrosesan memakan waktu atau koneksi jaringan lambat, sistem secara mulus memuat draf surat lamaran terpersonalisasi via `generateSimulatedCoverLetter()` dengan notifikasi toast informatif.

---

### Phase 5 - Completed Deliverables:

1. **SPA Routing Configuration (`vercel.json`):**
   - Configured `vercel.json` at root with URL rewrites to `/index.html` (`"source": "/(.*)", "destination": "/index.html"`).
   - Prevents HTTP 404 Not Found errors when users reload or directly navigate to client-side paths/subroutes on Vercel.

2. **Reverse Tabnabbing Protection (Point 10):**
   - Added `rel="noopener noreferrer"` to the WhatsApp community group link in `src/components/JobBoard.jsx`.
   - Updated all social media links (Instagram, TikTok, LinkedIn, Facebook) to use `rel="noopener noreferrer"`.
   - Added `rel="noopener noreferrer"` to client WhatsApp links in the CV orders management table.
   - Updated all `window.open(..., '_blank', 'noopener,noreferrer')` calls in `JobBoard.jsx` and `QuickShareButton.jsx` to prevent opener window hijacking.

3. **Elimination of LocalStorage Auth Bypass (Points 11, 12, 13):**
   - Completely stripped all `localStorage.getItem('pintukarier_admin_logged_in')`, `setItem`, and `removeItem` statements from `src/hooks/useAuth.js`.
   - Admin authentication state (`isLoggedIn`) is now strictly derived from genuine Supabase session tokens via `supabase.auth.getSession()` and real-time session updates from `supabase.auth.onAuthStateChange`.
   - Added an explicit session-loading guard (`authLoading`) in `JobBoard.jsx` to ensure `SuperAdminDashboard` renders only after Supabase cryptographically verifies the active user session.

4. **Row Level Security (RLS) Hardening in Database Schema (Points 4, 16, 17, 18):**
   - Updated `supabase_schema.sql` with hardened PostgreSQL Row Level Security policies:
     - **Tabel `jobs`:**
       - SELECT & INSERT diizinkan untuk `anon` dan `authenticated` (pencari kerja & pembuat lowongan publik).
       - UPDATE & DELETE dibatasi secara ketat hanya untuk pengguna berstatus `authenticated` (`auth.role() = 'authenticated'`).
     - **Tabel `cv_orders`:**
       - INSERT diizinkan untuk `anon` dan `authenticated` (pemesanan layanan CV publik).
       - SELECT, UPDATE, & DELETE dibatasi secara ketat hanya untuk pengguna berstatus `authenticated` (`auth.role() = 'authenticated'`), melindungi privasi data pribadi (PII) pelamar.
     - **Tabel `site_stats`:**
       - SELECT diizinkan untuk publik, sedangkan modifikasi langsung dibatasi untuk `authenticated` (increment kunjungan atomik dilayani secara aman melalui fungsi `increment_site_views()` SECURITY DEFINER).

5. **Perbaikan PostgreSQL Reserved Keyword Syntax (`"desc"`):**
   - Mengatasi error `ERROR: 42601: syntax error at or near "desc"` pada `supabase_schema.sql`.
   - Mengapit keyword reserved PostgreSQL `desc` dengan double quotes menjadi `"desc"` pada tabel `public.jobs`, menjaga kompatibilitas 100% dengan properti `job.desc` di React/Vite.
   - Menambahkan pernyataan idempotent `ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "desc" TEXT;` untuk menjamin kelancaran eksekusi jika tabel sudah pernah dibuat sebelumnya.
   - Mengaudit seluruh kolom (`date`, `package`, `status`, `requirements`, dll) dan memastikan tidak ada reserved keyword unquoted lainnya yang bermasalah.

6. **Perbaikan Missing Column `updated_at` pada `site_stats`:**
   - Mengatasi error `ERROR: 42703: column "updated_at" of relation "site_stats" does not exist` saat eksekusi SQL di Supabase.
   - Memperbarui definisi tabel `public.site_stats` menjadi `updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`.
   - Menambahkan pernyataan migrasi idempotent:
     `ALTER TABLE public.site_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`
     sebelum operasi INSERT inisialisasi maupun pembuatan fungsi `increment_site_views()`.
   - Memverifikasi konsistensi kolom di seluruh fungsi RPC `increment_site_views()` dan hook `useSiteStats.js`.

---

### Fase 4 - Codebase Audit, Refactoring & Cleanup (COMPLETED):

1. **Category 1: Dead Code & AI Junk Cleanup:**
   - Melakukan audit menyeluruh pada seluruh berkas di direktori `src/` (`.jsx`, `.js`, `.css`).
   - Memverifikasi seluruh 16 icon `lucide-react` pada modal, navbar, dan kartu lowongan aktif digunakan tanpa ada import yatim (*orphan imports*).
   - Membersihkan log konsol yang bising: menurunkan `console.error` menjadi penanganan terstruktur pada `AICVCheckerModal.jsx` dan `AICoverLetterModal.jsx`.
   - Mengonfirmasi tidak adanya blok kode usang atau kode mati yang dikomentari (*commented-out legacy code*).

2. **Category 2: Edge Cases & Defensive Programming:**
   - Menambahkan pengamanan input pada `AdminLoginModal.jsx`: sanitasi `trim()` untuk email dan password serta validasi eksplisit string kosong/whitespace.
   - Menambahkan sanitasi `trim()` pada `jobDesc` di `AICVCheckerModal.jsx` dan `AICoverLetterModal.jsx`.
   - Memperkuat kestabilan dan keunikan `key` props pada perulangan daftar persyaratan lowongan kerja di `JobBoard.jsx` (`key={`job-req-${job.id || 'curr'}-${idx}`}`).

3. **Category 3: Performance & Re-render Optimization:**
   - Menambahkan `copyTimeoutRef` dan fungsi pembersihan unmount `useEffect` pada `QuickShareButton.jsx` untuk mencegah kebocoran memori (*memory leaks*) saat komponen ditutup sebelum timeout selesai.
   - Menambahkan fungsi pembersihan `useEffect` pada `JobPostingSchema.jsx` untuk mencopot tag skrip `<script id="lokerresmi-google-jobs-schema">` dari `document.head` saat komponen di-unmount.
   - Memastikan hooks realtime Supabase (`useSiteStats.js`, `useAuth.js`) memiliki mekanisme `unsubscribe()` dan `removeChannel()` yang tepat.

4. **Category 4: Build & Dependency Audit:**
   - Memverifikasi berkas `package.json` berstatus ramping dan bebas dari pustaka yang tidak terpakai atau terduplikasi (hanya 5 dependensi inti: `@supabase/supabase-js`, `html2pdf.js`, `lucide-react`, `react`, `react-hot-toast`).
   - Verifikasi kompilasi bundel aplikasi via `compile_applet` berhasil 100% bersih tanpa galat build.

---

### Fase 5 - Strict 20-Point Security Audit & Production Readiness (COMPLETED):

1. **Secrets & Environment Hardening (Checks 1-4):**
   - **Check 1 [LULUS]:** Tidak ada hardcoded Gemini API Key di seluruh client-side code (`src/components/AICVCheckerModal.jsx` & `src/components/AICoverLetterModal.jsx`). Kunci diambil murni via `import.meta.env.VITE_GEMINI_API_KEY`.
   - **Check 2 [LULUS]:** Menghapus konstanta cadangan `defaultAnonKey` dari `src/lib/supabase.js`. Kunci anonim Supabase sekarang 100% dipasok melalui `import.meta.env.VITE_SUPABASE_ANON_KEY`.
   - **Check 3 [LULUS]:** Bebas dari Supabase Service Role Key (`service_role`). Tidak ada kunci service role yang tertinggal atau terekspos di sisi klien (`src/lib/supabase.js`).
   - **Check 4 [LULUS]:** Seluruh variabel konfigurasi lingkungan diakses konsisten melalui `import.meta.env.VITE_*` yang disuntikkan secara aman via `vite.config.js`.

2. **Debug & Error Leakage Mitigation (Checks 5-6):**
   - **Check 5 [LULUS]:** Pada `src/components/AICoverLetterModal.jsx`, penanganan galat `try/catch` tidak mengekspos jejak tumpukan (*stack traces*) maupun pesan sistem mentah ke pengguna; pengguna disajikan pesan ramah pengguna dan draf surat standar terpersonalisasi.
   - **Check 6 [LULUS]:** Pada `src/components/AICVCheckerModal.jsx`, penanganan galat `try/catch` mengalihkan secara halus ke simulasi analisis ATS (Mode Standby) dengan umpan balik toast generik yang aman tanpa membocorkan rincian kegagalan internal.

3. **Input Sanitization & Injection Prevention (Checks 7-10):**
   - **Check 7 [LULUS]:** Sanitasi input posisi kerja target (`jobTitle`) pada `AICoverLetterModal.jsx` menggunakan `sanitizePromptInput`: pemotongan maksimal 100 karakter, eliminasi karakter kontrol, dan pembersihan tanda *code fence* (```) untuk mencegah pembobolan prompt.
   - **Check 8 [LULUS]:** Sanitasi input nama perusahaan (`companyName`) pada `AICoverLetterModal.jsx` menggunakan batas panjang 100 karakter dan pembersihan karakter injeksi.
   - **Check 9 [LULUS]:** Sanitasi deskripsi pekerjaan (`jobDescription`) pada `AICVCheckerModal.jsx` dan `AICoverLetterModal.jsx` menggunakan `sanitizePromptInput` (maks. 1500–2000 karakter, pembersihan pembatas markdown, dan pembungkusan string aman `JSON.stringify`).
   - **Check 10 [LULUS]:** Validasi whitelist gaya bahasa (`toneLabel`) pada `AICoverLetterModal.jsx` terhadap `TONE_OPTIONS` yang terdaftar untuk mencegah manipulasi opsi tak valid.

4. **Authentication & Access Control Hardening (Checks 11-16):**
   - **Check 11 [LULUS]:** `src/components/AdminLoginModal.jsx` memproses autentikasi secara eksklusif via `supabase.auth.signInWithPassword`, diverifikasi secara kriptografis oleh server Supabase.
   - **Check 12 [LULUS]:** Tidak ada perbandingan kata sandi hardcoded atau kredensial demo pada kode klien (`AdminLoginModal.jsx` & `useAuth.js`).
   - **Check 13 [LULUS]:** Nol bypass otentikasi via `localStorage`. Hak akses admin murni didasarkan pada token sesi aktif Supabase Auth.
   - **Check 14 [LULUS]:** Validasi input email dan kata sandi diperkuat: pemangkasan whitespace (`trim()`), pemeriksaan non-empty, serta validasi regex format email standar (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) sebelum pengiriman ke Supabase.
   - **Check 15 [LULUS]:** Persistensi sesi dikelola secara aman oleh Supabase SDK via `getSession` dan sinkronisasi realtime `onAuthStateChange` pada `src/hooks/useAuth.js`.
   - **Check 16 [LULUS]:** Komponen `SuperAdminDashboard` pada `src/components/JobBoard.jsx` dilindungi secara ketat: menunggu verifikasi status `authLoading` dan hanya dirender jika `isLoggedIn` bernilai true.

5. **Database & File Security Hardening (Checks 17-20):**
   - **Check 17 [LULUS]:** Validasi unggah berkas PDF pada `src/components/AICVCheckerModal.jsx` memverifikasi ekstensi `.pdf`, MIME type `application/pdf`, serta verifikasi integritas *magic bytes* header PDF (`JVBERi` / `%PDF-`) pada payload Base64 sebelum diproses.
   - **Check 18 [LULUS]:** Pembatasan ukuran file pada `AICVCheckerModal.jsx` secara ketat memblokir berkas lebih dari 5MB (`5 * 1024 * 1024` bytes) dengan notifikasi penolakan instan.
   - **Check 19 [LULUS]:** Validasi unggah berkas PDF pada `src/components/AICoverLetterModal.jsx` memverifikasi ekstensi `.pdf`, MIME type `application/pdf`, dan *magic bytes* header `%PDF-`.
   - **Check 20 [LULUS]:** Pembatasan ukuran berkas pada `AICoverLetterModal.jsx` secara ketat dibatasi maksimal 5MB.

---

### Previous Phases Summary:
- **Phase 1 - 3:** UI/UX Architecture, ATS CV Order Flow, Job Posting & Filtering, Supabase Integration, Real-time Site Views Tracking.
- **Phase 4:** Code Cleanup, Removal of dead components/legacy monolithic assets, integration of `react-hot-toast`, removal of hardcoded demo credentials.

---

### Decisions Made:
- Standardized SPA fallback rewriting via `vercel.json` to ensure single-page routing stability on Vercel deployments.
- Enforced zero-trust authentication on client-side state by removing any bypasses in localStorage.
- Schema migration scripts are strictly idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`) to prevent migration breakage on existing Supabase projects.
- Preserved all existing frontend models, props, and UI design without regressions.

---

### Verification:
- **Compilation Check (`compile_applet`):** Build succeeded without errors or warnings.
- **Vercel Routing:** Verified `vercel.json` rewrites syntax according to Vercel official documentation.
- **Security Check:** Tabnabbing mitigation verified, zero localStorage auth tokens, strict RLS deployed in SQL definitions.

---

### Open Issues:
- None. All tasks and security enhancements across all phases are complete and deployed.
