import type { Project } from '../types/project'
import { PROJECT_SECTIONS } from '../types/projectForm'

const SECTION_SET = new Set<string>(PROJECT_SECTIONS as readonly string[])

/**
 * Последний тег из списка разделов (в данных обычно [статус, оплата, раздел]) —
 * выносим в угол карточки; остальное показываем чипами.
 */
export function partitionProjectCardTags(tags: readonly string[]): {
  section: string | undefined
  chipTags: string[]
} {
  let section: string | undefined
  for (let i = tags.length - 1; i >= 0; i--) {
    if (SECTION_SET.has(tags[i])) {
      section = tags[i]
      break
    }
  }
  const chipTags = section ? tags.filter((t) => t !== section) : [...tags]
  return { section, chipTags }
}

/** Раздел из тегов проекта (как в форме: «Раздел»). */
export function getProjectSection(
  p: Project,
): (typeof PROJECT_SECTIONS)[number] | null {
  for (const tag of p.tags ?? []) {
    if ((PROJECT_SECTIONS as readonly string[]).includes(tag)) {
      return tag as (typeof PROJECT_SECTIONS)[number]
    }
  }
  return null
}
