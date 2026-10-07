import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { couponsAPI, customersAPI } from '../services/api'
import type { Product } from '../types'
import { useProductRecommendations, useRebuyRecommendations, useSmartSubstitutes } from '../hooks/useCart'
import { NEAR_EXPIRY_NOTE, useHomeVitrines, useNearExpiryProductIds, useTopSellingProducts } from '../hooks/useCMS'
import { StoreProductCard } from '../components/StoreProductCard'
import { ProductShelf } from '../components/ProductShelf'
import { productPath } from '../utils/productUrl'
import { formatPrice, formatProductTitle, stripEmoji } from '../utils/format'
import { ProductImagePlaceholder } from '../components/ProductImagePlaceholder'
import { getProductLineTotal, getProductPricePresentation, getProductPromoSavings, formatProductQuantity } from '../utils/productPricing'
import { getProductCardViewModel } from '../utils/productCard'
import { fractionNote } from '../utils/productDetailSchema'
import { iconForCarrossel } from '../utils/homeCategories'
import { AlertTriangle, ArrowLeft, ChevronDown, Info, MapPin, Minus, Plus, RefreshCw, ShoppingCart, Sparkles, Star, Store, Ticket, Trash2, Truck } from 'lucide-react'
import { FreeShippingBar } from '../components/FreeShippingBar'
import { useKnownZoneFreeAbove } from '../hooks/useKnownZoneFreeAbove'
import { useDeliveryVerificationModal } from '../contexts/DeliveryVerificationModalContext'
import { readDeliveryVerification, subscribeDeliveryVerification } from '../services/deliveryVerification'
import { Button, buttonVariants } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useDeliveryOperation, useSaleWeekday } from '../hooks/useDeliveryOperation'
import { cn } from '../lib/cn'
import type { CartItem } from '../contexts/CartContext'

// Carrinho refeito em 07/10/2026 (revisao de UI/UX do storefront, padrao dos
// apps lideres de supermercado, celular primeiro):
// - ao abrir, confere preco e disponibilidade de cada item (a copia guardada
//   no aparelho nunca era atualizada: preco novo e produto tirado do site so
//   apareciam no checkout, como erro);
// - item indisponivel: aviso no topo, fora do total, com substitutos e um
//   botao que tira e segue para o checkout;
// - itens compactos ("-" no 1 vira lixeira, pesavel em kg), "se faltar,
//   trocar" em cada um (decisao do cliente que o separador ve);
// - frete gratis e prazo no topo, "Aproveite e leve" antes do resumo, cupom
//   recolhido, "Limpar carrinho" com confirmacao.

type Line = { item: CartItem; product: Product; unavailable: boolean; reason: string }

export default function Cart() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const zoneFreeAbove = useKnownZoneFreeAbove()
  const saleWeekday = useSaleWeekday()
  const delivery = useDeliveryOperation()
  const { openModal: openDeliveryModal } = useDeliveryVerificationModal()
  const { cart, removeItem, updateQuantity, updateAllowSubstitution, clear, discount, couponCode, applyCoupon, removeCoupon, refreshProducts } = useCart()
  const nearExpiryIds = useNearExpiryProductIds()

  // Confere preco e disponibilidade ao abrir.
  const [priceChanges, setPriceChanges] = useState<Array<{ name: string; before: number; after: number }>>([])
  const [refreshing, setRefreshing] = useState(true)
  useEffect(() => {
    let alive = true
    refreshProducts()
      .then((changes) => alive && setPriceChanges(changes))
      .catch(() => null)
      .finally(() => alive && setRefreshing(false))
    return () => {
      alive = false
    }
    // So ao abrir a pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // JON-183: fidelidade Mercafacil do cliente logado (CPF ja cadastrado).
  const { data: fidelidade } = useQuery({
    queryKey: ['fidelidade', user?.id],
    queryFn: () => customersAPI.getFidelidade(user!.id).then((r) => r.data),
    enabled: Boolean(user?.id),
    staleTime: 1000 * 60 * 10,
  })

  const lines: Line[] = useMemo(
    () =>
      cart
        .filter((item) => item.product)
        .map((item) => {
          const vm = getProductCardViewModel(item.product, saleWeekday)
          return {
            item,
            product: item.product,
            unavailable: vm.outOfStock,
            reason: vm.offDay ? `Vendido só ${vm.saleDaysText}` : 'Indisponível no momento',
          }
        }),
    [cart, saleWeekday],
  )
  const available = lines.filter((l) => !l.unavailable)
  const unavailable = lines.filter((l) => l.unavailable)

  // Totais so do que vai no pedido: item indisponivel nao entra.
  const subtotal = available.reduce((sum, l) => sum + getProductLineTotal(l.product, l.item.quantity), 0)
  const promoSavings = available.reduce((sum, l) => sum + getProductPromoSavings(l.product, l.item.quantity), 0)
  const itemsCount = available.reduce((acc, l) => acc + (l.product.isFractional ? 1 : l.item.quantity), 0)

  // Endereco/taxa verificados no site (modal de entrega). O freeAbove da zona
  // e reaplicado ao subtotal ATUAL (achado em 25/09/2026: Chafariz, R$ 6 com
  // freeAbove R$ 80, carrinho de R$ 263 cobrando R$ 6).
  const [deliveryVerification, setDeliveryVerification] = useState(() => readDeliveryVerification())
  useEffect(() => subscribeDeliveryVerification(() => setDeliveryVerification(readDeliveryVerification())), [])
  const calc = deliveryVerification?.calc
  const place = calc?.locality || calc?.zoneName || deliveryVerification?.address?.neighborhood
  const verifiedDeliveryFee =
    calc && !calc.outOfArea && !calc.requiresLocalitySelection
      ? calc.freeAbove != null && subtotal >= calc.freeAbove ? 0 : calc.fee
      : null
  const totalAfterDiscount = Math.max(0, subtotal - discount)
  const totalWithDelivery = totalAfterDiscount + (verifiedDeliveryFee ?? 0)

  // Sugestoes: compre junto do 1o item + mais vendidos; sem eles, as vitrines da Home.
  const anchorProductId = available[0]?.item.productId || cart[0]?.productId || ''
  const { data: contextual = [] } = useProductRecommendations(anchorProductId, 10)
  const { data: topSelling = [] } = useTopSellingProducts(10)
  const { data: vitrines } = useHomeVitrines()
  const { data: rebuy = [] } = useRebuyRecommendations(user?.id, 12)
  const inCart = new Set(cart.map((i) => i.productId))
  const suggestions = [...contextual, ...topSelling.map((t) => t.product)]
    .filter((p): p is Product => Boolean(p?.id))
    .filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i && !inCart.has(p.id))
    .slice(0, 12)

  // Cupom
  const [couponOpen, setCouponOpen] = useState(Boolean(couponCode))
  const [couponInput, setCouponInput] = useState(couponCode || '')
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null)
  const [couponRemaining, setCouponRemaining] = useState<{ remaining: number; maxUses: number } | null>(null)
  useEffect(() => {
    setCouponInput(couponCode || '')
    if (couponCode) setCouponOpen(true)
  }, [couponCode])
  // Contador de escassez ("restam X de Y") -- so pra cupom com maxUses.
  useEffect(() => {
    const code = couponInput.trim()
    if (code.length < 3) {
      setCouponRemaining(null)
      return
    }
    const timer = setTimeout(() => {
      couponsAPI
        .availability(code)
        .then(({ data }) => setCouponRemaining(data.maxUses != null ? { remaining: data.remaining ?? 0, maxUses: data.maxUses } : null))
        .catch(() => setCouponRemaining(null))
    }, 400)
    return () => clearTimeout(timer)
  }, [couponInput])
  const handleApplyCoupon = async () => {
    const result = await applyCoupon(couponInput)
    setCouponFeedback(result.message)
  }
  // JON-176: /cart?coupon=CODIGO (popup da Home) aplica o cupom uma vez.
  const [searchParams] = useSearchParams()
  const appliedFromUrlRef = useState(() => ({ done: false }))[0]
  useEffect(() => {
    const codeFromUrl = searchParams.get('coupon')?.trim()
    if (!codeFromUrl || appliedFromUrlRef.done || couponCode) return
    appliedFromUrlRef.done = true
    setCouponOpen(true)
    setCouponInput(codeFromUrl.toUpperCase())
    applyCoupon(codeFromUrl).then((result) => setCouponFeedback(result.message))
  }, [searchParams, couponCode, applyCoupon, appliedFromUrlRef])

  const [confirmClear, setConfirmClear] = useState(false)

  const goCheckout = () => {
    unavailable.forEach((l) => removeItem(l.item.productId))
    navigate('/checkout')
  }
  const checkoutLabel = unavailable.length > 0 ? 'Tirar indisponíveis e fechar pedido' : 'Fechar pedido'

  const emptyShelves = useMemo(() => {
    if (rebuy.length > 0) return [{ key: 'rebuy', title: 'Compre de novo', icon: ShoppingCart, products: rebuy, to: '/account' }]
    if (topSelling.length >= 4) return [{ key: 'top', title: 'Mais pedidos', icon: Sparkles, products: topSelling.map((t) => t.product), to: '/mercado' }]
    return (vitrines?.carrosseis || []).slice(0, 2).map((c) => ({ key: c.id, title: stripEmoji(c.titulo), icon: iconForCarrossel(c.id), products: c.produtos.slice(0, 12), to: c.linkVerTudo || '/mercado' }))
  }, [rebuy, topSelling, vitrines])

  return (
    <div className="min-h-screen bg-[#FBFAF7]">
      <header className="sticky top-0 z-50 border-b border-[#E8D7B0]/60 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-2 py-2 sm:px-4">
          <button type="button" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))} aria-label="Voltar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
            <ArrowLeft size={22} />
          </button>
          <h1 className="flex flex-1 items-baseline gap-2 text-lg font-bold text-[#231F20]">
            Carrinho
            {cart.length > 0 && <span className="text-sm font-medium text-gray-500">{itemsCount} {itemsCount === 1 ? 'item' : 'itens'}</span>}
          </h1>
          {user && <NotificationBell />}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-44 pt-4 lg:pb-12">
        {cart.length === 0 ? (
          <div className="space-y-8">
            <div className="rounded-3xl border border-[#E8D7B0]/70 bg-white px-6 py-10 text-center">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F8F2E6] text-[#5D082A]">
                <ShoppingCart size={28} />
              </span>
              <p className="text-lg font-bold text-[#231F20]">Seu carrinho está vazio</p>
              <p className="mt-1 text-sm text-[#5d4f33]">Escolha os produtos e monte seu pedido. Entregamos ou você retira na loja.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link to="/promocoes" className={buttonVariants({ size: 'md', className: 'rounded-full px-5' })}>Ver ofertas</Link>
                <Link to="/mercado" className={buttonVariants({ variant: 'outline', size: 'md', className: 'rounded-full px-5' })}>Ir ao mercado</Link>
              </div>
            </div>
            {emptyShelves.map((s) => (
              <ProductShelf key={s.key} title={s.title} icon={s.icon} products={s.products} to={s.to} linkLabel="Ver mais" shelf={`carrinho-vazio:${s.key}`} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px] lg:gap-8">
            <div className="min-w-0 space-y-4">
              {/* Prazo, frete e frete gratis: o que decide fechar agora. */}
              <section className="space-y-3 rounded-2xl border border-[#E8D7B0]/70 bg-white p-4">
                <div className="flex gap-3 text-sm">
                  <Truck size={20} className="mt-0.5 shrink-0 text-[#5D082A]" />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#231F20]">{delivery.message}</p>
                    <p className="text-[#5d4f33]">
                      {!calc ? (
                        <>
                          <button type="button" onClick={() => openDeliveryModal()} className="font-semibold text-[#5D082A] underline underline-offset-2">Informe seu CEP</button> e veja o frete
                        </>
                      ) : calc.outOfArea ? (
                        <>Ainda não entregamos {place ? `em ${place}` : 'no seu endereço'}, mas você pode retirar na loja · <button type="button" onClick={() => openDeliveryModal()} className="font-semibold text-[#5D082A] underline underline-offset-2">trocar</button></>
                      ) : (
                        <>
                          {verifiedDeliveryFee ? `Frete ${formatPrice(verifiedDeliveryFee)}` : 'Frete grátis'}{place ? ` em ${place}` : ''} · <button type="button" onClick={() => openDeliveryModal()} className="font-semibold text-[#5D082A] underline underline-offset-2">trocar</button>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <FreeShippingBar subtotal={subtotal} zoneFreeAbove={zoneFreeAbove} />
              </section>

              {unavailable.length > 0 && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                    <AlertTriangle size={17} />
                    {unavailable.length === 1 ? '1 item não está disponível agora' : `${unavailable.length} itens não estão disponíveis agora`}
                  </p>
                  <p className="mt-1 text-xs text-amber-900/80">Ele fica fora do total. Troque por um parecido ou tire do carrinho.</p>
                  <button
                    type="button"
                    onClick={() => unavailable.forEach((l) => removeItem(l.item.productId))}
                    className="mt-3 h-9 rounded-full border border-amber-300 bg-white px-4 text-xs font-bold text-amber-900"
                  >
                    Tirar {unavailable.length === 1 ? 'o item indisponível' : 'os indisponíveis'}
                  </button>
                </section>
              )}

              {priceChanges.length > 0 && (
                <section className="flex gap-2.5 rounded-2xl border border-[#E8D7B0] bg-white p-3.5 text-xs text-[#5d4f33]">
                  <RefreshCw size={16} className="mt-0.5 shrink-0 text-[#5D082A]" />
                  <div>
                    <p className="font-semibold text-[#231F20]">
                      {priceChanges.length === 1 ? 'O preço de 1 item mudou' : `O preço de ${priceChanges.length} itens mudou`} desde que você o colocou no carrinho
                    </p>
                    {priceChanges.slice(0, 3).map((c) => (
                      <p key={c.name} className="mt-0.5">
                        {formatProductTitle(c.name)}: <span className="line-through">{formatPrice(c.before)}</span> → <strong>{formatPrice(c.after)}</strong>
                      </p>
                    ))}
                  </div>
                </section>
              )}

              <section className="overflow-hidden rounded-2xl border border-[#E8D7B0]/70 bg-white">
                <p className="flex items-start gap-2 border-b border-[#EFE6D2] bg-[#FBF7F0] px-4 py-2.5 text-xs text-[#5d4f33]">
                  <Info size={14} className="mt-0.5 shrink-0 text-[#8a6a3a]" />
                  Se algum item faltar, a equipe troca por um parecido e confirma com você antes de fechar. Desmarque onde não quiser troca.
                </p>
                <ul className="divide-y divide-[#EFE6D2]">
                  {[...available, ...unavailable].map((line) => (
                    <CartLine
                      key={line.item.productId}
                      line={line}
                      nearExpiry={nearExpiryIds.has(line.item.productId)}
                      refreshing={refreshing}
                      onRemove={() => removeItem(line.item.productId)}
                      onQuantity={(q) => updateQuantity(line.item.productId, q)}
                      onSubstitution={(v) => updateAllowSubstitution(line.item.productId, v)}
                    />
                  ))}
                </ul>
                <div className="flex justify-end border-t border-[#EFE6D2] px-4 py-2.5">
                  {confirmClear ? (
                    <span className="flex items-center gap-3 text-xs">
                      <span className="text-[#5d4f33]">Tirar tudo do carrinho?</span>
                      <button type="button" onClick={() => setConfirmClear(false)} className="font-semibold text-gray-500">Cancelar</button>
                      <button type="button" onClick={() => { clear(); setConfirmClear(false) }} className="font-bold text-red-600">Limpar</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmClear(true)} className="text-xs font-semibold text-gray-500 hover:text-red-600">
                      Limpar carrinho
                    </button>
                  )}
                </div>
              </section>

              {/* Impulso: antes do resumo, onde o cliente ainda esta montando o pedido. */}
              {suggestions.length > 0 && (
                <ProductShelf title="Aproveite e leve" icon={Sparkles} products={suggestions} to="/mercado" linkLabel="Ver mais" shelf="carrinho" />
              )}
            </div>

            <aside className="h-fit lg:sticky lg:top-20">
              <section className="rounded-2xl border border-[#E8D7B0]/70 bg-white p-5">
                <h2 className="mb-3 text-base font-bold text-[#231F20]">Resumo</h2>

                <div className="mb-4 rounded-xl border border-[#EFE6D2] bg-[#FBF7F0]">
                  <button
                    type="button"
                    onClick={() => setCouponOpen((v) => !v)}
                    aria-expanded={couponOpen}
                    className="flex min-h-[44px] w-full items-center justify-between px-3 text-sm font-semibold text-[#231F20]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Ticket size={16} className="text-[#5D082A]" />
                      {couponCode ? `Cupom ${couponCode}` : 'Tem cupom de desconto?'}
                    </span>
                    <ChevronDown size={16} className={cn('text-[#8a6a3a] transition-transform', couponOpen && 'rotate-180')} />
                  </button>
                  {couponOpen && (
                    <div className="space-y-2 px-3 pb-3">
                      <div className="flex gap-2">
                        <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Digite o cupom" className="flex-1" />
                        <Button onClick={handleApplyCoupon} size="md" className="px-4 text-xs">Aplicar</Button>
                      </div>
                      {couponCode && (
                        <div className="flex items-center justify-between text-xs text-[#5D082A]">
                          <span>Cupom ativo: {couponCode}</span>
                          <button type="button" onClick={removeCoupon} className="font-semibold hover:underline">Remover</button>
                        </div>
                      )}
                      {couponRemaining && (
                        <p className={cn('text-xs font-semibold', couponRemaining.remaining <= 0 ? 'text-red-600' : 'text-[#B8860B]')}>
                          {couponRemaining.remaining <= 0 ? 'Esgotado: todos os cupons já foram usados.' : `⚡ Restam ${couponRemaining.remaining} de ${couponRemaining.maxUses} cupons!`}
                        </p>
                      )}
                      {couponFeedback && <p className="text-xs text-[#5d4f33]">{couponFeedback}</p>}
                    </div>
                  )}
                </div>

                {fidelidade?.clubeFidelidade && (
                  <p className="mb-4 flex items-center gap-1.5 rounded-xl border border-[#E8D7B0] bg-[#F8F0DC] px-3 py-2 text-xs font-semibold text-[#5D082A]">
                    <Star size={14} className="fill-[#D2BB8A] text-[#D2BB8A]" />
                    Você é Cliente Clube Antenor{fidelidade.categoria?.descricao ? ` (${fidelidade.categoria.descricao})` : ''}!
                  </p>
                )}

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <dt>Produtos ({itemsCount})</dt>
                    <dd>{formatPrice(subtotal + promoSavings)}</dd>
                  </div>
                  {promoSavings + discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <dt>Descontos</dt>
                      <dd>-{formatPrice(promoSavings + discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <dt>Entrega</dt>
                    <dd>
                      {verifiedDeliveryFee != null ? (
                        <span className={verifiedDeliveryFee === 0 ? 'font-semibold text-emerald-700' : ''}>{verifiedDeliveryFee === 0 ? 'Grátis' : formatPrice(verifiedDeliveryFee)}</span>
                      ) : (
                        <button type="button" onClick={() => openDeliveryModal()} className="inline-flex items-center gap-1 font-semibold text-[#5D082A] hover:underline">
                          <MapPin size={13} /> Informar endereço
                        </button>
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-end justify-between border-t border-[#EFE6D2] pt-3">
                  <span className="text-base font-semibold text-[#231F20]">Total</span>
                  <span className="text-3xl font-black text-[#5D082A]">{formatPrice(totalWithDelivery)}</span>
                </div>
                {verifiedDeliveryFee == null && <p className="mt-1 text-xs text-gray-500">Sem o frete: informe o endereço para ver o total final.</p>}
                <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                  <Store size={13} /> Ou retire na loja sem custo. Você paga na entrega ou na retirada.
                </p>

                <button type="button" onClick={goCheckout} className={buttonVariants({ size: 'lg', className: 'mt-4 hidden w-full rounded-xl lg:flex' })} disabled={available.length === 0}>
                  {checkoutLabel}
                </button>
              </section>
            </aside>
          </div>
        )}
      </main>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[var(--mobile-nav-height,4rem)] z-50 border-t border-[#D2BB8A]/40 bg-white/95 px-4 py-2.5 shadow-[0_-8px_30px_rgba(35,31,32,0.12)] backdrop-blur md:bottom-0 lg:hidden">
          <button
            type="button"
            onClick={goCheckout}
            disabled={available.length === 0}
            className={buttonVariants({ size: 'lg', className: 'flex h-14 w-full items-center justify-between rounded-xl px-4 shadow-lg' })}
          >
            <span className="text-left text-sm font-bold leading-tight">{checkoutLabel}</span>
            <span className="text-base font-black">{formatPrice(totalWithDelivery)}</span>
          </button>
        </div>
      )}
      <MobileBottomNav />
    </div>
  )
}

function CartLine({
  line,
  nearExpiry,
  refreshing,
  onRemove,
  onQuantity,
  onSubstitution,
}: {
  line: Line
  nearExpiry: boolean
  refreshing: boolean
  onRemove: () => void
  onQuantity: (quantity: number) => void
  onSubstitution: (allow: boolean) => void
}) {
  const { item, product, unavailable, reason } = line
  const price = getProductPricePresentation(product)
  const lineTotal = getProductLineTotal(product, item.quantity)
  const savings = getProductPromoSavings(product, item.quantity)
  const title = formatProductTitle(product.name)
  const note = product.isFractional ? fractionNote(product.alternativeDescription) : ''
  const lowStock = !unavailable && product.syncOption === 'ESTOQUE' && typeof product.stock === 'number' && product.stock > 0 && product.stock <= 3
  const [imgError, setImgError] = useState(false)

  return (
    <li className={cn('px-4 py-3.5', unavailable && 'bg-gray-50')}>
      <div className="flex gap-3">
        <Link to={productPath(product)} className={cn('flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#EFE6D2] bg-white', unavailable && 'opacity-50')}>
          {product.ean && !imgError ? (
            <img src={`/thumbs/products/${product.ean}.webp?v=3`} alt="" className="h-full w-full object-contain p-1" loading="lazy" onError={() => setImgError(true)} />
          ) : (
            <ProductImagePlaceholder size="sm" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link to={productPath(product)} className={cn('line-clamp-2 text-sm font-medium leading-snug text-[#231F20]', unavailable && 'text-gray-500')}>
              {title}
            </Link>
            {!unavailable && (
              <span className="shrink-0 text-right">
                <span className="block text-sm font-bold text-[#231F20]">{formatPrice(lineTotal)}</span>
                {savings > 0 && <span className="block text-[11px] font-semibold text-emerald-700">-{formatPrice(savings)}</span>}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {price.fullLabel}
            {price.referenceText ? ` · ${price.referenceText}` : ''}
            {note ? ` · ${note}` : ''}
          </p>
          {nearExpiry && <p className="text-[11px] text-gray-500">{NEAR_EXPIRY_NOTE}</p>}
          {unavailable && !refreshing && <p className="mt-1 text-xs font-bold text-amber-800">{reason}</p>}
          {lowStock && <p className="mt-1 text-[11px] font-semibold text-amber-700">Últimas unidades</p>}

          {!unavailable ? (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex h-10 items-center rounded-full border border-[#E8D7B0] bg-white">
                <button
                  type="button"
                  onClick={() => (item.quantity > 1 ? onQuantity(item.quantity - 1) : onRemove())}
                  aria-label={item.quantity > 1 ? 'Diminuir quantidade' : `Tirar ${title} do carrinho`}
                  className="flex h-10 w-10 items-center justify-center text-[#5D082A] active:scale-90"
                >
                  {item.quantity > 1 ? <Minus size={16} strokeWidth={2.6} /> : <Trash2 size={16} />}
                </button>
                <span className="min-w-[56px] text-center text-sm font-black tabular-nums text-[#231F20]">
                  {product.isFractional ? formatProductQuantity(product, item.quantity) : `${item.quantity} un`}
                </span>
                <button type="button" onClick={() => onQuantity(item.quantity + 1)} aria-label="Aumentar quantidade" className="flex h-10 w-10 items-center justify-center text-[#5D082A] active:scale-90">
                  <Plus size={16} strokeWidth={2.6} />
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[#5d4f33]">
                <input
                  type="checkbox"
                  checked={item.allowSubstitution !== false}
                  onChange={(e) => onSubstitution(e.target.checked)}
                  className="h-4 w-4 accent-[#5D082A]"
                  aria-label={`Aceitar troca de ${title} se faltar`}
                />
                Se faltar, trocar
              </label>
            </div>
          ) : (
            <div className="mt-2">
              <button type="button" onClick={onRemove} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700">
                <Trash2 size={14} /> Tirar do carrinho
              </button>
            </div>
          )}
        </div>
      </div>
      {unavailable && !refreshing && <UnavailableSubstitutes productId={item.productId} />}
    </li>
  )
}

/** Indisponivel: o que da para levar no lugar, com o "+" do card. */
function UnavailableSubstitutes({ productId }: { productId: string }) {
  const { data: substitutes = [] } = useSmartSubstitutes(productId, 6)
  const visible = substitutes.filter((p) => p.id !== productId && !getProductCardViewModel(p).outOfStock).slice(0, 6)
  if (visible.length === 0) return null
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold text-[#5d4f33]">Leve no lugar:</p>
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
        {visible.map((p) => (
          <StoreProductCard key={p.id} product={p} source="SEARCH" variant="carousel" analyticsMeta={{ shelf: 'carrinho-substituto' }} />
        ))}
      </div>
    </div>
  )
}
