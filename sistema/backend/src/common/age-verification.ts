/**
 * Confirmacao de idade (+18) por categoria (AEF-062, 29/10/2026).
 *
 * Pedido do Jonathan via ORQ-API: bebida alcoolica e tabacaria exigem
 * confirmacao de idade no site, com liga/desliga por categoria no admin.
 *
 * O flag mora em `Category.requiresAgeVerification` (null = herda do pai;
 * raiz sem flag = false) e e denormalizado em `Product.requiresAgeVerification`
 * (ver `applyProductAgeVerificationFlags` abaixo) porque e lido em toda
 * listagem/busca/checkout, nao so na tela do produto.
 *
 * Excecao: a arvore v3 do ERP (braincoletivo/specs/arvore-v3-taxonomia.csv)
 * tem tipos sem alcool dentro de departamentos que exigem confirmacao --
 * "Cerveja sem Alcool" e "Mixer para Drinque" dentro de Adega e Cervejas,
 * confirmados com 5 e 0 produtos respectivamente em 29/10. Achamos tambem
 * "Bebida sem Alcool (vinho, espumante e sidra)" com o mesmo padrao (1
 * produto) -- nao foi citada explicitamente no pedido, mas e a mesma logica
 * (nao e alcoolico apesar do departamento), entao entrou na mesma lista.
 * Esses produtos NUNCA exigem confirmacao, mesmo com a categoria ligada --
 * olha o `classification03` do produto, nao a categoria resolvida.
 */

const normalizeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const AGE_VERIFICATION_CLASSIFICATION_EXCEPTIONS = [
  'Cerveja sem Álcool',
  'Mixer para Drinque',
  'Bebida sem Álcool (vinho, espumante e sidra)',
].map(normalizeKey)

export function isAgeVerificationException(classification03?: string | null): boolean {
  const value = String(classification03 || '').trim()
  if (!value) return false
  return AGE_VERIFICATION_CLASSIFICATION_EXCEPTIONS.includes(normalizeKey(value))
}

/** Valores crus (grafia exata do ERP), pra usar em filtro `in`/`notIn` do Prisma sem reimplementar o normalize em SQL. */
export const AGE_VERIFICATION_CLASSIFICATION_EXCEPTION_VALUES = [
  'Cerveja sem Álcool',
  'Mixer para Drinque',
  'Bebida sem Álcool (vinho, espumante e sidra)',
]

type CategoryFlagNode = { id: string; parentId: string | null; requiresAgeVerification: boolean | null }

/** Flag efetivo de uma categoria: o proprio valor se definido, senao o do pai, ate a raiz. */
export function resolveCategoryAgeVerification(categoryId: string, categoriesById: Map<string, CategoryFlagNode>): boolean {
  let current = categoriesById.get(categoryId)
  let depth = 0
  while (current && depth < 10) {
    if (current.requiresAgeVerification != null) return current.requiresAgeVerification
    if (!current.parentId) return false
    current = categoriesById.get(current.parentId)
    depth++
  }
  return false
}

/**
 * Mapa `codigo da categoria do site -> flag resolvido`, pronto pra aplicar
 * no sync sem reconsultar o banco por produto. `categoryCode` normaliza o
 * `Category.name` do mesmo jeito que `Product.category` ja guarda.
 */
export function buildCategoryAgeVerificationFlags(
  categories: Array<{ id: string; name: string; parentId: string | null; requiresAgeVerification: boolean | null }>,
): Map<string, boolean> {
  const byId = new Map<string, CategoryFlagNode>(categories.map((c) => [c.id, c]))
  const byCode = new Map<string, boolean>()
  for (const category of categories) {
    byCode.set(normalizeKey(category.name), resolveCategoryAgeVerification(category.id, byId))
  }
  return byCode
}

/** Produto exige confirmacao: categoria resolvida como `true` E produto nao e excecao de tipo. */
export function productRequiresAgeVerification(
  product: { category?: string | null; classification03?: string | null },
  categoryFlagsByCode: Map<string, boolean>,
): boolean {
  const code = String(product.category || '').trim()
  if (!code) return false
  if (!categoryFlagsByCode.get(code)) return false
  return !isAgeVerificationException(product.classification03)
}
