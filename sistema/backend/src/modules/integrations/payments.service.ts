import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { ChargeContract } from './dto/charge-contract.dto'

export interface ChargeResult {
  chargeId: string
  status: string
  paymentUrl?: string
  pixCopiaECola?: string
  pixQrCode?: string
  message?: string
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  private get providerUrl(): string {
    return (process.env.PAYMENTS_PROVIDER_URL || '').replace(/\/$/, '')
  }

  private get apiKey(): string {
    return process.env.PAYMENTS_API_KEY || ''
  }

  isConfigured(): boolean {
    return !!(this.providerUrl && this.apiKey)
  }

  async gerarCobranca(contract: ChargeContract): Promise<ChargeResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'Conector de pagamentos não configurado: verifique PAYMENTS_PROVIDER_URL e PAYMENTS_API_KEY.',
      )
    }

    const payload = this.buildChargePayload(contract)

    const response = await axios.post(`${this.providerUrl}/v1/charges`, payload, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    const data = response.data as Record<string, unknown>

    return {
      chargeId: String(data.id || data.charge_id || contract.orderId),
      status: String(data.status || 'pending'),
      paymentUrl: data.payment_url as string | undefined,
      pixCopiaECola: (data.pix as Record<string, unknown> | undefined)?.copy_paste as string | undefined,
      pixQrCode: (data.pix as Record<string, unknown> | undefined)?.qr_code as string | undefined,
      message: data.message as string | undefined,
    }
  }

  private buildChargePayload(contract: ChargeContract): Record<string, unknown> {
    const amountCents = Math.round(contract.amount * 100)

    return {
      amount: amountCents,
      currency: 'BRL',
      description: contract.description,
      payment_method: contract.method === 'PIX' ? 'pix' : 'credit_card',
      expires_in: contract.expiresInSeconds,
      customer: {
        name: contract.customerName,
        phone: contract.customerPhone,
      },
      pix: contract.method === 'PIX' && contract.pixKey
        ? { key: contract.pixKey, key_type: 'random' }
        : undefined,
      metadata: contract.metadata,
    }
  }
}
