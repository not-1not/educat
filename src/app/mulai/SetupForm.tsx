"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/util";

export function SetupForm({
  defaultName,
  defaultNpsn,
}: {
  defaultName: string;
  defaultNpsn: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [npsn, setNpsn] = useState(defaultNpsn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("register_school", {
      p_name: name,
      p_npsn: npsn.trim() || null,
    });
    setBusy(false);
    if (error) return setError(errMsg(error));
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h1 className="text-xl font-bold">Siapkan data sekolah</h1>
        <p className="mt-1 text-sm text-slate-600">
          Akun Anda belum terhubung ke sekolah. Isi data berikut untuk mulai memakai EduCAT.
        </p>
      </div>
      <Field label="Nama sekolah">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="NPSN (opsional)">
        <input className={inputCls} value={npsn} onChange={(e) => setNpsn(e.target.value)} inputMode="numeric" />
      </Field>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Menyimpan…" : "Simpan dan lanjut"}
      </Button>
    </form>
  );
}
