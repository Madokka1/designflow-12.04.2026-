-- Portfolio / проекты — схема для Supabase (PostgreSQL)
-- Выполнить в SQL Editor: весь файл целиком.
-- Требуется включённый Auth; строки привязываются к auth.users (id).

-- ---------------------------------------------------------------------------
-- Профиль пользователя (1:1 с auth.users). Ключи Supabase не храним в БД.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  telegram text not null default '',
  website text not null default '',
  job_title text not null default '',
  about text not null default '',
  font_family text not null default 'inter',
  accent_color text not null default '#0a0a0a',
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Настройки профиля и UI; anon key хранить только на клиенте / в секретах, не в таблице.';

-- ---------------------------------------------------------------------------
-- Проекты и этапы (соответствуют типам Project / ProjectStage во фронте)
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  title text not null default '',
  client text not null default '',
  amount text not null default '',
  deadline text not null default '',
  progress int not null default 0,
  tags jsonb not null default '[]'::jsonb,
  comment text,
  created_at timestamptz not null default now(),
  constraint projects_progress_range check (progress >= 0 and progress <= 100),
  constraint projects_user_slug_unique unique (user_id, slug)
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_slug_idx on public.projects (slug);

create table if not exists public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default '',
  status text not null default '',
  deadline text not null default '',
  planned text not null default '',
  actual text not null default '',
  time_spent_seconds int,
  actual_in_pill boolean not null default false,
  description text,
  checklist jsonb not null default '[]'::jsonb,
  modal_tags jsonb not null default '[]'::jsonb,
  added_at timestamptz,
  sort_order int not null default 0
);

create index if not exists project_stages_project_id_idx on public.project_stages (project_id);

-- ---------------------------------------------------------------------------
-- Финансы
-- ---------------------------------------------------------------------------
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  amount_rub numeric(14, 2) not null,
  kind text not null,
  created_at timestamptz not null default now(),
  constraint finance_kind_check check (kind in ('income', 'expense')),
  constraint finance_amount_non_negative check (amount_rub >= 0)
);

create index if not exists finance_transactions_user_id_idx on public.finance_transactions (user_id);

-- ---------------------------------------------------------------------------
-- Пользовательские события календаря (date_raw как в UI: ДД.ММ.ГГГГ)
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_custom_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  date_raw text not null default '',
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_user_id_idx on public.calendar_custom_events (user_id);

-- ---------------------------------------------------------------------------
-- Заметки (блоки — jsonb, как NoteBlock[] во фронте)
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  title text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  blocks jsonb not null default '[]'::jsonb,
  attached_project_slugs jsonb not null default '[]'::jsonb,
  constraint notes_user_slug_unique unique (user_id, slug)
);

create index if not exists notes_user_slug_idx on public.notes (user_id, slug);

-- ---------------------------------------------------------------------------
-- Триггер: профиль при регистрации
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at для profiles
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_stages enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.calendar_custom_events enable row level security;
alter table public.notes enable row level security;

-- profiles: только своя строка
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- projects
create policy "projects_all_own"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- project_stages: доступ через проект
create policy "project_stages_all_via_project"
  on public.project_stages for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_stages.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_stages.project_id
        and p.user_id = auth.uid()
    )
  );

-- finance_transactions
create policy "finance_all_own"
  on public.finance_transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- calendar_custom_events
create policy "calendar_events_all_own"
  on public.calendar_custom_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- notes
create policy "notes_all_own"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
