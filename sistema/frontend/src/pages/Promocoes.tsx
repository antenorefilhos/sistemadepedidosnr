import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Tag, Flame } from 'lucide-react'
import { productsAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import NotificationBell from '../components/NotificationBell'
import { StoreProductCard } from '../components/StoreProductCard'
import { SkeletonCard } from '../components/Skeleton'
import { SEO } from '../components/SEO'
import type { Product } from '../types'
import { buttonVariants } from '../components/ui/button'

export default function Promocoes() {
  const { user } = useAuth()
  const { data: promos = [], isLoading } = useQuery({
    queryKey: ['products-promotions'],
    queryFn: async () => {
      const res = await productsAPI.getPromotions()
      return res.data as Product[]
    },
    staleTime: 1000 * 60 * 5,
  })

  return (
    <div className="min-h-screen bg-white pb-24">
      <SEO title="Promoções" description="Ofertas e promoções selecionadas para você economizar." />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#5D082A] text-white px-4 py-4 flex items-center gap-3">
        <Link to="/" className="p-1 -ml-1 rounded-lg hover:bg-white/10 transition-colors">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Flame size={20} className="text-[#D2BB8A] fill-[#D2BB8A]" />
          <h1 className="text-base font-bold tracking-tight">Promoções</h1>
        </div>
        {user && (
          <div className="[&_button]:text-white [&_button]:hover:bg-white/10">
            <NotificationBell />
          </div>
        )}
      </header>

      <main className="px-4 py-5">
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <SkeletonCard count={10} />
          </div>
        )}

        {!isLoading && promos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <Tag size={48} className="text-[#D2BB8A]" strokeWidth={1.5} />
            <p className="text-lg font-semibold text-[#231F20]">Nenhuma promoção ativa no momento</p>
            <p className="text-sm text-gray-500">Volte em breve para conferir as ofertas!</p>
            <Link to="/mercado" className={buttonVariants({ variant: 'secondary', className: 'mt-2' })}>
              Ver catálogo completo
            </Link>
          </div>
        )}

        {!isLoading && promos.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">{promos.length} {promos.length === 1 ? 'oferta disponível' : 'ofertas disponíveis'}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {promos.map((product) => (
                <StoreProductCard key={product.id} product={product} source="SEARCH" variant="grid" />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
