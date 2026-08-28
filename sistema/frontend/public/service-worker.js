self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Icone da notificacao: o quadrado da marca (logo branco sobre o bordo), nao o
// logo-branco.png solto. Aquele e branco em fundo transparente -- no balao do
// Windows, que ja tem fundo claro/escuro proprio, ele vira um borrao ilegivel.
// O badge continua sendo o logo branco de proposito: badge e mascarado pra
// monocromatico pela plataforma, entao silhueta em transparente e o formato
// certo justamente ali.
const ICON = '/branding/pwa-icon-192.png'
const BADGE = '/branding/logo-branco.png'

self.addEventListener('push', (event) => {
  let data = {
    title: 'Antenor & Filhos',
    body: 'Você tem uma nova notificação',
    icon: ICON,
    image: undefined,
    url: '/',
    tag: undefined,
  }
  try {
    if (event.data) {
      const payload = event.data.json()
      data = {
        title: payload?.title || data.title,
        body: payload?.body || data.body,
        icon: payload?.icon || data.icon,
        image: payload?.image || data.image,
        url: payload?.url || data.url,
        tag: payload?.tag,
      }
    }
  } catch {
    // payload inválido: usa fallback padrão
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      image: data.image,
      badge: BADGE,
      lang: 'pt-BR',
      dir: 'ltr',
      timestamp: Date.now(),
      // Sem tag, cada promocao empilha um balao proprio e enterra o cliente.
      // Com tag por assunto, a nova substitui a anterior do mesmo assunto --
      // renotify garante que a substituta ainda chame atencao em vez de trocar
      // o conteudo caladamente.
      tag: data.tag || 'antenor-geral',
      renotify: true,
      actions: [{ action: 'abrir', title: 'Ver na loja' }],
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/'

  // openWindow direto abria uma aba nova toda vez, mesmo com a loja ja aberta:
  // o cliente clicava na promocao e ganhava uma segunda aba do mesmo site, com
  // o carrinho da primeira "sumido" aos olhos dele. Reaproveita a aba existente
  // quando houver uma, e so abre nova como ultimo recurso.
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
