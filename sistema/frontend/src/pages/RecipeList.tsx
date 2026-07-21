import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChefHat, Clock, Users, ArrowRight, ArrowLeft } from 'lucide-react'
import { useRecipes, useRecipeCategories } from '../hooks/useRecipes'
import { SEO, StructuredData } from '../components/SEO'
import { Badge } from '../components/ui/badge'
import { Button, buttonVariants } from '../components/ui/button'
import { surfaceClasses } from '../components/ui/surface'
import { cn } from '../lib/cn'
import type { Recipe } from '../types'

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Médio',
  HARD: 'Difícil',
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <article className={surfaceClasses({ interactive: true, className: 'group overflow-hidden' })}>
      <Link to={`/receitas/${recipe.slug}`} className="block">
        <div className="aspect-video overflow-hidden bg-[#F8F4EA]">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat size={40} className="text-[#D2BB8A]" />
            </div>
          )}
        </div>
      </Link>

      <div className="p-4">
        {recipe.category && (
          <Badge tone="gold">
            {recipe.category.name}
          </Badge>
        )}

        <Link to={`/receitas/${recipe.slug}`}>
          <h2 className="mt-1 font-bold text-[#231F20] text-base leading-snug line-clamp-2 hover:text-[#5D082A] transition-colors">
            {recipe.title}
          </h2>
        </Link>

        {recipe.description && (
          <p className="mt-1 text-sm text-[#6b7280] line-clamp-2">{recipe.description}</p>
        )}

        <div className="mt-3 flex items-center gap-4 text-xs text-[#8A6A3A]">
          {recipe.prepTime && (
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {recipe.prepTime} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users size={13} />
              {recipe.servings} porções
            </span>
          )}
          {recipe.difficulty && (
            <span>{DIFFICULTY_LABEL[recipe.difficulty] ?? recipe.difficulty}</span>
          )}
        </div>

        <Link
          to={`/receitas/${recipe.slug}`}
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: 'mt-4 h-8 px-0 hover:bg-transparent hover:underline',
          })}
        >
          Ver receita <ArrowRight size={12} />
        </Link>
      </div>
    </article>
  )
}

export default function RecipeList() {
  const [activeCategory, setActiveCategory] = useState<string | undefined>()
  const { data: categories = [] } = useRecipeCategories()
  const { data, isLoading } = useRecipes(activeCategory)
  const recipes = data?.data ?? []

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F4EA] via-[#FBFAF7] to-white">
      <SEO
        title="Receitas"
        description="Inspire-se com receitas exclusivas do Antenor & Filhos e adicione os ingredientes direto no carrinho."
        canonical="/receitas"
      />
      <StructuredData data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Receitas', item: `${typeof window !== 'undefined' ? window.location.origin : ''}/receitas` },
        ],
      }} />
      <header className="glass sticky top-0 z-50 border-b border-[#D2BB8A]/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'px-0 hover:bg-transparent' })}>
            <ArrowLeft size={16} />
            Voltar
          </Link>
          <span className="inline-flex items-center gap-2 font-semibold text-[#231F20]">
            <ChefHat size={18} className="text-[#5D082A]" /> Receitas
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#231F20]">Receitas</h1>
          <p className="text-sm text-[#5d4f33] mt-1">
            Inspire-se e adicione os ingredientes direto no carrinho.
          </p>
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 hide-scrollbar">
            <Button
              onClick={() => setActiveCategory(undefined)}
              variant={!activeCategory ? 'primary' : 'outline'}
              size="sm"
              className="shrink-0"
            >
              Todas
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                onClick={() => setActiveCategory(cat.slug)}
                variant={activeCategory === cat.slug ? 'primary' : 'outline'}
                size="sm"
                className="shrink-0"
              >
                {cat.name}
              </Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(surfaceClasses({ className: 'h-64' }), 'animate-pulse bg-[#E8D7B0]/40')}
              />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-20">
            <ChefHat size={40} className="mx-auto text-[#D2BB8A] mb-3" />
            <p className="text-[#231F20] font-semibold">Nenhuma receita publicada ainda.</p>
            <p className="text-sm text-[#6b7280] mt-1">
              Em breve novidades quentinhas saindo do forno!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
