"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Modal } from "@/components/ui";
import type { ExamResult, ExamQuestion, Response } from "@/lib/types";
import { errMsg, formatCountdown } from "@/lib/util";
import { examResult, examSave, examSubmit, examViolation, isAnswered, type Cred, type ExamData } from "./api";

type Props = {
  cred: Cred;
  data: ExamData;
  offset: number; // selisih jam server terhadap jam perangkat (ms)
  needsGate: boolean;
  onDone: (r: ExamResult) => void;
};

const has = (e: unknown, code: string) =>
  !!e && typeof e === "object" && "message" in e && String((e as { message: unknown }).message).includes(code);

export function ExamView({ cred, data, offset, needsGate, onDone }: Props) {
  const qs = data.questions;
  const deadline = new Date(data.deadline_at).getTime();

  const [answers, setAnswers] = useState<Record<number, Response>>(() =>
    Object.fromEntries(Object.entries(data.answers).map(([k, v]) => [Number(k), v])),
  );
  const [idx, setIdx] = useState(0);
  const [flags, setFlags] = useState<number[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const [gate, setGate] = useState(needsGate);
  const [fsLost, setFsLost] = useState(false);
  const [offline, setOffline] = useState(false);
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const pending = useRef(new Map<number, Response>());
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const finished = useRef(false);
  const fsEntered = useRef(false);
  const lastViol = useRef<Record<string, number>>({});
  const vqueue = useRef<{ kind: string; detail?: Record<string, unknown> }[]>([]);
  const offlineAt = useRef<number | null>(null);
  const lastAuto = useRef(0);
  const finishRef = useRef<(auto: boolean) => Promise<void>>(async () => {});

  // ---------- Penyimpanan jawaban (antrean berurutan, diulang bila gagal) ----------
  const flush = useCallback((): Promise<boolean> => {
    chain.current = chain.current.then(async () => {
      for (;;) {
        const first = pending.current.entries().next();
        if (first.done) break;
        const [no, resp] = first.value;
        try {
          await examSave(cred, no, resp);
          if (pending.current.get(no) === resp) pending.current.delete(no);
        } catch (e) {
          if (has(e, "WAKTU_HABIS") || has(e, "SUDAH_SELESAI")) {
            pending.current.clear();
            void finishRef.current(true);
            return true;
          }
          setSave("error");
          return false;
        }
      }
      setSave("saved");
      return true;
    });
    return chain.current;
  }, [cred]);

  function setAnswer(no: number, r: Response) {
    setAnswers((a) => ({ ...a, [no]: r }));
    pending.current.set(no, r);
    setSave("saving");
    void flush();
  }

  // ---------- Pencatatan pelanggaran ----------
  const report = useCallback(
    (kind: string, detail?: Record<string, unknown>) => {
      if (finished.current) return;
      const t = Date.now();
      if (t - (lastViol.current[kind] ?? 0) < 3000) return;
      lastViol.current[kind] = t;
      examViolation(cred, kind, detail).catch(() => vqueue.current.push({ kind, detail }));
    },
    [cred],
  );

  // ---------- Kirim jawaban ----------
  const finish = useCallback(
    async (auto: boolean) => {
      if (finished.current) return;
      setSubmitting(true);
      setSubmitErr(null);
      const ok = await flush();
      if (!ok && !auto) {
        setSubmitting(false);
        setSubmitErr("Jawaban terakhir belum tersimpan. Periksa koneksi internet lalu coba lagi.");
        return;
      }
      try {
        let res: ExamResult;
        try {
          res = await examSubmit(cred);
        } catch (e) {
          if (!has(e, "SUDAH_SELESAI")) throw e;
          res = await examResult(cred);
        }
        finished.current = true;
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        onDone(res);
      } catch (e) {
        setSubmitting(false);
        setSubmitErr(errMsg(e));
      }
    },
    [cred, flush, onDone],
  );
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  // ---------- Jam hitung mundur (berdasarkan jam server) ----------
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [offset]);

  // Dibulatkan ke atas agar "00:00" baru tampil setelah waktu benar-benar habis.
  const remainingMs = now === null ? null : deadline - now;
  const remaining = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const timeUp = remainingMs !== null && remainingMs <= 0;

  useEffect(() => {
    if (!timeUp || submitting || finished.current) return;
    const t = Date.now();
    if (t - lastAuto.current < 3000) return;
    lastAuto.current = t;
    void finish(true);
  }, [timeUp, now, submitting, finish]);

  // Ulangi pengiriman jawaban yang tertunda.
  useEffect(() => {
    const t = setInterval(() => {
      if (pending.current.size > 0) void flush();
    }, 5000);
    return () => clearInterval(t);
  }, [flush]);

  // ---------- Pengawasan: tab, layar penuh, koneksi ----------
  useEffect(() => {
    if (document.fullscreenElement) fsEntered.current = true;

    const onVis = () => document.hidden && report("tab_switch", { via: "visibility" });
    const onBlur = () => report("tab_switch", { via: "blur" });
    const onFs = () => {
      if (document.fullscreenElement) {
        fsEntered.current = true;
        setFsLost(false);
      } else if (fsEntered.current && !finished.current) {
        setFsLost(true);
        report("fullscreen_exit");
      }
    };
    const onOffline = () => {
      offlineAt.current = Date.now();
      setOffline(true);
    };
    const onOnline = () => {
      setOffline(false);
      if (offlineAt.current) {
        const seconds = Math.round((Date.now() - offlineAt.current) / 1000);
        offlineAt.current = null;
        vqueue.current.push({ kind: "disconnect", detail: { seconds } });
      }
      const q = vqueue.current.splice(0);
      q.forEach((v) => examViolation(cred, v.kind, v.detail).catch(() => vqueue.current.push(v)));
      if (pending.current.size > 0) void flush();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!finished.current) e.preventDefault();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [cred, flush, report]);

  function enterFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen && document.fullscreenEnabled) el.requestFullscreen().catch(() => {});
  }

  const q = qs[idx];
  const answered = qs.filter((x) => isAnswered(answers[x.no])).length;
  const low = remaining !== null && remaining <= 300;
  const toggleFlag = () => setFlags((f) => (f.includes(q.no) ? f.filter((n) => n !== q.no) : [...f, q.no]));

  if (!q)
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-center">
        <p>Paket ini belum memiliki soal. Hubungi pengawas.</p>
      </main>
    );

  return (
    <div
      className="min-h-dvh select-none bg-slate-50 pb-28"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{data.subject}</p>
            <p className="truncate text-xs text-slate-500">{data.student_name}</p>
          </div>
          <span className="hidden text-xs text-slate-500 sm:inline" aria-live="polite">
            {save === "saved" && "✓ Tersimpan"}
            {save === "saving" && "Menyimpan…"}
            {save === "error" && <span className="text-red-600">Gagal menyimpan, mencoba lagi…</span>}
          </span>
          <div
            role="timer"
            aria-label="Sisa waktu"
            className={`rounded-xl px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${
              low ? "animate-pulse bg-red-100 text-red-700" : "bg-brand-50 text-brand-900"
            }`}
          >
            {remaining === null ? "--:--" : formatCountdown(remaining)}
          </div>
          <Button size="sm" variant="secondary" className="lg:hidden" onClick={() => setNavOpen(true)}>
            Soal
          </Button>
        </div>
        {offline && (
          <p role="alert" className="bg-red-600 px-4 py-1.5 text-center text-sm font-medium text-white">
            Koneksi terputus. Jawaban akan dikirim otomatis saat tersambung kembali.
          </p>
        )}
        {save === "error" && !offline && (
          <p role="alert" className="bg-amber-500 px-4 py-1.5 text-center text-sm font-medium text-white sm:hidden">
            Gagal menyimpan, mencoba lagi…
          </p>
        )}
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 lg:grid-cols-[1fr_280px]">
        <section aria-labelledby="soal-judul">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h1 id="soal-judul" className="text-base font-bold text-slate-900">
                Soal {q.no} <span className="font-normal text-slate-500">dari {qs.length}</span>
              </h1>
              {flags.includes(q.no) && <Badge tone="amber">Ragu-ragu</Badge>}
            </div>

            {q.passage && (
              <div className="mb-4 max-h-72 overflow-y-auto whitespace-pre-line rounded-xl bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-800">
                {q.passage}
              </div>
            )}
            <p className="mb-4 whitespace-pre-line text-[17px] leading-relaxed text-slate-900">{q.body}</p>

            <Answer q={q} value={answers[q.no]} onChange={(r) => setAnswer(q.no, r)} />
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold">
              Daftar soal <span className="font-normal text-slate-500">· {answered}/{qs.length} dijawab</span>
            </p>
            <NavGrid qs={qs} answers={answers} flags={flags} current={idx} onPick={setIdx} />
            <Legend />
          </div>
        </aside>
      </main>

      <nav
        aria-label="Navigasi soal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <Button variant="secondary" onClick={() => setIdx(idx - 1)} disabled={idx === 0}>
            ← <span className="hidden sm:inline">Sebelumnya</span>
          </Button>
          <Button
            variant={flags.includes(q.no) ? "primary" : "secondary"}
            className={flags.includes(q.no) ? "!bg-amber-500 hover:!bg-amber-600" : ""}
            onClick={toggleFlag}
            aria-pressed={flags.includes(q.no)}
          >
            Ragu-ragu
          </Button>
          <div className="flex-1" />
          {idx < qs.length - 1 ? (
            <Button onClick={() => setIdx(idx + 1)}>
              <span className="hidden sm:inline">Berikutnya</span> →
            </Button>
          ) : (
            <Button onClick={() => setConfirmOpen(true)}>Selesai</Button>
          )}
        </div>
      </nav>

      <Modal open={navOpen} onClose={() => setNavOpen(false)} title={`Daftar soal · ${answered}/${qs.length} dijawab`}>
        <NavGrid
          qs={qs}
          answers={answers}
          flags={flags}
          current={idx}
          onPick={(i) => {
            setIdx(i);
            setNavOpen(false);
          }}
        />
        <Legend />
        <Button
          className="mt-4 w-full"
          onClick={() => {
            setNavOpen(false);
            setConfirmOpen(true);
          }}
        >
          Selesai dan kirim jawaban
        </Button>
      </Modal>

      <Modal open={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)} title="Kirim jawaban?">
        <p className="text-sm text-slate-700">
          Anda menjawab <b>{answered}</b> dari <b>{qs.length}</b> soal.
          {answered < qs.length && (
            <span className="text-red-700"> Masih ada {qs.length - answered} soal belum dijawab.</span>
          )}
          {flags.length > 0 && <> Ada {flags.length} soal bertanda ragu-ragu.</>} Setelah dikirim, jawaban tidak dapat diubah.
        </p>
        {submitErr && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitErr}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={submitting} onClick={() => setConfirmOpen(false)}>
            Kembali
          </Button>
          <Button disabled={submitting} onClick={() => void finish(false)}>
            {submitting ? "Mengirim…" : "Ya, kirim"}
          </Button>
        </div>
      </Modal>

      {/* Waktu habis / pengiriman otomatis */}
      {remaining !== null && remaining <= 0 && !confirmOpen && (
        <Overlay title="Waktu habis">
          <p className="text-sm text-slate-600">Jawaban Anda sedang dikirim…</p>
          {submitErr && (
            <>
              <p role="alert" className="mt-3 text-sm text-red-700">
                {submitErr}
              </p>
              <Button className="mt-3" onClick={() => void finish(true)}>
                Coba kirim lagi
              </Button>
            </>
          )}
        </Overlay>
      )}

      {gate && (
        <Overlay title="Lanjutkan ujian">
          <p className="text-sm text-slate-600">
            Halaman dimuat ulang. Waktu tetap berjalan. Tekan tombol untuk kembali ke layar penuh dan melanjutkan.
          </p>
          <Button
            className="mt-4 w-full"
            onClick={() => {
              enterFullscreen();
              setGate(false);
            }}
          >
            Lanjutkan
          </Button>
        </Overlay>
      )}

      {fsLost && !gate && (
        <Overlay title="Keluar dari layar penuh">
          <p className="text-sm text-slate-600">Keluar dari layar penuh dicatat sebagai pelanggaran. Kembali ke layar penuh untuk melanjutkan.</p>
          <Button
            className="mt-4 w-full"
            onClick={() => {
              enterFullscreen();
              setFsLost(false);
            }}
          >
            Kembali ke layar penuh
          </Button>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="alertdialog" aria-label={title} className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function NavGrid({
  qs,
  answers,
  flags,
  current,
  onPick,
}: {
  qs: ExamQuestion[];
  answers: Record<number, Response>;
  flags: number[];
  current: number;
  onPick: (i: number) => void;
}) {
  return (
    <ol className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
      {qs.map((x, i) => {
        const done = isAnswered(answers[x.no]);
        const flagged = flags.includes(x.no);
        const cls = flagged
          ? "bg-amber-400 text-white"
          : done
            ? "bg-brand-600 text-white"
            : "bg-slate-100 text-slate-700";
        return (
          <li key={x.no}>
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-current={i === current ? "step" : undefined}
              aria-label={`Soal ${x.no}${done ? ", sudah dijawab" : ""}${flagged ? ", ragu-ragu" : ""}`}
              className={`touch-target w-full rounded-lg text-sm font-semibold ${cls} ${
                i === current ? "ring-2 ring-slate-900 ring-offset-1" : ""
              }`}
            >
              {x.no}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Legend() {
  return (
    <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
      <span>
        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-600" />
        Dijawab
      </span>
      <span>
        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
        Ragu-ragu
      </span>
      <span>
        <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-200" />
        Belum
      </span>
    </p>
  );
}

function Answer({ q, value, onChange }: { q: ExamQuestion; value: Response | undefined; onChange: (r: Response) => void }) {
  const letter = (i: number) => String.fromCharCode(65 + i);

  if (q.kind === "pg") {
    return (
      <fieldset className="space-y-2">
        <legend className="sr-only">Pilih satu jawaban</legend>
        {q.options.map((o, i) => (
          <label
            key={i}
            className={`touch-target flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${
              value === i ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name={`q${q.no}`}
              className="mt-1 h-5 w-5 shrink-0 accent-brand-700"
              checked={value === i}
              onChange={() => onChange(i)}
            />
            <span className="font-semibold text-slate-500">{letter(i)}.</span>
            <span className="whitespace-pre-line text-[16px] text-slate-900">{o}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (q.kind === "pgk") {
    const sel = Array.isArray(value) ? (value as number[]) : [];
    return (
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm text-slate-500">Pilih semua jawaban yang benar</legend>
        {q.options.map((o, i) => (
          <label
            key={i}
            className={`touch-target flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${
              sel.includes(i) ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-brand-700"
              checked={sel.includes(i)}
              onChange={(e) =>
                onChange(e.target.checked ? [...sel, i].sort((a, b) => a - b) : sel.filter((k) => k !== i))
              }
            />
            <span className="font-semibold text-slate-500">{letter(i)}.</span>
            <span className="whitespace-pre-line text-[16px] text-slate-900">{o}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  const vals = Array.isArray(value) ? (value as (boolean | null)[]) : q.options.map(() => null);
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm text-slate-500">Tentukan setiap pernyataan Benar atau Salah</legend>
      {q.options.map((o, i) => (
        <div key={i} className="rounded-xl border-2 border-slate-200 p-3">
          <p className="mb-2 whitespace-pre-line text-[16px] text-slate-900">{o}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              [true, "Benar"],
              [false, "Salah"],
            ].map(([v, label]) => (
              <button
                key={String(label)}
                type="button"
                aria-pressed={vals[i] === v}
                onClick={() => {
                  const next = q.options.map((_, k) => vals[k] ?? null);
                  next[i] = v as boolean;
                  onChange(next);
                }}
                className={`touch-target rounded-lg border-2 font-semibold transition ${
                  vals[i] === v ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
