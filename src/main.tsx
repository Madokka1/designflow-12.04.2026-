import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { NotesProvider } from './context/NotesProvider'
import { ProjectsProvider } from './context/ProjectsProvider'
import { AuthProvider } from './context/AuthProvider'
import { RemoteSyncProvider } from './context/remoteSyncContext'
import { SettingsProvider } from './context/SettingsProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <RemoteSyncProvider>
            <ProjectsProvider>
              <NotesProvider>
                <App />
              </NotesProvider>
            </ProjectsProvider>
          </RemoteSyncProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
