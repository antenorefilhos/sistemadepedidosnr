import { useCart } from '../hooks/useCart'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Product } from '../types'
import { useProductRecommendations, useSmartSubstitutes } from '../hooks/useCart'
import { useTopSellingProducts } from '../hooks/useCMS'
import { StoreProductCard } from '../components/StoreProductCard'
import { formatPrice, formatProductTitle } from '../utils/format'
import { ProductImagePlaceholder } from '../components/ProductImagePlaceholder'
import { getProductLineTotal, getProductPricePresentation } from '../utils/productPricing'
import { Trash2, Plus, Minus, ArrowLeft, ShoppingCart } from 'lucide-react'
import { FreeShippingBar } from '../components/FreeShippingBar'
import { Badge } from '../components/ui/badge'
import { Button, buttonVariants } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Input } from '../components/ui/input'
import { surfaceClasses } from '../components/ui/surface'

function cleanFractionText(text?: string) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  return raw.replace(/^\s*fracionamento\s*:\s*/i, '').trim()
}

function getAvailabilityLabel(product?: Product) {
  if (!product?.active || product?.syncOption === 'NUNCA') return { label: 'Indisponivel', tone: 'border-red-100 bg-red-50 text-red-700' }
  if (product?.syncOption === 'ESTOQUE' && typeof product.stock === 'number' && product.stock <= 0) {
    return { label: 'Sem estoque', tone: 'border-red-100 bg-red-50 text-red-700' }
  }
  if (product?.syncOption === 'ESTOQUE' && typeof product.stock === 'number' && product.stock <= 3) {
    return { label: 'Poucas unidades', tone: 'border-amber-100 bg-amber-50 text-amber-700' }
  }
  return { label: 'Disponivel', tone: 'border-emerald-100 bg-emerald-50 text-emerald-700' }
}

export default function Cart() {
  const { cart, removeItem, updateQuantity, updateAllowSubstitution, clear, total, subtotal, discount, couponCode, applyCoupon, removeCoupon } = useCart()
  const [couponInput, setCouponInput] = useState(couponCode || '')
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null)
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0)
  const anchorProductId = cart[0]?.productId || ''
  const { data: contextualRecommendations = [] } = useProductRecommendations(anchorProductId, 8)
  const { data: topSellingProducts = [] } = useTopSellingProducts(8)

  const cartProductIds = new Set(cart.map((item) => item.productId))
  const topProducts = topSellingProducts
    .map((entry) => entry.product)
    .filter((product): product is Product => Boolean(product?.id))

  const recommendationPool = [...contextualRecommendations, ...topProducts]
  const recommendations = recommendationPool
    .filter((product): product is Product => Boolean(product?.id))
    .filter((product, index, self) => self.findIndex((candidate) => candidate.id === product.id) === index)
    .filter((product) => !cartProductIds.has(product.id))
    .slice(0, 10)

  useEffect(() => {
    setCouponInput(couponCode || '')
  }, [couponCode])

  const handleApplyCoupon = async () => {
    const result = await applyCoupon(couponInput)
    setCouponFeedback(result.message)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F4EA] via-[#FBFAF7] to-white">
      <header className="glass sticky top-0 z-50 border-b border-[#D2BB8A]/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'px-0 hover:bg-transparent' })}
          >
            <ArrowLeft size={18} />
            Voltar para compras
          </Link>
          <div className="inline-flex items-center gap-2 text-[#231F20] font-semibold">
            <ShoppingCart size={18} className="text-[#5D082A]" />
            Carrinho
            <Badge tone="burgundy" className="bg-[#5D082A] text-white">
              {totalItems}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-28 md:py-8 md:pb-8">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[#231F20]">Seu Carrinho</h1>
          <p className="text-sm text-[#5d4f33] mt-1">
            Revise os itens antes de finalizar o pedido.
          </p>
        </div>

        {cart.length === 0 ? (
          <>
            <div className={surfaceClasses({ tone: 'warm', className: 'p-10 text-center' })}>
              <ShoppingCart size={42} className="mx-auto text-[#5D082A]/60 mb-3" />
              <p className="text-[#231F20] font-semibold mb-2">Seu carrinho está vazio</p>
              <p className="text-sm text-[#6b7280] mb-5">
                Escolha seus produtos e monte seu pedido. Tem muita coisa boa esperando por você.
              </p>
              <Link to="/" className={buttonVariants({ variant: 'primary', size: 'md' })}>
                Ver ofertas da loja
              </Link>
            </div>

            {recommendations.length > 0 && (
              <section className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-[#231F20]">Mais vendidos para começar</h2>
                  <Link to="/mercado" className="text-xs text-[#5D082A] font-bold hover:underline">
                    Ver no Mercado
                  </Link>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar snap-x">
                  {recommendations.map((product) => (
                    <StoreProductCard key={product.id} product={product} source="SEARCH" variant="carousel" />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            <section className="space-y-4">
              {cart.map((item) => {
                const pricePresentation = item.product ? getProductPricePresentation(item.product) : null
                const subtotal = item.product ? getProductLineTotal(item.product, item.quantity) : 0
                const imageUrl = item.product?.ean ? `/uploads/products/${item.product.ean}.webp?v=2` : ''
                const availability = getAvailabilityLabel(item.product)

                return (
                  <article
                    key={item.productId}
                    className={surfaceClasses({ className: 'p-4 md:p-5' })}
                  >
                    <div className="flex items-start gap-3 md:gap-4">
                      <div className="w-20 h-20 rounded-lg border border-[#E8D7B0]/60 bg-[#FBFAF7] overflow-hidden flex items-center justify-center shrink-0">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={formatProductTitle(item.product?.name || 'Produto')}
                            className="w-full h-full object-contain p-1.5"
                            loading="lazy"
                          />
                        ) : (
                          <ProductImagePlaceholder size="sm" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[#231F20] text-sm md:text-base leading-snug">
                          {formatProductTitle(item.product?.name || '')}
                        </h3>
                        {item.product?.isFractional && (
                          <p className="text-caption text-[#5d4f33] mt-1 line-clamp-2">
                            {cleanFractionText(item.product?.alternativeDescription) || `Venda fracionada (${(item.product?.unit || 'un').toUpperCase()})`}
                          </p>
                        )}
                        <p className="text-[#5D082A] font-semibold mt-1">
                          {pricePresentation?.fullLabel || formatPrice(0)}
                        </p>
                        <Badge className={`mt-2 normal-case tracking-normal ${availability.tone}`}>
                          {availability.label}
                        </Badge>
                      </div>

                      <Button
                        onClick={() => removeItem(item.productId)}
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:bg-red-50"
                        aria-label={`Remover ${formatProductTitle(item.product?.name || '')} do carrinho`}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 bg-[#f5f2ec] rounded-lg p-1 border border-[#D2BB8A]/40">
                        <Button
                          onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 hover:bg-white md:h-9 md:w-9"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus size={16} />
                        </Button>
                        <span className="w-8 text-center font-bold text-[#231F20]">{item.quantity}</span>
                        <Button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 hover:bg-white md:h-9 md:w-9"
                          aria-label="Aumentar quantidade"
                        >
                          <Plus size={16} />
                        </Button>
                      </div>

                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Subtotal</p>
                        <p className="text-lg font-bold text-[#231F20]">{formatPrice(subtotal)}</p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg border border-[#E8D7B0]/70 bg-[#FBFAF7] p-3">
                      <label className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-[#231F20]">Aceitar substituição se faltar</span>
                          <span className="mt-0.5 block text-xs text-[#5d4f33]">
                            A equipe usa item similar e confirma qualquer diferença antes do fechamento.
                          </span>
                        </span>
                        <Checkbox
                          checked={item.allowSubstitution !== false}
                          onChange={(event) => updateAllowSubstitution(item.productId, event.target.checked)}
                          aria-label={`Aceitar substituição para ${formatProductTitle(item.product?.name || '')}`}
                        />
                      </label>
                    </div>
                    <CartItemSubstitutes productId={item.productId} />
                  </article>
                )
              })}
            </section>

            <aside className="lg:sticky lg:top-24 h-fit">
              <div className={surfaceClasses({ tone: 'warm', className: 'p-5' })}>
                <h2 className="text-lg font-bold text-[#231F20] mb-4">Resumo do Pedido</h2>

                <div className="mb-4">
                  <FreeShippingBar subtotal={subtotal} />
                </div>

                <div className="mb-4 rounded-lg border border-[#E8D7B0] bg-[#FBFAF7] p-3 space-y-2">
                  <p className="text-xs uppercase tracking-wider font-semibold text-[#8A6A3A]">Cupom</p>
                  <div className="flex gap-2">
                    <Input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Digite seu cupom"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleApplyCoupon}
                      size="md"
                      className="px-4 text-xs"
                    >
                      Aplicar
                    </Button>
                  </div>
                  {couponCode && (
                    <div className="flex items-center justify-between text-xs text-[#5D082A]">
                      <span>Cupom ativo: {couponCode}</span>
                      <Button variant="ghost" size="sm" onClick={removeCoupon} className="h-auto px-0 py-0 hover:bg-transparent hover:underline">
                        Remover
                      </Button>
                    </div>
                  )}
                  {couponFeedback && <p className="text-xs text-[#5d4f33]">{couponFeedback}</p>}
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Itens</span>
                    <span>{totalItems}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Desconto</span>
                    <span className="text-emerald-700">-{formatPrice(discount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Entrega</span>
                    <span>A calcular</span>
                  </div>
                </div>

                <div className="border-t border-[#E8D7B0] pt-4 mb-4 flex items-center justify-between">
                  <span className="text-base font-semibold text-[#231F20]">Total</span>
                  <span className="text-3xl font-black text-[#5D082A]">{formatPrice(total)}</span>
                </div>

                <div className="space-y-2.5">
                  <Link
                    to="/checkout"
                    className={buttonVariants({ variant: 'primary', size: 'lg', className: 'w-full' })}
                  >
                    Fechar pedido
                  </Link>
                  <p className="text-xs text-center text-[#6b7280] px-2">
                    Na próxima etapa você informa entrega e pagamento.
                  </p>
                  <Button
                    onClick={clear}
                    variant="outline"
                    size="lg"
                    className="w-full"
                  >
                    Limpar carrinho
                  </Button>
                </div>
              </div>
            </aside>
            </div>

            {recommendations.length > 0 && (
              <section className="mt-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-[#231F20]">Você também pode gostar</h2>
                  <Link to="/mercado" className="text-xs text-[#5D082A] font-bold hover:underline">
                    Ver no Mercado
                  </Link>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar snap-x">
                  {recommendations.map((product) => (
                    <StoreProductCard key={product.id} product={product} source="SEARCH" variant="carousel" />
                  ))}
                </div>
              </section>
            )}

            <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#D2BB8A]/40 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(35,31,32,0.12)] backdrop-blur lg:hidden">
              <Link
                to="/checkout"
                className={buttonVariants({
                  variant: 'primary',
                  size: 'lg',
                  className: 'flex min-h-14 items-center justify-between px-4 shadow-lg',
                })}
                aria-label="Fechar pedido"
              >
                <span className="text-sm font-bold">
                  Fechar pedido
                  <span className="ml-2 rounded-md bg-white/15 px-2 py-1 text-xs">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
                </span>
                <span className="text-base font-black">{formatPrice(total)}</span>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function CartItemSubstitutes({ productId }: { productId: string }) {
  const { data: substitutes = [] } = useSmartSubstitutes(productId, 4)
  const visible = substitutes.filter((product) => product.id !== productId).slice(0, 3)

  if (visible.length === 0) return null

  return (
    <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/70 p-3">
      <p className="text-caption font-black uppercase tracking-[0.14em] text-amber-800">
        Substitutos para este item
      </p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {visible.map((product) => (
          <Link
            key={product.id}
            to={`/produto/${product.id}`}
            className="min-w-[150px] rounded-lg border border-amber-100 bg-white px-3 py-2 text-xs font-semibold text-[#231F20] hover:border-[#D2BB8A]"
          >
            <span className="line-clamp-2">{formatProductTitle(product.name)}</span>
            <span className="mt-1 block text-[#5D082A]">{formatPrice(product.promotionalPrice || product.price)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
