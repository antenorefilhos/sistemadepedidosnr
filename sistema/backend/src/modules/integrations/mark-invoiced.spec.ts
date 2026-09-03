import { BadRequestException, NotFoundException } from '@nestjs/common'
import { OrderOrchestrationService } from './order-orchestration.service'

/**
 * O gatilho de faturamento do PDV.
 *
 * O agente da loja roda em loop e reporta os pedidos que o `hrRegistro` do
 * banco DORSAL mostra como fechados. Duas coisas tem que estar certas aqui, e
 * as duas so aparecem em producao:
 *
 * 1. IDEMPOTENCIA -- o agente pode reportar o mesmo pedido de novo (retry,
 *    duas instancias abertas, resposta perdida). Se a segunda chamada
 *    devolvesse erro, o agente ficaria logando falha pra sempre no mesmo
 *    pedido, e "esta falhando" viraria ruido permanente.
 * 2. Retirada NAO vira "pronto pra entrega" -- o cliente e quem busca, e o
 *    aviso que ele recebe e outro.
 */
const build = (order: Record<string, unknown> | null) => {
  const prisma = {
    order: {
      findFirst: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    orderEvent: { create: jest.fn().mockResolvedValue({}) },
  }
  const notifications = {
    notifyOrderStatusChange: jest.fn().mockResolvedValue(undefined),
    notifyDeliveryTeamOrderReady: jest.fn().mockResolvedValue(undefined),
  }
  const service = new OrderOrchestrationService(
    {} as never, prisma as never, {} as never, {} as never, notifications as never,
  )
  return { service, prisma, notifications }
}

const pedido = (over: Record<string, unknown> = {}) => ({
  id: 'ord1',
  status: 'READY_FOR_CHECKOUT',
  fulfillmentType: 'DELIVERY',
  erpDav: '102039',
  ...over,
})

describe('markInvoiced', () => {
  it('entrega vai pra READY_FOR_DELIVERY e avisa o cliente', async () => {
    const { service, prisma, notifications } = build(pedido())
    await expect(service.markInvoiced(undefined, 'ord1', {})).resolves.toMatchObject({
      status: 'READY_FOR_DELIVERY',
      jaEstava: false,
    })
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'READY_FOR_DELIVERY' } }),
    )
    expect(notifications.notifyOrderStatusChange).toHaveBeenCalledWith('ord1', 'READY_FOR_DELIVERY')
    // A equipe de entrega e avisada no mesmo instante: e quando o pedido
    // aparece na fila compartilhada.
    expect(notifications.notifyDeliveryTeamOrderReady).toHaveBeenCalledWith('ord1')
  })

  it('retirada vai pra READY_FOR_PICKUP, nao pra entrega', async () => {
    const { service, notifications } = build(pedido({ fulfillmentType: 'PICKUP' }))
    await expect(service.markInvoiced(undefined, 'ord1', {})).resolves.toMatchObject({
      status: 'READY_FOR_PICKUP',
    })
    expect(notifications.notifyOrderStatusChange).toHaveBeenCalledWith('ord1', 'READY_FOR_PICKUP')
    // Retirada na loja nao tem entrega -- nao acorda o entregador a toa.
    expect(notifications.notifyDeliveryTeamOrderReady).not.toHaveBeenCalled()
  })

  it('reportar de novo e no-op, nao erro', async () => {
    const { service, prisma, notifications } = build(pedido({ status: 'READY_FOR_DELIVERY' }))
    await expect(service.markInvoiced(undefined, 'ord1', {})).resolves.toMatchObject({
      jaEstava: true,
    })
    expect(prisma.order.update).not.toHaveBeenCalled()
    // Nao renotifica: o cliente ja recebeu o aviso na primeira vez.
    expect(notifications.notifyOrderStatusChange).not.toHaveBeenCalled()
  })

  it('recusa pedido que nem chegou ao caixa', async () => {
    const { service } = build(pedido({ status: 'PICKING' }))
    await expect(service.markInvoiced(undefined, 'ord1', {})).rejects.toBeInstanceOf(BadRequestException)
  })

  it('recusa pedido inexistente', async () => {
    const { service } = build(null)
    await expect(service.markInvoiced(undefined, 'ord1', {})).rejects.toBeInstanceOf(NotFoundException)
  })

  it('grava os dados fiscais no evento, pra auditoria', async () => {
    const { service, prisma } = build(pedido())
    await service.markInvoiced(undefined, 'ord1', { hrRegistro: '2026-08-19T18:27:12', coo: 202030, nrCupom: 203255 })
    expect(prisma.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'order.invoiced',
          payload: expect.objectContaining({ coo: 202030, nrCupom: 203255, dav: '102039' }),
        }),
      }),
    )
  })

  // Push fora do ar nao pode impedir o pedido de avancar, senao o agente
  // reprocessa o mesmo pedido em loop por causa de notificacao.
  it('falha de notificacao nao derruba o faturamento', async () => {
    const { service, notifications } = build(pedido())
    notifications.notifyOrderStatusChange.mockRejectedValue(new Error('push fora do ar'))
    await expect(service.markInvoiced(undefined, 'ord1', {})).resolves.toMatchObject({
      status: 'READY_FOR_DELIVERY',
    })
  })
})

describe('listPendingInvoice', () => {
  it('so pedido aguardando o caixa E com DAV', async () => {
    const { service, prisma } = build(null)
    await service.listPendingInvoice()
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'READY_FOR_CHECKOUT',
          erpDav: { not: null },
        }),
      }),
    )
  })
})
