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

    const { method, url, ip } = req
    const userAgent = req.get('user-agent') || ''

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start
        const status = res.statusCode
        MetricsRegistry.observeHttp({ method, route: url, status, durationMs: duration, timestamp: Date.now() })
        winstonLogger.info('http_request', {
          request_id: req.requestId,
          correlation_id: req.correlationId,
          order_trace_id: req.orderTraceId,
          tenant_id: (req as any).tenantContext?.tenantId,
          store_id: (req as any).tenantContext?.storeId,
          method,
          url,
          status,
          duration_ms: duration,
          ip,
          user_agent: userAgent,
        })
      }),
      catchError((err) => {
        const duration = Date.now() - start
        const status = err?.status ?? 500
        MetricsRegistry.observeHttp({ method, route: url, status, durationMs: duration, timestamp: Date.now() })
        winstonLogger.warn('http_error', {
          request_id: req.requestId,
          correlation_id: req.correlationId,
          order_trace_id: req.orderTraceId,
          tenant_id: (req as any).tenantContext?.tenantId,
          store_id: (req as any).tenantContext?.storeId,
          method,
          url,
          status,
          duration_ms: duration,
          ip,
          error: err?.message,
        })
        return throwError(() => err)
      }),
    )
  }
}
