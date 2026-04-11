import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddTransactionModal } from '../components/AddTransactionModal'
import { formatRubDots, parseAmountRub } from '../lib/parseAmountRub'
import { getProjectSection } from '../lib/projectSection'
import { PROJECT_PAYMENT_STATUSES } from '../types/projectForm'
import { useProjects } from '../hooks/useProjects'
import type { Project } from '../types/project'

const COL_PAID = '#39C35E'
const COL_AWAIT = '#E2D75E'
const COL_STAGED = '#004DFF'
const COL_PERSONAL = '#0A0A0A'
const BORDER_MAIN = 'border-[rgba(10,10,10,0.32)]'
const BORDER_ROW = 'border-[rgba(10,10,10,0.4)]'

function paymentTag(p: Project): string | null {
  for (const t of p.tags ?? []) {
    if ((PROJECT_PAYMENT_STATUSES as readonly string[]).includes(t)) {
      return t
    }
  }
  return null
}

type FinanceBucket = 'personal' | 'paid' | 'staged' | 'awaiting'

function financeBucket(p: Project): FinanceBucket {
  if (getProjectSection(p) === 'Личные') return 'personal'
  const pay = paymentTag(p)
  if (pay === 'оплачено') return 'paid'
  if (pay === 'поэтапная оплата') return 'staged'
  return 'awaiting'
}

function projectsWord(n: number): string {
  const m = n % 100
  if (m >= 11 && m <= 14) return `${n} проектов`
  const r = n % 10
  if (r === 1) return `${n} проект`
  if (r >= 2 && r <= 4) return `${n} проекта`
  return `${n} проектов`
}

function stagesWord(n: number): string {
  const m = n % 100
  if (m >= 11 && m <= 14) return `${n} этапов`
  const r = n % 10
  if (r === 1) return `${n} этап`
  if (r >= 2 && r <= 4) return `${n} этапа`
  return `${n} этапов`
}

type LogTab = 'all' | 'Разработка' | 'Поддержка' | 'Личные'

const LOG_TABS: { id: LogTab; label: string }[] = [
  { id: 'all', label: 'Все проекты' },
  { id: 'Разработка', label: 'Разработка' },
  { id: 'Поддержка', label: 'Поддержка' },
  { id: 'Личные', label: 'Личные' },
]

export function FinancePage() {
  const { projects, financeTransactions, addFinanceTransaction } = useProjects()
  const [logTab, setLogTab] = useState<LogTab>('all')
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)

  const stats = useMemo(() => {
    let projectsTotal = 0
    const amt: Record<FinanceBucket, number> = {
      personal: 0,
      paid: 0,
      staged: 0,
      awaiting: 0,
    }
    const cnt: Record<FinanceBucket, number> = {
      personal: 0,
      paid: 0,
      staged: 0,
      awaiting: 0,
    }
    let stagedStages = 0

    for (const p of projects) {
      const a = parseAmountRub(p.amount)
      projectsTotal += a
      const b = financeBucket(p)
      amt[b] += a
      cnt[b] += 1
      if (b === 'staged') {
        stagedStages += p.stages?.length ?? 0
      }
    }

    let transactionNet = 0
    for (const tx of financeTransactions) {
      if (tx.kind === 'income') transactionNet += tx.amountRub
      else transactionNet -= tx.amountRub
    }

    /** Итог «Оборот» / «Анализ»: суммы по проектам ± транзакции */
    const total = projectsTotal + transactionNet

    const pct = (part: number) =>
      projectsTotal > 0 ? Math.round((part / projectsTotal) * 100) : 0

    const analysisAwaiting = amt.awaiting + amt.staged

    return {
      projectsTotal,
      transactionNet,
      total,
      amt,
      cnt,
      stagedStages,
      pctPaid: pct(amt.paid),
      pctAwait: pct(amt.awaiting),
      pctStaged: pct(amt.staged),
      pctPersonal: pct(amt.personal),
      analysisPaidPct: pct(amt.paid),
      analysisAwaitPct: pct(analysisAwaiting),
      analysisPersonalPct: pct(amt.personal),
    }
  }, [projects, financeTransactions])

  const logProjects = useMemo(() => {
    if (logTab === 'all') return projects
    return projects.filter((p) => getProjectSection(p) === logTab)
  }, [projects, logTab])

  const logRows = useMemo(() => {
    if (logTab !== 'all') {
      return logProjects.map((p) => ({ kind: 'project' as const, project: p }))
    }
    const txs = financeTransactions.map((tx) => ({
      kind: 'transaction' as const,
      tx,
    }))
    return [
      ...txs,
      ...logProjects.map((p) => ({ kind: 'project' as const, project: p })),
    ]
  }, [logTab, logProjects, financeTransactions])

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]">
        Финансы
      </h1>

      <div className="mt-10 flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-10">
        {/* Левая колонка: оборот + логи */}
        <div className="min-w-0 flex-1 space-y-6">
          <section
            className={`flex flex-col gap-10 border ${BORDER_MAIN} p-5 sm:p-5`}
          >
            <div className="flex flex-col gap-3">
              <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
                Оборот
              </p>
              <p className="text-[clamp(1.75rem,4vw,2rem)] font-light leading-[0.9] tracking-[-0.09em]">
                {formatRubDots(stats.total)}
              </p>
              {stats.transactionNet !== 0 ? (
                <p className="text-sm font-light leading-snug tracking-[-0.02em] text-ink/55">
                  Проекты {formatRubDots(stats.projectsTotal)}
                  {stats.transactionNet > 0 ? ' · +' : ' · '}
                  {formatRubDots(stats.transactionNet)} по транзакциям
                </p>
              ) : null}
              <p className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/80">
                Месяц: —
              </p>
            </div>

            <div className="flex flex-col gap-10 divide-y divide-black lg:flex-row lg:gap-0 lg:divide-x lg:divide-y-0">
              <BreakdownCol
                amount={stats.amt.paid}
                subline={projectsWord(stats.cnt.paid)}
                label="Оплачено"
                pct={stats.pctPaid}
                barColor={COL_PAID}
              />
              <BreakdownCol
                amount={stats.amt.awaiting}
                subline={projectsWord(stats.cnt.awaiting)}
                label="Ожидает оплаты"
                pct={stats.pctAwait}
                barColor={COL_AWAIT}
              />
              <BreakdownCol
                amount={stats.amt.staged}
                subline={stagesWord(stats.stagedStages)}
                label="Оплата за этапы"
                pct={stats.pctStaged}
                barColor={COL_STAGED}
              />
              <BreakdownCol
                amount={stats.amt.personal}
                subline={projectsWord(stats.cnt.personal)}
                label="Личные финансы"
                pct={stats.pctPersonal}
                barColor={COL_PERSONAL}
              />
            </div>
          </section>

          <section
            className={`flex flex-col gap-10 border ${BORDER_MAIN} p-5 sm:p-5`}
          >
            <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
              Логи
            </p>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-end gap-5">
                {LOG_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setLogTab(t.id)}
                    className="flex flex-col items-center gap-px"
                  >
                    <span
                      className={`text-base leading-[1.2] ${logTab === t.id ? 'font-normal' : 'font-light'} tracking-normal`}
                    >
                      {t.label}
                    </span>
                    <span
                      className={`h-px w-full ${logTab === t.id ? 'bg-ink' : 'bg-transparent'}`}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTransactionModalOpen(true)}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg"
              >
                Добавить транзакцию
              </button>
            </div>

            <div className="flex flex-col">
              {logRows.map((row) =>
                row.kind === 'project' ? (
                  <div
                    key={`p-${row.project.id}`}
                    className={`flex flex-row items-center justify-between gap-4 border-t ${BORDER_ROW} px-5 py-5 first:border-t-0 first:pt-0 sm:px-5`}
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/projects/${row.project.slug}`}
                        className="text-[clamp(1.25rem,3vw,2rem)] font-light leading-[0.9] tracking-[-0.09em] underline-offset-4 hover:underline"
                      >
                        {row.project.title}
                      </Link>
                    </div>
                    <p className="shrink-0 text-base font-light leading-[0.9] tracking-[-0.09em]">
                      +{formatRubDots(parseAmountRub(row.project.amount))}
                    </p>
                  </div>
                ) : (
                  <div
                    key={`tx-${row.tx.id}`}
                    className={`flex flex-row items-center justify-between gap-4 border-t ${BORDER_ROW} px-5 py-5 first:border-t-0 first:pt-0 sm:px-5`}
                  >
                    <p className="min-w-0 flex-1 text-[clamp(1.25rem,3vw,2rem)] font-light leading-[0.9] tracking-[-0.09em]">
                      {row.tx.title}
                    </p>
                    <p className="shrink-0 text-base font-light leading-[0.9] tracking-[-0.09em]">
                      {row.tx.kind === 'income' ? '+' : '−'}
                      {formatRubDots(row.tx.amountRub)}
                    </p>
                  </div>
                ),
              )}
              {logRows.length === 0 && (
                <p className="text-base font-light tracking-[-0.09em] text-ink/50">
                  Нет проектов в этом разделе.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Правая колонка: анализ */}
        <aside
          className={`w-full shrink-0 border ${BORDER_MAIN} p-5 sm:p-5 xl:max-w-[445px]`}
        >
          <div className="flex flex-col gap-3">
            <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
              Анализ
            </p>
            <p className="text-[clamp(1.75rem,4vw,2rem)] font-light leading-[0.9] tracking-[-0.09em]">
              {formatRubDots(stats.total)}
            </p>
          </div>

          <div className="mt-6 flex max-w-[405px] flex-col gap-2.5">
            <div className="flex w-full max-w-[405px] flex-row">
              <AnalysisPctLabel
                pct={stats.analysisPaidPct}
                flex={stats.analysisPaidPct}
                totalFlex={
                  stats.analysisPaidPct +
                  stats.analysisAwaitPct +
                  stats.analysisPersonalPct
                }
              />
              <AnalysisPctLabel
                pct={stats.analysisAwaitPct}
                flex={stats.analysisAwaitPct}
                totalFlex={
                  stats.analysisPaidPct +
                  stats.analysisAwaitPct +
                  stats.analysisPersonalPct
                }
                muted
              />
              <AnalysisPctLabel
                pct={stats.analysisPersonalPct}
                flex={stats.analysisPersonalPct}
                totalFlex={
                  stats.analysisPaidPct +
                  stats.analysisAwaitPct +
                  stats.analysisPersonalPct
                }
                faint
              />
            </div>
            <AnalysisBar
              paid={stats.analysisPaidPct}
              awaiting={stats.analysisAwaitPct}
              personal={stats.analysisPersonalPct}
            />
            <div className="flex flex-row flex-wrap gap-5 text-[10px] font-light uppercase leading-none tracking-[-0.02em]">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-[5px] w-5 rounded-sm bg-ink" />
                Оплачено
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-[5px] w-5 rounded-sm bg-ink opacity-40" />
                Ожидает оплату
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-[5px] w-5 rounded-sm bg-ink opacity-20" />
                Личные финансы
              </span>
            </div>
          </div>
        </aside>
      </div>

      <Link
        to="/projects"
        className="mt-10 inline-flex text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 hover:underline"
      >
        ← К проектам
      </Link>

      {transactionModalOpen ? (
        <AddTransactionModal
          onClose={() => setTransactionModalOpen(false)}
          onSubmit={(data) => addFinanceTransaction(data)}
        />
      ) : null}
    </main>
  )
}

function BreakdownCol({
  amount,
  subline,
  label,
  pct,
  barColor,
}: {
  amount: number
  subline: string
  label: string
  pct: number
  barColor: string
}) {
  return (
    <div className="flex min-h-[120px] flex-1 flex-col justify-between gap-2.5 pt-10 first:pt-0 lg:px-5 lg:pt-0 lg:first:pl-0">
      <div className="flex flex-row flex-wrap items-center justify-center gap-2.5 px-1">
        <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
          {formatRubDots(amount)}
        </p>
        <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
          {subline}
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-row items-center justify-between px-1">
          <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em]">
            {label}
          </span>
          <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em]">
            {pct}%
          </span>
        </div>
        <div className="flex h-10 flex-row gap-2.5 rounded-full bg-ink/[0.06] p-2.5">
          <div
            className="h-full min-w-0 rounded-full transition-[width] duration-300"
            style={{
              width: `${Math.min(100, pct)}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      </div>
    </div>
  )
}

function AnalysisPctLabel({
  pct,
  flex: flexGrow,
  totalFlex,
  muted,
  faint,
}: {
  pct: number
  flex: number
  totalFlex: number
  muted?: boolean
  faint?: boolean
}) {
  if (totalFlex <= 0 || flexGrow <= 0) return null
  return (
    <div
      className={`flex min-w-0 flex-col gap-2.5 text-[10px] font-light uppercase leading-none tracking-[-0.02em] ${muted ? 'opacity-40' : ''} ${faint ? 'opacity-20' : ''}`}
      style={{ flex: flexGrow }}
    >
      <span>{pct}%</span>
    </div>
  )
}

function AnalysisBar({
  paid,
  awaiting,
  personal,
}: {
  paid: number
  awaiting: number
  personal: number
}) {
  const total = paid + awaiting + personal
  const flex = (n: number) => (total > 0 ? Math.max(n, 0) : 0)

  return (
    <div className="flex h-10 w-full max-w-[405px] flex-row items-stretch overflow-hidden rounded-sm">
      {flex(paid) > 0 && (
        <div
          className="min-w-0 bg-ink"
          style={{ flex: flex(paid) }}
          title={`Оплачено ${paid}%`}
        />
      )}
      {flex(awaiting) > 0 && (
        <div
          className="min-w-0 bg-ink opacity-40"
          style={{ flex: flex(awaiting) }}
          title={`Ожидает оплату ${awaiting}%`}
        />
      )}
      {flex(personal) > 0 && (
        <div
          className="flex min-w-0 flex-row items-stretch gap-0.5 opacity-20"
          style={{ flex: flex(personal) }}
          title={`Личные финансы ${personal}%`}
        >
          {Array.from({ length: Math.min(24, Math.max(8, personal)) }).map(
            (_, i) => (
              <div key={i} className="h-full min-w-[2px] flex-1 bg-ink" />
            ),
          )}
        </div>
      )}
      {total === 0 && (
        <div className="h-full w-full rounded-sm bg-ink/[0.06]" />
      )}
    </div>
  )
}
