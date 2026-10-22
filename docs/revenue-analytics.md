# Analitik lead dan pendapatan

## Yang dirilis

`purchase` **belum diaktifkan**. Pemeriksaan skema Supabase production `jtccysnofujwgframdzm` menunjukkan `cv_orders` hanya memiliki `id`, `created_at`, `client_name`, `whatsapp`, `package`, `status`, `date`, dan `name`. Tidak ada nominal pembayaran aktual, currency, atau trigger pembayaran. Alur B2B hanya membangun tautan WhatsApp; tidak ada tabel order/pembayaran B2B dalam skema public yang diperiksa.

Panel admin CV menawarkan `Menunggu Review`, `Sedang Dikerjakan`, dan `Selesai`. Ketiganya adalah status proses, bukan bukti pembayaran. `updateCVStatus` hanya menyimpan status; perubahan manual ke `Lunas`/`paid` pun tidak cukup tanpa nominal terverifikasi. Rilis ini tidak menambahkan status, migrasi, akses database, ataupun pembaruan order historis.

## Event yang dapat diverifikasi

| Tindakan | Event | Batas makna |
| --- | --- | --- |
| Memilih paket CV | `select_cv_package` yang sudah ada | Minat awal. `value` lama adalah harga katalog, bukan omzet. |
| Insert CV berhasil ke Supabase | `generate_lead` | `lead_type=cv_order`, `lead_stage=order_created`, `source=order_form` |
| Inquiry B2B valid diteruskan ke WhatsApp | `generate_lead` | `lead_type=employer_inquiry`, `lead_stage=handoff`, `source=whatsapp`; bukan bukti pesan terkirim atau pembayaran |
| Form tidak valid, insert gagal/ditolak | Tidak ada lead baru | Tidak mengarang keberhasilan |
| Perubahan status admin | Tidak ada `purchase` | Belum ada sumber nominal aktual |

Lead hanya mengirim metadata tetap dan `package_id` dari allowlist. Paket CV: `cv_express`, `cv_professional`, `cv_vip`, fallback `cv_custom`. Paket employer: `employer_standard`, `employer_featured`, `employer_paid_placement`, fallback `employer_custom`. Teks bebas tidak diteruskan. Nama, WhatsApp, perusahaan, kebutuhan rekrutmen, isi CV, URL WhatsApp, dan nominal tidak masuk payload lead. Event GA4 lama dipertahankan. Analytics gagal/tidak tersedia tidak boleh memblokir pemesanan.

Handoff dihitung setelah pemanggilan `window.open` tidak melempar error; popup yang diblokir tetap menyediakan tautan fallback dan tidak membuktikan pengiriman pesan. Lead bukan transaksi dan bukan metrik jumlah order unik: submit terpisah dapat menghasilkan lead terpisah. Tidak ada klaim penerimaan GA4 atau akurasi omzet 100% dari pemanggilan gtag.

## Keputusan dan data yang diperlukan untuk purchase

Sebelum aktivasi, pemilik perlu menyepakati apa yang dihitung sebagai pendapatan (lunas penuh versus cicilan/deposit, diskon, pajak/biaya, dan refund), lalu menyimpan nominal yang benar-benar diterima dalam field terproteksi admin, misalnya `amount_paid` bertipe numeric dan `currency` ISO-4217, beserta `paid_at` dan referensi bukti pembayaran yang tidak dikirim ke GA4. Harga dalam nama paket tidak boleh dipakai sebagai pengganti. Untuk B2B, perlu order/invoice tersimpan dengan ID permanen dan item layanan; label “Paid placement” bukan bukti lunas.

Rancangan payload sesudah prasyarat tersebut tersedia:

- `transaction_id`: ID order stabil dengan namespace, misalnya `cv_order:<id>` dan `b2b_order:<id>`; bukan nama/telepon, timestamp baru, atau ID yang berubah saat retry.
- `value`: nominal pembayaran aktual tersimpan sesuai keputusan pembukuan, bukan harga katalog.
- `currency`: currency tersimpan dan tervalidasi; jangan mengasumsikan IDR ketika sumber belum menyimpannya.
- `items`: item ID layanan dari katalog tepercaya, quantity, dan price yang merekonsiliasi `value`; tanpa teks pelanggan.

Trigger harus berasal dari transisi status non-paid ke `Lunas`/`paid` yang berhasil disimpan oleh admin/webhook berwenang, bukan dari render halaman, pemilihan paket, insert order, atau status proses. Implementasi server/database lebih tepat agar perubahan dari SQL/dashboard juga tercakup dan event tidak dianggap sebagai pembelian oleh browser admin.

Gunakan outbox transaksional dengan unique key `(event_name, transaction_id)` dan snapshot payload pembayaran saat transisi, plus transaction_id sama pada retry untuk deduplikasi GA4. Guard transisi saja tidak cukup untuk siklus paid → non-paid → paid. Tidak boleh memindai/backfill order lama. Outbox dan field pembayaran tidak boleh terbuka bagi anon; pertahankan RLS admin dan jangan mengekspos service-role/API secret di bundle `VITE_*`.

Jika pengiriman memakai GA4 Measurement Protocol, perlu API secret GA4 server-side yang sah serta kebijakan atribusi/consent dan client identifier pseudonim; jangan menggunakan identitas admin sebagai identitas pembeli. Measurement ID publik `G-RW0RL1ZPKV` bukan API secret. Rilis ini tidak membuat secret, webhook, atau pengirim purchase yang belum dapat diverifikasi.

## Verifikasi aman

Pengujian berjalan offline dengan gtag dan Supabase mock. Kasus mencakup lead CV sukses, form/insert gagal, status `Lunas`/`paid`/`Selesai`, submit inquiry valid/invalid, metadata allowlist dan kegagalan analytics. Tidak ada order nyata diubah menjadi paid, purchase test dikirim ke properti GA4 live, ataupun historical backfill. `npm test` dan `npm run build` harus lulus sebelum push.
