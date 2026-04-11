import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreateProjectModal } from '../components/CreateProjectModal'
import { getProjectSection } from '../lib/projectSection'
import { useProjects } from '../hooks/useProjects'
import type { Project } from '../types/project'

const FILTERS = [
  'Все',
  'Активные',
  'Архив',
  'Разработка',
  'Поддержка',
  'Личные',
] as const

const CARD_FALLBACK_TAGS = ['Ожидает оплаты', 'В работе', 'Разработка'] as const

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.slug}`}
      className="block text-left outline-none ring-ink transition-shadow duration-300 focus-visible:ring-2"
    >
      <article className="flex min-h-[220px] flex-col justify-between border border-[rgba(10,10,10,0.32)] p-5 transition-[background-color,transform,box-shadow] duration-300 ease-out motion-reduce:transition-colors hover:bg-ink/[0.02] hover:shadow-[0_12px_40px_-24px_rgba(10,10,10,0.35)] motion-reduce:hover:shadow-none hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
        <div className="flex flex-col gap-3">
          <h3 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em]">
            {project.title}
          </h3>
          <p className="text-base font-light leading-[0.9] tracking-[-0.09em] text-ink/90">
            {project.client}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-5">
              {(project.tags ?? CARD_FALLBACK_TAGS).map((label, i) => (
                <span
                  key={`${label}-${i}`}
                  className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink"
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
              className="h-full rounded-full bg-ink transition-[width] duration-500"
              style={{ width: `${project.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-light uppercase leading-none tracking-[-0.02em]">
            <span>дедлайн: {project.deadline}</span>
            <span>{project.progress}%</span>
          </div>
        </div>
      </article>
    </Link>
  )
}

export function ProjectsPage() {
  const { projects, addProject, addProjectFromTemplate, templates, clients } =
    useProjects()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Активные')
  const [createOpen, setCreateOpen] = useState(false)

  const filteredProjects = useMemo(() => {
    if (filter === 'Все') return projects
    if (filter === 'Активные') return projects.filter((p) => !p.archived)
    if (filter === 'Архив') return projects.filter((p) => p.archived)
    return projects.filter(
      (p) => !p.archived && getProjectSection(p) === filter,
    )
  }, [projects, filter])

  return (
    <>
      <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
        <h1 className="max-w-[357px] text-[clamp(2.5rem,6vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]">
          Проекты
        </h1>

        <div className="mt-10 flex flex-col gap-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-end gap-5 lg:gap-8">
              {FILTERS.map((label) => {
                const active = label === filter
                return (
                  <button
                    key={label}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setFilter(label)}
                    className="group flex flex-col items-center gap-px"
                  >
                    <span
                      className={`text-base transition-colors duration-200 ${
                        active ? 'font-normal text-ink' : 'font-normal text-ink/70'
                      }`}
                    >
                      {label}
                    </span>
                    <span
                      className={`h-px w-full origin-center scale-x-0 bg-ink transition-transform duration-200 ease-out group-hover:scale-x-100 ${
                        active ? 'scale-x-100' : ''
                      }`}
                      aria-hidden
                    />
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="h-8 shrink-0 self-start rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100 lg:self-auto"
              onClick={() => setCreateOpen(true)}
            >
              Создать проект
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {filteredProjects.length === 0 ? (
              <p className="col-span-full text-base font-light text-ink/60">
                Нет проектов в этом разделе
              </p>
            ) : (
              filteredProjects.map((p) => <ProjectCard key={p.id} project={p} />)
            )}
          </div>
        </div>
      </main>

      {createOpen ? (
        <CreateProjectModal
          onClose={() => setCreateOpen(false)}
          templates={templates}
          clients={clients}
          onCreate={(data, templateId) => {
            if (templateId) addProjectFromTemplate(data, templateId)
            else addProject(data)
          }}
        />
      ) : null}
    </>
  )
}
