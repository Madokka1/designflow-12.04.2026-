-- Связь события календаря с задачей (события из модалки дублируются в tasks)
alter table public.calendar_custom_events
  add column if not exists task_id uuid;

comment on column public.calendar_custom_events.task_id is
  'Если задано, дата/текст показываются из связанной задачи; дубликат в списке календаря не рисуется из calendar_custom_events.';
