-- Доп. поля профиля (тема, флаг «запоминать пароль», email входа Supabase — без пароля).
-- Журнал сессий таймера на пользователя.

alter table public.profiles
  add column if not exists theme text not null default 'system';

alter table public.profiles
  add column if not exists remember_auth_password boolean not null default false;

alter table public.profiles
  add column if not exists supabase_auth_email text not null default '';

comment on column public.profiles.theme is 'light | dark | system';
comment on column public.profiles.remember_auth_password is 'Только флаг; пароль Supabase в БД не хранится';
comment on column public.profiles.supabase_auth_email is 'Email для входа в Supabase Auth (копия из настроек)';

-- ---------------------------------------------------------------------------
-- Журнал завершённых сессий таймера (id задаёт клиент — uuid)
-- ---------------------------------------------------------------------------
create table if not exists public.timer_session_log (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ended_at timestamptz not null,
  seconds int not null check (seconds > 0),
  project_slug text not null default '',
  stage_id text not null default '',
  project_title text not null default '',
  stage_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists timer_session_log_user_id_idx
  on public.timer_session_log (user_id);

create index if not exists timer_session_log_user_ended_idx
  on public.timer_session_log (user_id, ended_at desc);

alter table public.timer_session_log enable row level security;

create policy "timer_session_log_select_own"
  on public.timer_session_log for select
  using (auth.uid() = user_id);

create policy "timer_session_log_insert_own"
  on public.timer_session_log for insert
  with check (auth.uid() = user_id);

create policy "timer_session_log_delete_own"
  on public.timer_session_log for delete
  using (auth.uid() = user_id);
