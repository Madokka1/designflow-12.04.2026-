/**
 * Общий вид «подчёркнутого» поля: граница и плейсхолдер из CSS-переменных темы
 * (`--color-form-border`, `--color-form-placeholder` в index.css).
 */
export const formInputUnderlineClass =
  'w-full border-0 border-b border-[var(--color-form-border)] bg-transparent py-2.5 text-base font-light leading-[0.9] tracking-[-0.09em] text-ink outline-none placeholder:text-[var(--color-form-placeholder)] focus:border-ink/50'

/** Граница разделителя модалок (сочетать с `border-l`, `border-b`, `border-t`). */
export const modalEdgeBorderClass = 'border-[var(--color-modal-edge)]'
