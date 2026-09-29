import type { PrismaService } from './prisma.service'

/**
 * Categorias que o site NAO oferece sozinho (vitrine, recomendacao, listagem
 * sem filtro): TABACARIA (Jonathan, 22/09/2026) e todo departamento oculto na
 * tela Departamentos do admin (29/09/2026). Quem busca pelo nome ou abre a
 * categoria pelo link continua achando e comprando -- a venda nao e bloqueada
 * (ver isProductSellable).
 *
 * O codigo e o `Product.category`, que o sync grava a partir do nome da
 * categoria no CMS (mesma normalizacao abaixo).
 *
 * ponytail: cache em memoria de 60 s por processo; ocultar um departamento
 * leva ate 1 min para valer (invalidateNotOffered zera na hora no processo
 * que salvou).
 */
export const categoryCodeFromName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

let cache: { at: number; codes: Set<string> } = { at: 0, codes: new Set(['TABACARIA']) }
let refreshing: Promise<Set<string>> | null = null

export function invalidateNotOffered() {
  cache = { ...cache, at: 0 }
}

export async function notOfferedCategoryCodes(prisma: PrismaService): Promise<Set<string>> {
  if (Date.now() - cache.at < 60_000) return cache.codes
  refreshing ??= Promise.resolve()
    .then(() => prisma.category.findMany({ where: { parentId: null, active: false }, select: { name: true } }))
    .then((rows) => {
      cache = { at: Date.now(), codes: new Set(['TABACARIA', ...rows.map((r) => categoryCodeFromName(r.name))]) }
      return cache.codes
    })
    .catch(() => cache.codes)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}
