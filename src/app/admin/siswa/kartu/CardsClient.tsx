"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button, Empty, PageHeader, Spinner, inputCls } from "@/components/ui";
import { fetchAll } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import type { ExamToken, Student } from "@/lib/types";
import { errMsg, fmtDate, ujianUrl } from "@/lib/util";

function Qr({ value }: { value: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [value]);
  // SVG dihasilkan pustaka qrcode dari URL milik kita sendiri.
  return <div className="h-20 w-20 shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} aria-label="Kode QR menuju halaman ujian" role="img" />;
}

export function CardsClient() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [tokens, setTokens] = useState<ExamToken[]>([]);
  const [school, setSchool] = useState("");
  const [cls, setCls] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const [list, tk, sc] = await Promise.all([
          fetchAll<Student>((from, to) =>
            supabase
              .from("students")
              .select("id,nisn,full_name,gender,birth_date,class_level")
              .order("class_level", { nullsFirst: false })
              .order("full_name")
              .range(from, to),
          ),
          supabase.from("exam_tokens").select("*").order("starts_at", { ascending: false }),
          supabase.from("schools").select("name").maybeSingle(),
        ]);
        if (tk.error) throw tk.error;
        setStudents(list);
        setTokens((tk.data ?? []) as ExamToken[]);
        setSchool(sc.data?.name ?? "");
      } catch (e) {
        setError(errMsg(e));
      }
    })();
  }, []);

  const classes = useMemo(
    () => Array.from(new Set((students ?? []).map((s) => s.class_level).filter((c): c is number => c != null))).sort((a, b) => a - b),
    [students],
  );
  const list = (students ?? []).filter((s) => !cls || String(s.class_level) === cls);
  const token = tokens.find((t) => t.id === tokenId);
  const url = ujianUrl(token?.code);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Cetak kartu peserta"
          description="Kartu berisi NISN, tanggal lahir (kata sandi), dan kode QR menuju halaman ujian."
          actions={
            <>
              <Link
                href="/admin/siswa"
                className="touch-target inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50"
              >
                Kembali
              </Link>
              <Button onClick={() => window.print()} disabled={list.length === 0}>
                Cetak / simpan PDF
              </Button>
            </>
          }
        />
        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          <select className={inputCls} value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Filter kelas">
            <option value="">Semua kelas</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                Kelas {c}
              </option>
            ))}
          </select>
          <select className={inputCls} value={tokenId} onChange={(e) => setTokenId(e.target.value)} aria-label="Token">
            <option value="">Tanpa token (siswa mengetik sendiri)</option>
            {tokens.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.subject}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {!students && !error && <Spinner />}
        {students && list.length === 0 && <Empty>Tidak ada siswa untuk dicetak.</Empty>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-2">
        {list.map((s) => (
          <div
            key={s.id}
            className="break-inside-avoid rounded-xl border border-slate-400 bg-white p-3 print:border-black"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700">Kartu peserta ujian · EduCAT</p>
            <p className="truncate text-[11px] text-slate-600">{school}</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="min-w-0 flex-1 text-xs">
                <p className="truncate text-sm font-bold text-slate-900">{s.full_name}</p>
                <p className="text-slate-600">Kelas {s.class_level ?? "-"}</p>
                <dl className="mt-1.5 space-y-0.5">
                  <div className="flex gap-1">
                    <dt className="w-16 shrink-0 text-slate-500">NISN</dt>
                    <dd className="font-mono font-semibold">{s.nisn}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="w-16 shrink-0 text-slate-500">Tgl lahir</dt>
                    <dd className="font-semibold">{fmtDate(s.birth_date)}</dd>
                  </div>
                  {token && (
                    <div className="flex gap-1">
                      <dt className="w-16 shrink-0 text-slate-500">Token</dt>
                      <dd className="font-mono text-sm font-bold tracking-widest">{token.code}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <Qr value={url} />
            </div>
            <p className="mt-2 break-all text-[9px] text-slate-500">{url}</p>
          </div>
        ))}
      </div>
    </>
  );
}
