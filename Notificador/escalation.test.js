// Roda com: node escalation.test.js
const assert = require('assert')
const { levelOf, planNotifications, formatAge, codigoDoPedido } = require('./escalation')

// --- tempo legivel ------------------------------------------------------
assert.equal(formatAge(0), 'agora', 'pedido recem-chegado nao mostra "0 min"')
assert.equal(formatAge(7.9), '7 min')
assert.equal(formatAge(59), '59 min')
assert.equal(formatAge(60), '1h')
assert.equal(formatAge(95), '1h 35min')
assert.equal(formatAge(1440), '1d')
assert.equal(formatAge(2235), '1d 13h', 'nao mostra "2235 min"')

const T0 = new Date('2026-08-19T12:00:00Z').getTime()
const min = n => T0 + n * 60000
const pedido = (id, idadeMin, status = 'PENDING') => ({
  id,
  status,
  createdAt: new Date(T0 - idadeMin * 60000).toISOString(),
  customer: { name: id },
})

// --- niveis por idade ---------------------------------------------------
assert.equal(levelOf(pedido('a', 0), T0).key, 'novo')
assert.equal(levelOf(pedido('a', 4.9), T0).key, 'novo')
assert.equal(levelOf(pedido('a', 5), T0).key, 'atencao', 'exatamente 5min ja e atencao')
assert.equal(levelOf(pedido('a', 9.9), T0).key, 'atencao')
assert.equal(levelOf(pedido('a', 10), T0).key, 'critico', 'exatamente 10min ja e critico')
assert.equal(levelOf(pedido('a', 120), T0).key, 'critico')

// --- escalonamento de um pedido ao longo do tempo ------------------------
{
  const notified = new Map()
  const p = pedido('p1', 0)
  const orders = [p]

  // chega: avisa NOVO
  let r = planNotifications(orders, notified, T0)
  assert.deepEqual(r.groups.map(g => g.level.key), ['novo'])

  // 2min depois: nada de novo, ja foi avisado nesse nivel
  r = planNotifications(orders, notified, min(2))
  assert.deepEqual(r.groups, [], 'nao repete o mesmo nivel')

  // 5min: sobe pra ATENCAO
  r = planNotifications(orders, notified, min(5))
  assert.deepEqual(r.groups.map(g => g.level.key), ['atencao'])

  // 7min: silencio (atencao nao repete)
  r = planNotifications(orders, notified, min(7))
  assert.deepEqual(r.groups, [], 'atencao nao tem repeticao')

  // 10min: sobe pra CRITICO
  r = planNotifications(orders, notified, min(10))
  assert.deepEqual(r.groups.map(g => g.level.key), ['critico'])

  // 12min: ainda nao completou os 5min de reforco
  r = planNotifications(orders, notified, min(12))
  assert.deepEqual(r.groups, [], 'critico so repete a cada 5min')

  // 15min: reforco do critico
  r = planNotifications(orders, notified, min(15))
  assert.deepEqual(r.groups.map(g => g.level.key), ['critico'], 'critico repete aos 5min')

  // 20min: mais um reforco, e segue em vermelho
  r = planNotifications(orders, notified, min(20))
  assert.deepEqual(r.groups.map(g => g.level.key), ['critico'])
}

// --- para de escalar quando a separacao comeca ---------------------------
{
  const notified = new Map()
  const orders = [pedido('p2', 30)]
  planNotifications(orders, notified, T0)
  assert.equal(notified.size, 1)

  const emSeparacao = [{ ...orders[0], status: 'PICKING' }]
  const r = planNotifications(emSeparacao, notified, min(10))
  assert.deepEqual(r.groups, [], 'PICKING nao alerta mais')
  assert.equal(notified.size, 0, 'estado do pedido e limpo ao sair da fila')
  assert.deepEqual(r.waiting, [])
}

// --- PICKING_PENDING tambem escala --------------------------------------
{
  const notified = new Map()
  const r = planNotifications([pedido('p3', 12, 'PICKING_PENDING')], notified, T0)
  assert.deepEqual(r.groups.map(g => g.level.key), ['critico'])
}

// --- pedido antigo com o app recem-aberto ja entra vermelho -------------
{
  const notified = new Map()
  const r = planNotifications([pedido('p4', 45)], notified, T0)
  assert.deepEqual(r.groups.map(g => g.level.key), ['critico'], 'conta pelo createdAt, nao por quando o app viu')
}

// --- varios pedidos: um toast por nivel, nao um por pedido --------------
{
  const notified = new Map()
  const r = planNotifications(
    [pedido('a', 1), pedido('b', 2), pedido('c', 6), pedido('d', 30), pedido('e', 40)],
    notified,
    T0,
  )
  const porNivel = Object.fromEntries(r.groups.map(g => [g.level.key, g.orders.length]))
  assert.deepEqual(porNivel, { novo: 2, atencao: 1, critico: 2 })
  assert.equal(r.groups.length, 3, 'no maximo um toast por nivel')
}

console.log('escalation: todos os testes passaram')

// --- codigo do pedido no aviso -----------------------------------------
// O separador precisa saber QUAL pedido digitar no PDV, nao so que ha um
// parado. O numero digitavel e o DAV.
assert.equal(codigoDoPedido({ id: 'order_abc12345', erpDav: '102066' }), '102066')

// Sem DAV o pedido nao existe no PDV: o "#" avisa que nao adianta digitar.
assert.equal(codigoDoPedido({ id: 'order_a1b2c3d4e5f6', erpDav: null }), '#C3D4E5F6')
assert.equal(codigoDoPedido({ id: 'order_a1b2c3d4e5f6' }), '#C3D4E5F6')

// DAV vindo como numero do banco tem que virar texto sem virar "102066.0"
assert.equal(codigoDoPedido({ id: 'x', erpDav: 102066 }), '102066')
assert.equal(codigoDoPedido({ id: 'x', erpDav: ' 102066 ' }), '102066', 'espaco em volta nao vai pra tela')
assert.equal(codigoDoPedido(null), '', 'pedido ausente nao quebra o aviso')

console.log('codigo do pedido: ok')
