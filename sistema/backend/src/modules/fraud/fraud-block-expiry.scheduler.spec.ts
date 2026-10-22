import { FraudBlockExpiryScheduler } from './fraud-block-expiry.scheduler'

function build(deleteMany = jest.fn().mockResolvedValue({ count: 0 })) {
  const prisma = { fraudBlock: { deleteMany } }
  return { scheduler: new FraudBlockExpiryScheduler(prisma as never), deleteMany }
}

describe('FraudBlockExpiryScheduler', () => {
  it('remove so bloqueio automatico com expiresAt vencido', async () => {
    const { scheduler, deleteMany } = build()
    await scheduler.handleExpiry()
    expect(deleteMany).toHaveBeenCalledWith({ where: { automatic: true, expiresAt: { lt: expect.any(Date) } } })
  })

  it('erro no banco nao propaga (scheduler roda de novo sozinho em 15 min)', async () => {
    const { scheduler } = build(jest.fn().mockRejectedValue(new Error('db fora')))
    await expect(scheduler.handleExpiry()).resolves.toBeUndefined()
  })

  it('nao roda em paralelo: segunda chamada enquanto a primeira ainda nao terminou e ignorada', async () => {
    let resolveFirst!: (v: { count: number }) => void
    const deleteMany = jest.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    const { scheduler } = build(deleteMany)
    const p1 = scheduler.handleExpiry()
    const p2 = scheduler.handleExpiry()
    resolveFirst({ count: 0 })
    await Promise.all([p1, p2])
    expect(deleteMany).toHaveBeenCalledTimes(1)
  })
})
