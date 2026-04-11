-- Telegram-бот: привязка чата, напоминания о дедлайнах (серверный воркер с service_role).

alter table public.profiles
  add column if not exists telegram_chat_id bigint;

alter table public.profiles
  add column if not exists telegram_deadline_notify_enabled boolean not null default false;

alter table public.profiles
  add column if not exists telegram_deadline_notify_days_before int not null default 3;

comment on column public.profiles.telegram_chat_id is 'Chat id из Telegram после /start TOKEN; пишет бот (service_role), клиент может обнулить при отвязке';
comment on column public.profiles.telegram_deadline_notify_enabled is 'Включить напоминания о сроках в Telegram';
comment on column public.profiles.telegram_deadline_notify_days_before is 'За сколько календарных дней (0–14), в т.ч. день срока';

-- Одноразовые токены для deep link t.me/bot?start=TOKEN
create table if not exists public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists telegram_link_tokens_user_idx
  on public.telegram_link_tokens (user_id);

create index if not exists telegram_link_tokens_expires_idx
  on public.telegram_link_tokens (expires_at);

alter table public.telegram_link_tokens enable row level security;

drop policy if exists "telegram_link_tokens_insert_own" on public.telegram_link_tokens;
drop policy if exists "telegram_link_tokens_select_own" on public.telegram_link_tokens;
drop policy if exists "telegram_link_tokens_delete_own" on public.telegram_link_tokens;

create policy "telegram_link_tokens_insert_own"
  on public.telegram_link_tokens for insert
  with check (auth.uid() = user_id);

create policy "telegram_link_tokens_select_own"
  on public.telegram_link_tokens for select
  using (auth.uid() = user_id);

create policy "telegram_link_tokens_delete_own"
  on public.telegram_link_tokens for delete
  using (auth.uid() = user_id);

-- Дедупликация: одно уведомление на (пользователь, элемент, календарный день в TZ воркера)
create table if not exists public.telegram_deadline_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  dedupe_key text not null,
  day_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, dedupe_key, day_key)
);

create index if not exists telegram_deadline_sent_user_day_idx
  on public.telegram_deadline_sent (user_id, day_key);

alter table public.telegram_deadline_sent enable row level security;
-- Политики не задаём: читает/пишет только service_role (воркер).
