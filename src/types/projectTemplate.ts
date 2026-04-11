import type { ProjectStage } from './project'

export type ProjectTemplate = {
  id: string
  name: string
  stages: ProjectStage[]
}
