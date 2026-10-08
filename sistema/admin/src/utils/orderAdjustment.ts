// Ajuste da separacao (03/10/2026): o que o cliente aprovou no checkout
// (approvedTotal) contra o valor de agora (total), que muda com peso, corte e
// item incluido. Copia de picking-app/src/utils/orderAdjustment.ts.

export type OrderAdjustment = { approved: number; final: number; diff: number; pct: number }

export function orderAdjustment(order: { approvedTotal?: number | null; total?: number | null }): OrderAdjustment | null {
  const approved = Number(order.approvedTotal)
  const final = Number(order.total)
  if (!(approved > 0) || !Number.isFinite(final)) return null
  const diff = Math.round((final - approved) * 100) / 100
  return { approved, final, diff, pct: (diff / approved) * 100 }
}

export const brl = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ')

const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '')

/** "+R$ 2,61" / "−R$ 8,74" */
export const signedBrl = (v: number) => `${sign(v)}${brl(Math.abs(v))}`

/** "+3,8%" / "−9,0%" */
export const signedPct = (p: number) =>
  `${sign(Math.round(p * 10) / 10)}${Math.abs(p).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

// Ajuste explicado (08/10/2026): o "+3,8%" sozinho confundia. A diferenca
// entre o aprovado e o final sai separada por motivo, item a item. Mesma
// conta no app de separacao (picking-app/src/utils/orderAdjustment.ts).

export type AdjustmentItem = {
  id: string
  status?: string | null
  quantity: number
  subtotal: number
  requestedQuantity?: number | string | null
  fulfilledQuantity?: number | string | null
  finalSubtotal?: number | string | null
  addedByPicker?: boolean | null
  substitutedByItemId?: string | null
  product?: { isFractional?: boolean | null; unit?: string | null } | null
}

export type ChangeKind = 'missing' | 'weight' | 'quantity' | 'added' | 'substitution' | 'same' | 'pending'
export type ItemChange = { kind: ChangeKind; approved: number; final: number | null; diff: number }

const round2 = (v: number) => Math.round(v * 100) / 100
const asNumber = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v))
const isWeighed = (p?: AdjustmentItem['product']) => Boolean(p?.isFractional) || ['kg', 'quilo', 'g'].includes(String(p?.unit || '').toLowerCase())

/** O que mudou num item entre o que o cliente aprovou e o que foi separado. */
export function itemChange(item: AdjustmentItem, all: AdjustmentItem[]): ItemChange {
  const isSubstitute = all.some((other) => other.substitutedByItemId === item.id)
  const approved = item.addedByPicker || isSubstitute ? 0 : round2(Number(item.subtotal) || 0)
  const status = String(item.status || 'PENDING')
  if (status === 'PENDING' || status === 'ACTIVE') return { kind: 'pending', approved, final: null, diff: 0 }
  if (status === 'MISSING' || status === 'CANCELLED') return { kind: 'missing', approved, final: 0, diff: -approved }
  if (status === 'SUBSTITUTED') return { kind: 'substitution', approved, final: 0, diff: -approved }
  const final = round2(asNumber(item.finalSubtotal) ?? Number(item.subtotal) ?? 0)
  const diff = round2(final - approved)
  if (isSubstitute) return { kind: 'substitution', approved, final, diff }
  if (item.addedByPicker) return { kind: 'added', approved, final, diff }
  if (Math.abs(diff) < 0.01) return { kind: 'same', approved, final, diff: 0 }
  return { kind: isWeighed(item.product) ? 'weight' : 'quantity', approved, final, diff }
}

export const CHANGE_LABEL: Record<Exclude<ChangeKind, 'same' | 'pending'> | 'other', string> = {
  missing: 'Itens em falta',
  weight: 'Peso diferente do pedido',
  quantity: 'Quantidade alterada',
  added: 'Itens incluídos pelo separador',
  substitution: 'Trocas',
  other: 'Frete e desconto',
}

export type AdjustmentLine = { key: keyof typeof CHANGE_LABEL; label: string; count: number; amount: number }
export type AdjustmentBreakdown = OrderAdjustment & { lines: AdjustmentLine[] }

/** Aprovado x final, com a diferenca separada por motivo. */
export function adjustmentBreakdown(order: { approvedTotal?: number | null; total?: number | null; items?: AdjustmentItem[] }): AdjustmentBreakdown | null {
  const base = orderAdjustment(order)
  if (!base) return null
  const items = order.items || []
  const totals = new Map<AdjustmentLine['key'], { count: number; amount: number }>()
  let itemsDiff = 0
  for (const item of items) {
    const change = itemChange(item, items)
    if (change.kind === 'same' || change.kind === 'pending') continue
    const entry = totals.get(change.kind) || { count: 0, amount: 0 }
    // Na troca, o par (original + substituto) conta como uma troca so.
    if (!(change.kind === 'substitution' && item.status !== 'SUBSTITUTED')) entry.count += 1
    entry.amount = round2(entry.amount + change.diff)
    totals.set(change.kind, entry)
    itemsDiff = round2(itemsDiff + change.diff)
  }
  const other = round2(base.diff - itemsDiff)
  if (Math.abs(other) >= 0.01) totals.set('other', { count: 0, amount: other })
  const sequence: AdjustmentLine['key'][] = ['missing', 'substitution', 'weight', 'quantity', 'added', 'other']
  const lines = sequence.filter((key) => totals.has(key)).map((key) => ({ key, label: CHANGE_LABEL[key], ...totals.get(key)! }))
  return { ...base, lines }
}

/** "R$ 11,54 a menos que o aprovado pelo cliente (−11,8%)" */
export function adjustmentSentence(adj: OrderAdjustment): string {
  if (Math.abs(adj.diff) < 0.01) return 'Igual ao valor aprovado pelo cliente'
  return `${brl(Math.abs(adj.diff))} a ${adj.diff < 0 ? 'menos' : 'mais'} que o aprovado pelo cliente (${signedPct(adj.pct)})`
}
