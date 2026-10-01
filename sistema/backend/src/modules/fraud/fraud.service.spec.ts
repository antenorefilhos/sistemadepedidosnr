import { FraudService } from './fraud.service'

const ctx = (over: Record<string, unknown> = {}) => ({ deviceId: 'dev-1', fingerprint: 'fp1', automation: false, ip: '179.215.10.2', country: 'BR', ...over })

function build(opts: {
  signals?: Array<{ customerId: string; kind: string; value: string }>
  ordersBy?: Record<string, number>
  addresses?: Array<{ id: string; customerId: string; zipCode: string; street: string; number: string }>
  customer?: { createdAt: Date; email: string | null }
  blocks?: Array<{ kind: string; value: string; reason?: string }>
  failedStops?: number
  burst?: number
  deviceAccounts?: number
} = {}) {
  const signals = opts.signals || []
  const ordersBy = opts.ordersBy || {}
  const addresses = opts.addresses || []
  const prisma = {
    identitySignal: {
      findMany: jest.fn(({ where }: any) => {
        if (where.customerId && typeof where.customerId === 'string') return Promise.resolve(signals.filter((s) => s.customerId === where.customerId && where.kind.in.includes(s.kind)))
        return Promise.resolve(signals.filter((s) => s.customerId !== where.customerId.not && where.OR.some((o: any) => o.kind === s.kind && o.value === s.value)))
      }),
      count: jest.fn().mockResolvedValue(opts.deviceAccounts ?? 0),
      upsert: jest.fn().mockResolvedValue({}),
    },
    order: {
      count: jest.fn(({ where }: any) => {
        if (where.createdAt) return Promise.resolve(opts.burst ?? 0)
        const ids: string[] = typeof where.customerId === 'string' ? [where.customerId] : where.customerId.in
        return Promise.resolve(ids.reduce((a, id) => a + (ordersBy[id] || 0), 0))
      }),
    },
    address: {
      findMany: jest.fn(({ where }: any) => {
        if (where.id) return Promise.resolve(addresses.filter((a) => a.id === where.id && a.customerId === where.customerId))
        if (where.zipCode) return Promise.resolve(addresses.filter((a) => a.customerId !== where.customerId.not && where.zipCode.in.includes(a.zipCode)))
        return Promise.resolve(addresses.filter((a) => a.customerId === where.customerId))
      }),
    },
    customer: { findUnique: jest.fn().mockResolvedValue(opts.customer || { createdAt: new Date(Date.now() - 30 * 86_400_000), email: 'a@gmail.com' }) },
    fraudBlock: { findFirst: jest.fn(({ where }: any) => Promise.resolve((opts.blocks || []).find((b) => where.OR.some((o: any) => o.kind === b.kind && o.value === b.value)) || null)) },
    deliveryStop: { count: jest.fn().mockResolvedValue(opts.failedStops ?? 0) },
  }
  return new FraudService(prisma as never)
}

describe('FraudService.firstPurchase (por pessoa)', () => {
  it('conta nova sem ligacao: elegivel', async () => {
    expect((await build().firstPurchase('t', 'novo')).eligible).toBe(true)
  })
  it('a propria conta ja comprou', async () => {
    expect((await build({ ordersBy: { novo: 1 } }).firstPurchase('t', 'novo')).eligible).toBe(false)
  })
  it('outra conta no mesmo aparelho ja comprou: nega', async () => {
    const r = await build({
      signals: [{ customerId: 'novo', kind: 'DEVICE', value: 'dev-1' }, { customerId: 'antigo', kind: 'DEVICE', value: 'dev-1' }],
      ordersBy: { antigo: 2 },
    }).firstPurchase('t', 'novo')
    expect(r.eligible).toBe(false)
    expect(r.reason).toMatch(/aparelho ou e-mail/)
  })
  it('impressao digital sozinha NAO liga (iPhone do mesmo modelo)', async () => {
    const r = await build({
      signals: [{ customerId: 'novo', kind: 'FINGERPRINT', value: 'fp1' }, { customerId: 'outro', kind: 'FINGERPRINT', value: 'fp1' }],
      ordersBy: { outro: 3 },
    }).firstPurchase('t', 'novo')
    expect(r.eligible).toBe(true)
  })
  it('outro cadastro no mesmo endereco (escrito diferente) ja comprou: nega', async () => {
    const r = await build({
      addresses: [
        { id: 'a1', customerId: 'novo', zipCode: '25750222', street: 'R. São João', number: '10' },
        { id: 'a2', customerId: 'vizinha', zipCode: '25750-222', street: 'Rua Sao Joao', number: '10' },
      ],
      ordersBy: { vizinha: 1 },
    }).firstPurchase('t', 'novo', 'a1')
    expect(r.eligible).toBe(false)
    expect(r.reason).toMatch(/endereço/)
  })
})

describe('FraudService.blockedReason', () => {
  it('CPF ou aparelho bloqueado barra, mesmo com conta nova', async () => {
    const s = build({ blocks: [{ kind: 'CPF', value: '52998224725', reason: 'trote' }, { kind: 'DEVICE', value: 'dev-x' }] })
    expect(await s.blockedReason('t', { cpf: '529.982.247-25' })).toBe('trote')
    expect(await s.blockedReason('t', {}, ctx({ deviceId: 'dev-x' }) as never)).toBe('bloqueado')
    expect(await s.blockedReason('t', { cpf: '15350946056' }, ctx() as never)).toBeNull()
  })
})

describe('FraudService.assessOrder', () => {
  it('cliente antigo, aparelho limpo: risco baixo', async () => {
    const r = await build({ ordersBy: { c: 5 } }).assessOrder({ tenantId: 't', customerId: 'c', ctx: ctx() as never, total: 120 })
    expect(r).toEqual({ score: 0, level: 'LOW', reasons: [] })
  })
  it('robo + conta nova com pedido alto: risco alto com motivos', async () => {
    const r = await build({ customer: { createdAt: new Date(), email: 'x@yopmail.com' } }).assessOrder({ tenantId: 't', customerId: 'c', ctx: ctx({ automation: true }) as never, total: 700 })
    expect(r.level).toBe('HIGH')
    expect(r.reasons[0]).toMatch(/robô/)
    expect(r.reasons.join(' ')).toMatch(/Conta criada hoje.*700/)
    expect(r.reasons.join(' ')).toMatch(/descartável/)
  })
  it('entrega frustrada antes e muitas contas no aparelho pesam', async () => {
    const r = await build({ ordersBy: { c: 2 }, failedStops: 1, deviceAccounts: 4 }).assessOrder({ tenantId: 't', customerId: 'c', ctx: ctx() as never, total: 80 })
    expect(r.score).toBe(65)
    expect(r.level).toBe('HIGH')
    expect(r.reasons).toEqual(['1 entrega(s) frustrada(s) antes', '4 contas usaram este aparelho em 7 dias'])
  })
  it('acesso de fora do Brasil', async () => {
    const r = await build({ ordersBy: { c: 1 } }).assessOrder({ tenantId: 't', customerId: 'c', ctx: ctx({ country: 'US' }) as never, total: 50 })
    expect(r.reasons).toEqual(['Acesso de fora do Brasil (US)'])
    expect(r.level).toBe('MEDIUM')
  })
})
