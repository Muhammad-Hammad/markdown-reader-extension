import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './reader/reader.css'
import ReaderApp from './reader/ReaderApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReaderApp />
  </StrictMode>,
)
