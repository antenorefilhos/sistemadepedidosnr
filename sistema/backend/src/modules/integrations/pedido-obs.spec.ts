import { OrderOrchestrationService } from './order-orchestration.service'

/**
 * A `obs` do pedido enviado ao Solidcom.
 *
 * E o unico canal que o separador da loja tem: ele abre o pedido no PDV
 * Concentrador e le esse texto. Comparando um pedido nosso (DAV 102039) com um
 * feito pelo app deles (DAV 102063) em 02/09/2026, o deles trazia
 * "Aceita troca: Sim" e o nosso nao trazia nada -- o dado existia no nosso
 * banco (`OrderItem.substitutionPolicy`, escolhido pelo cliente no carrinho) e
 * simplesmente nao era enviado.
 *
 * Consequencia pratica: substituir sem permissao gera devolucao; nao
 * substituir quando o cliente aceitava perde a venda do item.
 */
const build = () =>
  new OrderOrchestrationService({} as never, {} as never, {} as never, {} as never, {} as never)

const obs = (service: OrderOrchestrationService, payload: unknown) =>
  (service as unknown as { buildPedidoObs: (p: unknown) => string }).buildPedidoObs(payload)

const item = (policy?: string) => ({ productId: 'p', quantity: 1, substitutionPolicy: policy })

const pedido = (over: Record<string, unknown> = {}) => ({
  paymentMethod: 'PIX',
  notes: null,
  items: [item('ALLOW')],
  ...over,
})

describe('buildPedidoObs — resumo de troca', () => {
  it('todos os itens aceitam -> "Sim"', () => {
    expect(obs(build(), pedido({ items: [item('ALLOW'), item('ALLOW')] }))).toContain('Aceita troca: Sim')
  })

  it('nenhum aceita -> "Nao"', () => {
    expect(obs(build(), pedido({ items: [item('DENY'), item('DENY')] }))).toContain('Aceita troca: Nao')
  })

  // O separador precisa saber que ha excecao, mesmo sem a lista -- o detalhe
  // por produto quem mostra e o nosso picking-app.
  it('misto -> "Parcial" com a contagem', () => {
    expect(obs(build(), pedido({ items: [item('ALLOW'), item('DENY'), item('ALLOW')] })))
      .toContain('Aceita troca: Parcial (2/3 itens)')
  })

  it('item sem politica definida conta como aceita', () => {
    expect(obs(build(), pedido({ items: [item(undefined)] }))).toContain('Aceita troca: Sim')
  })

  it('pedido sem itens nao inventa rotulo de troca', () => {
    expect(obs(build(), pedido({ items: [] }))).not.toContain('Aceita troca')
  })

  it('mantem recado do cliente e forma de pagamento, nessa ordem', () => {
    const texto = obs(build(), pedido({ notes: 'Chamar no portao', paymentMethod: 'CARD' }))
    expect(texto).toBe('Chamar no portao / Aceita troca: Sim / Pgto: Cartao na entrega')
  })

  // O ERP quebra com null (Dorsal/Pedido.cs chama .Length sem checar) -- ver
  // CLAUDE.md. String vazia passa.
  it('nunca devolve null, mesmo sem nada pra dizer', () => {
    expect(typeof obs(build(), { paymentMethod: '', notes: null, items: [] })).toBe('string')
  })
})
