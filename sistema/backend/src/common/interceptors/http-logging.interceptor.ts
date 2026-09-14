import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable, tap, catchError, throwError } from 'rxjs'
import { Request, Response } from 'express'
import { winstonLogger } from '../logger'
import { MetricsRegistry } from '../observability/metrics-registry'
import { ObservabilityRequest } from '../observability/request-context.middleware'

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<ObservabilityRequest>()
    const res = context.switchToHttp().getResponse<Response>()
    const start = Date.now()

    const { method, ip } = req
    const userAgent = req.get('user-agent') || ''
    // JON-147 (Auditoria 360, High): `url` cru (path resolvido + querystring)
    // ia pro metric label E pro log -- CPF em path (ex.: fidelidade por CPF)
    // e busca/e-mail em query vazavam pro texto Prometheus publico e pros
    // logs. `req.route.path` e o TEMPLATE da rota (ex.: "/customers/:id"),
    // sem valor real nenhum -- cai nisso quando o Express resolveu a rota;
    // sem match (404), usa so o path sem querystring como aproximacao.
    const route = req.route?.path
      ? `${(req as unknown as { baseUrl?: string }).baseUrl || ''}${req.route.path}`
      : req.path || req.url.split('?')[0]

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start
        const status = res.statusCode
        MetricsRegistry.observeHttp({ method, route, status, durationMs: duration, timestamp: Date.now() })
        winstonLogger.info('http_request', {
          request_id: req.requestId,
          correlation_id: req.correlationId,
          order_trace_id: req.orderTraceId,
          tenant_id: (req as any).tenantContext?.tenantId,
          store_id: (req as any).tenantContext?.storeId,
          method,
          route,
          status,
          duration_ms: duration,
          ip,
          user_agent: userAgent,
        })
      }),
      catchError((err) => {
        const duration = Date.now() - start
        const status = err?.status ?? 500
        MetricsRegistry.observeHttp({ method, route, status, durationMs: duration, timestamp: Date.now() })
        winstonLogger.warn('http_error', {
          request_id: req.requestId,
          correlation_id: req.correlationId,
          order_trace_id: req.orderTraceId,
          tenant_id: (req as any).tenantContext?.tenantId,
          store_id: (req as any).tenantContext?.storeId,
          method,
          route,
          status,
          duration_ms: duration,
          ip,
          // Mensagem de erro (Prisma/integracao) pode ecoar entrada do
          // usuario -- corta em 300 chars pra log nao virar despejo de body.
          error: typeof err?.message === 'string' ? err.message.slice(0, 300) : undefined,
        })
        return throwError(() => err)
      }),
    )
  }
}
