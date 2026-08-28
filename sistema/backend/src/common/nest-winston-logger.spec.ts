import { NestWinstonLogger } from './nest-winston-logger'
import { winstonLogger } from './logger'

jest.mock('./logger', () => ({ winstonLogger: { log: jest.fn() } }))

const logged = winstonLogger.log as jest.Mock

describe('NestWinstonLogger', () => {
  let logger: NestWinstonLogger

  beforeEach(() => {
    logged.mockClear()
    logger = new NestWinstonLogger()
  })

  it('encaminha log como info, com o contexto separado da mensagem', () => {
    logger.log('Sync concluido', 'ProductsSyncScheduler')
    expect(logged).toHaveBeenCalledWith('info', 'Sync concluido', { context: 'ProductsSyncScheduler' })
  })

  it('mapeia warn e error para os niveis correspondentes', () => {
    logger.warn('RESEND_API_KEY nao configurada', 'EmailService')
    logger.error('Falha no sync', 'ProductsSyncScheduler')
    expect(logged.mock.calls[0][0]).toBe('warn')
    expect(logged.mock.calls[1][0]).toBe('error')
  })

  // O motivo de o logger estar desligado antes era o despejo de uma linha por
  // rota no boot. Silenciar isso e' o que permite religar o resto.
  it('silencia o ruido de boot do Nest', () => {
    logger.log('Mapped {/produtos, GET} route', 'RouterExplorer')
    logger.log('AppModule dependencies initialized', 'InstanceLoader')
    expect(logged).not.toHaveBeenCalled()
  })

  // Falha ao subir e exatamente o que nao pode ficar calada -- o filtro de
  // ruido nao pode valer pra warn/error.
  it('deixa passar erro vindo do proprio boot', () => {
    logger.error('Nest could not selfDetermine', 'NestFactory')
    expect(logged).toHaveBeenCalledWith('error', 'Nest could not selfDetermine', { context: 'NestFactory' })
  })

  it('nao confunde stack trace com contexto', () => {
    const stack = 'Error: quebrou\n    at Foo.bar (/app/src/foo.ts:1:1)'
    logger.error('Falhou', stack, 'OrdersService')
    expect(logged).toHaveBeenCalledWith('error', 'Falhou', { context: 'OrdersService', details: stack })
  })

  it('funciona sem contexto nenhum', () => {
    logger.log('mensagem solta')
    expect(logged).toHaveBeenCalledWith('info', 'mensagem solta', {})
  })
})
