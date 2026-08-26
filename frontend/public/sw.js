const CACHE_NAME = 'santilac-shell-v4'
const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/assets/img/logo.png',
  '/assets/img/favicon.ico',
  '/assets/img/icon128.png',
  '/assets/img/icon192.png',
  '/assets/img/icon256.png',
  '/assets/img/icon512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(SHELL_ASSETS)
        const response = await fetch('/asset-manifest.json', { cache: 'no-store' })
        if (!response.ok) throw new Error('Manifesto de assets indisponível.')
        await cache.put('/asset-manifest.json', response.clone())
        const manifest = await response.json()
        const generatedAssets = [...new Set(Object.values(manifest).flatMap((entry) => [
          entry.file,
          ...(entry.css ?? []),
          ...(entry.assets ?? []),
        ]).filter(Boolean).map((path) => `/${String(path).replace(/^\//, '')}`))]
        await cache.addAll(generatedAssets)
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.pathname.startsWith('/api')) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME)
            await cache.put('/', response.clone())
          }
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok && url.origin === self.location.origin) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }
    return response
  }))
})
