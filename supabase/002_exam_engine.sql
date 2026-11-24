-- EduCAT tahap 2: operator sekolah, paket soal, kebijakan RLS, dan mesin ujian.
-- Jalankan SETELAH schema.sql. Aman dijalankan ulang (idempotent).

-- ============================================================
-- 1. Operator (akun admin sekolah) dan helper
-- ============================================================
create table if not exists operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table operators enable row level security;

create or replace function current_school_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select school_id from operators where user_id = auth.uid() $$;

-- Pendaftaran sekolah baru: membuat sekolah dan menjadikan pemanggil operatornya.
create or replace function register_school(p_name text, p_npsn text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'BELUM_LOGIN'; end if;
  if exists (select 1 from operators where user_id = auth.uid()) then
    raise exception 'SUDAH_TERDAFTAR';
  end if;
  if length(trim(coalesce(p_name, ''))) < 3 then raise exception 'NAMA_SEKOLAH_PENDEK'; end if;
  insert into schools (name, npsn)
    values (trim(p_name), nullif(trim(coalesce(p_npsn, '')), ''))
    returning id into sid;
  insert into operators (user_id, school_id) values (auth.uid(), sid);
  return sid;
end $$;

-- ============================================================
-- 2. Paket soal
-- ============================================================
create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default current_school_id() references schools(id) on delete cascade,
  name text not null,
  subject text not null,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  school_id uuid not null default current_school_id() references schools(id) on delete cascade,
  no int not null check (no > 0),
  -- pg = pilihan ganda, pgk = pilihan ganda kompleks, bs = benar/salah per pernyataan
  kind text not null check (kind in ('pg', 'pgk', 'bs')),
  passage text,
  body text not null,
  -- pg/pgk: daftar pilihan. bs: daftar pernyataan.
  options jsonb not null,
  -- pg: indeks (angka). pgk: array indeks. bs: array true/false.
  answer_key jsonb not null,
  points numeric(5, 2) not null default 1 check (points > 0),
  explanation text,
  unique (package_id, no)
);

alter table exam_tokens add column if not exists package_id uuid references packages(id) on delete set null;
create index if not exists idx_questions_package on questions(package_id);
create index if not exists idx_packages_school on packages(school_id);

-- school_id terisi otomatis dari akun yang login.
alter table students alter column school_id set default current_school_id();
alter table exam_tokens alter column school_id set default current_school_id();

-- Kunci akses sesi: dipegang browser siswa, tanpa akun login.
alter table exam_sessions add column if not exists access_key uuid not null default gen_random_uuid();

alter table packages enable row level security;
alter table questions enable row level security;

-- ============================================================
-- 3. Kebijakan RLS untuk operator (siswa hanya lewat fungsi di bawah)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['students', 'exam_tokens', 'packages', 'questions'] loop
    execute format('drop policy if exists op_all on %I', t);
    execute format(
      'create policy op_all on %I for all to authenticated
         using (school_id = current_school_id())
         with check (school_id = current_school_id())', t);
  end loop;
end $$;

drop policy if exists op_read on schools;
create policy op_read on schools for select to authenticated using (id = current_school_id());
drop policy if exists op_update on schools;
create policy op_update on schools for update to authenticated
  using (id = current_school_id()) with check (id = current_school_id());

drop policy if exists op_read on operators;
create policy op_read on operators for select to authenticated using (user_id = auth.uid());

drop policy if exists op_read on exam_sessions;
create policy op_read on exam_sessions for select to authenticated
  using (exists (select 1 from exam_tokens t where t.id = token_id and t.school_id = current_school_id()));

drop policy if exists op_read on answers;
create policy op_read on answers for select to authenticated
  using (exists (select 1 from exam_sessions s join exam_tokens t on t.id = s.token_id
                 where s.id = session_id and t.school_id = current_school_id()));

drop policy if exists op_read on violations;
create policy op_read on violations for select to authenticated
  using (exists (select 1 from exam_sessions s join exam_tokens t on t.id = s.token_id
                 where s.id = session_id and t.school_id = current_school_id()));

drop policy if exists op_read on results;
create policy op_read on results for select to authenticated
  using (exists (select 1 from exam_sessions s join exam_tokens t on t.id = s.token_id
                 where s.id = session_id and t.school_id = current_school_id()));

-- ============================================================
-- 4. Penilaian
-- ============================================================
create or replace function _is_blank(r jsonb)
returns boolean language sql immutable as $$
  select r is null or r = 'null'::jsonb or r = '[]'::jsonb
         or (jsonb_typeof(r) = 'array' and not exists (
               select 1 from jsonb_array_elements(r) e where e <> 'null'::jsonb))
$$;

-- Skor satu soal. pg dan pgk: harus tepat. bs: sebanding jumlah pernyataan yang benar.
create or replace function _score_question(p_kind text, p_key jsonb, p_resp jsonb, p_points numeric)
returns numeric language plpgsql immutable as $$
declare ok int := 0; total int; i int;
begin
  if _is_blank(p_resp) then return 0; end if;
  if p_kind = 'pg' then
    return case when p_resp = p_key then p_points else 0 end;
  elsif p_kind = 'pgk' then
    if jsonb_typeof(p_resp) <> 'array' then return 0; end if;
    return case when
      (select coalesce(jsonb_agg(x order by x::int), '[]') from jsonb_array_elements(p_resp) x)
      = (select coalesce(jsonb_agg(x order by x::int), '[]') from jsonb_array_elements(p_key) x)
      then p_points else 0 end;
  elsif p_kind = 'bs' then
    if jsonb_typeof(p_resp) <> 'array' then return 0; end if;
    total := jsonb_array_length(p_key);
    if total = 0 then return 0; end if;
    for i in 0 .. total - 1 loop
      if (p_resp -> i) = (p_key -> i) then ok := ok + 1; end if;
    end loop;
    return round(p_points * ok / total, 2);
  end if;
  return 0;
end $$;

create or replace function _finalize(p_session uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; maxp numeric; got numeric; c int; w int; b int;
begin
  select t.package_id into pid
    from exam_sessions s join exam_tokens t on t.id = s.token_id where s.id = p_session;

  select coalesce(sum(q.points), 0),
         coalesce(sum(_score_question(q.kind, q.answer_key, a.response, q.points)), 0),
         count(*) filter (where not _is_blank(a.response)
                          and _score_question(q.kind, q.answer_key, a.response, q.points) >= q.points),
         count(*) filter (where not _is_blank(a.response)
                          and _score_question(q.kind, q.answer_key, a.response, q.points) < q.points),
         count(*) filter (where _is_blank(a.response))
    into maxp, got, c, w, b
    from questions q
    left join answers a on a.session_id = p_session and a.question_no = q.no
   where q.package_id = pid;

  insert into results (session_id, score, correct_count, wrong_count, blank_count)
    values (p_session, case when maxp > 0 then round(got / maxp * 100, 2) else 0 end, c, w, b)
    on conflict (session_id) do update
      set score = excluded.score, correct_count = excluded.correct_count,
          wrong_count = excluded.wrong_count, blank_count = excluded.blank_count,
          computed_at = now();

  update exam_sessions set status = p_status, submitted_at = now() where id = p_session;
end $$;

-- ============================================================
-- 5. Fungsi untuk siswa (tanpa login akun; dibatasi kunci sesi)
-- ============================================================
create or replace function _session_check(p_session uuid, p_key uuid)
returns exam_sessions language plpgsql security definer set search_path = public as $$
declare s exam_sessions;
begin
  select * into s from exam_sessions where id = p_session and access_key = p_key;
  if not found then raise exception 'SESI_TIDAK_VALID'; end if;
  return s;
end $$;

create or replace function exam_start(p_code text, p_nisn text, p_birth date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t exam_tokens; st students; s exam_sessions; qn int;
begin
  select * into t from exam_tokens where code = upper(trim(p_code));
  if not found then raise exception 'TOKEN_TIDAK_DITEMUKAN'; end if;

  select * into st from students
   where school_id = t.school_id and nisn = trim(p_nisn)
     and birth_date is not null and birth_date = p_birth;
  if not found then raise exception 'SISWA_TIDAK_COCOK'; end if;

  select * into s from exam_sessions where token_id = t.id and student_id = st.id;
  if found then
    if s.status <> 'active' then raise exception 'SUDAH_SELESAI'; end if;
    if now() > s.deadline_at then
      perform _finalize(s.id, 'expired');
      raise exception 'SUDAH_SELESAI';
    end if;
  else
    if now() < t.starts_at then raise exception 'BELUM_DIMULAI'; end if;
    if now() > t.ends_at then raise exception 'SUDAH_DITUTUP'; end if;
    if t.quota > 0 and (select count(*) from exam_sessions where token_id = t.id) >= t.quota then
      raise exception 'KUOTA_PENUH';
    end if;
    select count(*) into qn from questions where package_id = t.package_id;
    if t.package_id is null or qn = 0 then raise exception 'PAKET_KOSONG'; end if;
    insert into exam_sessions (token_id, student_id, deadline_at)
      values (t.id, st.id, least(now() + make_interval(mins => t.duration_minutes), t.ends_at))
      returning * into s;
  end if;

  return jsonb_build_object(
    'session_id', s.id, 'access_key', s.access_key, 'deadline_at', s.deadline_at,
    'server_now', now(), 'student_name', st.full_name, 'subject', t.subject);
end $$;

create or replace function exam_get(p_session uuid, p_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s exam_sessions; pid uuid; qs jsonb; ans jsonb; nm text; subj text;
begin
  s := _session_check(p_session, p_key);
  if s.status = 'active' and now() > s.deadline_at then
    perform _finalize(s.id, 'expired');
    s.status := 'expired';
  end if;
  select t.package_id, t.subject into pid, subj from exam_tokens t where t.id = s.token_id;
  select full_name into nm from students where id = s.student_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'no', q.no, 'kind', q.kind, 'passage', q.passage, 'body', q.body, 'options', q.options)
           order by q.no), '[]')
    into qs from questions q where q.package_id = pid;
  select coalesce(jsonb_object_agg(a.question_no::text, a.response), '{}')
    into ans from answers a where a.session_id = s.id;

  return jsonb_build_object('status', s.status, 'deadline_at', s.deadline_at,
    'server_now', now(), 'student_name', nm, 'subject', subj,
    'questions', qs, 'answers', ans);
end $$;

create or replace function exam_save(p_session uuid, p_key uuid, p_no int, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s exam_sessions;
begin
  s := _session_check(p_session, p_key);
  if s.status <> 'active' then raise exception 'SUDAH_SELESAI'; end if;
  -- Toleransi 5 detik untuk jawaban yang sedang dalam perjalanan saat waktu habis.
  if now() > s.deadline_at + interval '5 seconds' then
    perform _finalize(s.id, 'expired');
    raise exception 'WAKTU_HABIS';
  end if;
  if not exists (select 1 from exam_tokens t join questions q on q.package_id = t.package_id
                 where t.id = s.token_id and q.no = p_no) then
    raise exception 'SOAL_TIDAK_ADA';
  end if;
  insert into answers (session_id, question_no, response)
    values (s.id, p_no, coalesce(p_response, 'null'::jsonb))
    on conflict (session_id, question_no)
    do update set response = excluded.response, updated_at = now();
  return jsonb_build_object('ok', true, 'server_now', now());
end $$;

create or replace function exam_violation(p_session uuid, p_key uuid, p_kind text, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare s exam_sessions;
begin
  s := _session_check(p_session, p_key);
  if s.status <> 'active' then return; end if;
  if p_kind not in ('tab_switch', 'fullscreen_exit', 'disconnect') then raise exception 'JENIS_TIDAK_VALID'; end if;
  insert into violations (session_id, kind, detail) values (s.id, p_kind, p_detail);
end $$;

create or replace function exam_submit(p_session uuid, p_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s exam_sessions;
begin
  s := _session_check(p_session, p_key);
  if s.status = 'active' then
    perform _finalize(s.id, case when now() > s.deadline_at then 'expired' else 'submitted' end);
  end if;
  return exam_result(p_session, p_key);
end $$;

create or replace function exam_result(p_session uuid, p_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s exam_sessions; t exam_tokens; r results; review jsonb;
begin
  s := _session_check(p_session, p_key);
  if s.status = 'active' then raise exception 'BELUM_SELESAI'; end if;
  select * into t from exam_tokens where id = s.token_id;
  if t.result_mode = 'held' then
    return jsonb_build_object('held', true, 'status', s.status);
  end if;
  select * into r from results where session_id = s.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'no', q.no, 'kind', q.kind, 'passage', q.passage, 'body', q.body, 'options', q.options,
           'answer_key', q.answer_key, 'explanation', q.explanation,
           'response', a.response,
           'earned', _score_question(q.kind, q.answer_key, a.response, q.points),
           'points', q.points) order by q.no), '[]')
    into review
    from questions q left join answers a on a.session_id = s.id and a.question_no = q.no
   where q.package_id = t.package_id;

  return jsonb_build_object('held', false, 'status', s.status, 'score', r.score,
    'correct', r.correct_count, 'wrong', r.wrong_count, 'blank', r.blank_count, 'review', review);
end $$;

-- ============================================================
-- 6. Fungsi untuk operator
-- ============================================================
create or replace function force_end_session(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from exam_sessions s join exam_tokens t on t.id = s.token_id
                 where s.id = p_session and t.school_id = current_school_id()) then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  if (select status from exam_sessions where id = p_session) = 'active' then
    perform _finalize(p_session, 'forced');
  end if;
end $$;

-- Selesaikan sesi yang waktunya sudah lewat (dipanggil saat operator membuka Monitoring/Hasil).
create or replace function expire_overdue_sessions()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select s.id from exam_sessions s join exam_tokens t on t.id = s.token_id
            where s.status = 'active' and s.deadline_at < now() - interval '5 seconds'
              and t.school_id = current_school_id() loop
    perform _finalize(r.id, 'expired'); n := n + 1;
  end loop;
  return n;
end $$;

-- ============================================================
-- 7. Hak eksekusi fungsi
-- ============================================================
revoke execute on function _finalize(uuid, text), _session_check(uuid, uuid),
  _score_question(text, jsonb, jsonb, numeric), _is_blank(jsonb) from public, anon, authenticated;
revoke execute on function exam_start(text, text, date), exam_get(uuid, uuid),
  exam_save(uuid, uuid, int, jsonb), exam_violation(uuid, uuid, text, jsonb),
  exam_submit(uuid, uuid), exam_result(uuid, uuid) from public;
grant execute on function exam_start(text, text, date), exam_get(uuid, uuid),
  exam_save(uuid, uuid, int, jsonb), exam_violation(uuid, uuid, text, jsonb),
  exam_submit(uuid, uuid), exam_result(uuid, uuid) to anon, authenticated;
revoke execute on function register_school(text, text), force_end_session(uuid),
  expire_overdue_sessions(), current_school_id() from public, anon;
grant execute on function register_school(text, text), force_end_session(uuid),
  expire_overdue_sessions(), current_school_id() to authenticated;
