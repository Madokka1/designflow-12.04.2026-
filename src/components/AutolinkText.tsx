import { Fragment, useMemo } from 'react'
import { parseAutolinkSegments } from '../lib/autolinkSegments'

type Props = {
  text: string
  className?: string
  linkClassName?: string
}

/** Текст с автоматическими ссылками для http(s) URL. */
export function AutolinkText({ text, className, linkClassName }: Props) {
  const segments = useMemo(() => parseAutolinkSegments(text), [text])
  const linkCls =
    linkClassName ??
    'break-all underline underline-offset-[3px] decoration-ink/35 hover:decoration-ink'

  return (
    <span className={className}>
      {segments.map((s, i) =>
        s.kind === 'link' ? (
          <a
            key={i}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
          >
            {s.text}
          </a>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </span>
  )
}
