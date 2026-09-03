// Service worker do app de Separação.
//
// Existe por um motivo so: receber Web Push. O app roda no celular do
// funcionario e ate 03/09/2026 nao avisava nada -- so descobria pedido novo
// quem lembrasse de abrir e olhar a lista. Nao ha cache offline aqui de
// proposito: dado de pedido desatualizado no celular do separador e pior que
// tela vazia, porque ele age achando que esta certo.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

const ICON = '/icon-192.png'
const BADGE = '/badge.png'

self.addEventListener('push', (event) => {
  let data = { title: 'Antenor & Filhos', body: 'Você tem um aviso novo', url: '/', tag: undefined }
  try {
    if (event.data) {
      const payload = event.data.json()
      data = {
        title: payload?.title || data.title,
        body: payload?.body || data.body,
        url: payload?.url || data.url,
        tag: payload?.tag,
      }
    }
  } catch {
    // payload invalido: usa o texto padrao em vez de engolir o aviso
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: ICON,
      badge: BADGE,
      lang: 'pt-BR',
      timestamp: Date.now(),
      // Tag por pedido: dez pedidos viram dez avisos distintos, e nao dez
      // copias do mesmo. Reenvio do MESMO pedido substitui em vez de empilhar.
      tag: data.tag || 'antenor-picking-app',
      renotify: true,
      // O funcionario esta trabalhando com as maos ocupadas -- o aviso tem que
      // ficar na tela ate ele tocar, nao sumir sozinho em 5 segundos.
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/'

  // Reaproveita a janela aberta em vez de abrir outra: o funcionario que ja
  // esta com o app aberto nao deve ganhar uma segunda aba a cada aviso.
  event.waitUntil(
    (async () => {
      const alvo = new URL(url, self.location.origin)
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      for (const janela of janelas) {
        if (new URL(janela.url).origin !== alvo.origin) continue
        await janela.focus()
        if (janela.url !== alvo.href && 'navigate' in janela) {
          await janela.navigate(alvo.href).catch(() => {})
        }
        return
      }

      await self.clients.openWindow(alvo.href)
    })(),
  )
})
