-- Клиенты, задачи, шаблоны проектов, флаг архива у проектов, версии заметок.

-- ---------------------------------------------------------------------------
-- Клиенты (справочник)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  company text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx on public.clients (user_id);

alter table public.clients enable row level security;

drop policy if exists "clients_all_own" on public.clients;
create policy "clients_all_own"
  on public.clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Проекты: архив и связь с клиентом
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists archived boolean not null default false;

alter table public.projects
  add column if not exists client_id uuid references public.clients (id) on delete set null;

comment on column public.projects.archived is 'Скрыт из активного списка; только раздел «Архив»';
comment on column public.projects.client_id is 'Опциональная связь со справочником clients';

-- ---------------------------------------------------------------------------
-- Задачи / inbox
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  done boolean not null default false,
  due_date text not null default '',
  project_slug text,
  labels jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);

alter table public.tasks enable row level security;

drop policy if exists "tasks_all_own" on public.tasks;
create policy "tasks_all_own"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Шаблоны проектов (массив этапов как jsonb)
-- ---------------------------------------------------------------------------
create table if not exists public.project_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  stages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_templates_user_id_idx on public.project_templates (user_id);

alter table public.project_templates enable row level security;

drop policy if exists "project_templates_all_own" on public.project_templates;
create policy "project_templates_all_own"
  on public.project_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Версии заметок (снимок при сохранении)
-- ---------------------------------------------------------------------------
create table if not exists public.note_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_slug text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists note_revisions_user_slug_idx
  on public.note_revisions (user_id, note_slug);

alter table public.note_revisions enable row level security;

drop policy if exists "note_revisions_select_own" on public.note_revisions;
drop policy if exists "note_revisions_insert_own" on public.note_revisions;
drop policy if exists "note_revisions_delete_own" on public.note_revisions;

create policy "note_revisions_select_own"
  on public.note_revisions for select
  using (auth.uid() = user_id);

create policy "note_revisions_insert_own"
  on public.note_revisions for insert
  with check (auth.uid() = user_id);

create policy "note_revisions_delete_own"
  on public.note_revisions for delete
  using (auth.uid() = user_id);
