import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  formInputUnderlineClass,
  modalEdgeBorderClass,
} from '../lib/formInputClasses'

type Props = {
  open: boolean
  initialTitle: string
  initialDescription: string
  onClose: () => void
  /** Сохранить название и описание в черновик */
  onSave: (title: string, description: string) => void
  onDelete: () => void | Promise<void>
  readOnly?: boolean
  zClassName?: string
}

export function NoteEditMetaModal({
  open,
  initialTitle,
  initialDescription,
  onClose,
  onSave,
  onDelete,
  readOnly = false,
  zClassName = 'z-[65]',
}: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useFocusTrap(open, panelRef)

  if (!open) return null

  const inputClass = formInputUnderlineClass

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    onSave(title, description)
    onClose()
  }

  const node = (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/35 p-4 ${zClassName}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[min(90dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-none border ${modalEdgeBorderClass} bg-surface shadow-[0_24px_80px_-32px_rgba(0,0,0,0.35)]`}
      >
        <div
          className={`flex shrink-0 items-center justify-between gap-4 border-b ${modalEdgeBorderClass} px-6 py-5 sm:px-8`}
        >
          <h2
            id={titleId}
            className="text-xl font-light tracking-[-0.06em] text-ink sm:text-2xl"
          >
            Редактировать заметку
          </h2>
          <button
            type="button"
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-light text-ink/70 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
        >
          <div className="flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-8">
            <label className="block">
              <span className="mb-1 block text-[10px] font-light uppercase tracking-[0.08em] text-ink/55">
                Название
              </span>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={readOnly}
                placeholder="Название"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-light uppercase tracking-[0.08em] text-ink/55">
                Описание
              </span>
              <textarea
                className={`${inputClass} min-h-[5rem] resize-y border-b`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readOnly}
                placeholder="Описание"
                rows={4}
              />
            </label>
          </div>

          {!readOnly ? (
            <div className="border-t border-red-600/20 px-6 pb-2 pt-5 sm:px-8">
              <button
                type="button"
                className="text-sm font-light tracking-[-0.02em] text-red-700 underline-offset-4 transition-opacity hover:opacity-80 dark:text-red-400"
                onClick={() => {
                  if (
                    !window.confirm(
                      'Удалить заметку безвозвратно? Её нельзя будет восстановить.',
                    )
                  ) {
                    return
                  }
                  void Promise.resolve(onDelete())
                }}
              >
                Удалить заметку навсегда
              </button>
            </div>
          ) : null}

          <div
            className={`mt-auto flex flex-wrap items-center justify-between gap-4 border-t ${modalEdgeBorderClass} bg-surface px-6 py-5 sm:px-8`}
          >
            <button
              type="submit"
              disabled={readOnly}
              className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Сохранить
            </button>
            <button
              type="button"
              className="h-8 rounded-full border border-card-border px-4 text-sm font-light tracking-[-0.04em] text-ink transition-colors hover:bg-ink/[0.04]"
              onClick={onClose}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
