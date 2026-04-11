import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { useSettings } from '../hooks/useSettings'
import { accentButtonStyle } from '../lib/pickContrastText'
import { formInputUnderlineClass } from '../lib/formInputClasses'
import type { WorkspaceClient } from '../types/workspaceClient'

const input = formInputUnderlineClass

export function ClientsPage() {
  const { settings } = useSettings()
  const { clients, addClient, updateClient, deleteClient } = useProjects()
  const [searchParams] = useSearchParams()
  const focusId = searchParams.get('focus') ?? ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [notes, setNotes] = useState('')

  const sorted = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [clients],
  )

  useEffect(() => {
    if (!focusId) return
    const el = document.getElementById(`client-${focusId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusId, sorted.length])

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-light leading-[0.9] tracking-[-0.09em]">
        Клиенты
      </h1>

      <form
        className="mt-10 grid max-w-3xl gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          addClient({ name, email, phone, company, notes })
          setName('')
          setEmail('')
          setPhone('')
          setCompany('')
          setNotes('')
        }}
      >
        <label className="sm:col-span-2">
          <span className="text-[10px] font-light uppercase text-ink/50">
            Имя / название
          </span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="text-[10px] font-light uppercase text-ink/50">Email</span>
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span className="text-[10px] font-light uppercase text-ink/50">Телефон</span>
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className="text-[10px] font-light uppercase text-ink/50">Компания</span>
          <input className={input} value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className="text-[10px] font-light uppercase text-ink/50">Заметки</span>
          <textarea className={`${input} min-h-[4rem]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button
          type="submit"
          className="h-9 w-fit rounded-full px-6 text-sm font-light sm:col-span-2"
          style={accentButtonStyle(settings.accentColor)}
        >
          Добавить клиента
        </button>
      </form>

      <ul className="mt-14 flex max-w-3xl flex-col gap-6">
        {sorted.map((c) => (
          <li
            key={c.id}
            id={`client-${c.id}`}
            className={`border border-card-border p-5 ${
              focusId === c.id ? 'ring-2 ring-ink/20' : ''
            }`}
          >
            <ClientEditor
              client={c}
              accent={settings.accentColor}
              onSave={(patch) => updateClient(c.id, patch)}
              onDelete={() => {
                if (window.confirm(`Удалить «${c.name}»?`)) deleteClient(c.id)
              }}
            />
          </li>
        ))}
      </ul>
    </main>
  )
}

function ClientEditor({
  client,
  accent,
  onSave,
  onDelete,
}: {
  client: WorkspaceClient
  accent: string
  onSave: (p: Partial<Omit<WorkspaceClient, 'id'>>) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(client.name)
  const [email, setEmail] = useState(client.email)
  const [phone, setPhone] = useState(client.phone)
  const [company, setCompany] = useState(client.company)
  const [notes, setNotes] = useState(client.notes)

  return (
    <div className="flex flex-col gap-3">
      <input
        className={`${input} text-lg font-light`}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={input} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <input className={input} placeholder="Компания" value={company} onChange={(e) => setCompany(e.target.value)} />
      <textarea className={`${input} min-h-[4rem]`} placeholder="Заметки" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-8 rounded-full px-4 text-sm font-light"
          style={accentButtonStyle(accent)}
          onClick={() =>
            onSave({ name, email, phone, company, notes })
          }
        >
          Сохранить
        </button>
        <button
          type="button"
          className="h-8 rounded-full border border-card-border px-4 text-sm font-light text-ink/70"
          onClick={onDelete}
        >
          Удалить
        </button>
      </div>
    </div>
  )
}
