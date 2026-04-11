import { lazy, Suspense } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuthGateScreen } from './components/AuthGateScreen'
import { ProfileConnectionSync } from './components/ProfileConnectionSync'
import { ProfileSettingsDbSync } from './components/ProfileSettingsDbSync'
import { useAuth } from './hooks/useAuth'

const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)
const FinancePage = lazy(() =>
  import('./pages/FinancePage').then((m) => ({ default: m.FinancePage })),
)
const HomePage = lazy(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePage })),
)
const NoteEditorPage = lazy(() =>
  import('./pages/NoteEditorPage').then((m) => ({ default: m.NoteEditorPage })),
)
const NotesIndexPage = lazy(() =>
  import('./pages/NotesIndexPage').then((m) => ({ default: m.NotesIndexPage })),
)
const ProjectDetailPage = lazy(() =>
  import('./pages/ProjectDetailPage').then((m) => ({
    default: m.ProjectDetailPage,
  })),
)
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm font-light text-ink/50">
      Загрузка…
    </div>
  )
}

function NoteEditorRoute() {
  const { noteSlug } = useParams()
  return <NoteEditorPage key={noteSlug} />
}

function AppRoutes() {
  return (
    <>
      <ProfileConnectionSync />
      <ProfileSettingsDbSync />
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          index
          element={
            <Suspense fallback={<PageFallback />}>
              <HomePage />
            </Suspense>
          }
        />
        <Route
          path="projects"
          element={
            <Suspense fallback={<PageFallback />}>
              <ProjectsPage />
            </Suspense>
          }
        />
        <Route
          path="projects/:slug"
          element={
            <Suspense fallback={<PageFallback />}>
              <ProjectDetailPage />
            </Suspense>
          }
        />
        <Route
          path="finance"
          element={
            <Suspense fallback={<PageFallback />}>
              <FinancePage />
            </Suspense>
          }
        />
        <Route
          path="calendar"
          element={
            <Suspense fallback={<PageFallback />}>
              <CalendarPage />
            </Suspense>
          }
        />
        <Route
          path="notes"
          element={
            <Suspense fallback={<PageFallback />}>
              <NotesIndexPage />
            </Suspense>
          }
        />
        <Route
          path="notes/:noteSlug"
          element={
            <Suspense fallback={<PageFallback />}>
              <NoteEditorRoute />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageFallback />}>
              <SettingsPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
    </>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface text-ink">
        <p className="text-sm font-light tracking-[-0.02em] text-ink/45">
          Загрузка…
        </p>
      </div>
    )
  }

  if (!session) {
    return <AuthGateScreen />
  }

  return <AppRoutes />
}
