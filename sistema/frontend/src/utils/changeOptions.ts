function isRepresentable(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return false
  if (!Number.isInteger(amount)) return false

  // brute force with small denomination set (fast enough for our ranges)
  for (let a200 = 0; a200 <= Math.floor(amount / 200); a200 += 1) {
    const r200 = amount - a200 * 200
    for (let a100 = 0; a100 <= Math.floor(r200 / 100); a100 += 1) {
      const r100 = r200 - a100 * 100
      for (let a50 = 0; a50 <= Math.floor(r100 / 50); a50 += 1) {
        const r50 = r100 - a50 * 50
        if (r50 % 20 === 0) return true
      }
    }
  }
  return false
}

function findNextRepresentableAmount(minAmount: number) {
  const start = Math.max(0, Math.ceil(minAmount))
  
  // Acima de 200, busca múltiplos de 50 para melhor UX
  if (start > 200) {
    const next50 = Math.ceil(start / 50) * 50
    for (let value = next50; value <= start + 2000; value += 50) {
      if (isRepresentable(value)) return value
    }
  }
  
  // Abaixo de 200, busca valores válidos com cédulas disponíveis
  for (let value = start; value <= start + 2000; value += 1) {
    if (isRepresentable(value)) return value
  }
  // Fallback: should never happen, but keep UX stable.
  return start + 2000
}

/**
 * Gera as opções de "troco para" com cédulas >= 20 (20/50/100/200),
 * retornando `count` valores válidos e crescentes, sempre >= total.
 */
export function buildChangeForOptions(total: number, count = 3): number[] {
  const options: number[] = []
  let cursor = total
  while (options.length < count) {
    const next = findNextRepresentableAmount(cursor)
    if (options.length === 0 || next > options[options.length - 1]) {
      options.push(next)
    }
    cursor = next + 1
  }
  return options
}

export function formatChangeForLabel(value: number) {
  return `Troco para R$ ${value.toFixed(2).replace('.', ',')}`
}

export function parseChangeForFromNotes(notes?: string | null): number | null {
  const text = String(notes || '')
  const match = text.match(/Troco\s+para:\s*([0-9]+(?:[.,][0-9]{1,2})?)/i)
  if (!match) return null
  const normalized = match[1].replace('.', '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

