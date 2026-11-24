import { createClient } from "@/lib/supabase/client";

let cachedSchoolId: string | null = null;

// ID sekolah milik operator yang sedang login (di-cache selama sesi halaman).
export async function getSchoolId(): Promise<string> {
  if (cachedSchoolId) return cachedSchoolId;
  const { data, error } = await createClient()
    .from("operators")
    .select("school_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Akun belum terhubung ke sekolah.");
  cachedSchoolId = data.school_id;
  return data.school_id;
}

// PostgREST membatasi 1000 baris per permintaan; fungsi ini mengambil semuanya.
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

// Embedded relation dari PostgREST bisa berupa objek, array, atau null.
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function embeddedCount(v: unknown): number {
  const row = one(v as { count: number } | { count: number }[] | null);
  return row?.count ?? 0;
}
