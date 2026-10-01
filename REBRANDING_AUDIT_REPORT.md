# REBRANDING AUDIT REPORT: PINTUKARIER.ID ➔ LOKERRESMI.ID
**Dokumen Hasil Audit Menyeluruh Aset, Kode Sumber, Konfigurasi, dan Copywriting**
*Tanggal Audit: 29 September 2026*
*Target Brand Baru: Lokerresmi.id (Loker Resmi / Lokerresmi / lokerresmi.id)*

---

## Ringkasan Eksekutif (Executive Summary)
Audit ini dilakukan secara menyeluruh pada seluruh direktori proyek tanpa mengubah kode sumber fungsional. Laporan ini mengidentifikasi **seluruh kemunculan nama merek lama (`Pintukarier.id`, `Pintu Karier`, `Pintukarier`, `pintukarier`)**, URL domain lama (`https://pintukarier.vercel.app`), media sosial, kunci penyimpanan lokal/sesi (*storage keys*), struktur meta SEO/OpenGraph, hingga aset visual fisik yang perlu diganti.

Daftar temuan dikelompokkan ke dalam 4 kategori utama sesuai instruksi kerja audit:
1. **Text & Copywriting** (Judul Dokumen, Meta Tags, Heading, Paragraf, Label)
2. **Configuration & Variables** (Storage Keys, Script IDs, Config JSON, Identifier)
3. **Links, Emails & Contact Info** (URL Domain, WhatsApp Pre-filled Messages, Media Sosial)
4. **Static Assets & Manifests** (Aset Gambar Logo, Favicon, OG Image, Manifest)

---

## 1. Kategori: Text & Copywriting

### A. Dokumen HTML & Meta Tags (`index.html`)
| Path File | Nomor Baris | Kode / Teks Lama yang Ditemukan | Rekomendasi Penggantian (Lokerresmi.id) |
|---|---|---|---|
| `index.html` | 6 | `<title>Pintukarier.id - Portal Lowongan Kerja, CV ATS, dan Peluang Karier Terpercaya</title>` | `<title>Lokerresmi.id - Portal Lowongan Kerja Terverifikasi, CV ATS & Karier Terpercaya</title>` |
| `index.html` | 13 | `<meta property="og:site_name" content="Pintukarier.id" />` | `<meta property="og:site_name" content="Lokerresmi.id" />` |
| `index.html` | 15 | `<meta property="og:title" content="Pintukarier.id - Portal Lowongan Kerja, CV ATS, dan Peluang Karier Terpercaya" />` | `<meta property="og:title" content="Lokerresmi.id - Portal Lowongan Kerja Terverifikasi, CV ATS & Karier Terpercaya" />` |
| `index.html` | 24 | `<meta name="twitter:title" content="Pintukarier.id - Portal Lowongan Kerja, CV ATS, dan Peluang Karier Terpercaya" />` | `<meta name="twitter:title" content="Lokerresmi.id - Portal Lowongan Kerja Terverifikasi, CV ATS & Karier Terpercaya" />` |

---

### B. Komponen Frontend React (`src/components/JobBoard.jsx`)
| Path File | Nomor Baris | Kode / Teks Lama yang Ditemukan | Rekomendasi Penggantian (Lokerresmi.id) |
|---|---|---|---|
| `src/components/JobBoard.jsx` | 53 | `const siteName = 'Pintukarier.id';` | `const siteName = 'Lokerresmi.id';` |
| `src/components/JobBoard.jsx` | 54 | `const defaultTitle = 'Pintukarier.id \| Portal Lowongan Kerja & CV ATS';` | `const defaultTitle = 'Lokerresmi.id \| Portal Lowongan Kerja Resmi & CV ATS';` |
| `src/components/JobBoard.jsx` | 55 | `const defaultDescription = 'Temukan lowongan kerja terbaru, peluang karier, dan layanan pembuatan CV ATS profesional di Pintukarier.id.';` | `const defaultDescription = 'Temukan lowongan kerja terbaru, peluang karier, dan layanan pembuatan CV ATS profesional di Lokerresmi.id.';` |
| `src/components/JobBoard.jsx` | 85 | `<img src="/logo.png" alt="Logo Pintukarier" className="h-9 sm:h-10 w-auto object-contain" />` | `<img src="/logo.png" alt="Logo Lokerresmi.id" className="h-9 sm:h-10 w-auto object-contain" />` |
| `src/components/JobBoard.jsx` | 87 | `<span ...>PINTU KARIER.ID</span>` | `<span ...>LOKERRESMI.ID</span>` (atau `LOKER RESMI`) |
| `src/components/JobBoard.jsx` | 403 | `<h2 ...>Gabung Komunitas Loker Pintukarier.id</h2>` | `<h2 ...>Gabung Komunitas Loker Resmi (Lokerresmi.id)</h2>` |
| `src/components/JobBoard.jsx` | 414 | `<span ...>PINTU KARIER.ID</span>` | `<span ...>LOKERRESMI.ID</span>` |
| `src/components/JobBoard.jsx` | 416 | `<p ...>Pintu Menuju Karier Impianmu • Platform Informasi Lowongan Kerja & B2B Talent Terpercaya.</p>` | `<p ...>Peluang Karier Resmi & Terverifikasi • Platform Informasi Lowongan Kerja & B2B Talent Terpercaya.</p>` |
| `src/components/JobBoard.jsx` | 445 | `<p ...>© {new Date().getFullYear()} Pintukarier.id. Seluruh hak cipta dilindungi.</p>` | `<p ...>© {new Date().getFullYear()} Lokerresmi.id. Seluruh hak cipta dilindungi.</p>` |
| `src/components/JobBoard.jsx` | 956 | `<h1 ...>Pintukarier.id Control Center</h1>` | `<h1 ...>Lokerresmi.id Control Center</h1>` |

---

### C. Komponen Schema & SEO (`src/components/JobPostingSchema.jsx`)
| Path File | Nomor Baris | Kode / Teks Lama yang Ditemukan | Rekomendasi Penggantian (Lokerresmi.id) |
|---|---|---|---|
| `src/components/JobPostingSchema.jsx` | 43 | `description: fullDescription \|\| 'Informasi lowongan kerja terverifikasi di Pintukarier.id',` | `description: fullDescription \|\| 'Informasi lowongan kerja terverifikasi di Lokerresmi.id',` |
| `src/components/JobPostingSchema.jsx` | 46 | `name: 'Pintukarier.id',` (pada objek PropertyValue Schema identifier) | `name: 'Lokerresmi.id',` |
| `src/components/JobPostingSchema.jsx` | 54 | `name: job.company \|\| 'Perusahaan Mitra Pintukarier',` | `name: job.company \|\| 'Perusahaan Mitra Lokerresmi',` |

---

### D. Komponen Quick Share (`src/components/QuickShareButton.jsx`)
| Path File | Nomor Baris | Kode / Teks Lama yang Ditemukan | Rekomendasi Penggantian (Lokerresmi.id) |
|---|---|---|---|
| `src/components/QuickShareButton.jsx` | 15 | `📌 Info Lowongan Kerja di Pintukarier.id:` | `📌 Info Lowongan Kerja di Lokerresmi.id:` |
| `src/components/QuickShareButton.jsx` | 65 | `text: \`Cek lowongan ${job.title} di ${job.company} melalui Pintukarier.id\`,` | `text: \`Cek lowongan ${job.title} di ${job.company} melalui Lokerresmi.id\`,` |

---

### E. Dokumentasi & Komentar Kode
| Path File | Nomor Baris | Kode / Teks Lama yang Ditemukan | Rekomendasi Penggantian (Lokerresmi.id) |
|---|---|---|---|
| `src/lib/utils.js` | 2 | `* Utility functions for Pintukarier` | `* Utility functions for Lokerresmi.id` |
| `src/components/ErrorBoundary.jsx` | 15 | `console.error('[Pintukarier ErrorBoundary] Caught exception:', error, errorInfo);` | `console.error('[Lokerresmi ErrorBoundary] Caught exception:', error, errorInfo);` |
| `supabase_schema.sql` | 2 | `-- SKRIP MIGRASI SUPABASE LENGKAP UNTUK PINTUKARIER.ID` | `-- SKRIP MIGRASI SUPABASE LENGKAP UNTUK LOKERRESMI.ID` |
| `.github/copilot-instructions.md` | 1 | `# Panduan Koding Proyek Pintukarier` | `# Panduan Koding Proyek Lokerresmi.id` |

---

## 2. Kategori: Configuration & Variables

### A. Web Storage Keys (LocalStorage & SessionStorage)
| Path File | Nomor Baris | Variabel / Kunci Lama | Catatan & Strategi Migrasi |
|---|---|---|---|
| `src/hooks/useDarkMode.js` | 3 | `const THEME_STORAGE_KEY = 'pintukarier_theme';` | Ubah menjadi `'lokerresmi_theme'`. Tambahkan fallback membaca key lama agar preferensi tema user lama tidak reset. |
| `src/hooks/useSiteStats.js` | 4 | `const SESSION_STORAGE_KEY = 'pintukarier_visit_logged_v1';` | Ubah menjadi `'lokerresmi_visit_logged_v1'` untuk pelacakan kunjungan sesi baru yang bersih. |

---

### B. DOM Script ID & Schema Identifier
| Path File | Nomor Baris | Identifier Lama | Rekomendasi Penggantian |
|---|---|---|---|
| `src/components/JobPostingSchema.jsx` | 103 | `const scriptId = 'pintukarier-google-jobs-schema';` | Ubah menjadi `const scriptId = 'lokerresmi-google-jobs-schema';` |

---

### C. Project Manifest & Metadata
| Path File | Nomor Baris | Kunci / Nilai Lama | Catatan Lingkungan |
|---|---|---|---|
| `package.json` | 2 | `"name": "web-pintukarier"` | Dapat diubah menjadi `"name": "web-lokerresmi"` |
| `metadata.json` | 2 | `"name": "Pintukarier.id"` | *Perhatian:* Sesuai guardrail sistem AI Studio, properti `"name"` disarankan dipertahankan atau hanya disesuaikan jika diizinkan secara eksplisit oleh platform. |

---

## 3. Kategori: Links, Emails & Contact Info

### A. Tautan Domain & URL Kanonikal
| Path File | Nomor Baris | URL Lama yang Ditemukan | Rekomendasi Penggantian |
|---|---|---|---|
| `index.html` | 8 | `<link rel="canonical" href="https://pintukarier.vercel.app" />` | Sesuaikan dengan domain baru (misal: `https://lokerresmi.id` atau `https://lokerresmi.vercel.app`) |
| `index.html` | 12 | `<meta property="og:url" content="https://pintukarier.vercel.app" />` | Sesuaikan dengan domain baru |
| `index.html` | 17 | `<meta property="og:image" content="https://pintukarier.vercel.app/logo_og.png" />` | Sesuaikan dengan URL absolut domain baru |
| `index.html` | 18 | `<meta property="og:image:secure_url" content="https://pintukarier.vercel.app/logo_og.png" />` | Sesuaikan dengan URL absolut domain baru |
| `index.html` | 23 | `<meta name="twitter:url" content="https://pintukarier.vercel.app" />` | Sesuaikan dengan domain baru |
| `index.html` | 26 | `<meta name="twitter:image" content="https://pintukarier.vercel.app/logo_og.png" />` | Sesuaikan dengan URL absolut domain baru |
| `src/components/JobPostingSchema.jsx` | 55 | `sameAs: 'https://pintukarier.vercel.app',` | Sesuaikan dengan domain baru |
| `src/components/JobPostingSchema.jsx` | 56 | `logo: 'https://pintukarier.vercel.app/logo.png',` | Sesuaikan dengan domain baru |
| `src/components/QuickShareButton.jsx` | 12 | `: \`https://pintukarier.vercel.app#job-${job.id}\`;` | Sesuaikan dengan domain baru |

---

### B. Akun Media Sosial & Footer Links
| Path File | Nomor Baris | Tautan & Label Lama | Catatan Penggantian |
|---|---|---|---|
| `src/components/JobBoard.jsx` | 419 | `href="https://www.instagram.com/pintukarier.id?igsi=bTZmamhmbnNkYmto"` | Ganti ke akun Instagram resmi Lokerresmi.id |
| `src/components/JobBoard.jsx` | 423 | `<span>@pintukarier.id</span>` | Ganti ke username Instagram baru (misal: `@lokerresmi.id`) |
| `src/components/JobBoard.jsx` | 425 | `href="https://www.tiktok.com/@pintukarier.id?_r=1&_t=ZS-99NYB9OYGmb"` | Ganti ke akun TikTok resmi Lokerresmi.id |
| `src/components/JobBoard.jsx` | 429 | `<span>@pintukarier.id</span>` | Ganti ke username TikTok baru |
| `src/components/JobBoard.jsx` | 431 | `href="https://www.linkedin.com/company/pintukarierid/"` | Ganti ke profil LinkedIn Lokerresmi.id |
| `src/components/JobBoard.jsx` | 435 | `<span>pintukarier.id</span>` | Ganti label LinkedIn |
| `src/components/JobBoard.jsx` | 437 | `href="https://www.facebook.com/share/1KyKUkA7UQ/"` | Ganti ke Fanspage Facebook Lokerresmi.id |
| `src/components/JobBoard.jsx` | 441 | `<span>pintukarier.id</span>` | Ganti label Facebook |

---

### C. Pesan Otomatis WhatsApp (Pre-filled Messages)
| Path File | Nomor Baris | Teks Pesan Lama | Rekomendasi Penggantian |
|---|---|---|---|
| `src/components/JobBoard.jsx` | 485 | `const message = encodeURIComponent(\`Halo, saya ingin melamar posisi ${job.title} di ${job.company} melalui Pintukarier.id\`);` | Ganti menjadi `...melalui Lokerresmi.id` |
| `src/components/JobBoard.jsx` | 663 | `const waMessage = encodeURIComponent('Halo Admin, saya ingin memasang lowongan kerja di website Pintukarier.id');` | Ganti menjadi `...di website Lokerresmi.id` |

---

### D. Audit Email & Kontak Tambahan
- **Audit Email Hardcoded:** Tidak ditemukan email hardcoded yang mengandung `@pintukarier.id` pada form aktif (hanya placeholder generik `placeholder="email@domain.com"` pada `AdminLoginModal.jsx:52` dan `placeholder="0812xxxx atau hr@mail.com"` pada `JobBoard.jsx:722`). Jika nantinya akan disediakan email narahubung resmi publik (misal di footer), gunakan format `kontak@lokerresmi.id` atau `admin@lokerresmi.id`.
- **Nomor Admin WhatsApp:** Pada `JobBoard.jsx:662` tercatat `const adminWa = '085179905019';`. Perlu konfirmasi apakah nomor ini tetap digunakan atau diganti dengan nomor baru tim Lokerresmi.id.
- **Link Grup Komunitas:** Pada `JobBoard.jsx:405` terpasang link `https://chat.whatsapp.com/E00jf6uXmuF742oQjkvn39...`. Perlu dipastikan apakah nama grup WhatsApp komunitas sudah disesuaikan menjadi Loker Resmi / Lokerresmi.id.

---

## 4. Kategori: Static Assets & Manifests

### A. File Gambar Fisik di Direktori `public/`
| Nama File | Lokasi Fisik | Dimensi & Format | Status Audit & Tindakan |
|---|---|---|---|
| `logo.png` | `/public/logo.png` | 501 x 498 (RGBA PNG) | **Wajib Diganti Secara Fisik:** Berisi logo lama bertuliskan Pintukarier. Digunakan sebagai favicon browser (`index.html:29-30`) dan logo navbar utama (`JobBoard.jsx:85`). |
| `logo_og.png` | `/public/logo_og.png` | 501 x 498 (RGBA PNG) | **Wajib Diganti Secara Fisik:** Banner OpenGraph untuk preview kartu saat tautan dibagikan di WhatsApp, Telegram, Facebook, dan Twitter/X (`index.html:17-18,26`). |
| `IMG-20260728-WA0012 (1).png` | `/public/IMG-20260728-WA0012 (1).png` | 2158 x 2146 (RGB PNG) | **Arsip / Aset Mentah:** File logo mentah lama yang tersimpan di direktori publik (tidak dipanggil langsung oleh kode). Perlu dibersihkan atau diganti dengan master logo Lokerresmi.id. |

---

### B. Web App Manifest (`public/manifest.json`)
- **Status Audit:** Saat ini file `manifest.json` **belum ada** di direktori `public/`.
- **Rekomendasi Pembuatan:** Jika ingin mendukung instalasi Progressive Web App (PWA) atau mobile add-to-home-screen, disarankan membuat file `public/manifest.json` dengan identitas baru:
  - `name`: "Lokerresmi.id - Portal Lowongan Kerja & CV ATS"
  - `short_name`: "Lokerresmi.id"
  - `start_url`: "/"
  - `theme_color`: "#0A2540" (Navy)
  - `background_color`: "#FFFFFF"
  - Ikon 192x192 dan 512x512 berlogo Lokerresmi.id.

---

## 5. Checklist Rencana Eksekusi Rebranding (Action Plan)

Gunakan daftar centang berikut saat eksekusi perubahan diizinkan:

- [ ] **Langkah 1: Penggantian Aset Fisik**
  - [ ] Tim desain menyiapkan file gambar logo baru: `logo.png` (min 512x512 transparan).
  - [ ] Tim desain menyiapkan banner kartu sosial: `logo_og.png` (rasio optimal 1200x630 untuk OG sosial).
  - [ ] Ganti file di folder `/public/`.
- [ ] **Langkah 2: Update Copywriting & Metadata SEO**
  - [ ] Perbarui `<title>`, meta OpenGraph, dan Twitter cards di `index.html`.
  - [ ] Perbarui teks `siteName`, `defaultTitle`, dan deskripsi di `src/components/JobBoard.jsx`.
  - [ ] Perbarui teks header Navbar (`PINTU KARIER.ID` ➔ `LOKERRESMI.ID`).
  - [ ] Perbarui teks hero & komunitas (`Gabung Komunitas Loker Pintukarier.id` ➔ `Gabung Komunitas Loker Resmi`).
  - [ ] Perbarui footer copyright dan slogan.
- [ ] **Langkah 3: Update Schema & Structured Data**
  - [ ] Perbarui JSON-LD schema di `src/components/JobPostingSchema.jsx`.
  - [ ] Ubah nama publisher dan logo URL.
- [ ] **Langkah 4: Update Tautan Sosial, Domain, & Pre-filled WhatsApp**
  - [ ] Perbarui URL domain di canonical & OG jika sudah memiliki custom domain (`lokerresmi.id`).
  - [ ] Perbarui tautan Instagram, TikTok, LinkedIn, dan Facebook di Footer.
  - [ ] Perbarui teks pre-filled pesan pelamaran dan pasang loker WhatsApp.
  - [ ] Perbarui pesan bagikan pada `src/components/QuickShareButton.jsx`.
- [ ] **Langkah 5: Penyesuaian Key Storage & Variabel Internal**
  - [ ] Sesuaikan `THEME_STORAGE_KEY` dan `SESSION_STORAGE_KEY`.
  - [ ] Perbarui string pesan log di `ErrorBoundary.jsx`.
- [ ] **Langkah 6: Verifikasi Akhir & Build Test**
  - [ ] Jalankan kompilasi `npm run build` / `compile_applet`.
  - [ ] Uji responsivitas, mode gelap, tombol share, pelamaran via WhatsApp, dan render Google Structured Data.

---
*Laporan ini dihasilkan secara otomatis dan akurat melalui penelusuran menyeluruh seluruh file proyek.*
