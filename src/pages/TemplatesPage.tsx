import { Link } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { useSettings } from '../hooks/useSettings'
import { accentButtonStyle } from '../lib/pickContrastText'

export function TemplatesPage() {
  const { settings } = useSettings()
  const { templates, deleteTemplate } = useProjects()

  const sorted = [...templates].sort((a, b) =>
    a.name.localeCompare(b.name, 'ru'),
  )

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-light leading-[0.9] tracking-[-0.06em]">
        Шаблоны проектов
      </h1>
      <p className="mt-2 max-w-2xl text-sm font-light text-ink/60">
        Создать проект из шаблона можно на странице{' '}
        <Link to="/projects" className="underline underline-offset-2">
          Проекты
        </Link>
        — кнопка «Создать проект» и выбор шаблона в форме. Шаблон сохраняется из
        карточки проекта.
      </p>

      <ul className="mt-10 flex max-w-3xl flex-col gap-4">
        {sorted.length === 0 ? (
          <li className="text-sm font-light text-ink/50">Пока нет шаблонов</li>
        ) : (
          sorted.map((tpl) => (
            <li
              key={tpl.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-card-border px-5 py-4"
            >
              <div>
                <p className="text-base font-light">{tpl.name}</p>
                <p className="mt-1 text-xs font-light text-ink/50">
                  Этапов: {tpl.stages.length}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/projects"
                  className="inline-flex h-8 items-center rounded-full px-4 text-sm font-light"
                  style={accentButtonStyle(settings.accentColor)}
                >
                  К проектам
                </Link>
                <button
                  type="button"
                  className="h-8 rounded-full border border-card-border px-4 text-sm font-light text-ink/70"
                  onClick={() => {
                    if (window.confirm(`Удалить шаблон «${tpl.name}»?`)) {
                      deleteTemplate(tpl.id)
                    }
                  }}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  )
}
