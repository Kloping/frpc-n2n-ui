import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/App'
import { applyThemeMode, loadThemeMode } from '@/lib/theme'
import '@/styles/tokens.css'

applyThemeMode(loadThemeMode())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
