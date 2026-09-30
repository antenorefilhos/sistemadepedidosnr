import { formaDoCaixa, PaymentsOverviewService } from './payments-overview.service'

describe('formaDoCaixa', () => {
  it.each([
    ['Dinheiro', 'CASH'],
    ['PIX', 'PIX'],
    ['Pix QR Code', 'PIX'],
    ['Cartão Débito', 'CARD'],
    ['CARTAO CREDITO', 'CARD'],
    ['Vale Alimentação', 'VOUCHER'],
    ['Ticket Refeição', 'VOUCHER'],
    ['Cheque', 'OTHER'],
  ])('%s -> %s', (descricao, forma) => {
    expect(formaDoCaixa(descricao)).toBe(forma)
  })
})

describe('PaymentsOverviewService', () => {
  // DAV 102115 real: aprovado 116,39+10 no site, separado 104,03+10, cupom 104,03,
  // registrado como Dinheiro no caixa (o cliente escolheu PIX).
  const build = (status = 'COMPLETED', invoiced = true) => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'o1', erpDav: '102115', status, fulfillmentType: 'DELIVERY', paymentMethod: 'PIX', total: 114.03, delivery: 10, discount: 0, notes: 'Troco para: 150', createdAt: new Date('2026-09-28T12:00:00Z'), customer: { name: 'Cliente' } },
        ]),
      },
      orderEvent: {
        findMany: jest.fn().mockResolvedValue([
          { orderId: 'o1', type: 'order.created', payload: { total: 126.39 }, createdAt: new Date('2026-09-28T12:00:00Z') },
          ...(invoiced
            ? [
                { orderId: 'o1', type: 'order.invoiced', payload: {}, createdAt: new Date('2026-09-28T12:40:00Z') },
                { orderId: 'o1', type: 'order.invoice_diverged', payload: { pagamento: { valorCupom: 104.03, meios: [{ descricao: 'Dinheiro', valor: 114.03, troco: 10 }] } }, createdAt: new Date() },
              ]
            : []),
        ]),
        findFirst: jest.fn().mockResolvedValue({ createdAt: new Date('2026-09-07T00:00:00Z') }),
      },
    }
    return new PaymentsOverviewService(prisma as never)
  }

  it('cupom + frete bate com o separado; ajuste da separacao e forma trocada aparecem', async () => {
    const { orders, summary, byMethod } = await build().overview('t', 30)
    expect(orders[0]).toMatchObject({ approved: 126.39, total: 114.03, pickingAdjust: -12.36, charged: 114.03, cashierDiff: 0, changeFor: '150', methodMismatch: true, flags: [] })
    expect(summary).toMatchObject({ withCupom: 1, methodMismatch: 1, cashierDiff: 0 })
    expect(byMethod).toEqual(expect.arrayContaining([expect.objectContaining({ method: 'PIX', siteOrders: 1, pdvOrders: 0 }), expect.objectContaining({ method: 'CASH', siteOrders: 0, pdvOrders: 1 })]))
  })

  it('entregue sem cupom depois que o aviso de faturamento existe vira alerta', async () => {
    const { orders } = await build('DELIVERED', false).overview('t', 30)
    expect(orders[0].flags).toEqual(['SAIU_SEM_CUPOM'])
    expect(orders[0].charged).toBeNull()
  })
})
