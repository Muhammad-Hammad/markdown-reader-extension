import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './reader.css'
import ReaderApp from './ReaderApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReaderApp />
  </StrictMode>,
)
