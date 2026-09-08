import { reconcileInvoicedItems } from './order-reconciliation'

describe('reconcileInvoicedItems', () => {
  it('item pesavel: a balanca deu mais que o pedido, e a diferenca aparece em reais', () => {
    const r = reconcileInvoicedItems(
      [{ erpProductId: 900, name: 'ALCATRA kg', quantity: 0.8, unitPrice: 49.9 }],
      [{ cdProduto: 900, descricao: 'ALCATRA kg', qtdFaturada: 0.845, vlUnitario: 49.9, vlTotal: 42.17 }],
    )

    expect(r.itens[0].situacao).toBe('QUANTIDADE_DIVERGENTE')
    expect(r.totalPedido).toBe(39.92)
    expect(r.totalFaturado).toBe(42.17)
    // O cliente aprovou R$ 39,92 e pagou R$ 42,17. E este numero que ele precisa ver.
    expect(r.diferenca).toBe(2.25)
    expect(r.temDivergencia).toBe(true)
  })

  it('casa pelo cdProduto mesmo quando o caixa leu um EAN diferente', () => {
    // Caso real: pre-venda gravou 7622300119621, o operador leu 7622300119607
    // na lata. Mesmo produto (cdProduto 1767). Cruzar so por EAN perderia.
    const r = reconcileInvoicedItems(
      [{ erpProductId: 1767, ean: '7622300119621', name: 'FERMENTO ROYAL', quantity: 1, unitPrice: 6.69 }],
      [{ cdProduto: 1767, ean: '7622300119607', descricao: 'FERMENTO QUIMICO PO ROYAL', qtdFaturada: 1, vlUnitario: 6.69 }],
    )

    expect(r.itens).toHaveLength(1)
    expect(r.itens[0].situacao).toBe('CONFERE')
    expect(r.temDivergencia).toBe(false)
  })

  it('casa por EAN secundario quando o cdProduto nao veio', () => {
    const r = reconcileInvoicedItems(
      [{ ean: '7898910528737', secondaryEans: ['644'], name: 'BROCOLIS', quantity: 2, unitPrice: 6.99 }],
      [{ ean: '644', descricao: 'BROCOLIS AMERICANO', qtdFaturada: 2, vlUnitario: 6.99 }],
    )

    expect(r.itens[0].situacao).toBe('CONFERE')
  })

  it('item do cupom que ninguem pediu vira ADICIONADO_NO_CAIXA', () => {
    const r = reconcileInvoicedItems(
      [{ erpProductId: 137, name: 'OLEO', quantity: 1, unitPrice: 9.95 }],
      [
        { cdProduto: 137, descricao: 'OLEO SOJA SOYA', qtdFaturada: 1, vlUnitario: 9.95 },
        { cdProduto: 1484, descricao: 'ACUCAR REFINADO UNIAO', qtdFaturada: 1, vlUnitario: 4.99 },
      ],
    )

    const extra = r.itens.find((i) => i.situacao === 'ADICIONADO_NO_CAIXA')
    expect(extra?.nome).toBe('ACUCAR REFINADO UNIAO')
    expect(extra?.qtdPedida).toBeNull()
    // O cliente esta pagando por algo que nao pediu -- tem que aparecer.
    expect(r.diferenca).toBe(4.99)
  })

  it('item cancelado no caixa nao e cobrado e nao vira "adicionado"', () => {
    const r = reconcileInvoicedItems(
      [
        { erpProductId: 137, name: 'OLEO', quantity: 1, unitPrice: 9.95 },
        { erpProductId: 200, name: 'VINHO', quantity: 1, unitPrice: 30 },
      ],
      [
        { cdProduto: 137, descricao: 'OLEO', qtdFaturada: 1, vlUnitario: 9.95 },
        { cdProduto: 200, descricao: 'VINHO', qtdFaturada: 1, vlUnitario: 30, canceladoNoCaixa: true },
      ],
    )

    const vinho = r.itens.find((i) => i.nome === 'VINHO')
    expect(vinho?.situacao).toBe('NAO_FATURADO')
    expect(vinho?.valorFaturado).toBe(0)
    expect(r.totalFaturado).toBe(9.95)
    // A linha cancelada nao pode reaparecer como item adicionado no caixa.
    expect(r.itens.filter((i) => i.situacao === 'ADICIONADO_NO_CAIXA')).toHaveLength(0)
  })

  it('item pedido que nao saiu no cupom conta como nao faturado', () => {
    const r = reconcileInvoicedItems(
      [
        { erpProductId: 137, name: 'OLEO', quantity: 1, unitPrice: 9.95 },
        { erpProductId: 555, name: 'PAO', quantity: 1, unitPrice: 8 },
      ],
      [{ cdProduto: 137, descricao: 'OLEO', qtdFaturada: 1, vlUnitario: 9.95 }],
    )

    expect(r.itens.find((i) => i.nome === 'PAO')?.situacao).toBe('NAO_FATURADO')
    expect(r.diferenca).toBe(-8)
  })

  it('nao casa duas linhas do pedido com a mesma linha do cupom', () => {
    // Dois itens distintos do pedido sem cdProduto e com o mesmo EAN nao podem
    // consumir a mesma linha do cupom -- senao um deles "some" do relatorio.
    const r = reconcileInvoicedItems(
      [
        { ean: '111', name: 'A', quantity: 1, unitPrice: 10 },
        { ean: '111', name: 'B', quantity: 1, unitPrice: 10 },
      ],
      [{ ean: '111', descricao: 'A', qtdFaturada: 1, vlUnitario: 10 }],
    )

    expect(r.itens).toHaveLength(2)
    expect(r.itens.map((i) => i.situacao).sort()).toEqual(['CONFERE', 'NAO_FATURADO'])
  })

  it('pedido conferido inteiro nao acusa divergencia', () => {
    const r = reconcileInvoicedItems(
      [{ erpProductId: 137, name: 'OLEO', quantity: 2, unitPrice: 9.95 }],
      [{ cdProduto: 137, descricao: 'OLEO', qtdFaturada: 2, vlUnitario: 9.95, vlTotal: 19.9 }],
    )

    expect(r.temDivergencia).toBe(false)
    expect(r.diferenca).toBe(0)
  })

  it('payload real do DAV 102071 (v1.7.1): conta a historia inteira do caixa', () => {
    // Copiado literalmente de GET /pedidos/2073/itens-faturados em 08/09/2026.
    // Serve de fixture de contrato: se o formato da AntenorApi mudar, este
    // teste quebra antes de a divergencia virar numero errado na tela.
    const faturados = [
      { nrItem: 1, cdProduto: 137, ean: '7891107101621', descricao: 'OLEO SOJA SOYA PET 900ml',
        qtdPedida: 1, qtdFaturada: 1, vlUnitario: 9.95, vlTotal: 9.95,
        canceladoNoCaixa: false, adicionadoNoCaixa: false },
      { nrItem: 2, cdProduto: 1767, ean: '7622300119607', descricao: 'FERMENTO QUIMICO PO ROYAL POTE 100g',
        qtdPedida: 1, qtdFaturada: 1, vlUnitario: 6.69, vlTotal: 6.69,
        canceladoNoCaixa: false, adicionadoNoCaixa: false },
      { nrItem: 3, cdProduto: 1484, ean: '7891910000197', descricao: 'ACUCAR REFINADO UNIAO PCT 1kg',
        qtdPedida: null, qtdFaturada: 1, vlUnitario: 4.99, vlTotal: 4.99,
        canceladoNoCaixa: false, adicionadoNoCaixa: true },
      { nrItem: 4, cdProduto: 23599, ean: null, descricao: 'FERMENTO QUIMICO PO DONA BENTA POTE',
        qtdPedida: 0, qtdFaturada: 0, vlUnitario: 6.49, vlTotal: 0,
        canceladoNoCaixa: true, adicionadoNoCaixa: false },
    ]

    // O pedido como o cliente aprovou: oleo, o fermento Dona Benta (que o caixa
    // cancelou) e o Royal que entrou no lugar.
    const pedido = [
      { erpProductId: 137, ean: '7891107101621', name: 'OLEO SOJA SOYA', quantity: 1, unitPrice: 9.95 },
      { erpProductId: 23599, name: 'FERMENTO DONA BENTA', quantity: 1, unitPrice: 6.49 },
      { erpProductId: 1767, ean: '7622300119621', name: 'FERMENTO ROYAL', quantity: 1, unitPrice: 6.69 },
    ]

    const r = reconcileInvoicedItems(pedido, faturados)
    const por = (s: string) => r.itens.filter((i) => i.situacao === s)

    expect(por('CONFERE').map((i) => i.erpProductId).sort()).toEqual([137, 1767])
    // Cancelado no caixa: o cliente nao levou, entao nao paga.
    expect(por('NAO_FATURADO')[0].erpProductId).toBe(23599)
    expect(por('NAO_FATURADO')[0].valorFaturado).toBe(0)
    // Acrescentado no caixa: ele PAGA por algo que nao pediu.
    expect(por('ADICIONADO_NO_CAIXA')[0].nome).toBe('ACUCAR REFINADO UNIAO PCT 1kg')

    // Aprovou 23,13; pagou 21,63. A diferenca de -1,50 e a conta do
    // Dona Benta que saiu menos o acucar que entrou.
    expect(r.totalPedido).toBe(23.13)
    expect(r.totalFaturado).toBe(21.63)
    expect(r.diferenca).toBe(-1.5)
    expect(r.temDivergencia).toBe(true)
  })

})
