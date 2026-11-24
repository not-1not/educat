export type Student = {
  id: string;
  nisn: string;
  full_name: string;
  gender: "L" | "P" | null;
  birth_date: string | null;
  class_level: number | null;
};

export type Pkg = {
  id: string;
  name: string;
  subject: string;
  created_at: string;
};

export type QuestionKind = "pg" | "pgk" | "bs";

export type Question = {
  id: string;
  package_id: string;
  no: number;
  kind: QuestionKind;
  passage: string | null;
  body: string;
  options: string[];
  // pg: number, pgk: number[], bs: boolean[]
  answer_key: number | number[] | boolean[];
  points: number;
  explanation: string | null;
};

export type ExamToken = {
  id: string;
  code: string;
  subject: string;
  package_name: string;
  package_id: string | null;
  quota: number;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  result_mode: "immediate" | "held";
  created_at: string;
};

export type SessionStatus = "active" | "submitted" | "forced" | "expired";

// Soal untuk siswa (tanpa kunci jawaban).
export type ExamQuestion = {
  no: number;
  kind: QuestionKind;
  passage: string | null;
  body: string;
  options: string[];
};

// Jawaban siswa: pg = angka, pgk = array angka, bs = array true/false/null.
export type Response = number | number[] | (boolean | null)[] | null;

export type ReviewItem = ExamQuestion & {
  answer_key: number | number[] | boolean[];
  explanation: string | null;
  response: Response;
  earned: number;
  points: number;
};

export type ExamResult =
  | { held: true; status: SessionStatus }
  | {
      held: false;
      status: SessionStatus;
      score: number;
      correct: number;
      wrong: number;
      blank: number;
      review: ReviewItem[];
    };

export const KIND_LABEL: Record<QuestionKind, string> = {
  pg: "Pilihan ganda",
  pgk: "Pilihan ganda kompleks",
  bs: "Benar / Salah",
};

export const STATUS_LABEL: Record<SessionStatus, string> = {
  active: "Mengerjakan",
  submitted: "Selesai",
  forced: "Dihentikan operator",
  expired: "Waktu habis",
};

export const VIOLATION_LABEL: Record<string, string> = {
  tab_switch: "Pindah tab/aplikasi",
  fullscreen_exit: "Keluar layar penuh",
  disconnect: "Koneksi terputus",
};
