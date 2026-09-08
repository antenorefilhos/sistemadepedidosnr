/**
 * Reconciliacao entre o que o cliente pediu e o que o PDV realmente faturou.
 *
 * Existe por causa do item pesavel: o cliente pede 0,800 kg de alcatra, a
 * balanca do caixa da 0,845 kg, e o cupom cobra o peso real. Ate 08/09/2026
 * nada comparava os dois -- o historico do cliente mostrava um valor que nao
 * foi o cobrado. Em supermercado isso nao e caso de borda, e a regra.
 *
 * Logica pura de proposito: sem Prisma, sem HTTP. Quem busca os dados e quem
 * grava o resultado fica de fora, entao isto roda em teste sem banco e sem
 * rede -- e a regra de negocio pode ser lida num arquivo so.
 */

export type ItemPedido = {
  /** `cdProduto` do ERP. Chave primaria de cruzamento quando existe. */
  erpProductId?: number | null
  ean?: string | null
  /** EANs alternativos do mesmo produto. 1.370 produtos tem mais de um. */
  secondaryEans?: string[] | null
  name?: string | null
  quantity: number
  unitPrice: number
}

export type ItemFaturado = {
  cdProduto?: number | null
  ean?: string | null
  descricao?: string | null
  qtdFaturada: number
  vlUnitario: number
  vlTotal?: number | null
  canceladoNoCaixa?: boolean | null
}

export type SituacaoItem =
  /** Pedido e faturado, mesma quantidade. */
  | 'CONFERE'
  /** Pedido e faturado, quantidade diferente (tipico de pesavel). */
  | 'QUANTIDADE_DIVERGENTE'
  /** Estava no pedido e nao saiu no cupom -- faltou ou foi cancelado no caixa. */
  | 'NAO_FATURADO'
  /** Saiu no cupom e nao estava no pedido -- acrescentado no caixa. */
  | 'ADICIONADO_NO_CAIXA'

export type ItemReconciliado = {
  situacao: SituacaoItem
  nome: string
  erpProductId: number | null
  ean: string | null
  qtdPedida: number | null
  qtdFaturada: number | null
  valorPedido: number
  valorFaturado: number
  /** Positivo = o cliente pagou a mais. */
  diferenca: number
}

export type Reconciliacao = {
  itens: ItemReconciliado[]
  totalPedido: number
  totalFaturado: number
  /** Positivo = cobrado acima do que o cliente aprovou. */
  diferenca: number
  /** `true` quando ha qualquer coisa que valha mostrar a um humano. */
  temDivergencia: boolean
}

const centavos = (n: number) => Math.round(n * 100)
const doisDecimais = (n: number) => Math.round(n * 100) / 100

/**
 * Chaves pelas quais um item do pedido pode casar com um do cupom.
 *
 * `cdProduto` primeiro, e nao por elegancia: a pre-venda grava o EAN principal
 * e o operador le o que estiver na embalagem. Ja vimos o fermento Royal gravado
 * como `7622300119621` e faturado como `7622300119607` -- mesmo produto,
 * `cdProduto 1767`. Cruzar so por EAN perde esses.
 */
function chavesDoPedido(item: ItemPedido): string[] {
  const chaves: string[] = []
  if (item.erpProductId != null) chaves.push(`p:${item.erpProductId}`)
  if (item.ean) chaves.push(`e:${item.ean}`)
  for (const alt of item.secondaryEans || []) {
    if (alt) chaves.push(`e:${alt}`)
  }
  return chaves
}

function chavesDoFaturado(item: ItemFaturado): string[] {
  const chaves: string[] = []
  if (item.cdProduto != null) chaves.push(`p:${item.cdProduto}`)
  if (item.ean) chaves.push(`e:${item.ean}`)
  return chaves
}

export function reconcileInvoicedItems(
  pedidos: ItemPedido[],
  faturados: ItemFaturado[],
): Reconciliacao {
  const itens: ItemReconciliado[] = []
  const faturadosUsados = new Set<number>()

  // Indice das linhas do cupom por todas as suas chaves possiveis.
  const indice = new Map<string, number[]>()
  faturados.forEach((f, i) => {
    for (const k of chavesDoFaturado(f)) {
      const lista = indice.get(k) || []
      lista.push(i)
      indice.set(k, lista)
    }
  })

  for (const pedido of pedidos) {
    let idx = -1
    for (const k of chavesDoPedido(pedido)) {
      const candidato = (indice.get(k) || []).find((i) => !faturadosUsados.has(i))
      if (candidato !== undefined) {
        idx = candidato
        break
      }
    }

    const valorPedido = doisDecimais(pedido.quantity * pedido.unitPrice)

    if (idx === -1) {
      itens.push({
        situacao: 'NAO_FATURADO',
        nome: pedido.name || pedido.ean || 'Item',
        erpProductId: pedido.erpProductId ?? null,
        ean: pedido.ean ?? null,
        qtdPedida: pedido.quantity,
        qtdFaturada: null,
        valorPedido,
        valorFaturado: 0,
        diferenca: doisDecimais(-valorPedido),
      })
      continue
    }

    faturadosUsados.add(idx)
    const f = faturados[idx]

    // Item cancelado no caixa e o mesmo caso de nao faturado para o cliente:
    // ele nao levou e nao pode pagar. A flag do ERP so nos poupa de deduzir.
    if (f.canceladoNoCaixa) {
      itens.push({
        situacao: 'NAO_FATURADO',
        nome: f.descricao || pedido.name || 'Item',
        erpProductId: f.cdProduto ?? pedido.erpProductId ?? null,
        ean: f.ean ?? pedido.ean ?? null,
        qtdPedida: pedido.quantity,
        qtdFaturada: 0,
        valorPedido,
        valorFaturado: 0,
        diferenca: doisDecimais(-valorPedido),
      })
      continue
    }

    const valorFaturado = doisDecimais(f.vlTotal ?? f.qtdFaturada * f.vlUnitario)
    const mesmaQuantidade = centavos(pedido.quantity) === centavos(f.qtdFaturada)

    itens.push({
      situacao: mesmaQuantidade ? 'CONFERE' : 'QUANTIDADE_DIVERGENTE',
      nome: f.descricao || pedido.name || 'Item',
      erpProductId: f.cdProduto ?? pedido.erpProductId ?? null,
      ean: f.ean ?? pedido.ean ?? null,
      qtdPedida: pedido.quantity,
      qtdFaturada: f.qtdFaturada,
      valorPedido,
      valorFaturado,
      diferenca: doisDecimais(valorFaturado - valorPedido),
    })
  }

  // Sobrou linha de cupom sem par: entrou no caixa e ninguem pediu.
  faturados.forEach((f, i) => {
    if (faturadosUsados.has(i) || f.canceladoNoCaixa) return
    const valorFaturado = doisDecimais(f.vlTotal ?? f.qtdFaturada * f.vlUnitario)
    itens.push({
      situacao: 'ADICIONADO_NO_CAIXA',
      nome: f.descricao || f.ean || 'Item',
      erpProductId: f.cdProduto ?? null,
      ean: f.ean ?? null,
      qtdPedida: null,
      qtdFaturada: f.qtdFaturada,
      valorPedido: 0,
      valorFaturado,
      diferenca: valorFaturado,
    })
  })

  const totalPedido = doisDecimais(itens.reduce((s, i) => s + i.valorPedido, 0))
  const totalFaturado = doisDecimais(itens.reduce((s, i) => s + i.valorFaturado, 0))

  return {
    itens,
    totalPedido,
    totalFaturado,
    diferenca: doisDecimais(totalFaturado - totalPedido),
    temDivergencia: itens.some((i) => i.situacao !== 'CONFERE'),
  }
}
