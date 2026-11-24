"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { errMsg } from "@/lib/util";

export function LoginForm({
  defaultToken,
  notice,
  onLogin,
}: {
  defaultToken: string;
  notice?: string;
  onLogin: (code: string, nisn: string, birth: string) => Promise<void>;
}) {
  const [code, setCode] = useState(defaultToken.toUpperCase());
  const [nisn, setNisn] = useState("");
  const [birth, setBirth] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{10}$/.test(nisn)) return setError("NISN harus 10 digit angka.");
    if (!birth) return setError("Isi tanggal lahir.");
    if (code.trim().length !== 6) return setError("Token terdiri dari 6 karakter.");

    // Layar penuh harus diminta langsung dari klik pengguna, sebelum proses async.
    const el = document.documentElement;
    if (el.requestFullscreen && document.fullscreenEnabled) {
      el.requestFullscreen().catch(() => {});
    }

    setBusy(true);
    try {
      await onLogin(code.trim().toUpperCase(), nisn, birth);
    } catch (err) {
      setError(errMsg(err));
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setBusy(false);
    }
  }

  return (
    <main className="auth-stage flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-brand-700 to-orange-300 text-xl font-bold text-white shadow-lg shadow-brand-700/20">
            E
          </div>
          <h1 className="text-2xl font-bold">Masuk ujian</h1>
          <p className="text-sm text-slate-600">Isi data sesuai kartu peserta.</p>
        </div>

        <form onSubmit={submit} className="glass-panel auth-dialog space-y-4 rounded-2xl border p-5 sm:p-6">
          <Field label="Token ujian">
            <input
              className={inputCls + " text-center font-mono text-xl tracking-[0.3em] uppercase"}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoComplete="off"
              required
            />
          </Field>
          <Field label="NISN">
            <input
              className={inputCls}
              value={nisn}
              onChange={(e) => setNisn(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="10 digit"
              required
            />
          </Field>
          <Field label="Tanggal lahir" hint="Dipakai sebagai kata sandi.">
            <input className={inputCls} type="date" value={birth} onChange={(e) => setBirth(e.target.value)} required />
          </Field>

          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Aturan ujian</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Waktu berjalan sejak Anda masuk dan tidak dapat dihentikan.</li>
              <li>Jangan berpindah tab atau aplikasi, dan jangan keluar dari layar penuh.</li>
              <li>Setiap pelanggaran dicatat dan dilihat pengawas.</li>
              <li>Jika terputus, masuk lagi dengan data yang sama untuk melanjutkan.</li>
            </ul>
          </div>
          <label className="touch-target flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span>Saya sudah membaca dan menyetujui aturan ujian.</span>
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !agree} className="w-full">
            {busy ? "Memeriksa…" : "Mulai ujian"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Operator sekolah?{" "}
          <Link href="/masuk" className="font-semibold text-brand-700 underline">
            Masuk di sini
          </Link>
        </p>
      </div>
    </main>
  );
}
