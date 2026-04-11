-- URL и anon key проекта в профиле: копия клиентских настроек для восстановления на другом устройстве.
-- Anon key по замыслу Supabase публичный; не храните service_role на клиенте.

alter table public.profiles
  add column if not exists supabase_project_url text not null default '';

alter table public.profiles
  add column if not exists supabase_anon_key text not null default '';

comment on column public.profiles.supabase_project_url is 'Supabase project URL; синхронизируется из приложения после входа/регистрации';
comment on column public.profiles.supabase_anon_key is 'Supabase anon (public) key; синхронизируется из приложения';
