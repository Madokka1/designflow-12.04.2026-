import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

/**
 * Нижняя линия и ряд вкладок — тот же паттерн, что «Общее / Безопасность» в SettingsPage.
 */
export function PageTabList({
  children,
  className = '',
  ...rest
}: {
  children: ReactNode
  className?: string
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-wrap gap-1 border-b border-card-border ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  )
}

type PageTabButtonProps = {
  selected: boolean
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>

export function PageTabButton({
  selected,
  className = '',
  ...rest
}: PageTabButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      role="tab"
      aria-selected={selected}
      className={`relative -mb-px border-b-2 px-3 py-2.5 text-sm font-light tracking-[-0.04em] transition-colors duration-200 ${
        selected
          ? 'border-ink text-ink'
          : 'border-transparent text-ink/55 hover:text-ink/80'
      } ${className}`.trim()}
    />
  )
}
