import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, ShoppingCart, Film } from 'lucide-react'
import { useProduct, useCart, useProductRecommendations, useSmartSubstitutes } from '../hooks/useCart'
import { formatProductTitle } from '../utils/format'
import { getProductPricePresentation } from '../utils/productPricing'
import { SEO, StructuredData } from '../components/SEO'
import { getProductDetailSections } from '../utils/productDetailSchema'
import { StoreProductCard } from '../components/StoreProductCard'
import { ProductImagePlaceholder } from '../components/ProductImagePlaceholder'
import { Badge } from '../components/ui/badge'
import { Button, buttonVariants } from '../components/ui/button'
import { surfaceClasses } from '../components/ui/surface'

export default function ProductDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: product, isLoading } = useProduct(id)
  const { data: recommendations = [] } = useProductRecommendations(id, 6)
  const { data: substitutes = [] } = useSmartSubstitutes(id, 6)
  const { count } = useCart()
  const [imageIndex, setImageIndex] = useState(0)
  const [imgError, setImgError] = useState(false)
  const imageVersion = '2'

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-[#5D082A]" size={44} />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white font-outfit pb-16">
        <header className="glass sticky top-0 z-50 border-b border-[#D2BB8A]/20">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Button
              onClick={() => navigate(backTo)}
              variant="ghost"
              size="sm"
              className="px-0 hover:bg-transparent"
            >
              <ArrowLeft size={18} />
              {backLabel}
            </Button>
            <Link to="/cart" className="relative p-2 text-[#231F20] hover:text-[#5D082A] transition-colors">
              <ShoppingCart size={22} />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#5D082A] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl font-bold text-[#231F20]">Produto nao encontrado</h1>
          <p className="text-[#5d4f33] mt-2">Esse item pode ter sido removido ou esta indisponivel no momento.</p>
          <Link to={backTo} className={buttonVariants({ variant: 'primary', size: 'md', className: 'mt-6' })}>
            {backTo === '/adega' ? 'Voltar para a Adega' : 'Voltar para o Mercado'}
          </Link>
        </main>
      </div>
    )
  }

  const imageUrl = imageCandidates[imageIndex] || imageCandidates[0]
  const currentImageUrl = activePhoto === '1'
    ? (imageCandidates[imageIndex] || imageCandidates[0])
    : (imageCandidates2[imageIndex2] || imageCandidates2[0])
  const currentImgError = activePhoto === '1' ? imgError : imgError2 === true

  const price = getProductPricePresentation(product)
  const sections = getProductDetailSections(product)

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: formatProductTitle(product.name),
    description: product.alternativeDescription || product.name,
    image: typeof window !== 'undefined' ? `${window.location.origin}${imageUrl}` : imageUrl,
    sku: product.ean,
    gtin: product.ean,
    brand: { '@type': 'Brand', name: 'Antenor & Filhos' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: price.displayPrice.toFixed(2),
      availability:
        product.syncOption === 'SEMPRE' || (product.stock != null && product.stock > 0)
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: 'Antenor & Filhos' },
    },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Mercado', item: `${typeof window !== 'undefined' ? window.location.origin : ''}/mercado` },
      { '@type': 'ListItem', position: 2, name: formatProductTitle(product.name) },
    ],
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F4EA] via-[#FBFAF7] to-white font-outfit pb-16">
      <SEO
        title={formatProductTitle(product.name)}
        description={product.alternativeDescription || `Compre ${formatProductTitle(product.name)} no Antenor & Filhos. Qualidade garantida com entrega na sua porta.`}
        canonical={`/produto/${product.id}`}
        type="product"
        image={imageUrl}
        keywords={[product.category, product.name].filter(Boolean).join(', ')}
      />
      <StructuredData data={productSchema} />
      <StructuredData data={breadcrumbSchema} />

      <header className="glass sticky top-0 z-50 border-b border-[#D2BB8A]/20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            onClick={() => navigate(backTo)}
            variant="ghost"
            size="sm"
            className="px-0 hover:bg-transparent"
          >
            <ArrowLeft size={18} />
            {backLabel}
          </Button>

          <Link to="/cart" className="relative p-2 text-[#231F20] hover:text-[#5D082A] transition-colors">
            <ShoppingCart size={22} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#5D082A] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
        <section className={surfaceClasses({ tone: 'warm', className: 'self-start p-5' })}>
          <div className="aspect-square rounded-lg bg-[#FBFAF7] border border-[#E8D7B0]/60 overflow-hidden flex items-center justify-center">
            {!currentImgError ? (
              <img
                src={currentImageUrl}
                alt={product.name}
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

          {/* Thumbnails: foto 1 (atual) + foto 2 (EAN_2) */}
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => { setActivePhoto('1') }}
              variant="outline"
              size="icon"
              className={`w-16 h-16 overflow-hidden flex-shrink-0 border-2 p-0 transition-all duration-200 ${
                activePhoto === '1' ? 'border-[#5D082A] ring-2 ring-[#5D082A]/20' : 'border-[#E8D7B0] hover:border-[#5D082A]/60'
              }`}
            >
              <img
                src={imageCandidates[0]}
                alt="Foto 1"
                className="w-full h-full object-contain p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </Button>

            {imgError2 !== true && (
              <Button
                onClick={() => { setActivePhoto('2') }}
                variant="outline"
                size="icon"
                className={`w-16 h-16 overflow-hidden flex-shrink-0 border-2 p-0 transition-all duration-200 ${
                  activePhoto === '2' ? 'border-[#5D082A] ring-2 ring-[#5D082A]/20' : 'border-[#E8D7B0] hover:border-[#5D082A]/60'
                }`}
              >
                <img
                  src={imageCandidates2[imageIndex2]}
                  alt="Foto 2"
                  className="w-full h-full object-contain p-1"
                  onLoad={() => setImgError2(false)}
                  onError={() => {
                    if (imageIndex2 < imageCandidates2.length - 1) {
                      setImageIndex2(prev => prev + 1)
                    } else {
                      setImgError2(true)
                    }
                  }}
                />
              </Button>
            )}
          </div>

          {/* Vídeo (YouTube / Instagram / TikTok) */}
          {(product as any).videoUrl && (
            <div className="mt-4">
              <ProductVideoEmbed url={(product as any).videoUrl} />
            </div>
          )}
        </section>

        <section className={surfaceClasses({ tone: 'warm', className: 'p-6 space-y-4' })}>
          <Badge tone="gold">Produto detalhado</Badge>
          <h1 className="text-3xl font-bold text-[#231F20] leading-tight">{formatProductTitle(product.name)}</h1>

          {product.alternativeDescription && (
            <p className="text-sm text-[#5d4f33] leading-relaxed rounded-lg border border-[#E8D7B0]/70 bg-[#FBFAF7] px-4 py-3">
              {product.alternativeDescription}
            </p>
          )}

          <div className="rounded-lg border border-[#E8D7B0] bg-[#FBF7F0] px-4 py-3 inline-flex items-end gap-1.5">
            <span className="text-sm font-semibold text-[#5D082A]">{price.currencySymbol}</span>
            <span className="text-3xl font-black text-[#5D082A] leading-none">{price.value}</span>
            {price.suffix && <span className="text-xs font-medium text-gray-500">{price.suffix}</span>}
          </div>

          <div className="space-y-4 pt-2">
            {sections.map((section) => (
              <article key={section.id} className="rounded-lg border border-[#E8D7B0]/70 bg-[#FBFAF7] p-4">
                <h2 className="text-sm uppercase tracking-wider font-bold text-[#5D082A] mb-2">{section.title}</h2>
                <div className="space-y-2">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm text-[#5d4f33] leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <Link
              to={`/mercado?cat=${encodeURIComponent(String(product.category || '').toLowerCase().replace(/_/g, '-'))}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Ver categoria
            </Link>
            <Link to={backTo} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              {backTo === '/adega' ? 'Voltar para a adega' : 'Voltar para o catalogo'}
            </Link>
          </div>
        </section>
      </main>

      {recommendations.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#231F20]">Compre junto</h2>
            <Link to="/mercado" className="text-xs text-[#5D082A] font-bold hover:underline">
              Ver mais no Mercado
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar snap-x">
            {recommendations
              .filter((recommended) => recommended.id !== product.id)
              .map((recommended) => (
                <StoreProductCard key={recommended.id} product={recommended} source="SEARCH" variant="carousel" />
              ))}
          </div>
        </section>
      )}

      {substitutes.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#231F20]">Substitutos se faltar</h2>
            <Link to="/mercado" className="text-xs text-[#5D082A] font-bold hover:underline">
              Ver no Mercado
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar snap-x">
            {substitutes
              .filter((substitute) => substitute.id !== product.id)
              .map((substitute) => (
                <StoreProductCard key={substitute.id} product={substitute} source="SEARCH" variant="carousel" />
              ))}
          </div>
        </section>
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
