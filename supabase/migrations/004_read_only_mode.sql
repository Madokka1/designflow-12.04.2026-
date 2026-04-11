-- Режим «только чтение» в профиле: клиент не шлёт изменения в Supabase (кроме явно разрешённых).

alter table public.profiles
  add column if not exists read_only_mode boolean not null default false;

comment on column public.profiles.read_only_mode is 'Если true — приложение не выполняет записи в БД (портфель, заметки, профиль и т.д.)';
