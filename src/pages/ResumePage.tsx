import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageTabButton, PageTabList } from '../components/PageTabs'
import { ResumeEditor } from '../components/resume/ResumeEditor'
import { ResumePreview } from '../components/resume/ResumePreview'
import { usePortfolioResume } from '../hooks/usePortfolioResume'

export function ResumePage() {
  const { data, setData, readOnly } = usePortfolioResume()
  const [preview, setPreview] = useState(false)

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-[487px] flex-col gap-5">
          <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]">
            Резюме
          </h1>
          <p className="line-clamp-2 text-[32px] font-light leading-[0.9] tracking-[-0.09em] text-ink/80">
            Портфолио и опыт в одном месте
          </p>
        </div>
        <PageTabList role="tablist" aria-label="Режим резюме">
          <PageTabButton selected={!preview} onClick={() => setPreview(false)}>
            Редактор
          </PageTabButton>
          <PageTabButton selected={preview} onClick={() => setPreview(true)}>
            Предпросмотр
          </PageTabButton>
        </PageTabList>
      </div>

      {readOnly ? (
        <p className="mt-6 max-w-[40rem] text-base font-light text-ink/60">
          Включён режим только чтения: резюме можно просматривать, но не сохранять изменения в этом
          браузере.
        </p>
      ) : null}

      <div className="mt-8 flex w-full min-w-0 flex-col gap-10">
        {preview ? (
          <ResumePreview data={data} />
        ) : (
          <ResumeEditor data={data} onChange={setData} readOnly={readOnly} />
        )}
      </div>

      <Link
        to="/"
        className="mt-12 inline-flex text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 hover:underline"
      >
        ← На обзор
      </Link>
    </main>
  )
}
