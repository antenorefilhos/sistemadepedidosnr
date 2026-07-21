self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {
    title: 'Antenor & Filhos',
    body: 'Você tem uma nova notificação',
    icon: '/branding/logo-branco.png',
    url: '/',
  }
  try {
    if (event.data) {
      const payload = event.data.json()
      data = {
        title: payload?.title || data.title,
        body: payload?.body || data.body,
        icon: payload?.icon || data.icon,
        url: payload?.url || data.url,
      }
    }
  } catch {
    // payload inválido: usa fallback padrão
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/branding/logo-branco.png',
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/'
  event.waitUntil(self.clients.openWindow(url))
})
