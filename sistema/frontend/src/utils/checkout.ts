import type { CheckoutQuoteResponse } from '../services/api'

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CARD: 'Cartão na entrega',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
}

/** Chave idempotente por tentativa de checkout (evita pedido duplicado). */
export function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Janela "o quanto antes" usada quando o backend nao devolve slot. */
export function createFallbackDeliverySlot() {
  const windowStart = new Date(Date.now() + 45 * 60 * 1000)
  const windowEnd = new Date(Date.now() + 3 * 60 * 60 * 1000)
  return {
    slotId: 'ASAP',
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  }
}

export function formatDeliveryWindow(quote?: CheckoutQuoteResponse | null) {
  const slot = quote?.delivery?.slot
  if (!slot?.windowStart || !slot?.windowEnd) return 'Proxima janela disponivel'

  const asTime = (value: string) =>
    new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return `${asTime(slot.windowStart)} - ${asTime(slot.windowEnd)}`
}

/** Traduz o motivo pelo qual o checkout nao pode prosseguir. */
export function getCheckoutBlockerMessage(quote: CheckoutQuoteResponse) {
  if (quote.stock.unavailableItems.length > 0) {
    return 'Alguns itens ficaram indisponiveis antes do pagamento. Revise o carrinho para continuar.'
  }
  if (quote.delivery.outOfArea) return 'Endereco fora da zona de entrega cadastrada.'
  if (!quote.delivery.validSlot) return 'Selecione uma janela de entrega valida para continuar.'
  return quote.blockers.join('; ') || 'Nao foi possivel confirmar o checkout agora.'
}
