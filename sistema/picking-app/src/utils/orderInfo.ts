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

export const PICK_METHOD_LABEL: Record<string, string> = {
  CAMERA: 'Código lido pela câmera',
  TYPED: 'EAN digitado',
  MANUAL: 'Marcado sem ler o código',
  BARCODE: 'Código lido',
}

/** Endereco de entrega em duas linhas, e o link do mapa. */
export function addressLines(a: Order['addressSnapshot']): { line1: string; line2: string; reference: string; mapsUrl: string } | null {
  if (!a?.street) return null
  const line1 = `${a.street}${a.number ? `, ${a.number}` : ''}${a.complement ? ` · ${a.complement}` : ''}`
  const line2 = [a.neighborhood, a.city].filter(Boolean).join(' · ')
  const query = [a.street, a.number, a.neighborhood, a.city].filter(Boolean).join(', ')
  return { line1, line2, reference: a.reference || '', mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` }
}

/** Parecido com o `obs` do DAV (buildDeliveryLabel no backend); aqui o frete por valor minimo diz o valor. */
export function deliveryLabel(order: Pick<Order, 'fulfillmentType' | 'delivery' | 'deliverySnapshot'>): string {
  if (order.fulfillmentType === 'PICKUP') return 'Retirada na loja'
  const fee = Number(order.delivery) || 0
  if (fee > 0) return `Taxa de entrega: R$ ${fee.toFixed(2).replace('.', ',')}`
  const snapshot = order.deliverySnapshot
  if (snapshot?.freeShippingReason === 'FIRST_ORDER') return 'Primeiro pedido - frete grátis'
  if (snapshot?.freeShippingReason === 'EARNED' && snapshot.freeAbove) {
    return `Frete grátis: pedido acima de R$ ${Number(snapshot.freeAbove).toFixed(2).replace('.', ',')}`
  }
  return 'Frete grátis'
}
