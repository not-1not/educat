"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner, inputCls, useToast } from "@/components/ui";
import { embeddedCount, fetchAll, getSchoolId } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import type { ExamToken } from "@/lib/types";
import { errMsg, fmtDateTime, genCode, toLocalInput, ujianUrl } from "@/lib/util";

type PkgOpt = { id: string; name: string; subject: string; count: number };
type Form = {
  package_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: string;
  quota: string;
  result_mode: "immediate" | "held";
};

function defaults(): Form {
  const now = new Date();
  const end = new Date(now.getTime() + 4 * 3600_000);
  return {
    package_id: "",
    starts_at: toLocalInput(now),
    ends_at: toLocalInput(end),
    duration_minutes: "75",
    quota: "0",
    result_mode: "immediate",
  };
}

function tokenState(t: ExamToken): { label: string; tone: "blue" | "green" | "slate" } {
  const now = Date.now();
  if (now < new Date(t.starts_at).getTime()) return { label: "Terjadwal", tone: "blue" };
  if (now > new Date(t.ends_at).getTime()) return { label: "Ditutup", tone: "slate" };
  return { label: "Aktif", tone: "green" };
}

export function TokensClient() {
  const [tokens, setTokens] = useState<ExamToken[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pkgs, setPkgs] = useState<PkgOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    const supabase = createClient();
    try {
      const [tk, pk, ss] = await Promise.all([
        supabase.from("exam_tokens").select("*").order("starts_at", { ascending: false }),
        supabase.from("packages").select("id,name,subject,questions(count)").order("name"),
        fetchAll<{ token_id: string }>((from, to) => supabase.from("exam_sessions").select("token_id").range(from, to)),
      ]);
      if (tk.error) throw tk.error;
      if (pk.error) throw pk.error;
      const tally: Record<string, number> = {};
      ss.forEach((s) => (tally[s.token_id] = (tally[s.token_id] ?? 0) + 1));
      setCounts(tally);
      setTokens((tk.data ?? []) as ExamToken[]);
      setPkgs((pk.data ?? []).map((p) => ({ id: p.id, name: p.name, subject: p.subject, count: embeddedCount(p.questions) })));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormErr(null);
    const pkg = pkgs.find((p) => p.id === form.package_id);
    if (!pkg) return setFormErr("Pilih paket soal.");
    if (pkg.count === 0) return setFormErr("Paket yang dipilih belum berisi soal.");
    const starts = new Date(form.starts_at);
    const ends = new Date(form.ends_at);
    if (isNaN(+starts) || isNaN(+ends)) return setFormErr("Waktu mulai dan selesai wajib diisi.");
    if (ends <= starts) return setFormErr("Waktu selesai harus setelah waktu mulai.");
    const duration = Number(form.duration_minutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) return setFormErr("Durasi 1–600 menit.");
    const quota = Number(form.quota);
    if (!Number.isInteger(quota) || quota < 0) return setFormErr("Kuota tidak boleh negatif.");

    setBusy(true);
    try {
      const supabase = createClient();
      const school_id = await getSchoolId();
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const { error } = await supabase.from("exam_tokens").insert({
          school_id,
          code: genCode(),
          subject: pkg.subject,
          package_name: pkg.name,
          package_id: pkg.id,
          quota,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          duration_minutes: duration,
          result_mode: form.result_mode,
        });
        if (!error) {
          lastErr = null;
          break;
        }
        lastErr = error;
        if (error.code !== "23505") break; // hanya ulangi bila kode bentrok
      }
      if (lastErr) throw lastErr;
      setForm(null);
      show("Token dibuat.");
      await load();
    } catch (err) {
      setFormErr(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      show(`${label} disalin.`);
    } catch {
      show("Tidak bisa menyalin otomatis. Salin secara manual.", false);
    }
  }

  async function remove(t: ExamToken) {
    const n = counts[t.id] ?? 0;
    if (!confirm(`Hapus token ${t.code}?${n > 0 ? ` ${n} sesi dan hasil siswa pada token ini ikut terhapus.` : ""}`)) return;
    const { error } = await createClient().from("exam_tokens").delete().eq("id", t.id);
    if (error) return show(errMsg(error), false);
    show("Token dihapus.");
    await load();
  }

  return (
    <>
      <PageHeader
        title="Token ujian"
        description="Setiap token menentukan paket soal, jadwal, durasi, dan kuota peserta."
        actions={
          <Button
            onClick={() => {
              setFormErr(null);
              setForm(defaults());
            }}
          >
            + Token baru
          </Button>
        }
      />
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!tokens && !error && <Spinner />}
      {tokens && tokens.length === 0 && <Empty>Belum ada token. Buat paket soal terlebih dulu, lalu buat token.</Empty>}

      {tokens && tokens.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {tokens.map((t) => {
            const st = tokenState(t);
            const used = counts[t.id] ?? 0;
            return (
              <li key={t.id}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{t.subject}</p>
                      <p className="truncate text-xs text-slate-500">{t.package_name}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="my-3 rounded-xl bg-brand-50 py-2 text-center font-mono text-3xl font-bold tracking-[0.3em] text-brand-900">
                    {t.code}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                    <dt>Mulai</dt>
                    <dd className="text-right font-medium text-slate-800">{fmtDateTime(t.starts_at)}</dd>
                    <dt>Tutup</dt>
                    <dd className="text-right font-medium text-slate-800">{fmtDateTime(t.ends_at)}</dd>
                    <dt>Durasi</dt>
                    <dd className="text-right font-medium text-slate-800">{t.duration_minutes} menit</dd>
                    <dt>Peserta</dt>
                    <dd className="text-right font-medium text-slate-800">
                      {used}
                      {t.quota > 0 ? ` / ${t.quota}` : " (tanpa batas)"}
                    </dd>
                    <dt>Hasil</dt>
                    <dd className="text-right font-medium text-slate-800">
                      {t.result_mode === "immediate" ? "Langsung tampil" : "Ditahan"}
                    </dd>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => copy(t.code, "Kode token")}>
                      Salin kode
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => copy(ujianUrl(t.code), "Tautan ujian")}>
                      Salin tautan
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-red-600" onClick={() => remove(t)}>
                      Hapus
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title="Token ujian baru">
        {form && (
          <form onSubmit={create} className="space-y-4">
            <Field label="Paket soal">
              <select
                className={inputCls}
                value={form.package_id}
                onChange={(e) => setForm({ ...form, package_id: e.target.value })}
                required
              >
                <option value="">Pilih paket…</option>
                {pkgs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.subject} ({p.count} soal)
                  </option>
                ))}
              </select>
            </Field>
            {pkgs.length === 0 && <p className="text-sm text-amber-700">Belum ada paket soal. Buat dulu di menu Soal.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mulai">
                <input className={inputCls} type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required />
              </Field>
              <Field label="Ditutup">
                <input className={inputCls} type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} required />
              </Field>
              <Field label="Durasi (menit)">
                <input className={inputCls} type="number" min="1" max="600" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} required />
              </Field>
              <Field label="Kuota peserta" hint="0 = tanpa batas.">
                <input className={inputCls} type="number" min="0" value={form.quota} onChange={(e) => setForm({ ...form, quota: e.target.value })} required />
              </Field>
            </div>
            <Field label="Tampilan hasil ke siswa">
              <select className={inputCls} value={form.result_mode} onChange={(e) => setForm({ ...form, result_mode: e.target.value as Form["result_mode"] })}>
                <option value="immediate">Langsung setelah selesai (dengan pembahasan)</option>
                <option value="held">Ditahan — hanya operator yang melihat nilai</option>
              </select>
            </Field>
            {formErr && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {formErr}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Membuat…" : "Buat token"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
      {toast}
    </>
  );
}
