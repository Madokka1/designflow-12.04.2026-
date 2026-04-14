import { useEffect, useRef } from 'react'
import { createEmptyBlock, newBlockId } from '../../context/notesContext'
import type { NoteBlock, NoteBlockType } from '../../types/note'

export type MenuAnchor = { top: number; left: number; width: number }

type Props = {
  anchor: MenuAnchor
  onClose: () => void
  onPick: (block: NoteBlock) => void
}

function buildBlock(
  type: NoteBlockType,
  opts?: { language?: 'html' | 'css' | 'js'; text?: string },
): NoteBlock {
  const b = createEmptyBlock(type)
  if (opts?.language) return { ...b, language: opts.language }
  if (opts?.text != null) return { ...b, text: opts.text }
  return b
}

const AI_SECTION = {
  title: 'ИИ помощник',
  badge: 'Beta',
  items: [
    {
      id: 'brainstorm',
      label: 'Мозговой штурм',
      hint: 'Мозговой шту…',
      icon: '✎',
      block: () =>
        buildBlock('todo'),
    },
    {
      id: 'article',
      label: 'Статья или пост',
      hint: 'Статья или пост',
      icon: '✎',
      block: () =>
        buildBlock('todo'),
    },
  ],
}

const BASIC_SECTION = {
  title: 'Базовые',
  items: [
    {
      id: 'todo',
      label: 'Список задач',
      hint: 'Список задач',
      icon: '☑',
      block: () => buildBlock('todo'),
    },
  ],
}

const CODE_SECTION = {
  title: 'Код',
  items: [
    {
      id: 'html',
      label: '<div>',
      hint: 'HTML',
      icon: '</>',
      block: () => buildBlock('code', { language: 'html' }),
    },
    {
      id: 'css',
      label: '<style>',
      hint: 'CSS',
      icon: '#',
      block: () => buildBlock('code', { language: 'css' }),
    },
    {
      id: 'js',
      label: '<script>',
      hint: 'JS',
      icon: '{ }',
      block: () => buildBlock('code', { language: 'js' }),
    },
  ],
}

const MEDIA_SECTION = {
  title: 'Медиа и ссылки',
  items: [
    {
      id: 'link',
      label: 'Ссылка',
      hint: 'URL',
      icon: '🔗',
      block: () => buildBlock('link'),
    },
    {
      id: 'image',
      label: 'Изображение',
      hint: 'IMG',
      icon: '▣',
      block: () => buildBlock('image'),
    },
    {
      id: 'video',
      label: 'Видео',
      hint: 'Video',
      icon: '▶',
      block: () => buildBlock('video'),
    },
  ],
}

const SECTIONS = [
  AI_SECTION,
  BASIC_SECTION,
  CODE_SECTION,
  MEDIA_SECTION,
]

export function BlockInsertMenu({ anchor, onClose, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const panelBorder = 'border-card-border'
  const iconBox =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded border border-card-border text-[11px] font-light text-ink/55'

  return (
    <div
      ref={ref}
      className={`fixed z-[90] max-h-[min(420px,70vh)] w-[min(100vw-2rem,380px)] overflow-y-auto rounded-lg border ${panelBorder} bg-surface/95 py-2 shadow-[0_8px_32px_rgba(10,10,10,0.08)] backdrop-blur-[20px] dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]`}
      style={{
        top: anchor.top + 6,
        left: Math.min(anchor.left, window.innerWidth - 380 - 16),
      }}
      role="listbox"
    >
      {SECTIONS.map((section) => (
        <div key={section.title} className="px-2 pb-2 pt-1">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
              {section.title}
            </span>
            {'badge' in section &&
            typeof section.badge === 'string' &&
            section.badge ? (
              <span
                className={`rounded border ${panelBorder} bg-ink/[0.04] px-1.5 py-px text-[10px] font-light tracking-[-0.02em] text-ink/80`}
              >
                {section.badge}
              </span>
            ) : null}
          </div>
          {section.items.map((item, idx) => (
            <button
              key={item.id + String(idx)}
              type="button"
              role="option"
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm font-light tracking-[-0.02em] text-ink transition-colors hover:bg-ink/[0.04]"
              onClick={() => {
                const block = item.block()
                onPick({ ...block, id: newBlockId() })
              }}
            >
              <span className={iconBox}>{item.icon}</span>
              <span className="min-w-0 flex-1 truncate text-ink">
                {item.label}
              </span>
              <span className="shrink-0 text-xs font-light text-ink/45">
                {item.hint}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
