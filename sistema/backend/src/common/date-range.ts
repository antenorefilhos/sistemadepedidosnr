import { BadRequestException } from '@nestjs/common'

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Valida um periodo "de/ate" (query string, formato AAAA-MM-DD) usado pelo
 * calendario das telas de relatorio (16/10/2026). So checa formato, ordem e
 * teto de dias -- a conversao pro fuso certo (Brasilia) fica com quem chama,
 * porque cada tela tem sua propria nocao de "inicio do dia" (ver
 * dashboard-overview.service.ts#startOfDayBrt).
 *
 * O teto existe porque as consultas de relatorio (orders/analyticsEvent/...)
 * nao paginam -- um periodo de anos puxaria a base inteira pra memoria.
 */
export function validateDateRangeParams(from: string | undefined, to: string | undefined, maxDays = 366): { from: string; to: string } {
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    throw new BadRequestException('Informe um período válido (de/até).')
  }
  const fromDate = new Date(`${from}T00:00:00Z`)
  const toDate = new Date(`${to}T00:00:00Z`)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new BadRequestException('Informe um período válido (de/até).')
  }
  if (fromDate.getTime() > toDate.getTime()) {
    throw new BadRequestException('A data inicial não pode ser depois da data final.')
  }
  const spanDays = Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1
  if (spanDays > maxDays) {
    throw new BadRequestException(`O período não pode passar de ${maxDays} dias.`)
  }
  return { from, to }
}
