# EduCAT

Platform ujian berbasis komputer (CBT) untuk sekolah. Dibangun dengan **Next.js 16**, **React 19**, **Tailwind CSS 4**, dan **Supabase** (PostgreSQL + Auth). Responsif untuk HP, tablet, dan laptop.

## Fitur

**Operator sekolah** (`/admin`)
- Daftar dan masuk dengan email; setiap sekolah hanya melihat datanya sendiri (Row Level Security)
- **Siswa**: tambah, ubah, hapus, cari, filter kelas, impor CSV, cetak kartu peserta berisi QR
- **Soal**: paket soal dengan tiga jenis soal (pilihan ganda, pilihan ganda kompleks, benar/salah), teks bacaan, bobot, pembahasan, impor JSON
- **Token**: jadwal, durasi, kuota, dan pilihan tampilan hasil (langsung atau ditahan)
- **Monitoring**: peserta yang sedang ujian, progres, pelanggaran, hentikan ujian (diperbarui tiap 5 detik)
- **Hasil**: nilai, statistik, rincian pelanggaran, ekspor CSV
- **Pengaturan**: data sekolah dan ganti kata sandi

**Siswa** (`/ujian`, tanpa akun)
- Masuk dengan token + NISN + tanggal lahir
- Waktu dihitung oleh **server**; jawaban tersimpan otomatis; bisa dilanjutkan setelah refresh atau koneksi putus
- Pencatatan pelanggaran: pindah tab, keluar layar penuh, koneksi terputus
- Hasil dan pembahasan langsung, atau ditahan sesuai pengaturan token

## Menjalankan di komputer

Butuh Node.js 20+ dan akun [Supabase](https://supabase.com) (gratis).

1. **Pasang dependensi**
   ```bash
   npm install
   ```
2. **Siapkan database.** Di Supabase buka **SQL Editor**, lalu jalankan **berurutan**:
   1. isi `supabase/schema.sql`
   2. isi `supabase/002_exam_engine.sql`

   Berkas kedua aman dijalankan ulang.
3. **Isi kunci proyek.** Salin `.env.example` menjadi `.env.local`, lalu isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dari **Project Settings → API**. Jangan memakai atau menaruh *service_role key*.
4. **Atur autentikasi** (Supabase → **Authentication**):
   - Untuk mencoba cepat, matikan **Confirm email** (Sign In / Providers → Email). Jika dibiarkan aktif, operator harus mengklik tautan di email sebelum bisa masuk.
   - Saat dipasang di internet, isi **Site URL** dengan alamat aplikasi Anda.
5. **Jalankan**
   ```bash
   npm run dev
   ```
   Buka <http://localhost:3000>.

## Alur pemakaian

1. Buka `/masuk` → tab **Daftar sekolah** → buat akun operator.
2. **Siswa** → impor `contoh/siswa-contoh.csv` atau tambah manual.
3. **Soal** → buat paket → **Impor JSON** (`contoh/soal-contoh.json`) atau tambah soal.
4. **Token** → buat token (paket, jadwal, durasi).
5. **Siswa → Cetak kartu** → pilih token, cetak atau simpan PDF, bagikan ke siswa.
6. Siswa membuka `/ujian` (atau memindai QR), memasukkan token, NISN, dan tanggal lahir.
7. Pantau di **Monitoring**, lihat nilai di **Hasil**.

### Format impor

**CSV siswa** (urutan kolom bebas, baris pertama judul): `nisn, nama, tgl_lahir, jk, kelas`. NISN 10 digit; tanggal `2014-05-01` atau `01/05/2014`. NISN yang sudah ada akan diperbarui.

**JSON soal**: lihat `contoh/soal-contoh.json`. Isi `answer`: angka mulai 0 untuk `pg`, daftar angka untuk `pgk`, daftar `true/false` untuk `bs`.

### Aturan penilaian

- `pg` dan `pgk`: bobot penuh hanya bila jawaban tepat sama dengan kunci.
- `bs`: bobot dibagi sebanding jumlah pernyataan yang dijawab benar.
- Nilai akhir = total bobot diperoleh ÷ total bobot × 100.

## Struktur proyek

```
src/
  proxy.ts                 penjaga rute /admin (sesi login)
  lib/                     klien Supabase, CSV, validasi soal, util
  components/              AppShell (navigasi responsif), komponen UI
  app/
    masuk/  mulai/         login/daftar dan penyiapan sekolah
    admin/                 siswa, soal, token, monitoring, hasil, pengaturan
    ujian/                 login siswa, mesin ujian, hasil
supabase/
  schema.sql               tabel dasar
  002_exam_engine.sql      operator, soal, RLS, fungsi ujian dan penilaian
contoh/                    contoh CSV siswa dan JSON soal
```

## Keamanan: yang perlu Anda ketahui

- Baca kebijakan keamanan repo di [`SECURITY.md`](./SECURITY.md) sebelum mengunggah perubahan.
- `NEXT_PUBLIC_SUPABASE_URL` dan publishable/anon key memang dikirim ke browser. Keduanya bukan rahasia; akses data tetap wajib dibatasi dengan grant dan kebijakan RLS yang benar.
- Jangan commit data siswa nyata, hasil ujian, ekspor, atau kredensial. Gunakan hanya data sintetis pada berkas contoh.
- **Kunci jawaban tidak pernah dikirim ke browser siswa.** Soal diambil lewat fungsi database yang tidak menyertakan kunci; penilaian dilakukan di database.
- Siswa tidak memakai akun. Tiap sesi punya kunci acak yang dipegang browser siswa dan diperiksa pada setiap permintaan.
- **Tanggal lahir berfungsi sebagai kata sandi siswa**, sehingga perlindungannya lemah (mudah ditebak oleh teman sekelas yang tahu NISN). Hal ini sesuai untuk ujian yang diawasi langsung. Untuk ujian bernilai tinggi, tambahkan PIN per siswa.
- Pencatatan pelanggaran (pindah tab, layar penuh) adalah **alat bantu pengawas, bukan jaminan**. Browser tidak bisa mencegah siswa memakai perangkat lain. Layar penuh tidak tersedia di iPhone/iPad Safari.
- `.env.local` berisi kunci proyek Anda. Berkas ini sudah di `.gitignore`; jangan membagikannya.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | server pengembangan |
| `npm run build` | build produksi |
| `npm start` | jalankan hasil build |
| `npm run lint` | pemeriksaan kode |

## Pasang di internet (Vercel)

Unggah proyek ke GitHub, impor di [Vercel](https://vercel.com), isi dua variabel lingkungan yang sama seperti `.env.local`, lalu deploy. Setelah itu isi **Site URL** di Supabase dengan alamat Vercel Anda.

## Batasan yang diketahui

- Monitoring memakai pembaruan berkala (5 detik), belum realtime.
- Belum ada pengelolaan banyak operator per sekolah, reset kata sandi lewat email di dalam aplikasi, dan analisis butir soal.
- Gambar di dalam soal belum didukung (hanya teks).
