export type ResumeSkill = {
  id: string
  name: string
}

export type ResumeCase = {
  id: string
  title: string
  role: string
  description: string
  url: string
  stack: string
}

export type ResumeEducation = {
  id: string
  institution: string
  degree: string
  period: string
}

export type ResumeLanguage = {
  id: string
  name: string
  level: string
}

export type PortfolioResume = {
  schemaVersion: 1
  /** data:image/... или пусто */
  photoDataUrl: string
  fullName: string
  headline: string
  location: string
  summary: string
  contactEmail: string
  contactPhone: string
  contactLinks: string
  skills: ResumeSkill[]
  personalQualities: string[]
  cases: ResumeCase[]
  education: ResumeEducation[]
  languages: ResumeLanguage[]
}

export const RESUME_SCHEMA_VERSION = 1 as const

export function emptyResume(): PortfolioResume {
  return {
    schemaVersion: RESUME_SCHEMA_VERSION,
    photoDataUrl: '',
    fullName: '',
    headline: '',
    location: '',
    summary: '',
    contactEmail: '',
    contactPhone: '',
    contactLinks: '',
    skills: [],
    personalQualities: [],
    cases: [],
    education: [],
    languages: [],
  }
}
