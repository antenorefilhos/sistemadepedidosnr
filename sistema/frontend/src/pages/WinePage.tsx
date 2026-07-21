import { useProducts, useCart } from '../hooks/useCart'
import type { Product } from '../types'
import { getProductPricePresentation } from '../utils/productPricing'
import { trackEvent } from '../utils/analytics'
import { ArrowLeft, ShoppingCart, Loader2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useEffect, useState } from 'react'
import { SEO, StructuredData } from '../components/SEO'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { surfaceClasses } from '../components/ui/surface'

const normalizeUppercaseDisplayText = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text) return ''

  const letters = text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []
  if (letters.length === 0) return text

  const upperCount = letters.filter((char) => char === char.toUpperCase()).length
  const upperRatio = upperCount / letters.length

  // Converte quando o texto vier predominantemente em caixa alta do ERP.
  if (upperRatio < 0.6) return text

  return text
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const formatWineDescription = (value?: string | null) => {
  const normalized = normalizeUppercaseDisplayText(value)
  return normalized || 'Reserva Especial Antenor'
}

const formatWineTitle = (value?: string | null) => normalizeUppercaseDisplayText(value)

export default function WinePage() {
  const { data: products, isLoading } = useProducts(undefined, 'Adega')
  const { count } = useCart()

  useEffect(() => {
    trackEvent('VIEW_CATEGORY', 'CATEGORY', 'VINHOS')
  }, [])

  const vinhos = useMemo(() => {
    return (products || []) as Product[]
  }, [products])
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#231F20]">
        <Loader2 className="animate-spin text-[#D2BB8A]" size={48} />
      </div>
    )
  }

  // Schema for Breadcrumbs
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": window.location.origin
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Adega",
        "item": `${window.location.origin}/vinhos`
      }
    ]
  }

  return (
    <div className="min-h-screen bg-[#231F20] text-white font-outfit">
      <SEO 
        title="Adega Antenor | Vinhos de Luxo" 
        description="Vinhos escolhidos para presentear, comemorar e surpreender. Descubra rótulos que valem a pena levar para casa."
      />
      <StructuredData data={breadcrumbSchema} />
      {/* Header Specialized */}
      <header className="fixed top-0 w-full z-50 glass-dark border-b border-[#D2BB8A]/30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-[#D2BB8A] hover:scale-110 transition-transform" aria-label="Voltar para Home">
            <ArrowLeft size={24} />
          </Link>
          <div className="text-center flex-1">
             <h1 className="luxury-text text-xl text-[#D2BB8A] tracking-[0.2em] uppercase">Adega Antenor</h1>
             <p className="text-[8px] text-[#D2BB8A]/60 -mt-1 tracking-widest uppercase">Since 2026</p>
          </div>
          <Link to="/cart" className="relative p-2 text-[#D2BB8A]" aria-label={`Carrinho com ${count} itens`}>
            <ShoppingCart size={24} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-[#231F20] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main>
        {/* Luxury Hero Section */}
        <section className="relative h-[60vh] flex items-end pb-12">
           <img 
             src="/banners/vinhos.png" 
             alt="Luxury Wine Selection - Adega Antenor & Filhos" 
             className="absolute inset-0 w-full h-full object-cover opacity-60" 
             loading="eager"
           />
           <div className="absolute inset-0 bg-gradient-to-t from-[#231F20] via-transparent to-[#231F20]/30" />
           <div className="relative z-10 max-w-7xl mx-auto px-6 w-full fade-in-section">
              <span className="flex items-center gap-2 text-[#D2BB8A] text-xs font-bold tracking-widest uppercase mb-4">
                 <Sparkles size={14} /> Seleção Especial
              </span>
              <h2 className="text-5xl md:text-7xl font-bold luxury-text mb-6">Cada taça conta <br/>uma história</h2>
              <p className="max-w-lg text-white/70 text-sm italic leading-relaxed">
                Não é só vinho. É escolha, cuidado e sabor de verdade. Aqui você encontra rótulos para presentear bem ou aproveitar um momento especial.
              </p>
           </div>
        </section>

        {/* Wine Grid */}
        <section className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {vinhos.map((vinho) => (
              <WineCard key={vinho.id} product={vinho} />
            ))}
          </div>
        </section>
      </main>

      {/* Footer Branding */}
      <footer className="py-20 text-center border-t border-[#D2BB8A]/10 opacity-30">
         <p className="luxury-text text-2xl text-[#D2BB8A]">Antenor & Filhos</p>
      </footer>
    </div>
  )
}

function WineCard({ product }: { product: Product }) {
  const { cart, addItem, removeItem, updateQuantity } = useCart()
  const cartItem = cart.find(item => item.productId === product.id)
  const quantity = cartItem?.quantity || 0
  const [imageIndex, setImageIndex] = useState(0)
  const [imgError, setImgError] = useState(false)

  const imageBaseUrl = `/uploads/products/${product.ean}`
  const imageCandidates = [`${imageBaseUrl}.webp`, `${imageBaseUrl}.jpg`, `${imageBaseUrl}.jpeg`, `${imageBaseUrl}.png`]
    .map((url) => `${url}?v=2`)
  const imageUrl = imageCandidates[imageIndex]

  const handleDecrease = () => {
    if (quantity > 1) {
      updateQuantity(product.id, quantity - 1)
    } else {
      removeItem(product.id)
    }
  }

  const handleIncrease = () => {
    addItem(product, 1)
    trackEvent('ADD_TO_CART', 'PRODUCT', product.id, { name: product.name, price: product.price })
  }

  return (
    <div className="group flex flex-col fade-in-section h-full">
       {/* 1:1 Photo Container */}
       <div className={surfaceClasses({ tone: 'dark', className: 'relative aspect-square overflow-hidden mb-4 shadow-2xl bg-black/40 border-white/5' })}>
         <Link
            to={`/produto/${product.id}`}
            state={{ from: '/adega' }}
          className="absolute inset-0 z-[1]"
          aria-label={`Ver detalhes de ${product.name}`}
         />
          <div className="absolute inset-0 flex items-center justify-center text-6xl grayscale opacity-20 group-hover:opacity-40 transition-all duration-700 group-hover:scale-110">
             🍷
          </div>
          {!imgError && (
            <img 
              src={imageUrl}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-cover opacity-100"
              loading="lazy"
              decoding="async"
              onError={() => {
                if (imageIndex < imageCandidates.length - 1) {
                  setImageIndex((prev) => prev + 1)
                  return
                }
                setImgError(true)
              }}
            />
          )}
          
          {/* Badge Overlay */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {product.badges && (
              <Badge tone="gold" className="h-5 bg-[#D2BB8A] text-[#231F20] text-[8px] shadow-lg">
                {product.badges}
              </Badge>
            )}
          </div>

          <Button
            onClick={handleIncrease}
            variant="ghost"
            className="absolute inset-0 z-[2] h-auto rounded-lg bg-black/0 p-0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100"
            aria-label={`Adicionar ${product.name} ao carrinho`}
          >
            <div className="bg-[#D2BB8A] text-[#231F20] p-3 rounded-full scale-50 group-hover:scale-100 transition-transform">
              <ShoppingCart size={20} />
            </div>
          </Button>
       </div>

       {/* Info Below */}
       <div className="flex flex-col flex-1 px-1">
          <div className="mb-3">
             <Link to={`/produto/${product.id}`} state={{ from: '/adega' }} className="block">
               <h3 className="luxury-text text-base text-white line-clamp-2 leading-tight min-h-[2.5rem] group-hover:text-[#D2BB8A] transition-colors">
                 {formatWineTitle(product.name)}
               </h3>
             </Link>
             <p className="text-[10px] text-white/40 italic mt-1 line-clamp-1">
               {formatWineDescription(product.alternativeDescription)}
             </p>
          </div>
          
          <div className="mt-auto pt-3 border-t border-white/5">
             <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-[#D2BB8A]">
                 {getProductPricePresentation(product).fullLabel}
                </span>
                
                {quantity === 0 ? (
                   <Button
                     onClick={handleIncrease}
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8 rounded-full border border-[#D2BB8A]/20 bg-white/5 text-[#D2BB8A] hover:bg-[#D2BB8A] hover:text-[#231F20]"
                     aria-label="Adicionar ao carrinho"
                   >
                     +
                   </Button>
                ) : (
                   <div className="flex items-center gap-2 bg-white/5 rounded-lg border border-[#D2BB8A]/20 p-1">
                     <Button
                       onClick={handleDecrease}
                       variant="ghost"
                       size="icon"
                       className="h-6 w-6 text-[#D2BB8A] hover:bg-white/10"
                       aria-label="Diminuir quantidade"
                     >
                       -
                     </Button>
                     <span className="text-xs font-bold text-white min-w-[15px] text-center">
                       {quantity}
                     </span>
                     <Button
                       onClick={handleIncrease}
                       variant="ghost"
                       size="icon"
                       className="h-6 w-6 text-[#D2BB8A] hover:bg-white/10"
                       aria-label="Aumentar quantidade"
                     >
                       +
                     </Button>
                   </div>
                )}
             </div>
          </div>
       </div>
    </div>
  )
}
