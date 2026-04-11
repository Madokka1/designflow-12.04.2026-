import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  formInputUnderlineClass,
  modalEdgeBorderClass,
} from '../lib/formInputClasses'
import { parseRuDate } from '../lib/parseRuDate'

type Props = {
  onClose: () => void
  onSubmit: (data: { title: string; dateRaw: string; comment?: string }) => void
  /** Подставить в поле даты (ДД.ММ.ГГГГ) */
  defaultDateRaw?: string
  zClassName?: string
}

function emptyForm(defaultDateRaw?: string) {
  return {
    title: '',
    dateRaw: defaultDateRaw ?? '',
    comment: '',
  }
}

export function CreateCalendarEventModal({
  onClose,
  onSubmit,
  defaultDateRaw,
  zClassName = 'z-50',
}: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState(() => emptyForm(defaultDateRaw))

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

  const reset = () => setForm(emptyForm(defaultDateRaw))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const title = form.title.trim() || 'Событие'
    const dateRaw = form.dateRaw.trim()
    if (!parseRuDate(dateRaw)) return
    const comment = form.comment.trim()
    onSubmit({
      title,
      dateRaw,
      comment: comment || undefined,
    })
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
              Создать событие
            </h2>

            <div className="mt-10 flex max-w-[865px] flex-col gap-12 sm:gap-[50px]">
              <label className="block">
                <span className="sr-only">Название события</span>
                <input
                  className={inputClass}
                  placeholder="Название события"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="sr-only">Дата</span>
                <input
                  className={inputClass}
                  placeholder="Дата"
                  value={form.dateRaw}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dateRaw: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="sr-only">Комментарий</span>
                <textarea
                  className={`${inputClass} min-h-[4.5rem] resize-y border-b`}
                  placeholder="Комментарий"
                  rows={3}
                  value={form.comment}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, comment: e.target.value }))
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
              Создать событие
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
