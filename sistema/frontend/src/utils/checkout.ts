import type { CheckoutQuoteResponse } from '../services/api'

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CARD: 'Cartão na entrega',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  VOUCHER: 'Vale/Ticket Alimentação',
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

/**
 * Traduz o motivo pelo qual o checkout nao pode prosseguir.
 *
 * `nomePorProduto` existe porque a versao anterior devolvia so "alguns itens
 * ficaram indisponiveis" -- o cliente ficava travado sem saber QUAL item
 * mexer. O detalhe ate era exibido, mas dentro do card de resumo do pedido,
 * longe do alerta que barrou o envio. O backend sempre mandou productId,
 * requested e available; faltava trazer isso pro texto do erro.
 */
export function getCheckoutBlockerMessage(
  quote: CheckoutQuoteResponse,
  nomePorProduto?: (productId: string) => string | undefined,
) {
  const indisponiveis = quote.stock.unavailableItems
  if (indisponiveis.length > 0) {
    const detalhe = indisponiveis
      .map((item) => {
        const nome = nomePorProduto?.(item.productId) || 'Item do carrinho'
        return item.available > 0
          ? `${nome} (voce pediu ${item.requested}, temos ${item.available})`
          : `${nome} (esgotado)`
      })
      .join('; ')
    return `Revise o carrinho para continuar: ${detalhe}.`
  }
  if (quote.delivery.outOfArea) return 'Endereco fora da zona de entrega cadastrada.'
  if (!quote.delivery.validSlot) return 'Selecione uma janela de entrega valida para continuar.'
  return quote.blockers.join('; ') || 'Nao foi possivel confirmar o checkout agora.'
}
