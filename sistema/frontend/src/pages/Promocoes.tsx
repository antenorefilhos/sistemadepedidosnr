import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BellRing, Check, Clock, Flame, Search, ShoppingCart, Truck } from 'lucide-react'
import { productsAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'
import { useNotifications } from '../hooks/useNotifications'
import { useDeliveryOperation } from '../hooks/useDeliveryOperation'
import { useHomeVitrines, usePromotionCampaigns, useTopSellingProducts, NEAR_EXPIRY_NOTE } from '../hooks/useCMS'
import { stripEmoji } from '../utils/format'
import { iconForCarrossel } from '../utils/homeCategories'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { StoreProductCard } from '../components/StoreProductCard'
import { ProductShelf } from '../components/ProductShelf'
import { SkeletonCard } from '../components/Skeleton'
import { SEO } from '../components/SEO'
import type { Product } from '../types'
import { buttonVariants } from '../components/ui/button'
import { CMS_CATEGORY_TO_RULE_ID, HOME_CATEGORY_RULES, normalizeCategoryCode } from '../utils/homeCategories'
import { pushStatusMessage } from '../utils/pushMessage'
import { useDragScroll } from '../hooks/useDragScroll'
import { cn } from '../lib/cn'

// Promocoes refeita em 07/10/2026 (revisao de UI/UX do storefront, padrao dos
// apps lideres de supermercado, celular primeiro): faixa com quantas ofertas e
// o maior desconto, ofertas agrupadas pelo encarte com a validade, ordenar e
// filtrar por departamento, e o "Avise-me das ofertas" -- com a pagina vazia,
// em vez do "volte em breve", os mais vendidos e o aviso.

const discountOf = (p: Product) =>
  p.promotionalPrice && p.promotionalPrice > 0 && p.promotionalPrice < p.price ? 1 - p.promotionalPrice / p.price : 0
const effectivePrice = (p: Product) => (discountOf(p) > 0 ? (p.promotionalPrice as number) : p.price)

/** "sáb., 10/10": ultimo dia da oferta, em Brasilia. */
const untilLabel = (iso?: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
}

const departmentLabel = (code?: string) => {
  const ruleId = CMS_CATEGORY_TO_RULE_ID[normalizeCategoryCode(code || '')]
  return HOME_CATEGORY_RULES.find((rule) => rule.id === ruleId)?.shortLabel || ''
}

const chip = (active: boolean) =>
  cn(
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
    active ? 'border-[#5D082A] bg-[#5D082A] text-white' : 'border-[#E8D7B0] bg-white text-[#231F20] hover:border-[#D2BB8A] hover:bg-[#FBF7F0]',
  )

type Group = { key: string; title: string; until: string; nearExpiry: boolean; products: Product[] }

export default function Promocoes() {
  const { user } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const delivery = useDeliveryOperation()
  const chipsScroll = useDragScroll<HTMLDivElement>()
  const [sort, setSort] = useState<'desconto' | 'preco'>('desconto')
  const [department, setDepartment] = useState('')

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ['products-promotions'],
    queryFn: async () => (await productsAPI.getPromotions()).data as Product[],
    staleTime: 1000 * 60 * 5,
  })
  const { data: campaigns = [] } = usePromotionCampaigns()
  const { data: topSelling = [] } = useTopSellingProducts(12)
  const { data: vitrines } = useHomeVitrines()
  // Vitrines para fechar a pagina (e encher a vazia): os mais pedidos do site
  // quando houver; senao, as duas primeiras vitrines da Home (vendas do caixa).
  const extraShelves = useMemo(() => {
    if (topSelling.length >= 4) {
      return [{ key: 'mais-pedidos', title: 'Mais pedidos da semana', icon: Flame, products: topSelling.map((t) => t.product), to: '/mercado' }]
    }
    return (vitrines?.carrosseis || []).slice(0, 2).map((c) => ({
      key: c.id,
      title: stripEmoji(c.titulo),
      icon: iconForCarrossel(c.id),
      products: c.produtos.slice(0, 12),
      to: c.linkVerTudo || '/mercado',
    }))
  }, [topSelling, vitrines])

  const offers = useMemo(() => promos.filter((p) => discountOf(p) > 0), [promos])
  const maxDiscount = Math.round(Math.max(0, ...offers.map(discountOf)) * 100)

  const departments = useMemo(() => {
    const counts = new Map<string, number>()
    offers.forEach((p) => p.category && counts.set(p.category, (counts.get(p.category) || 0) + 1))
    return [...counts.entries()]
      .map(([code, n]) => ({ code, label: departmentLabel(code), n }))
      .filter((d) => d.label)
      .sort((a, b) => b.n - a.n)
  }, [offers])

  const sorted = useMemo(() => {
    const list = offers.filter((p) => !department || p.category === department)
    return [...list].sort((a, b) => (sort === 'desconto' ? discountOf(b) - discountOf(a) : effectivePrice(a) - effectivePrice(b)))
  }, [offers, department, sort])

  // Agrupa pelo encarte (com a validade de cada um); o que nao esta em encarte
  // e oferta do proprio produto no ERP. Com filtro ou outra ordem, lista unica.
  const groups = useMemo<Group[]>(() => {
    const byProduct = new Map<string, (typeof campaigns)[number]>()
    campaigns.forEach((c) => c.items.forEach((item) => byProduct.has(item.id) || byProduct.set(item.id, c)))
    const map = new Map<string, Group>()
    for (const p of sorted) {
      const c = byProduct.get(p.id)
      const key = c?.id || 'outras'
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: c?.name || 'Mais ofertas',
          until: untilLabel(c?.endDate || p.promotionalPriceValidUntil),
          nearExpiry: Boolean(c?.nearExpiry),
          products: [],
        })
      }
      map.get(key)!.products.push(p)
    }
    return [...map.values()].sort((a, b) => (a.key === 'outras' ? 1 : b.key === 'outras' ? -1 : b.products.length - a.products.length))
  }, [sorted, campaigns])

  const grouped = sort === 'desconto' && !department && groups.length > 0
  const fewOffers = offers.length > 0 && offers.length <= 2

  return (
    <div className="min-h-screen bg-[#FBFAF7] pb-24">
      <SEO title="Ofertas" description="Ofertas da semana do Antenor & Filhos: açougue, hortifruti, adega e mercearia com preço especial." />

      <header className="sticky top-0 z-40 border-b border-[#E8D7B0]/60 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 px-2 py-2 sm:px-4">
          <button type="button" onClick={() => navigate('/')} aria-label="Voltar ao início" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
            <ArrowLeft size={22} />
          </button>
          <h1 className="flex flex-1 items-center gap-2 text-lg font-bold text-[#231F20]">
            <img src="/icons/icon-promo-menu.gif" alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
            Ofertas
          </h1>
          <Link to="/mercado" aria-label="Buscar no mercado" className="flex h-11 w-11 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
            <Search size={21} />
          </Link>
          <Link
            to="/cart"
            aria-label={count > 0 ? `Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]"
          >
            <ShoppingCart size={22} />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#5D082A] px-1 text-[10px] font-bold text-white">{count > 9 ? '9+' : count}</span>
            )}
          </Link>
          {user && <NotificationBell />}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-4">
        {/* Faixa: o que tem hoje e ate quanto se economiza. */}
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#5D082A] via-[#741035] to-[#3d0519] px-5 py-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#D2BB8A]">Preço especial</p>
          {isLoading ? (
            <p className="mt-1 text-xl font-bold">Carregando ofertas…</p>
          ) : offers.length > 0 ? (
            <>
              <p className="mt-1 text-2xl font-black leading-tight">
                {offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'} hoje
                {maxDiscount >= 5 && <span className="text-[#D2BB8A]"> · até {maxDiscount}% off</span>}
              </p>
              <p className="mt-1 text-sm text-white/80">O preço vale para o dia da entrega ou da retirada.</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-2xl font-black leading-tight">Novas ofertas toda semana</p>
              <p className="mt-1 text-sm text-white/80">Os próximos encartes chegam em breve. Ative o aviso e saiba primeiro.</p>
            </>
          )}
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            <Truck size={14} className="text-[#D2BB8A]" /> {delivery.message}
          </p>
        </section>

        {isLoading ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            <SkeletonCard count={6} />
          </div>
        ) : offers.length === 0 ? (
          <div className="mt-5 space-y-6">
            <OfferAlertsCard />
            {extraShelves.map((s) => (
              <ProductShelf key={s.key} title={s.title} icon={s.icon} products={s.products} to={s.to} linkLabel="Ver mais" shelf={`promocoes:${s.key}`} />
            ))}
          </div>
        ) : (
          <>
            {/* Ordenar e departamento (so quando ha o que escolher). */}
            {offers.length > 2 && (
              <div ref={chipsScroll.ref} className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4" {...chipsScroll.dragProps}>
                <button type="button" onClick={() => setSort('desconto')} className={chip(sort === 'desconto')}>Maiores descontos</button>
                <button type="button" onClick={() => setSort('preco')} className={chip(sort === 'preco')}>Menor preço</button>
                {departments.length >= 2 && (
                  <>
                    <span className="my-1.5 w-px shrink-0 bg-[#E8D7B0]" aria-hidden="true" />
                    <button type="button" onClick={() => setDepartment('')} className={chip(!department)}>Todos</button>
                    {departments.map((d) => (
                      <button key={d.code} type="button" onClick={() => setDepartment(d.code)} className={chip(department === d.code)}>
                        {d.label} <span className={cn('text-[11px]', department === d.code ? 'text-white/70' : 'text-gray-400')}>{d.n}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="mt-5 space-y-8">
              {(grouped ? groups : [{ key: 'todas', title: '', until: '', nearExpiry: false, products: sorted } as Group]).map((group) => (
                <section key={group.key}>
                  {group.title && (
                    <div className="mb-3">
                      <h2 className="text-lg font-bold text-[#231F20]">{group.title}</h2>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        {group.until && (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#5D082A]">
                            <Clock size={13} /> até {group.until}
                          </span>
                        )}
                        <span>{group.products.length} {group.products.length === 1 ? 'produto' : 'produtos'}</span>
                        {group.nearExpiry && <span>{NEAR_EXPIRY_NOTE}</span>}
                      </p>
                    </div>
                  )}
                  {fewOffers ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {group.products.map((product) => (
                        <StoreProductCard key={product.id} product={product} source="SEARCH" variant="row" analyticsMeta={{ shelf: 'promocoes' }} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {group.products.map((product) => (
                        <StoreProductCard key={product.id} product={product} source="SEARCH" variant="grid" analyticsMeta={{ shelf: 'promocoes' }} />
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="mt-8">
              <OfferAlertsCard />
            </div>

            {fewOffers && (
              <div className="mt-8 space-y-8">
                {extraShelves.map((s) => (
                  <ProductShelf key={s.key} title={s.title} icon={s.icon} products={s.products} to={s.to} linkLabel="Ver mais" shelf={`promocoes:${s.key}`} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <MobileBottomNav />
    </div>
  )
}

/**
 * "Avise-me das ofertas": o aviso que traz o cliente de volta quando o
 * encarte entra (a Fila de envios ja manda "Ja esta no ar" e "Ultimas
 * horas"). Precisa de conta -- quem nao entrou e levado ao login e volta aqui.
 */
function OfferAlertsCard() {
  const { user } = useAuth()
  if (!user) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-[#E8D7B0] bg-white p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8F2E6] text-[#5D082A]">
          <BellRing size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#231F20]">Saiba primeiro das ofertas</p>
          <p className="text-xs text-gray-500">Entre na sua conta e ative o aviso no celular.</p>
        </div>
        <Link to="/login?redirect=/promocoes" className={buttonVariants({ size: 'sm', className: 'shrink-0 rounded-full px-4' })}>
          Entrar
        </Link>
      </section>
    )
  }
  return <OfferAlertsToggle />
}

function OfferAlertsToggle() {
  const { pushStatus, pushPermission, requestPushPermission, isSubscribingToPush } = useNotifications()
  const enabled = pushStatus === 'enabled'
  const blocked = pushStatus === 'denied' || pushPermission === 'denied'
  return (
    <section className={cn('flex items-start gap-3 rounded-2xl border p-4', enabled ? 'border-emerald-200 bg-emerald-50/60' : 'border-[#E8D7B0] bg-white')}>
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F8F2E6] text-[#5D082A]')}>
        {enabled ? <Check size={21} /> : <BellRing size={21} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#231F20]">{enabled ? 'Aviso de ofertas ativado' : 'Saiba primeiro das ofertas'}</p>
        <p className="text-xs text-gray-500">
          {enabled ? 'Você recebe no celular quando um encarte entra no ar.' : pushStatusMessage(pushStatus, pushPermission, 'Receba no celular quando um encarte entrar no ar.')}
        </p>
      </div>
      {!enabled && !blocked && (
        <button
          type="button"
          onClick={() => requestPushPermission()}
          disabled={isSubscribingToPush}
          className={buttonVariants({ size: 'sm', className: 'shrink-0 rounded-full px-4' })}
        >
          {isSubscribingToPush ? 'Ativando…' : 'Avise-me'}
        </button>
      )}
    </section>
  )
}
