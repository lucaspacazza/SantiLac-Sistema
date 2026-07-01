import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  const controlledAtStart = navigator.serviceWorker.controller !== null
  let refreshing = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlledAtStart || refreshing) return
    refreshing = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fabrica/sw.js?v=3', {
      scope: '/fabrica/',
      updateViaCache: 'none',
    }).then((registration) => {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            installing.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
      return registration.update()
    }).catch(() => null)
  })
}
