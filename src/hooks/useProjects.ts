import { useContext } from 'react'
import { ProjectsContext } from '../context/projectsContext'

export function useProjects() {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider')
  return ctx
}
