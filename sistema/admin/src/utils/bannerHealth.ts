import { api, type DepartmentOverview } from '../services/api'
import type { StoreBanner } from './bannerTemplates'

/**
 * Onde o banner aparece e para onde o clique leva, conferido contra os dados
 * de verdade (30/09/2026). Motivo: dois banners intercalados levavam para
 * buscas com zero produto ("consumo rapido", "guloseimas") e o banner de
 * vinho levava ao Acougue -- nada reclamava, o cliente so caia numa pagina
 * vazia. Usa as mesmas rotas publicas que a loja usa para montar a pagina.
 */

export type Tone = 'ok' | 'warn' | 'info' | 'off'
export type Check = { tone: Tone; text: string }
export type Campaign = { erpCampaignId: number; name: string; active: boolean; startDate: string; endDate: string }
export type HealthContext = { departments: DepartmentOverview[]; offers: number; campaigns: Campaign[] }

const TZ = 'America/Sao_Paulo'
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' })
const dayTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Mesma normalizacao do storefront (utils/homeCategories.ts, normalizeCategoryCode). */
export const categoryCode = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const HOME_SLOTS = ['hero', 'intercalado', 'tarja', 'popup']

const campaignLive = (c: Campaign, now: number) => c.active && new Date(c.startDate).getTime() <= now && new Date(c.endDate).getTime() >= now

/** Esta no ar agora? Espelha StoreBannersService.findActive + onde cada slot aparece. */
export function bannerStatus(b: StoreBanner, ctx: HealthContext, now = Date.now()): Check & { live: boolean } {
  if (!b.active) return { tone: 'off', text: 'Desligado', live: false }
  if (HOME_SLOTS.includes(b.slot) && b.pages !== 'home' && b.pages !== 'all') {
    return { tone: 'warn', text: 'Não aparece: este tipo só sai na página inicial, e está marcado para outra página', live: false }
  }
  if (b.slot === 'category' && !b.targetCategory) return { tone: 'warn', text: 'Não aparece: falta escolher o departamento', live: false }
  if (b.campaignErpId != null && b.campaignFound) {
    const c = ctx.campaigns.find((x) => x.erpCampaignId === b.campaignErpId)
    if (c) {
      if (campaignLive(c, now)) return { tone: 'ok', text: `No ar com o encarte até ${day(c.endDate)}`, live: true }
      const futuro = new Date(c.startDate).getTime() > now
      return { tone: 'info', text: futuro ? `Entra com o encarte em ${day(c.startDate)}` : 'Espera o próximo encarte vinculado', live: false }
    }
  }
  if (b.startDate && new Date(b.startDate).getTime() > now) return { tone: 'info', text: `Agendado para ${dayTime(b.startDate)}`, live: false }
  if (b.endDate && new Date(b.endDate).getTime() < now) return { tone: 'off', text: `Encerrado em ${day(b.endDate)}`, live: false }
  return { tone: 'ok', text: b.endDate ? `No ar até ${dayTime(b.endDate)}` : 'No ar', live: true }
}

async function count(params: Record<string, string>) {
  const { data } = await api.get<{ total?: number }>('/products', { params: { ...params, limit: 1 } })
  return Number(data?.total ?? 0)
}

async function searchCheck(q: string): Promise<Check> {
  const n = await count({ search: q })
  return n ? { tone: 'ok', text: `Busca “${q}” (${n} produtos)` } : { tone: 'warn', text: `Busca “${q}”: nenhum produto, o cliente cai numa página vazia` }
}

function categoryCheck(value: string, ctx: HealthContext): Check {
  const lower = value.toLowerCase()
  if (lower.includes('adega') || lower.includes('vinho')) return { tone: 'ok', text: 'Adega' }
  const code = categoryCode(value)
  const dep = ctx.departments.find((d) => categoryCode(d.name) === code || (d.shortName && categoryCode(d.shortName) === code))
  if (!dep) return { tone: 'warn', text: `Departamento “${value}” não existe no site` }
  const label = dep.shortName || dep.name
  if (!dep.active) return { tone: 'warn', text: `${label}: departamento oculto no site` }
  if (!dep.onSite) return { tone: 'warn', text: `${label}: nenhum produto no site` }
  return { tone: 'ok', text: `${label} (${dep.onSite} produtos)` }
}

/** Para onde o clique leva e se la tem conteudo. Mesma resolucao de resolveBannerLink (storefront). */
export async function checkDestination(b: StoreBanner, ctx: HealthContext): Promise<Check> {
  const v = (b.linkValue || '').trim()
  try {
    if (b.linkType === 'campaign' || v.startsWith('/encarte/')) {
      const id = Number(v.replace('/encarte/', '') || b.campaignErpId)
      const c = ctx.campaigns.find((x) => x.erpCampaignId === id)
      if (!c) return { tone: 'warn', text: `Encarte ${id || '?'} ainda não chegou ao site` }
      return campaignLive(c, Date.now()) ? { tone: 'ok', text: `Encarte ${c.name}` } : { tone: 'info', text: `Encarte ${c.name} (fora do ar agora)` }
    }
    if (b.linkType === 'product') {
      const { data } = await api.get<{ name?: string }>(`/products/${encodeURIComponent(v.replace('/produto/', ''))}`)
      return { tone: 'ok', text: `Produto ${data?.name || ''}`.trim() }
    }
    if (!v) return { tone: 'info', text: 'Loja inteira' }
    if (/^https?:\/\//i.test(v)) return { tone: 'info', text: 'Site externo' }
    if (b.linkType === 'search') return await searchCheck(v)
    if (b.linkType === 'category' || !v.startsWith('/') || v.includes(' ') || v.includes('&')) return categoryCheck(v.replace(/^\//, ''), ctx)

    const url = new URL(v, 'https://loja.local')
    const path = url.pathname.replace(/\/$/, '') || '/'
    const q = url.searchParams.get('q')
    const cat = url.searchParams.get('cat')
    const tag = url.searchParams.get('tag')
    const coupon = url.searchParams.get('coupon')
    if ((path === '/busca' || path === '/mercado') && q) return await searchCheck(q)
    if (path === '/mercado' && cat) return categoryCheck(cat, ctx)
    if (path === '/mercado' && tag) {
      const n = await count({ tag })
      return n ? { tone: 'ok', text: `Seleção “${tag}” (${n} produtos)` } : { tone: 'warn', text: `Seleção “${tag}”: nenhum produto` }
    }
    if (path === '/promocoes') {
      return ctx.offers
        ? { tone: 'ok', text: `Promoções (${ctx.offers} produtos em oferta)` }
        : { tone: 'warn', text: 'Promoções: nenhuma oferta agora, a página está vazia' }
    }
    if ((path === '/cart' || path === '/carrinho') && coupon) {
      const { data } = await api.get<{ valid: boolean; message: string }>('/coupons/validate', { params: { code: coupon, subtotal: 100 } })
      return data.valid ? { tone: 'ok', text: `Carrinho com o cupom ${coupon.toUpperCase()}` } : { tone: 'warn', text: `Cupom ${coupon.toUpperCase()}: ${data.message}` }
    }
    if (['/adega', '/vinhos', '/adega-antenor'].includes(path)) return { tone: 'ok', text: 'Adega' }
    if (path === '/mercado') return { tone: 'info', text: 'Loja inteira' }
    if (path === '/receitas') return { tone: 'ok', text: 'Receitas' }
    return { tone: 'info', text: path }
  } catch {
    return b.linkType === 'product' ? { tone: 'warn', text: 'Produto não está mais no site' } : { tone: 'info', text: 'Não deu para conferir agora' }
  }
}
