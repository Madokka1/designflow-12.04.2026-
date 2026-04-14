-- Notes: единый rich-text холст (Google-docs style)
alter table public.notes
  add column if not exists body_html text not null default '';

comment on column public.notes.body_html is 'Основное тело заметки (sanitized HTML), для WYSIWYG-редактора';

-- Обновить кэш схемы PostgREST
notify pgrst, 'reload schema';

