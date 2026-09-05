/**
 * Gatilho de faturamento do PDV — a peça que faltava na esteira.
 *
 * O pedido para em `READY_FOR_CHECKOUT` depois que o separador manda pro
 * caixa, e só pode ser liberado pro entregador **depois de finalizado no
 * PDV** — regra do lojista, não detalhe técnico: entregar mercadoria antes de
 * faturar não pode acontecer.
 *
 * O problema é que o Solidcom não avisa ninguém quando fecha a venda, e o
 * `EcommerceSolidconStatus` NÃO serve de sinal: a transição `5 → 6` pertence à
 * esteira do app coletor deles, que a gente pula de propósito. Pedido nosso
 * fica em `1` para sempre, mesmo faturado.
 *
 * O sinal certo é `hrRegistro` na `tbPedido` do banco DORSAL — preenchido em
 * 386/386 dos fechados e em nenhum não-fechado (ver docs/solidcom-api.md).
 *
 * Por que isso roda aqui, no PC da loja, e não na API: a VPS **não tem rota**
 * para `10.13.0.2`. Não é escolha de arquitetura, é a rede.
 *
 * Este módulo é a lógica pura — quem faz I/O entra por parâmetro, então dá
 * pra testar a conciliação inteira sem banco e sem rede.
 */

/**
 * Um ciclo de conciliação: quem está esperando o caixa já foi faturado?
 *
 * @param {object} io
 * @param {() => Promise<Array<{id: string, erpDav: string|null}>>} io.listarPendentes
 *        pedidos em READY_FOR_CHECKOUT (a fila que a API expõe)
 * @param {(davs: string[]) => Promise<Array<{dav: string, hrRegistro: string, coo?: number, nrCupom?: number}>>} io.consultarFaturados
 *        consulta ao DORSAL, só os DAVs que interessam
 * @param {(orderId: string, fiscal: object) => Promise<void>} io.marcarFaturado
 * @param {(msg: string) => void} io.log
 */
async function conciliarFaturamento({ listarPendentes, consultarFaturados, marcarFaturado, log }) {
  const pendentes = await listarPendentes()

  // Sem ninguém esperando o caixa, nem abre conexão com o banco da loja. O
  // ciclo roda a cada minuto e na maior parte do dia não há nada a fazer --
  // conectar à toa só gera ruído no SQL Server deles.
  if (!pendentes || pendentes.length === 0) {
    return { verificados: 0, liberados: 0, semDav: 0 }
  }

  // Pedido sem DAV nunca chegou ao Solidcom (ex.: o PostPedido falhou), então
  // não existe lá pra ser faturado. Não é erro deste agente -- é pedido que
  // precisa ser reenviado ou cancelado, e quem cuida disso é outra tela.
  const porDav = new Map()
  let semDav = 0
  for (const pedido of pendentes) {
    const dav = pedido && pedido.erpDav ? String(pedido.erpDav).trim() : ''
    if (!dav) {
      semDav += 1
      continue
    }
    porDav.set(dav, pedido)
  }

  if (porDav.size === 0) {
    return { verificados: 0, liberados: 0, semDav }
  }

  const faturados = await consultarFaturados([...porDav.keys()])

  let liberados = 0
  for (const registro of faturados || []) {
    const pedido = porDav.get(String(registro.dav).trim())
    // DAV que voltou da consulta e não está na fila: ou a fila mudou entre as
    // duas chamadas, ou é venda de balcão com número parecido. Ignorar é o
    // certo -- liberar pedido que ninguém pediu seria pior.
    if (!pedido) continue

    try {
      await marcarFaturado(pedido.id, {
        hrRegistro: registro.hrRegistro,
        coo: registro.coo,
        nrCupom: registro.nrCupom,
      })
      liberados += 1
      log(`pedido ${pedido.id.slice(-8).toUpperCase()} (DAV ${registro.dav}) faturado no PDV -> liberado pra entrega`)
    } catch (erro) {
      // Um pedido que falha não pode impedir os outros de serem liberados: a
      // fila é compartilhada e um erro pontual (rede, 500) travaria todo mundo
      // atrás dele. O próximo ciclo tenta de novo -- marcar faturado é
      // idempotente do lado da API (devolve `jaEstava`).
      log(`falha ao liberar ${pedido.id.slice(-8).toUpperCase()} (DAV ${registro.dav}): ${erro.message}`)
    }
  }

  return { verificados: porDav.size, liberados, semDav }
}

module.exports = { conciliarFaturamento }
