import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Newspaper, ShoppingCart } from 'lucide-react'
import { useCart } from '../hooks/useCart'
import { NEAR_EXPIRY_NOTE } from '../hooks/useCMS'
import { promotionsAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { StoreProductCard } from '../components/StoreProductCard'
import { SkeletonCard } from '../components/Skeleton'
import { SEO } from '../components/SEO'
import type { Product } from '../types'
import { buttonVariants } from '../components/ui/button'
import { formatPrice } from '../utils/format'
import { cn } from '../lib/cn'

type CampaignItem = Product & {
  regularPrice: number | string
  promotionalPrice: number | string
  discountPercent: number | string | null
  // JON-184 (AEF-034/v1.11.0): campos enriquecidos do encarte.
  highlightCover?: boolean
  strongSuggestion?: boolean
  wholesaleMinQty?: number | null
  wholesalePrice?: number | string | null
}

type Campaign = {
  id: string
  name: string
  startDate: string
  endDate: string
  nearExpiry?: boolean
  items: CampaignItem[]
}

/** Produtos de UM encarte especifico -- destino do clique quando um banner
 * do admin esta vinculado a um "Código do encarte" (linkType='campaign').
 * `regularPrice`/`promotionalPrice`/`discountPercent` chegam como Decimal do
 * Prisma (string em JSON) -- normaliza pra numero na hora de montar o card. */
export default function Encarte() {
  const { erpCampaignId } = useParams<{ erpCampaignId: string }>()
  const { user } = useAuth()
  const { count } = useCart()

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
    <div className="min-h-screen bg-[#FBFAF7] pb-24">
      <SEO
        title={campaign ? campaign.name : 'Encarte'}
        description="Ofertas do encarte selecionadas para você economizar."
      />

      {/* Mesmo cabecalho de Ofertas/Mercado (revisao de UI/UX, 07/10/2026). */}
      <header className="sticky top-0 z-40 border-b border-[#E8D7B0]/60 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 px-2 py-2 sm:px-4">
          <Link to="/promocoes" aria-label="Voltar para Ofertas" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-[#231F20]">{campaign?.name || 'Encarte'}</h1>
          <Link to="/cart" aria-label={count > 0 ? `Carrinho com ${count} itens` : 'Carrinho vazio'} className="relative flex h-11 w-11 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
            <ShoppingCart size={22} />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#5D082A] px-1 text-[10px] font-bold text-white">{count > 9 ? '9+' : count}</span>
            )}
          </Link>
          {user && <NotificationBell />}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
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
            <section className="mb-5 rounded-2xl bg-gradient-to-br from-[#5D082A] via-[#741035] to-[#3d0519] px-5 py-5 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-[#D2BB8A]">Encarte</p>
              <p className="mt-1 text-2xl font-black leading-tight">{campaign.name}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
                <span className="inline-flex items-center gap-1 font-semibold text-[#D2BB8A]">
                  <Clock size={14} /> até{' '}
                  {new Date(campaign.endDate).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })}
                </span>
                <span>{campaign.items.length} {campaign.items.length === 1 ? 'produto' : 'produtos'}</span>
              </p>
              {campaign.nearExpiry && <p className="mt-1 text-xs text-white/70">{NEAR_EXPIRY_NOTE}</p>}
            </section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {[...campaign.items]
                .sort((a, b) => Number(b.highlightCover || b.strongSuggestion) - Number(a.highlightCover || a.strongSuggestion))
                .map((item) => {
                  const destaque = Boolean(item.highlightCover || item.strongSuggestion)
                  const wholesalePrice = item.wholesalePrice != null ? Number(item.wholesalePrice) : null
                  return (
                    <div key={item.id} className={cn('flex flex-col gap-1.5', destaque && 'col-span-2')}>
                      <StoreProductCard
                        product={{ ...item, price: Number(item.regularPrice), promotionalPrice: Number(item.promotionalPrice) }}
                        source="SEARCH"
                        variant="grid"
                      />
                      {item.wholesaleMinQty && wholesalePrice != null && (
                        <p className="text-xs font-semibold text-[#5D082A] text-center">
                          A partir de {item.wholesaleMinQty} un: {formatPrice(wholesalePrice)} cada
                        </p>
                      )}
                    </div>
                  )
                })}
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
