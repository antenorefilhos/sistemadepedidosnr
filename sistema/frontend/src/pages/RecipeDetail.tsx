import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChefHat, ChevronDown, Clock, Lightbulb, Loader2, Minus, Plus, Share2, ShoppingBasket, Users, Wine } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRecipe, useRecipes } from '../hooks/useRecipes'
import { useCart } from '../hooks/useCart'
import { useSaleWeekday } from '../hooks/useDeliveryOperation'
import { useFreeShipping } from '../hooks/useFreeShipping'
import { useKnownZoneFreeAbove } from '../hooks/useKnownZoneFreeAbove'
import { PageTopBar } from '../components/PageTopBar'
import { RecipeCard } from '../components/RecipeShelf'
import { ProductImagePlaceholder } from '../components/ProductImagePlaceholder'
import { SEO, StructuredData } from '../components/SEO'
import { buttonVariants } from '../components/ui/button'
import { formatPrice, formatProductTitle } from '../utils/format'
import { formatProductQuantity, getProductPricePresentation } from '../utils/productPricing'
import { getProductCardViewModel } from '../utils/productCard'
import { productPath } from '../utils/productUrl'
import { trackEvent } from '../utils/analytics'
import { DIFFICULTY_LABEL, formatDuration, ingredientAmount, recipeProductRole, splitSteps, type RecipeProductRole } from '../utils/recipe'
import { cn } from '../lib/cn'
import type { Product, Recipe } from '../types'
import { sizedImageUrl } from '../utils/imageUrl'

// Pagina da receita refeita em 07/10/2026 (revisao de UI/UX do storefront,
// celular primeiro, padrao "comprar a receita" dos apps de supermercado):
// - a lista de compra vem logo depois da descricao (no celular ficava no fim
//   da pagina, depois das receitas relacionadas), ja marcada, com o total, e
//   "desmarque o que ja tem em casa" -- um toque poe tudo no carrinho;
// - barra fixa embaixo com quantos itens e quanto, como na pagina do produto;
// - vinho "para harmonizar" e item "opcional" chegam desmarcados (o Catena de
//   R$ 229,90 nao entra no total sem o cliente pedir);
// - "Dica:" e "Harmonizacao:" saem da numeracao do preparo e viram quadros;
// - ingrediente "a gosto" deixou de perder o "a gosto".

const IMAGE_VERSION = '3'

function ProductThumb({ product, className }: { product: Product; className?: string }) {
  const candidates = useMemo(
    () => [`/thumbs/products/${product.ean}.webp`, `/uploads/products/${product.ean}.webp`, `/uploads/products/${product.ean}.jpg`].map((url) => `${url}?v=${IMAGE_VERSION}`),
    [product.ean],
  )
  const [index, setIndex] = useState(0)
  return (
    <div className={cn('overflow-hidden rounded-xl border border-[#E8D7B0]/60 bg-white', className)}>
      {product.ean && index < candidates.length ? (
        <img src={candidates[index]} alt="" loading="lazy" onError={() => setIndex((i) => i + 1)} className="h-full w-full object-contain p-1" />
      ) : (
        <ProductImagePlaceholder size="sm" />
      )}
    </div>
  )
}

type ShoppingItem = {
  id: string
  product: Product
  note?: string
  role: RecipeProductRole
  price: number
  suffix: string
  originalPrice: number | null
  discountPct: number
  unavailable: string
}

/** Lista de compra da receita: o que esta marcado, o que ja esta no carrinho e o total do que falta por. */
function useRecipeShopping(recipe: Recipe) {
  const { cart, addItem, updateQuantity, removeItem, subtotal, count } = useCart()
  const saleWeekday = useSaleWeekday()
  const items = useMemo<ShoppingItem[]>(
    () =>
      (recipe.products ?? []).map((rp) => {
        const vm = getProductCardViewModel(rp.product, saleWeekday)
        const price = getProductPricePresentation(rp.product)
        return {
          id: rp.productId,
          product: rp.product,
          note: rp.note,
          role: recipeProductRole(rp),
          price: price.displayPrice,
          suffix: rp.product.isFractional ? price.suffix : '',
          originalPrice: vm.originalPrice,
          discountPct: vm.discountPct,
          unavailable: vm.outOfStock ? vm.unavailableLabel || 'Indisponível' : '',
        }
      }),
    [recipe.products, saleWeekday],
  )
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.filter((item) => item.role === 'main' && !item.unavailable).map((item) => item.id)))
  const quantityOf = (id: string) => cart.find((line) => line.productId === id)?.quantity || 0
  const toBuy = items.filter((item) => selected.has(item.id) && !item.unavailable && quantityOf(item.id) === 0)
  const toBuyTotal = toBuy.reduce((sum, item) => sum + item.price, 0)
  const inCartCount = items.filter((item) => quantityOf(item.id) > 0).length

  const track = (product: Product, quantity: number) =>
    trackEvent('ADD_TO_CART', 'PRODUCT', product.id, { name: product.name, price: product.price, quantity, source: 'RECIPE', recipe: recipe.slug })

  return {
    items,
    selected,
    toBuy,
    toBuyTotal,
    inCartCount,
    subtotal,
    count,
    quantityOf,
    toggle(id: string) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    addSelected() {
      if (!toBuy.length) return
      toBuy.forEach((item) => {
        addItem(item.product, 1)
        track(item.product, 1)
      })
      toast.success(`${toBuy.length} ${toBuy.length === 1 ? 'item' : 'itens'} da receita no carrinho`, { id: 'recipe-add', duration: 1800, position: 'top-center' })
    },
    addOne(product: Product) {
      addItem(product, 1)
      track(product, 1)
    },
    decrease(id: string) {
      const quantity = quantityOf(id)
      if (quantity > 1) updateQuantity(id, quantity - 1)
      else removeItem(id)
    },
  }
}
type Shopping = ReturnType<typeof useRecipeShopping>

function Stepper({ shopping, item }: { shopping: Shopping; item: ShoppingItem }) {
  const quantity = shopping.quantityOf(item.id)
  return (
    <div className="flex h-9 shrink-0 items-center rounded-full border border-[#5D082A]/25 bg-white text-[#5D082A]">
      <button type="button" onClick={() => shopping.decrease(item.id)} aria-label={`Diminuir ${item.product.name}`} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F8F4EA]">
        <Minus size={15} />
      </button>
      <span className="min-w-[2.75rem] text-center text-xs font-bold tabular-nums">{formatProductQuantity(item.product, quantity)}</span>
      <button type="button" onClick={() => shopping.addOne(item.product)} aria-label={`Aumentar ${item.product.name}`} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F8F4EA]">
        <Plus size={15} />
      </button>
    </div>
  )
}

function ItemPrice({ item }: { item: ShoppingItem }) {
  return (
    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs">
      <strong className="text-[13px] text-[#231F20]">{formatPrice(item.price)}</strong>
      {item.suffix && <span className="text-[#8a6a3a]">{item.suffix}</span>}
      {item.originalPrice && item.discountPct >= 1 && (
        <>
          <s className="text-[#9ca3af]">{formatPrice(item.originalPrice)}</s>
          <span className="rounded bg-[#5D082A] px-1 py-px text-[10px] font-bold text-white">-{item.discountPct}%</span>
        </>
      )}
    </p>
  )
}

function ShoppingRow({ shopping, item }: { shopping: Shopping; item: ShoppingItem }) {
  const inCart = shopping.quantityOf(item.id) > 0
  const checked = shopping.selected.has(item.id)
  const title = formatProductTitle(item.product.name)
  return (
    <li className="flex items-center gap-2.5 py-2.5">
      <Link to={productPath(item.product)} aria-label={`Ver ${title}`} className="shrink-0">
        <ProductThumb product={item.product} className="h-14 w-14" />
      </Link>
      <button
        type="button"
        role="checkbox"
        aria-checked={inCart || checked}
        disabled={inCart || Boolean(item.unavailable)}
        onClick={() => shopping.toggle(item.id)}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default"
      >
        <span className="min-w-0 flex-1">
          <span className={cn('line-clamp-2 text-[13px] font-semibold leading-snug', item.unavailable ? 'text-[#9ca3af]' : 'text-[#231F20]')}>{title}</span>
          {item.note && <span className="block text-[11px] text-[#8A6A3A]">{item.note}</span>}
          {item.unavailable ? <span className="mt-0.5 block text-xs font-semibold text-[#9ca3af]">{item.unavailable}</span> : <ItemPrice item={item} />}
        </span>
        {!inCart && !item.unavailable && (
          <span
            aria-hidden="true"
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
              checked ? 'border-[#5D082A] bg-[#5D082A] text-white' : 'border-[#D2BB8A] bg-white',
            )}
          >
            {checked && <Check size={15} strokeWidth={3} />}
          </span>
        )}
      </button>
      {inCart && <Stepper shopping={shopping} item={item} />}
    </li>
  )
}

const GROUPS: Array<[RecipeProductRole, string]> = [
  ['main', ''],
  ['optional', 'Opcional'],
  ['pairing', 'Para harmonizar'],
]

/** Caixa "Ingredientes na loja": no celular entra no meio da pagina, no computador fica fixa na coluna. */
function ShoppingCard({ shopping, collapsible, id }: { shopping: Shopping; collapsible: boolean; id?: string }) {
  const [expanded, setExpanded] = useState(false)
  const ordered = GROUPS.flatMap(([role]) => shopping.items.filter((item) => item.role === role))
  const limit = 5
  const hidden = collapsible && !expanded ? Math.max(0, ordered.length - limit) : 0
  const visible = new Set(ordered.slice(0, ordered.length - hidden).map((item) => item.id))
  const allInCart = shopping.items.length > 0 && shopping.toBuy.length === 0 && shopping.inCartCount > 0

  if (!shopping.items.length) return null
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-[#E8D7B0] bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.05)]">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8F4EA] text-[#5D082A]">
          <ShoppingBasket size={18} />
        </span>
        <div>
          <h2 className="text-base font-bold text-[#231F20]">Ingredientes na loja</h2>
          <p className="text-xs text-[#5d4f33]">Desmarque o que você já tem em casa.</p>
        </div>
      </div>

      <div className="mt-2 lg:max-h-[46vh] lg:overflow-y-auto lg:pr-1">
        {GROUPS.map(([role, label]) => {
          const group = shopping.items.filter((item) => item.role === role && visible.has(item.id))
          if (!group.length) return null
          return (
            <div key={role}>
              {label && <p className="mt-2 border-t border-[#E8D7B0]/60 pt-3 text-[11px] font-bold uppercase tracking-wide text-[#8A6A3A]">{label}</p>}
              <ul className="divide-y divide-[#E8D7B0]/50">
                {group.map((item) => (
                  <ShoppingRow key={item.id} shopping={shopping} item={item} />
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="mt-1 flex h-10 w-full items-center justify-center gap-1 rounded-xl text-sm font-bold text-[#5D082A] hover:bg-[#F8F4EA]">
          Ver mais {hidden} {hidden === 1 ? 'ingrediente' : 'ingredientes'} <ChevronDown size={16} />
        </button>
      )}

      <div className="mt-3">
        {allInCart ? (
          <Link to="/carrinho" className={buttonVariants({ variant: 'outline', className: 'h-12 w-full rounded-xl text-[15px]' })}>
            <Check size={18} /> Ingredientes no carrinho · Ver carrinho
          </Link>
        ) : (
          <button
            type="button"
            onClick={shopping.addSelected}
            disabled={!shopping.toBuy.length}
            className={buttonVariants({ variant: 'primary', className: 'h-12 w-full rounded-xl text-[15px] disabled:opacity-50' })}
          >
            {shopping.toBuy.length
              ? `Colocar ${shopping.toBuy.length} ${shopping.toBuy.length === 1 ? 'item' : 'itens'} · ${formatPrice(shopping.toBuyTotal)}`
              : 'Marque o que quer levar'}
          </button>
        )}
        {shopping.items.some((item) => item.product.isFractional) && (
          <p className="mt-2 text-center text-[11px] text-[#8a6a3a]">Item por peso entra com uma porção; ajuste no carrinho.</p>
        )}
      </div>
    </section>
  )
}

/**
 * Barra fixa do celular (a pagina nao tem o menu de baixo, como a do produto):
 * o que falta por no carrinho e quanto; depois de por, o caminho do carrinho.
 */
function MobileRecipeBar({ shopping }: { shopping: Shopping }) {
  const zoneFreeAbove = useKnownZoneFreeAbove()
  const freeShipping = useFreeShipping(shopping.subtotal, zoneFreeAbove)
  const showFreeShipping = shopping.count > 0 && freeShipping.enabled && !freeShipping.achieved
  if (!shopping.items.length && shopping.count === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8D7B0] bg-white/95 shadow-[0_-8px_30px_rgba(35,31,32,0.12)] backdrop-blur lg:hidden">
      {showFreeShipping && (
        <div className="border-b border-[#E8D7B0]/70 bg-[#FDF8F0] px-4 py-1.5">
          <p className="text-[11px] font-medium text-[#5d4f33]">
            Faltam <strong className="text-[#5D082A]">{formatPrice(freeShipping.remaining)}</strong> para frete grátis
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#E8D7B0]/70">
            <div className="h-full rounded-full bg-[#5D082A] transition-all duration-500" style={{ width: `${freeShipping.pct}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5">
        {shopping.toBuy.length > 0 ? (
          <>
            <div className="min-w-0 flex-1 pl-1">
              <p className="text-[11px] text-[#5d4f33]">{shopping.toBuy.length} {shopping.toBuy.length === 1 ? 'ingrediente marcado' : 'ingredientes marcados'}</p>
              <p className="text-lg font-bold leading-tight text-[#231F20]">{formatPrice(shopping.toBuyTotal)}</p>
            </div>
            <button type="button" onClick={shopping.addSelected} className={buttonVariants({ variant: 'primary', className: 'h-11 rounded-xl px-5' })}>
              <Plus size={18} /> Colocar no carrinho
            </button>
          </>
        ) : shopping.count > 0 ? (
          <Link to="/carrinho" className={buttonVariants({ variant: 'primary', className: 'h-11 w-full rounded-xl' })}>
            Ver carrinho · {shopping.count} {shopping.count === 1 ? 'item' : 'itens'} · {formatPrice(shopping.subtotal)}
          </Link>
        ) : (
          <a href="#comprar" className={buttonVariants({ variant: 'primary', className: 'h-11 w-full rounded-xl' })}>
            Escolher ingredientes
          </a>
        )}
      </div>
    </div>
  )
}

function MetaChips({ recipe }: { recipe: Recipe }) {
  const chips = [
    recipe.prepTime ? { icon: Clock, text: formatDuration(recipe.prepTime) } : null,
    recipe.servings ? { icon: Users, text: `${recipe.servings} porções` } : null,
    recipe.difficulty ? { icon: ChefHat, text: DIFFICULTY_LABEL[recipe.difficulty] ?? recipe.difficulty } : null,
  ].filter(Boolean) as Array<{ icon: typeof Clock; text: string }>
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(({ icon: Icon, text }) => (
        <span key={text} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#F8F4EA] px-3 text-xs font-semibold text-[#5d4f33]">
          <Icon size={14} className="text-[#8A6A3A]" aria-hidden="true" /> {text}
        </span>
      ))}
    </div>
  )
}

/** Lista do cadastro; um toque risca o que ja separou (fica so nesta tela). */
function IngredientList({ recipe }: { recipe: Recipe }) {
  const [done, setDone] = useState<Set<string>>(new Set())
  if (!recipe.ingredients?.length) return null
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-[#231F20]">Ingredientes</h2>
        {recipe.servings ? <span className="text-xs text-[#8A6A3A]">para {recipe.servings} porções</span> : null}
      </div>
      <p className="mt-0.5 text-xs text-[#8a6a3a]">Toque para riscar o que já separou.</p>
      <ul className="mt-3 divide-y divide-[#E8D7B0]/50 rounded-2xl border border-[#E8D7B0]/70 bg-white px-4">
        {recipe.ingredients.map((ingredient) => {
          const checked = done.has(ingredient.id)
          const amount = ingredientAmount(ingredient)
          return (
            <li key={ingredient.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() =>
                  setDone((prev) => {
                    const next = new Set(prev)
                    if (next.has(ingredient.id)) next.delete(ingredient.id)
                    else next.add(ingredient.id)
                    return next
                  })
                }
                className="flex w-full items-start gap-3 py-2.5 text-left text-sm"
              >
                <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[#D2BB8A]')}>
                  {checked && <Check size={12} strokeWidth={3} />}
                </span>
                <span className={cn('leading-snug', checked ? 'text-[#9ca3af] line-through' : 'text-[#231F20]')}>
                  {amount && <strong className="font-semibold">{amount} </strong>}
                  {ingredient.name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PairingProduct({ shopping, product }: { shopping: Shopping; product: Product }) {
  const item = shopping.items.find((entry) => entry.id === product.id)
  if (!item) return null
  const title = formatProductTitle(product.name)
  const inCart = shopping.quantityOf(item.id) > 0
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-white p-2.5">
      <Link to={productPath(product)} aria-label={`Ver ${title}`} className="shrink-0">
        <ProductThumb product={product} className="h-14 w-14" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={productPath(product)} className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#231F20] hover:text-[#5D082A]">{title}</Link>
        {item.unavailable ? <p className="text-xs font-semibold text-[#9ca3af]">{item.unavailable}</p> : <ItemPrice item={item} />}
      </div>
      {!item.unavailable &&
        (inCart ? (
          <Stepper shopping={shopping} item={item} />
        ) : (
          <button type="button" onClick={() => shopping.addOne(product)} aria-label={`Colocar ${title} no carrinho`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5D082A] text-white hover:bg-[#4a0621]">
            <Plus size={18} />
          </button>
        ))}
    </div>
  )
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  const navigate = useNavigate()
  const shopping = useRecipeShopping(recipe)
  const { steps, notes } = useMemo(() => splitSteps(recipe.steps ?? []), [recipe.steps])
  // Vinho do quadro de harmonizacao: o "para harmonizar" e tambem o que vai na panela e na taca ("para cozinhar e para harmonizar").
  const pairingProducts = shopping.items.filter((item) => /harmoniz/i.test(item.note || '')).map((item) => item.product)
  const { data: sameCategory } = useRecipes(recipe.category?.slug, 1, 12)

  // Relacionadas do cadastro primeiro; completa com a mesma categoria.
  const related = useMemo(() => {
    const list = (recipe.relatedTo ?? []).map(({ relatedRecipe }) => relatedRecipe)
    const seen = new Set([recipe.id, ...list.map((r) => r.id)])
    for (const other of sameCategory?.data ?? []) {
      if (list.length >= 8) break
      if (!seen.has(other.id)) {
        list.push(other)
        seen.add(other.id)
      }
    }
    return list
  }, [recipe.id, recipe.relatedTo, sameCategory])

  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/receitas')
  }

  // O cliente chega pelo WhatsApp: compartilhar a receita e o caminho de volta.
  const share = async () => {
    const url = `${window.location.origin}/receitas/${recipe.slug}`
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe.title, url })
      } catch {
        /* cancelado pelo cliente */
      }
      return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${recipe.title} ${url}`)}`, '_blank', 'noopener')
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="min-h-screen bg-[#FBFAF7] pb-40 lg:pb-16">
      <SEO
        title={recipe.seoTitle || recipe.title}
        description={recipe.seoDescription || recipe.description || `Receita de ${recipe.title} com ingredientes selecionados do Mercado Antenor & Filhos.`}
        canonical={`/receitas/${recipe.slug}`}
        type="article"
        image={recipe.imageUrl}
      />
      <StructuredData data={{
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: recipe.title,
        description: recipe.description,
        image: recipe.imageUrl,
        ...(recipe.category ? { recipeCategory: recipe.category.name } : {}),
        ...(recipe.prepTime ? { totalTime: `PT${recipe.prepTime}M` } : {}),
        ...(recipe.servings ? { recipeYield: `${recipe.servings} porções` } : {}),
        author: { '@type': 'Organization', name: 'Antenor & Filhos' },
        recipeIngredient: (recipe.ingredients ?? []).map((ingredient) => [ingredientAmount(ingredient), ingredient.name].filter(Boolean).join(' ')),
        recipeInstructions: steps.map((step, i) => ({ '@type': 'HowToStep', position: i + 1, text: step.content })),
      }} />
      <StructuredData data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Receitas', item: `${origin}/receitas` },
          { '@type': 'ListItem', position: 2, name: recipe.title },
        ],
      }} />

      <PageTopBar
        onBack={goBack}
        title={<span className="truncate text-base">Receita</span>}
        actions={
          <button type="button" onClick={share} aria-label="Compartilhar receita" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
            <Share2 size={20} />
          </button>
        }
      />

      <main className="mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-10 lg:px-4 lg:pt-8">
        <div className="min-w-0">
          {recipe.imageUrl && (
            <div className="aspect-[4/3] overflow-hidden bg-[#F8F4EA] sm:aspect-video lg:rounded-2xl">
              <img src={sizedImageUrl(recipe.imageUrl, 1200) ?? undefined} alt={recipe.title} className="h-full w-full object-cover" />
            </div>
          )}

          <div className={cn('relative space-y-6 bg-[#FBFAF7] px-4 pt-5 lg:px-0', recipe.imageUrl && '-mt-4 rounded-t-3xl lg:mt-0 lg:rounded-none')}>
            <header className="space-y-3">
              {recipe.category && (
                <Link to={`/receitas?categoria=${recipe.category.slug}`} className="text-xs font-bold uppercase tracking-wide text-[#8A6A3A] hover:text-[#5D082A]">
                  {recipe.category.name}
                </Link>
              )}
              <h1 className="text-[26px] font-bold leading-tight text-[#231F20] lg:text-4xl">{recipe.title}</h1>
              <MetaChips recipe={recipe} />
              {recipe.description && <p className="leading-relaxed text-[#5d4f33]">{recipe.description}</p>}
            </header>

            {/* Celular: a compra logo depois da descricao; no computador ela fica na coluna da direita. */}
            <div className="lg:hidden">
              <ShoppingCard shopping={shopping} collapsible id="comprar" />
            </div>

            <IngredientList recipe={recipe} />

            {steps.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-[#231F20]">Modo de preparo</h2>
                <ol className="mt-3 space-y-5">
                  {steps.map((step, i) => (
                    <li key={step.id} className="flex gap-3.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5D082A] text-sm font-bold text-white">{i + 1}</span>
                      <div className="min-w-0 pt-1">
                        <p className="text-[15px] leading-relaxed text-[#231F20]">{step.content}</p>
                        {step.imageUrl && <img src={sizedImageUrl(step.imageUrl, 640) ?? undefined} alt={`Passo ${i + 1}`} className="mt-2 w-full max-w-sm rounded-xl object-cover" loading="lazy" />}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {notes.map((note, i) =>
              note.kind === 'tip' ? (
                <aside key={i} className="flex gap-3 rounded-2xl border border-[#E8D7B0] bg-[#FDF8F0] p-4">
                  <Lightbulb size={20} className="mt-0.5 shrink-0 text-[#8A6A3A]" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold text-[#231F20]">Dica</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-[#5d4f33]">{note.text}</p>
                  </div>
                </aside>
              ) : (
                <aside key={i} className="rounded-2xl bg-[#5D082A]/[0.06] p-4 ring-1 ring-[#5D082A]/15">
                  <div className="flex gap-3">
                    <Wine size={20} className="mt-0.5 shrink-0 text-[#5D082A]" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-[#231F20]">Harmonização</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-[#5d4f33]">{note.text}</p>
                    </div>
                  </div>
                  {pairingProducts.map((product) => (
                    <PairingProduct key={product.id} shopping={shopping} product={product} />
                  ))}
                </aside>
              ),
            )}

            {related.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold text-[#231F20]">Mais receitas</h2>
                <div className="hide-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [overflow-anchor:none] lg:mx-0 lg:scroll-px-0 lg:px-0">
                  {related.map((item) => (
                    <RecipeCard key={item.id} recipe={item} className="w-[62vw] max-w-[240px] lg:w-[240px]" />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <ShoppingCard shopping={shopping} collapsible={false} />
        </aside>
      </main>

      <MobileRecipeBar shopping={shopping} />
    </div>
  )
}

export default function RecipeDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { data: recipe, isLoading, isError } = useRecipe(slug ?? '')

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFAF7]">
        <Loader2 className="animate-spin text-[#5D082A]" size={40} />
      </div>
    )
  }

  if (isError || !recipe) {
    return (
      <div className="min-h-screen bg-[#FBFAF7]">
        <PageTopBar onBack={() => navigate('/receitas')} title={<span className="text-base">Receita</span>} />
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center">
          <ChefHat size={40} className="text-[#D2BB8A]" />
          <p className="font-semibold text-[#231F20]">Esta receita não está mais no ar.</p>
          <Link to="/receitas" className={buttonVariants({ variant: 'primary', className: 'h-11 rounded-xl px-5' })}>
            Ver todas as receitas
          </Link>
        </div>
      </div>
    )
  }

  // key: ao abrir outra receita pelas relacionadas, a lista de compra recomeca marcada.
  return <RecipeView key={recipe.id} recipe={recipe} />
}
