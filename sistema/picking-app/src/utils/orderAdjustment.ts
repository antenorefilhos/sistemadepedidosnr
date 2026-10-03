// Ajuste da separacao (03/10/2026): o que o cliente aprovou no checkout
// (approvedTotal) contra o valor de agora (total), que muda com peso, corte e
// item incluido. Mesma conta no admin (admin/src/utils/orderAdjustment.ts).

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
