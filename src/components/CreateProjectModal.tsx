import { useMemo } from 'react'
import { ProjectFormModal } from './ProjectFormModal'
import { defaultProjectForm, type CreateProjectForm } from '../types/projectForm'

export type { CreateProjectForm } from '../types/projectForm'

type Props = {
  onClose: () => void
  onCreate: (data: CreateProjectForm) => void
}

export function CreateProjectModal({ onClose, onCreate }: Props) {
  const emptyForm = useMemo(() => defaultProjectForm(), [])

  return (
    <ProjectFormModal
      title="Создать проект"
      submitLabel="Создать проект"
      initialForm={emptyForm}
      zClassName="z-50"
      onClose={onClose}
      onSubmit={(data) => {
        onCreate(data)
        onClose()
      }}
    />
  )
}
