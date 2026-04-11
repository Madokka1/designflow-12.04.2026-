export function registerPortfolioServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* ignore */
    })
  })
}
