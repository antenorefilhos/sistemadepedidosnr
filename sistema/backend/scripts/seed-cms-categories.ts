import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * As 15 macro-categorias N1 oficiais (ver TASK_DEV_CATEGORIAS_MAPPING.md).
 * `Higiene, Beleza & Pet` foi extinta e dividida em `Higiene & Perfumaria` e
 * `Pet Shop`; `Bazar & Utilidades` e `Tabacaria` sao novas. Tabacaria fica
 * deliberadamente por ultimo (priority 15).
 */
const CATEGORIES: { name: string; shortName: string; priority: number }[] = [
  { name: 'Açougue & Churrasco', shortName: 'Açougue', priority: 1 },
  { name: 'Adega & Destilados', shortName: 'Adega & Vinhos', priority: 2 },
  { name: 'Cervejas & Bebidas Geladas', shortName: 'Bebidas', priority: 3 },
  { name: 'Hortifruti & Orgânicos', shortName: 'Hortifruti', priority: 4 },
  { name: 'Queijos, Frios & Laticínios', shortName: 'Frios & Queijos', priority: 5 },
  { name: 'Padaria, Confeitaria & Café', shortName: 'Padaria', priority: 6 },
  { name: 'Mercearia & Despensa', shortName: 'Mercearia', priority: 7 },
  { name: 'Espaço Gourmet & Importados', shortName: 'Gourmet', priority: 8 },
  { name: 'Congelados & Práticos', shortName: 'Congelados', priority: 9 },
  { name: 'Doces, Chocolates & Snacks', shortName: 'Doces & Snacks', priority: 10 },
  { name: 'Limpeza & Cuidados da Casa', shortName: 'Limpeza', priority: 11 },
  { name: 'Higiene & Perfumaria', shortName: 'Higiene', priority: 12 },
  { name: 'Pet Shop', shortName: 'Pet Shop', priority: 13 },
  { name: 'Bazar & Utilidades', shortName: 'Utilidades', priority: 14 },
  { name: 'Tabacaria', shortName: 'Tabacaria', priority: 15 },
]

async function main() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { shortName: category.shortName, priority: category.priority, active: true },
      create: { name: category.name, shortName: category.shortName, priority: category.priority, active: true },
    })
  }
  console.log(`${CATEGORIES.length} categoria(s) N1 sincronizada(s).`)

  // Categorias antigas fora das 12 oficiais ficam inativas, nao deletadas --
  // preserva curadoria/mapeamentos e nao quebra link antigo que aponte pro id.
  const deactivated = await prisma.category.updateMany({
    where: { name: { notIn: CATEGORIES.map((c) => c.name) }, active: true },
    data: { active: false },
  })
  if (deactivated.count) {
    console.log(`${deactivated.count} categoria(s) antiga(s) desativada(s) (fora da taxonomia oficial).`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
