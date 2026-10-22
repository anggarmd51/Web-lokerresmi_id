# Pembayaran terverifikasi dan analitik pendapatan

## Alur admin

Tab **Pembayaran CV & B2B** mencatat pembayaran penuh yang benar-benar diterima. Admin mengisi nominal aktual dan mata uang, lalu memilih **Tandai Lunas**. Harga katalog tidak pernah mengisi nominal otomatis. Form inquiry B2B tetap diteruskan ke WhatsApp: bukan order tersimpan atau pembayaran. Setelah kesepakatan nyata, admin membuat order B2B manual dengan paket Standard, Featured Job, atau Paid placement; order baru selalu belum dibayar.

Tabel `cv_orders` dan `b2b_orders` memiliki `amount_paid` numeric, `currency` default IDR, `paid_at` timestamptz, dan `transaction_id` permanen yang dibuat database. B2B dan outbox dilindungi RLS admin. Hak INSERT publik CV tetap hanya nama, WhatsApp, paket, status awal, dan tanggal; field keuangan tidak dapat disisipkan pengunjung.

Status `Lunas`/`paid` hanya sah setelah transisi UPDATE oleh admin dengan claim Supabase Auth `app_metadata.lokerresmi_admin=true`. Nominal harus finite, positif, maksimal 1 triliun dan dua desimal (JPY bilangan bulat). Mata uang yang didukung: IDR, USD, SGD, MYR, EUR, AUD, GBP, JPY. `paid_at` ditetapkan database saat konfirmasi, bukan tanggal transfer yang diketik admin. Setelah dibayar, nominal, mata uang, waktu, paket, dan identitas transaksi terkunci. Status proses CV tetap dapat berubah ke Sedang Dikerjakan/Selesai tanpa menghapus bukti pembayaran atau menambah pendapatan.

## Kapan purchase dibuat

Trigger database membuat satu snapshot outbox hanya pada transisi pembayaran terverifikasi. Unique transaction ID mencegah event baru pada status berulang, perubahan paid → non-paid → paid, refresh, dan klik ganda. Tidak ada backfill pembayaran lama. Pengisian ID permanen pada baris lama bukan pengakuan pendapatan.

Payload resmi berisi `transaction_id`, `value` dari nominal aktual, `currency`, dan satu item dengan `item_id`, nama katalog tetap, `quantity=1`, serta `price` yang sama dengan value. Paket CV dikenali secara tepat sebagai `cv_express`, `cv_professional`, `cv_vip`; paket tak dikenal menjadi `cv_custom`/Layanan CV tanpa menyalin teks bebas. B2B memakai ID `employer_standard`, `employer_featured`, `employer_paid_placement`. Nama pelanggan/perusahaan, nomor WhatsApp, CV, dan isi inquiry tidak dikirim.

Setelah UPDATE sukses di panel, browser meminta `POST /api/purchase` menggunakan sesi admin. Endpoint memverifikasi sesi ke Supabase, memeriksa predicate admin, lalu mengambil snapshot tepercaya melalui RPC atomik `claim_purchase`. Body hanya menerima transaction ID, tidak menerima nominal atau item dari browser. Pengiriman GA4 Measurement Protocol berlangsung server-side; bukan melalui gtag atau identitas GA admin. Client ID pseudonim acak per transaksi digunakan agar order tidak teratribusi ke admin; ini bukan atribusi sesi pembeli atau bukti consent pengunjung. Ad user data dan ad personalization ditandai DENIED. Penggunaan tetap bergantung pada hak/pengungkapan privasi yang dikonfirmasi pemilik di GA4.

Transisi yang dibuat melalui SQL/dashboard dengan JWT admin menghasilkan outbox, tetapi tidak melakukan network call dari database. Pengiriman item pending dapat dimulai admin lewat tombol di tab pembayaran. Tidak ada cron, webhook, atau background worker baru dalam rilis ini.

## Jaminan dan batas pengiriman

Status outbox: `pending` → `sending` → `sent` atau `uncertain`. Claim hanya dapat diambil satu pemanggil. Endpoint melakukan maksimal satu percobaan network per transaksi. Respons 2xx ditampilkan sebagai **Diterima endpoint GA4**, bukan bukti bahwa event sudah diproses atau masuk laporan GA4.

Jika secret belum dikonfigurasi, data pembayaran tetap tersimpan dan outbox tetap pending; setelah konfigurasi selesai, admin dapat mengirim item pending. Refresh hanya membaca status, tidak mengirim event. Jika koneksi/timeout/respons gagal terjadi sesudah claim, status menjadi uncertain atau tetap sending bila proses terputus; tidak ada retry otomatis. Admin harus memeriksa catatan sebelum pemulihan manual. Tombol pengiriman tidak disediakan untuk uncertain/sending. Pendekatan konservatif ini menghindari duplikasi, tetapi bisa kehilangan delivery pada kegagalan ambigu; database dan API eksternal tidak dapat dijamin exactly-once secara atomik. Transaction ID tetap sama untuk audit dan bila kelak dibuat pemulihan terkontrol.

## Konfigurasi production

- Stream yang diizinkan: `G-RW0RL1ZPKV`, dibaca dari `GA4_MEASUREMENT_ID` atau `VITE_GA_MEASUREMENT_ID`.
- `GA4_API_SECRET` hanya server, tidak boleh memakai prefix `VITE_` atau masuk bundle/git.
- Endpoint memakai URL dan anon key Supabase yang sudah tersedia serta JWT admin; tidak memerlukan service-role key.
- GA4 belum memiliki Measurement Protocol secret ketika diperiksa. Pembuatan secret memerlukan persetujuan pemilik atas pernyataan Pengumpulan Data Pengguna Google. Selama belum disetujui/dikonfigurasi, delivery sengaja tetap pending, tanpa fallback ke browser admin.
- Setelah mengubah environment Vercel, lakukan deployment baru. Jangan menguji dengan purchase live palsu.

## Event yang dipertahankan

`select_cv_package` tetap menyatakan minat dengan harga katalog, bukan omzet. INSERT CV yang berhasil memicu `generate_lead`; inquiry B2B valid yang diteruskan ke WhatsApp memicu `generate_lead` berstatus handoff, bukan bukti pesannya terkirim atau lunas. Tidak ada perubahan payload event-event tersebut.

## Pengujian aman

`npm test` menjalankan tes JavaScript offline dengan mocks (175 tes pada rilis ini), termasuk autentikasi admin, payload resmi, metadata tanpa PII, claim paralel, konfigurasi kosong, kegagalan ambigu, dan larangan retry. `bash supabase/tests/run_verified_purchase.sh` membuat database lokal terisolasi, menguji RLS/trigger/RPC serta regresi status NULL, NaN/Infinity, precision, timestamp palsu, katalog, dan replay, lalu membuang database fixture. `npm run build` memvalidasi bundle production. Tidak ada pembayaran nyata diubah, order uji dibuat di production, atau event purchase uji dikirim ke GA4 live.
