/** Транслитерация + правило «проект №1» → `project1` (как в примере). */

const CYR_TO_LAT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

function transliterate(input: string): string {
  return [...input.toLowerCase()]
    .map((ch) => CYR_TO_LAT[ch] ?? ch)
    .join('')
}

/**
 * Сегмент пути из названия: «проект№1» → `project1`, остальное — латиница без пробелов.
 */
export function titleToPathSegment(title: string): string {
  let t = title.trim().toLowerCase()
  t = t.replace(/№/g, '')
  t = t.replace(/^проект\s*/, 'project')
  t = transliterate(t)
  t = t.replace(/[^a-z0-9]+/g, '')
  if (!t) t = 'project'
  return t
}

export function uniqueSlug(title: string, taken: ReadonlySet<string>): string {
  const base = titleToPathSegment(title)
  let slug = base
  let n = 2
  while (taken.has(slug)) {
    slug = `${base}-${n}`
    n += 1
  }
  return slug
}
