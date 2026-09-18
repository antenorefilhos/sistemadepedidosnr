/**
 * JON-171 (encarte futuro aplicava preco/push antes da vigencia): regra
 * unica de janela comercial, usada por catalogo, Home, pricing/checkout,
 * banners e push -- pra ninguem reimplementar essa comparacao com seu
 * proprio bug de fuso.
 *
 * O ERP manda startDate/endDate como string, as vezes so a data
 * ("2026-09-17"), as vezes ISO completo com offset. `new Date("2026-09-17")`
 * e interpretado como MEIA-NOITE UTC -- em America/Sao_Paulo (UTC-3, sem
 * horario de verao desde 2019) isso e 21h do dia ANTERIOR. Um encarte
 * cadastrado pra "amanha" virava "ja comecou" se alguem habilitasse depois
 * das 21h de hoje -- exatamente o relato real que abriu este ticket.
 */
const SAO_PAULO_OFFSET = '-03:00'
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseErpBusinessDate(raw: string): Date {
  if (DATE_ONLY_RE.test(raw)) {
    return new Date(`${raw}T00:00:00${SAO_PAULO_OFFSET}`)
  }
  return new Date(raw)
}

/**
 * Mesma armadilha do comentario acima, na ponta oposta: uma `endDate`
 * "so a data" precisa significar o FIM daquele dia, nao o inicio -- senao a
 * campanha expira as 00h do ultimo dia em vez de as 23h59. Confirmado com a
 * AntenorApi (18/09/2026, braincoletivo) que `promotionalPriceValidUntil` do
 * lado deles ja vem em ISO completo terminando `23:59:59.999Z` -- essa
 * funcao e a rede de seguranca pra qualquer `endDate`/`dataFim` que ainda
 * chegue so como `"AAAA-MM-DD"` (Solidcom ou fonte futura).
 */
export function parseErpBusinessDateEnd(raw: string): Date {
  if (DATE_ONLY_RE.test(raw)) {
    return new Date(`${raw}T23:59:59.999${SAO_PAULO_OFFSET}`)
  }
  return new Date(raw)
}

export function isWithinBusinessWindow(startDate: Date, endDate: Date, now: Date): boolean {
  return startDate.getTime() <= now.getTime() && now.getTime() <= endDate.getTime()
}
