import { BadRequestException } from '@nestjs/common'
import { DeliveryService } from './delivery.service'

/**
 * Pedido cancelado com a parada aberta (30/09/2026, DAV 102120): o cupom foi
 * cancelado no PDV com o pedido ja na rota e o app o levou de volta a "saiu
 * para entrega". So "Nao entregue" fecha a parada; o status nunca regride.
 */
const build = (orderStatus: string, stopStatus = 'OUT_FOR_DELIVERY') => {
  const prisma = {
    deliveryRoute: {
      findFirst: jest.fn().mockResolvedValue({ id: 'r1', status: 'OUT_FOR_DELIVERY', stops: [{ id: 'st1', status: stopStatus }] }),
      update: jest.fn().mockResolvedValue({}),
    },
    deliveryStop: {
      findFirst: jest.fn().mockResolvedValue({ id: 'st1', routeId: 'r1', orderId: 'o1', status: stopStatus }),
      update: jest.fn().mockResolvedValue({}),
    },
    order: {
      findFirst: jest.fn().mockResolvedValue({ status: orderStatus }),
      update: jest.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 'P2025' })),
    },
    orderEvent: { create: jest.fn().mockResolvedValue({}) },
    fulfillmentEvent: { create: jest.fn().mockResolvedValue({}) },
  }
  const notifications = { notifyOrderStatusChange: jest.fn().mockResolvedValue(undefined) }
  return { service: new DeliveryService(prisma as never, notifications as never), prisma, notifications }
}

describe('parada de pedido cancelado', () => {
  it.each(['ARRIVED', 'DELIVERED'])('recusa %s', async (status) => {
    const { service, prisma } = build('CANCELLED', status === 'DELIVERED' ? 'ARRIVED' : 'OUT_FOR_DELIVERY')
    await expect(service.updateStopStatus('r1', 'st1', undefined, { status, notes: 'x' } as never)).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.deliveryStop.update).not.toHaveBeenCalled()
  })

  it('aceita "Nao entregue" de qualquer etapa aberta, sem avisar o cliente de falha', async () => {
    const { service, prisma, notifications } = build('CANCELLED', 'OUT_FOR_DELIVERY')
    await service.updateStopStatus('r1', 'st1', undefined, { status: 'FAILED', notes: 'cancelado, devolvido' } as never)
    expect(prisma.deliveryStop.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }))
    expect(notifications.notifyOrderStatusChange).not.toHaveBeenCalled()
  })

  it('iniciar rota nao tira o pedido de CANCELLED', async () => {
    const { service, prisma } = build('CANCELLED')
    const result = await (service as unknown as {
      updateOrderFulfillmentStatus: (...a: unknown[]) => Promise<unknown>
    }).updateOrderFulfillmentStatus({ tenantId: 't', storeId: 's' }, 'o1', 'OUT_FOR_DELIVERY', 'order.out_for_delivery', {})
    expect(result).toBeNull()
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o1', status: { notIn: ['CANCELLED', 'REFUNDED'] } } }))
    expect(prisma.orderEvent.create).not.toHaveBeenCalled()
  })
})
