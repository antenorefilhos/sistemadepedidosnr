import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, Minus, Plus, ShoppingCart, Film } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProduct, useCart, useProductRecommendations, useSmartSubstitutes } from '../hooks/useCart'
import type { Product } from '../types'
import { formatPrice, formatProductTitle } from '../utils/format'
import { getProductPricePresentation, formatProductQuantity } from '../utils/productPricing'
import { getProductCardViewModel, type ProductCardViewModel } from '../utils/productCard'
import { useSaleWeekday } from '../hooks/useDeliveryOperation'
import { WINE_STYLE_LABEL, WINE_TYPE_LABEL, wineFacts } from '../utils/wine'
import { trackEvent } from '../utils/analytics'
import { SEO, StructuredData } from '../components/SEO'
import { getProductDetailSections } from '../utils/productDetailSchema'
import { erpIdFromSlug, productPath } from '../utils/productUrl'
import { CMS_CATEGORY_TO_RULE_ID, HOME_CATEGORY_RULES, normalizeCategoryCode, toCategoryUrlParam } from '../utils/homeCategories'
import { useDeliveryVerificationModal } from '../contexts/DeliveryVerificationModalContext'
import { readDeliveryVerification, subscribeDeliveryVerification } from '../services/deliveryVerification'
import { StoreProductCard } from '../components/StoreProductCard'
import { ProductImagePlaceholder } from '../components/ProductImagePlaceholder'
import { useAuth } from '../hooks/useAuth'
import { NEAR_EXPIRY_NOTE, useNearExpiryProductIds } from '../hooks/useCMS'
import NotificationBell from '../components/NotificationBell'
import { ProductRecipeShelf } from '../components/RecipeShelf'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { Button, buttonVariants } from '../components/ui/button'
import { surfaceClasses } from '../components/ui/surface'

// Missoes (tagsEcommerce da AntenorApi) que viram o titulo do bloco de
// sugestoes -- "Monte seu churrasco" vende mais que "Compre junto".
// Tags de atributo (linha-premium, diet-light, integral...) ficam de fora.
// Mesma ordem do MISSION_TAGS do backend (products.service.ts).
const MISSIONS: Array<[string, string]> = [
  ['churrasco', 'Monte seu churrasco'],
  ['queijos-e-vinhos', 'Queijos & vinhos'],
  ['boteco-em-casa', 'Boteco em casa'],
  ['cafe-da-manha', 'Café da manhã completo'],
  ['lanche-rapido', 'Lanche rápido'],
  ['sobremesa', 'Hora da sobremesa'],
]

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** "sex., 10/10": ultimo dia da oferta, em Brasilia (o fim vem como 23:59:59 de la). */
const promoEndLabel = (iso?: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
}

/**
 * Departamento do produto, com o nome da pagina que o link abre. Ate
 * 07/10/2026 o caminho mostrava a secao do ERP ("Manteigas & Requeijao") com
 * link para o departamento inteiro (Queijos, Frios & Laticinios): o site nao
 * tem pagina de secao.
 */
const departmentCrumb = (product: Product) => {
  if (product.category === 'ADEGA_VINHOS_ESPUMANTES') return { label: 'Adega', to: '/adega' }
  const ruleId = CMS_CATEGORY_TO_RULE_ID[normalizeCategoryCode(product.category || '')]
  const label = HOME_CATEGORY_RULES.find((rule) => rule.id === ruleId)?.label
  return label && product.category ? { label, to: `/mercado?cat=${toCategoryUrlParam(product.category)}` } : null
}

/** Frete do bairro do cliente (o que ele ja informou no site) ou convite para informar o CEP. */
function DeliveryInfoCard() {
  const { openModal } = useDeliveryVerificationModal()
  const [verification, setVerification] = useState(() => readDeliveryVerification())
  useEffect(() => subscribeDeliveryVerification(() => setVerification(readDeliveryVerification())), [])
  const calc = verification?.calc
  const place = calc?.locality || calc?.zoneName || verification?.address?.neighborhood

  let body: React.ReactNode
  if (!calc) {
    body = <>Veja se entregamos no seu endereço: <button type="button" onClick={() => openModal()} className="font-semibold text-[#5D082A] underline">Informe seu CEP</button> e veja o frete.</>
  } else if (calc.outOfArea) {
    body = <>Ainda não entregamos {place ? `em ${place}` : 'no seu endereço'}, mas você pode <strong>retirar na loja</strong>. <button type="button" onClick={() => openModal()} className="font-semibold text-[#5D082A] underline">Trocar endereço</button></>
  } else {
    const fee = calc.fee ?? 0
    body = (
      <>
        <strong>Entrega {place ? `em ${place}` : 'no seu endereço'}</strong>: {fee > 0 ? brl(fee) : 'grátis'}
        {fee > 0 && calc.freeAbove ? <> · grátis acima de {brl(calc.freeAbove)}</> : null}
        {' '}<button type="button" onClick={() => openModal()} className="text-[#5D082A] underline">trocar</button>
      </>
    )
  }
  return <p className="rounded-lg border border-[#E8D7B0]/70 bg-[#FBFAF7] px-4 py-3 text-sm text-[#5d4f33]">{body}</p>
}

function ProductHeader({ onBack, backLabel }: { onBack: () => void; backLabel: string }) {
  const { count } = useCart()
  const { user } = useAuth()
  return (
    <header className="glass sticky top-0 z-50 border-b border-[#D2BB8A]/20">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Button onClick={onBack} variant="ghost" size="sm" className="px-0 hover:bg-transparent">
          <ArrowLeft size={18} />
          {backLabel}
        </Button>
        <div className="flex items-center gap-1">
          <Link to="/cart" aria-label={count > 0 ? `Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'} className="relative flex min-h-11 min-w-11 items-center justify-center text-[#231F20] transition-colors hover:text-[#5D082A]">
            <ShoppingCart size={22} aria-hidden="true" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#5D082A] text-white text-label font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>
          {user && <NotificationBell />}
        </div>
      </div>
    </header>
  )
}

function ProductCarousel({ title, products, link }: { title: string; products: Product[]; link?: { to: string; label: string } }) {
  if (products.length === 0) return null
  return (
    <section className="max-w-6xl mx-auto px-4 pb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#231F20]">{title}</h2>
        {link && (
          <Link to={link.to} className="text-xs text-[#5D082A] font-bold hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar snap-x">
        {products.map((item) => (
          <StoreProductCard key={item.id} product={item} source="SEARCH" variant="carousel" />
        ))}
      </div>
    </section>
  )
}

export default function ProductDetail() {
  const { id: legacyId = '', slug = '' } = useParams()
  // /p/<nome>-<erpProductId> (URL limpa) ou /produto/<cuid> (links antigos).
  const id = slug ? erpIdFromSlug(slug) : legacyId
  const navigate = useNavigate()
  const location = useLocation()
  const { data: product, isLoading } = useProduct(id)
  const { data: recommendations = [] } = useProductRecommendations(product?.id ?? '', 6)
  const { data: substitutes = [] } = useSmartSubstitutes(product?.id ?? '', 6)
  const nearExpiryIds = useNearExpiryProductIds()
  const saleWeekday = useSaleWeekday()
  const [imageIndex, setImageIndex] = useState(0)
  const [imgError, setImgError] = useState(false)
  // 3 (01/10/2026): URL nova na borda, com o cache de 5 min no navegador.
  const imageVersion = '3'

  // Link antigo ou slug desatualizado (nome mudou) -> troca pela URL canonica
  // sem criar entrada nova no historico.
  useEffect(() => {
    if (!product) return
    const canonicalPath = productPath(product)
    if (location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true, state: location.state })
  }, [product, location.pathname, location.state, navigate])

  // VIEW_PRODUCT existia no tipo e nunca disparava: sem ele nao ha funil
  // "viu -> adicionou". Um evento por produto aberto.
  useEffect(() => {
    if (product?.id) trackEvent('VIEW_PRODUCT', 'PRODUCT', product.id, { name: product.name, price: product.price })
  }, [product?.id])

  const imageBaseUrl = `/uploads/products/${product?.ean ?? ''}`
  const imageCandidates = useMemo(
    () => [
      `${imageBaseUrl}.webp?v=${imageVersion}`,
      `${imageBaseUrl}.jpg?v=${imageVersion}`,
      `${imageBaseUrl}.jpeg?v=${imageVersion}`,
      `${imageBaseUrl}.png?v=${imageVersion}`,
    ],
    [imageBaseUrl, imageVersion],
  )

  const imageBaseUrl2 = `/uploads/products/${product?.ean ?? ''}_2`
  const imageCandidates2 = useMemo(
    () => [
      `${imageBaseUrl2}.webp?v=${imageVersion}`,
      `${imageBaseUrl2}.jpg?v=${imageVersion}`,
      `${imageBaseUrl2}.jpeg?v=${imageVersion}`,
      `${imageBaseUrl2}.png?v=${imageVersion}`,
    ],
    [imageBaseUrl2, imageVersion],
  )

  const [imageIndex2, setImageIndex2] = useState(0)
  const [imgError2, setImgError2] = useState<boolean | 'loading'>('loading')
  const [activePhoto, setActivePhoto] = useState<'1' | '2'>('1')

  const backTo = (location.state as { from?: string } | null)?.from || '/mercado'
  const backLabel = backTo === '/adega' ? 'Voltar para Adega' : 'Voltar ao Mercado'
  // ponytail: navigate(-1) volta pra pagina real de origem (preserva scroll/filtros);
  // so cai no backTo fixo quando nao ha historico dentro do site (link direto/aba nova)
  const goBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1)
    } else {
      navigate(backTo)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-[#5D082A]" size={44} />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white pb-16">
        <ProductHeader onBack={goBack} backLabel={backLabel} />
        <main className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl font-bold text-[#231F20]">Produto não encontrado</h1>
          <p className="text-[#5d4f33] mt-2">Esse item pode ter sido removido ou está indisponível no momento.</p>
          <Link to={backTo} className={buttonVariants({ variant: 'primary', size: 'md', className: 'mt-6' })}>
            {backTo === '/adega' ? 'Voltar para a Adega' : 'Voltar para o Mercado'}
          </Link>
        </main>
        <MobileBottomNav />
      </div>
    )
  }

  const imageUrl = imageCandidates[imageIndex] || imageCandidates[0]
  const currentImageUrl = activePhoto === '1'
    ? (imageCandidates[imageIndex] || imageCandidates[0])
    : (imageCandidates2[imageIndex2] || imageCandidates2[0])
  const currentImgError = activePhoto === '1' ? imgError : imgError2 === true

  const title = formatProductTitle(product.name)
  const price = getProductPricePresentation(product)
  const viewModel = getProductCardViewModel(product, saleWeekday)
  const promoUntil = viewModel.isOnSale ? promoEndLabel(product.promotionalPriceValidUntil) : ''
  const sections = getProductDetailSections(product)
  const categoryCrumb = departmentCrumb(product)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const unitSuffix = product.isFractional && price.unitLabel !== 'un' ? `/${price.unitLabel}` : ''
  // O alternativeDescription do ERP e nota de fracionamento, nao descricao
  // (ia parar no Google e na previa do WhatsApp). Mesmo texto do servidor.
  const description = `${title} por ${formatPrice(price.unitPrice)}${unitSuffix} no Antenor & Filhos. Peça pelo site e receba em casa.`

  // Titulo de missao so quando todos os itens sao da missao; senao a vitrine
  // dizia "Cafe da manha completo" e mostrava arroz e farinha (07/10/2026).
  const shelf = recommendations.filter((item) => item.id !== product.id)
  const mission = MISSIONS.find(([tag]) => product.tags?.includes(tag))
  const missionShelf = Boolean(mission && shelf.length > 0 && shelf.every((item) => item.tags?.includes(mission[0])))
  const alike = substitutes.filter((item) => item.id !== product.id)

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description,
    image: `${origin}${imageUrl}`,
    sku: String(product.erpProductId ?? product.ean),
    // GTIN so com codigo de barras de verdade; peso e producao propria usam codigo interno curto.
    gtin: /^\d{8,14}$/.test(product.ean || '') ? product.ean : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: price.unitPrice.toFixed(2),
      availability: viewModel.outOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Antenor & Filhos' },
    },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${origin}/` },
      ...(categoryCrumb ? [{ '@type': 'ListItem', position: 2, name: categoryCrumb.label, item: `${origin}${categoryCrumb.to}` }] : []),
      { '@type': 'ListItem', position: categoryCrumb ? 3 : 2, name: title },
    ],
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F4EA] via-[#FBFAF7] to-white pb-24 lg:pb-16">
      <SEO
        title={title}
        description={description}
        canonical={productPath(product)}
        type="product"
        image={imageUrl}
        keywords={[categoryCrumb?.label, product.name].filter(Boolean).join(', ')}
      />
      <StructuredData data={productSchema} />
      <StructuredData data={breadcrumbSchema} />

      <ProductHeader onBack={goBack} backLabel={backLabel} />

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-8 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 sm:gap-6">
        <section className={surfaceClasses({ tone: 'warm', className: 'self-start p-3 sm:p-5' })}>
          {/* Celular: foto em 4:3 para o preco e o botao de comprar caberem na
              primeira tela (em 1:1 o botao ficava atras da barra de baixo). */}
          <div className="aspect-[4/3] sm:aspect-square rounded-lg bg-[#FBFAF7] border border-[#E8D7B0]/60 overflow-hidden flex items-center justify-center">
            {!currentImgError ? (
              <img
                src={currentImageUrl}
                alt={title}
                className="w-full h-full object-contain p-3 transition-all duration-300"
                loading="eager"
                onError={() => {
                  if (activePhoto === '1') {
                    if (imageIndex < imageCandidates.length - 1) {
                      setImageIndex((prev) => prev + 1)
                      return
                    }
                    setImgError(true)
                  } else {
                    if (imageIndex2 < imageCandidates2.length - 1) {
                      setImageIndex2((prev) => prev + 1)
                      return
                    }
                    setImgError2(true)
                  }
                }}
              />
            ) : (
              <ProductImagePlaceholder size="lg" className="rounded-xl py-12" />
            )}
          </div>

          {/* Sonda a foto 2 fora da tela ate confirmar que existe -- so entao
              mostra as miniaturas, evita miniatura clicavel em branco/quebrada
              enquanto os candidatos (webp/jpg/jpeg/png) ainda estao testando. */}
          {imgError2 === 'loading' && (
            <img
              src={imageCandidates2[imageIndex2]}
              alt=""
              className="hidden"
              aria-hidden="true"
              onLoad={() => {
                // O nginx responde 200 com o SVG "produto sem foto" quando o
                // arquivo nao existe -- o onLoad sozinho mostrava a miniatura
                // do placeholder como se fosse a 2a foto. Confere o tipo real.
                const src = imageCandidates2[imageIndex2]
                fetch(src, { method: 'HEAD' })
                  .then((res) => {
                    if (!/svg/i.test(res.headers.get('content-type') || '')) return setImgError2(false)
                    if (imageIndex2 < imageCandidates2.length - 1) setImageIndex2((prev) => prev + 1)
                    else setImgError2(true)
                  })
                  .catch(() => setImgError2(true))
              }}
              onError={() => {
                if (imageIndex2 < imageCandidates2.length - 1) {
                  setImageIndex2(prev => prev + 1)
                } else {
                  setImgError2(true)
                }
              }}
            />
          )}

          {/* Miniaturas so com duas fotos: uma miniatura sozinha so repetia a foto grande. */}
          {imgError2 === false && !imgError && (
            <div className="mt-3 flex gap-2">
              {([['1', imageCandidates[imageIndex] || imageCandidates[0]], ['2', imageCandidates2[imageIndex2]]] as const).map(([n, src]) => (
                <Button
                  key={n}
                  onClick={() => setActivePhoto(n)}
                  variant="outline"
                  size="icon"
                  aria-label={`Ver foto ${n}`}
                  className={`w-16 h-16 overflow-hidden flex-shrink-0 border-2 p-0 transition-all duration-200 ${
                    activePhoto === n ? 'border-[#5D082A] ring-2 ring-[#5D082A]/20' : 'border-[#E8D7B0] hover:border-[#5D082A]/60'
                  }`}
                >
                  <img src={src} alt="" className="w-full h-full object-contain p-1" />
                </Button>
              ))}
            </div>
          )}

          {/* Vídeo (YouTube / Instagram / TikTok) */}
          {product.videoUrl && (
            <div className="mt-4">
              <ProductVideoEmbed url={product.videoUrl} />
            </div>
          )}
        </section>

        <section className={surfaceClasses({ tone: 'warm', className: 'p-4 sm:p-6 space-y-4' })}>
          {categoryCrumb && (
            <nav aria-label="Você está em" className="text-xs text-[#5d4f33]">
              <ol className="flex flex-wrap items-center gap-1">
                <li><Link to="/" className="hover:text-[#5D082A] hover:underline">Início</Link></li>
                <li aria-hidden="true">›</li>
                <li><Link to={categoryCrumb.to} className="hover:text-[#5D082A] hover:underline">{categoryCrumb.label}</Link></li>
              </ol>
            </nav>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-[#231F20] leading-tight">{title}</h1>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <div className="rounded-lg border border-[#E8D7B0] bg-[#FBF7F0] px-4 py-3 inline-flex items-end gap-1.5">
                <span className="text-sm font-semibold text-[#5D082A]">{price.currencySymbol}</span>
                <span className="text-3xl font-black text-[#5D082A] leading-none">{price.value}</span>
                {price.suffix && <span className="text-xs font-medium text-gray-500">{price.suffix}</span>}
              </div>
              {(viewModel.originalPrice || price.referenceText) && (
                <div className="flex flex-col gap-1 pb-1 text-xs">
                  {viewModel.originalPrice && (
                    <span className="flex items-center gap-2">
                      {viewModel.discountPct >= 1 && (
                        <span className="rounded-sm bg-[#F3E3EC] px-1.5 py-0.5 font-semibold leading-none text-[#5D082A]">{viewModel.discountPct}% OFF</span>
                      )}
                      <span className="font-medium text-gray-500 line-through">de {formatPrice(viewModel.originalPrice)}</span>
                    </span>
                  )}
                  {price.referenceText && <span className="font-medium text-gray-500">{price.referenceText}</span>}
                </div>
              )}
            </div>
            {promoUntil && <p className="text-xs font-semibold text-[#5D082A]">Oferta válida até {promoUntil}</p>}
            {nearExpiryIds.has(product.id) && <p className="text-xs text-gray-500">{NEAR_EXPIRY_NOTE}</p>}
          </div>

          <ProductPurchasePanel product={product} viewModel={viewModel} hasAlike={alike.length > 0} />
          <DeliveryInfoCard />

          {product.wineProfile && <WineSheet product={product} />}

          {sections.length > 0 && (
            <div className="space-y-4 pt-2">
              {sections.map((section) => (
                <article key={section.id} className="rounded-lg border border-[#E8D7B0]/70 bg-[#FBFAF7] p-4">
                  <h2 className="text-sm uppercase tracking-wider font-bold text-[#5D082A] mb-2">{section.title}</h2>
                  {section.facts.some((fact) => fact.label) ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                      {section.facts.map((fact) => (
                        <div key={fact.label} className="contents">
                          <dt className="font-semibold text-[#231F20]">{fact.label}</dt>
                          <dd className="text-[#5d4f33]">{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    section.facts.map((fact) => (
                      <p key={fact.value} className="text-sm text-[#5d4f33] leading-relaxed">{fact.value}</p>
                    ))
                  )}
                </article>
              ))}
            </div>
          )}

          {/* Peso e producao propria tem codigo interno curto (ex.: 2701), nao
              codigo de barras: aparece como "Codigo" (pedido do Jonathan, 01/10/2026). */}
          {product.ean && (
            <p className="text-xs text-[#5d4f33]">{/^\d{8,14}$/.test(product.ean) ? 'Código de barras (EAN)' : 'Código'}: <span className="font-mono">{product.ean}</span></p>
          )}

          {categoryCrumb && (
            <Link to={categoryCrumb.to} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Ver mais em {categoryCrumb.label}
            </Link>
          )}
        </section>
      </main>

      {/* Indisponivel: o que da para levar no lugar vem antes de tudo. */}
      {viewModel.outOfStock && <ProductCarousel title="Parecidos disponíveis" products={alike} />}

      <ProductRecipeShelf productId={product.id} className="max-w-6xl mx-auto px-4 pb-10" />

      <ProductCarousel
        title={missionShelf && mission ? mission[1] : 'Compre junto'}
        products={shelf}
        link={missionShelf && mission ? { to: `/mercado?tag=${mission[0]}`, label: 'Ver tudo' } : undefined}
      />

      {!viewModel.outOfStock && <ProductCarousel title="Parecidos com este" products={alike} />}
      <MobileBottomNav />
    </div>
  )
}

// Ficha do vinho (03/10/2026): para o novato, a descricao curta e o basico;
// para quem conhece, as notas de degustacao abrem num toque.
function WineSheet({ product }: { product: Product }) {
  const p = product.wineProfile!
  const f = wineFacts(product)
  const facts = [
    ['Tipo', [f.tipo ? WINE_TYPE_LABEL[f.tipo] : '', f.estilo ? WINE_STYLE_LABEL[f.estilo] : ''].filter(Boolean).join(' · ')],
    ['Uvas', f.uvas.join(', ')],
    ['Origem', [p.regiaoDenominacao, p.pais].filter(Boolean).join(', ')],
    ['Produtor', p.produtor || ''],
    ['Classificação', p.classificacao || ''],
    ['Teor alcoólico', p.teorAlcoolico || ''],
    ['Servir a', p.temperaturaServico || ''],
    ['Guarda', p.guarda || ''],
  ].filter(([, v]) => v)
  return (
    <article className="rounded-lg border border-[#E8D7B0]/70 bg-[#FBFAF7] p-4">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-[#5D082A]">Sobre este vinho</h2>
      {p.descricaoCurta && <p className="mb-3 text-sm leading-relaxed text-[#231F20]">{p.descricaoCurta}</p>}
      {facts.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold text-[#231F20]">{label}</dt>
              <dd className="text-[#5d4f33]">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.harmonizacao && (
        <p className="mt-3 text-sm leading-relaxed text-[#5d4f33]">
          <span className="font-semibold text-[#231F20]">Combina com: </span>
          {p.harmonizacao}
        </p>
      )}
      {p.notasDegustacao && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-[#5D082A]">Notas de degustação</summary>
          <p className="mt-1.5 leading-relaxed text-[#5d4f33]">{p.notasDegustacao}</p>
        </details>
      )}
    </article>
  )
}

function QuantityStepper({ label, onDecrease, onIncrease, compact = false }: { label: string; onDecrease: () => void; onIncrease: () => void; compact?: boolean }) {
  return (
    <div className="flex items-center rounded-lg border border-[#E8D7B0] bg-[#FBF7F0] p-1">
      <Button onClick={onDecrease} variant="ghost" size="icon" className={`${compact ? 'h-9 w-9' : 'h-11 w-11'} hover:bg-white`} aria-label="Diminuir quantidade">
        <Minus className="h-4 w-4" strokeWidth={2.4} />
      </Button>
      <div className={`flex ${compact ? 'min-w-[56px]' : 'min-w-[68px]'} flex-col items-center justify-center px-2`}>
        <span className="text-base font-black leading-none text-[#231F20]">{label}</span>
        {!compact && <span className="text-label uppercase tracking-[0.14em] text-gray-500">no carrinho</span>}
      </div>
      <Button onClick={onIncrease} variant="ghost" size="icon" className={`${compact ? 'h-9 w-9' : 'h-11 w-11'} hover:bg-white`} aria-label="Aumentar quantidade">
        <Plus className="h-4 w-4" strokeWidth={2.4} />
      </Button>
    </div>
  )
}

function ProductPurchasePanel({ product, viewModel, hasAlike }: { product: Product; viewModel: ProductCardViewModel; hasAlike: boolean }) {
  const { cart, addItem, updateQuantity, removeItem } = useCart()
  const pricing = useMemo(() => getProductPricePresentation(product), [product])
  const cartItem = cart.find((item) => item.productId === product.id)
  const quantity = cartItem?.quantity || 0
  // Pesavel: o carrinho guarda numero de porcoes; o cliente ve o peso ("1,25 kg").
  // Ate 07/10/2026 havia um seletor "Unidade | Peso" que so trocava esse rotulo.
  const quantityLabel = formatProductQuantity(product, quantity)

  // Barra fixa de compra no celular depois que o botao principal sai da tela
  // (rolando para ler a ficha, o cliente perdia o botao de comprar).
  const ctaRef = useRef<HTMLDivElement>(null)
  const [ctaScrolledAway, setCtaScrolledAway] = useState(false)
  useEffect(() => {
    const el = ctaRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setCtaScrolledAway(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    observer.observe(el)
    return () => observer.disconnect()
  }, [viewModel.outOfStock])

  const fireAddToCartEvent = () => {
    trackEvent('ADD_TO_CART', 'PRODUCT', product.id, {
      name: product.name,
      price: product.price,
      source: 'SEARCH',
    })
  }

  const handleAdd = () => {
    addItem(product, 1)
    fireAddToCartEvent()
    toast.success(`${formatProductTitle(product.name)} no carrinho`, { id: `add-${product.id}`, duration: 1500, position: 'top-center' })
  }

  const handleDecrease = () => {
    if (quantity > 1) {
      updateQuantity(product.id, quantity - 1)
      return
    }
    removeItem(product.id)
  }

  const handleIncrease = () => {
    addItem(product, 1)
    fireAddToCartEvent()
  }

  if (viewModel.outOfStock) {
    return (
      <div className="rounded-lg border border-[#E8D7B0] bg-[#FBF7F0] px-4 py-4 text-center">
        <p className="text-sm font-semibold text-[#8a6a3a]">
          {viewModel.offDay
            ? `Vendido só ${viewModel.saleDaysText}`
            : product.active === false || viewModel.missingFractionStep
              ? 'Indisponível no momento'
              : 'Sem estoque no momento'}
        </p>
        <p className="mt-1 text-xs text-[#8a6a3a]">
          {viewModel.offDay ? 'Volte para pedir num desses dias.' : hasAlike ? 'Veja abaixo opções parecidas disponíveis.' : 'Volte mais tarde ou procure no Mercado.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {viewModel.saleDaysText && (
        <p className="rounded-lg border border-[#E8D7B0] bg-[#FBF7F0] px-3 py-2 text-xs font-medium text-[#8a6a3a]">
          Vendido só {viewModel.saleDaysText}.
        </p>
      )}

      <div ref={ctaRef}>
        {quantity === 0 ? (
          <Button onClick={handleAdd} size="lg" className="w-full gap-2">
            <ShoppingCart className="h-5 w-5" />
            {viewModel.isFractional ? `Adicionar ${pricing.portionLabel}` : 'Adicionar ao carrinho'}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <QuantityStepper label={quantityLabel} onDecrease={handleDecrease} onIncrease={handleIncrease} />
            <Link to="/cart" className={buttonVariants({ variant: 'primary', size: 'lg', className: 'flex-1 gap-2' })}>
              Ver carrinho <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {product.isFractional && (
        <p className="text-xs leading-relaxed text-[#5d4f33]">
          Vendido por peso, em porções de {pricing.portionLabel}. O valor final segue o peso conferido na separação.
        </p>
      )}

      {ctaScrolledAway && (
        <div className="fixed inset-x-0 bottom-[var(--mobile-nav-height,4rem)] md:bottom-0 z-40 border-t border-[#D2BB8A]/40 bg-white/95 px-4 py-2.5 shadow-[0_-8px_30px_rgba(35,31,32,0.12)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-[#5d4f33]">{formatProductTitle(product.name)}</p>
              <p className="text-base font-black leading-tight text-[#5D082A]">{pricing.fullLabel}</p>
            </div>
            {quantity === 0 ? (
              <Button onClick={handleAdd} size="md" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Adicionar
              </Button>
            ) : (
              <QuantityStepper compact label={quantityLabel} onDecrease={handleDecrease} onIncrease={handleIncrease} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProductVideoEmbed({ url }: { url: string }) {
  const embedUrl = useMemo(() => {
    // YouTube: https://youtu.be/xxx ou https://www.youtube.com/watch?v=xxx
    const ytShort = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/)
    const ytWatch = url.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]+)/)
    const ytId = (ytShort || ytWatch)?.[1]
    if (ytId) return `https://www.youtube.com/embed/${ytId}`

    // Instagram: https://www.instagram.com/reel/xxx ou /p/xxx
    const igMatch = url.match(/instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)/)
    if (igMatch) return `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed`

    // TikTok: https://www.tiktok.com/@user/video/xxx
    const ttMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
    if (ttMatch) return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`

    return null
  }, [url])

  if (!embedUrl) return null

  return (
    <div className={surfaceClasses({ tone: 'warm', className: 'overflow-hidden' })}>
      <div className="bg-[#FBF7F0] px-4 py-2 flex items-center gap-2 border-b border-[#E8D7B0]/60">
        <Film size={16} className="text-[#5D082A]" />
        <span className="text-xs font-bold text-[#5d4f33] tracking-wide uppercase">Demonstração do Produto</span>
      </div>
      <div className="bg-black aspect-video relative">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title="Vídeo do produto"
        />
      </div>
    </div>
  )
}
