"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/util";

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/admin") ? next : "/admin";

  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState("");
  const [npsn, setNpsn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "masuk") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(safeNext);
        router.refresh();
        return;
      }

      if (school.trim().length < 3) throw new Error("NAMA_SEKOLAH_PENDEK");
      if (password.length < 8) throw new Error("Kata sandi minimal 8 karakter.");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { school_name: school.trim(), npsn: npsn.trim() } },
      });
      if (error) throw error;

      if (data.session) {
        const { error: rpcErr } = await supabase.rpc("register_school", {
          p_name: school.trim(),
          p_npsn: npsn.trim() || null,
        });
        if (rpcErr) throw rpcErr;
        router.replace("/admin");
        router.refresh();
      } else {
        setInfo(
          "Pendaftaran berhasil. Buka email Anda dan klik tautan konfirmasi, lalu masuk di sini. Data sekolah akan disiapkan saat Anda masuk pertama kali.",
        );
        setMode("masuk");
        setPassword("");
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-brand-700 to-orange-300 text-xl font-bold text-white shadow-lg shadow-brand-700/20">
          E
        </div>
        <h1 className="text-2xl font-bold">EduCAT</h1>
        <p className="text-sm text-slate-600">Panel operator sekolah</p>
      </div>

      <div className="glass-panel auth-dialog rounded-2xl border p-5 sm:p-6">
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          {(["masuk", "daftar"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`touch-target rounded-lg ${
                mode === m ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
              }`}
            >
              {m === "masuk" ? "Masuk" : "Daftar sekolah"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "daftar" && (
            <>
              <Field label="Nama sekolah">
                <input
                  className={inputCls}
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="SD Negeri 3 Purwosari"
                  required
                  autoComplete="organization"
                />
              </Field>
              <Field label="NPSN (opsional)">
                <input
                  className={inputCls}
                  value={npsn}
                  onChange={(e) => setNpsn(e.target.value)}
                  inputMode="numeric"
                  placeholder="20xxxxxx"
                />
              </Field>
            </>
          )}
          <Field label="Email">
            <input
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </Field>
          <Field label="Kata sandi" hint={mode === "daftar" ? "Minimal 8 karakter." : undefined}>
            <input
              className={inputCls}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "masuk" ? "current-password" : "new-password"}
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {info}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Memproses…" : mode === "masuk" ? "Masuk" : "Daftar"}
          </Button>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-slate-600">
        Siswa?{" "}
        <Link href="/ujian" className="font-semibold text-brand-700 underline">
          Mulai ujian di sini
        </Link>
      </p>
    </div>
  );
}
