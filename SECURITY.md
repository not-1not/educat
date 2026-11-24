# Kebijakan Keamanan EduCAT

Dokumen ini menetapkan aturan keamanan untuk kode, data, dan kredensial EduCAT.

## Data dan kredensial

- Jangan commit atau mengirim data pribadi siswa/staf, termasuk nama, NISN, tanggal lahir, nilai, jawaban, token ujian aktif, kartu peserta, atau ekspor CSV.
- Berkas di `contoh/` harus berisi data sintetis saja. Jangan menyalin data produksi ke contoh, tangkapan layar, issue, log, atau dokumentasi.
- Jangan commit `.env`, `.env.local`, konfigurasi lokal asisten, cadangan database, atau berkas kredensial. `.env.example` hanya boleh berisi placeholder.
- Jangan pernah menaruh password database, private key, token akses, `service_role`, atau Supabase secret key di kode, browser, `NEXT_PUBLIC_*`, log, atau repository.
- `NEXT_PUBLIC_SUPABASE_URL` dan publishable/anon key boleh terlihat di browser. Key tersebut bukan pengganti autentikasi dan tidak membatasi akses baris data.
- Simpan rahasia deployment hanya di environment variables penyedia hosting atau GitHub Actions Secrets. Berikan izin minimum dan jangan mencetak nilainya ke log.

## Supabase dan data aplikasi

- Aktifkan RLS pada setiap tabel di schema yang terekspos. Berikan grant minimum yang diperlukan, lalu buat policy yang membatasi data sesuai sekolah dan peran; login saja tidak cukup untuk mengizinkan akses ke semua baris.
- Uji akses yang diizinkan dan ditolak, termasuk bahwa satu sekolah/operator tidak dapat membaca atau mengubah data sekolah lain.
- Fungsi `SECURITY DEFINER` harus memiliki pemeriksaan otorisasi yang jelas, `search_path` yang aman, dan hak `EXECUTE` sesempit mungkin. Jangan memakai data profil yang dapat diubah pengguna sebagai sumber otorisasi.
- Jangan pernah mengirim kunci jawaban atau informasi siswa yang tidak diperlukan ke browser.

## Pemeriksaan sebelum push

1. Tinjau berkas yang akan di-commit; jangan mengandalkan `.gitignore` saja.
2. Pastikan `.env.local`, ekspor data, database lokal, dan konfigurasi lokal tidak masuk ke staging.
3. Aktifkan **Secret scanning** dan **Push protection** di **GitHub → Settings → Code security and analysis** bila tersedia untuk repository.
4. Aktifkan **Dependabot alerts** dan tinjau perubahan dependency sebelum merge.
5. Batasi izin workflow GitHub Actions. Jangan berikan secrets ke workflow yang berjalan pada pull request dari fork atau kode yang tidak dipercaya.

Push protection dan pemindaian otomatis hanya membantu mendeteksi kebocoran; keduanya tidak menggantikan pemeriksaan manual atau kontrol akses database.

## Jika kredensial atau data terunggah

- Segera cabut atau rotasi kredensial di layanan penerbitnya. Menghapusnya dari file atau commit terbaru tidak membuat kredensial aman kembali.
- Hapus data sensitif dari riwayat Git sebelum repository dibagikan lebih lanjut, lalu koordinasikan penggantian riwayat dengan semua kolaborator.
- Jika data pribadi terunggah, batasi akses repository, hapus salinan yang dapat diakses, dan ikuti prosedur pemberitahuan insiden yang berlaku.

Laporkan dugaan celah keamanan secara privat melalui **GitHub Security Advisories** repository. Jangan menerbitkan detail atau data pribadi melalui issue publik.
