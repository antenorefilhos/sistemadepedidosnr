// Dias de venda do produto (03/10/2026). Copia de frontend/src/utils/saleDays.ts e
// backend/src/common/sale-days.ts, so para a tela: quem barra e o checkout.
// saleWeekdays: 0 = domingo ... 6 = sabado; vazio = todos os dias.

const NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function normalizeSaleWeekdays(input: unknown): number[] {
  const list = Array.isArray(input) ? input : []
  const days = [...new Set(list.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
  return days.length === 7 ? [] : days
}

export function isSoldOnWeekday(product: { saleWeekdays?: number[] | null }, weekday: number): boolean {
  const days = normalizeSaleWeekdays(product.saleWeekdays)
  return days.length === 0 || days.includes(weekday)
}

/** Dias na ordem da semana da loja, comecando logo depois de um dia sem venda. */
function orderedBlocks(days: number[]) {
  const start = [...Array(7).keys()].find((d) => !days.includes(d) && days.includes((d + 1) % 7))
  const ordered = start === undefined ? days : [...Array(7).keys()].map((i) => (start + 1 + i) % 7).filter((d) => days.includes(d))
  const blocks: number[][] = []
  for (const d of ordered) {
    const last = blocks[blocks.length - 1]
    if (last && (last[last.length - 1] + 1) % 7 === d) last.push(d)
    else blocks.push([d])
  }
  return { ordered, blocks }
}

/** "de quinta a domingo", "às terças e quintas", "aos sábados". */
export function saleDaysLabel(saleWeekdays?: number[] | null): string {
  const days = normalizeSaleWeekdays(saleWeekdays)
  if (!days.length) return 'todos os dias'
  const { ordered, blocks } = orderedBlocks(days)
  if (blocks.length === 1 && blocks[0].length >= 3) return `de ${NAMES[blocks[0][0]]} a ${NAMES[blocks[0][blocks[0].length - 1]]}`
  const article = (d: number) => (d === 0 || d === 6 ? 'aos' : 'às')
  const sameArticle = new Set(ordered.map(article)).size === 1
  const parts = ordered.map((d, i) => (sameArticle && i > 0 ? `${NAMES[d]}s` : `${article(d)} ${NAMES[d]}s`))
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}

/** Curto, para o selo do card: "qui a dom", "ter e qui". */
export function saleDaysShort(saleWeekdays?: number[] | null): string {
  const days = normalizeSaleWeekdays(saleWeekdays)
  if (!days.length) return ''
  const { ordered, blocks } = orderedBlocks(days)
  if (blocks.length === 1 && blocks[0].length >= 3) return `${SHORT[blocks[0][0]]} a ${SHORT[blocks[0][blocks[0].length - 1]]}`
  const parts = ordered.map((d) => SHORT[d])
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}
