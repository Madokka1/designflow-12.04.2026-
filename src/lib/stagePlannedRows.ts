/** Разбивает строку planned («A · B · C») на отдельные строки для вёрстки */
export function stagePlannedRows(planned: string): string[] {
  const t = planned.trim()
  if (!t) return []
  if (!t.includes('·')) return [t]
  return t.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean)
}
