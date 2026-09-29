import { PickingService } from './picking.service'

// DAV 102118/102119 (29/09/2026): pedido entregue foi "reenviado ao caixa" e
// voltou para pronto para entrega.
describe('PickingService.sendToCashier depois do caixa', () => {
  const build = (status: string) => {
    const service = Object.create(PickingService.prototype) as any
    service.prisma = {
      order: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'o1', status }), update: jest.fn() },
      pickingTask: { findFirst: jest.fn() },
    }
    service.findOrderForPicking = jest.fn().mockResolvedValue({ id: 'o1', status })
    return service
  }

  it('recusa pedido ja faturado ou entregue, sem mudar a situacao', async () => {
    for (const status of ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']) {
      const service = build(status)
      await expect(service.sendToCashier('o1', {})).rejects.toThrow('já foi enviado ao caixa')
      expect(service.prisma.order.update).not.toHaveBeenCalled()
    }
  })

  it('reenviar pedido que ja esta no caixa nao faz nada', async () => {
    const service = build('READY_FOR_CHECKOUT')
    await expect(service.sendToCashier('o1', {})).resolves.toMatchObject({ id: 'o1' })
    expect(service.prisma.order.update).not.toHaveBeenCalled()
    expect(service.prisma.pickingTask.findFirst).not.toHaveBeenCalled()
  })
})
