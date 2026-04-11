/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'portfolio-runtime-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          if (res.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('/index.html')),
        ),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((networkRes) => {
          if (networkRes.ok) {
            const copy = networkRes.clone()
            caches.open(CACHE_NAME).then((c) => c.put(req, copy))
          }
          return networkRes
        })
        .catch(() => cached)
      return cached || net
    }),
  )
})
