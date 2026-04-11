import type { Project } from '../types/project'
import { PROJECT_SECTIONS } from '../types/projectForm'

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
