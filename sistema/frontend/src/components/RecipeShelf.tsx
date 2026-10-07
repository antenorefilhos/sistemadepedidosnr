import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChefHat, ChevronRight, Clock, Users } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { recipesAPI } from '../services/api'
import { useDragScroll } from '../hooks/useDragScroll'
import { cn } from '../lib/cn'
import type { Recipe } from '../types'

// Receitas no caminho do cliente (29/09/2026): a unica entrada era o link do
// topo no computador -- no celular, onde esta quase todo cliente, nao havia
// como chegar. Faixa na Home e "receitas com este produto" na pagina do
// produto. Nao renderiza nada sem receita publicada.

type RecipeCardData = Pick<Recipe, 'id' | 'slug' | 'title' | 'imageUrl' | 'prepTime' | 'servings'>

export function RecipeCard({ recipe, className }: { recipe: RecipeCardData; className?: string }) {
  return (
    <Link
      to={`/receitas/${recipe.slug}`}
      className={cn('group block shrink-0 snap-start overflow-hidden rounded-xl border border-[#E8D7B0]/70 bg-white transition-shadow hover:shadow-md', className)}
    >
      <div className="aspect-video bg-[#F8F4EA]">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ChefHat size={28} className="text-[#D2BB8A]" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-[#231F20] group-hover:text-[#5D082A]">{recipe.title}</p>
        {(recipe.prepTime || recipe.servings) && (
          <p className="mt-1 flex items-center gap-3 text-xs text-[#8A6A3A]">
            {recipe.prepTime ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {recipe.prepTime} min
              </span>
            ) : null}
            {recipe.servings ? (
              <span className="inline-flex items-center gap-1">
                <Users size={12} /> {recipe.servings} porções
              </span>
            ) : null}
          </p>
        )}
      </div>
    </Link>
  )
}

function Shelf({ eyebrow, title, recipes, className }: { eyebrow: string; title: string; recipes: RecipeCardData[]; className?: string }) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const drag = useDragScroll(scrollRef)
  if (!recipes.length) return null
  return (
    <section className={cn('fade-in-section min-w-0', className)}>
      {/* Mesmo cabecalho das vitrines de produto (07/10/2026): titulo + "Ver", sem linha extra em cima. */}
      <div className="mb-3 flex items-end justify-between gap-3" title={eyebrow}>
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold leading-tight text-[#231F20]">
          <ChefHat size={19} className="shrink-0 text-[#5D082A]" />
          <span className="line-clamp-2">{title}</span>
        </h2>
        <Link to="/receitas" className="relative z-10 -my-3.5 flex shrink-0 items-center gap-0.5 py-3.5 text-xs font-bold text-[#5D082A] hover:underline">
          Ver receitas <ChevronRight size={14} />
        </Link>
      </div>
      <div ref={scrollRef} className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 [overflow-anchor:none] md:mx-0 md:scroll-px-0 md:px-0" {...drag.dragProps}>
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} className="w-[72vw] max-w-[280px] md:w-[280px]" />
        ))}
      </div>
    </section>
  )
}

/**
 * Ordem aleatoria (03/10/2026, pedido do Jonathan): a cada visita a faixa
 * mostra outras receitas, em vez de sempre as mais recentes. Sorteia uma vez
 * por carga da lista -- nao reembaralha a cada render.
 */
function shuffled<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Faixa da Home: 8 receitas publicadas, sorteadas a cada visita. */
export function HomeRecipeShelf({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['recipes', 'home'],
    queryFn: async () => (await recipesAPI.list(undefined, 1, 60)).data as { data: RecipeCardData[] },
    staleTime: 1000 * 60 * 5,
  })
  const recipes = useMemo(() => shuffled(data?.data ?? []).slice(0, 8), [data])
  return <Shelf eyebrow="Para cozinhar" title="Receitas com ingredientes da loja" recipes={recipes} className={className} />
}

/** Pagina do produto: receitas que usam este produto. */
export function ProductRecipeShelf({ productId, className }: { productId: string; className?: string }) {
  const { data } = useQuery({
    queryKey: ['recipes', 'product', productId],
    queryFn: async () => (await recipesAPI.list(undefined, 1, 30, productId)).data as { data: RecipeCardData[] },
    enabled: Boolean(productId),
    staleTime: 1000 * 60 * 5,
  })
  const recipes = useMemo(() => shuffled(data?.data ?? []).slice(0, 6), [data])
  return <Shelf eyebrow="Use em" title="Receitas com este produto" recipes={recipes} className={className} />
}
