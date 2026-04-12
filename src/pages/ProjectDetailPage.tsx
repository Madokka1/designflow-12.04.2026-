import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CreateStageModal } from '../components/CreateStageModal'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { StageDetailModal } from '../components/StageDetailModal'
import { StageFormModal } from '../components/StageFormModal'
import { projectToForm } from '../lib/projectToForm'
import { stageToForm } from '../lib/stageToForm'
import { DEFAULT_PROJECT_STAGES } from '../data/defaultStages'
import { useNotesContext } from '../hooks/useNotesContext'
import { useProjects } from '../hooks/useProjects'
import { formatDurationRu } from '../lib/formatDurationRu'
import { formatRubDots } from '../lib/parseAmountRub'
import { computeProjectProfitRub } from '../lib/projectProfit'
import { stagePlannedRows } from '../lib/stagePlannedRows'
import type { ProjectStage } from '../types/project'

const CARD_FALLBACK_TAGS = ['Ожидает оплаты', 'В работе', 'Разработка'] as const

function StageRow({
  stage,
  onOpen,
}: {
  stage: ProjectStage
  onOpen: (s: ProjectStage) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(stage)}
      className="w-full cursor-pointer text-left outline-none ring-ink transition-[background-color,transform] duration-200 ease-out motion-reduce:transition-colors hover:bg-ink/[0.02] hover:-translate-y-px motion-reduce:hover:translate-y-0 focus-visible:ring-2"
    >
    <div className="flex flex-col gap-6 border border-[rgba(10,10,10,0.4)] p-5 sm:flex-row sm:items-stretch sm:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em]">
            {stage.status}
          </span>
          <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em]">
            дедлайн: {stage.deadline}
          </span>
        </div>
        <h3 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em]">
          {stage.name}
        </h3>
      </div>
      <div
        className={`flex w-full min-w-0 shrink-0 flex-col justify-between gap-4 sm:w-auto sm:max-w-[min(100%,20rem)] sm:items-end ${
          stage.actualInPill ? 'sm:min-h-[55px]' : 'sm:min-h-[55px]'
        }`}
      >
        <div className="flex w-full flex-col gap-2.5 sm:items-end">
          {stagePlannedRows(stage.planned).map((line, i) => (
            <p
              key={i}
              className="w-full text-[10px] font-light uppercase leading-relaxed tracking-[-0.02em] text-ink/90 sm:text-right"
            >
              {line}
            </p>
          ))}
        </div>
        {stage.actualInPill ? (
          <div className="inline-flex rounded-full bg-fill-contrast-bg px-2.5 py-1 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-fill-contrast-fg">
            {stage.timeSpentSeconds != null
              ? `фактическое время: ${formatDurationRu(stage.timeSpentSeconds)}`
              : stage.actual}
          </div>
        ) : (
          <p className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink sm:text-right">
            {stage.timeSpentSeconds != null
              ? `фактическое время: ${formatDurationRu(stage.timeSpentSeconds)}`
              : stage.actual}
          </p>
        )}
      </div>
    </div>
    </button>
  )
}

export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const {
    getProjectBySlug,
    addProjectStage,
    removeProjectStage,
    updateProjectStage,
    updateProject,
    toggleStageTimer,
    isStageTimerSessionActive,
    getProjectTrackedSeconds,
    toggleStageChecklistItem,
    clients,
    getClientById,
    setProjectArchived,
    saveProjectAsTemplate,
    duplicateProject,
    deleteProject,
  } = useProjects()
  const { getNotesByProjectSlug } = useNotesContext()
  const project = slug ? getProjectBySlug(slug) : undefined
  const linkedNotes = slug ? getNotesByProjectSlug(slug) : []
  const [stageModalOpen, setStageModalOpen] = useState(false)
  const [selectedStage, setSelectedStage] = useState<ProjectStage | null>(null)
  const [stageEditOpen, setStageEditOpen] = useState(false)
  const [stageEditNonce, setStageEditNonce] = useState(0)
  const [projectEditOpen, setProjectEditOpen] = useState(false)
  const [projectEditNonce, setProjectEditNonce] = useState(0)

  if (!slug || !project) {
    return <Navigate to="/projects" replace />
  }

  const tags = project.tags ?? CARD_FALLBACK_TAGS
  const stages = project.stages ?? DEFAULT_PROJECT_STAGES
  const linkedClient = project.clientId
    ? getClientById(project.clientId)
    : undefined
  const detailStage = selectedStage
    ? (stages.find((s) => s.id === selectedStage.id) ?? selectedStage)
    : null

  const trackedSec = getProjectTrackedSeconds(slug)
  const profitRub = computeProjectProfitRub({
    amountDisplay: project.amount,
    employeeHourlyRateRub: project.employeeHourlyRateRub,
    trackedSeconds: trackedSec,
  })

  return (
    <>
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-[487px] flex-col gap-5">
          <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]">
            {project.title}
          </h1>
          <p className="text-[20px] font-light leading-[0.9] tracking-[-0.09em]">
            {project.client}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-8 shrink-0 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
            onClick={() => {
              setProjectEditNonce((n) => n + 1)
              setProjectEditOpen(true)
            }}
          >
            Редактировать проект
          </button>
          <button
            type="button"
            className="h-8 shrink-0 rounded-full border border-card-border px-4 text-sm font-light tracking-[-0.04em] text-ink transition-colors hover:bg-ink/[0.04]"
            onClick={() =>
              setProjectArchived(slug, !project.archived)
            }
          >
            {project.archived ? 'Вернуть из архива' : 'В архив'}
          </button>
          <button
            type="button"
            className="h-8 shrink-0 rounded-full border border-card-border px-4 text-sm font-light tracking-[-0.04em] text-ink transition-colors hover:bg-ink/[0.04]"
            onClick={() => {
              const name = window.prompt('Название шаблона', project.title)
              if (name === null) return
              saveProjectAsTemplate(slug, name)
            }}
          >
            Шаблон из проекта
          </button>
          <button
            type="button"
            className="h-8 shrink-0 rounded-full border border-card-border px-4 text-sm font-light tracking-[-0.04em] text-ink transition-colors hover:bg-ink/[0.04]"
            onClick={() => {
              const next = duplicateProject(slug)
              if (next) navigate(`/projects/${next}`)
            }}
          >
            Дублировать проект
          </button>
          {linkedClient ? (
            <Link
              to={`/clients?focus=${encodeURIComponent(project.clientId!)}`}
              className="h-8 inline-flex shrink-0 items-center rounded-full border border-card-border px-4 text-sm font-light tracking-[-0.04em] text-ink transition-colors hover:bg-ink/[0.04]"
            >
              Карточка: {linkedClient.name}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-10 xl:flex-row xl:items-start xl:gap-10">
        <section className="order-2 flex min-w-0 flex-1 flex-col gap-11 border border-[rgba(10,10,10,0.32)] p-5 xl:order-1">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em]">
              Этапы проекта
            </h2>
            <button
              type="button"
              className="h-8 shrink-0 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
              onClick={() => setStageModalOpen(true)}
            >
              Создать этап
            </button>
          </div>
          <div className="flex flex-col gap-5">
            {stages.map((s) => (
              <StageRow key={s.id} stage={s} onOpen={setSelectedStage} />
            ))}
          </div>
        </section>

        <aside className="order-1 w-full shrink-0 border border-[rgba(10,10,10,0.32)] p-5 xl:order-2 xl:max-w-[445px]">
          <div className="flex flex-col gap-3">
            <h2 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em]">
              {project.title}
            </h2>
            <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
              {project.client}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-5">
                {tags.map((label, i) => (
                  <span
                    key={`${label}-${i}`}
                    className="text-[10px] font-light uppercase leading-none tracking-[-0.02em]"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <span className="shrink-0 text-base font-light leading-[0.9] tracking-[-0.09em]">
                {project.amount}
              </span>
            </div>
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-[rgba(10,10,10,0.1)]">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] font-light uppercase leading-none tracking-[-0.02em]">
              <span className="min-w-0">
                дедлайн: {project.deadline}
                <span className="text-ink/65">
                  {' '}
                  · фактическое время:{' '}
                  {formatDurationRu(trackedSec)}
                </span>
              </span>
              <span className="shrink-0">{project.progress}%</span>
            </div>
            <p className="text-[10px] font-light uppercase leading-relaxed tracking-[-0.02em] text-ink/90">
              профит: {formatRubDots(profitRub)}
            </p>
          </div>
          {linkedNotes.length > 0 ? (
            <div className="mt-8 border-t border-[rgba(10,10,10,0.15)] pt-6">
              <h3 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
                Заметки
              </h3>
              <ul className="mt-3 flex flex-col gap-2">
                {linkedNotes.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={`/notes/${n.slug}`}
                      className="text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 hover:underline"
                    >
                      {n.title.trim() || 'Без названия'}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Link
            to="/projects"
            className="mt-8 inline-flex text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 hover:underline"
          >
            ← К списку проектов
          </Link>
        </aside>
      </div>
    </main>

    {stageModalOpen ? (
      <CreateStageModal
        onClose={() => setStageModalOpen(false)}
        onCreate={(data) => addProjectStage(slug, data)}
      />
    ) : null}

    {detailStage ? (
      <StageDetailModal
        project={project}
        stage={detailStage}
        projectTrackedSeconds={getProjectTrackedSeconds(slug)}
        timerSessionActive={isStageTimerSessionActive(slug, detailStage.id)}
        onToggleTimer={() => toggleStageTimer(slug, detailStage.id)}
        onToggleChecklistItem={(itemId) =>
          toggleStageChecklistItem(slug, detailStage.id, itemId)
        }
        onClose={() => {
          setSelectedStage(null)
          setStageEditOpen(false)
        }}
        onDelete={() => removeProjectStage(slug, detailStage.id)}
        onEdit={() => {
          setStageEditNonce((n) => n + 1)
          setStageEditOpen(true)
        }}
      />
    ) : null}

    {stageEditOpen && detailStage ? (
      <StageFormModal
        key={`stage-edit-${detailStage.id}-${stageEditNonce}`}
        title="Редактировать этап"
        submitLabel="Сохранить"
        initialForm={stageToForm(detailStage)}
        zClassName="z-[70]"
        onClose={() => setStageEditOpen(false)}
        onSubmit={(data) => {
          updateProjectStage(slug, detailStage.id, data)
          setStageEditOpen(false)
        }}
      />
    ) : null}

    {projectEditOpen ? (
      <ProjectFormModal
        key={`project-edit-${slug}-${projectEditNonce}`}
        title="Редактировать проект"
        submitLabel="Сохранить"
        initialForm={projectToForm(project)}
        zClassName="z-[65]"
        clientsForPicker={clients}
        showDeleteProject
        onDeleteProject={async () => {
          const err = await deleteProject(slug)
          if (err) {
            window.alert(err.message)
            return
          }
          setProjectEditOpen(false)
          navigate('/projects', { replace: true })
        }}
        onClose={() => setProjectEditOpen(false)}
        onSubmit={(data) => {
          updateProject(slug, data)
          setProjectEditOpen(false)
        }}
      />
    ) : null}
    </>
  )
}
