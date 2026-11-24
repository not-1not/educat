"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Field, PageHeader, Spinner, inputCls, useToast } from "@/components/ui";
import { getSchoolId } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { errMsg, ujianUrl } from "@/lib/util";

export function SettingsClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [npsn, setNpsn] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState<"school" | "pw" | null>(null);
  const [url, setUrl] = useState("");
  const { toast, show } = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(ujianUrl());
    createClient()
      .from("schools")
      .select("name,npsn")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return show(errMsg(error), false);
        setName(data?.name ?? "");
        setNpsn(data?.npsn ?? "");
        setLoaded(true);
      });
  }, [show]);

  async function saveSchool(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return show("Nama sekolah minimal 3 karakter.", false);
    setBusy("school");
    try {
      const { error } = await createClient()
        .from("schools")
        .update({ name: name.trim(), npsn: npsn.trim() || null })
        .eq("id", await getSchoolId());
      if (error) throw error;
      show("Data sekolah disimpan.");
      router.refresh();
    } catch (err) {
      show(errMsg(err), false);
    } finally {
      setBusy(null);
    }
  }

  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return show("Kata sandi minimal 8 karakter.", false);
    if (pw !== pw2) return show("Konfirmasi kata sandi tidak sama.", false);
    setBusy("pw");
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(null);
    if (error) return show(errMsg(error), false);
    setPw("");
    setPw2("");
    show("Kata sandi diperbarui.");
  }

  if (!loaded) return <Spinner />;

  return (
    <>
      <PageHeader title="Pengaturan" description="Data sekolah, akun, dan aturan ujian." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-bold">Data sekolah</h2>
          <form onSubmit={saveSchool} className="space-y-4">
            <Field label="Nama sekolah">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="NPSN">
              <input className={inputCls} value={npsn} onChange={(e) => setNpsn(e.target.value)} inputMode="numeric" />
            </Field>
            <Button type="submit" disabled={busy === "school"}>
              {busy === "school" ? "Menyimpan…" : "Simpan"}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-bold">Ganti kata sandi</h2>
          <form onSubmit={savePw} className="space-y-4">
            <Field label="Kata sandi baru" hint="Minimal 8 karakter.">
              <input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Ulangi kata sandi">
              <input className={inputCls} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </Field>
            <Button type="submit" disabled={busy === "pw"}>
              {busy === "pw" ? "Menyimpan…" : "Ubah kata sandi"}
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-base font-bold">Halaman ujian siswa</h2>
          <p className="text-sm text-slate-600">
            Bagikan alamat ini kepada siswa (atau cetak kartu peserta yang memuat kode QR). Siswa masuk dengan token, NISN, dan tanggal lahir.
          </p>
          <p className="mt-2 break-all rounded-xl bg-slate-100 px-3 py-2 font-mono text-sm">{url}</p>
          <h3 className="mt-5 text-sm font-bold">Aturan ujian yang berlaku</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Batas waktu dihitung oleh server, bukan jam perangkat siswa. Mengubah jam perangkat tidak menambah waktu.</li>
            <li>Jawaban tersimpan otomatis setiap kali dipilih; siswa yang terputus dapat masuk kembali dan melanjutkan.</li>
            <li>Pindah tab, keluar layar penuh, dan koneksi putus dicatat sebagai pelanggaran dan tampil di Monitoring dan Hasil.</li>
            <li>Pencatatan pelanggaran adalah alat bantu pengawas, bukan jaminan mutlak. Pengawasan langsung tetap diperlukan.</li>
          </ul>
        </Card>
      </div>
      {toast}
    </>
  );
}
