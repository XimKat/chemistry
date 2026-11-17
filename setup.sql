-- =====================================================================
--  Химия ҰБТ — тапсырмалар сайты: Supabase дерекқорын баптау
--  Бұл файлды Supabase → SQL Editor ішіне толық көшіріп, "Run" басыңыз.
--  Қайта іске қосуға болады (деректер өшпейді).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) МҰҒАЛІМ ПОШТАСЫ ----------------------------------------------------
--    Төмендегі поштаны өз поштаңызға ауыстырыңыз (Supabase-те мұғалім
--    ретінде тіркелетін пошта). Бірнеше мұғалім болса, жолды көбейтіңіз.
create table if not exists public.teachers (email text primary key);
insert into public.teachers (email) values ('kerimbekakhmediyar@gmail.com')
  on conflict do nothing;

-- 2) КЕСТЕЛЕР ------------------------------------------------------------
create table if not exists public.students (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  class_name     text not null default '',
  username       text,
  password_hash  text,
  failed_logins  int not null default 0,
  locked_until   timestamptz,
  created_at     timestamptz not null default now()
);
-- (алдыңғы нұсқадан жаңартқандар үшін)
alter table public.students add column if not exists username      text;
alter table public.students add column if not exists password_hash text;
alter table public.students add column if not exists failed_logins int not null default 0;
alter table public.students add column if not exists locked_until  timestamptz;
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'students' and column_name = 'code') then
    alter table public.students alter column code drop not null;
    update public.students set username = lower(code) where username is null and code is not null;
  end if;
end $$;
create unique index if not exists students_username_key on public.students (lower(username));

create table if not exists public.student_sessions (
  token       text primary key,
  student_id  uuid not null references public.students(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '90 days'
);

create table if not exists public.tests (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null default '',
  content      jsonb not null default '{"questions":[],"contexts":{}}'::jsonb,
  published    boolean not null default false,
  show_answers boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Әрбір тапсыру — жеке жазба. archived = мұғалім қайта тапсыруға рұқсат
-- берген бұрынғы әрекет (өшпейді, тарихта сақталады).
create table if not exists public.attempts (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  test_id      uuid not null references public.tests(id) on delete cascade,
  answers      jsonb not null default '{}'::jsonb,
  details      jsonb not null default '[]'::jsonb,
  score        numeric not null default 0,
  max_score    numeric not null default 0,
  archived     boolean not null default false,
  submitted_at timestamptz not null default now()
);
alter table public.attempts add column if not exists archived boolean not null default false;
alter table public.attempts drop constraint if exists attempts_student_id_test_id_key;
create unique index if not exists attempts_one_active on public.attempts (student_id, test_id) where not archived;
create index if not exists attempts_test_idx on public.attempts (test_id);
create index if not exists attempts_student_idx on public.attempts (student_id);

-- 3) МҰҒАЛІМДІ ТАНУ ------------------------------------------------------
create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.teachers
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 4) ҚАУІПСІЗДІК (RLS): кестелерге тек мұғалім тікелей қол жеткізеді ------
alter table public.teachers         enable row level security;
alter table public.students         enable row level security;
alter table public.student_sessions enable row level security;
alter table public.tests            enable row level security;
alter table public.attempts         enable row level security;

drop policy if exists teacher_all on public.students;
create policy teacher_all on public.students for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists teacher_all on public.tests;
create policy teacher_all on public.tests for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists teacher_all on public.attempts;
create policy teacher_all on public.attempts for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- teachers және student_sessions кестелеріне ешкімге тікелей рұқсат жоқ.

-- 5) БАҒАЛАУ (сервер жағында, оқушы дұрыс жауаптарды алдын ала көрмейді) --
--  single   : дұрыс болса — толық ұпай
--  multiple : әр қате (артық белгі немесе белгіленбей қалған дұрыс жауап)
--             ұпайдан 1-ді алады: 2 ұпайлық сұрақта 0 қате=2, 1 қате=1, 2+=0
--  matching : әр қате сәйкестік ұпайдан 1-ді алады
create or replace function public.grade_answers(p_content jsonb, p_answers jsonb)
returns jsonb language plpgsql immutable as $$
declare
  q      jsonb;
  qid    text;
  typ    text;
  pts    numeric;
  given  jsonb;
  earned numeric;
  errs   int;
  total  numeric := 0;
  maxs   numeric := 0;
  det    jsonb := '[]'::jsonb;
begin
  for q in select value from jsonb_array_elements(coalesce(p_content -> 'questions', '[]'::jsonb)) loop
    qid    := q ->> 'id';
    typ    := coalesce(q ->> 'type', 'single');
    pts    := coalesce(nullif(q ->> 'points', '')::numeric, 1);
    given  := coalesce(p_answers, '{}'::jsonb) -> qid;
    earned := 0;

    if typ = 'single' then
      if given is not null and jsonb_typeof(given) = 'string'
         and (given #>> '{}') = (q ->> 'answer') then
        earned := pts;
      end if;

    elsif typ = 'multiple' then
      if given is not null and jsonb_typeof(given) = 'array' and jsonb_array_length(given) > 0 then
        select count(*) into errs from (
          (select jsonb_array_elements_text(q -> 'answer')
           except select jsonb_array_elements_text(given))
          union all
          (select jsonb_array_elements_text(given)
           except select jsonb_array_elements_text(q -> 'answer'))
        ) s;
        earned := greatest(pts - errs, 0);
      end if;

    elsif typ = 'matching' then
      if given is not null and jsonb_typeof(given) = 'object'
         and exists (select 1 from jsonb_each_text(given) g where coalesce(g.value, '') <> '') then
        select count(*) into errs
          from jsonb_each_text(q -> 'answer') a
         where coalesce(given ->> a.key, '') <> a.value;
        earned := greatest(pts - errs, 0);
      end if;
    end if;

    total := total + earned;
    maxs  := maxs + pts;
    det   := det || jsonb_build_array(jsonb_build_object('id', qid, 'earned', earned, 'points', pts));
  end loop;

  return jsonb_build_object('score', total, 'max', maxs, 'details', det);
end $$;

-- 6) ЕСКІ НҰСҚАНЫҢ ФУНКЦИЯЛАРЫН ӨШІРУ (кодпен кіру) ------------------------
drop function if exists public.student_login(text);
drop function if exists public.student_tests(text);
drop function if exists public.student_get_test(text, uuid);
drop function if exists public.student_review(text, uuid);
drop function if exists public.student_submit(text, uuid, jsonb);
drop function if exists public._student_by_code(text);

-- 7) ОҚУШЫ АККАУНТЫ: кіру, шығу ------------------------------------------
create or replace function public._student_by_token(p_token text)
returns public.students language sql stable security definer set search_path = public as $$
  select s.* from public.student_sessions ss
    join public.students s on s.id = ss.student_id
   where ss.token = coalesce(p_token, '') and ss.expires_at > now()
   limit 1;
$$;
revoke all on function public._student_by_token(text) from public, anon, authenticated;

-- Кіру: логин + құпиясөз → сессия токені.
-- 8 рет қате енгізілсе, аккаунт 5 минутқа құлыпталады.
create or replace function public.student_login(p_username text, p_password text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.students; tok text;
begin
  select * into s from public.students where lower(username) = lower(trim(coalesce(p_username, ''))) limit 1;
  if s.id is null or s.password_hash is null then
    return jsonb_build_object('error', 'BAD_LOGIN');
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('error', 'LOCKED');
  end if;
  if s.password_hash <> extensions.crypt(coalesce(p_password, ''), s.password_hash) then
    update public.students
       set failed_logins = case when failed_logins + 1 >= 8 then 0 else failed_logins + 1 end,
           locked_until  = case when failed_logins + 1 >= 8 then now() + interval '5 minutes' else locked_until end
     where id = s.id;
    return jsonb_build_object('error', 'BAD_LOGIN');
  end if;
  update public.students set failed_logins = 0, locked_until = null where id = s.id;
  delete from public.student_sessions where expires_at < now();
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.student_sessions (token, student_id) values (tok, s.id);
  return jsonb_build_object('token', tok, 'full_name', s.full_name, 'class_name', s.class_name, 'username', s.username);
end $$;

create or replace function public.student_me(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.students;
begin
  s := public._student_by_token(p_token);
  if s.id is null then raise exception 'NO_SESSION'; end if;
  return jsonb_build_object('full_name', s.full_name, 'class_name', s.class_name, 'username', s.username);
end $$;

create or replace function public.student_logout(p_token text)
returns void language sql volatile security definer set search_path = public as $$
  delete from public.student_sessions where token = coalesce(p_token, '');
$$;

-- 8) ОҚУШЫ: тесттер, тапсыру, нәтижелер ----------------------------------
-- Жарияланған тесттер + осы оқушының белсенді нәтижесі
create or replace function public.student_tests(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.students;
begin
  s := public._student_by_token(p_token);
  if s.id is null then raise exception 'NO_SESSION'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', t.id,
             'title', t.title,
             'description', t.description,
             'question_count', jsonb_array_length(coalesce(t.content -> 'questions', '[]'::jsonb)),
             'show_answers', t.show_answers,
             'attempt', case when a.id is null then null else jsonb_build_object(
                          'id', a.id, 'score', a.score, 'max_score', a.max_score, 'submitted_at', a.submitted_at) end
           ) order by t.created_at desc)
      from public.tests t
      left join public.attempts a on a.test_id = t.id and a.student_id = s.id and not a.archived
     where t.published
  ), '[]'::jsonb);
end $$;

-- Оқушының барлық тапсырған тесттерінің тарихы
create or replace function public.student_history(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.students;
begin
  s := public._student_by_token(p_token);
  if s.id is null then raise exception 'NO_SESSION'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id, 'test_id', a.test_id, 'title', t.title,
             'score', a.score, 'max_score', a.max_score,
             'submitted_at', a.submitted_at, 'archived', a.archived
           ) order by a.submitted_at desc)
      from public.attempts a
      join public.tests t on t.id = a.test_id
     where a.student_id = s.id
  ), '[]'::jsonb);
end $$;

-- Тестті алу (дұрыс жауаптарсыз)
create or replace function public.student_get_test(p_token text, p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.students; t public.tests;
begin
  s := public._student_by_token(p_token);
  if s.id is null then raise exception 'NO_SESSION'; end if;
  select * into t from public.tests where id = p_test_id and published;
  if t.id is null then raise exception 'NO_TEST'; end if;
  if exists (select 1 from public.attempts where test_id = t.id and student_id = s.id and not archived) then
    raise exception 'ALREADY_SUBMITTED';
  end if;
  return jsonb_build_object(
    'id', t.id, 'title', t.title, 'description', t.description,
    'contexts', coalesce(t.content -> 'contexts', '{}'::jsonb),
    'questions', coalesce((
       select jsonb_agg(e.value - 'answer' order by e.ord)
         from jsonb_array_elements(coalesce(t.content -> 'questions', '[]'::jsonb)) with ordinality e(value, ord)
    ), '[]'::jsonb)
  );
end $$;

-- Бір әрекеттің толық талдауы (дұрыс/қате сұрақтар)
create or replace function public.student_review(p_token text, p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.students; t public.tests; a public.attempts;
begin
  s := public._student_by_token(p_token);
  if s.id is null then raise exception 'NO_SESSION'; end if;
  select * into a from public.attempts where id = p_attempt_id and student_id = s.id;
  if a.id is null then raise exception 'NO_ATTEMPT'; end if;
  select * into t from public.tests where id = a.test_id;
  return jsonb_build_object(
    'attempt_id', a.id, 'title', t.title,
    'score', a.score, 'max_score', a.max_score, 'submitted_at', a.submitted_at, 'archived', a.archived,
    'show_answers', t.show_answers,
    'details', a.details,
    'answers', case when t.show_answers then a.answers else null end,
    'contexts', case when t.show_answers then coalesce(t.content -> 'contexts', '{}'::jsonb) else null end,
    'questions', case when t.show_answers then coalesce(t.content -> 'questions', '[]'::jsonb) else null end
  );
end $$;

-- Тапсыру: сервер бағалайды, бір тестке бір белсенді әрекет
create or replace function public.student_submit(p_token text, p_test_id uuid, p_answers jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.students; t public.tests; g jsonb; new_id uuid;
begin
  s := public._student_by_token(p_token);
  if s.id is null then raise exception 'NO_SESSION'; end if;
  select * into t from public.tests where id = p_test_id and published;
  if t.id is null then raise exception 'NO_TEST'; end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then raise exception 'BAD_ANSWERS'; end if;

  g := public.grade_answers(t.content, coalesce(p_answers, '{}'::jsonb));
  begin
    insert into public.attempts (student_id, test_id, answers, details, score, max_score)
    values (s.id, t.id, coalesce(p_answers, '{}'::jsonb), g -> 'details',
            (g ->> 'score')::numeric, (g ->> 'max')::numeric)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'ALREADY_SUBMITTED';
  end;
  return public.student_review(p_token, new_id);
end $$;

-- 9) МҰҒАЛІМ: аккаунт ашу және құпиясөз беру ------------------------------
-- p_list: [{"full_name":"...","class_name":"...","username":"...","password":"..."}]
create or replace function public.teacher_create_students(p_list jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare r jsonb; u text; pw text; taken text; res jsonb := '[]'::jsonb; new_id uuid;
begin
  if not public.is_teacher() then raise exception 'NOT_TEACHER'; end if;
  -- тізім ішінде қайталанатын логиндер
  select string_agg(x, ', ') into taken from (
    select lower(trim(e ->> 'username')) x from jsonb_array_elements(p_list) e
    group by 1 having count(*) > 1) d;
  if taken is not null then raise exception 'USERNAME_TAKEN:%', taken; end if;
  -- бұрыннан бар логиндер
  select string_agg(e ->> 'username', ', ') into taken
    from jsonb_array_elements(p_list) e
   where exists (select 1 from public.students s where lower(s.username) = lower(trim(e ->> 'username')));
  if taken is not null then raise exception 'USERNAME_TAKEN:%', taken; end if;

  for r in select value from jsonb_array_elements(p_list) loop
    u  := lower(trim(coalesce(r ->> 'username', '')));
    pw := coalesce(r ->> 'password', '');
    if trim(coalesce(r ->> 'full_name', '')) = '' then raise exception 'NO_NAME'; end if;
    if u !~ '^[^\s]{3,40}$' then raise exception 'BAD_USERNAME:%', u; end if;
    if length(pw) < 4 then raise exception 'SHORT_PASSWORD'; end if;
    insert into public.students (full_name, class_name, username, password_hash)
    values (trim(r ->> 'full_name'), trim(coalesce(r ->> 'class_name', '')), u, extensions.crypt(pw, extensions.gen_salt('bf', 8)))
    returning id into new_id;
    res := res || jsonb_build_array(jsonb_build_object('id', new_id, 'username', u));
  end loop;
  return res;
end $$;

create or replace function public.teacher_set_password(p_student_id uuid, p_password text)
returns void language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if not public.is_teacher() then raise exception 'NOT_TEACHER'; end if;
  if length(coalesce(p_password, '')) < 4 then raise exception 'SHORT_PASSWORD'; end if;
  update public.students
     set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 8)),
         failed_logins = 0, locked_until = null
   where id = p_student_id;
  delete from public.student_sessions where student_id = p_student_id;  -- ескі кірулерден шығару
end $$;

-- Жоба «ұйықтап» қалмауы үшін (GitHub Actions 3 күнде бір рет шақырады)
create or replace function public.ping()
returns text language sql stable as $$ select 'ok'::text $$;

-- 10) ҚҰҚЫҚТАР ------------------------------------------------------------
revoke execute on function public.grade_answers(jsonb, jsonb) from public, anon;
grant  execute on function public.grade_answers(jsonb, jsonb) to authenticated;
revoke execute on function public.teacher_create_students(jsonb)    from public, anon;
revoke execute on function public.teacher_set_password(uuid, text)  from public, anon;
grant  execute on function public.teacher_create_students(jsonb)    to authenticated;
grant  execute on function public.teacher_set_password(uuid, text)  to authenticated;
grant execute on function public.is_teacher()                            to anon, authenticated;
grant execute on function public.student_login(text, text)               to anon, authenticated;
grant execute on function public.student_me(text)                        to anon, authenticated;
grant execute on function public.student_logout(text)                    to anon, authenticated;
grant execute on function public.student_tests(text)                     to anon, authenticated;
grant execute on function public.student_history(text)                   to anon, authenticated;
grant execute on function public.student_get_test(text, uuid)            to anon, authenticated;
grant execute on function public.student_review(text, uuid)              to anon, authenticated;
grant execute on function public.student_submit(text, uuid, jsonb)       to anon, authenticated;
grant execute on function public.ping()                                  to anon, authenticated;

-- 11) СУРЕТТЕР ҚОЙМАСЫ (Storage) ------------------------------------------
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

drop policy if exists "teacher insert images" on storage.objects;
create policy "teacher insert images" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and public.is_teacher());

drop policy if exists "teacher update images" on storage.objects;
create policy "teacher update images" on storage.objects for update to authenticated
  using (bucket_id = 'images' and public.is_teacher());

drop policy if exists "teacher delete images" on storage.objects;
create policy "teacher delete images" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and public.is_teacher());

-- Дайын! Енді Authentication → Users → "Add user" арқылы мұғалім
-- аккаунтын (жоғарыдағы поштамен) жасаңыз.
