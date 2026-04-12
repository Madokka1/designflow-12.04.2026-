import { useMemo, useState } from 'react'
import { ProjectFormModal } from './ProjectFormModal'
import { defaultProjectForm, type CreateProjectForm } from '../types/projectForm'
import type { ProjectTemplate } from '../types/projectTemplate'
import type { WorkspaceClient } from '../types/workspaceClient'

export type { CreateProjectForm } from '../types/projectForm'

type Props = {
  onClose: () => void
  onCreate: (data: CreateProjectForm, templateId?: string) => void
  templates?: readonly ProjectTemplate[]
  clients?: readonly WorkspaceClient[]
}

export function CreateProjectModal({
  onClose,
  onCreate,
  templates = [],
  clients = [],
}: Props) {
  const emptyForm = useMemo(() => defaultProjectForm(), [])
  const [templateId, setTemplateId] = useState('')

  const stagedPreviewStages = useMemo(() => {
    if (!templateId) return undefined
    return templates.find((t) => t.id === templateId)?.stages
  }, [templateId, templates])

  return (
    <ProjectFormModal
      title="Создать проект"
      submitLabel="Создать проект"
      initialForm={emptyForm}
      zClassName="z-50"
      clientsForPicker={clients}
      stagedPaymentPreviewStages={stagedPreviewStages}
      templateSelect={
        templates.length > 0
          ? {
              value: templateId,
              onChange: setTemplateId,
              options: templates.map((t) => ({ id: t.id, name: t.name })),
            }
          : undefined
      }
      onClose={onClose}
      onSubmit={(data) => {
        onCreate(data, templateId || undefined)
        onClose()
      }}
    />
  )
}
