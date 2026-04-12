-- Уведомления в Telegram при создании сущностей (фронт вызывает Edge Function portfolio-notify).

alter table public.profiles
  add column if not exists telegram_notify_creates_enabled boolean not null default true;

comment on column public.profiles.telegram_notify_creates_enabled is
  'Слать в Telegram короткие сообщения о новых проектах, этапах, клиентах, задачах';
