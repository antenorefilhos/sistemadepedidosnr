// Logica pura de escalonamento por tempo de espera — sem Electron, pra poder
// ser testada direto no node (ver escalation.test.js).

// Todo status anterior a PICKING conta como "aguardando separacao" e escala
// junto: o alerta so silencia quando a separacao comeca de fato.
const WAITING_STATUS = ['PENDING', 'CONFIRMED', 'PICKING_PENDING']

// Do mais grave pro mais leve: levelOf() pega o primeiro que a idade alcanca.
const LEVELS = [
  {
    key: 'critico',
    label: 'CRITICO',
    afterMinutes: 10,
    repeatMs: 5 * 60 * 1000,
    sound: 'Windows Critical Stop.wav',
    // O tempo nao entra no titulo: ele ja aparece em destaque proprio na
    // notificacao. Repetir so rouba espaco do que importa.
    title: n => (n > 1 ? `${n} pedidos sem separar` : 'Pedido parado'),
    body: (n, nomes) => nomes,
  },
  {
    key: 'atencao',
    label: 'ATENCAO',
    afterMinutes: 5,
    repeatMs: null,
    sound: 'Windows Exclamation.wav',
    title: n => (n > 1 ? `${n} pedidos aguardando` : 'Aguardando separacao'),
    body: (n, nomes) => nomes,
  },
  {
    key: 'novo',
    label: 'NOVO',
    afterMinutes: 0,
    repeatMs: null,
    sound: 'Windows Notify Messaging.wav',
    title: n => (n > 1 ? `${n} pedidos novos` : 'Novo pedido'),
    body: (n, nomes) => nomes,
  },
]

function minutesSince(iso, now = Date.now()) {
  return (now - new Date(iso).getTime()) / 60000
}

// "2235 min" nao diz nada; "1d 13h" diz.
function formatAge(minutes) {
  const m = Math.floor(minutes)
  if (m < 1) return 'agora'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${h}h ${m % 60}min` : `${h}h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`
}

// Nivel pela idade real do pedido (createdAt), nao pelo momento em que o
// notificador viu — PC desligado nao "zera" o atraso.
function levelOf(order, now = Date.now()) {
  const min = minutesSince(order.createdAt, now)
  return LEVELS.find(l => min >= l.afterMinutes)
}

/**
 * Decide o que notificar nesta rodada e atualiza o estado.
 *
 * @param orders   resposta crua de /picker/orders
 * @param notified Map orderId -> { levelKey, at } (mutado no lugar)
 * @returns { waiting, groups } — groups agrupado por nivel, um toast cada
 */
function planNotifications(orders, notified, now = Date.now()) {
  const waiting = orders.filter(o => WAITING_STATUS.includes(o.status))
  const groups = new Map()

  for (const order of waiting) {
    const level = levelOf(order, now)
    const prev = notified.get(order.id)
    const mudouDeNivel = !prev || prev.levelKey !== level.key
    const horaDeRepetir = prev && level.repeatMs && now - prev.at >= level.repeatMs

    if (mudouDeNivel || horaDeRepetir) {
      if (!groups.has(level.key)) groups.set(level.key, { level, orders: [] })
      groups.get(level.key).orders.push(order)
      notified.set(order.id, { levelKey: level.key, at: now })
    }
  }

  // Pedido que saiu da fila (entrou em separacao/cancelou) para de escalar.
  const idsNaFila = new Set(waiting.map(o => o.id))
  for (const id of [...notified.keys()]) if (!idsNaFila.has(id)) notified.delete(id)

  return { waiting, groups: [...groups.values()] }
}

/**
 * Codigo do pedido pra mostrar no aviso.
 *
 * E o DAV -- o mesmo numero que o separador digita no PDV pra puxar o pedido.
 * Mesma regra do picking-app (`utils/orderCode.ts`): o id interno e UUID e o
 * PDV so aceita numero, entao os 8 ultimos caracteres nao servem pra digitar.
 *
 * Sem DAV o pedido nao sincronizou com o Solidcom e nao existe no PDV. Ai cai
 * no id curto com `#` na frente -- o prefixo avisa que aquilo NAO e digitavel,
 * em vez de mandar o separador tentar um numero que nao vai funcionar.
 */
function codigoDoPedido(pedido) {
  if (!pedido) return ''
  if (pedido.erpDav) return String(pedido.erpDav).trim()
  return '#' + String(pedido.id || '').slice(-8).toUpperCase()
}

module.exports = { WAITING_STATUS, LEVELS, levelOf, minutesSince, formatAge, planNotifications, codigoDoPedido }
