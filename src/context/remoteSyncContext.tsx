import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type PortfolioRemoteSyncState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string }

type RemoteSyncContextValue = {
  portfolio: PortfolioRemoteSyncState
  setPortfolioSync: (next: PortfolioRemoteSyncState) => void
  touchSaved: () => void
}

const RemoteSyncContext = createContext<RemoteSyncContextValue | null>(null)

export function RemoteSyncProvider({ children }: { children: ReactNode }) {
  const [portfolio, setPortfolio] = useState<PortfolioRemoteSyncState>({
    kind: 'idle',
  })

  const setPortfolioSync = useCallback((next: PortfolioRemoteSyncState) => {
    setPortfolio(next)
  }, [])

  const touchSaved = useCallback(() => {
    setPortfolio({ kind: 'saved', at: Date.now() })
  }, [])

  const value = useMemo(
    () => ({ portfolio, setPortfolioSync, touchSaved }),
    [portfolio, setPortfolioSync, touchSaved],
  )

  return (
    <RemoteSyncContext.Provider value={value}>{children}</RemoteSyncContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- хук привязан к провайдеру
export function useRemoteSync() {
  const v = useContext(RemoteSyncContext)
  if (!v) {
    throw new Error('useRemoteSync must be used within RemoteSyncProvider')
  }
  return v
}
