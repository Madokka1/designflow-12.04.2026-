import { useEffect, useState } from 'react'
import { loadResume, saveResume } from '../lib/resumeStorage'
import type { PortfolioResume } from '../types/resume'
import { useSettings } from './useSettings'

export function usePortfolioResume() {
  const { settings } = useSettings()
  const readOnly = settings.readOnlyMode
  const [data, setData] = useState<PortfolioResume>(() => loadResume())

  useEffect(() => {
    if (readOnly) return
    const t = window.setTimeout(() => saveResume(data), 600)
    return () => window.clearTimeout(t)
  }, [data, readOnly])

  return { data, setData, readOnly }
}
