import { createHmac } from 'crypto'
import { OrderOrchestrationService } from './order-orchestration.service'
import { AntenorApiWebhookGuard } from './antenor-api-webhook.guard'
import { ExecutionContext } from '@nestjs/common'

describe('handleWebhookStatus (JON-23)', () => {
  const mockPrisma = { order: { findFirst: jest.fn() } }
  let service: OrderOrchestrationService

  beforeEach(() => {
    jest.clearAllMocks()
    service = Object.create(OrderOrchestrationService.prototype)
    ;(service as unknown as { prisma: unknown }).prisma = mockPrisma
    ;(service as unknown as { markInvoiced: jest.Mock }).markInvoiced = jest.fn().mockResolvedValue({ status: 'READY_FOR_DELIVERY' })
    ;(service as unknown as { markCancelledInErp: jest.Mock }).markCancelledInErp = jest.fn().mockResolvedValue({ status: 'CANCELLED' })
  })

  it('payload sem DAV ou status: nao processa', async () => {
    const resultado = await service.handleWebhookStatus({})
    expect(resultado.processado).toBe(false)
  })

  it('DAV sem pedido correspondente: nao processa, nao estoura', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null)
    const resultado = await service.handleWebhookStatus({ numeroDAV: '999999', statusGeral: 'FATURADO_NO_PDV' })
    expect(resultado.processado).toBe(false)
  })

  it('FATURADO_NO_PDV: chama markInvoiced com o pedido resolvido pelo DAV', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ id: 'order-1' })
    const resultado = await service.handleWebhookStatus({
      numeroDAV: '102073',
      statusGeral: 'FATURADO_NO_PDV',
      faturamento: { hrRegistro: '10:00' },
    })
    expect((service as unknown as { markInvoiced: jest.Mock }).markInvoiced).toHaveBeenCalledWith(undefined, 'order-1', { hrRegistro: '10:00' })
    expect(resultado.processado).toBe(true)
  })

  it('CANCELADO_NA_RETAGUARDA: chama markCancelledInErp com o DAV no payload', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ id: 'order-2' })
    await service.handleWebhookStatus({ numeroDAV: '102076', statusGeral: 'CANCELADO_NA_RETAGUARDA' })
    expect((service as unknown as { markCancelledInErp: jest.Mock }).markCancelledInErp).toHaveBeenCalledWith(
      undefined,
      'order-2',
      expect.objectContaining({ dav: '102076' }),
    )
  })

  it('status desconhecido: ignora sem chamar nada', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ id: 'order-3' })
    const resultado = await service.handleWebhookStatus({ numeroDAV: '1', statusGeral: 'ALGO_NOVO' })
    expect(resultado.processado).toBe(false)
    expect((service as unknown as { markInvoiced: jest.Mock }).markInvoiced).not.toHaveBeenCalled()
  })
})

describe('AntenorApiWebhookGuard', () => {
  const guard = new AntenorApiWebhookGuard()
  const envOriginal = process.env.ANTENOR_API_WEBHOOK_SECRET

  afterEach(() => {
    process.env.ANTENOR_API_WEBHOOK_SECRET = envOriginal
  })

  function buildContext(headers: Record<string, string>, rawBody: Buffer): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers, rawBody, body: {} }),
      }),
    } as unknown as ExecutionContext
  }

  it('sem segredo configurado: recusa', () => {
    delete process.env.ANTENOR_API_WEBHOOK_SECRET
    expect(() => guard.canActivate(buildContext({}, Buffer.from('{}')))).toThrow()
  })

  it('assinatura valida: aceita', () => {
    process.env.ANTENOR_API_WEBHOOK_SECRET = 'segredo-teste'
    const body = Buffer.from(JSON.stringify({ numeroDAV: '1' }))
    const sig = createHmac('sha256', 'segredo-teste').update(body).digest('hex')
    expect(guard.canActivate(buildContext({ 'x-webhook-signature': sig }, body))).toBe(true)
  })

  it('assinatura invalida: recusa', () => {
    process.env.ANTENOR_API_WEBHOOK_SECRET = 'segredo-teste'
    const body = Buffer.from(JSON.stringify({ numeroDAV: '1' }))
    expect(() => guard.canActivate(buildContext({ 'x-webhook-signature': 'deadbeef' }, body))).toThrow()
  })
})
