import type { CheckoutQuoteResponse } from '../services/api'
import { getAsapWindow, type HoursConfig } from './deliveryOperation'

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

/**
 * Janela "o quanto antes" usada quando o backend nao devolve slot.
 * JON-177 (Auditoria 360): com `weekly` (horario de funcionamento da loja,
 * `brand.businessHours`), a janela e clampada ao fechamento -- sem isso a
 * loja podia prometer entrega em ate 3h mesmo perto ou fora do expediente.
 * Sem `weekly` (ou loja ja fechada), mantem o comportamento antigo: quem
 * decide se pode fechar pedido fora do horario e o backend/checkout, nao
 * este util de UI.
 */
export function createFallbackDeliverySlot(hours?: HoursConfig) {
  const clamped = hours ? getAsapWindow(hours) : null
  const windowStart = clamped?.windowStart ?? new Date(Date.now() + 45 * 60 * 1000)
  const windowEnd = clamped?.windowEnd ?? new Date(Date.now() + 3 * 60 * 60 * 1000)
  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  }
}

export function formatDeliveryWindow(quote?: CheckoutQuoteResponse | null) {
  const slot = quote?.delivery?.slot
  if (!slot?.windowStart || !slot?.windowEnd) return 'Próxima janela disponível'

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
        if (item.message) return `${nome}: ${item.message}`
        return item.available > 0
          ? `${nome} (você pediu ${item.requested}, temos ${item.available})`
          : `${nome} (esgotado)`
      })
      .join('; ')
    return `Revise o carrinho para continuar: ${detalhe}.`
  }
  if (quote.delivery.outOfArea) return 'Endereço fora da zona de entrega cadastrada.'
  return quote.blockers.join('; ') || 'Não foi possível confirmar o pedido agora.'
}

/** "123.456.789-09" enquanto digita (08/10/2026). */
export function maskCpfInput(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

/** "(24) 99999-0000" enquanto digita (08/10/2026). */
export function maskPhoneInput(value: string) {
  const d = value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
