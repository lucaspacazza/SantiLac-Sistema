import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './modules/qualidade/qualidade.css'
import './modules/estoque/estoque.css'
import './modules/pasteurizador/pasteurizador.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=2', { updateViaCache: 'none' }).catch(() => null)
  })
}
