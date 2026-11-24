"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Empty, PageHeader, Spinner, inputCls, useToast } from "@/components/ui";
import { embeddedCount, one } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABEL, type ExamToken, type SessionStatus } from "@/lib/types";
import { errMsg, fmtTime } from "@/lib/util";

type Row = {
  id: string;
  status: SessionStatus;
  started_at: string;
  deadline_at: string;
  name: string;
  nisn: string;
  answered: number;
  violations: number;
};

const POLL_MS = 5000;

export function MonitoringClient() {
  const [tokens, setTokens] = useState<ExamToken[] | null>(null);
  const [tokenId, setTokenId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [onlyViol, setOnlyViol] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [auto, setAuto] = useState(true);
  const { toast, show } = useToast();

  // Muat daftar token; pilih yang sedang aktif lebih dulu.
  useEffect(() => {
    createClient()
      .from("exam_tokens")
      .select("*")
      .order("starts_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) return setError(errMsg(error));
        const list = (data ?? []) as ExamToken[];
        setTokens(list);
        const now = Date.now();
        const live = list.find((t) => new Date(t.starts_at).getTime() <= now && now <= new Date(t.ends_at).getTime());
        setTokenId((live ?? list[0])?.id ?? "");
      });
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenId) return;
    const supabase = createClient();
    try {
      // Selesaikan sesi yang lewat waktu agar status akurat.
      await supabase.rpc("expire_overdue_sessions");
      const token = tokens?.find((t) => t.id === tokenId);
      const [ss, qc] = await Promise.all([
        supabase
          .from("exam_sessions")
          .select("id,status,started_at,deadline_at,students(full_name,nisn),answers(count),violations(count)")
          .eq("token_id", tokenId)
          .order("started_at", { ascending: false }),
        token?.package_id
          ? supabase.from("questions").select("*", { count: "exact", head: true }).eq("package_id", token.package_id)
          : Promise.resolve({ count: 0, error: null }),
      ]);
      if (ss.error) throw ss.error;
      setTotal(qc.count ?? 0);
      setRows(
        (ss.data ?? []).map((s) => {
          const st = one(s.students as { full_name: string; nisn: string } | { full_name: string; nisn: string }[] | null);
          return {
            id: s.id,
            status: s.status as SessionStatus,
            started_at: s.started_at,
            deadline_at: s.deadline_at,
            name: st?.full_name ?? "-",
            nisn: st?.nisn ?? "-",
            answered: embeddedCount(s.answers),
            violations: embeddedCount(s.violations),
          };
        }),
      );
      setUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [tokenId, tokens]);

  useEffect(() => {
    if (!tokenId || !tokens) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    if (!auto) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [tokenId, tokens, auto, refresh]);

  async function force(r: Row) {
    if (!confirm(`Hentikan ujian ${r.name} sekarang? Jawaban yang sudah tersimpan akan dinilai.`)) return;
    const { error } = await createClient().rpc("force_end_session", { p_session: r.id });
    if (error) return show(errMsg(error), false);
    show(`Ujian ${r.name} dihentikan.`);
    await refresh();
  }

  const shown = rows.filter((r) => !onlyViol || r.violations > 0);
  const active = rows.filter((r) => r.status === "active").length;
  const done = rows.length - active;
  const viol = rows.reduce((n, r) => n + r.violations, 0);

  return (
    <>
      <PageHeader
        title="Monitoring"
        description="Pantau peserta yang sedang ujian. Data diperbarui otomatis tiap 5 detik."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAuto(!auto)} aria-pressed={auto}>
              {auto ? "Jeda otomatis" : "Lanjutkan otomatis"}
            </Button>
            <Button variant="secondary" onClick={refresh} disabled={!tokenId}>
              Muat ulang
            </Button>
          </>
        }
      />

      {!tokens && !error && <Spinner />}
      {tokens && tokens.length === 0 && <Empty>Belum ada token ujian untuk dipantau.</Empty>}
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {tokens && tokens.length > 0 && (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <select className={inputCls} value={tokenId} onChange={(e) => setTokenId(e.target.value)} aria-label="Pilih token">
              {tokens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.subject} ({t.package_name})
                </option>
              ))}
            </select>
            <label className="touch-target flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={onlyViol} onChange={(e) => setOnlyViol(e.target.checked)} />
              Hanya yang melanggar
            </label>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Peserta masuk", rows.length],
              ["Sedang mengerjakan", active],
              ["Sudah selesai", done],
              ["Total pelanggaran", viol],
            ].map(([l, v]) => (
              <Card key={l as string}>
                <p className="text-xs text-slate-500">{l}</p>
                <p className="mt-1 text-2xl font-bold">{v}</p>
              </Card>
            ))}
          </div>

          {rows.length === 0 ? (
            <Empty>Belum ada siswa yang masuk dengan token ini.</Empty>
          ) : shown.length === 0 ? (
            <Empty>Tidak ada peserta yang melanggar.</Empty>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Peserta</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Progres</th>
                      <th className="px-4 py-3">Pelanggaran</th>
                      <th className="px-4 py-3">Batas waktu</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shown.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{r.name}</p>
                          <p className="font-mono text-xs text-slate-500">{r.nisn}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge s={r.status} />
                        </td>
                        <td className="px-4 py-3">
                          <Progress done={r.answered} total={total} />
                        </td>
                        <td className="px-4 py-3">{r.violations > 0 ? <Badge tone="red">{r.violations}×</Badge> : "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtTime(r.deadline_at)}</td>
                        <td className="px-4 py-3 text-right">
                          {r.status === "active" && (
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => force(r)}>
                              Hentikan
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-2 md:hidden">
                {shown.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{r.name}</p>
                        <p className="font-mono text-xs text-slate-500">{r.nisn}</p>
                      </div>
                      <StatusBadge s={r.status} />
                    </div>
                    <div className="mt-3">
                      <Progress done={r.answered} total={total} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <span>Batas {fmtTime(r.deadline_at)}</span>
                      {r.violations > 0 && <Badge tone="red">{r.violations} pelanggaran</Badge>}
                    </div>
                    {r.status === "active" && (
                      <Button size="sm" variant="secondary" className="mt-3 w-full text-red-600" onClick={() => force(r)}>
                        Hentikan ujian
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {updated && <p className="mt-3 text-xs text-slate-500">Diperbarui {fmtTime(updated.toISOString())}</p>}
        </>
      )}
      {toast}
    </>
  );
}

function StatusBadge({ s }: { s: SessionStatus }) {
  const tone = s === "active" ? "blue" : s === "submitted" ? "green" : s === "forced" ? "red" : "amber";
  return <Badge tone={tone}>{STATUS_LABEL[s]}</Badge>;
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="min-w-24">
      <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {done}/{total} soal dijawab
      </p>
    </div>
  );
}
