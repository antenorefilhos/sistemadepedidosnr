import { BadRequestException, NotFoundException } from '@nestjs/common'
import { DeliveryService } from './delivery.service'

/**
 * "Pegar" um pedido da fila compartilhada.
 *
 * Dois entregadores tocando no mesmo pedido ao mesmo tempo e o caso NORMAL numa
 * fila compartilhada, nao a excecao. A unicidade do schema e `[routeId,
 * orderId]`: impede o mesmo pedido duas vezes na mesma rota, mas nao em rotas
 * diferentes -- entao sem a checagem os dois levariam o pedido, e o cliente
 * receberia duas entregas.
 */
// READY_FOR_DELIVERY = ja passou pelo PDV. READY_FOR_CHECKOUT e o estado
// "esperando o caixa" e NAO pode ser pego -- entregar antes de faturar e
// problema fiscal, nao so de processo.
const PEDIDO_OK = { id: 'ord1', status: 'READY_FOR_DELIVERY', fulfillmentType: 'DELIVERY' }

const build = (opts: {
  pedido?: Record<string, unknown> | null
  paradaExistente?: Record<string, unknown> | null
  rotaAberta?: Record<string, unknown> | null
} = {}) => {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue(opts.pedido === null ? [] : [opts.pedido ?? PEDIDO_OK]),
    deliveryStop: {
      findFirst: jest.fn().mockResolvedValue(opts.paradaExistente ?? null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'stop1' }),
    },
    deliveryRoute: {
      findFirst: jest.fn().mockResolvedValue(opts.rotaAberta ?? null),
      create: jest.fn().mockResolvedValue({ id: 'rota-nova' }),
    },
  }
  const prisma = {
    $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    orderEvent: { create: jest.fn().mockResolvedValue({}) },
    deliveryRoute: {
      findFirst: jest.fn().mockResolvedValue({ id: 'rota-nova', stops: [], driver: null }),
    },
  }
  return { service: new DeliveryService(prisma as never, {} as never), tx, prisma }
}

describe('takeDelivery — fila compartilhada', () => {
  it('trava a linha do pedido antes de decidir (FOR UPDATE)', async () => {
    const { service, tx } = build()
    await service.takeDelivery(undefined, 'ord1', 'drv1')
    const sql = tx.$queryRaw.mock.calls[0][0].join('')
    expect(sql).toMatch(/FOR UPDATE/)
  })

  it('recusa quando outro entregador ja pegou', async () => {
    const { service } = build({ paradaExistente: { id: 'stop-existente' } })
    await expect(service.takeDelivery(undefined, 'ord1', 'drv2')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('recusa pedido de retirada', async () => {
    const { service } = build({ pedido: { ...PEDIDO_OK, fulfillmentType: 'PICKUP' } })
    await expect(service.takeDelivery(undefined, 'ord1', 'drv1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('recusa pedido que ainda nao saiu da separacao', async () => {
    const { service } = build({ pedido: { ...PEDIDO_OK, status: 'PICKING' } })
    await expect(service.takeDelivery(undefined, 'ord1', 'drv1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('recusa pedido que saiu da separacao mas ainda nao foi faturado no PDV', async () => {
    const { service } = build({ pedido: { ...PEDIDO_OK, status: 'READY_FOR_CHECKOUT' } })
    await expect(service.takeDelivery(undefined, 'ord1', 'drv1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('recusa pedido inexistente', async () => {
    const { service } = build({ pedido: null })
    await expect(service.takeDelivery(undefined, 'ord1', 'drv1')).rejects.toBeInstanceOf(NotFoundException)
  })

  // Sem reaproveitar, cada pedido viraria uma rota de uma parada so, e o app do
  // entregador mostraria uma lista de rotas em vez de uma entrega com paradas.
  it('reaproveita a rota aberta do entregador em vez de criar outra', async () => {
    const { service, tx } = build({ rotaAberta: { id: 'rota-existente' } })
    await service.takeDelivery(undefined, 'ord1', 'drv1')
    expect(tx.deliveryRoute.create).not.toHaveBeenCalled()
    expect(tx.deliveryStop.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ routeId: 'rota-existente' }) }),
    )
  })

  it('cria rota quando o entregador nao tem nenhuma aberta', async () => {
    const { service, tx } = build()
    await service.takeDelivery(undefined, 'ord1', 'drv1')
    expect(tx.deliveryRoute.create).toHaveBeenCalled()
  })

  it('numera a parada em sequencia', async () => {
    const { service, tx } = build({ rotaAberta: { id: 'r1' } })
    tx.deliveryStop.count.mockResolvedValue(2)
    await service.takeDelivery(undefined, 'ord1', 'drv1')
    expect(tx.deliveryStop.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sequence: 3 }) }),
    )
  })
})

describe('entrega nao realizada (29/09/2026)', () => {
  it('parada que falhou nao impede outro entregador de pegar depois do "tentar de novo"', async () => {
    const { service, tx } = build()
    await service.takeDelivery(undefined, 'ord1', 'drv1')
    expect(tx.deliveryStop.findFirst).toHaveBeenCalledWith({ where: { orderId: 'ord1', status: { not: 'FAILED' } } })
  })

  it('"tentar de novo" devolve o pedido para a fila (READY_FOR_DELIVERY)', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ord1', status: 'OUT_FOR_DELIVERY' }),
        update: jest.fn().mockResolvedValue({ id: 'ord1', tenantId: 't', storeId: 's', status: 'READY_FOR_DELIVERY', paymentStatus: 'UNPAID' }),
      },
      deliveryStop: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'stop-falhou' }).mockResolvedValueOnce(null) },
      orderEvent: { create: jest.fn().mockResolvedValue({}) },
    }
    const service = new DeliveryService(prisma as never, {} as never)
    await service.retryFailedDelivery(undefined, 'ord1')
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'READY_FOR_DELIVERY' } }))
  })

  it('recusa "tentar de novo" em pedido que ja foi entregue', async () => {
    const prisma = { order: { findFirst: jest.fn().mockResolvedValue({ id: 'ord1', status: 'DELIVERED' }) } }
    const service = new DeliveryService(prisma as never, {} as never)
    await expect(service.retryFailedDelivery(undefined, 'ord1')).rejects.toBeInstanceOf(BadRequestException)
  })
})
