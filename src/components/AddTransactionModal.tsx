import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  formInputUnderlineClass,
  modalEdgeBorderClass,
} from '../lib/formInputClasses'
import { CostRubInput } from './CostRubInput'
import { parseAmountRub } from '../lib/parseAmountRub'
import type { FinanceTransactionKind } from '../types/financeTransaction'

type Props = {
  onClose: () => void
  onSubmit: (data: {
    title: string
    amountRub: number
    kind: FinanceTransactionKind
  }) => void
  zClassName?: string
}

const KINDS: { id: FinanceTransactionKind; label: string }[] = [
  { id: 'income', label: 'Доход' },
  { id: 'expense', label: 'Расход' },
]

function emptyForm() {
  return { title: '', amountRaw: '', kind: 'income' as FinanceTransactionKind }
}

export function AddTransactionModal({
  onClose,
  onSubmit,
  zClassName = 'z-50',
}: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState(emptyForm)

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

  const reset = () => setForm(emptyForm())

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const title = form.title.trim() || 'Транзакция'
    const amountRub = parseAmountRub(form.amountRaw)
    if (amountRub <= 0) return
    onSubmit({ title, amountRub, kind: form.kind })
    onClose()
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
        className={`ui-modal-panel-right relative flex h-full w-full max-w-[960px] flex-col border-l ${modalEdgeBorderClass} bg-surface shadow-none`}
      >
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-32 pt-16 sm:px-10 sm:pt-20">
            <h2
              id={titleId}
              className="text-[clamp(2rem,5vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]"
            >
              Добавить транзакцию
            </h2>

            <div className="mt-10 flex max-w-[865px] flex-col gap-12 sm:gap-[50px]">
              <label className="block">
                <span className="sr-only">Название транзакции</span>
                <input
                  className={inputClass}
                  placeholder="Название транзакции"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  autoFocus
                />
              </label>

              <div className="flex max-w-[405px] flex-col gap-10">
                <div className="flex flex-col gap-5">
                  <p className="text-base font-light leading-[0.9] tracking-[-0.09em] text-ink">
                    Тип транзакции
                  </p>
                  <div
                    className="flex flex-wrap items-center gap-2.5"
                    role="group"
                    aria-label="Тип транзакции"
                  >
                    {KINDS.map(({ id, label }) => {
                      const selected = form.kind === id
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setForm((f) => ({ ...f, kind: id }))}
                          className={`rounded-[5px] border border-ink px-1.5 py-1 text-[10px] font-light uppercase leading-none tracking-[-0.02em] transition-colors duration-150 ${
                            selected ? 'bg-ink/10' : 'bg-surface hover:bg-ink/5'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="sr-only">Сумма</span>
                <CostRubInput
                  inputClass={inputClass}
                  placeholder="Только цифры"
                  aria-label="Сумма"
                  valueDigits={form.amountRaw}
                  onChangeDigits={(d) =>
                    setForm((f) => ({ ...f, amountRaw: d }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-between gap-4 border-t border-transparent bg-surface px-6 py-6 sm:px-10 sm:py-8">
            <button
              type="submit"
              className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
            >
              Добавить
            </button>
            <button
              type="button"
              className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
              onClick={reset}
            >
              Сбросить
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
