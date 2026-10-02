import { spDay } from './delivery-hours'
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
// 01/10/2026: a AntenorApi serializa a DATA do encarte (o ERP so guarda o dia)
// como meia-noite ou 23:59:59.999 com "Z". Lido ao pe da letra, todo encarte
// comecava as 21h da vespera e acabava as 20h59 do ultimo dia em Brasilia --
// o site tirava o preco 3h antes do caixa. Esses dois horarios exatos sao dia
// de calendario, nao instante UTC; qualquer outro horario com Z e respeitado.
const DAY_START_Z_RE = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?Z$/
const DAY_END_Z_RE = /^(\d{4}-\d{2}-\d{2})T23:59:59(?:\.\d+)?Z$/

export function parseErpBusinessDate(raw: string): Date {
  const day = DATE_ONLY_RE.test(raw) ? raw : DAY_START_Z_RE.exec(raw)?.[1]
  if (day) return new Date(`${day}T00:00:00${SAO_PAULO_OFFSET}`)
  return new Date(raw)
}

/**
 * Mesma armadilha do comentario acima, na ponta oposta: uma `endDate`
 * "so a data" precisa significar o FIM daquele dia, nao o inicio -- senao a
 * campanha expira as 00h do ultimo dia em vez de as 23h59. A AntenorApi manda
 * `endDate` e `promotionalPriceValidUntil` como `AAAA-MM-DDT23:59:59.999Z`, que
 * e o fim do dia de CALENDARIO, nao 23h59 UTC (ver DAY_END_Z_RE). Meia-noite
 * com Z no fim tambem vira o fim daquele dia ("valida ate 02/10").
 */
export function parseErpBusinessDateEnd(raw: string): Date {
  const day = DATE_ONLY_RE.test(raw) ? raw : (DAY_END_Z_RE.exec(raw) || DAY_START_Z_RE.exec(raw))?.[1]
  if (day) return new Date(`${day}T23:59:59.999${SAO_PAULO_OFFSET}`)
  return new Date(raw)
}

/**
 * Oferta vale para um pedido entregue no dia `day` (02/10/2026, decisao do
 * Jonathan): o preco segue o dia da entrega, nao o relogio. Com a loja fechada,
 * o pedido e de amanha -- a oferta que acaba hoje sai do site no fechamento, e
 * a que comeca amanha ja aparece. Ver fulfillmentDay (delivery-hours.ts).
 */
export function isPromoValidOnDay(day: string, startDate: Date | null | undefined, endDate: Date | null | undefined): boolean {
  return (!startDate || spDay(startDate) <= day) && (!endDate || day <= spDay(endDate))
}

export function isWithinBusinessWindow(startDate: Date, endDate: Date, now: Date): boolean {
  return startDate.getTime() <= now.getTime() && now.getTime() <= endDate.getTime()
}
