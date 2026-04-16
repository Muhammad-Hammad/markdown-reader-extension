import { type ReactNode, createContext } from 'react'
import { useReaderWorkspace } from './hooks/useReaderWorkspace'

type ReaderWorkspaceValue = ReturnType<typeof useReaderWorkspace>

const ReaderWorkspaceContext = createContext<ReaderWorkspaceValue | null>(null)

export function ReaderWorkspaceProvider({
  children,
  value,
}: {
  children: ReactNode
  value: ReaderWorkspaceValue
}) {
  return <ReaderWorkspaceContext.Provider value={value}>{children}</ReaderWorkspaceContext.Provider>
}

export { ReaderWorkspaceContext }
