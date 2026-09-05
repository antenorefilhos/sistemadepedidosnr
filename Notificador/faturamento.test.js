// Roda com: node faturamento.test.js
const assert = require('assert')
const { conciliarFaturamento } = require('./faturamento')

const io = (over = {}) => {
  const marcados = []
  const logs = []
  const base = {
    listarPendentes: async () => [],
    consultarFaturados: async () => [],
    marcarFaturado: async (id, fiscal) => void marcados.push({ id, fiscal }),
    log: (m) => logs.push(m),
  }
  return { io: { ...base, ...over }, marcados, logs }
}

// --- caso feliz ---------------------------------------------------------
;(async () => {
  const { io: deps, marcados } = io({
    listarPendentes: async () => [{ id: 'order_aaa', erpDav: '102066' }],
    consultarFaturados: async () => [{ dav: '102066', hrRegistro: '2026-09-04 10:00:00', coo: 202099, nrCupom: 203299 }],
  })
  const r = await conciliarFaturamento(deps)
  assert.equal(r.liberados, 1, 'pedido faturado no PDV tem que ser liberado')
  assert.equal(marcados[0].id, 'order_aaa')
  assert.equal(marcados[0].fiscal.coo, 202099, 'dados fiscais vao junto, pra auditoria')

  // --- pedido ainda nao faturado fica onde esta -------------------------
  // O DORSAL so devolve quem tem hrRegistro; quem nao aparece continua
  // esperando o caixa. Liberar aqui seria entregar antes de faturar.
  const b = io({
    listarPendentes: async () => [{ id: 'order_bbb', erpDav: '102067' }],
    consultarFaturados: async () => [],
  })
  const rb = await conciliarFaturamento(b.io)
  assert.equal(rb.liberados, 0, 'sem hrRegistro nao libera')
  assert.equal(rb.verificados, 1)
  assert.equal(b.marcados.length, 0)

  // --- fila vazia nao encosta no banco da loja --------------------------
  let consultou = false
  const c = io({
    listarPendentes: async () => [],
    consultarFaturados: async () => { consultou = true; return [] },
  })
  await conciliarFaturamento(c.io)
  assert.equal(consultou, false, 'fila vazia nao pode abrir conexao com o SQL Server deles')

  // --- pedido sem DAV nunca chegou ao Solidcom --------------------------
  let consultouSemDav = false
  const d = io({
    listarPendentes: async () => [{ id: 'order_ccc', erpDav: null }],
    consultarFaturados: async () => { consultouSemDav = true; return [] },
  })
  const rd = await conciliarFaturamento(d.io)
  assert.equal(rd.semDav, 1, 'pedido sem DAV e contabilizado, nao ignorado em silencio')
  assert.equal(consultouSemDav, false, 'nao adianta consultar o banco por um pedido que nao existe la')

  // --- um pedido com erro nao trava a fila inteira ----------------------
  // A fila e compartilhada: se o primeiro falhar e derrubar o ciclo, todo
  // mundo atras dele fica preso ate alguem perceber.
  const e = io({
    listarPendentes: async () => [
      { id: 'order_ddd', erpDav: '1' },
      { id: 'order_eee', erpDav: '2' },
    ],
    consultarFaturados: async () => [
      { dav: '1', hrRegistro: 'x' },
      { dav: '2', hrRegistro: 'y' },
    ],
    marcarFaturado: async (id) => {
      if (id === 'order_ddd') throw new Error('500 da API')
    },
  })
  const re = await conciliarFaturamento(e.io)
  assert.equal(re.liberados, 1, 'o segundo pedido tem que passar mesmo com o primeiro falhando')
  assert.ok(e.logs.some((l) => l.includes('falha ao liberar')), 'a falha precisa aparecer no log, nao sumir')

  // --- DAV desconhecido nao libera nada ---------------------------------
  // Venda de balcao com numero parecido, ou fila que mudou entre as duas
  // chamadas. Liberar pedido que ninguem pediu e pior que nao liberar.
  const f = io({
    listarPendentes: async () => [{ id: 'order_fff', erpDav: '102066' }],
    consultarFaturados: async () => [{ dav: '999999', hrRegistro: 'z' }],
  })
  const rf = await conciliarFaturamento(f.io)
  assert.equal(rf.liberados, 0)
  assert.equal(f.marcados.length, 0, 'DAV fora da fila nao pode virar entrega')

  // --- DAV com espaco/tipo diferente ainda casa -------------------------
  // O DAV vem como string da nossa API e como bigint do SQL Server.
  const g = io({
    listarPendentes: async () => [{ id: 'order_ggg', erpDav: ' 102066 ' }],
    consultarFaturados: async () => [{ dav: 102066, hrRegistro: 'w' }],
  })
  assert.equal((await conciliarFaturamento(g.io)).liberados, 1, 'numero e string do mesmo DAV tem que casar')

  console.log('faturamento.test.js: todos os casos passaram')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
