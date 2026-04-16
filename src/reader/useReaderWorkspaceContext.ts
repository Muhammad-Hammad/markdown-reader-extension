import { useContext } from 'react'
import { ReaderWorkspaceContext } from './ReaderWorkspaceContext'

export function useReaderWorkspaceContext() {
  const context = useContext(ReaderWorkspaceContext)
  if (!context) {
    throw new Error('Reader workspace context is missing.')
  }

  return context
}
