import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  formInputUnderlineClass,
  modalEdgeBorderClass,
} from '../lib/formInputClasses'
import { CostRubInput } from './CostRubInput'
import { DeadlineDdMmYyyyInput } from './DeadlineDdMmYyyyInput'
import { DurationTokensInput } from './DurationTokensInput'
import {
  PAYMENT_STATUSES,
  STAGE_STATUSES,
  type CreateStageForm,
} from '../types/stageForm'

function newChecklistId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

type Props = {
  title: string
  submitLabel: string
  initialForm: CreateStageForm
  onClose: () => void
  onSubmit: (data: CreateStageForm) => void
  /** z-50 по умолчанию; для редактирования поверх деталей — выше */
  zClassName?: string
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  name: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label={name}>
      {options.map((opt) => {
        const selected = value === opt
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt)}
            className={`rounded-[5px] border border-ink px-1.5 py-1 text-[10px] font-light uppercase leading-none tracking-[-0.02em] transition-colors duration-150 ${
              selected ? 'bg-ink/10' : 'bg-surface hover:bg-ink/5'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export function StageFormModal({
  title,
  submitLabel,
  initialForm,
  onClose,
  onSubmit,
  zClassName = 'z-50',
}: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<CreateStageForm>(() => ({ ...initialForm }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useFocusTrap(true, panelRef)

  const update = <K extends keyof CreateStageForm>(key: K, v: CreateStageForm[K]) =>
    setForm((f) => ({ ...f, [key]: v }))

  const reset = () => setForm({ ...initialForm })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  const inputClass = formInputUnderlineClass

  const node = (
    <div className={`fixed inset-0 flex justify-end ${zClassName}`}>
      <button
        type="button"
        className="ui-modal-backdrop absolute inset-0 bg-surface/40 backdrop-blur-[5px]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`ui-modal-panel-right relative flex h-full max-h-[100dvh] min-h-0 w-full max-w-[960px] flex-col border-l ${modalEdgeBorderClass} bg-surface shadow-none`}
      >
        <form className="flex h-full min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex shrink-0 items-center border-b border-card-border py-3 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:hidden">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 outline-none ring-ink transition-opacity hover:underline hover:opacity-90 focus-visible:ring-2"
              aria-label="Назад"
            >
              ← Назад
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6 sm:px-10 sm:pt-20">
            <h2
              id={titleId}
              className="text-[clamp(2rem,5vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]"
            >
              {title}
            </h2>

            <div className="mt-10 flex max-w-[865px] flex-col gap-12 sm:gap-[50px]">
              <div className="flex flex-col gap-5">
                <label className="block">
                  <span className="sr-only">Название этапа</span>
                  <input
                    className={inputClass}
                    placeholder="Название этапа"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="sr-only">Стоимость этапа</span>
                  <CostRubInput
                    inputClass={inputClass}
                    placeholder="Только цифры, напр. 10000"
                    aria-label="Стоимость этапа"
                    valueDigits={form.cost}
                    onChangeDigits={(d) => update('cost', d)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                    Планируемое время
                  </span>
                  <DurationTokensInput
                    inputClass={inputClass}
                    placeholder="ч м с, напр. 1 30 или 0 30 0"
                    aria-label="Планируемое время"
                    value={form.plannedTime}
                    onChange={(v) => update('plannedTime', v)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                    Фактическое время
                  </span>
                  <DurationTokensInput
                    inputClass={inputClass}
                    placeholder="ч м с, напр. 2 15 0 — можно без таймера"
                    aria-label="Фактическое время"
                    value={form.actualTime}
                    onChange={(v) => update('actualTime', v)}
                  />
                </label>
              </div>

              <div className="flex max-w-[405px] flex-col gap-10">
                <div className="flex flex-col gap-5">
                  <p className="text-base font-light leading-[0.9] tracking-[-0.09em] text-ink">
                    Статус этапа
                  </p>
                  <ChipRow
                    name="Статус этапа"
                    options={STAGE_STATUSES}
                    value={form.stageStatus}
                    onChange={(v) => update('stageStatus', v)}
                  />
                </div>
                <div className="flex flex-col gap-5">
                  <p className="text-base font-light leading-[0.9] tracking-[-0.09em] text-ink">
                    Статус оплаты
                  </p>
                  <ChipRow
                    name="Статус оплаты"
                    options={PAYMENT_STATUSES}
                    value={form.paymentStatus}
                    onChange={(v) => update('paymentStatus', v)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <label className="block">
                  <span className="sr-only">Комментарий</span>
                  <textarea
                    className={`${inputClass} min-h-[4.5rem] resize-y border-b`}
                    placeholder="Комментарий"
                    rows={3}
                    value={form.comment}
                    onChange={(e) => update('comment', e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                    Дедлайн
                  </span>
                  <DeadlineDdMmYyyyInput
                    inputClass={inputClass}
                    aria-label="Дедлайн этапа"
                    value={form.deadline}
                    onChange={(v) => update('deadline', v)}
                  />
                </label>
              </div>

              <div className="flex max-w-[445px] flex-col gap-5">
                <p className="text-base font-light leading-[0.9] tracking-[-0.09em] text-ink">
                  Список задач
                </p>
                <div className="flex flex-col gap-4">
                  {form.checklist.map((item) => (
                    <div
                      key={item.id}
                      className={`flex flex-wrap items-center gap-3 border-b ${modalEdgeBorderClass} pb-3`}
                    >
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={!!item.done}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              checklist: f.checklist.map((c) =>
                                c.id === item.id
                                  ? { ...c, done: !c.done }
                                  : c,
                              ),
                            }))
                          }
                          className="h-3 w-3 shrink-0 border border-ink accent-ink"
                        />
                        <span className="sr-only">Выполнено</span>
                      </label>
                      <input
                        className={`${inputClass} flex-1 border-b-0 pb-0`}
                        placeholder="Текст задачи"
                        value={item.label}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            checklist: f.checklist.map((c) =>
                              c.id === item.id
                                ? { ...c, label: e.target.value }
                                : c,
                            ),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="text-sm font-light tracking-[-0.02em] text-ink/50 hover:text-ink"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            checklist: f.checklist.filter((c) => c.id !== item.id),
                          }))
                        }
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="self-start text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 hover:underline"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      checklist: [
                        ...f.checklist,
                        { id: newChecklistId(), label: '', done: false },
                      ],
                    }))
                  }
                >
                  + Добавить задачу
                </button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-card-border bg-surface px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-10 sm:py-6">
            <button
              type="submit"
              className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
            >
              {submitLabel}
            </button>
            <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
              <button
                type="button"
                className="h-8 rounded-full border border-card-border bg-surface px-5 text-sm font-light tracking-[-0.05em] text-ink transition-colors hover:bg-ink/[0.04]"
                onClick={onClose}
              >
                Отмена
              </button>
              <button
                type="button"
                className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
                onClick={reset}
              >
                Сбросить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
