import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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

function formatDdMmYyyy(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function pillClass(tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger') {
  const base =
    'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-light uppercase leading-none tracking-[-0.02em]'
  switch (tone) {
    case 'success':
      return `${base} border-emerald-700/20 bg-emerald-500/10 text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200`
    case 'warning':
      return `${base} border-amber-700/20 bg-amber-500/10 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200`
    case 'info':
      return `${base} border-blue-700/20 bg-blue-500/10 text-blue-950 dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-200`
    case 'danger':
      return `${base} border-red-700/20 bg-red-500/10 text-red-900 dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-200`
    default:
      return `${base} border-ink/15 bg-ink/[0.03] text-ink/75 dark:border-white/15 dark:bg-white/[0.04] dark:text-ink/70`
  }
}

function projectStatusPill(p: Project): { label: string; tone: Parameters<typeof pillClass>[0] } {
  if (getProjectSection(p) === 'Личные') return { label: 'личные', tone: 'neutral' }
  const pay = paymentTag(p)
  if (pay === 'оплачено') return { label: 'оплачено', tone: 'success' }
  if (pay === 'поэтапная оплата') return { label: 'поэтапно', tone: 'info' }
  return { label: 'ожидает оплаты', tone: 'warning' }
}

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

/** Проект без тега «оплачено», не из раздела «Личные» (вкладка логов). */
function isUnpaidNonPersonal(p: Project): boolean {
  if (getProjectSection(p) === 'Личные') return false
  return !((p.tags ?? []).includes('оплачено'))
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

type LogTab =
  | 'all'
  | 'Разработка'
  | 'Поддержка'
  | 'Личные'
  | 'awaiting_payment'

const LOG_TABS: { id: LogTab; label: string }[] = [
  { id: 'all', label: 'Все проекты' },
  { id: 'Разработка', label: 'Разработка' },
  { id: 'Поддержка', label: 'Поддержка' },
  { id: 'Личные', label: 'Личные' },
  { id: 'awaiting_payment', label: 'Ожидает оплату' },
]

export function FinancePage() {
  const location = useLocation()
  const { projects, financeTransactions, addFinanceTransaction } = useProjects()
  const [logTab, setLogTab] = useState<LogTab>('all')
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [hoveredLogRowId, setHoveredLogRowId] = useState<string | null>(null)

  useEffect(() => {
    const hash = location.hash.replace(/^#/, '')
    if (!hash.startsWith('finance-tx-')) return
    window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 120)
  }, [location.hash, financeTransactions.length])

  const stats = useMemo(() => {
    /** Сумма договоров по всем проектам — знаменатель для долей в разбивке */
    let allProjectsSum = 0
    /** Как на главной: в оборот входят только суммы проектов с тегом «оплачено» */
    let paidProjectsSum = 0
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
      allProjectsSum += a
      const b = financeBucket(p)
      amt[b] += a
      cnt[b] += 1
      if (b === 'staged') {
        stagedStages += p.stages?.length ?? 0
      }
      if (paymentTag(p) === 'оплачено') {
        paidProjectsSum += a
      }
    }

    let transactionNet = 0
    for (const tx of financeTransactions) {
      if (tx.kind === 'income') transactionNet += tx.amountRub
      else transactionNet -= tx.amountRub
    }

    /**
     * Итог «Оборот» / «Анализ»: полностью оплаченные проекты + уже полученная сумма
     * по поэтапной оплате (поле amount у таких проектов = оплаченные этапы) + транзакции.
     */
    const total = paidProjectsSum + amt.staged + transactionNet

    const pct = (part: number) =>
      allProjectsSum > 0 ? Math.round((part / allProjectsSum) * 100) : 0

    /** В анализе «получено»: оплачено целиком + оплаченные этапы; «ожидает» — без поэтапки */
    const analysisReceived = amt.paid + amt.staged
    const analysisAwaitingOnly = amt.awaiting

    return {
      /** Сумма по проектам с тегом «оплачено» (для подписи к обороту) */
      paidProjectsSum,
      stagedReceivedSum: amt.staged,
      transactionNet,
      total,
      amt,
      cnt,
      stagedStages,
      pctPaid: pct(amt.paid),
      pctAwait: pct(amt.awaiting),
      pctStaged: pct(amt.staged),
      pctPersonal: pct(amt.personal),
      analysisPaidPct: pct(analysisReceived),
      analysisAwaitPct: pct(analysisAwaitingOnly),
      analysisPersonalPct: pct(amt.personal),
    }
  }, [projects, financeTransactions])

  const logProjects = useMemo(() => {
    if (logTab === 'all') return projects
    if (logTab === 'awaiting_payment') {
      return projects.filter(isUnpaidNonPersonal)
    }
    return projects.filter((p) => getProjectSection(p) === logTab)
  }, [projects, logTab])

  const logRows = useMemo(() => {
    if (logTab === 'all') {
      const txs = financeTransactions.map((tx) => ({
        kind: 'transaction' as const,
        tx,
      }))
      return [
        ...txs,
        ...logProjects.map((p) => ({ kind: 'project' as const, project: p })),
      ]
    }
    return logProjects.map((p) => ({ kind: 'project' as const, project: p }))
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
              {stats.transactionNet !== 0 || stats.stagedReceivedSum > 0 ? (
                <p className="text-sm font-light leading-snug tracking-[-0.02em] text-ink/55">
                  {stats.paidProjectsSum > 0 ? (
                    <>
                      Оплачено по проектам{' '}
                      {formatRubDots(stats.paidProjectsSum)}
                    </>
                  ) : null}
                  {stats.stagedReceivedSum > 0 ? (
                    <>
                      {stats.paidProjectsSum > 0 ? ' · ' : null}
                      Оплата за этапы{' '}
                      {formatRubDots(stats.stagedReceivedSum)}
                    </>
                  ) : null}
                  {stats.transactionNet !== 0 ? (
                    <>
                      {(stats.paidProjectsSum > 0 ||
                        stats.stagedReceivedSum > 0) &&
                      ' · '}
                      {stats.transactionNet > 0 ? '+' : ''}
                      {formatRubDots(stats.transactionNet)} по транзакциям
                    </>
                  ) : null}
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

          <section className={`flex flex-col gap-10 border ${BORDER_MAIN} p-5 sm:p-5`}>
            <p className="text-sm font-light leading-[0.9] tracking-[-0.06em]">
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
                      className={`text-sm leading-[1.2] ${logTab === t.id ? 'font-normal' : 'font-light'} tracking-normal`}
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
              <div
                className={`hidden grid-cols-[minmax(0,1fr)_10rem_9rem_11rem_10rem] gap-4 border-b ${BORDER_MAIN} px-5 pb-3 text-[10px] font-light uppercase tracking-[-0.02em] text-ink/60 sm:grid`}
                aria-hidden
              >
                <span>Название</span>
                <span>Раздел</span>
                <span>Дата</span>
                <span>Статус</span>
                <span className="text-right">Сумма</span>
              </div>

              <div className="flex flex-col">
                {logRows.map((row) => {
                  const isTx = row.kind === 'transaction'
                  const rowId = isTx ? `tx-${row.tx.id}` : `p-${row.project.id}`
                  const title = isTx ? row.tx.title : row.project.title
                  const section = isTx ? 'Транзакция' : getProjectSection(row.project)
                  const date = isTx
                    ? formatDdMmYyyy(row.tx.createdAt)
                    : (row.project.deadline?.trim() || '—')
                  const status = isTx
                    ? row.tx.kind === 'income'
                      ? { label: 'доход', tone: 'success' as const }
                      : { label: 'расход', tone: 'danger' as const }
                    : projectStatusPill(row.project)
                  const amountRub = isTx
                    ? row.tx.amountRub
                    : parseAmountRub(row.project.amount)
                  const amountPrefix = isTx
                    ? row.tx.kind === 'income'
                      ? '+'
                      : '−'
                    : ''

                  return (
                    <div
                      key={rowId}
                      id={isTx ? `finance-tx-${row.tx.id}` : undefined}
                      onMouseEnter={() => setHoveredLogRowId(rowId)}
                      onMouseLeave={() => setHoveredLogRowId(null)}
                      className={`scroll-mt-24 border-t ${BORDER_MAIN} px-5 py-5 first:border-t-0 transition-opacity duration-150 sm:px-5 ${
                        hoveredLogRowId && hoveredLogRowId !== rowId
                          ? 'opacity-20'
                          : 'opacity-100'
                      }`}
                    >
                      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_10rem_9rem_11rem_10rem] sm:items-center sm:gap-4">
                        <div className="min-w-0">
                          {isTx ? (
                            <p className="truncate text-[clamp(1.25rem,3vw,2rem)] font-light leading-[0.9] tracking-[-0.09em]">
                              {title}
                            </p>
                          ) : (
                            <Link
                              to={`/projects/${row.project.slug}`}
                              className="block truncate text-[1.4rem] font-light leading-[0.9] tracking-[-0.09em] underline-offset-4 hover:underline"
                            >
                              {title}
                            </Link>
                          )}
                        </div>

                        <span className="text-xs font-light tracking-[-0.02em] text-ink/60 sm:text-[12px]">
                          {section}
                        </span>
                        <span className="text-xs font-light tracking-[-0.02em] text-ink/60 sm:text-[12px]">
                          {date}
                        </span>
                        <div className="hidden sm:block">
                          <span className={pillClass(status.tone)}>{status.label}</span>
                        </div>

                        <p className="text-right text-base font-light tabular-nums tracking-[-0.04em] sm:text-[15px]">
                          {amountPrefix}
                          {formatRubDots(amountRub)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
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
                Оплачено и этапы
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
      <div className="flex flex-row flex-wrap items-center justify-between gap-2.5">
        <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
          {formatRubDots(amount)}
        </p>
        <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
          {subline}
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-row items-center justify-between">
          <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em]">
            {label}
          </span>
          <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em]">
            {pct}%
          </span>
        </div>
        <div className="flex h-2 flex-row gap-2.5 rounded-full bg-ink/[0.06]">
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
