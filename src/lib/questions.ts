export type QKind = "pg" | "pgk" | "bs";

export type NewQuestion = {
  kind: QKind;
  passage: string | null;
  body: string;
  options: string[];
  answer_key: number | number[] | boolean[];
  points: number;
  explanation: string | null;
};

// Mengembalikan pesan galat, atau null bila soal valid.
export function validateQuestion(q: NewQuestion): string | null {
  if (!["pg", "pgk", "bs"].includes(q.kind)) return "Jenis soal tidak dikenal.";
  if (!q.body || q.body.trim().length === 0) return "Teks soal kosong.";
  if (!Array.isArray(q.options)) return "Pilihan jawaban harus berupa daftar.";
  if (q.options.some((o) => typeof o !== "string" || o.trim() === ""))
    return "Ada pilihan/pernyataan yang kosong.";
  if (q.options.length < 2 && q.kind !== "bs") return "Minimal 2 pilihan jawaban.";
  if (q.options.length < 1) return "Minimal 1 pernyataan.";
  if (q.options.length > 8) return "Maksimal 8 pilihan.";
  if (!(q.points > 0) || q.points > 100) return "Bobot harus lebih dari 0 dan paling banyak 100.";

  const n = q.options.length;
  const key = q.answer_key;
  if (q.kind === "pg") {
    if (typeof key !== "number" || !Number.isInteger(key) || key < 0 || key >= n)
      return "Kunci jawaban pilihan ganda belum dipilih.";
  } else if (q.kind === "pgk") {
    if (!Array.isArray(key) || key.length === 0) return "Pilih minimal satu jawaban benar.";
    const nums = key as number[];
    if (nums.some((k) => !Number.isInteger(k) || k < 0 || k >= n)) return "Kunci jawaban di luar pilihan.";
    if (new Set(nums).size !== nums.length) return "Kunci jawaban ganda terduplikasi.";
  } else {
    if (!Array.isArray(key) || key.length !== n || (key as unknown[]).some((k) => typeof k !== "boolean"))
      return "Setiap pernyataan harus diberi kunci Benar atau Salah.";
  }
  return null;
}

export function parseQuestionJSON(text: string): { valid: NewQuestion[]; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { valid: [], errors: ["Berkas bukan JSON yang valid."] };
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { questions?: unknown }).questions)
      ? (data as { questions: unknown[] }).questions
      : null;
  if (!list) return { valid: [], errors: ["JSON harus berupa daftar soal ([ ... ])."] };

  const valid: NewQuestion[] = [];
  const errors: string[] = [];
  list.forEach((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const q: NewQuestion = {
      kind: (r.kind ?? "pg") as QKind,
      passage: typeof r.passage === "string" && r.passage.trim() ? r.passage : null,
      body: typeof r.body === "string" ? r.body : "",
      options: Array.isArray(r.options) ? (r.options as string[]) : [],
      answer_key: r.answer as NewQuestion["answer_key"],
      points: r.points === undefined ? 1 : Number(r.points),
      explanation: typeof r.explanation === "string" && r.explanation.trim() ? r.explanation : null,
    };
    const err = validateQuestion(q);
    if (err) errors.push(`Soal ke-${i + 1}: ${err}`);
    else valid.push(q);
  });
  return { valid, errors };
}

export const QUESTION_TEMPLATE = JSON.stringify(
  [
    {
      kind: "pg",
      body: "Hasil dari 7 × 8 adalah ...",
      options: ["54", "56", "58", "64"],
      answer: 1,
      points: 1,
      explanation: "7 × 8 = 56.",
    },
    {
      kind: "pgk",
      body: "Manakah yang merupakan bilangan genap?",
      options: ["2", "3", "4", "7"],
      answer: [0, 2],
      points: 2,
    },
    {
      kind: "bs",
      passage: "Teks bacaan boleh diisi di sini (opsional).",
      body: "Tentukan benar atau salah.",
      options: ["Jakarta ibu kota Indonesia", "Matahari terbit dari barat"],
      answer: [true, false],
      points: 2,
    },
  ],
  null,
  2,
);
