// Pembaca & penulis CSV kecil: mendukung kutip ganda, koma atau titik koma.

export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v == null ? "" : String(v);
          return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

// Terima 2014-05-01, 01/05/2014, 1-5-2014 → "2014-05-01"; selain itu null.
export function normalizeDate(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    y = +match[1];
    m = +match[2];
    d = +match[3];
  } else {
    match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (!match) return null;
    d = +match[1];
    m = +match[2];
    y = +match[3];
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
    return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export type StudentRow = {
  nisn: string;
  full_name: string;
  birth_date: string;
  gender: "L" | "P" | null;
  class_level: number | null;
};

export type ParsedStudents = {
  valid: StudentRow[];
  errors: { line: number; message: string }[];
};

// Kolom (urutan bebas, baris pertama = judul): nisn, nama, tgl_lahir, jk, kelas
export function parseStudentCSV(text: string): ParsedStudents {
  const rows = parseCSV(text);
  const errors: ParsedStudents["errors"] = [];
  if (rows.length < 2)
    return { valid: [], errors: [{ line: 1, message: "Berkas kosong atau hanya berisi judul kolom." }] };

  const head = rows[0].map((h) => h.toLowerCase().replace(/[\s_-]/g, ""));
  const find = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iNisn = find("nisn");
  const iName = find("nama", "namalengkap", "name", "fullname");
  const iBirth = find("tgllahir", "tanggallahir", "lahir", "birthdate");
  const iGender = find("jk", "jeniskelamin", "gender");
  const iClass = find("kelas", "class", "classlevel");

  if (iNisn < 0 || iName < 0 || iBirth < 0)
    return {
      valid: [],
      errors: [{ line: 1, message: "Kolom wajib: nisn, nama, tgl_lahir (kolom jk dan kelas opsional)." }],
    };

  const valid: StudentRow[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const nisn = (r[iNisn] ?? "").replace(/\D/g, "");
    const name = (r[iName] ?? "").trim();
    const birth = normalizeDate(r[iBirth] ?? "");
    const g = (r[iGender] ?? "").trim().toUpperCase();
    const gender = g.startsWith("L") ? "L" : g.startsWith("P") ? "P" : null;
    const cls = iClass >= 0 ? parseInt(r[iClass] ?? "", 10) : NaN;

    if (nisn.length !== 10) return void errors.push({ line, message: `NISN harus 10 digit (ditemukan "${r[iNisn] ?? ""}").` });
    if (name.length < 2) return void errors.push({ line, message: "Nama kosong." });
    if (!birth) return void errors.push({ line, message: `Tanggal lahir tidak valid ("${r[iBirth] ?? ""}"). Pakai format 2014-05-01 atau 01/05/2014.` });
    if (seen.has(nisn)) return void errors.push({ line, message: `NISN ${nisn} muncul dua kali dalam berkas.` });
    seen.add(nisn);
    valid.push({
      nisn,
      full_name: name,
      birth_date: birth,
      gender,
      class_level: cls >= 1 && cls <= 12 ? cls : null,
    });
  });
  return { valid, errors };
}

export const STUDENT_TEMPLATE =
  "nisn,nama,tgl_lahir,jk,kelas\r\n0123456789,Contoh Siswa Satu,2014-05-01,L,6\r\n0123456790,Contoh Siswa Dua,02/06/2014,P,6\r\n";
