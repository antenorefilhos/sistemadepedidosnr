import { Injectable } from '@nestjs/common'
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

    // JON-126 (Auditoria 360, Medium): a chave de idempotencia local so era
    // gerada DEPOIS da chamada ao gateway, com o chargeId que a propria
    // chamada devolvia -- nao servia pra nada, porque so existe apos criar
    // uma cobranca NOVA. A chave estavel (orderId, conhecido ANTES da
    // chamada) vai no header que o gateway usa pra deduplicar: um retry
    // (timeout, reinicio do worker) com o MESMO orderId reconhece a
    // cobranca ja criada em vez de abrir outra.
    const response = await axios.post(`${this.providerUrl}/v1/charges`, payload, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `order:${contract.orderId}`,
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

  // JON-127 (Auditoria 360, Medium): qualquer metodo diferente de PIX virava
  // 'credit_card' silenciosamente -- BOLETO/INVOICE (aceitos pelo lote B2B
  // em runBillingForAccount) eram enviados ao gateway como cartao, sem os
  // dados de cartao que esse modo exige, produzindo cobranca do tipo errado
  // ou erro obscuro do provedor. So os dois modos que este payload de fato
  // constroi (pix e credit_card) sao aceitos; o resto recusa explicito --
  // BOLETO nao tem suporte real aqui (sem campo de documento/vencimento no
  // payload), fingir que tem seria pior que recusar.
  private static readonly SUPPORTED_PAYMENT_METHODS: Record<string, string> = {
    PIX: 'pix',
    CREDIT_CARD: 'credit_card',
    CARD: 'credit_card',
  }

  private buildChargePayload(contract: ChargeContract): Record<string, unknown> {
    const amountCents = Math.round(contract.amount * 100)
    const paymentMethod = PaymentsService.SUPPORTED_PAYMENT_METHODS[String(contract.method || '').toUpperCase()]
    if (!paymentMethod) {
      throw new Error(
        `Metodo de pagamento "${contract.method}" nao e suportado pelo conector de pagamentos (aceita PIX ou CREDIT_CARD).`,
      )
    }

    return {
      amount: amountCents,
      currency: 'BRL',
      description: contract.description,
      payment_method: paymentMethod,
      expires_in: contract.expiresInSeconds,
      customer: {
        name: contract.customerName,
        phone: contract.customerPhone,
      },
      pix: paymentMethod === 'pix' && contract.pixKey
        ? { key: contract.pixKey, key_type: 'random' }
        : undefined,
      metadata: contract.metadata,
    }
  }
}
