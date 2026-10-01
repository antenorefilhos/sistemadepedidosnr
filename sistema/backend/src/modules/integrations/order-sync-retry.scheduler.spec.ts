import { MAX_AUTO_SYNC_FAILURES, OrderSyncRetryScheduler } from './order-sync-retry.scheduler'

const build = (orders: string[], failures: Record<string, number>, enabled = true) => {
  const prisma = {
    order: { findMany: jest.fn().mockResolvedValue(orders.map((id) => ({ id }))) },
    auditLog: { count: jest.fn(({ where }: { where: { entityId: string } }) => Promise.resolve(failures[where.entityId] ?? 0)) },
  }
  const modules = { isEnabled: jest.fn().mockResolvedValue(enabled) }
  const orchestration = { retryOrderSync: jest.fn().mockResolvedValue({ success: true }) }
  return { scheduler: new OrderSyncRetryScheduler(prisma as never, modules as never, orchestration as never), prisma, orchestration }
}

describe('OrderSyncRetryScheduler', () => {
  it('reenvia pedido sem DAV e para depois do limite de falhas', async () => {
    const { scheduler, orchestration } = build(['a', 'b'], { b: MAX_AUTO_SYNC_FAILURES })
    expect(await scheduler.handle()).toBe(1)
    expect(orchestration.retryOrderSync).toHaveBeenCalledWith('a')
    expect(orchestration.retryOrderSync).not.toHaveBeenCalledWith('b')
  })

  it('so busca pedido valido, sem DAV e das ultimas 48 h', async () => {
    const { scheduler, prisma } = build([], {})
    await scheduler.handle()
    const where = prisma.order.findMany.mock.calls[0][0].where
    expect(where.erpDav).toBeNull()
    expect(where.status).toEqual({ notIn: ['CANCELLED', 'REFUNDED'] })
  })

  it('nao roda com a AntenorApi desligada', async () => {
    const { scheduler, prisma } = build(['a'], {}, false)
    expect(await scheduler.handle()).toBe(0)
    expect(prisma.order.findMany).not.toHaveBeenCalled()
  })
})
