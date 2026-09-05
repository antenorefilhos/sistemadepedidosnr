const STATUS_LABEL = {
  PENDING: 'Pedido Recebido',
  CONFIRMED: 'Pedido Confirmado',
  PICKING_PENDING: 'Na Fila de Separacao',
  PICKING: 'Em Separacao',
  CONFERENCE_PENDING: 'Em Conferencia',
  READY_FOR_CHECKOUT: 'No Caixa',
  READY_FOR_DELIVERY: 'Pronto para Entrega',
  READY_FOR_PICKUP: 'Pronto para Retirada',
  OUT_FOR_DELIVERY: 'Saiu para Entrega',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluido',
  CANCELLED: 'Cancelado',
  FAILED_DELIVERY: 'Entrega Falhou',
}

const STATUS_CLASS = {
  PENDING: 'badge-new',
  CONFIRMED: 'badge-new',
  PICKING_PENDING: 'badge-pending',
  PICKING: 'badge-progress',
  CONFERENCE_PENDING: 'badge-progress',
  READY_FOR_CHECKOUT: 'badge-progress',
  READY_FOR_DELIVERY: 'badge-progress',
  READY_FOR_PICKUP: 'badge-progress',
  OUT_FOR_DELIVERY: 'badge-progress',
  DELIVERED: 'badge-done',
  COMPLETED: 'badge-done',
  CANCELLED: 'badge-cancel',
  FAILED_DELIVERY: 'badge-cancel',
}

function timeAgo(iso) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  return `${Math.round(diffH / 24)}d`
}

function money(v) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Aguardando separacao primeiro, do mais antigo pro mais novo (o mais atrasado
// no topo); o resto depois, do mais recente pro mais antigo.
function byUrgency(a, b) {
  const aEspera = a.notifLevel ? 1 : 0
  const bEspera = b.notifLevel ? 1 : 0
  if (aEspera !== bEspera) return bEspera - aEspera
  const ta = new Date(a.createdAt).getTime()
  const tb = new Date(b.createdAt).getTime()
  return aEspera ? ta - tb : tb - ta
}

function render(orders) {
  const list = document.getElementById('list')
  if (!orders || orders.length === 0) {
    list.innerHTML = '<p class="empty">Nenhum pedido recente</p>'
    return
  }

  list.innerHTML = [...orders].sort(byUrgency).slice(0, 30).map(o => {
    const label = STATUS_LABEL[o.status] || o.status
    const cls = STATUS_CLASS[o.status] || 'badge-progress'
    const name = o.customer?.name || `#${o.id.slice(-6)}`
    const items = Array.isArray(o.items) ? o.items.length : 0
    const level = o.notifLevel ? ` level-${o.notifLevel}` : ''
    return `
      <div class="card${level}">
        <div class="card-top">
          <span class="card-name">${escapeHtml(name)}</span>
          <span class="card-time">${timeAgo(o.createdAt)}</span>
        </div>
        <div class="card-bottom">
          <span class="card-meta">${items} ${items === 1 ? 'item' : 'itens'} · ${money(o.total)}</span>
          <span class="badge ${cls}">${escapeHtml(label)}</span>
        </div>
      </div>
    `
  }).join('')
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

window.notificador.getOrders().then(render)
window.notificador.onOrdersUpdated(render)
document.getElementById('refresh').addEventListener('click', () => window.notificador.checkNow())
