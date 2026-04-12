export type WorkspaceClient = {
  id: string
  name: string
  /** В интерфейсе «Клиенты» — Telegram (@username или ссылка); в API/БД поле `email`. */
  email: string
  phone: string
  company: string
  notes: string
}
