/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'portfolio-runtime-v2'

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

/** Всегда валидный Response — иначе respondWith падает с «Failed to convert value to Response». */
function offlineNavigateFallback() {
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Нет сети</title></head><body><p>Нет подключения. Проверьте интернет и обновите страницу.</p></body></html>',
    {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}

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
            void caches.open(CACHE_NAME).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(async () => {
          const r = await caches.match(req)
          if (r) return r
          const idx = await caches.match('/index.html')
          return idx ?? offlineNavigateFallback()
        }),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req)
      try {
        const networkRes = await fetch(req)
        if (networkRes.ok) {
          const copy = networkRes.clone()
          void caches.open(CACHE_NAME).then((c) => c.put(req, copy))
        }
        return networkRes
      } catch {
        if (cached) return cached
        return new Response('', {
          status: 504,
          statusText: 'Gateway Timeout',
        })
      }
    })(),
  )
})
