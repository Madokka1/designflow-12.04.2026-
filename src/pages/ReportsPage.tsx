import { useMemo, useState } from 'react'
import { useProjects } from '../hooks/useProjects'

const DAY_MS = 86_400_000

function moneyRub(n: number) {
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return `${Math.round(n)} ₽`
  }
}

function parseInputDateStart(iso: string): number | null {
  if (!iso.trim()) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return null
  dt.setHours(0, 0, 0, 0)
  return dt.getTime()
}

export function ReportsPage() {
  const {
    projects,
    tasks,
    clients,
    templates,
    financeTransactions,
    timerSessionLog,
  } = useProjects()

  const [timerFrom, setTimerFrom] = useState('')
  const [timerTo, setTimerTo] = useState('')

  const filteredTimerLog = useMemo(() => {
    const from = parseInputDateStart(timerFrom)
    const toStart = parseInputDateStart(timerTo)
    const toEnd = toStart != null ? toStart + DAY_MS - 1 : null
    return timerSessionLog.filter((e) => {
      const t = new Date(e.endedAt).getTime()
      if (from != null && t < from) return false
      if (toEnd != null && t > toEnd) return false
      return true
    })
  }, [timerSessionLog, timerFrom, timerTo])

  const stats = useMemo(() => {
    const archived = projects.filter((p) => p.archived).length
    const active = projects.length - archived
    const tasksOpen = tasks.filter((t) => !t.done).length
    const tasksDone = tasks.filter((t) => t.done).length
    let income = 0
    let expense = 0
    for (const t of financeTransactions) {
      if (t.kind === 'income') income += t.amountRub
      else expense += t.amountRub
    }
    const timerSeconds = filteredTimerLog.reduce((acc, e) => acc + e.seconds, 0)
    return {
      archived,
      active,
      tasksOpen,
      tasksDone,
      income,
      expense,
      balance: income - expense,
      timerSeconds,
    }
  }, [projects, tasks, financeTransactions, filteredTimerLog])

  const h = Math.floor(stats.timerSeconds / 3600)
  const m = Math.floor((stats.timerSeconds % 3600) / 60)

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-light leading-[0.9] tracking-[-0.09em]">
        Отчёты
      </h1>
      <p className="mt-2 max-w-xl text-sm font-light text-ink/60">
        Сводка по данным в приложении. Фильтр ниже влияет только на блок «Таймер» (по дате
        окончания сессии). У транзакций в модели нет дат — финансы всегда за всё время.
      </p>

      <div className="mt-6 flex max-w-xl flex-wrap items-end gap-4 border border-card-border p-4">
        <label className="flex flex-col gap-1 text-xs font-light text-ink/60">
          Таймер: с даты
          <input
            type="date"
            className="border border-card-border bg-transparent px-2 py-1 text-sm text-ink"
            value={timerFrom}
            onChange={(e) => setTimerFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-light text-ink/60">
          по дату
          <input
            type="date"
            className="border border-card-border bg-transparent px-2 py-1 text-sm text-ink"
            value={timerTo}
            onChange={(e) => setTimerTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="h-8 rounded-full border border-card-border px-4 text-xs font-light"
          onClick={() => {
            setTimerFrom('')
            setTimerTo('')
          }}
        >
          Сбросить период
        </button>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Проекты" lines={[`Активные: ${stats.active}`, `В архиве: ${stats.archived}`, `Всего: ${projects.length}`]} />
        <StatCard
          title="Задачи"
          lines={[`Открытые: ${stats.tasksOpen}`, `Выполнено: ${stats.tasksDone}`, `Всего: ${tasks.length}`]}
        />
        <StatCard
          title="Справочники"
          lines={[`Клиенты: ${clients.length}`, `Шаблоны: ${templates.length}`]}
        />
        <StatCard
          title="Финансы (все операции)"
          lines={[
            `Доходы: ${moneyRub(stats.income)}`,
            `Расходы: ${moneyRub(stats.expense)}`,
            `Баланс: ${moneyRub(stats.balance)}`,
          ]}
        />
        <StatCard
          title="Таймер (журнал сессий)"
          lines={[
            `Накоплено: ${h} ч ${m} мин`,
            `Записей в периоде: ${filteredTimerLog.length} (всего ${timerSessionLog.length})`,
          ]}
        />
      </div>
    </main>
  )
}

function StatCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="border border-card-border p-5">
      <h2 className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
        {title}
      </h2>
      <ul className="mt-3 flex flex-col gap-1.5">
        {lines.map((l) => (
          <li key={l} className="text-sm font-light text-ink/85">
            {l}
          </li>
        ))}
      </ul>
    </section>
  )
}
