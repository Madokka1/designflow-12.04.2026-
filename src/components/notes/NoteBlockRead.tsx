import type { NoteBlock, NoteTodoItem } from '../../types/note'
import { VideoEmbed } from './VideoEmbed'

function TodoRead({ item }: { item: NoteTodoItem }) {
  return (
    <div className="flex items-start gap-2.5 py-0.5">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 border border-ink ${item.done ? 'bg-ink' : ''}`}
        aria-hidden
      />
      <span
        className={`text-base font-light leading-[1.4] tracking-[-0.09em] text-ink ${
          item.done ? 'text-ink/45 line-through' : ''
        }`}
      >
        {item.label || '—'}
      </span>
    </div>
  )
}

export function NoteBlockRead({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case 'h1':
      return (
        <h3 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em] text-ink">
          {block.text || '\u00a0'}
        </h3>
      )
    case 'h2':
      return (
        <h4 className="text-[28px] font-light leading-[0.9] tracking-[-0.09em] text-ink">
          {block.text || '\u00a0'}
        </h4>
      )
    case 'h3':
      return (
        <h5 className="text-2xl font-light leading-[0.9] tracking-[-0.09em] text-ink">
          {block.text || '\u00a0'}
        </h5>
      )
    case 'h4':
      return (
        <h6 className="text-xl font-light leading-[0.9] tracking-[-0.09em] text-ink">
          {block.text || '\u00a0'}
        </h6>
      )
    case 'h5':
      return (
        <p className="text-lg font-light leading-[0.9] tracking-[-0.09em] text-ink">
          {block.text || '\u00a0'}
        </p>
      )
    case 'h6':
      return (
        <p className="text-base font-light leading-[0.9] tracking-[-0.09em] text-ink">
          {block.text || '\u00a0'}
        </p>
      )
    case 'paragraph':
      if (!block.text.trim()) return <div className="min-h-[0.5rem]" aria-hidden />
      return (
        <p className="whitespace-pre-wrap text-base font-light leading-[1.45] tracking-[-0.09em] text-ink">
          {block.text}
        </p>
      )
    case 'todo':
      return (
        <ul className="list-none space-y-1 py-1 pl-0">
          {(block.todos ?? []).map((t) => (
            <li key={t.id}>
              <TodoRead item={t} />
            </li>
          ))}
        </ul>
      )
    case 'code':
      return (
        <pre className="overflow-x-auto rounded border border-[rgba(10,10,10,0.15)] bg-[rgba(10,10,10,0.06)] p-4 font-mono text-sm leading-relaxed text-ink">
          <code>{block.text || '\u00a0'}</code>
        </pre>
      )
    case 'link': {
      const href = (block.href ?? '').trim() || '#'
      return (
        <p className="py-1 text-base font-light tracking-[-0.09em]">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
          >
            {block.text || href}
          </a>
        </p>
      )
    }
    case 'image': {
      const src = (block.href ?? '').trim()
      if (!src) {
        return (
          <p className="text-sm font-light text-ink/40">Изображение не задано</p>
        )
      }
      return (
        <figure className="my-2">
          <img
            src={src}
            alt={block.text || ''}
            className="max-h-[min(70vh,520px)] w-full rounded border border-[rgba(10,10,10,0.12)] object-contain"
          />
          {block.text ? (
            <figcaption className="mt-2 text-center text-sm font-light text-ink/65">
              {block.text}
            </figcaption>
          ) : null}
        </figure>
      )
    }
    case 'video': {
      const vurl = (block.href ?? '').trim()
      return (
        <div className="flex flex-col gap-2 py-1">
          {block.text ? (
            <p className="text-sm font-light text-ink/70">{block.text}</p>
          ) : null}
          {vurl ? (
            <VideoEmbed url={vurl} />
          ) : (
            <p className="text-sm font-light text-ink/40">Видео не задано</p>
          )}
        </div>
      )
    }
    default:
      return null
  }
}
