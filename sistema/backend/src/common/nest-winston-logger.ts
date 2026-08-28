import { LoggerService, LogLevel } from '@nestjs/common'
import { winstonLogger } from './logger'

/**
 * Liga o `Logger` do Nest ao winston.
 *
 * Ate 28/08/2026 `main.ts` criava a app com `logger: false`, o que desligava o
 * Logger do Nest inteiro: todo `this.logger.log/warn/error` do backend sumia em
 * producao. Isso escondeu bug real -- o EmailService avisava por `logger.warn`
 * que a RESEND_API_KEY nao estava configurada, e esse aviso nunca apareceu, com
 * a recuperacao de senha de admin e cliente sem enviar nada por meses.
 *
 * A alternativa era reescrever centenas de call sites pra winstonLogger. Este
 * bridge resolve todos de uma vez, e vale tambem pro codigo que ainda nao foi
 * escrito -- o padrao natural (`new Logger(Classe.name)`) volta a funcionar em
 * vez de ser uma armadilha.
 *
 * O `logger: false` existia por um motivo legitimo: o boot do Nest despeja uma
 * linha por rota mapeada e por modulo carregado, o que polui o log estruturado.
 * Por isso o bridge silencia essas fontes -- mas so em `log`/`debug`. Warn e
 * error passam sempre, inclusive no boot: falha ao subir e exatamente o que
 * nao pode ficar calada.
 */
const BOOTSTRAP_NOISE = new Set([
  'InstanceLoader',
  'RoutesResolver',
  'RouterExplorer',
  'NestFactory',
  'NestApplication',
  'NestMicroservice',
  'WebSocketsController',
])

export class NestWinstonLogger implements LoggerService {
  /**
   * O Nest chama estes metodos como (message, ...params), e por convencao o
   * ultimo param e a string de contexto (o nome da classe). Nao e garantido:
   * quem chama `logger.error(msg, stack, context)` manda tres. Separar o que e
   * contexto do que e dado extra evita gravar o nome da classe como se fosse
   * parte do payload.
   */
  private split(params: unknown[]): { context?: string; extra: unknown[] } {
    if (params.length === 0) return { extra: [] }
    const last = params[params.length - 1]
    if (typeof last === 'string' && !last.includes('\n') && last.length <= 80) {
      return { context: last, extra: params.slice(0, -1) }
    }
    return { extra: params }
  }

  private write(level: 'info' | 'warn' | 'error' | 'debug', message: unknown, params: unknown[], quietForNoise: boolean) {
    const { context, extra } = this.split(params)
    if (quietForNoise && context && BOOTSTRAP_NOISE.has(context)) return
    winstonLogger.log(level, typeof message === 'string' ? message : JSON.stringify(message), {
      ...(context ? { context } : {}),
      ...(extra.length ? { details: extra.length === 1 ? extra[0] : extra } : {}),
    })
  }

  log(message: unknown, ...params: unknown[]) {
    this.write('info', message, params, true)
  }

  warn(message: unknown, ...params: unknown[]) {
    this.write('warn', message, params, false)
  }

  error(message: unknown, ...params: unknown[]) {
    this.write('error', message, params, false)
  }

  debug(message: unknown, ...params: unknown[]) {
    this.write('debug', message, params, true)
  }

  verbose(message: unknown, ...params: unknown[]) {
    this.write('debug', message, params, true)
  }

  fatal(message: unknown, ...params: unknown[]) {
    this.write('error', message, params, false)
  }

  /** O nivel efetivo e o do winston (LOG_LEVEL); o Nest so nao pode filtrar antes. */
  setLogLevels(_levels: LogLevel[]) {
    // intencionalmente sem efeito -- ver doc acima
  }
}
