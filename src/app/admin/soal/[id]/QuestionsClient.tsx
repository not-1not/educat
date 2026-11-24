"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Empty, Field, Modal, PageHeader, Spinner, inputCls, useToast } from "@/components/ui";
import { getSchoolId } from "@/lib/data";
import { QUESTION_TEMPLATE, parseQuestionJSON, validateQuestion, type NewQuestion } from "@/lib/questions";
import { createClient } from "@/lib/supabase/client";
import { KIND_LABEL, type Pkg, type Question, type QuestionKind } from "@/lib/types";
import { downloadFile, errMsg } from "@/lib/util";

type Draft = {
  id?: string;
  kind: QuestionKind;
  passage: string;
  body: string;
  options: string[];
  pg: number;
  pgk: number[];
  bs: boolean[];
  points: string;
  explanation: string;
};

const blank = (): Draft => ({
  kind: "pg",
  passage: "",
  body: "",
  options: ["", "", "", ""],
  pg: -1,
  pgk: [],
  bs: [true, true, true, true],
  points: "1",
  explanation: "",
});

function toDraft(q: Question): Draft {
  return {
    id: q.id,
    kind: q.kind,
    passage: q.passage ?? "",
    body: q.body,
    options: q.options,
    pg: q.kind === "pg" ? (q.answer_key as number) : -1,
    pgk: q.kind === "pgk" ? (q.answer_key as number[]) : [],
    bs: q.kind === "bs" ? (q.answer_key as boolean[]) : q.options.map(() => true),
    points: String(q.points),
    explanation: q.explanation ?? "",
  };
}

function toPayload(d: Draft): NewQuestion {
  return {
    kind: d.kind,
    passage: d.passage.trim() || null,
    body: d.body.trim(),
    options: d.options.map((o) => o.trim()),
    answer_key: d.kind === "pg" ? d.pg : d.kind === "pgk" ? [...d.pgk].sort((a, b) => a - b) : d.bs,
    points: Number(d.points),
    explanation: d.explanation.trim() || null,
  };
}

export function QuestionsClient() {
  const { id } = useParams<{ id: string }>();
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [qs, setQs] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftErr, setDraftErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    const supabase = createClient();
    const [p, q] = await Promise.all([
      supabase.from("packages").select("*").eq("id", id).maybeSingle(),
      supabase.from("questions").select("*").eq("package_id", id).order("no"),
    ]);
    if (p.error || q.error) return setError(errMsg(p.error ?? q.error));
    if (!p.data) return setError("Paket soal tidak ditemukan.");
    setPkg(p.data as Pkg);
    setQs((q.data ?? []) as Question[]);
    setError(null);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const payload = toPayload(draft);
    const err = validateQuestion(payload);
    if (err) return setDraftErr(err);
    setBusy(true);
    setDraftErr(null);
    try {
      const supabase = createClient();
      if (draft.id) {
        const { error } = await supabase.from("questions").update(payload).eq("id", draft.id);
        if (error) throw error;
      } else {
        const no = (qs ?? []).reduce((m, q) => Math.max(m, q.no), 0) + 1;
        const { error } = await supabase
          .from("questions")
          .insert({ ...payload, no, package_id: id, school_id: await getSchoolId() });
        if (error) throw error;
      }
      setDraft(null);
      show("Soal disimpan.");
      await load();
    } catch (e2) {
      setDraftErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  async function remove(q: Question) {
    if (!confirm(`Hapus soal nomor ${q.no}? Nomor soal sesudahnya akan bergeser.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("questions").delete().eq("id", q.id);
    if (error) return show(errMsg(error), false);
    // Rapatkan nomor: urut naik agar tidak bentrok dengan unique (package_id, no).
    const rest = (qs ?? []).filter((x) => x.id !== q.id).sort((a, b) => a.no - b.no);
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].no !== i + 1) {
        const { error: e2 } = await supabase.from("questions").update({ no: i + 1 }).eq("id", rest[i].id);
        if (e2) {
          show(errMsg(e2), false);
          break;
        }
      }
    }
    show("Soal dihapus.");
    await load();
  }

  function setKind(kind: QuestionKind) {
    if (!draft) return;
    const n = draft.options.length;
    setDraft({
      ...draft,
      kind,
      options: kind === "bs" && draft.options.length > 4 ? draft.options.slice(0, 4) : draft.options,
      pg: -1,
      pgk: [],
      bs: Array.from({ length: kind === "bs" && n > 4 ? 4 : n }, () => true),
    });
  }

  function setOption(i: number, v: string) {
    if (!draft) return;
    const options = [...draft.options];
    options[i] = v;
    setDraft({ ...draft, options });
  }
  function addOption() {
    if (!draft || draft.options.length >= 8) return;
    setDraft({ ...draft, options: [...draft.options, ""], bs: [...draft.bs, true] });
  }
  function removeOption(i: number) {
    if (!draft) return;
    const min = draft.kind === "bs" ? 1 : 2;
    if (draft.options.length <= min) return;
    setDraft({
      ...draft,
      options: draft.options.filter((_, k) => k !== i),
      bs: draft.bs.filter((_, k) => k !== i),
      pg: draft.pg === i ? -1 : draft.pg > i ? draft.pg - 1 : draft.pg,
      pgk: draft.pgk.filter((k) => k !== i).map((k) => (k > i ? k - 1 : k)),
    });
  }

  const letter = (i: number) => String.fromCharCode(65 + i);

  return (
    <>
      <PageHeader
        title={pkg ? pkg.name : "Paket soal"}
        description={pkg ? `${pkg.subject} · ${qs?.length ?? 0} soal` : undefined}
        actions={
          <>
            <Link
              href="/admin/soal"
              className="touch-target inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50"
            >
              Kembali
            </Link>
            <Button variant="secondary" onClick={() => setImportOpen(true)} disabled={!pkg}>
              Impor JSON
            </Button>
            <Button
              disabled={!pkg}
              onClick={() => {
                setDraftErr(null);
                setDraft(blank());
              }}
            >
              + Tambah soal
            </Button>
          </>
        }
      />

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!qs && !error && <Spinner />}
      {qs && qs.length === 0 && <Empty>Paket ini belum berisi soal. Tambahkan satu per satu atau impor dari JSON.</Empty>}

      {qs && qs.length > 0 && (
        <ol className="space-y-2">
          {qs.map((q) => (
            <li key={q.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {q.no}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    <Badge tone="blue">{KIND_LABEL[q.kind]}</Badge>
                    <Badge>{q.options.length} {q.kind === "bs" ? "pernyataan" : "pilihan"}</Badge>
                    <Badge>bobot {q.points}</Badge>
                    {q.passage && <Badge tone="amber">ada bacaan</Badge>}
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line text-sm text-slate-800">{q.body}</p>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDraftErr(null);
                    setDraft(toDraft(q));
                  }}
                >
                  Ubah
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(q)}>
                  Hapus
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Ubah soal" : "Soal baru"} wide>
        {draft && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Jenis soal">
                <select className={inputCls} value={draft.kind} onChange={(e) => setKind(e.target.value as QuestionKind)}>
                  {(Object.keys(KIND_LABEL) as QuestionKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bobot nilai">
                <input
                  className={inputCls}
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={draft.points}
                  onChange={(e) => setDraft({ ...draft, points: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Teks bacaan / stimulus (opsional)">
              <textarea
                className={inputCls}
                rows={3}
                value={draft.passage}
                onChange={(e) => setDraft({ ...draft, passage: e.target.value })}
              />
            </Field>
            <Field label="Pertanyaan">
              <textarea
                className={inputCls}
                rows={3}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                required
              />
            </Field>

            <fieldset>
              <legend className="mb-1 text-sm font-medium text-slate-700">
                {draft.kind === "bs" ? "Pernyataan dan kunci" : "Pilihan jawaban dan kunci"}
                <span className="ml-2 font-normal text-slate-500">
                  {draft.kind === "pg" && "(pilih satu yang benar)"}
                  {draft.kind === "pgk" && "(centang semua yang benar)"}
                  {draft.kind === "bs" && "(tandai Benar atau Salah)"}
                </span>
              </legend>
              <div className="space-y-2">
                {draft.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {draft.kind === "pg" && (
                      <input
                        type="radio"
                        name="kunci"
                        className="h-5 w-5 shrink-0 accent-brand-700"
                        checked={draft.pg === i}
                        onChange={() => setDraft({ ...draft, pg: i })}
                        aria-label={`Kunci ${letter(i)}`}
                      />
                    )}
                    {draft.kind === "pgk" && (
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 accent-brand-700"
                        checked={draft.pgk.includes(i)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            pgk: e.target.checked ? [...draft.pgk, i] : draft.pgk.filter((k) => k !== i),
                          })
                        }
                        aria-label={`Kunci ${letter(i)}`}
                      />
                    )}
                    <span className="w-5 shrink-0 text-sm font-semibold text-slate-500">{letter(i)}</span>
                    <input
                      className={inputCls}
                      value={o}
                      onChange={(e) => setOption(i, e.target.value)}
                      placeholder={draft.kind === "bs" ? "Pernyataan" : "Pilihan jawaban"}
                    />
                    {draft.kind === "bs" && (
                      <select
                        className={inputCls + " !w-28 shrink-0"}
                        value={draft.bs[i] ? "B" : "S"}
                        onChange={(e) => {
                          const bs = [...draft.bs];
                          bs[i] = e.target.value === "B";
                          setDraft({ ...draft, bs });
                        }}
                        aria-label={`Kunci pernyataan ${letter(i)}`}
                      >
                        <option value="B">Benar</option>
                        <option value="S">Salah</option>
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      aria-label={`Hapus ${letter(i)}`}
                      className="touch-target shrink-0 rounded-xl text-xl text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={addOption} disabled={draft.options.length >= 8}>
                + Tambah {draft.kind === "bs" ? "pernyataan" : "pilihan"}
              </Button>
            </fieldset>

            <Field label="Pembahasan (opsional)" hint="Ditampilkan ke siswa setelah ujian, jika hasil tidak ditahan.">
              <textarea
                className={inputCls}
                rows={2}
                value={draft.explanation}
                onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
              />
            </Field>

            {draftErr && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {draftErr}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan soal"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ImportModal
        open={importOpen}
        packageId={id}
        startNo={(qs ?? []).reduce((m, q) => Math.max(m, q.no), 0)}
        onClose={() => setImportOpen(false)}
        onDone={async (n) => {
          setImportOpen(false);
          show(`${n} soal diimpor.`);
          await load();
        }}
      />
      {toast}
    </>
  );
}

function ImportModal({
  open,
  packageId,
  startNo,
  onClose,
  onDone,
}: {
  open: boolean;
  packageId: string;
  startNo: number;
  onClose: () => void;
  onDone: (n: number) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText("");
      setErr(null);
    }
  }, [open]);

  const result = text.trim() ? parseQuestionJSON(text) : null;

  async function run() {
    if (!result || result.valid.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const school_id = await getSchoolId();
      const rows = result.valid.map((q, i) => ({ ...q, no: startNo + i + 1, package_id: packageId, school_id }));
      const supabase = createClient();
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("questions").insert(rows.slice(i, i + 100));
        if (error) throw error;
      }
      onDone(rows.length);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Impor soal dari JSON" wide>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">
          Soal ditambahkan setelah soal yang sudah ada. <code>answer</code>: angka (pg, mulai 0), daftar angka (pgk), atau daftar true/false (bs).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => downloadFile("contoh-soal.json", QUESTION_TEMPLATE, "application/json")}>
            Unduh contoh
          </Button>
          <Button size="sm" onClick={() => input.current?.click()}>
            Pilih berkas JSON
          </Button>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Berkas JSON soal"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
            }}
          />
        </div>
        <textarea
          className={inputCls + " font-mono text-xs"}
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tempel JSON di sini…"
          aria-label="Isi JSON soal"
        />
        {result && (
          <div className="space-y-2">
            <p>
              <Badge tone="green">{result.valid.length} soal valid</Badge>{" "}
              {result.errors.length > 0 && <Badge tone="red">{result.errors.length} bermasalah</Badge>}
            </p>
            {result.errors.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded-xl bg-red-50 p-3 text-red-700">
                {result.errors.slice(0, 30).map((er, i) => (
                  <li key={i}>{er}</li>
                ))}
              </ul>
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
          <Button disabled={busy || !result || result.valid.length === 0} onClick={run}>
            {busy ? "Mengimpor…" : `Impor ${result?.valid.length ?? 0} soal`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
