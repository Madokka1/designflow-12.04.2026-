-- Стоимость часа сотрудника (руб/ч) для расчёта профита проекта
alter table public.projects
  add column if not exists employee_hourly_rate_rub integer;

comment on column public.projects.employee_hourly_rate_rub is 'Почасовая ставка сотрудника, руб/ч; для профита: сумма проекта − ставка × фактические часы.';

-- Обновить кэш схемы PostgREST (иначе API может отвечать «column not in schema cache»)
notify pgrst, 'reload schema';
