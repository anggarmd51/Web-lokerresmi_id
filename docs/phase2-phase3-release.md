# Penyelesaian teknis Tahap 2 dan fondasi Tahap 3

## Data yang belum boleh ditebak

Enam lowongan tetap berstatus Aktif; tidak ada lowongan baru, contoh, atau fiktif yang dimasukkan oleh rilis ini. Status, featured, dan isi ID selain 47 tidak diubah. Satu-satunya penulisan data produksi adalah valid_through ID 47, berdasarkan [Astra Career](https://career.astra.co.id/lowongan/lowongan-detail-page/14308/Network%20Architect%20Section%20Head%20-%20AIHO): batas lamar 31 Desember 2026, disimpan sampai akhir hari WIB (`2026-12-31T23:59:59+07:00`).

- **ID 46, Sales Freelance:** deskripsi masih kosong. Form Google meminta login dan tidak memberikan bukti publik kepemilikan employer. [SIDUTA Medan](https://siduta.medan.go.id/main/job_vacancy/detail/2108) memuat perusahaan sama tetapi posisi berbeda (Leader Bank Digital) dan sudah berakhir Februari 2026; data itu tidak dipindahkan ke ID 46. Pemilik perlu sumber resmi untuk deskripsi/tugas, lokasi kerja, bentuk pekerjaan (judul Freelance tetapi type Full Time), tanggal publikasi, tenggat atau konfirmasi tidak ada tenggat, serta bukti form lamaran terkait employer tersebut.
- **ID 47, Network Architect Section Head - AIHO:** uraian dan tenggat dikonfirmasi sumber resmi Astra. Halaman tersebut tidak menetapkan lokasi kerja maupun kerja 100% remote/negara kandidat. Nama perusahaan/negara kantor pusat bukan bukti lokasi posisi. Pemilik perlu lokasi kerja sebenarnya atau konfirmasi 100% remote berikut negara kandidat, serta tanggal publikasi asli.

Detail yang gagal pemeriksaan dasar generator diberi `noindex,follow` dan tidak masuk sitemap detail; JSON-LD tidak diterbitkan sampai data lengkap. Ini tidak mengubah status database dan tetap mengizinkan orang membaca listing. Landings tetap mencerminkan lowongan Aktif yang benar-benar cocok dengan lokasinya, termasuk listing yang detailnya belum layak indeks.

## Bukan klaim 100% Google Jobs valid

Empat listing lain masih menghasilkan JSON-LD berdasarkan data tersimpan; itu bukan sertifikasi Google Rich Results. Semua enam `date_posted` masih NULL pada audit awal, sehingga generator lama masih memakai created_at sebagai fallback. ID 48, 49, dan 50 menyebut tenggat pada teks tetapi valid_through masih NULL; ID 51 tidak memiliki tenggat terverifikasi. Kolom tersebut tidak ditulis karena pemilik membatasi perubahan data ke ID 46/47. Penyelesaian kualitas data seluruh enam listing masih membutuhkan otorisasi/perbaikan lanjutan. [Google](https://developers.google.com/search/docs/appearance/structured-data/job-posting) mensyaratkan validThrough bila lowongan memiliki kedaluwarsa dan datePosted yang merepresentasikan tanggal publikasi sumber. Tidak semua listing wajib memiliki tanggal kedaluwarsa bila employer memang tidak menentukannya.

## Scaling dan B2B

CLI di `scripts/inventory-import.mjs` adalah dry-run secara default, dengan evidence eksternal dan review manusia; tidak mencari atau mengarang lowongan. Lihat `docs/inventory-scaling.md`. Rute landing kota dan kategori dibentuk otomatis dari lokasi eksplisit, didaftarkan dalam sitemap dinamis, dan halaman kosong diberi noindex. Remote/hybrid tidak diubah menjadi kota otomatis. Sitemap cache maksimal sekitar lima menit, ditambah revalidasi.

Pasang Lowongan adalah inquiry WhatsApp, bukan pendaftaran employer tersimpan atau transaksi pembayaran. Pilihan Standard, Featured Job, dan Paid placement masuk pesan WhatsApp. Admin harus mengonfirmasi paket, harga, employer, dan kesepakatan di luar aplikasi sebelum mengaktifkan featured. Flag featured mengatur sorotan/urutan; bukan bukti pembayaran dan tidak otomatis berubah ketika inquiry dibuka. Tidak ada pembayaran yang dilakukan pada rilis ini.

Event GA4: `open_employer_inquiry`, `select_featured_job_package` ketika inquiry valid diteruskan, `employer_inquiry_handoff`, dan existing `select_cv_package` dengan nilai/currency IDR. Analytics employer hanya mengirim nama paket dan sumber, bukan perusahaan, nomor WhatsApp, atau isi inquiry. Handoff tidak berarti pesan sudah terkirim, pembayaran diterima, atau transaksi berhasil. Penerimaan event di akun GA4 perlu dibedakan dari pemanggilan gtag pada browser; ad blocker/koneksi dapat menghalangi pengiriman.
