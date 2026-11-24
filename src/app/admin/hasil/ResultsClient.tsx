"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Empty, Modal, PageHeader, Spinner, inputCls } from "@/components/ui";
import { toCSV } from "@/lib/csv";
import { one } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABEL, VIOLATION_LABEL, type ExamToken, type SessionStatus } from "@/lib/types";
import { downloadFile, errMsg, fmtDateTime, fmtTime } from "@/lib/util";

type Row = {
  id: string;
  name: string;
  nisn: string;
  class_level: number | null;
  status: SessionStatus;
  submitted_at: string | null;
  score: number | null;
  correct: number | null;
  wrong: number | null;
  blank: number | null;
  violations: { kind: string; occurred_at: string }[];
};

type Raw = {
  id: string;
  status: SessionStatus;
  submitted_at: string | null;
  students: { full_name: string; nisn: string; class_level: number | null } | { full_name: string; nisn: string; class_level: number | null }[] | null;
  results: { score: number; correct_count: number; wrong_count: number; blank_count: number } | { score: number; correct_count: number; wrong_count: number; blank_count: number }[] | null;
  violations: { kind: string; occurred_at: string }[] | null;
};

export function ResultsClient() {
  const [tokens, setTokens] = useState<ExamToken[] | null>(null);
  const [tokenId, setTokenId] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);

  useEffect(() => {
    createClient()
      .from("exam_tokens")
      .select("*")
      .order("starts_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) return setError(errMsg(error));
        const list = (data ?? []) as ExamToken[];
        setTokens(list);
        setTokenId(list[0]?.id ?? "");
      });
  }, []);

  useEffect(() => {
    if (!tokenId) return;
    let alive = true;
    (async () => {
      const supabase = createClient();
      setRows(null);
      await supabase.rpc("expire_overdue_sessions");
      const { data, error } = await supabase
        .from("exam_sessions")
        .select(
          "id,status,submitted_at,students(full_name,nisn,class_level),results(score,correct_count,wrong_count,blank_count),violations(kind,occurred_at)",
        )
        .eq("token_id", tokenId);
      if (!alive) return;
      if (error) return setError(errMsg(error));
      setError(null);
      const mapped = ((data ?? []) as unknown as Raw[]).map((s): Row => {
        const st = one(s.students);
        const r = one(s.results);
        return {
          id: s.id,
          name: st?.full_name ?? "-",
          nisn: st?.nisn ?? "-",
          class_level: st?.class_level ?? null,
          status: s.status,
          submitted_at: s.submitted_at,
          score: r ? Number(r.score) : null,
          correct: r?.correct_count ?? null,
          wrong: r?.wrong_count ?? null,
          blank: r?.blank_count ?? null,
          violations: s.violations ?? [],
        };
      });
      mapped.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
      setRows(mapped);
    })();
    return () => {
      alive = false;
    };
  }, [tokenId]);

  const stats = useMemo(() => {
    const scored = (rows ?? []).filter((r) => r.score != null).map((r) => r.score as number);
    if (scored.length === 0) return null;
    return {
      n: scored.length,
      avg: scored.reduce((a, b) => a + b, 0) / scored.length,
      max: Math.max(...scored),
      min: Math.min(...scored),
    };
  }, [rows]);

  const token = tokens?.find((t) => t.id === tokenId);

  function exportCsv() {
    if (!rows || !token) return;
    const csv = toCSV([
      ["No", "Nama", "NISN", "Kelas", "Nilai", "Benar", "Salah", "Kosong", "Status", "Pelanggaran", "Selesai"],
      ...rows.map((r, i) => [
        i + 1,
        r.name,
        r.nisn,
        r.class_level,
        r.score?.toFixed(2),
        r.correct,
        r.wrong,
        r.blank,
        STATUS_LABEL[r.status],
        r.violations.length,
        r.submitted_at ? fmtDateTime(r.submitted_at) : "",
      ]),
    ]);
    downloadFile(`hasil-${token.code}-${token.subject.replace(/\s+/g, "_")}.csv`, csv);
  }

  return (
    <>
      <PageHeader
        title="Hasil ujian"
        description="Nilai, pelanggaran, dan rekap per token."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!rows || rows.length === 0}>
            Ekspor CSV
          </Button>
        }
      />
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!tokens && !error && <Spinner />}
      {tokens && tokens.length === 0 && <Empty>Belum ada token. Hasil akan muncul setelah siswa mengerjakan ujian.</Empty>}

      {tokens && tokens.length > 0 && (
        <>
          <select className={inputCls + " mb-4"} value={tokenId} onChange={(e) => setTokenId(e.target.value)} aria-label="Pilih token">
            {tokens.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.subject} ({t.package_name})
              </option>
            ))}
          </select>

          {stats && (
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Peserta dinilai", String(stats.n)],
                ["Rata-rata", stats.avg.toFixed(1)],
                ["Tertinggi", stats.max.toFixed(1)],
                ["Terendah", stats.min.toFixed(1)],
              ].map(([l, v]) => (
                <Card key={l}>
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="mt-1 text-2xl font-bold">{v}</p>
                </Card>
              ))}
            </div>
          )}

          {!rows && <Spinner />}
          {rows && rows.length === 0 && <Empty>Belum ada siswa yang mengerjakan token ini.</Empty>}
          {rows && rows.length > 0 && (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Peserta</th>
                      <th className="px-4 py-3">Kelas</th>
                      <th className="px-4 py-3 text-right">Nilai</th>
                      <th className="px-4 py-3">B / S / K</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Pelanggaran</th>
                      <th className="px-4 py-3">Selesai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{r.name}</p>
                          <p className="font-mono text-xs text-slate-500">{r.nisn}</p>
                        </td>
                        <td className="px-4 py-3">{r.class_level ?? "-"}</td>
                        <td className="px-4 py-3 text-right text-lg font-bold">{r.score != null ? r.score.toFixed(1) : "-"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.score != null ? `${r.correct} / ${r.wrong} / ${r.blank}` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={r.status === "active" ? "blue" : r.status === "submitted" ? "green" : r.status === "forced" ? "red" : "amber"}>
                            {STATUS_LABEL[r.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {r.violations.length > 0 ? (
                            <button type="button" onClick={() => setDetail(r)} className="rounded-full">
                              <Badge tone="red">{r.violations.length}× lihat</Badge>
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.submitted_at ? fmtTime(r.submitted_at) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-2 md:hidden">
                {rows.map((r, i) => (
                  <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {i + 1}. {r.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Kelas {r.class_level ?? "-"} · {STATUS_LABEL[r.status]}
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-brand-700">{r.score != null ? r.score.toFixed(1) : "-"}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                      <span>{r.score != null ? `Benar ${r.correct} · Salah ${r.wrong} · Kosong ${r.blank}` : "Belum dinilai"}</span>
                      {r.violations.length > 0 && (
                        <button type="button" onClick={() => setDetail(r)}>
                          <Badge tone="red">{r.violations.length} pelanggaran</Badge>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Pelanggaran — ${detail?.name ?? ""}`}>
        <ul className="space-y-2 text-sm">
          {detail?.violations
            .slice()
            .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
            .map((v, i) => (
              <li key={i} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span>{VIOLATION_LABEL[v.kind] ?? v.kind}</span>
                <span className="text-slate-500">{fmtTime(v.occurred_at)}</span>
              </li>
            ))}
        </ul>
      </Modal>
    </>
  );
}
