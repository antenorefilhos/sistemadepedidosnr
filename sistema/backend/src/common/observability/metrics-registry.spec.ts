import { MetricsRegistry } from './metrics-registry'

// JON-69: contador cumulativo nao pode cair quando a janela deslizante
// expira amostras -- so o gauge da janela pode zerar.
describe('MetricsRegistry', () => {
  afterEach(() => {
    MetricsRegistry.resetForTests()
  })

  it('mantem o counter cumulativo mesmo apos a janela expirar as amostras', () => {
    const oldTimestamp = Date.now() - 20 * 60 * 1000
    MetricsRegistry.observeHttp({ method: 'GET', route: '/x', status: 200, durationMs: 10, timestamp: oldTimestamp })
    MetricsRegistry.observeHttp({ method: 'GET', route: '/x', status: 200, durationMs: 10, timestamp: oldTimestamp })

    const output = MetricsRegistry.prometheus(15 * 60 * 1000)

    expect(output).toContain('# TYPE antenor_http_requests_total counter')
    expect(output).toContain('antenor_http_requests_total 2')
    expect(output).toContain('# TYPE antenor_http_requests_window gauge')
    expect(output).toContain('antenor_http_requests_window 0')
  })
})
