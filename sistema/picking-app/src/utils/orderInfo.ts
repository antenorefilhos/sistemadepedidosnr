import type { Order } from '../services/api'

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CARD: 'Cartão na entrega',
  VOUCHER: 'Vale-alimentação',
}

export function paymentLabel(method: string): string {
  return PAYMENT_LABELS[method] || method
}

/** Mesmo texto que vai no `obs` do DAV (buildDeliveryLabel no backend). */
export function deliveryLabel(order: Pick<Order, 'fulfillmentType' | 'delivery' | 'deliverySnapshot'>): string {
  if (order.fulfillmentType === 'PICKUP') return 'Retirada na loja'
  const fee = Number(order.delivery) || 0
  if (fee > 0) return `Taxa de entrega: R$ ${fee.toFixed(2).replace('.', ',')}`
  return order.deliverySnapshot?.freeShippingReason === 'FIRST_ORDER' ? 'Primeiro pedido - frete grátis' : 'Frete grátis'
}
