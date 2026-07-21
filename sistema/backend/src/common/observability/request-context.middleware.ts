import { Injectable, NestMiddleware } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { NextFunction, Request, Response } from 'express'

export interface ObservabilityRequest extends Request {
  requestId?: string
  correlationId?: string
  orderTraceId?: string
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: ObservabilityRequest, response: Response, next: NextFunction) {
    const requestId = this.getHeader(request, 'x-request-id') || randomUUID()
    const correlationId = this.getHeader(request, 'x-correlation-id') || requestId
    const orderTraceId = this.getHeader(request, 'x-order-trace-id') || this.extractOrderTraceId(request)

    request.requestId = requestId
    request.correlationId = correlationId
    request.orderTraceId = orderTraceId

    response.setHeader('x-request-id', requestId)
    response.setHeader('x-correlation-id', correlationId)
    if (orderTraceId) response.setHeader('x-order-trace-id', orderTraceId)

    next()
  }

  private getHeader(request: Request, name: string) {
    const value = request.headers[name]
    if (Array.isArray(value)) return String(value[0] || '').trim() || undefined
    if (typeof value === 'string') return value.trim() || undefined
    return undefined
  }

  private extractOrderTraceId(request: Request) {
    const bodyOrderId = (request.body?.orderId || request.body?.id) as string | undefined
    if (bodyOrderId) return `order:${bodyOrderId}`

    const match = request.originalUrl?.match(/\/orders\/([^/?]+)/)
    if (match?.[1] && !['admin', 'analytics'].includes(match[1])) {
      return `order:${match[1]}`
    }

    return undefined
  }
}
