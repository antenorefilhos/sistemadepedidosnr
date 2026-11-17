import { AxiosError } from 'axios'
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

  // Achado em 17/09/2026: o ExceptionHandler interno do Nest chama
  // logger.error(exception) com o objeto Error INTEIRO como message (nao
  // string) em falha de boot. JSON.stringify(new Error(...)) sempre vira
  // "{}" (Error nao tem propriedade enumeravel), entao toda falha real de
  // boot (env obrigatoria ausente, porta ocupada) ficava muda no log -- o
  // container so reiniciava em loop sem pista nenhuma.
  // 17/11/2026: o AxiosError inteiro virava `details` e levava junto o header
  // Authorization (a chave da AntenorApi) e o corpo da requisicao (CPF do cliente).
  it('AxiosError no log nao vaza a chave nem o corpo da requisicao', () => {
    const erro = new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', {
      method: 'post',
      url: '/api/integracao/pedidos',
      headers: { Authorization: 'Bearer chave-secreta-xyz' },
      data: JSON.stringify({ cliente: { cpf: '12345678900' } }),
    } as never, undefined, { status: 500, data: { erro: 'quebrou' } } as never)

    logger.error('Falha ao enviar pedido', erro)

    const { details } = logged.mock.calls[0][2]
    const texto = JSON.stringify(details)
    expect(texto).not.toContain('chave-secreta-xyz')
    expect(texto).not.toContain('12345678900')
    expect(details).toMatchObject({ status: 500, method: 'POST', url: '/api/integracao/pedidos', code: 'ERR_BAD_RESPONSE' })
    expect(details.resposta).toContain('quebrou')
  })

  it('extrai message e stack quando recebe um Error direto (nao string)', () => {
    const erro = new Error('CORS_ORIGIN deve ser configurado explicitamente em producao.')
    logger.error(erro)
    expect(logged).toHaveBeenCalledWith('error', 'CORS_ORIGIN deve ser configurado explicitamente em producao.', {
      stack: erro.stack,
    })
  })
})
