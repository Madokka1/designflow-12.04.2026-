import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AutolinkText } from '../components/AutolinkText'
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
import { partitionProjectCardTags } from '../lib/projectSection'
import { computeProjectProfitRub } from '../lib/projectProfit'
import { stagePlannedRows } from '../lib/stagePlannedRows'
import {
  stageActualTimeLine,
  stageCommentFromActual,
} from '../lib/stageToForm'
import {
  projectCardTagChipClass,
  stageStatusChipClass,
} from '../lib/tagChipClasses'
import {
  reorderStagesBeforeTarget,
  reorderStagesToEnd,
  STAGE_DND_TYPE,
} from '../lib/reorderProjectStages'
import type { ProjectStage } from '../types/project'

const CARD_FALLBACK_TAGS = ['Ожидает оплаты', 'В работе', 'Разработка'] as const

function StageRow({
  stage,
  reorderMode,
  isDragging,
  isDropTarget,
  onOpen,
  onDragStartReorder,
  onDragOverReorder,
  onDropReorder,
}: {
  stage: ProjectStage
  reorderMode: boolean
  isDragging: boolean
  isDropTarget: boolean
  onOpen: (s: ProjectStage) => void
  onDragStartReorder: () => void
  onDragOverReorder: () => void
  onDropReorder: (dragId: string) => void
}) {
  const stageComment =
    stage.description?.trim() || stageCommentFromActual(stage.actual)

  const chipTypography =
    'inline-flex items-center text-[10px] font-light uppercase leading-none tracking-[-0.02em]'
  const chipDefault = `${chipTypography} rounded-full border border-ink/12 bg-ink/[0.03] px-2.5 py-1 text-ink/80 dark:border-white/12 dark:bg-white/[0.04] dark:text-ink/75`

  const statusChipClass = stageStatusChipClass(stage.status)

  const cardBody = (
    <div
      className={`flex flex-col overflow-hidden rounded-[3px] border transition-colors sm:flex-row sm:items-stretch ${
        reorderMode
          ? isDropTarget
            ? 'border-ink/40 ring-2 ring-ink/25 dark:border-white/35 dark:ring-white/20'
            : 'border-ink/15'
          : 'border-ink/15 group-hover:border-ink/25'
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5 sm:gap-5 sm:p-6 sm:pr-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={statusChipClass}>{stage.status}</span>
          <span className={chipDefault}>дедлайн: {stage.deadline}</span>
        </div>
        <h3 className="text-[clamp(1.5rem,4vw,2rem)] font-light leading-[0.95] tracking-[-0.06em]">
          {stage.name}
        </h3>
        {stageComment ? (
          <p className="max-w-[min(100%,40rem)] whitespace-pre-wrap break-words border-l-2 border-ink/15 pl-3 text-sm font-light leading-relaxed tracking-[-0.02em] text-ink/65 dark:border-white/20 dark:text-ink/60">
            <AutolinkText text={stageComment} />
          </p>
        ) : null}
      </div>
      <div className="flex w-full min-w-0 shrink-0 flex-col justify-between gap-4 border-t border-ink/10 bg-ink/[0.025] px-5 py-5 sm:w-[min(100%,17.5rem)] sm:border-l sm:border-t-0 sm:border-ink/10 sm:px-6 sm:py-6 dark:bg-white/[0.03]">
        <div className="flex w-full flex-col gap-3 sm:items-end">
          {stagePlannedRows(stage.planned).map((line, i) => (
            <p
              key={i}
              className="w-full whitespace-pre-wrap break-words text-[10px] font-light uppercase leading-relaxed tracking-[-0.02em] text-ink/75 sm:text-right"
            >
              <AutolinkText text={line} />
            </p>
          ))}
        </div>
        {stage.actualInPill ? (
          <div className="inline-flex self-start rounded-full bg-fill-contrast-bg px-2.5 py-1 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-fill-contrast-fg sm:self-end">
            {stageActualTimeLine(stage)}
          </div>
        ) : (
          <p className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/80 sm:text-right">
            {stageActualTimeLine(stage)}
          </p>
        )}
      </div>
    </div>
  )

  if (reorderMode) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(STAGE_DND_TYPE, stage.id)
          e.dataTransfer.effectAllowed = 'move'
          onDragStartReorder()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onDragOverReorder()
        }}
        onDrop={(e) => {
          e.preventDefault()
          const dragId = e.dataTransfer.getData(STAGE_DND_TYPE)
          if (!dragId) return
          onDropReorder(dragId)
        }}
        className={`min-w-0 select-none outline-none ring-ink transition-opacity duration-200 ease-out focus-visible:ring-2 ${
          isDragging ? 'cursor-grabbing opacity-50' : 'cursor-grab opacity-100'
        }`}
      >
        {cardBody}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(stage)}
      className="group min-w-0 w-full cursor-pointer text-left outline-none ring-ink transition-[background-color,border-color] duration-200 ease-out hover:bg-ink/[0.02] focus-visible:ring-2"
    >
      {cardBody}
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
    reorderProjectStages,
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
  const [reorderMode, setReorderMode] = useState(false)
  const [reorderDraft, setReorderDraft] = useState<ProjectStage[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropOverId, setDropOverId] = useState<string | null>(null)

  useEffect(() => {
    if (!reorderMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setReorderMode(false)
      setReorderDraft(null)
      setDraggingId(null)
      setDropOverId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reorderMode])

  if (!slug || !project) {
    return <Navigate to="/projects" replace />
  }

  const tags = project.tags ?? CARD_FALLBACK_TAGS
  const { section: cardSection, chipTags: cardChipTags } =
    partitionProjectCardTags(tags)
  const stagesBase = project.stages ?? DEFAULT_PROJECT_STAGES
  const displayStages =
    reorderMode && reorderDraft !== null ? reorderDraft : stagesBase
  const linkedClient = project.clientId
    ? getClientById(project.clientId)
    : undefined
  const detailStage = selectedStage
    ? (displayStages.find((s) => s.id === selectedStage.id) ?? selectedStage)
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
        <section className="order-2 flex min-w-0 flex-1 flex-col gap-11 rounded-[3px] border border-[rgba(10,10,10,0.32)] p-5 xl:order-1">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em]">
              Этапы проекта
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={reorderMode}
                className="h-8 shrink-0 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setStageModalOpen(true)}
              >
                Создать этап
              </button>
              <button
                type="button"
                className={
                  reorderMode
                    ? 'h-8 shrink-0 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90'
                    : 'h-8 shrink-0 rounded-full border border-card-border px-5 text-sm font-light tracking-[-0.04em] text-ink transition-colors hover:bg-ink/[0.04]'
                }
                onClick={() => {
                  if (reorderMode) {
                    if (reorderDraft) reorderProjectStages(slug, reorderDraft)
                    setReorderMode(false)
                    setReorderDraft(null)
                    setDraggingId(null)
                    setDropOverId(null)
                  } else {
                    setSelectedStage(null)
                    setReorderDraft([...stagesBase])
                    setReorderMode(true)
                  }
                }}
              >
                {reorderMode ? 'Сохранить' : 'Редактировать'}
              </button>
            </div>
          </div>
          <div
            className="flex flex-col gap-3"
            onDragEnd={() => {
              setDraggingId(null)
              setDropOverId(null)
            }}
          >
            {displayStages.map((s) => (
              <StageRow
                key={s.id}
                stage={s}
                reorderMode={reorderMode}
                isDragging={draggingId === s.id}
                isDropTarget={dropOverId === s.id}
                onOpen={setSelectedStage}
                onDragStartReorder={() => setDraggingId(s.id)}
                onDragOverReorder={() => setDropOverId(s.id)}
                onDropReorder={(dragId) => {
                  setReorderDraft((d) =>
                    d ? reorderStagesBeforeTarget(d, dragId, s.id) : d,
                  )
                }}
              />
            ))}
            {reorderMode ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDropOverId('__end__')
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const dragId = e.dataTransfer.getData(STAGE_DND_TYPE)
                  if (!dragId) return
                  setReorderDraft((d) =>
                    d ? reorderStagesToEnd(d, dragId) : d,
                  )
                  setDraggingId(null)
                  setDropOverId(null)
                }}
                className={`flex min-h-10 items-center justify-center rounded-[3px] border border-dashed px-3 py-2 text-center text-[11px] font-light uppercase tracking-[-0.02em] text-ink/55 transition-colors ${
                  dropOverId === '__end__'
                    ? 'border-ink/35 bg-ink/[0.04] text-ink/75'
                    : 'border-ink/15'
                }`}
              >
                В конец списка
              </div>
            ) : null}
          </div>
        </section>

        <aside className="order-1 w-full shrink-0 rounded-[3px] border border-[rgba(10,10,10,0.32)] p-5 xl:order-2 xl:max-w-[445px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 flex flex-col gap-3">
              <h2 className="text-[24px] font-light leading-[0.9] tracking-[-0.06em] sm:tracking-[-0.09em]">
                {project.title}
              </h2>
              <p className="text-[14px] font-light leading-[0.9] tracking-[-0.06em] sm:tracking-[-0.09em]">
                {project.client}
              </p>
            </div>
            {cardSection ? (
              <span className="max-w-[45%] shrink-0 pt-0.5 text-right text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/65">
                {cardSection}
              </span>
            ) : null}
          </div>
          <div className="mt-6 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {cardChipTags.map((label, i) => (
                  <span
                    key={`${label}-${i}`}
                    className={projectCardTagChipClass(label)}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <span className="shrink-0 text-base font-light leading-[0.9] tracking-[-0.06em] sm:tracking-[-0.09em]">
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
          {project.comment?.trim() ? (
            <div className="mt-6 border-t border-[rgba(10,10,10,0.15)] pt-6">
              <h3 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
                Комментарий
              </h3>
              <div className="mt-3 text-sm font-light leading-relaxed tracking-[-0.02em] text-ink/85">
                <AutolinkText
                  text={project.comment.trim()}
                  className="whitespace-pre-wrap break-words"
                />
              </div>
            </div>
          ) : null}
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
        onDelete={() => removeProjectStage(slug, detailStage.id)}
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
        stagedPaymentPreviewStages={project.stages}
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
