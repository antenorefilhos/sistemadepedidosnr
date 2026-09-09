import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'crypto'
import { Request } from 'express'

/**
 * Guarda do webhook de status de pedido da AntenorApi (JON-23).
 *
 * Mesmo desenho do WebhookGuard de pagamentos (assinatura HMAC do corpo cru
 * no cabecalho), segredo proprio (ANTENOR_API_WEBHOOK_SECRET) -- nunca a
 * pasta compartilhada com o outro agente, regra do projeto.
 */
@Injectable()
export class AntenorApiWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>()
    const signature = String(request.headers['x-webhook-signature'] || '')
    const secret = process.env.ANTENOR_API_WEBHOOK_SECRET

    if (!secret) {
      throw new UnauthorizedException('Webhook da AntenorApi nao configurado (ANTENOR_API_WEBHOOK_SECRET ausente).')
    }
    if (!signature) {
      throw new UnauthorizedException('Assinatura de webhook ausente.')
    }

    const rawBody = request.rawBody || Buffer.from(JSON.stringify(request.body || {}))

    try {
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
      const normalized = signature.replace(/^sha256=/, '')
      const expectedBuf = Buffer.from(expected, 'hex')
      const signatureBuf = Buffer.from(normalized, 'hex')

      if (expectedBuf.length !== signatureBuf.length || !timingSafeEqual(expectedBuf, signatureBuf)) {
        throw new UnauthorizedException('Assinatura de webhook invalida.')
      }
    } catch {
      throw new UnauthorizedException('Assinatura de webhook invalida.')
    }

    return true
  }
}
