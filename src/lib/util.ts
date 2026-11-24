// Pesan galat dari fungsi database → bahasa yang ramah untuk pengguna.
const ERRORS: Record<string, string> = {
  TOKEN_TIDAK_DITEMUKAN: "Token tidak ditemukan. Periksa kembali kode token.",
  SISWA_TIDAK_COCOK: "NISN atau tanggal lahir tidak cocok dengan data sekolah.",
  BELUM_DIMULAI: "Ujian belum dimulai. Tunggu sampai waktu mulai.",
  SUDAH_DITUTUP: "Waktu ujian dengan token ini sudah ditutup.",
  KUOTA_PENUH: "Kuota peserta untuk token ini sudah penuh.",
  PAKET_KOSONG: "Token ini belum memiliki soal. Hubungi pengawas.",
  SUDAH_SELESAI: "Ujian ini sudah selesai dikerjakan.",
  WAKTU_HABIS: "Waktu pengerjaan sudah habis.",
  SESI_TIDAK_VALID: "Sesi ujian tidak valid. Masuk kembali dengan token.",
  BELUM_SELESAI: "Ujian belum selesai.",
  SOAL_TIDAK_ADA: "Nomor soal tidak ditemukan.",
  SUDAH_TERDAFTAR: "Akun ini sudah terdaftar pada sebuah sekolah.",
  NAMA_SEKOLAH_PENDEK: "Nama sekolah minimal 3 karakter.",
  BELUM_LOGIN: "Anda belum masuk.",
  TIDAK_DIIZINKAN: "Anda tidak berhak melakukan tindakan ini.",
  "Invalid login credentials": "Email atau kata sandi salah.",
  "Email not confirmed": "Email belum dikonfirmasi. Buka kotak masuk Anda.",
  "User already registered": "Email ini sudah terdaftar. Silakan masuk.",
};

export function errMsg(e: unknown): string {
  const raw =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : String(e);
  for (const key of Object.keys(ERRORS)) {
    if (raw.includes(key)) return ERRORS[key];
  }
  if (raw.includes("duplicate key")) return "Data dengan nilai yang sama sudah ada.";
  if (raw.includes("Failed to fetch") || raw.includes("NetworkError"))
    return "Tidak dapat terhubung ke server. Periksa koneksi internet.";
  return raw;
}

const TZ = "Asia/Jakarta";

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeStyle: "medium",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// Nilai untuk <input type="datetime-local"> dalam waktu setempat browser.
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Kode token 6 karakter tanpa huruf/angka yang mudah tertukar (0/O, 1/I).
export function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

export function ujianUrl(code?: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/ujian${code ? `?token=${code}` : ""}`;
}

export function downloadFile(name: string, content: string, mime = "text/csv") {
  // BOM agar Excel membaca UTF-8 dengan benar.
  const blob = new Blob(["﻿" + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
