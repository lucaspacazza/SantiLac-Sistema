import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const isFabricaApp = window.location.pathname.startsWith('/fabrica')
const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')

if (isFabricaApp && manifest) {
  manifest.href = '/fabrica.webmanifest'
}

async function bootstrap() {
  if (isFabricaApp) {
    const [{ FabricaApp }] = await Promise.all([
      import('./modules/fabrica/FabricaApp'),
      import('./modules/fabrica/fabrica.css'),
    ])

    createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <FabricaApp />
      </React.StrictMode>,
    )
    return
  }

  const [{ App }] = await Promise.all([
    import('./App'),
    import('./modules/qualidade/qualidade.css'),
    import('./modules/estoque/estoque.css'),
    import('./modules/pasteurizador/pasteurizador.css'),
  ])

  createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void bootstrap()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const worker = isFabricaApp ? '/fabrica-sw.js?v=1' : '/sw.js?v=2'
    const options = isFabricaApp ? { scope: '/fabrica/', updateViaCache: 'none' as const } : { updateViaCache: 'none' as const }

    navigator.serviceWorker.register(worker, options).catch(() => null)
  })
}
