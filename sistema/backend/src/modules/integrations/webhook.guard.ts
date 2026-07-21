import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'
import { PaymentsWebhookService } from './payments-webhook.service'

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(private readonly paymentsWebhookService: PaymentsWebhookService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>()
    const signature = String(request.headers['x-webhook-signature'] || '')

    if (!signature) {
      throw new UnauthorizedException('Assinatura de webhook ausente.')
    }

    const rawBody = request.rawBody
    const payload = rawBody || Buffer.from(JSON.stringify(request.body || {}))
    const valid = this.paymentsWebhookService.verifySignature(payload, signature)

    if (!valid) {
      throw new UnauthorizedException('Assinatura de webhook inválida.')
    }

    return true
  }
}
