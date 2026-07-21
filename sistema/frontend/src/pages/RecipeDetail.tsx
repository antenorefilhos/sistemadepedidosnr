import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChefHat, Clock, Users, ShoppingCart, Plus, Check, ArrowLeft } from 'lucide-react'
import { useRecipe } from '../hooks/useRecipes'
import { useCart } from '../hooks/useCart'
import { formatPrice, formatProductTitle } from '../utils/format'
import { getProductPricePresentation } from '../utils/productPricing'
import { SEO, StructuredData } from '../components/SEO'
import { Badge } from '../components/ui/badge'
import { Button, buttonVariants } from '../components/ui/button'
import { surfaceClasses } from '../components/ui/surface'
import type { RecipeProduct } from '../types'

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Médio',
  HARD: 'Difícil',
}

function RecipeProductRow({ rp, onAdd }: { rp: RecipeProduct; onAdd: (rp: RecipeProduct) => void }) {
  const { cart } = useCart()
  const inCart = cart.some((item) => item.productId === rp.productId)
  const priceInfo = getProductPricePresentation(rp.product)
  const imageUrl = rp.product?.ean ? `/uploads/products/${rp.product.ean}.webp` : ''

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#E8D7B0]/60 last:border-0">
      <div className="w-12 h-12 rounded-lg border border-[#E8D7B0]/60 bg-[#FBFAF7] overflow-hidden shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={rp.product.name} className="w-full h-full object-contain p-1" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#D2BB8A]">
            <ShoppingCart size={16} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#231F20] line-clamp-1">
          {formatProductTitle(rp.product.name)}
        </p>
        {rp.note && <p className="text-xs text-[#8A6A3A]">{rp.note}</p>}
        <p className="text-xs text-[#5D082A] font-bold">{priceInfo.fullLabel}</p>
      </div>

      <Button
        onClick={() => onAdd(rp)}
        variant={inCart ? 'subtle' : 'primary'}
        size="icon"
        className={inCart ? 'shrink-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-50' : 'shrink-0'}
        aria-label={inCart ? 'Já no carrinho' : `Adicionar ${rp.product.name} ao carrinho`}
      >
        {inCart ? <Check size={16} /> : <Plus size={16} />}
      </Button>
    </div>
  )
}

export default function RecipeDetail() {
  const { slug } = useParams<{ slug: string }>()
  const { data: recipe, isLoading, isError } = useRecipe(slug ?? '')
  const { addItem, cart, total } = useCart()
  const [cartOpen, setCartOpen] = useState(false)

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0)

  const handleAdd = (rp: RecipeProduct) => {
    addItem(rp.product, 1)
  }

  const handleAddAll = () => {
    recipe?.products?.forEach((rp) => {
      if (!cart.some((item) => item.productId === rp.productId)) {
        addItem(rp.product, 1)
      }
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F4EA] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#5D082A] border-t-transparent" />
      </div>
    )
  }

  if (isError || !recipe) {
    return (
      <div className="min-h-screen bg-[#F8F4EA] flex flex-col items-center justify-center gap-4">
        <ChefHat size={40} className="text-[#D2BB8A]" />
        <p className="text-[#231F20] font-semibold">Receita não encontrada.</p>
        <Link to="/receitas" className="text-sm text-[#5D082A] font-bold hover:underline">
          Ver todas as receitas
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F4EA] via-[#FBFAF7] to-white">
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
        ...(recipe.prepTime ? { totalTime: `PT${recipe.prepTime}M` } : {}),
        ...(recipe.servings ? { recipeYield: `${recipe.servings} porções` } : {}),
        author: { '@type': 'Organization', name: 'Antenor & Filhos' },
        recipeIngredient: recipe.ingredients.map(
          (ing) => [ing.quantity, ing.unit, ing.name].filter(Boolean).join(' '),
        ),
        recipeInstructions: recipe.steps.map((step, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          text: step.content,
        })),
      }} />
      <StructuredData data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Receitas', item: `${typeof window !== 'undefined' ? window.location.origin : ''}/receitas` },
          { '@type': 'ListItem', position: 2, name: recipe.title },
        ],
      }} />
      <header className="glass sticky top-0 z-50 border-b border-[#D2BB8A]/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/receitas"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'px-0 hover:bg-transparent' })}
          >
            <ArrowLeft size={16} />
            Receitas
          </Link>

          {cartCount > 0 && (
            <Button
              onClick={() => setCartOpen((prev) => !prev)}
              size="sm"
            >
              <ShoppingCart size={14} />
              {cartCount} {cartCount === 1 ? 'item' : 'itens'} · {formatPrice(total)}
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          {/* Conteúdo principal */}
          <section>
            {recipe.imageUrl && (
              <div className="rounded-lg overflow-hidden mb-6 aspect-video">
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {recipe.category && (
              <Link
                to={`/receitas?categoria=${recipe.category.slug}`}
                className="inline-flex hover:opacity-80"
              >
                <Badge tone="gold">{recipe.category.name}</Badge>
              </Link>
            )}

            <h1 className="text-3xl md:text-4xl font-bold text-[#231F20] mt-2 mb-3">
              {recipe.title}
            </h1>

            <div className="flex flex-wrap gap-4 text-sm text-[#8A6A3A] mb-6">
              {recipe.prepTime && (
                <span className="flex items-center gap-1.5">
                  <Clock size={14} /> {recipe.prepTime} min
                </span>
              )}
              {recipe.servings && (
                <span className="flex items-center gap-1.5">
                  <Users size={14} /> {recipe.servings} porções
                </span>
              )}
              {recipe.difficulty && (
                <span className="flex items-center gap-1.5">
                  <ChefHat size={14} />
                  {DIFFICULTY_LABEL[recipe.difficulty] ?? recipe.difficulty}
                </span>
              )}
            </div>

            {recipe.description && (
              <p className="text-[#5d4f33] leading-relaxed mb-8">{recipe.description}</p>
            )}

            {/* Ingredientes */}
            {recipe.ingredients?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-[#231F20] mb-3">Ingredientes</h2>
                <ul className="space-y-1.5">
                  {recipe.ingredients.map((ing) => (
                    <li key={ing.id} className="flex items-start gap-2 text-sm text-[#231F20]">
                      <span className="w-2 h-2 rounded-full bg-[#D2BB8A] mt-1.5 shrink-0" />
                      <span>
                        {ing.quantity && <strong>{ing.quantity} {ing.unit} </strong>}
                        {ing.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Modo de preparo */}
            {recipe.steps?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-[#231F20] mb-3">Modo de preparo</h2>
                <ol className="space-y-4">
                  {recipe.steps.map((step, i) => (
                    <li key={step.id} className="flex gap-4">
                      <span className="w-7 h-7 rounded-full bg-[#5D082A] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm text-[#231F20] leading-relaxed">{step.content}</p>
                        {step.imageUrl && (
                          <img
                            src={step.imageUrl}
                            alt={`Passo ${i + 1}`}
                            className="mt-2 rounded-lg max-w-sm w-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Receitas relacionadas */}
            {recipe.relatedTo?.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-bold text-[#231F20] mb-4">Receitas relacionadas</h2>
                <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
                  {recipe.relatedTo.map(({ relatedRecipe }) => (
                    <Link
                      key={relatedRecipe.id}
                      to={`/receitas/${relatedRecipe.slug}`}
                      className="shrink-0 w-48 rounded-lg overflow-hidden border border-[#E8D7B0] bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-video bg-[#F8F4EA]">
                        {relatedRecipe.imageUrl ? (
                          <img
                            src={relatedRecipe.imageUrl}
                            alt={relatedRecipe.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ChefHat size={28} className="text-[#D2BB8A]" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-bold text-[#231F20] line-clamp-2">
                          {relatedRecipe.title}
                        </p>
                        {relatedRecipe.prepTime && (
                          <p className="text-[10px] text-[#8A6A3A] mt-1 flex items-center gap-1">
                            <Clock size={10} /> {relatedRecipe.prepTime} min
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Painel lateral — ingredientes para compra */}
          <aside className="lg:sticky lg:top-24 h-fit">
            <div className={surfaceClasses({ tone: 'warm', className: 'p-5' })}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-[#231F20]">Ingredientes disponíveis</h2>
                <ShoppingCart size={16} className="text-[#5D082A]" />
              </div>

              {recipe.products?.length === 0 ? (
                <p className="text-sm text-[#6b7280]">Nenhum produto vinculado ainda.</p>
              ) : (
                <>
                  <div className="mb-4">
                    {recipe.products.map((rp) => (
                      <RecipeProductRow key={rp.id} rp={rp} onAdd={handleAdd} />
                    ))}
                  </div>

                  <Button
                    onClick={handleAddAll}
                    size="lg"
                    className="w-full"
                  >
                    <Plus size={16} />
                    Adicionar todos ao carrinho
                  </Button>

                  {cartCount > 0 && (
                    <Link
                      to="/cart"
                      className={buttonVariants({
                        variant: 'outline',
                        size: 'lg',
                        className: 'mt-2 w-full',
                      })}
                    >
                      Ver carrinho
                    </Link>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Carrinho flutuante — visível em mobile quando há itens */}
      {cartCount > 0 && cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#D2BB8A] p-4 shadow-xl md:hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-[#231F20]">
              {cartCount} {cartCount === 1 ? 'item' : 'itens'} no carrinho
            </span>
            <span className="text-[#5D082A] font-black">{formatPrice(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setCartOpen(false)}
              variant="outline"
              size="lg"
              className="flex-1"
            >
              Continuar
            </Button>
            <Link
              to="/cart"
              className={buttonVariants({ variant: 'primary', size: 'lg', className: 'flex-1' })}
            >
              Ir para o carrinho
            </Link>
          </div>
        </div>
      )}

      {/* Botão flutuante mobile — aparece sempre quando há itens e painel fechado */}
      {cartCount > 0 && !cartOpen && (
        <Button
          onClick={() => setCartOpen(true)}
          size="lg"
          className="fixed bottom-5 right-5 z-50 md:hidden shadow-lg"
        >
          <ShoppingCart size={16} />
          {cartCount} · {formatPrice(total)}
        </Button>
      )}
    </div>
  )
}
