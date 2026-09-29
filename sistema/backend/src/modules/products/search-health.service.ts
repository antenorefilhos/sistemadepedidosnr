import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { productIdsMatchingText } from '../../common/unaccent-search'
import { ProductsService } from './products.service'
import { ProductSearchService } from './product-search.service'

/**
 * Saude da busca (29/09/2026): confere AGORA se um termo acha produto no site
 * (mesmo caminho da busca do cliente) e, quando nao acha, diz por que -- o
 * produto existe mas esta fora do site (inativo, sem estoque, oculto...) ou nao
 * existe no cadastro. Tambem guarda sinonimos criados pelo admin, que a busca
 * passa a usar na hora ("maisena" -> "maizena").
 */
@Injectable()
export class SearchHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly search: ProductSearchService,
  ) {}

  async check(terms: string[]) {
    const unique = [...new Set(terms.map((t) => String(t || '').trim()).filter(Boolean))].slice(0, 30)
    const mapped = new Set((await this.prisma.productCategoryMapping.findMany({ select: { ean: true } })).map((m) => m.ean))
    return Promise.all(
      unique.map(async (term) => {
        const res = (await this.products.findAll(term, 1, 3)) as { data?: Array<{ name: string }>; total?: number }
        const total = Number(res?.total ?? res?.data?.length ?? 0)
        if (total > 0) return { term, total, sample: (res.data || []).slice(0, 3).map((p) => p.name), diagnosis: null }
        return { term, total: 0, sample: [], diagnosis: await this.diagnose(term, mapped) }
      }),
    )
  }

  /** Nao achou no site: existe no cadastro? Se sim, por que esta fora. */
  private async diagnose(term: string, mapped: Set<string>) {
    const digits = term.replace(/\D/g, '')
    let ids: string[] = []
    if (digits.length >= 8 && digits.length === term.replace(/\s/g, '').length) {
      ids = (await this.prisma.product.findMany({ where: { OR: [{ ean: digits }, { secondaryEans: { has: digits } }] }, select: { id: true } })).map((p) => p.id)
    } else {
      // Todas as palavras no nome, sem acento (mesmo criterio da busca do admin).
      const tokens = term.toLowerCase().split(/\s+/).filter((t) => t.length >= 2)
      let acc: string[] | null = null
      for (const token of tokens) {
        const found = new Set(await productIdsMatchingText(this.prisma, token))
        acc = acc === null ? [...found] : acc.filter((id) => found.has(id))
        if (!acc.length) break
      }
      ids = acc || []
    }
    if (!ids.length) return { inCatalog: 0, examples: [] as Array<{ name: string; reason: string }> }
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids.slice(0, 200) } },
      select: { name: true, ean: true, active: true, erpActive: true, syncOption: true, stock: true, siteVisibility: true },
      take: 200,
    })
    const reason = (p: (typeof rows)[number]) =>
      !p.erpActive
        ? 'inativo no ERP'
        : p.siteVisibility === 'OCULTO'
          ? 'oculto no admin'
          : p.syncOption === 'NUNCA'
            ? 'marcado "Nunca" no ERP'
            : (p.syncOption === 'ESTOQUE' || p.syncOption === 'ESTQOUE') && Number(p.stock || 0) <= 0
              ? 'sem estoque'
              : !mapped.has(p.ean)
                ? 'sem categoria no site'
                : 'no site, mas a busca não achou (nome diferente)'
    return { inCatalog: ids.length, examples: rows.slice(0, 3).map((p) => ({ name: p.name, reason: reason(p) })) }
  }

  listSynonyms() {
    return this.prisma.searchSynonym.findMany({ orderBy: { term: 'asc' } })
  }

  async addSynonym(term: string, equivalents: string[]) {
    const t = String(term || '').trim().toLowerCase()
    const eq = [...new Set((equivalents || []).map((e) => String(e || '').trim().toLowerCase()).filter((e) => e && e !== t))]
    if (!t || !eq.length) throw new BadRequestException('Informe o termo e pelo menos uma palavra equivalente.')
    const row = await this.prisma.searchSynonym.upsert({ where: { term: t }, update: { equivalents: eq }, create: { term: t, equivalents: eq } })
    await this.search.applySynonyms()
    return row
  }

  async removeSynonym(id: string) {
    await this.prisma.searchSynonym.delete({ where: { id } })
    await this.search.applySynonyms()
    return { ok: true }
  }
}
