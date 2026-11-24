"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Empty, Field, Modal, PageHeader, Spinner, inputCls, useToast } from "@/components/ui";
import { embeddedCount, getSchoolId } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { errMsg, fmtDateTime } from "@/lib/util";

type Row = { id: string; name: string; subject: string; created_at: string; count: number };

export function PackagesClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("packages")
      .select("id,name,subject,created_at,questions(count)")
      .order("created_at", { ascending: false });
    if (error) return setError(errMsg(error));
    setError(null);
    setRows(
      (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        subject: p.subject,
        created_at: p.created_at,
        count: embeddedCount(p.questions),
      })),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr(null);
    try {
      const { error } = await createClient()
        .from("packages")
        .insert({ name: name.trim(), subject: subject.trim(), school_id: await getSchoolId() });
      if (error) throw error;
      setOpen(false);
      setName("");
      setSubject("");
      show("Paket soal dibuat.");
      await load();
    } catch (err) {
      setFormErr(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: Row) {
    if (!confirm(`Hapus paket "${r.name}" beserta ${r.count} soalnya? Token yang memakai paket ini tidak akan punya soal.`)) return;
    const { error } = await createClient().from("packages").delete().eq("id", r.id);
    if (error) return show(errMsg(error), false);
    show("Paket dihapus.");
    await load();
  }

  return (
    <>
      <PageHeader
        title="Paket soal"
        description="Kumpulan soal per mata pelajaran. Satu paket dipakai oleh satu atau beberapa token."
        actions={<Button onClick={() => setOpen(true)}>+ Paket baru</Button>}
      />
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!rows && !error && <Spinner />}
      {rows && rows.length === 0 && <Empty>Belum ada paket soal. Buat paket pertama Anda.</Empty>}
      {rows && rows.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="flex h-full flex-col">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{r.subject}</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{r.name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {r.count} soal · dibuat {fmtDateTime(r.created_at)}
                </p>
                <div className="mt-4 flex gap-2 pt-1">
                  <Link
                    href={`/admin/soal/${r.id}`}
                    className="touch-target inline-flex flex-1 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-900"
                  >
                    Kelola soal
                  </Link>
                  <Button variant="ghost" className="text-red-600" onClick={() => remove(r)}>
                    Hapus
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Paket soal baru">
        <form onSubmit={create} className="space-y-4">
          <Field label="Nama paket">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Simulasi TKA 1" required />
          </Field>
          <Field label="Mata pelajaran">
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Matematika" required />
          </Field>
          {formErr && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {formErr}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Menyimpan…" : "Buat paket"}
            </Button>
          </div>
        </form>
      </Modal>
      {toast}
    </>
  );
}
