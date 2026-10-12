import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Root } from './App'
import { applyTheme, useThemeStore, watchSystemTheme } from './store/themeStore'
import './index.css'

applyTheme(useThemeStore.getState().mode)
watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
