import { BadRequestException } from '@nestjs/common'

/** Resolve um filtro from/to de querystring, com default de N dias; 400 em vez de deixar `Invalid Date` estourar no Prisma. */
export function resolveDateRange(filters: { from?: string; to?: string }, defaultDays: number) {
  const from = filters.from ? new Date(filters.from) : new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000)
  const to = filters.to ? new Date(filters.to) : new Date()
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException('Parametro from/to invalido. Use uma data ISO valida.')
  }
  return { from, to }
}
