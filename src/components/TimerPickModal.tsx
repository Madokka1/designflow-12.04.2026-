import { useEffect, useId, useRef, useState } from 'react'
import { modalEdgeBorderClass } from '../lib/formInputClasses'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { DEFAULT_PROJECT_STAGES } from '../data/defaultStages'
import type { Project } from '../types/project'

type Step = 'project' | 'stage'

type Props = {
  open: boolean
  onClose: () => void
  projects: readonly Project[]
  onStart: (projectSlug: string, stageId: string) => void
}

function stagesForProject(p: Project) {
  const s = p.stages
  if (s && s.length > 0) return [...s]
  return [...DEFAULT_PROJECT_STAGES]
}

export function TimerPickModal({
  open,
  onClose,
  projects,
  onStart,
}: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<Step>('project')
  const [projectSlug, setProjectSlug] = useState<string | null>(null)

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

  const selected =
    projectSlug != null
      ? projects.find((p) => p.slug === projectSlug)
      : undefined
  const stageList = selected ? stagesForProject(selected) : []

  const pickProject = (slug: string) => {
    setProjectSlug(slug)
    setStep('stage')
  }

  const startOnStage = (stageId: string) => {
    if (!projectSlug) return
    onStart(projectSlug, stageId)
    onClose()
  }

  const node = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="ui-modal-backdrop absolute inset-0 bg-surface/50 backdrop-blur-[6px]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ui-modal-panel-center relative flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col border border-card-border bg-surface shadow-sm"
      >
        <div className={`border-b px-5 py-4 ${modalEdgeBorderClass}`}>
          <h2
            id={titleId}
            className="text-lg font-light tracking-[-0.06em] text-ink"
          >
            {step === 'project' ? 'Выберите проект' : 'Выберите этап'}
          </h2>
          {step === 'stage' && selected ? (
            <p className="mt-1 text-sm font-light text-ink/60">
              {selected.title}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {step === 'project' ? (
            projects.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm font-light text-ink/55">
                Нет проектов. Создайте проект на странице «Проекты».
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {projects.map((p) => (
                  <li key={p.slug}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 rounded-md border border-transparent px-3 py-3 text-left transition-colors hover:border-card-border hover:bg-ink/[0.03]"
                      onClick={() => pickProject(p.slug)}
                    >
                      <span className="text-base font-light tracking-[-0.04em] text-ink">
                        {p.title}
                      </span>
                      <span className="text-xs font-light text-ink/50">
                        {p.client}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul className="flex flex-col gap-1">
              {stageList.map((st) => (
                <li key={st.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 rounded-md border border-transparent px-3 py-3 text-left transition-colors hover:border-card-border hover:bg-ink/[0.03]"
                    onClick={() => startOnStage(st.id)}
                  >
                    <span className="text-base font-light tracking-[-0.04em] text-ink">
                      {st.name}
                    </span>
                    <span className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/45">
                      {st.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`flex items-center justify-between gap-3 border-t px-4 py-3 ${modalEdgeBorderClass}`}>
          {step === 'stage' ? (
            <button
              type="button"
              className="text-sm font-light text-ink/70 underline-offset-2 hover:text-ink hover:underline"
              onClick={() => {
                setStep('project')
                setProjectSlug(null)
              }}
            >
              ← Назад к проектам
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="text-sm font-light text-ink/70 hover:text-ink"
            onClick={onClose}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
