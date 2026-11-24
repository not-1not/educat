"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Empty, Field, Modal, PageHeader, Spinner, inputCls, useToast } from "@/components/ui";
import { STUDENT_TEMPLATE, parseStudentCSV, type ParsedStudents } from "@/lib/csv";
import { fetchAll, getSchoolId } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import type { Student } from "@/lib/types";
import { downloadFile, errMsg, fmtDate } from "@/lib/util";

const PAGE = 25;
type FormState = {
  id?: string;
  nisn: string;
  full_name: string;
  birth_date: string;
  gender: "" | "L" | "P";
  class_level: string;
};
const EMPTY: FormState = { nisn: "", full_name: "", birth_date: "", gender: "", class_level: "" };

export function StudentsClient() {
  const [rows, setRows] = useState<Student[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("");
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await fetchAll<Student>((from, to) =>
        createClient()
          .from("students")
          .select("id,nisn,full_name,gender,birth_date,class_level")
          .order("class_level", { nullsFirst: false })
          .order("full_name")
          .range(from, to),
      );
      setRows(data);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(errMsg(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const classes = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.class_level).filter((c): c is number => c != null))).sort((a, b) => a - b),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (!cls || String(r.class_level) === cls) &&
        (!term || r.full_name.toLowerCase().includes(term) || r.nisn.includes(term)),
    );
  }, [rows, q, cls]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE);

  function openNew() {
    setFormErr(null);
    setForm({ ...EMPTY });
  }
  function openEdit(s: Student) {
    setFormErr(null);
    setForm({
      id: s.id,
      nisn: s.nisn,
      full_name: s.full_name,
      birth_date: s.birth_date ?? "",
      gender: s.gender ?? "",
      class_level: s.class_level?.toString() ?? "",
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormErr(null);
    if (!/^\d{10}$/.test(form.nisn)) return setFormErr("NISN harus 10 digit angka.");
    if (form.full_name.trim().length < 2) return setFormErr("Nama minimal 2 karakter.");
    if (!form.birth_date) return setFormErr("Tanggal lahir wajib diisi (dipakai siswa untuk masuk ujian).");

    const payload = {
      nisn: form.nisn,
      full_name: form.full_name.trim(),
      birth_date: form.birth_date,
      gender: form.gender || null,
      class_level: form.class_level ? Number(form.class_level) : null,
    };
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = form.id
        ? await supabase.from("students").update(payload).eq("id", form.id)
        : await supabase.from("students").insert({ ...payload, school_id: await getSchoolId() });
      if (error) throw error;
      setForm(null);
      show(form.id ? "Data siswa diperbarui." : "Siswa ditambahkan.");
      await load();
    } catch (err) {
      setFormErr(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: Student) {
    if (!confirm(`Hapus ${s.full_name}? Hasil ujian siswa ini juga ikut terhapus.`)) return;
    const { error } = await createClient().from("students").delete().eq("id", s.id);
    if (error) return show(errMsg(error), false);
    show("Siswa dihapus.");
    await load();
  }

  return (
    <>
      <PageHeader
        title="Siswa"
        description="Data peserta ujian. NISN dan tanggal lahir dipakai siswa untuk masuk."
        actions={
          <>
            <Link
              href="/admin/siswa/kartu"
              className="touch-target inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Cetak kartu
            </Link>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              Impor CSV
            </Button>
            <Button onClick={openNew}>+ Tambah siswa</Button>
          </>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          className={inputCls}
          placeholder="Cari nama atau NISN…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          aria-label="Cari siswa"
        />
        <select
          className={inputCls + " sm:w-40"}
          value={cls}
          onChange={(e) => {
            setCls(e.target.value);
            setPage(0);
          }}
          aria-label="Filter kelas"
        >
          <option value="">Semua kelas</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              Kelas {c}
            </option>
          ))}
        </select>
      </div>

      {loadErr && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadErr}
        </p>
      )}
      {!rows && !loadErr && <Spinner />}
      {rows && rows.length === 0 && <Empty>Belum ada siswa. Tambahkan satu per satu atau impor dari CSV.</Empty>}
      {rows && rows.length > 0 && filtered.length === 0 && <Empty>Tidak ada siswa yang cocok dengan pencarian.</Empty>}

      {visible.length > 0 && (
        <>
          {/* Tabel untuk tablet/laptop */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">NISN</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">JK</th>
                  <th className="px-4 py-3">Tgl lahir</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.full_name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{s.nisn}</td>
                    <td className="px-4 py-3">{s.class_level ?? "-"}</td>
                    <td className="px-4 py-3">{s.gender ?? "-"}</td>
                    <td className="px-4 py-3">{fmtDate(s.birth_date)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                          Ubah
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(s)}>
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kartu untuk HP */}
          <ul className="space-y-2 md:hidden">
            {visible.map((s) => (
              <li key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{s.full_name}</p>
                    <p className="font-mono text-xs text-slate-500">{s.nisn}</p>
                  </div>
                  <Badge>{s.class_level ? `Kelas ${s.class_level}` : "Tanpa kelas"}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {s.gender ?? "-"} · lahir {fmtDate(s.birth_date)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>
                    Ubah
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(s)}>
                    Hapus
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              {filtered.length} siswa · halaman {current + 1}/{pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Sebelumnya
              </Button>
              <Button size="sm" variant="secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                Berikutnya
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah siswa" : "Tambah siswa"}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label="NISN" hint="10 digit angka.">
              <input
                className={inputCls}
                value={form.nisn}
                inputMode="numeric"
                maxLength={10}
                onChange={(e) => setForm({ ...form, nisn: e.target.value.replace(/\D/g, "") })}
                required
              />
            </Field>
            <Field label="Nama lengkap">
              <input
                className={inputCls}
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </Field>
            <Field label="Tanggal lahir" hint="Dipakai siswa sebagai kata sandi saat masuk ujian.">
              <input
                className={inputCls}
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jenis kelamin">
                <select
                  className={inputCls}
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as FormState["gender"] })}
                >
                  <option value="">-</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </Field>
              <Field label="Kelas">
                <select
                  className={inputCls}
                  value={form.class_level}
                  onChange={(e) => setForm({ ...form, class_level: e.target.value })}
                >
                  <option value="">-</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {formErr && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {formErr}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={async (n) => {
          setImportOpen(false);
          show(`${n} siswa berhasil diimpor.`);
          await load();
        }}
      />
      {toast}
    </>
  );
}

function ImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (n: number) => void;
}) {
  const [parsed, setParsed] = useState<ParsedStudents | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setParsed(null);
      setFileName("");
      setErr(null);
    }
  }, [open]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErr(null);
    setParsed(parseStudentCSV(await file.text()));
  }

  async function run() {
    if (!parsed || parsed.valid.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const school_id = await getSchoolId();
      for (let i = 0; i < parsed.valid.length; i += 200) {
        const chunk = parsed.valid.slice(i, i + 200).map((r) => ({ ...r, school_id }));
        const { error } = await supabase.from("students").upsert(chunk, { onConflict: "school_id,nisn" });
        if (error) throw error;
      }
      onDone(parsed.valid.length);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Impor siswa dari CSV" wide>
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          Kolom: <code>nisn</code>, <code>nama</code>, <code>tgl_lahir</code>, <code>jk</code> (L/P), <code>kelas</code>. Baris pertama berisi
          judul. Siswa dengan NISN yang sudah ada akan diperbarui.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => downloadFile("template-siswa.csv", STUDENT_TEMPLATE)}>
            Unduh templat
          </Button>
          <Button size="sm" onClick={() => input.current?.click()}>
            Pilih berkas CSV
          </Button>
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} aria-label="Berkas CSV siswa" />
          {fileName && <span className="self-center text-slate-500">{fileName}</span>}
        </div>

        {parsed && (
          <div className="space-y-3">
            <p>
              <Badge tone="green">{parsed.valid.length} baris valid</Badge>{" "}
              {parsed.errors.length > 0 && <Badge tone="red">{parsed.errors.length} baris bermasalah</Badge>}
            </p>
            {parsed.errors.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-red-50 p-3 text-red-700">
                {parsed.errors.slice(0, 50).map((er, i) => (
                  <li key={i}>
                    Baris {er.line}: {er.message}
                  </li>
                ))}
                {parsed.errors.length > 50 && <li>…dan {parsed.errors.length - 50} lainnya.</li>}
              </ul>
            )}
            {parsed.valid.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-2">NISN</th>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">Lahir</th>
                      <th className="px-3 py-2">Kelas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.valid.slice(0, 8).map((r) => (
                      <tr key={r.nisn}>
                        <td className="px-3 py-1.5 font-mono">{r.nisn}</td>
                        <td className="px-3 py-1.5">{r.full_name}</td>
                        <td className="px-3 py-1.5">{fmtDate(r.birth_date)}</td>
                        <td className="px-3 py-1.5">{r.class_level ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {err && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-red-700">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={busy || !parsed || parsed.valid.length === 0} onClick={run}>
            {busy ? "Mengimpor…" : `Impor ${parsed?.valid.length ?? 0} siswa`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
