-- EduCAT: skema awal. Jalankan di Supabase SQL Editor.
-- Setiap tabel terikat ke sekolah (school_id) agar data antarsekolah terpisah.

create extension if not exists "pgcrypto";

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  npsn text unique,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  nisn char(10) not null,
  full_name text not null,
  gender text check (gender in ('L', 'P')),
  birth_date date,
  class_level smallint check (class_level between 1 and 12),
  created_at timestamptz not null default now(),
  unique (school_id, nisn)
);

create table if not exists exam_tokens (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  code char(6) not null unique,
  subject text not null,
  package_name text not null,
  quota int not null default 0 check (quota >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes int not null default 75 check (duration_minutes > 0),
  result_mode text not null default 'immediate'
    check (result_mode in ('immediate', 'held')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists exam_sessions (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references exam_tokens(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  started_at timestamptz not null default now(),
  -- Waktu berakhir dihitung di server saat sesi dibuat, bukan di browser.
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'submitted', 'forced', 'expired')),
  unique (token_id, student_id)
);

create table if not exists answers (
  session_id uuid not null references exam_sessions(id) on delete cascade,
  question_no int not null check (question_no > 0),
  -- Bentuk jawaban berbeda per tipe soal, jadi disimpan sebagai JSON.
  response jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, question_no)
);

create table if not exists violations (
  id bigint generated always as identity primary key,
  session_id uuid not null references exam_sessions(id) on delete cascade,
  kind text not null check (kind in ('tab_switch', 'fullscreen_exit', 'disconnect')),
  occurred_at timestamptz not null default now(),
  detail jsonb
);

create table if not exists results (
  session_id uuid primary key references exam_sessions(id) on delete cascade,
  score numeric(6, 2) not null,
  correct_count int not null,
  wrong_count int not null,
  blank_count int not null,
  computed_at timestamptz not null default now()
);

-- Indeks untuk query yang sering dipakai: monitoring dan daftar hasil.
create index if not exists idx_students_school on students(school_id);
create index if not exists idx_tokens_school on exam_tokens(school_id);
create index if not exists idx_sessions_token on exam_sessions(token_id);
create index if not exists idx_violations_session on violations(session_id);

-- Row Level Security: aktifkan di semua tabel. Kebijakan spesifik
-- (operator sekolah, siswa) akan ditambahkan pada tahap autentikasi.
alter table schools enable row level security;
alter table students enable row level security;
alter table exam_tokens enable row level security;
alter table exam_sessions enable row level security;
alter table answers enable row level security;
alter table violations enable row level security;
alter table results enable row level security;
