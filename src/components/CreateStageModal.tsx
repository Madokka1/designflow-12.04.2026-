import { useMemo } from 'react'
import { StageFormModal } from './StageFormModal'
import { defaultStageForm, type CreateStageForm } from '../types/stageForm'

export type { CreateStageForm } from '../types/stageForm'

type Props = {
  onClose: () => void
  onCreate: (data: CreateStageForm) => void
}

export function CreateStageModal({ onClose, onCreate }: Props) {
  const emptyForm = useMemo(() => defaultStageForm(), [])

  return (
    <StageFormModal
      title="Создать этап"
      submitLabel="Создать этап"
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
