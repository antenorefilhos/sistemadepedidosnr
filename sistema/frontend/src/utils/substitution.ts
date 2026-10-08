import type { Order, SubstitutionSuggestion } from '../types'

// Troca sugerida na separacao (08/10/2026, etapa 2): o cliente escolhe em
// Minha conta. Mesmo prazo do app de separacao: depois dele o separador pode
// seguir sem as trocas.
export const SUBSTITUTION_REPLY_MINUTES = 15

const round2 = (v: number) => Math.round(v * 100) / 100

/** Trocas enviadas que esperam a resposta do cliente. */
export function pendingSuggestions(order: Pick<Order, 'substitutionSuggestions'>): SubstitutionSuggestion[] {
  return (order.substitutionSuggestions || []).filter((s) => s.status === 'PENDING' && s.sentAt)
}

/** Ate quando o cliente responde: 15 min depois do ultimo envio. */
export function replyDeadline(suggestions: SubstitutionSuggestion[]): Date | null {
  const last = suggestions.reduce((max, s) => Math.max(max, s.sentAt ? new Date(s.sentAt).getTime() : 0), 0)
  return last ? new Date(last + SUBSTITUTION_REPLY_MINUTES * 60000) : null
}

export const suggestionSubtotal = (s: Pick<SubstitutionSuggestion, 'unitPrice' | 'quantity'>) => round2(Number(s.unitPrice) * Number(s.quantity))

/** O total de agora ja exclui o que faltou; com as trocas, soma os substitutos. */
export function totalsWithSuggestions(order: Pick<Order, 'total'>, suggestions: SubstitutionSuggestion[]) {
  const without = round2(Number(order.total) || 0)
  return { without, with: round2(without + suggestions.reduce((sum, s) => sum + suggestionSubtotal(s), 0)) }
}

/** "220 g", "1,25 kg", "2 un"; vazio para 1 unidade. */
export function suggestionQuantityLabel(s: Pick<SubstitutionSuggestion, 'quantity' | 'product'>) {
  const qty = Number(s.quantity)
  const weighed = Boolean(s.product?.isFractional) || ['kg', 'quilo', 'g'].includes(String(s.product?.unit || '').toLowerCase())
  if (weighed) return qty < 1 ? `${Math.round(qty * 1000)} g` : `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
  return qty > 1 ? `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} un` : ''
}
