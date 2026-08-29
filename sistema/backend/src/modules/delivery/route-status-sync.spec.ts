import { DeliveryService } from './delivery.service'

/**
 * O status da rota acompanhando as paradas.
 *
 * Sem isso a rota fica PLANNED pra sempre: o entregador avanca as paradas pelo
 * app, que mexia na parada, no pedido e na notificacao -- nunca na rota. Foi o
 * que aconteceu em producao em 29/08/2026: rota "Montando" com as duas paradas
 * ja em transito, e o admin ainda oferecendo "Liberar", que re-dispararia
 * order.out_for_delivery em todos os pedidos.
 *
 * No fluxo de fila compartilhada e ainda mais critico: ninguem passa pelo
 * admin, entao `startRoute` nunca e chamado e este e o UNICO caminho que muda
 * o status da rota.
 */
const sync = (service: DeliveryService, routeId = 'r1') =>
  (service as unknown as {
    syncRouteStatusFromStops: (id: string, ctx: unknown, actor?: unknown) => Promise<void>
  }).syncRouteStatusFromStops(routeId, { tenantId: 't', storeId: 's' })

const build = (rota: Record<string, unknown> | null) => {
  const prisma = {
    deliveryRoute: {
      findFirst: jest.fn().mockResolvedValue(rota),
      update: jest.fn().mockResolvedValue({}),
    },
    fulfillmentEvent: { create: jest.fn().mockResolvedValue({}) },
  }
  return { service: new DeliveryService(prisma as never, {} as never), prisma }
}

const rota = (status: string, statusParadas: string[]) => ({
  id: 'r1',
  status,
  startsAt: null,
  stops: statusParadas.map((s, i) => ({ id: `s${i}`, status: s })),
})

describe('syncRouteStatusFromStops', () => {
  it('a primeira parada que sai poe a rota em rota', async () => {
    const { service, prisma } = build(rota('PLANNED', ['OUT_FOR_DELIVERY', 'PENDING']))
    await sync(service)
    expect(prisma.deliveryRoute.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'OUT_FOR_DELIVERY' }) }),
    )
  })

  it('nao mexe enquanto todas as paradas estao aguardando', async () => {
    const { service, prisma } = build(rota('PLANNED', ['PENDING', 'PENDING']))
    await sync(service)
    expect(prisma.deliveryRoute.update).not.toHaveBeenCalled()
  })

  it('conclui a rota quando a ultima parada termina', async () => {
    const { service, prisma } = build(rota('OUT_FOR_DELIVERY', ['DELIVERED', 'DELIVERED']))
    await sync(service)
    expect(prisma.deliveryRoute.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    )
  })

  // Entrega que falhou tambem encerra a parada -- senao a rota nunca fecha e
  // fica pendurada na lista do entregador pra sempre.
  it('parada que falhou conta como terminada', async () => {
    const { service, prisma } = build(rota('OUT_FOR_DELIVERY', ['DELIVERED', 'FAILED']))
    await sync(service)
    expect(prisma.deliveryRoute.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    )
  })

  it('rota cancelada nao e reaberta por parada nenhuma', async () => {
    const { service, prisma } = build(rota('CANCELLED', ['DELIVERED', 'DELIVERED']))
    await sync(service)
    expect(prisma.deliveryRoute.update).not.toHaveBeenCalled()
  })

  it('rota sem parada nenhuma nao vira concluida', async () => {
    const { service, prisma } = build(rota('PLANNED', []))
    await sync(service)
    expect(prisma.deliveryRoute.update).not.toHaveBeenCalled()
  })

  it('nao repete a conclusao de rota ja concluida', async () => {
    const { service, prisma } = build(rota('COMPLETED', ['DELIVERED']))
    await sync(service)
    expect(prisma.deliveryRoute.update).not.toHaveBeenCalled()
  })
})
