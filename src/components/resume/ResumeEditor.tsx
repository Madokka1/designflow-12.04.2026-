import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { formInputUnderlineClass } from '../../lib/formInputClasses'
import { imageFileToDataUrl, newResumeRowId } from '../../lib/resumeStorage'
import type { PortfolioResume } from '../../types/resume'

const textareaClass = `${formInputUnderlineClass} min-h-[120px] resize-y`
const BORDER = 'border-card-border'

type Props = {
  data: PortfolioResume
  onChange: (next: PortfolioResume) => void
  readOnly: boolean
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
      {children}
    </span>
  )
}

export function ResumeEditor({ data, onChange, readOnly }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [draftSkill, setDraftSkill] = useState('')
  const [draftQuality, setDraftQuality] = useState('')

  const patch = useCallback(
    (partial: Partial<PortfolioResume>) => {
      onChange({ ...data, ...partial })
    },
    [data, onChange],
  )

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    try {
      const url = await imageFileToDataUrl(f)
      if (url) patch({ photoDataUrl: url })
    } catch {
      /* ignore */
    }
  }

  const btnGhost =
    'h-8 shrink-0 rounded-full border border-[rgba(10,10,10,0.32)] px-4 text-sm font-light tracking-[-0.05em] text-ink transition-opacity hover:bg-ink/[0.04] disabled:opacity-40'
  const btnDanger =
    'h-8 shrink-0 rounded-full border border-red-800/25 px-3 text-xs font-light text-red-900/90 transition-opacity hover:bg-red-500/10 disabled:opacity-40 dark:border-red-400/30 dark:text-red-200'

  return (
    <div className="flex w-full min-w-0 flex-col gap-10">
      <section className={`rounded-[3px] border ${BORDER} p-5 sm:p-6`}>
        <h2 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
          Фото и шапка
        </h2>
        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3 sm:items-start">
            {data.photoDataUrl ? (
              <img
                src={data.photoDataUrl}
                alt=""
                className="h-36 w-36 rounded-[3px] object-cover sm:h-40 sm:w-40"
              />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-[3px] border border-dashed border-ink/20 text-center text-xs font-light text-ink/40 sm:h-40 sm:w-40">
                Нет фото
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <button type="button" className={btnGhost} disabled={readOnly} onClick={() => fileRef.current?.click()}>
                {data.photoDataUrl ? 'Заменить' : 'Загрузить фото'}
              </button>
              {data.photoDataUrl ? (
                <button
                  type="button"
                  className={btnDanger}
                  disabled={readOnly}
                  onClick={() => patch({ photoDataUrl: '' })}
                >
                  Убрать
                </button>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <label className="block">
              <FieldLabel>Имя и фамилия</FieldLabel>
              <input
                className={formInputUnderlineClass}
                value={data.fullName}
                disabled={readOnly}
                onChange={(e) => patch({ fullName: e.target.value })}
                placeholder="Иван Иванов"
              />
            </label>
            <label className="block">
              <FieldLabel>Должность / специализация</FieldLabel>
              <input
                className={formInputUnderlineClass}
                value={data.headline}
                disabled={readOnly}
                onChange={(e) => patch({ headline: e.target.value })}
                placeholder="Product designer"
              />
            </label>
            <label className="block">
              <FieldLabel>Локация</FieldLabel>
              <input
                className={formInputUnderlineClass}
                value={data.location}
                disabled={readOnly}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="Москва · удалённо"
              />
            </label>
          </div>
        </div>
      </section>

      <section className={`rounded-[3px] border ${BORDER} p-5 sm:p-6`}>
        <h2 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
          Контакты
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-1">
            <FieldLabel>Email</FieldLabel>
            <input
              className={formInputUnderlineClass}
              value={data.contactEmail}
              disabled={readOnly}
              onChange={(e) => patch({ contactEmail: e.target.value })}
              placeholder="you@mail.com"
              inputMode="email"
            />
          </label>
          <label className="block sm:col-span-1">
            <FieldLabel>Телефон</FieldLabel>
            <input
              className={formInputUnderlineClass}
              value={data.contactPhone}
              disabled={readOnly}
              onChange={(e) => patch({ contactPhone: e.target.value })}
              placeholder="+7 …"
            />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Ссылки (по одной в строке)</FieldLabel>
            <textarea
              className={textareaClass}
              value={data.contactLinks}
              disabled={readOnly}
              onChange={(e) => patch({ contactLinks: e.target.value })}
              placeholder={'https://behance.net/…\nhttps://t.me/…'}
              rows={3}
            />
          </label>
        </div>
      </section>

      <section className={`rounded-[3px] border ${BORDER} p-5 sm:p-6`}>
        <h2 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
          О себе
        </h2>
        <label className="mt-5 block">
          <textarea
            className={textareaClass}
            value={data.summary}
            disabled={readOnly}
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder="Кратко: опыт, фокус, что ищете…"
            rows={6}
          />
        </label>
      </section>

      <section className={`rounded-[3px] border ${BORDER} p-5 sm:p-6`}>
        <h2 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
          Навыки
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {data.skills.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-1 rounded-full border border-ink/12 bg-ink/[0.03] py-1 pl-3 pr-1 dark:border-white/12 dark:bg-white/[0.04]"
            >
              <span className="text-sm font-light tracking-[-0.02em]">{s.name}</span>
              <button
                type="button"
                disabled={readOnly}
                className="rounded-full px-2 py-0.5 text-xs text-ink/45 hover:bg-ink/10 hover:text-ink disabled:opacity-30"
                aria-label={`Удалить ${s.name}`}
                onClick={() =>
                  onChange({ ...data, skills: data.skills.filter((x) => x.id !== s.id) })
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className={`${formInputUnderlineClass} min-w-[12rem] flex-1`}
            value={draftSkill}
            disabled={readOnly}
            onChange={(e) => setDraftSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const t = draftSkill.trim()
                if (!t || readOnly) return
                onChange({
                  ...data,
                  skills: [...data.skills, { id: newResumeRowId(), name: t }],
                })
                setDraftSkill('')
              }
            }}
            placeholder="Навык и Enter"
          />
          <button
            type="button"
            className={btnGhost}
            disabled={readOnly || !draftSkill.trim()}
            onClick={() => {
              const t = draftSkill.trim()
              if (!t) return
              onChange({
                ...data,
                skills: [...data.skills, { id: newResumeRowId(), name: t }],
              })
              setDraftSkill('')
            }}
          >
            Добавить
          </button>
        </div>
      </section>

      <section className={`rounded-[3px] border ${BORDER} p-5 sm:p-6`}>
        <h2 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
          Личные качества
        </h2>
        <ul className="mt-4 flex flex-col gap-1">
          {data.personalQualities.map((q, i) => (
            <li key={`${q}-${i}`} className="flex items-center gap-2 text-sm font-light">
              <span className="min-w-0 flex-1">{q}</span>
              <button
                type="button"
                disabled={readOnly}
                className="shrink-0 text-ink/40 hover:text-ink disabled:opacity-30"
                aria-label="Удалить"
                onClick={() =>
                  onChange({
                    ...data,
                    personalQualities: data.personalQualities.filter((_, j) => j !== i),
                  })
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className={`${formInputUnderlineClass} min-w-[12rem] flex-1`}
            value={draftQuality}
            disabled={readOnly}
            onChange={(e) => setDraftQuality(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const t = draftQuality.trim()
                if (!t || readOnly) return
                onChange({ ...data, personalQualities: [...data.personalQualities, t] })
                setDraftQuality('')
              }
            }}
            placeholder="Качество и Enter"
          />
          <button
            type="button"
            className={btnGhost}
            disabled={readOnly || !draftQuality.trim()}
            onClick={() => {
              const t = draftQuality.trim()
              if (!t) return
              onChange({ ...data, personalQualities: [...data.personalQualities, t] })
              setDraftQuality('')
            }}
          >
            Добавить
          </button>
        </div>
      </section>

      <section className={`rounded-[3px] border ${BORDER} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
            Кейсы
          </h2>
          <button
            type="button"
            className={btnGhost}
            disabled={readOnly}
            onClick={() =>
              onChange({
                ...data,
                cases: [
                  ...data.cases,
                  {
                    id: newResumeRowId(),
                    title: '',
                    role: '',
                    description: '',
                    url: '',
                    stack: '',
                  },
                ],
              })
            }
          >
            + Кейс
          </button>
        </div>
        <ul className="mt-5 flex flex-col gap-5">
          {data.cases.map((c, idx) => (
            <li key={c.id} className={`rounded-[3px] border ${BORDER} p-4`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
                  Кейс {idx + 1}
                </span>
                <button
                  type="button"
                  className={btnDanger}
                  disabled={readOnly}
                  onClick={() =>
                    onChange({ ...data, cases: data.cases.filter((x) => x.id !== c.id) })
                  }
                >
                  Удалить кейс
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <FieldLabel>Название</FieldLabel>
                  <input
                    className={formInputUnderlineClass}
                    value={c.title}
                    disabled={readOnly}
                    onChange={(e) => {
                      const cases = data.cases.map((x) =>
                        x.id === c.id ? { ...x, title: e.target.value } : x,
                      )
                      onChange({ ...data, cases })
                    }}
                    placeholder="Редизайн личного кабинета"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel>Роль</FieldLabel>
                  <input
                    className={formInputUnderlineClass}
                    value={c.role}
                    disabled={readOnly}
                    onChange={(e) => {
                      const cases = data.cases.map((x) =>
                        x.id === c.id ? { ...x, role: e.target.value } : x,
                      )
                      onChange({ ...data, cases })
                    }}
                    placeholder="UX, прототипы"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel>Стек / инструменты</FieldLabel>
                  <input
                    className={formInputUnderlineClass}
                    value={c.stack}
                    disabled={readOnly}
                    onChange={(e) => {
                      const cases = data.cases.map((x) =>
                        x.id === c.id ? { ...x, stack: e.target.value } : x,
                      )
                      onChange({ ...data, cases })
                    }}
                    placeholder="Figma, React…"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel>Описание</FieldLabel>
                  <textarea
                    className={textareaClass}
                    value={c.description}
                    disabled={readOnly}
                    onChange={(e) => {
                      const cases = data.cases.map((x) =>
                        x.id === c.id ? { ...x, description: e.target.value } : x,
                      )
                      onChange({ ...data, cases })
                    }}
                    placeholder="Задача, решение, результат…"
                    rows={4}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel>Ссылка</FieldLabel>
                  <input
                    className={formInputUnderlineClass}
                    value={c.url}
                    disabled={readOnly}
                    onChange={(e) => {
                      const cases = data.cases.map((x) =>
                        x.id === c.id ? { ...x, url: e.target.value } : x,
                      )
                      onChange({ ...data, cases })
                    }}
                    placeholder="https://…"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={`rounded-[3px] border ${BORDER} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
            Образование
          </h2>
          <button
            type="button"
            className={btnGhost}
            disabled={readOnly}
            onClick={() =>
              onChange({
                ...data,
                education: [
                  ...data.education,
                  {
                    id: newResumeRowId(),
                    institution: '',
                    degree: '',
                    period: '',
                  },
                ],
              })
            }
          >
            + Запись
          </button>
        </div>
        <ul className="mt-5 flex flex-col gap-5">
          {data.education.map((e, idx) => (
            <li key={e.id} className={`rounded-[3px] border ${BORDER} p-4`}>
              <div className="mb-3 flex justify-between gap-2">
                <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
                  Запись {idx + 1}
                </span>
                <button
                  type="button"
                  className={btnDanger}
                  disabled={readOnly}
                  onClick={() =>
                    onChange({
                      ...data,
                      education: data.education.filter((x) => x.id !== e.id),
                    })
                  }
                >
                  Удалить
                </button>
              </div>
              <div className="grid gap-3">
                <label className="block">
                  <FieldLabel>Учебное заведение</FieldLabel>
                  <input
                    className={formInputUnderlineClass}
                    value={e.institution}
                    disabled={readOnly}
                    onChange={(ev) => {
                      const education = data.education.map((x) =>
                        x.id === e.id ? { ...x, institution: ev.target.value } : x,
                      )
                      onChange({ ...data, education })
                    }}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Специальность / степень</FieldLabel>
                  <input
                    className={formInputUnderlineClass}
                    value={e.degree}
                    disabled={readOnly}
                    onChange={(ev) => {
                      const education = data.education.map((x) =>
                        x.id === e.id ? { ...x, degree: ev.target.value } : x,
                      )
                      onChange({ ...data, education })
                    }}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Период</FieldLabel>
                  <input
                    className={formInputUnderlineClass}
                    value={e.period}
                    disabled={readOnly}
                    onChange={(ev) => {
                      const education = data.education.map((x) =>
                        x.id === e.id ? { ...x, period: ev.target.value } : x,
                      )
                      onChange({ ...data, education })
                    }}
                    placeholder="2018 — 2022"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={`rounded-[3px] border ${BORDER} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
            Языки
          </h2>
          <button
            type="button"
            className={btnGhost}
            disabled={readOnly}
            onClick={() =>
              onChange({
                ...data,
                languages: [
                  ...data.languages,
                  { id: newResumeRowId(), name: '', level: '' },
                ],
              })
            }
          >
            + Язык
          </button>
        </div>
        <ul className="mt-5 flex flex-col gap-4">
          {data.languages.map((l, idx) => (
            <li key={l.id} className="flex flex-wrap items-end gap-3">
              <label className="min-w-[8rem] flex-1">
                <FieldLabel>Язык {idx + 1}</FieldLabel>
                <input
                  className={formInputUnderlineClass}
                  value={l.name}
                  disabled={readOnly}
                  onChange={(ev) => {
                    const languages = data.languages.map((x) =>
                      x.id === l.id ? { ...x, name: ev.target.value } : x,
                    )
                    onChange({ ...data, languages })
                  }}
                  placeholder="Английский"
                />
              </label>
              <label className="min-w-[8rem] flex-1">
                <FieldLabel>Уровень</FieldLabel>
                <input
                  className={formInputUnderlineClass}
                  value={l.level}
                  disabled={readOnly}
                  onChange={(ev) => {
                    const languages = data.languages.map((x) =>
                      x.id === l.id ? { ...x, level: ev.target.value } : x,
                    )
                    onChange({ ...data, languages })
                  }}
                  placeholder="B2"
                />
              </label>
              <button
                type="button"
                className={btnDanger}
                disabled={readOnly}
                onClick={() =>
                  onChange({
                    ...data,
                    languages: data.languages.filter((x) => x.id !== l.id),
                  })
                }
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
        Изменения сохраняются автоматически в этом браузере{readOnly ? ' (режим только чтения).' : '.'}
      </p>
    </div>
  )
}
