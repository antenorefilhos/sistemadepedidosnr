import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * De-Para ERP Solidcom -> categoria N1 oficial (TASK_DEV_BEBIDAS_TAXONOMIA.md, secao 2).
 *
 * O ERP concatena "N1 | N2" dentro de um UNICO campo `classificationNN` de
 * forma inconsistente -- as vezes classification01 ja vem "04-HPLU | 02-LIMPEZA"
 * (e classification02 e o que seria N3), as vezes classification01 e so
 * "05-ACOUGUE" e classification02 e o N2 de verdade. Nao da pra confiar em
 * qual campo carrega qual nivel. A solucao robusta: concatenar TODOS os
 * campos classification01..04 (na ordem) com o mesmo separador " | " que o
 * ERP ja usa internamente, e casar por PREFIXO nesse caminho completo --os
 * exemplos do De-Para batem como prefixo desse caminho em qualquer ponto
 * onde o ERP tiver decidido quebrar os campos.
 */
const RULES: { categoryName: string; prefixes: string[] }[] = [
  { categoryName: 'Açougue & Churrasco', prefixes: ['05-ACOUGUE', '06-PERECIVEIS | 03-PEIXARIA'] },
  { categoryName: 'Adega, Vinhos & Espumantes', prefixes: ['03-BEBIDAS | 01-ADEGA'] },
  {
    categoryName: 'Cervejas & Chopp',
    prefixes: ['03-BEBIDAS | 02-ALCOOLICAS | 01-CERVEJA'],
  },
  {
    // Prefixo geral de ALCOOLICAS -- perde pra "01-CERVEJA" acima porque o
    // matching ordena por prefixo mais longo primeiro (ver SORTED_RULES).
    categoryName: 'Destilados & Coquetéis',
    prefixes: ['03-BEBIDAS | 02-ALCOOLICAS'],
  },
  {
    categoryName: 'Sucos & Refrigerantes',
    prefixes: ['03-BEBIDAS | 03-NAO ALCOOLICAS'],
  },
  { categoryName: 'Hortifruti & Orgânicos', prefixes: ['08-FLV'] },
  {
    categoryName: 'Queijos, Frios & Laticínios',
    prefixes: ['07-LATICINIOS | 01-BALCAO', '07-LATICINIOS | 02-LEITES', '07-LATICINIOS | 03-REFRIGERADOS'],
  },
  {
    categoryName: 'Padaria, Confeitaria & Café',
    prefixes: [
      '09-FABRICO | 01-CONFEITARIA',
      '09-FABRICO | 02-LANCHERIA',
      '09-FABRICO | 03-PADARIA',
      '02-MERCEARIA DOCE | 05-PANIFICACAO',
    ],
  },
  {
    categoryName: 'Mercearia & Despensa',
    prefixes: [
      '01-MERCEARIA SALGADA | 01-CEREAIS',
      '01-MERCEARIA SALGADA | 03-CONSERVAS',
      '01-MERCEARIA SALGADA | 04-GORDUROSOS',
      '01-MERCEARIA SALGADA | 05-MASSAS',
      '01-MERCEARIA SALGADA | 02-CESTAS',
    ],
  },
  {
    categoryName: 'Espaço Gourmet & Importados',
    prefixes: ['10-ESPACO GOURMET', '02-MERCEARIA DOCE | 06-VIDA SAUDAVEL'],
  },
  {
    categoryName: 'Congelados & Práticos',
    prefixes: ['06-PERECIVEIS | 01-CONGELADOS', '06-PERECIVEIS | 04-SUPER CONGELADOS'],
  },
  {
    categoryName: 'Doces, Chocolates & Snacks',
    prefixes: [
      '02-MERCEARIA DOCE | 01-BISCOITOS',
      '02-MERCEARIA DOCE | 02-BOMBONIERE',
      '02-MERCEARIA DOCE | 03-DOCES E COMPOTAS',
      '02-MERCEARIA DOCE | 04-MATINAIS',
    ],
  },
  { categoryName: 'Limpeza & Cuidados da Casa', prefixes: ['04-HPLU | 02-LIMPEZA'] },
  {
    categoryName: 'Higiene & Perfumaria',
    prefixes: ['04-HPLU | 01-HIGIENE PESSOAL', '04-HPLU | 04-PERFUMARIA', '04-HPLU | 06-SAUDE'],
  },
  { categoryName: 'Pet Shop', prefixes: ['04-HPLU | 05-PET SHOP'] },
  { categoryName: 'Bazar & Utilidades', prefixes: ['04-HPLU | 08-UTILIDADES', '13-EMBALAGENS'] },
  { categoryName: 'Tabacaria', prefixes: ['04-HPLU | 07-TABACARIA'] },
]

// Prefixo mais longo primeiro: resolve o caso Adega/Cervejas, onde
// "03-BEBIDAS | 02-ALCOOLICAS | 01-CERVEJA" tambem bate como prefixo de
// "03-BEBIDAS | 02-ALCOOLICAS" (Adega) -- sem isso, cerveja cairia na Adega
// por ordem de declaracao em vez de ir pra Cervejas & Bebidas.
const SORTED_RULES = RULES.flatMap((rule) =>
  rule.prefixes.map((prefix) => ({ categoryName: rule.categoryName, prefix })),
).sort((a, b) => b.prefix.length - a.prefix.length)

function matchCategory(fullPath: string): string | null {
  for (const rule of SORTED_RULES) {
    if (fullPath.startsWith(rule.prefix)) return rule.categoryName
  }
  return null
}

async function main() {
  const categories = await prisma.category.findMany({
    where: { name: { in: RULES.map((r) => r.categoryName) } },
  })
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))

  const missing = RULES.map((r) => r.categoryName).filter((name) => !categoryIdByName.has(name))
  if (missing.length) {
    throw new Error(
      `Categoria(s) nao encontrada(s) no banco (rode seed-cms-categories.ts antes): ${missing.join(', ')}`,
    )
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { ean: true, classification01: true, classification02: true, classification03: true, classification04: true },
  })

  const counts = new Map<string, number>()
  let unmapped = 0
  const upserts: { ean: string; categoryId: string }[] = []

  for (const product of products) {
    const fullPath = [product.classification01, product.classification02, product.classification03, product.classification04]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(' | ')
    if (!fullPath) {
      unmapped++
      continue
    }

    const categoryName = matchCategory(fullPath)
    if (!categoryName) {
      unmapped++
      continue
    }

    const categoryId = categoryIdByName.get(categoryName)!
    counts.set(categoryName, (counts.get(categoryName) || 0) + 1)
    upserts.push({ ean: product.ean, categoryId })
  }

  const BATCH_SIZE = 500
  for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
    const batch = upserts.slice(i, i + BATCH_SIZE)
    await prisma.$transaction(
      batch.map(({ ean, categoryId }) =>
        prisma.productCategoryMapping.upsert({
          where: { ean },
          update: { categoryId, source: 'auto_classify' },
          create: { ean, categoryId, source: 'auto_classify' },
        }),
      ),
    )
    console.log(`${Math.min(i + BATCH_SIZE, upserts.length)}/${upserts.length} mapeamento(s) gravado(s)...`)
  }

  console.log('\nResumo por categoria:')
  for (const rule of RULES) {
    console.log(`  ${rule.categoryName}: ${counts.get(rule.categoryName) || 0}`)
  }
  console.log(`\n${upserts.length} produto(s) mapeado(s), ${unmapped} sem classificacao correspondente (ficam fora da taxonomia -- servico/patrimonial/sem categoria do ERP).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
