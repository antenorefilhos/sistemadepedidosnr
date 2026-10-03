/**
 * Dias de venda do produto (03/10/2026): a pizza com assadeira so e feita de
 * quinta a domingo. `saleWeekdays` guarda os dias da semana (0 = domingo ...
 * 6 = sabado); lista vazia = todos os dias.
 *
 * O dia que conta e o da ENTREGA/RETIRADA, nao o do clique: a mesma regra das
 * ofertas (promoDayFor). Pedido feito quarta depois do fechamento e entregue
 * quinta, entao a pizza vale; pedido agendado para segunda, nao.
 *
 * Mesma regra no storefront (frontend/src/utils/saleDays.ts), so para a tela.
 * Quem barra e o checkout.
 */
export const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Dias validos, sem repeticao e em ordem; "todos os sete" vira lista vazia. */
export function normalizeSaleWeekdays(input: unknown): number[] {
  const list = Array.isArray(input) ? input : []
  const days = [...new Set(list.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
  return days.length === 7 ? [] : days
}

/** Dia da semana (0-6) de uma data AAAA-MM-DD, no horario de Brasilia. */
export function weekdayOf(isoDay: string): number {
  return new Date(`${isoDay}T12:00:00-03:00`).getUTCDay()
}

export function isSoldOnDay(product: { saleWeekdays?: number[] | null }, isoDay: string): boolean {
  const days = product.saleWeekdays || []
  return days.length === 0 || days.includes(weekdayOf(isoDay))
}

/**
 * "de quinta a domingo", "às terças e quintas", "aos sábados". Sequencia de 3+
 * dias seguidos (inclusive passando de sabado para domingo) vira intervalo.
 */
export function saleDaysLabel(saleWeekdays?: number[] | null): string {
  const days = normalizeSaleWeekdays(saleWeekdays)
  if (!days.length) return 'todos os dias'
  // Comeca a contar logo depois de um dia que nao vende: assim qui-sex-sab-dom
  // fica num bloco so, em vez de "domingo e de quinta a sabado".
  const start = [...Array(7).keys()].find((d) => !days.includes(d) && days.includes((d + 1) % 7))
  const ordered = start === undefined ? days : [...Array(7).keys()].map((i) => (start + 1 + i) % 7).filter((d) => days.includes(d))
  const blocks: number[][] = []
  for (const d of ordered) {
    const last = blocks[blocks.length - 1]
    if (last && (last[last.length - 1] + 1) % 7 === d) last.push(d)
    else blocks.push([d])
  }
  if (blocks.length === 1 && blocks[0].length >= 3) {
    return `de ${WEEKDAY_NAMES[blocks[0][0]]} a ${WEEKDAY_NAMES[blocks[0][blocks[0].length - 1]]}`
  }
  // Segunda a sexta sao femininas ("às quintas"), sabado e domingo masculinos ("aos sábados").
  const article = (d: number) => (d === 0 || d === 6 ? 'aos' : 'às')
  const sameArticle = new Set(ordered.map(article)).size === 1
  const parts = ordered.map((d, i) => (sameArticle && i > 0 ? `${WEEKDAY_NAMES[d]}s` : `${article(d)} ${WEEKDAY_NAMES[d]}s`))
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}
