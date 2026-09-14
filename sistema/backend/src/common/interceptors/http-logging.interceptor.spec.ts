import { of, throwError } from 'rxjs'
import { HttpLoggingInterceptor } from './http-logging.interceptor'
import { MetricsRegistry } from '../observability/metrics-registry'
import { winstonLogger } from '../logger'

// JON-147 (Auditoria 360, High): CPF em path e busca/e-mail em query nao
// podem virar label de metrica publica nem ir pro log como estao -- so o
// template da rota (sem valor real) deve sobrar.
describe('HttpLoggingInterceptor (JON-147)', () => {
  const buildContext = (req: any) => ({
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ statusCode: 200 }),
    }),
  })

  beforeEach(() => {
    jest.spyOn(MetricsRegistry, 'observeHttp').mockImplementation(() => undefined)
    jest.spyOn(winstonLogger, 'info').mockImplementation(() => undefined as never)
    jest.spyOn(winstonLogger, 'warn').mockImplementation(() => undefined as never)
  })

  afterEach(() => jest.restoreAllMocks())

  it('usa o template da rota (sem CPF real) quando o Express resolveu a rota', (done) => {
    const req: any = {
      method: 'GET',
      url: '/customers/12345678900?busca=joao@example.com',
      path: '/customers/12345678900',
      route: { path: '/:id' },
      baseUrl: '/customers',
      get: () => '',
    }
    const interceptor = new HttpLoggingInterceptor()

    interceptor.intercept(buildContext(req) as never, { handle: () => of('ok') } as never).subscribe(() => {
      const [metricArg] = (MetricsRegistry.observeHttp as jest.Mock).mock.calls[0]
      expect(metricArg.route).toBe('/customers/:id')
      const [, logArg] = (winstonLogger.info as jest.Mock).mock.calls[0]
      expect(logArg.route).toBe('/customers/:id')
      expect(JSON.stringify(logArg)).not.toContain('12345678900')
      expect(JSON.stringify(logArg)).not.toContain('joao@example.com')
      done()
    })
  })

  it('sem rota resolvida (404), ao menos corta a querystring', (done) => {
    const req: any = {
      method: 'GET',
      url: '/rota-inexistente?token=abc123',
      path: '/rota-inexistente',
      route: undefined,
      get: () => '',
    }
    const interceptor = new HttpLoggingInterceptor()

    interceptor.intercept(buildContext(req) as never, { handle: () => throwError(() => ({ status: 404, message: 'nao encontrado' })) } as never)
      .subscribe({
        error: () => {
          const [metricArg] = (MetricsRegistry.observeHttp as jest.Mock).mock.calls[0]
          expect(metricArg.route).toBe('/rota-inexistente')
          const [, logArg] = (winstonLogger.warn as jest.Mock).mock.calls[0]
          expect(logArg.route).not.toContain('token=abc123')
          done()
        },
      })
  })

  it('erro fica truncado em 300 chars no log', (done) => {
    const req: any = {
      method: 'POST',
      url: '/checkout',
      path: '/checkout',
      route: { path: '/checkout' },
      baseUrl: '',
      get: () => '',
    }
    const interceptor = new HttpLoggingInterceptor()
    const longMessage = 'x'.repeat(1000)

    interceptor.intercept(buildContext(req) as never, { handle: () => throwError(() => ({ status: 500, message: longMessage })) } as never)
      .subscribe({
        error: () => {
          const [, logArg] = (winstonLogger.warn as jest.Mock).mock.calls[0]
          expect(logArg.error.length).toBe(300)
          done()
        },
      })
  })
})
