export type WorkspaceTask = {
  id: string
  title: string
  done: boolean
  /** ДД.ММ.ГГГГ или пусто */
  dueDate: string
  /** Привязка к проекту по slug */
  projectSlug: string | null
  labels: string[]
  sortOrder: number
}
