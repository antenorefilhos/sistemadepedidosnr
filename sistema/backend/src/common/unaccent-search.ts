import { Prisma } from '@prisma/client'
import type { PrismaService } from './prisma.service'

// Busca por nome ignorando acento (28/09/2026): o `contains` do Prisma so
// ignora maiuscula, entao "agua" nao achava "Água Coco" no admin nem no app de
// separacao. Usa a extensao unaccent (migration 20260928040000_unaccent).
export async function productIdsMatchingText(prisma: PrismaService, term: string): Promise<string[]> {
  const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM products
    WHERE unaccent(lower(concat_ws(' ', name, "alternativeDescription"))) LIKE unaccent(lower(${pattern}))
  `
  return rows.map((row) => row.id)
}

// Palavras que so ligam as outras: "pao de queijo" acha "Pao Queijo Forno de
// Minas" sem exigir o "de".
const LIGACAO = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'com', 'para', 'em'])

/** "Arroz Tio João!" -> ["arroz", "tio", "joao"]: sem acento, sem pontuacao, sem repetir. */
export function searchWords(term: string): string[] {
  const words = String(term || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  const unique = [...new Set(words)]
  const meaningful = unique.filter((w) => !LIGACAO.has(w))
  return (meaningful.length ? meaningful : unique).slice(0, 8)
}

const likeEscape = (value: string) => value.replace(/[\%_]/g, '\$&')

/**
 * Busca do separador por palavras (08/10/2026): "arroz tio joao" acha
 * "Arroz Branco Tipo 1 Longo Fino Tio João Pacote 1kg". Antes a frase tinha
 * que aparecer inteira e na ordem do cadastro. Todas as palavras precisam
 * estar no nome, em qualquer ordem e sem acento; vem primeiro o nome que
 * comeca pela primeira palavra, depois o que tem mais palavras no inicio de
 * uma palavra do nome ("tio" em "Tio Joao" antes de "Patio"), e o nome mais
 * curto (o produto, nao a variacao).
 */
export async function searchProductIdsByWords(
  prisma: PrismaService,
  term: string,
  scope: { tenantId?: string; storeId?: string },
  limit: number,
): Promise<string[]> {
  const words = searchWords(term)
  if (!words.length) return []
  const name = Prisma.sql`unaccent(lower(p.name))`
  const all = words.map((w) => Prisma.sql`${name} LIKE ${`%${likeEscape(w)}%`}`)
  const atWordStart = words.map((w) => Prisma.sql`(CASE WHEN (' ' || ${name}) LIKE ${`% ${likeEscape(w)}%`} THEN 1 ELSE 0 END)`)
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM products p
    WHERE p.active = true
      ${scope.tenantId ? Prisma.sql`AND p."tenantId" = ${scope.tenantId}` : Prisma.empty}
      ${scope.storeId ? Prisma.sql`AND p."storeId" = ${scope.storeId}` : Prisma.empty}
      AND ${Prisma.join(all, ' AND ')}
    ORDER BY (${name} LIKE ${`${likeEscape(words[0])}%`}) DESC,
      (${Prisma.join(atWordStart, ' + ')}) DESC,
      length(p.name) ASC,
      p.name ASC
    LIMIT ${limit}
  `
  return rows.map((row) => row.id)
}
