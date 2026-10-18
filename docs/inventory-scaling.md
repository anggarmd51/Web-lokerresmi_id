# Inventori jobs faktual bertahap

CLI ini menerima **data sumber yang sudah dikumpulkan operator**; CLI tidak fetch URL dan tidak menambah data nyata saat dry-run.

## Input dan evidence

`jobs.json` berupa array 1–50 objek (praktiknya 30–50 per tahap). Setiap objek wajib memiliki `title`, `company`, `location`, `desc`/`description`, `source_url` HTTPS, `date_posted`, `valid_through`, serta `evidence` external file untuk masing-masing `desc`, `location`, `date_posted`, `valid_through`, dan `company`. Jika ada, `requirements` harus berupa array string; untuk status `Aktif`, `type` dan `category` juga wajib disuplai operator (agar tidak mengandalkan default database).

```json
[{"title":"Contoh","company":"PT Contoh","location":"Jakarta","desc":"...","source_url":"https://contoh.id/karier/1","date_posted":"2026-01-10","valid_through":"2026-02-10","evidence":{"company":{"file":"evidence/1-company.txt"},"desc":{"file":"evidence/1-desc.txt"},"location":{"file":"evidence/1-location.txt"},"date_posted":{"file":"evidence/1-date.txt"},"valid_through":{"file":"evidence/1-deadline.txt"}}}]
```

Tanggal ISO diperiksa sebagai **kalender nyata** (misalnya `2026-02-30` ditolak, termasuk untuk status Pending), bukan hanya diparse oleh `Date`. Untuk status `Aktif`, operator wajib memberi `--allow-active` dan `applyTarget` HTTPS absolut yang terverifikasi. `source_url` tetap provenance sumber dan tidak otomatis menjadi `applyTarget`.

Evidence hanya divalidasi keberadaannya dan **tidak dimasukkan ke tabel**. Pada default repo, pembacaan schema menggabungkan `supabase_schema.sql` dengan kolom yang ditambahkan migration produksi `20261019000100_lokerresmi_inventory_hardening.sql`: `date_posted date` dan `valid_through timestamptz`. Keduanya dipertahankan saat insert. `source_url`, evidence, dan fingerprint tidak dimasukkan karena memang bukan kolom `public.jobs`.

Nilai `type`, `category`, `applyType`, `applyTarget`, dan `requirements` tidak dibuat-buat: bila data baru tidak menyediakannya, CLI tidak mengarang default pekerjaan/kategori. Mapping memakai nama produksi persis (`applyType`, `applyTarget`); `requirements` diteruskan sebagai array bila disediakan.

## Jalankan

```sh
# selalu mulai dry-run (tidak memakai network dan tidak menulis DB)
node scripts/inventory-import.mjs --input ./jobs.json

# status Aktif hanya dengan opt-in dan applyTarget HTTPS
node scripts/inventory-import.mjs --input ./jobs.json --allow-active

# write eksplisit, satu insert batch; bukan update/upsert
SUPABASE_URL=... SUPABASE_ADMIN_EMAIL=... SUPABASE_ADMIN_PASSWORD=... \
  SUPABASE_ANON_KEY=... node scripts/inventory-import.mjs --input ./jobs.json --allow-active --apply
```

Dry-run hanya membaca file lokal; tidak membuat client Supabase, tidak melakukan network, dan tidak menulis database. Hanya `--apply` yang boleh melakukan write. `--apply` login memakai akun Auth admin biasa (`app_metadata.lokerresmi_admin=true`), **bukan service role key**, lalu wajib mengonfirmasi `is_lokerresmi_admin()` sebelum membaca rows untuk cap atau dedupe.

Sebelum insert, CLI:

1. menghitung ulang cap maksimal 50 baris `Aktif`;
2. membaca seluruh `jobs` dengan pagination eksplisit `.range(from, to)` sampai page terakhir (bukan limit 10.000);
3. menolak dedupe berdasarkan `title + company + location` tanpa memperhatikan tanggal; dan
4. menolak bila `source_url` input sama dengan `applyTarget` row lama, selain dedupe antar-input.

Insert tetap satu `.insert([...])`; tidak ada update/upsert. Schema target eksplisit yang tidak memiliki `date_posted` dan `valid_through` ditolak pada mode apply agar metadata tanggal tidak hilang.

Cap dan dedupe adalah pemeriksaan pra-insert. Tanpa constraint/transaksi database yang mengunci invariant tersebut, **writer lain yang berjalan bersamaan masih dapat berlomba** setelah recheck dan sebelum insert; hardening ini tidak mengklaim race concurrency sudah dihilangkan.

Uji tanpa network/database:

```sh
node --test tests/inventory.test.mjs
```
