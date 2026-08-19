import type { Order } from '../services/api'

/**
 * Codigo que o separador digita no PDV pra puxar o pedido.
 *
 * O PDV so aceita numero -- o nosso id interno e um UUID, entao os 8 ultimos
 * caracteres dele ("#CDBCA339") nao servem pra isso. O numero certo e o DAV,
 * que o Solidcom devolve quando recebe o pedido.
 *
 * Enquanto o pedido nao sincroniza (ou se a integracao falhou) nao existe DAV;
 * nesse caso caimos no id curto, que ainda identifica o pedido no nosso lado.
 */
export function getOrderPdvCode(order: Pick<Order, 'id' | 'erpDav'>): string {
  return order.erpDav || order.id.slice(-8).toUpperCase()
}

/** true quando o codigo exibido e o DAV de verdade (digitavel no PDV). */
export function hasPdvCode(order: Pick<Order, 'erpDav'>): boolean {
  return Boolean(order.erpDav)
}
