"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, PageHeader, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/util";

type Stats = {
  students: number;
  packages: number;
  questions: number;
  tokens: number;
  activeTokens: number;
  sessionsActive: number;
  sessionsDone: number;
};

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    type Filter = { op: "eq" | "neq" | "lte" | "gte"; col: string; val: string };
    const count = async (table: string, filters: Filter[] = []) => {
      let q = supabase.from(table).select("*", { count: "exact", head: true });
      for (const f of filters) {
        if (f.op === "eq") q = q.eq(f.col, f.val);
        else if (f.op === "neq") q = q.neq(f.col, f.val);
        else if (f.op === "lte") q = q.lte(f.col, f.val);
        else q = q.gte(f.col, f.val);
      }
      const { count: c, error } = await q;
      if (error) throw error;
      return c ?? 0;
    };
    const nowIso = new Date().toISOString();
    Promise.all([
      count("students"),
      count("packages"),
      count("questions"),
      count("exam_tokens"),
      count("exam_tokens", [
        { op: "lte", col: "starts_at", val: nowIso },
        { op: "gte", col: "ends_at", val: nowIso },
      ]),
      count("exam_sessions", [{ op: "eq", col: "status", val: "active" }]),
      count("exam_sessions", [{ op: "neq", col: "status", val: "active" }]),
    ])
      .then(([students, packages, questions, tokens, activeTokens, sessionsActive, sessionsDone]) =>
        setStats({ students, packages, questions, tokens, activeTokens, sessionsActive, sessionsDone }),
      )
      .catch((e) => setError(errMsg(e)));
  }, []);

  if (error)
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    );
  if (!stats) return <Spinner />;

  const cards = [
    { label: "Siswa terdaftar", value: stats.students, href: "/admin/siswa" },
    { label: "Soal tersimpan", value: stats.questions, sub: `${stats.packages} paket`, href: "/admin/soal" },
    { label: "Token aktif", value: stats.activeTokens, sub: `dari ${stats.tokens} token`, href: "/admin/token" },
    { label: "Sedang mengerjakan", value: stats.sessionsActive, sub: `${stats.sessionsDone} selesai`, href: "/admin/monitoring" },
  ];

  const steps = [
    { done: stats.students > 0, text: "Tambahkan data siswa (manual atau impor CSV)", href: "/admin/siswa" },
    { done: stats.questions > 0, text: "Buat paket soal dan isi soalnya", href: "/admin/soal" },
    { done: stats.tokens > 0, text: "Buat token ujian dan jadwalnya", href: "/admin/token" },
    { done: stats.sessionsDone + stats.sessionsActive > 0, text: "Bagikan kartu peserta, pantau di Monitoring", href: "/admin/monitoring" },
  ];

  return (
    <>
      <PageHeader title="Ringkasan" description="Kondisi ujian di sekolah Anda saat ini." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="block">
            <Card className="h-full transition hover:border-brand-500">
              <p className="text-xs font-medium text-slate-500 sm:text-sm">{c.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{c.value}</p>
              {c.sub && <p className="mt-0.5 text-xs text-slate-500">{c.sub}</p>}
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="text-base font-bold">Langkah menyiapkan ujian</h2>
        <ol className="mt-3 space-y-2">
          {steps.map((s, i) => (
            <li key={s.text}>
              <Link
                href={s.href}
                className="touch-target flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-slate-50"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className={`text-sm ${s.done ? "text-slate-500 line-through" : "text-slate-800"}`}>
                  {s.text}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
