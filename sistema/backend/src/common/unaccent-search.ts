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
