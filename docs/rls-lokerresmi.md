# Patch RLS LokerResmi.id

Patch disiapkan dari commit `b337542f006bd4848ebb5095a90472665b5cf6db` pada repository `anggarmd51/Web-lokerresmi_id`. Keempat patch frontend sudah terpasang dan build lokal berhasil pada verifikasi akhir.

## Status produksi: migrasi sudah diterapkan

Target produksi yang sebelumnya telah dicocokkan dengan deployment Vercel `lokerresmi.id` adalah project ref `jtccysnofujwgframdzm`. Pemeriksaan read-only riwayat migrasi mengonfirmasi ketiganya sudah diterapkan berurutan:

| Berkas lokal | Versi tercatat di produksi |
|---|---|
| `20261017000100_lokerresmi_admin_predicate.sql` | `20261017183913` |
| `20261017000200_lokerresmi_jobs_rls.sql` | `20261017183924` |
| `20261017000300_lokerresmi_cv_orders_rls.sql` | `20261017183936` |

**Jangan jalankan ulang ketiga migrasi atau bootstrap pada produksi ini.** Versi riwayat produksi berbeda dari timestamp nama berkas lokal; jangan menjalankan `supabase db push` ke produksi tanpa rekonsiliasi riwayat yang ditinjau terpisah. Berkas SQL disimpan di repo sebagai sumber dan referensi urutan, bukan instruksi penerapan ulang. Verifikasi akhir ini tidak mengubah database produksi.

## Pastikan project sebelum menjalankan SQL

Cocokkan **nilai deployment** `VITE_SUPABASE_URL` dengan project ref di dashboard Supabase. Nama project `WEBSITE PINTUKARIER.ID` dan kemiripan tabel **bukan bukti** bahwa project itu dipakai LokerResmi.id. Jangan menerapkan patch pada project tersebut sebelum pemetaannya terkonfirmasi.

Backup definisi policy/grant kedua tabel sebelum menggantinya. Migration menghapus **semua** policy yang ada pada `public.jobs` dan `public.cv_orders`, termasuk yang namanya tidak dikenal, karena policy permisif lama bisa membuka akses kembali. Grant tingkat tabel dan kolom untuk PUBLIC/anon/authenticated juga direset hanya pada kedua tabel tersebut. Sequence yang disentuh hanya sequence `id` milik kedua tabel, bila ada.

## Modul SQL, urutan wajib

1. `supabase/migrations/20261017000100_lokerresmi_admin_predicate.sql`: fungsi pemeriksaan admin.
2. `supabase/migrations/20261017000200_lokerresmi_jobs_rls.sql`: jobs publik read-only, penulisan khusus admin.
3. `supabase/migrations/20261017000300_lokerresmi_cv_orders_rls.sql`: insert-only publik dan pengelolaan pesanan khusus admin.

Setiap berkas memakai transaksi sendiri dan bisa dijalankan ulang. Untuk target yang tabelnya sudah ada, jalankan **hanya ketiga migration**, bukan seluruh `supabase_schema.sql`. Bootstrap schema diubah agar tidak memasang ulang policy lama; bagian `site_stats` dan RPC `increment_site_views` tidak diubah atau dijalankan.

| Operasi | Anonim | Login biasa | Admin tepercaya |
|---|---|---|---|
| jobs: SELECT | Ya | Ya | Ya |
| jobs: INSERT/UPDATE/DELETE | Tidak | Tidak | Ya |
| cv_orders: INSERT pesanan baru | Ya | Ya | Ya |
| cv_orders: SELECT/UPDATE/DELETE | Tidak | Tidak | Ya |

SELECT jobs tetap mencakup seluruh baris sebagaimana kebutuhan publik read-only, bukan filter status baru. Jika draft harus disembunyikan, itu perlu kebijakan publikasi terpisah.

## Admin tidak sama dengan pengguna login

Kode lama menganggap sesi Supabase apa pun sebagai admin. Schema repo tidak memiliki definisi `profiles` maupun pemeriksaan `is_admin`, sehingga patch **tidak mengasumsikan** tabel `profiles` dari project yang belum terkonfirmasi.

Keputusan otorisasi baru memakai boolean `app_metadata.lokerresmi_admin = true` dari JWT yang diterbitkan Supabase Auth. Tetapkan flag hanya untuk akun admin yang sudah diverifikasi melalui dashboard Auth atau Admin API di backend tepercaya. Ini **langkah provisioning baru yang wajib**, bukan alur yang diklaim sudah tersedia. Jangan menetapkan semua akun authenticated sebagai admin. Jangan memakai `user_metadata`, email yang dipilih pengguna, atau state browser sebagai sumber hak akses.

Contoh backend saja, dengan client Admin API yang sudah dikonfigurasi aman:

```js
const { data, error } = await supabaseAdmin.auth.admin.getUserById(adminUserId);
if (error) throw error;
const result = await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
  app_metadata: { ...data.user.app_metadata, lokerresmi_admin: true },
});
if (result.error) throw result.error;
```

Jangan memasukkan service-role key ke Vite/browser. Setelah provisioning, admin harus refresh sesi atau login ulang. Perubahan/pencabutan flag tidak mengubah JWT lama seketika; token lama dapat tetap berlaku sampai kedaluwarsa. Jika tidak ada flag, akses admin gagal tertutup; UI dan RLS memanggil predikat yang sama. `service_role` backend tetap melewati RLS sebagaimana desain Supabase dan tidak boleh diberikan kepada pengunjung.

## Payload pesanan yang benar-benar dipakai

Aplikasi mengirim `name`, `whatsapp`, `package`, `status: 'Menunggu Review'`, dan `date` bertipe tanggal. Tidak ada `user_id` atau alur akun pemesan. Karena itu publik **tidak bisa membaca pesanan apa pun, termasuk pesanannya sendiri**; ini bukan implementasi kepemilikan per pengguna.

Kolom `client_name` pada metadata yang disebutkan tidak dikirim oleh aplikasi. Migration memeriksa keberadaan kolom payload, serta menolak schema dengan kolom wajib tanpa default di luar payload. Jika `client_name` ternyata NOT NULL tanpa default, selaraskan schema/payload setelah memastikan project target; jangan menebak atau menggandakan nama otomatis.

INSERT dibatasi ke lima kolom payload. `id`, `created_at`, dan kolom tambahan tidak bisa dikirim publik. Policy menolak status awal selain `Menunggu Review`, nama/WhatsApp/paket kosong, dan tanggal NULL. `date` tetap boleh dikirim karena dipakai aplikasi; ini bukan timestamp audit tepercaya. `created_at` tetap berasal dari default tabel. Validasi format nomor, katalog/harga paket, CAPTCHA dan rate limit bukan jaminan RLS; insert publik tetap membutuhkan perlindungan spam terpisah.

## Perubahan aplikasi yang harus dipasang bersama SQL

- `useAuth.js`: pemeriksaan admin melalui RPC `is_lokerresmi_admin`, bukan sekadar sesi login.
- `useCVOrders.js`: fetch hanya untuk admin; insert tanpa `.select().single()`; kegagalan tidak menjadi pesanan lokal/sukses palsu; update/delete admin memeriksa ada baris yang terpengaruh. Respons fetch lama diabaikan setelah logout.
- `JobBoard.jsx`: memakai izin admin, mempertahankan isi form bila penyimpanan gagal, menolak pemasangan lowongan publik, dan menghentikan UPDATE penghitung pelamar dari browser. Tautan melamar dan alur WhatsApp yang sudah ada tetap berjalan. Membuka WhatsApp bukan bukti penyimpanan database.
- `supabase.js`: fallback tanpa konfigurasi tidak lagi mengaku insert berhasil.
- `supabase_schema.sql`: tidak lagi membuat policy/grant API lama untuk jobs/cv_orders. Perubahan ini sendiri tidak mencabut policy pada database yang sudah ada; ketiga migration tetap wajib.

Pemasangan lowongan publik dan penghitung pelamar publik memerlukan backend terpisah jika kelak dibutuhkan; jangan membuka UPDATE/INSERT jobs publik untuk mengembalikannya.

## Pengujian

`supabase/tests/lokerresmi_rls.sql` hanya untuk **database lokal kosong**, bernama `local_lokerresmi_rls_test`, dengan role anon/authenticated/service_role yang belum ada. Gunakan cluster pengujian terisolasi. Jalankan sebagai administrator PostgreSQL:

```sh
createdb local_lokerresmi_rls_test
psql -X -v ON_ERROR_STOP=1 -d local_lokerresmi_rls_test -f supabase/tests/lokerresmi_rls.sql
npm run build
git diff --check
```

Fixture menguji policy lama dengan nama asing, column grants, insert publik valid, penolakan baca/ubah/hapus dan RETURNING, status palsu, spoof id/timestamp, role non-admin, user_metadata palsu, CRUD admin, service_role, dan migration dijalankan dua kali. Fixture Auth menggunakan claim lokal, bukan layanan Auth/JWT produksi. Uji integrasi PostgREST dan login di staging project yang telah dipastikan tetap diperlukan sebelum rollout.

Rollback jangan dengan mengaktifkan kembali policy permisif. Gunakan backup policy/grant yang sudah ditinjau, atau perbaikan maju. Jangan menerapkan policy ownership `auth.uid() = user_id` tanpa migrasi model data yang terpisah.
