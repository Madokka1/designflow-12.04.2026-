-- Telegram: дедупликация напоминаний по задачам (reminder_preset/custom)
-- Воркер telegram-notify-bot пишет сюда через service_role.

create table if not exists public.telegram_task_reminder_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  reminder_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, task_id, reminder_at)
);

create index if not exists telegram_task_reminder_sent_user_idx
  on public.telegram_task_reminder_sent (user_id);

alter table public.telegram_task_reminder_sent enable row level security;
-- Политики не задаём: читает/пишет только service_role (воркер).

-- Обновить кэш схемы PostgREST
notify pgrst, 'reload schema';

