import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Newspaper } from 'lucide-react'
import { promotionsAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { StoreProductCard } from '../components/StoreProductCard'
import { SkeletonCard } from '../components/Skeleton'
import { SEO } from '../components/SEO'
import type { Product } from '../types'
import { buttonVariants } from '../components/ui/button'

type CampaignItem = Product & { regularPrice: number | string; promotionalPrice: number | string; discountPercent: number | string | null }

type Campaign = {
  id: string
  name: string
  startDate: string
  endDate: string
  items: CampaignItem[]
}

/** Produtos de UM encarte especifico -- destino do clique quando um banner
 * do admin esta vinculado a um "Código do encarte" (linkType='campaign').
 * `regularPrice`/`promotionalPrice`/`discountPercent` chegam como Decimal do
 * Prisma (string em JSON) -- normaliza pra numero na hora de montar o card. */
export default function Encarte() {
  const { erpCampaignId } = useParams<{ erpCampaignId: string }>()
  const { user } = useAuth()

  const { data: campaign, isLoading, isError } = useQuery({
    queryKey: ['campaign', erpCampaignId],
    queryFn: async () => {
      const res = await promotionsAPI.campaigns.getByErpId(erpCampaignId as string)
      return res.data as Campaign | null
    },
    enabled: Boolean(erpCampaignId),
    staleTime: 1000 * 60 * 5,
  })

  const notFound = !isLoading && (isError || !campaign)

  return (
    <div className="min-h-screen bg-white pb-24">
      <SEO
        title={campaign ? campaign.name : 'Encarte'}
        description="Ofertas do encarte selecionadas para você economizar."
      />

      <header className="sticky top-0 z-40 bg-[#5D082A] text-white px-4 py-4 flex items-center gap-3">
        <Link to="/" className="p-1 -ml-1 rounded-lg hover:bg-white/10 transition-colors">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Newspaper size={20} className="text-[#D2BB8A] shrink-0" />
          <h1 className="text-base font-bold tracking-tight truncate">{campaign?.name || 'Encarte'}</h1>
        </div>
        {user && (
          <div className="[&_[data-bell-trigger]]:text-white [&_[data-bell-trigger]]:hover:bg-white/10">
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

        {notFound && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <Newspaper size={48} className="text-[#D2BB8A]" strokeWidth={1.5} />
            <p className="text-lg font-semibold text-[#231F20]">Esse encarte não está mais disponível</p>
            <p className="text-sm text-gray-500">Ele pode ter vencido ou o código mudou.</p>
            <Link to="/mercado" className={buttonVariants({ variant: 'secondary', className: 'mt-2' })}>
              Ver catálogo completo
            </Link>
          </div>
        )}

        {campaign && campaign.items.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {campaign.items.length} {campaign.items.length === 1 ? 'produto em oferta' : 'produtos em oferta'} · válido até{' '}
              {new Date(campaign.endDate).toLocaleDateString('pt-BR')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {campaign.items.map((item) => (
                <StoreProductCard
                  key={item.id}
                  product={{ ...item, price: Number(item.regularPrice), promotionalPrice: Number(item.promotionalPrice) }}
                  source="SEARCH"
                  variant="grid"
                />
              ))}
            </div>
          </>
        )}

        {campaign && campaign.items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <Newspaper size={48} className="text-[#D2BB8A]" strokeWidth={1.5} />
            <p className="text-lg font-semibold text-[#231F20]">Nenhum produto sincronizado deste encarte ainda</p>
          </div>
        )}
      </main>
      <MobileBottomNav />
    </div>
  )
}
