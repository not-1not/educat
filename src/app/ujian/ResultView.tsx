"use client";

import { Badge, Button, Card } from "@/components/ui";
import type { ExamResult, ReviewItem } from "@/lib/types";

const letter = (i: number) => String.fromCharCode(65 + i);

function keyIndexes(it: ReviewItem): number[] {
  if (it.kind === "pg") return [it.answer_key as number];
  if (it.kind === "pgk") return it.answer_key as number[];
  return [];
}
function respIndexes(it: ReviewItem): number[] {
  if (it.response == null) return [];
  if (it.kind === "pg") return [it.response as number];
  if (it.kind === "pgk") return it.response as number[];
  return [];
}

export function ResultView({
  result,
  student,
  subject,
  onExit,
}: {
  result: ExamResult;
  student: string;
  subject: string;
  onExit: () => void;
}) {
  if (result.held) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
            ✓
          </div>
          <h1 className="text-xl font-bold">Jawaban terkirim</h1>
          <p className="mt-2 text-sm text-slate-600">
            Terima kasih, {student}. Jawaban ujian {subject} sudah tersimpan. Hasil akan diumumkan oleh sekolah.
          </p>
          <Button className="mt-5 w-full" onClick={onExit}>
            Selesai
          </Button>
        </div>
      </main>
    );
  }

  const total = result.correct + result.wrong + result.blank;
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8">
      <Card className="text-center">
        <p className="text-sm text-slate-500">
          {student} · {subject}
        </p>
        <p className="mt-2 text-6xl font-bold text-brand-700">{Number(result.score).toFixed(1).replace(/\.0$/, "")}</p>
        <p className="mt-1 text-sm text-slate-600">dari 100</p>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 py-3">
            <p className="text-2xl font-bold text-emerald-700">{result.correct}</p>
            <p className="text-xs text-emerald-800">Benar</p>
          </div>
          <div className="rounded-xl bg-red-50 py-3">
            <p className="text-2xl font-bold text-red-700">{result.wrong}</p>
            <p className="text-xs text-red-800">Salah / sebagian</p>
          </div>
          <div className="rounded-xl bg-slate-100 py-3">
            <p className="text-2xl font-bold text-slate-700">{result.blank}</p>
            <p className="text-xs text-slate-600">Kosong</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{total} soal</p>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-bold">Pembahasan</h2>
      <ol className="space-y-3">
        {result.review.map((it) => {
          const blank =
            it.response == null ||
            (Array.isArray(it.response) && (it.response as unknown[]).every((x) => x === null));
          const full = !blank && it.earned >= it.points;
          const partial = !blank && !full && it.earned > 0;
          const keys = keyIndexes(it);
          const resp = respIndexes(it);
          return (
            <li key={it.no}>
              <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
                <summary className="touch-target flex cursor-pointer list-none items-center gap-3 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold">
                    {it.no}
                  </span>
                  <span className="line-clamp-2 flex-1 text-sm text-slate-800">{it.body}</span>
                  <Badge tone={blank ? "slate" : full ? "green" : partial ? "amber" : "red"}>
                    {blank ? "Kosong" : full ? "Benar" : partial ? "Sebagian" : "Salah"}
                  </Badge>
                </summary>
                <div className="border-t border-slate-100 p-4">
                  {it.passage && (
                    <div className="mb-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{it.passage}</div>
                  )}
                  <p className="mb-3 whitespace-pre-line text-[15px] text-slate-900">{it.body}</p>

                  {it.kind !== "bs" ? (
                    <ul className="space-y-1.5">
                      {it.options.map((o, i) => {
                        const isKey = keys.includes(i);
                        const chosen = resp.includes(i);
                        return (
                          <li
                            key={i}
                            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                              isKey
                                ? "border-emerald-300 bg-emerald-50"
                                : chosen
                                  ? "border-red-300 bg-red-50"
                                  : "border-slate-200"
                            }`}
                          >
                            <span className="font-semibold text-slate-500">{letter(i)}.</span>
                            <span className="flex-1 whitespace-pre-line">{o}</span>
                            {isKey && <span className="shrink-0 text-xs font-semibold text-emerald-700">Kunci</span>}
                            {chosen && <span className="shrink-0 text-xs font-semibold text-slate-600">Jawaban Anda</span>}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <ul className="space-y-1.5">
                      {it.options.map((o, i) => {
                        const key = (it.answer_key as boolean[])[i];
                        const got = Array.isArray(it.response) ? (it.response as (boolean | null)[])[i] : null;
                        const ok = got === key;
                        return (
                          <li
                            key={i}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              ok ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
                            }`}
                          >
                            <p className="whitespace-pre-line">{o}</p>
                            <p className="mt-1 text-xs text-slate-600">
                              Kunci: <b>{key ? "Benar" : "Salah"}</b> · Jawaban Anda: <b>{got == null ? "-" : got ? "Benar" : "Salah"}</b>
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <p className="mt-3 text-xs text-slate-500">
                    Nilai soal: {Number(it.earned).toFixed(2).replace(/\.?0+$/, "") || "0"} dari {Number(it.points)}
                  </p>
                  {it.explanation && (
                    <div className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
                      <p className="font-semibold">Pembahasan</p>
                      <p className="mt-1 whitespace-pre-line">{it.explanation}</p>
                    </div>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <Button className="mt-8 w-full" onClick={onExit}>
        Selesai
      </Button>
    </main>
  );
}
