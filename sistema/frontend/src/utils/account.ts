import type { OrderItem } from '../types'

// Apoio da pagina Minha conta (07/10/2026).

/** Etapa (0-3) do pedido para o cliente: recebido, separando, a caminho/pronto, entregue/retirado. */
export function orderStep(status: string) {
  if (['PENDING', 'CONFIRMED'].includes(status)) return 0
  if (['PICKING_PENDING', 'PICKING', 'CONFERENCE_PENDING', 'PACKING', 'READY_FOR_CHECKOUT'].includes(status)) return 1
  if (['READY_FOR_DELIVERY', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(status)) return 2
  return 3
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
/** "Hoje, 14:32", "Ontem, 09:10" ou "05 de out.". */
export function formatWhen(iso: string, now = new Date()) {
  const d = new Date(iso)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (sameDay(d, now)) return `Hoje, ${time}`
  if (sameDay(d, yesterday)) return `Ontem, ${time}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}

/** Quantidade como o cliente pediu: pesavel em kg (o pedido grava kg), o resto em unidades. */
export function itemQuantity(item: Pick<OrderItem, 'quantity' | 'product'>) {
  if (item.product?.isFractional) return `${item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
  return `${item.quantity} un`
}

export const firstName = (name?: string) => String(name || '').trim().split(/\s+/)[0] || ''
export const initials = (name?: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase() || 'AF'
}
/** CPF pela metade: o resto nao precisa aparecer na tela (LGPD). */
export const maskCpf = (cpf?: string) => {
  const d = String(cpf || '').replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 3)}.***.***-${d.slice(9)}` : '—'
}
export const formatPhone = (v?: string) => {
  const d = String(v || '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return v || '—'
}
export const formatZip = (value: string) => {
  const clean = value.replace(/\D/g, '').slice(0, 8)
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean
}
