import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getLogger } from './core/logging/Logger'

const logger = getLogger('main')

logger.info('Bootstrapping Stack Tutor app')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
