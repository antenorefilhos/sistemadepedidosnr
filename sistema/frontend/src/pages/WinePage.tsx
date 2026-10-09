import { useCart } from '../hooks/useCart'
import { useQuery } from '@tanstack/react-query'
import { productsAPI } from '../services/api'
import { PRICE_BANDS, WINE_STYLE_LABEL, wineCardTitle, wineFacts, wineSubtitle, type WineFacts } from '../utils/wine'
import { useAuth } from '../hooks/useAuth'
import { useStoreBanners } from '../hooks/useCMS'
import { productPath } from '../utils/productUrl'
import { findWineCategoryBanner, resolveBannerLink } from '../utils/homeCategories'
import { PromoBanner } from '../components/PromoBanner'
import { resolveApiUrl } from '../services/api'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { BackToTopButton } from '../components/BackToTopButton'
import type { Product } from '../types'
import { formatProductQuantity, getProductPricePresentation } from '../utils/productPricing'
import { getProductCardViewModel } from '../utils/productCard'
import { formatPrice } from '../utils/format'
import { trackEvent } from '../utils/analytics'
import { useDragScroll } from '../hooks/useDragScroll'
import { ArrowLeft, Check, ChevronDown, Loader2, Minus, Plus, ShoppingCart, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Fragment, useMemo, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { SEO, StructuredData } from '../components/SEO'
import { cn } from '../lib/cn'

// Adega revista em 07/10/2026 (revisao de UI/UX do storefront, celular
// primeiro), mantendo a identidade escura e dourada:
// - o primeiro rotulo aparece logo (foto do topo menor; pais, uva, preco e
//   ordem numa folha que sobe de baixo, em vez de 4 caixas de selecao);
// - card com preco antes do nome e "+" que vira seletor de quantidade;
// - tocar na foto ABRE o vinho: havia um botao invisivel sobre a foto (feito
//   para o mouse) que, no celular, punha a garrafa no carrinho;
// - multiplicador 1/6/12 no card: garrafa, meia caixa e caixa -- e o jeito
//   de quem e do mundo do vinho comprar (Jonathan, 07/10/2026: "o melhor
//   gatilho que existe no mundo das vendas de vinho"). Tocar em 6 poe 6 no
//   carrinho de uma vez, o +/- anda de 6 em 6, com confirmacao na tela.

// Filtros pela ficha do vinho (03/10/2026): tipo, estilo, pais, uva e preco.
// O estado fica na URL, entao o link filtrado pode ser compartilhado e o
// voltar funciona.
type WineSubcategory = 'all' | 'tinto' | 'branco' | 'rose' | 'espumante' | 'suave'

const WINE_CATEGORIES: Array<{ key: WineSubcategory; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'tinto', label: 'Tintos' },
  { key: 'branco', label: 'Brancos' },
  { key: 'rose', label: 'Rosés' },
  { key: 'espumante', label: 'Espumantes' },
  { key: 'suave', label: 'Suaves' },
]

const matchesSubcat = (f: WineFacts, subcat: WineSubcategory): boolean => {
  if (subcat === 'all') return true
  if (subcat === 'suave') return f.estilo === 'suave'
  if (subcat === 'rose') return f.tipo === 'rosé'
  return f.tipo === subcat
}

// "Recomendados" = a ordem da API (rotulo com foto primeiro, sorteio do dia).
type WineSort = 'rec' | 'menor' | 'maior' | 'nome'
const SORTS: Array<{ key: WineSort; label: string }> = [
  { key: 'rec', label: 'Recomendados' },
  { key: 'menor', label: 'Menor preço' },
  { key: 'maior', label: 'Maior preço' },
  { key: 'nome', label: 'Nome (A–Z)' },
]
const priceOf = (p: Product) => (p.promotionalPrice && p.promotionalPrice < p.price ? p.promotionalPrice : p.price)

const goldChip = (active: boolean, disabled = false) =>
  cn(
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold tracking-wide transition-colors',
    active
      ? 'border-[#D2BB8A] bg-[#D2BB8A] text-[#231F20]'
      : disabled
        ? 'cursor-not-allowed border-white/10 text-white/25'
        : 'border-[#D2BB8A]/35 bg-[#1C1917] text-[#F3E7C9] hover:border-[#D2BB8A]',
  )

export default function WinePage() {
  // Lista inteira da Adega (ate 100) para os filtros contarem tudo.
  const { data: products, isLoading } = useQuery({
    queryKey: ['adega', 100],
    queryFn: async () => {
      const r = await productsAPI.getAll(undefined, 1, 100, 'ADEGA_VINHOS_ESPUMANTES')
      const body = r.data as { data?: Product[] } | Product[]
      return (Array.isArray(body) ? body : body.data ?? []) as Product[]
    },
    staleTime: 1000 * 60 * 5,
  })
  const { count } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const typesScroll = useDragScroll<HTMLDivElement>()
  const [sheetOpen, setSheetOpen] = useState(false)
  // A Adega tem rota propria (/adega), sem ?cat= na URL, entao o banner e
  // achado pelo nome da categoria (ver findWineCategoryBanner).
  const { data: storeBanners } = useStoreBanners()
  const wineBanner = useMemo(() => findWineCategoryBanner(storeBanners), [storeBanners])
  const [params, setParams] = useSearchParams()
  const selectedSubcat = (WINE_CATEGORIES.some((c) => c.key === params.get('tipo')) ? params.get('tipo') : 'all') as WineSubcategory
  const country = params.get('pais') || ''
  const grape = params.get('uva') || ''
  const band = params.get('preco') || ''
  const sort = (SORTS.some((s) => s.key === params.get('ordem')) ? params.get('ordem') : 'rec') as WineSort
  const setFilter = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value && value !== 'all' && !(key === 'ordem' && value === 'rec')) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const refineCount = [country, grape, band, sort !== 'rec' ? sort : ''].filter(Boolean).length
  const hasFilters = Boolean(refineCount || selectedSubcat !== 'all')

  useEffect(() => {
    trackEvent('VIEW_CATEGORY', 'CATEGORY', 'VINHOS')
  }, [])

  const vinhos = useMemo(() => ((products || []) as Product[]).map((p, order) => ({ p, f: wineFacts(p), order })), [products])

  // Cada filtro conta sobre o resultado dos OUTROS filtros (faceta), para nunca
  // oferecer uma opcao que leva a lista vazia.
  const passes = (x: { p: Product; f: WineFacts }, skip?: string) => {
    if (skip !== 'tipo' && !matchesSubcat(x.f, selectedSubcat)) return false
    if (skip !== 'pais' && country && x.f.pais !== country) return false
    if (skip !== 'uva' && grape && !x.f.uvas.includes(grape)) return false
    if (skip !== 'preco' && band) {
      const b = PRICE_BANDS.find((pb) => pb.key === band)
      const v = priceOf(x.p)
      if (b && !(v >= b.min && v < b.max)) return false
    }
    return true
  }

  const subcatCounts = useMemo(() => {
    const base = vinhos.filter((x) => passes(x, 'tipo'))
    return new Map(WINE_CATEGORIES.map((c) => [c.key, base.filter((x) => matchesSubcat(x.f, c.key)).length]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinhos, country, grape, band])

  const facet = (key: 'pais' | 'uva') => {
    const counts = new Map<string, number>()
    for (const x of vinhos.filter((v) => passes(v, key))) {
      const values = key === 'pais' ? (x.f.pais ? [x.f.pais] : []) : x.f.uvas
      for (const v of values) counts.set(v, (counts.get(v) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
  }
  const countryOptions = useMemo(() => facet('pais'), [vinhos, selectedSubcat, grape, band]) // eslint-disable-line react-hooks/exhaustive-deps
  const grapeOptions = useMemo(() => facet('uva'), [vinhos, selectedSubcat, country, band]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredVinhos = useMemo(() => {
    const list = vinhos.filter((x) => passes(x))
    const byName = (a: { p: Product }, b: { p: Product }) => a.p.name.localeCompare(b.p.name, 'pt-BR')
    list.sort(
      sort === 'menor'
        ? (a, b) => priceOf(a.p) - priceOf(b.p) || byName(a, b)
        : sort === 'maior'
          ? (a, b) => priceOf(b.p) - priceOf(a.p) || byName(a, b)
          : sort === 'nome'
            ? byName
            : (a, b) => a.order - b.order,
    )
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinhos, selectedSubcat, country, grape, band, sort])

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: window.location.origin },
      { '@type': 'ListItem', position: 2, name: 'Adega', item: `${window.location.origin}/adega` },
    ],
  }

  const activeChips = [
    country && { key: 'pais', label: country },
    grape && { key: 'uva', label: grape },
    band && { key: 'preco', label: PRICE_BANDS.find((b) => b.key === band)?.label || band },
  ].filter(Boolean) as Array<{ key: string; label: string }>

  // Banner da Adega depois da 1a fileira de rotulos (2 no celular, 4 no computador):
  // antes dele, o cliente ainda nao tinha visto vinho nenhum.
  const bannerAfter = 4

  return (
    <div className="min-h-screen bg-[#231F20] text-white">
      <SEO title="Adega Antenor | Vinhos e espumantes" description="Vinhos escolhidos para presentear, comemorar e surpreender. Descubra rótulos que valem a pena levar para casa." />
      <StructuredData data={breadcrumbSchema} />

      <header className="fixed top-0 z-50 w-full border-b border-[#D2BB8A]/20 bg-[#120e0e]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-2 py-2 sm:px-4">
          <button type="button" onClick={() => navigate('/')} aria-label="Voltar ao início" className="flex h-11 w-11 items-center justify-center rounded-full text-[#D2BB8A] hover:bg-white/5">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 text-center">
            <h1 className="luxury-text bg-gradient-to-r from-[#D2BB8A] via-[#F3E7C9] to-[#D2BB8A] bg-clip-text text-lg font-extrabold uppercase tracking-wide text-transparent">
              Adega Antenor & Filhos
            </h1>
            <p className="-mt-0.5 text-[10px] uppercase tracking-[0.25em] text-[#D2BB8A]/60">Desde 1979</p>
          </div>
          <div className="flex items-center">
            <Link to="/carrinho" className="relative flex h-11 w-11 items-center justify-center rounded-full text-[#D2BB8A] hover:bg-white/5" aria-label={count > 0 ? `Carrinho com ${count} itens` : 'Carrinho vazio'}>
              <ShoppingCart size={22} />
              {count > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#D2BB8A] px-1 text-[10px] font-bold text-[#231F20]">{count > 9 ? '9+' : count}</span>
              )}
            </Link>
            {user && (
              <div className="[&_[data-bell-trigger]]:text-[#D2BB8A] [&_[data-bell-trigger]]:hover:bg-white/10">
                <NotificationBell />
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Foto do topo: identidade da Adega, mas baixa no celular (a lista vem logo). */}
        <section className="relative flex h-[30vh] min-h-[220px] items-end pb-6 md:h-[52vh] md:pb-12">
          <img
            src="/media/vinhos.jpg"
            alt="Adega Antenor & Filhos"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
            loading="eager"
            onError={(e) => {
              // Rede instavel derruba o carregamento sem avisar: uma tentativa
              // com cache-buster resolve o caso comum; se falhar, desiste.
              const img = e.currentTarget
              if (img.dataset.retried) return
              img.dataset.retried = '1'
              img.src = `/media/vinhos.jpg?retry=${Date.now()}`
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#231F20] via-[#231F20]/20 to-[#231F20]/40" />
          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 md:px-6">
            <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#D2BB8A]">
              <Sparkles size={13} /> Seleção especial
            </span>
            <h2 className="luxury-text bg-gradient-to-r from-[#D2BB8A] via-[#F3E7C9] to-[#D2BB8A] bg-clip-text text-[28px] font-medium leading-tight tracking-tight text-transparent md:text-6xl">
              Cada taça conta <br />uma história
            </h2>
            <p className="mt-3 hidden max-w-lg text-sm italic leading-relaxed text-white/70 md:block">
              Não é só vinho. É escolha, cuidado e sabor de verdade. Aqui você encontra rótulos para presentear bem ou aproveitar um momento especial.
            </p>
          </div>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-[#D2BB8A]" size={40} />
          </div>
        ) : (
          <>
            {/* Tipo (com contagem) + filtros: fica preso no topo enquanto rola a lista. */}
            <section className="sticky top-[60px] z-30 border-b border-[#D2BB8A]/10 bg-[#231F20]/95 py-3 backdrop-blur">
              <div ref={typesScroll.ref} className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4" role="group" aria-label="Filtrar por tipo de vinho" {...typesScroll.dragProps}>
                <button type="button" onClick={() => setSheetOpen(true)} className={goldChip(refineCount > 0)} aria-label="Filtrar e ordenar">
                  <SlidersHorizontal size={14} /> {refineCount > 0 ? `Filtros · ${refineCount}` : 'Filtrar'}
                </button>
                {WINE_CATEGORIES.map((cat) => {
                  const n = subcatCounts.get(cat.key) || 0
                  const active = selectedSubcat === cat.key
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setFilter('tipo', cat.key)}
                      disabled={n === 0 && !active}
                      aria-pressed={active}
                      className={goldChip(active, n === 0 && !active)}
                    >
                      {cat.label} <span className={active ? 'text-[#231F20]/70' : 'text-[#D2BB8A]'}>{n}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 pb-16 pt-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <p className="mr-1 text-xs text-white/55">
                  {filteredVinhos.length} {filteredVinhos.length === 1 ? 'rótulo' : 'rótulos'}
                  {sort !== 'rec' && ` · ${SORTS.find((s) => s.key === sort)?.label}`}
                </p>
                {activeChips.map((c) => (
                  <button key={c.key} type="button" onClick={() => setFilter(c.key, '')} className={goldChip(true)}>
                    {c.label} <X size={13} />
                  </button>
                ))}
                {hasFilters && (
                  <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })} className="px-1 text-xs font-semibold text-[#D2BB8A] underline underline-offset-4">
                    Limpar
                  </button>
                )}
              </div>

              {filteredVinhos.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <span className="text-4xl opacity-40 grayscale">🍷</span>
                  <p className="luxury-text text-lg text-[#D2BB8A]">Nenhum rótulo com esses filtros</p>
                  <p className="text-sm text-white/50">Tire algum filtro para ver mais vinhos.</p>
                  <button
                    type="button"
                    onClick={() => setParams(new URLSearchParams(), { replace: true })}
                    className="mt-2 rounded-full border border-[#D2BB8A]/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#D2BB8A] hover:bg-[#D2BB8A]/10"
                  >
                    Ver todos os vinhos
                  </button>
                </div>
              ) : (
                // 2 colunas no celular e 4 no computador: o banner depois do 4o rotulo fecha a fileira nos dois.
                <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
                  {filteredVinhos.map(({ p, f }, index) => (
                    <Fragment key={p.id}>
                      {index === bannerAfter && wineBanner && !hasFilters && (
                        <div className="col-span-full my-2">
                          <PromoBanner
                            bannerId={wineBanner.id}
                            image={resolveApiUrl(wineBanner.desktopImageUrl)}
                            alt={wineBanner.title || wineBanner.name || 'Destaque da Adega'}
                            badge={wineBanner.badgeText || undefined}
                            title={wineBanner.title || wineBanner.name || 'Destaque'}
                            description={wineBanner.description || undefined}
                            ctaLabel={wineBanner.ctaLabel || undefined}
                            ctaTo={resolveBannerLink(wineBanner.linkValue, wineBanner.linkType)}
                            align={wineBanner.align || 'left'}
                            overlayColor={wineBanner.overlayColor || undefined}
                            sponsorName={wineBanner.sponsorName || undefined}
                          />
                        </div>
                      )}
                      <WineCard product={p} facts={f} />
                    </Fragment>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {sheetOpen && (
        <WineFilterSheet
          total={filteredVinhos.length}
          country={country}
          grape={grape}
          band={band}
          sort={sort}
          countryOptions={countryOptions}
          grapeOptions={grapeOptions}
          onChange={setFilter}
          onClear={() => setParams((prev) => {
            const next = new URLSearchParams(prev)
            ;['pais', 'uva', 'preco', 'ordem'].forEach((k) => next.delete(k))
            return next
          }, { replace: true })}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {/* Rodape da Adega -- paleta mais escura, acabamento dourado. */}
      <footer className="border-t border-[#D2BB8A]/20 bg-[#1C1917] pb-24 md:pb-0">
        <div className="mx-auto max-w-7xl px-6 py-12 text-center">
          <p className="luxury-text bg-gradient-to-r from-[#D2BB8A] via-[#F3E7C9] to-[#D2BB8A] bg-clip-text text-2xl font-extrabold uppercase tracking-[0.15em] text-transparent">
            Adega Antenor & Filhos
          </p>
          <p className="mt-2 text-label uppercase tracking-widest text-[#D2BB8A]/50">Desde 1979</p>
          <div className="mx-auto mt-6 h-px w-16 bg-[#D2BB8A]/30" />
          <p className="mt-6 text-sm text-white/40">Estrada União e Indústria, Pedro do Rio, Petrópolis - RJ</p>
          <Link to="/" className="mt-6 inline-block text-xs font-semibold uppercase tracking-widest text-[#D2BB8A] hover:underline">
            Voltar ao mercado
          </Link>
        </div>
      </footer>
      <MobileBottomNav />
      <BackToTopButton />
    </div>
  )
}

function WineFilterSheet({
  total,
  country,
  grape,
  band,
  sort,
  countryOptions,
  grapeOptions,
  onChange,
  onClear,
  onClose,
}: {
  total: number
  country: string
  grape: string
  band: string
  sort: WineSort
  countryOptions: Array<[string, number]>
  grapeOptions: Array<[string, number]>
  onChange: (key: string, value: string) => void
  onClear: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])
  const [showAllGrapes, setShowAllGrapes] = useState(false)
  const grapes = showAllGrapes ? grapeOptions : grapeOptions.slice(0, 10)

  const group = (title: string, children: React.ReactNode) => (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#D2BB8A]">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Filtrar vinhos">
      <div className="flex max-h-[85vh] w-full flex-col rounded-t-3xl border border-[#D2BB8A]/20 bg-[#1C1917] text-white shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#D2BB8A]/15 px-5 py-4">
          <h2 className="text-base font-bold text-[#F3E7C9]">Filtrar vinhos</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-[#D2BB8A] hover:bg-white/5">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {group(
            'Ordenar por',
            SORTS.map((s) => (
              <button key={s.key} type="button" onClick={() => onChange('ordem', s.key)} className={goldChip(sort === s.key)}>
                {sort === s.key && <Check size={13} />} {s.label}
              </button>
            )),
          )}
          {group(
            'Preço',
            PRICE_BANDS.map((b) => (
              <button key={b.key} type="button" onClick={() => onChange('preco', band === b.key ? '' : b.key)} className={goldChip(band === b.key)}>
                {b.label}
              </button>
            )),
          )}
          {countryOptions.length > 0 &&
            group(
              'País',
              countryOptions.map(([c, n]) => (
                <button key={c} type="button" onClick={() => onChange('pais', country === c ? '' : c)} className={goldChip(country === c)}>
                  {c} <span className={country === c ? 'text-[#231F20]/60' : 'text-[#D2BB8A]/70'}>{n}</span>
                </button>
              )),
            )}
          {grapeOptions.length > 0 &&
            group(
              'Uva',
              <>
                {grapes.map(([g, n]) => (
                  <button key={g} type="button" onClick={() => onChange('uva', grape === g ? '' : g)} className={goldChip(grape === g)}>
                    {g} <span className={grape === g ? 'text-[#231F20]/60' : 'text-[#D2BB8A]/70'}>{n}</span>
                  </button>
                ))}
                {grapeOptions.length > 10 && !showAllGrapes && (
                  <button type="button" onClick={() => setShowAllGrapes(true)} className="inline-flex h-9 items-center gap-1 px-2 text-xs font-semibold text-[#D2BB8A]">
                    Ver todas <ChevronDown size={14} />
                  </button>
                )}
              </>,
            )}
        </div>
        <div className="flex gap-2 border-t border-[#D2BB8A]/15 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={onClear} className="h-12 rounded-xl border border-[#D2BB8A]/40 px-4 text-sm font-semibold text-[#D2BB8A]">
            Limpar
          </button>
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl bg-[#D2BB8A] text-sm font-bold text-[#231F20]">
            Ver {total} {total === 1 ? 'rótulo' : 'rótulos'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Garrafa, meia caixa e caixa: o multiplicador do vinho (d06a4dfa, 19/08/2026).
const WINE_QUANTITY_STEPS = [1, 6, 12] as const
type WineQuantityStep = (typeof WINE_QUANTITY_STEPS)[number]
const bottles = (n: number) => `${n} ${n === 1 ? 'garrafa' : 'garrafas'}`

function WineCard({ product, facts }: { product: Product; facts: WineFacts }) {
  const { cart, addItem, removeItem, updateQuantity } = useCart()
  const quantity = cart.find((item) => item.productId === product.id)?.quantity || 0
  // Multiplo ativo: o que ja esta no carrinho, se for 6 ou 12 (volta certo ao recarregar).
  const [step, setStep] = useState<WineQuantityStep>(() => (quantity > 0 && quantity % 12 === 0 ? 12 : quantity > 0 && quantity % 6 === 0 ? 6 : 1))
  const [imageIndex, setImageIndex] = useState(0)
  const [imgError, setImgError] = useState(false)
  const viewModel = useMemo(() => getProductCardViewModel(product), [product])
  const price = getProductPricePresentation(product)
  const title = wineCardTitle(product.name)

  const imageBaseUrl = `/uploads/products/${product.ean}`
  const imageCandidates = [`/thumbs/products/${product.ean}.webp`, `${imageBaseUrl}.webp`, `${imageBaseUrl}.jpg`, `${imageBaseUrl}.jpeg`, `${imageBaseUrl}.png`].map((url) => `${url}?v=3`)

  const track = (n: number) =>
    trackEvent('ADD_TO_CART', 'PRODUCT', product.id, { name: product.name, price: product.price, quantity: n, source: 'HOME', shelf: 'adega' })
  const confirm = (total: number) =>
    toast.success(`${bottles(total)} de ${title} no carrinho`, { id: `add-${product.id}`, duration: 1600, position: 'top-center' })

  const add = () => {
    addItem(product, step)
    track(step)
    confirm(quantity + step)
  }
  const decrease = () => (quantity > step ? updateQuantity(product.id, quantity - step) : removeItem(product.id))
  // Escolher 6 ou 12 poe essa quantidade no carrinho de uma vez.
  const chooseStep = (n: WineQuantityStep) => {
    setStep(n)
    if (quantity === n) return
    if (quantity > 0) updateQuantity(product.id, n)
    else {
      addItem(product, n)
      track(n)
    }
    confirm(n)
  }
  const subtitle = [
    wineSubtitle(facts, product.name),
    facts.estilo && facts.estilo !== 'seco' && facts.tipo !== 'espumante' ? WINE_STYLE_LABEL[facts.estilo] : '',
  ].filter(Boolean).join(' · ')

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#D2BB8A]/15 bg-[#2A2420] transition-colors hover:border-[#D2BB8A]/50">
      {/* Frame vertical com zoom na garrafa (08/10/2026): a foto do catalogo e
          sempre um canvas quadrado com a garrafa centralizada ocupando so
          ~25-27% da largura (medido em 36 fotos da adega, pior caso 27,4%).
          Com object-contain isso sobrava muito branco nas laterais e a
          garrafa ficava pequena. object-cover num frame mais vertical corta
          so esse excesso de fundo -- a garrafa inteira (topo a base) sempre
          fica visivel, porque o recorte do cover em imagem quadrada dentro
          de um frame retrato nunca corta a altura, so a largura. 3:5 deixa
          ~55% de largura visivel, folga de 2x sobre o pior caso. */}
      <div className="relative aspect-[3/5] bg-white">
        <Link to={productPath(product)} state={{ from: '/adega' }} className="absolute inset-0 flex items-center justify-center" aria-label={`Ver ${title}`}>
          {!imgError ? (
            <img
              src={imageCandidates[imageIndex]}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
              onError={() => (imageIndex < imageCandidates.length - 1 ? setImageIndex((i) => i + 1) : setImgError(true))}
            />
          ) : (
            <span className="text-5xl opacity-25 grayscale">🍷</span>
          )}
        </Link>

        <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
          {viewModel.isOnSale && viewModel.discountPct >= 1 && (
            <span className="rounded-md bg-[#5D082A] px-1.5 py-0.5 text-[11px] font-black text-white">-{viewModel.discountPct}%</span>
          )}
          {product.badges && (
            <span className="rounded-md bg-[#D2BB8A] px-1.5 py-0.5 text-[11px] font-bold text-[#231F20]">{product.badges}</span>
          )}
        </div>

        {viewModel.outOfStock ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#3f3f46]">
            {viewModel.unavailableLabel}
          </span>
        ) : quantity === 0 ? (
          <button
            type="button"
            onClick={add}
            aria-label={`Adicionar ${title} ao carrinho`}
            className="absolute bottom-2 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#D2BB8A] text-[#231F20] shadow-lg transition-transform hover:scale-110 active:scale-95"
          >
            <Plus size={20} strokeWidth={2.8} />
          </button>
        ) : (
          <div className="absolute inset-x-2 bottom-2 z-10 flex h-10 items-center justify-between rounded-full bg-[#D2BB8A] text-[#231F20] shadow-lg">
            <button type="button" onClick={decrease} aria-label="Diminuir quantidade" className="flex h-10 w-10 items-center justify-center active:scale-90">
              <Minus size={16} strokeWidth={2.6} />
            </button>
            <span className="text-sm font-black tabular-nums">{formatProductQuantity(product, quantity)} un</span>
            <button type="button" onClick={add} aria-label="Aumentar quantidade" className="flex h-10 w-10 items-center justify-center active:scale-90">
              <Plus size={16} strokeWidth={2.6} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-3 pb-3.5 pt-2.5">
        <div className="leading-none">
          {viewModel.originalPrice && <p className="mb-0.5 text-[11px] text-white/45 line-through">{formatPrice(viewModel.originalPrice)}</p>}
          <p className="flex items-baseline gap-0.5 text-[#D2BB8A]">
            <span className="text-[11px] font-bold">{price.currencySymbol}</span>
            <span className="text-xl font-black tracking-tight">{price.value}</span>
          </p>
        </div>
        <Link to={productPath(product)} state={{ from: '/adega' }} className="block">
          <h3 className="luxury-text line-clamp-2 min-h-[2.5em] text-[14px] leading-snug text-white transition-colors group-hover:text-[#F3E7C9]">{title}</h3>
        </Link>
        {subtitle && <p className="line-clamp-1 text-[11px] text-white/55">{subtitle}</p>}
        {!viewModel.outOfStock && (
          <div role="group" aria-label="Quantidade de garrafas" className="mt-auto grid grid-cols-3 gap-1 pt-1.5">
            {WINE_QUANTITY_STEPS.map((n) => {
              // O multiplo ativo: e de quanto em quanto o +/- anda.
              const active = step === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => chooseStep(n)}
                  aria-pressed={active}
                  aria-label={n === 1 ? '1 garrafa' : n === 6 ? 'Meia caixa, 6 garrafas' : 'Caixa, 12 garrafas'}
                  className={cn(
                    'h-8 rounded-full border text-[11px] font-bold transition-colors',
                    active ? 'border-[#D2BB8A] bg-[#D2BB8A] text-[#231F20]' : 'border-[#D2BB8A]/35 text-[#F3E7C9] hover:border-[#D2BB8A]',
                  )}
                >
                  {n}un
                </button>
              )
            })}
          </div>
        )}
      </div>
    </article>
  )
}
