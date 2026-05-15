import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './modules/qualidade/qualidade.css'
import './modules/estoque/estoque.css'
import './shared/sidebarMotion.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
