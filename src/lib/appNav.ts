/** Единый список разделов приложения (шапка, полноэкранное меню, настройки быстрых ссылок). */
export const APP_NAV_ITEMS = [
  { label: 'Главная', to: '/' },
  { label: 'Проекты', to: '/projects' },
  { label: 'Задачи', to: '/tasks' },
  { label: 'Клиенты', to: '/clients' },
  { label: 'Шаблоны', to: '/templates' },
  { label: 'Финансы', to: '/finance' },
  { label: 'Календарь', to: '/calendar' },
  { label: 'Сроки', to: '/deadlines' },
  { label: 'Отчёты', to: '/reports' },
  { label: 'Резюме', to: '/resume' },
  { label: 'Заметки', to: '/notes' },
  { label: 'Настройки', to: '/settings' },
] as const

export type AppNavItem = (typeof APP_NAV_ITEMS)[number]
export type AppNavLabel = AppNavItem['label']

const NAV_BY_LABEL = new Map(
  APP_NAV_ITEMS.map((x) => [x.label, x] as const),
)

export function navEntry(label: AppNavLabel): AppNavItem {
  const item = NAV_BY_LABEL.get(label)
  if (!item) throw new Error(`Unknown nav label: ${label}`)
  return item
}

export function navActive(pathname: string, item: AppNavItem): boolean {
  if (item.label === 'Главная') return pathname === '/'
  if (item.label === 'Финансы') return pathname === '/finance'
  if (item.label === 'Календарь') return pathname === '/calendar'
  if (item.label === 'Задачи') return pathname === '/tasks'
  if (item.label === 'Клиенты') return pathname === '/clients'
  if (item.label === 'Шаблоны') return pathname === '/templates'
  if (item.label === 'Сроки') return pathname === '/deadlines'
  if (item.label === 'Отчёты') return pathname === '/reports'
  if (item.label === 'Резюме') return pathname === '/resume'
  if (item.label === 'Заметки') {
    return pathname === '/notes' || pathname.startsWith('/notes/')
  }
  if (item.label === 'Проекты') {
    return pathname === '/projects' || pathname.startsWith('/projects/')
  }
  if (item.label === 'Настройки') return pathname === '/settings'
  return false
}

/** Группы в полноэкранном меню. */
export const NAV_MENU_GROUPS: { title: string; labels: readonly AppNavLabel[] }[] =
  [
    {
      title: 'Портфель и клиенты',
      labels: ['Главная', 'Проекты', 'Клиенты', 'Шаблоны'],
    },
    {
      title: 'Задачи и календарь',
      labels: ['Задачи', 'Календарь', 'Сроки'],
    },
    {
      title: 'Финансы и отчёты',
      labels: ['Финансы', 'Отчёты'],
    },
    {
      title: 'Контент и система',
      labels: ['Резюме', 'Заметки', 'Настройки'],
    },
  ]

/** Разделы, которые можно закрепить в шапке (у «Главная» уже есть логотип). */
export const HEADER_QUICK_NAV_CANDIDATES: AppNavLabel[] = APP_NAV_ITEMS.filter(
  (x) => x.label !== 'Главная',
).map((x) => x.label)

export const HEADER_QUICK_NAV_MAX = 8

const ALLOWED_QUICK = new Set<string>(HEADER_QUICK_NAV_CANDIDATES)

/** Очистка списка из localStorage: только известные подписи, без дублей, лимит. */
export function normalizeHeaderQuickNavLabels(
  raw: string[] | undefined | null,
): AppNavLabel[] {
  if (!raw || !Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: AppNavLabel[] = []
  for (const x of raw) {
    if (typeof x !== 'string' || !ALLOWED_QUICK.has(x) || seen.has(x)) continue
    seen.add(x)
    out.push(x as AppNavLabel)
    if (out.length >= HEADER_QUICK_NAV_MAX) break
  }
  return out
}
