import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * As 17 macro-categorias N1 oficiais (ver TASK_DEV_BEBIDAS_TAXONOMIA.md).
 * `Adega & Destilados` e `Cervejas & Bebidas Geladas` foram extintas e
 * divididas em 4 categorias puras: Adega/Vinhos/Espumantes, Cervejas &
 * Chopp, Destilados & Coqueteis, Sucos & Refrigerantes. Tabacaria fica
 * deliberadamente por ultimo (priority 17).
 */
const CATEGORIES: { name: string; shortName: string; priority: number }[] = [
  { name: 'Açougue & Churrasco', shortName: 'Açougue', priority: 1 },
  { name: 'Adega, Vinhos & Espumantes', shortName: 'Adega & Vinhos', priority: 2 },
  { name: 'Cervejas & Chopp', shortName: 'Cervejas', priority: 3 },
  { name: 'Destilados & Coquetéis', shortName: 'Destilados', priority: 4 },
  { name: 'Sucos & Refrigerantes', shortName: 'Sucos & Refrescos', priority: 5 },
  { name: 'Hortifruti & Orgânicos', shortName: 'Hortifruti', priority: 6 },
  { name: 'Queijos, Frios & Laticínios', shortName: 'Frios & Queijos', priority: 7 },
  { name: 'Padaria, Confeitaria & Café', shortName: 'Padaria', priority: 8 },
  { name: 'Mercearia & Despensa', shortName: 'Mercearia', priority: 9 },
  { name: 'Espaço Gourmet & Importados', shortName: 'Gourmet', priority: 10 },
  { name: 'Congelados & Práticos', shortName: 'Congelados', priority: 11 },
  { name: 'Doces, Chocolates & Snacks', shortName: 'Doces & Snacks', priority: 12 },
  { name: 'Limpeza & Cuidados da Casa', shortName: 'Limpeza', priority: 13 },
  { name: 'Higiene & Perfumaria', shortName: 'Higiene', priority: 14 },
  { name: 'Pet Shop', shortName: 'Pet Shop', priority: 15 },
  { name: 'Bazar & Utilidades', shortName: 'Utilidades', priority: 16 },
  { name: 'Tabacaria', shortName: 'Tabacaria', priority: 17 },
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
