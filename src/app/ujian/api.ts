import { createClient } from "@/lib/supabase/client";
import type { ExamQuestion, ExamResult, Response } from "@/lib/types";

export type Cred = { id: string; key: string };

export type ExamData = {
  status: "active" | "submitted" | "forced" | "expired";
  deadline_at: string;
  server_now: string;
  student_name: string;
  subject: string;
  questions: ExamQuestion[];
  answers: Record<string, Response>;
};

export type StartData = {
  session_id: string;
  access_key: string;
  deadline_at: string;
  server_now: string;
  student_name: string;
  subject: string;
};

const KEY = "educat.session";

export function loadCred(): Cred | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cred;
    return c?.id && c?.key ? c : null;
  } catch {
    return null;
  }
}
export function saveCred(c: Cred) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* penyimpanan diblokir: sesi tetap berjalan, hanya tidak bisa dilanjutkan setelah refresh */
  }
}
export function clearCred() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const examStart = (code: string, nisn: string, birth: string) =>
  rpc<StartData>("exam_start", { p_code: code, p_nisn: nisn, p_birth: birth });

export const examGet = (c: Cred) => rpc<ExamData>("exam_get", { p_session: c.id, p_key: c.key });

export const examSave = (c: Cred, no: number, response: Response) =>
  rpc<{ ok: boolean }>("exam_save", { p_session: c.id, p_key: c.key, p_no: no, p_response: response });

export const examViolation = (c: Cred, kind: string, detail?: Record<string, unknown>) =>
  rpc<null>("exam_violation", { p_session: c.id, p_key: c.key, p_kind: kind, p_detail: detail ?? null });

export const examSubmit = (c: Cred) => rpc<ExamResult>("exam_submit", { p_session: c.id, p_key: c.key });

export const examResult = (c: Cred) => rpc<ExamResult>("exam_result", { p_session: c.id, p_key: c.key });

export function isAnswered(r: Response | undefined): boolean {
  if (r == null) return false;
  if (typeof r === "number") return true;
  return Array.isArray(r) && r.some((x) => x !== null);
}
