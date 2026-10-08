import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChefHat, Clock, ShoppingBasket, Users } from 'lucide-react'
import { useRecipes, useRecipeCategories } from '../hooks/useRecipes'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { PageTopBar } from '../components/PageTopBar'
import { SEO, StructuredData } from '../components/SEO'
import { DIFFICULTY_LABEL, formatDuration, pickOfTheDay } from '../utils/recipe'
import { cn } from '../lib/cn'
import type { Recipe } from '../types'
import { sizedImageUrl } from '../utils/imageUrl'

// Lista de receitas refeita em 07/10/2026 (revisao de UI/UX do storefront,
// celular primeiro): receita do dia em destaque, duas colunas no celular (eram
// cards de tela inteira, um por vez), categoria no endereco (?categoria=, o
// link da receita ja usava e a lista ignorava) e todas as receitas -- a lista
// pedia 12 e parava ali, sem "ver mais": 13 das 25 nao apareciam.

type ListRecipe = Recipe & { productCount?: number }

function RecipeMeta({ recipe, className }: { recipe: ListRecipe; className?: string }) {
  const duration = formatDuration(recipe.prepTime)
  const difficulty = recipe.difficulty ? DIFFICULTY_LABEL[recipe.difficulty] ?? '' : ''
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs', className)}>
      {duration && (
        <span className="inline-flex items-center gap-1">
          <Clock size={12} aria-hidden="true" /> {duration}
        </span>
      )}
      {recipe.servings ? (
        <span className="inline-flex items-center gap-1">
          <Users size={12} aria-hidden="true" /> {recipe.servings} porções
        </span>
      ) : null}
      {difficulty && <span>{difficulty}</span>}
    </p>
  )
}

function RecipeImage({ recipe, className }: { recipe: ListRecipe; className?: string }) {
  return (
    <div className={cn('overflow-hidden bg-[#F8F4EA]', className)}>
      {recipe.imageUrl ? (
        <img src={sizedImageUrl(recipe.imageUrl, 640) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ChefHat size={32} className="text-[#D2BB8A]" />
        </div>
      )}
    </div>
  )
}

/** Card da grade: foto, nome, tempo e quantos ingredientes da para comprar aqui. */
function RecipeGridCard({ recipe, showCategory }: { recipe: ListRecipe; showCategory: boolean }) {
  return (
    <Link to={`/receitas/${recipe.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-[#E8D7B0]/70 bg-white transition-shadow hover:shadow-md">
      <RecipeImage recipe={recipe} className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col p-3">
        {showCategory && recipe.category && (
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A6A3A]">{recipe.category.name}</p>
        )}
        <h2 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-[#231F20] group-hover:text-[#5D082A] sm:text-[15px]">{recipe.title}</h2>
        <RecipeMeta recipe={recipe} className="mt-1.5 text-[#8A6A3A]" />
        {recipe.productCount ? (
          <p className="mt-auto flex items-center gap-1 pt-2 text-xs font-semibold text-[#5D082A]">
            <ShoppingBasket size={13} aria-hidden="true" /> {recipe.productCount} ingredientes na loja
          </p>
        ) : null}
      </div>
    </Link>
  )
}

/** Receita do dia: foto grande com o nome em cima, a mesma para todos ate meia-noite. */
function FeaturedRecipe({ recipe }: { recipe: ListRecipe }) {
  return (
    <Link
      to={`/receitas/${recipe.slug}`}
      className="group relative block overflow-hidden rounded-2xl bg-[#231F20] md:grid md:grid-cols-[1.4fr_1fr] md:bg-white md:ring-1 md:ring-[#E8D7B0]/70"
    >
      <RecipeImage recipe={recipe} className="aspect-[4/3] md:aspect-auto md:h-full md:min-h-[300px]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent md:hidden" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white md:static md:flex md:flex-col md:justify-center md:p-8 md:text-[#231F20]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#D2BB8A] md:text-[#8A6A3A]">Receita do dia</p>
        <h2 className="mt-1 text-xl font-bold leading-tight md:text-3xl">{recipe.title}</h2>
        {recipe.description && <p className="mt-2 hidden text-sm leading-relaxed text-[#5d4f33] md:line-clamp-3">{recipe.description}</p>}
        <RecipeMeta recipe={recipe} className="mt-2 text-white/85 md:text-[#8A6A3A]" />
        <span className="mt-3 inline-flex h-10 w-fit items-center rounded-xl bg-white px-4 text-sm font-bold text-[#5D082A] md:mt-5 md:bg-[#5D082A] md:text-white">
          {recipe.productCount ? `Ver receita e os ${recipe.productCount} ingredientes` : 'Ver receita'}
        </span>
      </div>
    </Link>
  )
}

export default function RecipeList() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const activeCategory = params.get('categoria') || undefined
  const { data: categories = [] } = useRecipeCategories()
  const { data, isLoading } = useRecipes(activeCategory, 1, 60)
  const recipes = useMemo(() => (data?.data ?? []) as ListRecipe[], [data])
  const featured = activeCategory ? undefined : pickOfTheDay(recipes)
  const grid = featured ? recipes.filter((recipe) => recipe.id !== featured.id) : recipes
  const activeName = categories.find((category) => category.slug === activeCategory)?.name

  const chooseCategory = (slug?: string) => {
    const next = new URLSearchParams(params)
    if (slug) next.set('categoria', slug)
    else next.delete('categoria')
    setParams(next, { replace: true })
    window.scrollTo({ top: 0 })
  }

  const chip = (active: boolean) =>
    cn(
      'h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors',
      active ? 'border-[#5D082A] bg-[#5D082A] text-white' : 'border-[#E8D7B0] bg-white text-[#231F20] hover:border-[#D2BB8A]',
    )

  return (
    <div className="min-h-screen bg-[#FBFAF7] pb-28 lg:pb-12">
      <SEO
        title={activeName ? `Receitas: ${activeName}` : 'Receitas'}
        description="Receitas do Antenor & Filhos com os ingredientes da loja: escolha uma e coloque tudo no carrinho num toque."
        canonical={activeCategory ? `/receitas?categoria=${activeCategory}` : '/receitas'}
      />
      <StructuredData data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Receitas', item: `${typeof window !== 'undefined' ? window.location.origin : ''}/receitas` },
        ],
      }} />

      <PageTopBar
        onBack={() => navigate('/')}
        backLabel="Voltar ao início"
        title={
          <h1 className="flex items-center gap-2">
            <ChefHat size={21} className="text-[#5D082A]" aria-hidden="true" /> Receitas
          </h1>
        }
      />

      {categories.length > 0 && (
        <nav aria-label="Categorias de receita" className="sticky top-[60px] z-30 border-b border-[#E8D7B0]/50 bg-[#FBFAF7]/95 backdrop-blur">
          <div className="hide-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5">
            <button type="button" onClick={() => chooseCategory(undefined)} aria-pressed={!activeCategory} className={chip(!activeCategory)}>
              Todas
            </button>
            {categories.map((category) => (
              <button key={category.id} type="button" onClick={() => chooseCategory(category.slug)} aria-pressed={activeCategory === category.slug} className={chip(activeCategory === category.slug)}>
                {category.name}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-6xl px-4 pt-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-60 animate-pulse rounded-2xl bg-[#E8D7B0]/40" />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="py-20 text-center">
            <ChefHat size={40} className="mx-auto mb-3 text-[#D2BB8A]" />
            <p className="font-semibold text-[#231F20]">Nenhuma receita publicada {activeName ? 'nesta categoria' : 'ainda'}.</p>
            {activeName && (
              <button type="button" onClick={() => chooseCategory(undefined)} className="mt-3 text-sm font-bold text-[#5D082A] hover:underline">
                Ver todas as receitas
              </button>
            )}
          </div>
        ) : (
          <>
            {featured && <FeaturedRecipe recipe={featured} />}
            <p className="mb-3 mt-5 text-sm text-[#5d4f33]">
              {activeName ? (
                <>
                  <strong className="text-[#231F20]">{recipes.length}</strong> {recipes.length === 1 ? 'receita' : 'receitas'} de {activeName.toLowerCase()}
                </>
              ) : (
                <>Escolha uma receita e coloque os ingredientes no carrinho num toque.</>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
              {grid.map((recipe) => (
                <RecipeGridCard key={recipe.id} recipe={recipe} showCategory={!activeCategory} />
              ))}
            </div>
          </>
        )}
      </main>
      <MobileBottomNav />
    </div>
  )
}
