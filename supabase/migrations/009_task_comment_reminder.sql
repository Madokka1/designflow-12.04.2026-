-- Комментарий и напоминание у задач
alter table public.tasks
  add column if not exists comment text not null default '';

alter table public.tasks
  add column if not exists reminder_preset text not null default 'none';

alter table public.tasks
  add column if not exists reminder_at_custom text not null default '';

comment on column public.tasks.comment is 'Текст комментария к задаче';
comment on column public.tasks.reminder_preset is 'none | 1h | 1d | 1w | custom';
comment on column public.tasks.reminder_at_custom is 'ISO 8601 для preset=custom';

-- Обновить кэш схемы PostgREST (иначе API может отвечать «column not in schema cache»)
notify pgrst, 'reload schema';
