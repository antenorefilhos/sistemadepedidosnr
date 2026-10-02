import { MetricsRegistry } from '../../common/observability/metrics-registry'
import { ObservabilityService } from './observability.service'

const mockPrisma: any = {
  order: { count: jest.fn() },
  webhookDelivery: { count: jest.fn() },
  stockReservation: { count: jest.fn() },
  paymentTransaction: { count: jest.fn() },
}

describe('ObservabilityService', () => {
  let service: ObservabilityService

  beforeEach(() => {
    jest.clearAllMocks()
    MetricsRegistry.resetForTests()
    service = new ObservabilityService(mockPrisma)
  })

  it('summarizes p95 and error rates from observed HTTP requests', async () => {
    MetricsRegistry.observeHttp({ method: 'GET', route: '/products', status: 200, durationMs: 100, timestamp: Date.now() })
    MetricsRegistry.observeHttp({ method: 'GET', route: '/products', status: 200, durationMs: 260, timestamp: Date.now() })
    MetricsRegistry.observeHttp({ method: 'POST', route: '/checkout/sessions', status: 422, durationMs: 900, timestamp: Date.now() })

    mockPrisma.order.count.mockResolvedValue(0)
    mockPrisma.webhookDelivery.count.mockResolvedValue(0)
    mockPrisma.stockReservation.count.mockResolvedValue(0)
    mockPrisma.paymentTransaction.count.mockResolvedValue(0)

    const metrics = await service.getOperationalMetrics()

    expect(metrics.http.endpoints).toEqual(expect.arrayContaining([
      expect.objectContaining({ endpoint: 'GET /products', p95Ms: 260 }),
      expect.objectContaining({ endpoint: 'POST /checkout/sessions', critical4xxRate: 1 }),
    ]))
  })

  it('raises alerts for unsynced orders and expired reservations', async () => {
    mockPrisma.order.count.mockResolvedValue(1)
    mockPrisma.webhookDelivery.count.mockResolvedValue(1)
    mockPrisma.stockReservation.count.mockResolvedValue(3)
    mockPrisma.paymentTransaction.count.mockResolvedValue(1)

    const result = await service.checkAlerts()

    expect(result.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'order-unsynced-sla', severity: 'critical' }),
      expect.objectContaining({ key: 'expired-reservations', severity: 'warning' }),
      expect.objectContaining({ key: 'payment-pending-sla', severity: 'warning' }),
    ]))
  })

  it('exposes runbooks for SRE incident response', () => {
    const result = service.getRunbooks()
    expect(result.runbooks.map((runbook) => runbook.key)).toEqual(expect.arrayContaining([
      'erp-failure',
      'checkout-error-rate',
      'payment-pending-sla',
      'rupture-spike',
    ]))
  })
})
