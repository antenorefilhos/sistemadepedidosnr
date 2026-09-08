/**
 * Codigo do pedido pra exibir ao entregador — o mesmo numero que o
 * separador digitou no PDV (DAV), pra ele conseguir se referir ao pedido
 * por telefone com a loja/cliente sem precisar copiar um UUID.
 *
 * Mesmo padrao do picking-app (utils/orderCode.ts): sem DAV (pedido que
 * ainda nao sincronizou), cai no id curto, que ao menos identifica o
 * pedido no nosso lado.
 */
export function getOrderCode(order: { id: string; erpDav?: string | null } | undefined): string {
  if (!order) return '—'
  return order.erpDav || order.id.slice(-8).toUpperCase()
}
