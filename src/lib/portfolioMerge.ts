import type { Project } from '../types/project'

/** Слияние по `id`: новые записи — в начало, существующие — замена по id. */
export function mergeRecordsById<T extends { id: string }>(
  prev: readonly T[],
  incoming: readonly T[],
): T[] {
  const byId = new Map(prev.map((x) => [x.id, x]))
  const order = prev.map((x) => x.id)
  const seen = new Set(order)
  for (const x of incoming) {
    if (!seen.has(x.id)) {
      order.unshift(x.id)
      seen.add(x.id)
    }
    byId.set(x.id, x)
  }
  return order.map((id) => byId.get(id)!)
}

/** Слияние проектов по `slug`. */
export function mergeProjectsBySlug(
  prev: readonly Project[],
  incoming: readonly Project[],
): Project[] {
  const bySlug = new Map(prev.map((p) => [p.slug, p]))
  const order = prev.map((p) => p.slug)
  const seen = new Set(order)
  for (const p of incoming) {
    if (!seen.has(p.slug)) {
      order.unshift(p.slug)
      seen.add(p.slug)
    }
    bySlug.set(p.slug, p)
  }
  return order.map((slug) => bySlug.get(slug)!)
}
