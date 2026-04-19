import type { PortfolioResume } from '../../types/resume'

const BORDER = 'border-card-border'
const SECTION_DIVIDER = 'mt-8 border-t border-[rgba(10,10,10,0.15)] pt-6 dark:border-white/10'

export function ResumePreview({ data }: { data: PortfolioResume }) {
  return (
    <div className={`w-full min-w-0 rounded-[3px] border ${BORDER} p-5 sm:p-10`}>
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
        {data.photoDataUrl ? (
          <div className="mx-auto shrink-0 sm:mx-0">
            <img
              src={data.photoDataUrl}
              alt=""
              className="h-40 w-40 rounded-[3px] object-cover sm:h-44 sm:w-44"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em] text-ink">
            {data.fullName.trim() || 'Имя и фамилия'}
          </h2>
          {data.headline.trim() ? (
            <p className="mt-3 text-base font-light leading-[1.35] tracking-[-0.09em] text-ink/85">
              {data.headline}
            </p>
          ) : null}
          {data.location.trim() ? (
            <p className="mt-2 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/55">
              {data.location}
            </p>
          ) : null}
          {(data.contactEmail || data.contactPhone || data.contactLinks) && (
            <div className="mt-5 flex flex-col gap-1 text-base font-light leading-[1.35] tracking-[-0.09em] text-ink/85">
              {data.contactEmail.trim() ? (
                <a className="underline-offset-4 hover:underline" href={`mailto:${data.contactEmail}`}>
                  {data.contactEmail}
                </a>
              ) : null}
              {data.contactPhone.trim() ? (
                <a className="underline-offset-4 hover:underline" href={`tel:${data.contactPhone}`}>
                  {data.contactPhone}
                </a>
              ) : null}
              {data.contactLinks.trim() ? (
                <p className="whitespace-pre-wrap break-words">{data.contactLinks}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {data.summary.trim() ? (
        <section className={SECTION_DIVIDER}>
          <h3 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
            О себе
          </h3>
          <p className="mt-3 whitespace-pre-wrap break-words text-base font-light leading-[1.35] tracking-[-0.09em] text-ink/85">
            {data.summary}
          </p>
        </section>
      ) : null}

      {data.skills.length > 0 ? (
        <section className={SECTION_DIVIDER}>
          <h3 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
            Навыки
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.skills.map((s) => (
              <li
                key={s.id}
                className="rounded-full border border-[rgba(10,10,10,0.15)] px-3 py-1 text-sm font-light tracking-[-0.02em] text-ink dark:border-white/15"
              >
                {s.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.personalQualities.length > 0 ? (
        <section className={SECTION_DIVIDER}>
          <h3 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
            Личные качества
          </h3>
          <ul className="mt-3 list-inside list-disc space-y-1 text-base font-light leading-[1.35] tracking-[-0.09em] text-ink/85">
            {data.personalQualities.map((q, i) => (
              <li key={`${q}-${i}`}>{q}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.cases.length > 0 ? (
        <section className={SECTION_DIVIDER}>
          <h3 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
            Кейсы
          </h3>
          <ul className="mt-4 flex flex-col gap-5">
            {data.cases.map((c) => (
              <li key={c.id} className={`rounded-[3px] border ${BORDER} p-4 sm:p-5`}>
                <p className="text-[32px] font-light leading-[0.9] tracking-[-0.09em] text-ink">{c.title}</p>
                {c.role.trim() ? (
                  <p className="mt-2 text-base font-light leading-[1.35] tracking-[-0.09em] text-ink/85">
                    {c.role}
                  </p>
                ) : null}
                {c.stack.trim() ? (
                  <p className="mt-2 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/55">
                    {c.stack}
                  </p>
                ) : null}
                {c.description.trim() ? (
                  <p className="mt-3 whitespace-pre-wrap break-words text-base font-light leading-[1.35] tracking-[-0.09em] text-ink/85">
                    {c.description}
                  </p>
                ) : null}
                {c.url.trim() ? (
                  <a
                    href={c.url.startsWith('http') ? c.url : `https://${c.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 hover:underline"
                  >
                    Ссылка
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.education.length > 0 ? (
        <section className={SECTION_DIVIDER}>
          <h3 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
            Образование
          </h3>
          <ul className="mt-4 flex flex-col gap-4">
            {data.education.map((e) => (
              <li key={e.id}>
                <p className="text-base font-light leading-[1.35] tracking-[-0.09em] text-ink">{e.institution}</p>
                {e.degree.trim() ? (
                  <p className="mt-0.5 text-sm font-light tracking-[-0.02em] text-ink/70">{e.degree}</p>
                ) : null}
                {e.period.trim() ? (
                  <p className="mt-0.5 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/55">
                    {e.period}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.languages.length > 0 ? (
        <section className={SECTION_DIVIDER}>
          <h3 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
            Языки
          </h3>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-base font-light leading-[1.35] tracking-[-0.09em] text-ink/85">
            {data.languages.map((l) => (
              <li key={l.id}>
                {l.name}
                {l.level.trim() ? (
                  <span className="text-ink/45"> — {l.level}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
