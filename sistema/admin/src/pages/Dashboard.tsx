import { Suspense, lazy, useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Sparkles } from 'lucide-react'
import { TopMenuBar, SECTION_LABELS } from '@/components/TopMenuBar'
import { ChangelogModal } from '@/components/ChangelogModal'

export type Section =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'picking'
  | 'staff'
  | 'customers'
  | 'layout'
  | 'categories'
  | 'deliveryZones'
  | 'deliveryRoutes'
  | 'businessHours'
  | 'fraudAudit'
  | 'notifications'
  | 'coupons'
  | 'sponsoredShelves'
  | 'mostruario'
  | 'recipes'
  | 'storeBanners'
  | 'brandIdentity'
  | 'intelligence'
  | 'integrations'
  | 'payments'

const HomeLayoutSection = lazy(() => import('./sections/HomeLayoutSection'))
const IntelligenceSection = lazy(() => import('./sections/IntelligenceSection'))
const Integrations = lazy(() => import('./Integrations'))
const DepartmentsSection = lazy(() => import('./sections/DepartmentsSection'))
const DeliveryZones = lazy(() => import('./DeliveryZones'))
const DeliveryRoutesSection = lazy(() => import('./sections/DeliveryRoutesSection'))
const BusinessHours = lazy(() => import('./BusinessHours'))
const FraudAudit = lazy(() => import('./FraudAudit'))
const NotificationsSection = lazy(() => import('./sections/NotificationsSection'))
const CouponsSection = lazy(() => import('./sections/CouponsSection'))
const SponsoredShelves = lazy(() => import('./SponsoredShelves'))
const MostruarioSection = lazy(() => import('./sections/MostruarioSection'))
const RecipesSection = lazy(() => import('./sections/RecipesSection'))
const StoreBannersManager = lazy(() => import('./StoreBannersManager'))
const BrandIdentity = lazy(() => import('./BrandIdentity'))
const DashboardSection = lazy(() => import('./sections/DashboardSection').then((module) => ({ default: module.DashboardSection })))
const ProductsSection = lazy(() => import('./sections/ProductsSection'))
const OrdersSection = lazy(() => import('./sections/OrdersSection'))
const PickingSection = lazy(() => import('./sections/PickingSection'))
const CustomersSection = lazy(() => import('./sections/CustomersSection'))
const PaymentsSection = lazy(() => import('./sections/PaymentsSection'))
const StaffSection = lazy(() => import('./sections/StaffSection'))

const VALID_SECTIONS: Section[] = [
  'dashboard', 'products', 'orders', 'picking', 'staff',
  'customers', 'layout', 'categories', 'deliveryZones',
  'businessHours', 'fraudAudit', 'notifications', 'coupons', 'sponsoredShelves', 'mostruario', 'recipes', 'storeBanners', 'deliveryRoutes',
  'brandIdentity', 'intelligence', 'integrations', 'payments',
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { logout, getAdminData } = useAuth()
  const admin = getAdminData()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawSection = searchParams.get('section')
  // 29/09/2026: 'Desempenho' virou parte de Separacao/Entregas; link antigo cai na Separacao.
  const sectionParam = (rawSection === 'teamPerformance' ? 'picking' : rawSection) as Section | null
  const [activeSection, setActiveSectionState] = useState<Section>(
    sectionParam && VALID_SECTIONS.includes(sectionParam) ? sectionParam : 'dashboard'
  )
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)
  // Mantem a secao ativa na URL (?section=) pra um F5/recarregar nao voltar
  // sempre pra dashboard -- activeSection era so estado em memoria antes.
  const setActiveSection = useCallback(
    (section: Section) => {
      setActiveSectionState(section)
      setSearchParams(section === 'dashboard' ? {} : { section }, { replace: true })
    },
    [setSearchParams]
  )

  // Pedido a abrir quando se chega em Pedidos por um alerta da Visao geral.
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)

  const lazySectionFallback = (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Carregando secao...</div>
  )

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <TopMenuBar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        adminName={admin?.name}
        onLogout={handleLogout}
      />

      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-gray-800">
          {SECTION_LABELS[activeSection] || activeSection}
        </h1>
        <button
          type="button"
          onClick={() => setIsChangelogOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D2BB8A]/15 text-[#5D082A] border border-[#D2BB8A]/40 hover:bg-[#D2BB8A]/30 transition-all cursor-pointer shrink-0"
          title="Ver histórico de versões e novidades"
        >
          <Sparkles size={13} className="text-[#8A6A3A]" />
          <span>v{__APP_VERSION__} · Novidades</span>
        </button>
      </div>

      <ChangelogModal open={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />

      <main className="flex-1 overflow-auto p-4 sm:p-6" role="main">
          {activeSection === 'dashboard' && (
            <Suspense fallback={lazySectionFallback}>
              <DashboardSection
                onNavigate={setActiveSection}
                onOpenOrder={(orderId) => {
                  setPendingOrderId(orderId)
                  setActiveSection('orders')
                }}
              />
            </Suspense>
          )}

          {activeSection === 'products' && (
            <Suspense fallback={lazySectionFallback}>
              <ProductsSection />
            </Suspense>
          )}

          {activeSection === 'orders' && (
            <Suspense fallback={lazySectionFallback}>
              <OrdersSection openOrderId={pendingOrderId} onOpenOrderConsumed={() => setPendingOrderId(null)} />
            </Suspense>
          )}

          {activeSection === 'picking' && (
            <Suspense fallback={lazySectionFallback}>
              <PickingSection />
            </Suspense>
          )}

          {activeSection === 'staff' && (
            <Suspense fallback={lazySectionFallback}>
              <StaffSection />
            </Suspense>
          )}

          {activeSection === 'customers' && (
            <Suspense fallback={lazySectionFallback}>
              <CustomersSection />
            </Suspense>
          )}

          {activeSection === 'layout' && (
            <Suspense fallback={lazySectionFallback}>
              <HomeLayoutSection onNavigate={setActiveSection} />
            </Suspense>
          )}

          {activeSection === 'categories' && (
            <Suspense fallback={lazySectionFallback}>
              <DepartmentsSection
                onOpenProducts={(category, tab) => {
                  setActiveSectionState('products')
                  setSearchParams({ section: 'products', tab, category }, { replace: true })
                }}
              />
            </Suspense>
          )}

          {activeSection === 'deliveryRoutes' && (
            <Suspense fallback={lazySectionFallback}>
              <DeliveryRoutesSection />
            </Suspense>
          )}

          {activeSection === 'deliveryZones' && (
            <Suspense fallback={lazySectionFallback}>
              <DeliveryZones />
            </Suspense>
          )}

          {activeSection === 'businessHours' && (
            <Suspense fallback={lazySectionFallback}>
              <BusinessHours />
            </Suspense>
          )}

          {activeSection === 'fraudAudit' && (
            <Suspense fallback={lazySectionFallback}>
              <FraudAudit />
            </Suspense>
          )}

          {activeSection === 'notifications' && (
            <Suspense fallback={lazySectionFallback}>
              <NotificationsSection />
            </Suspense>
          )}

          {activeSection === 'coupons' && (
            <Suspense fallback={lazySectionFallback}>
              <CouponsSection />
            </Suspense>
          )}

          {activeSection === 'sponsoredShelves' && (
            <Suspense fallback={lazySectionFallback}>
              <SponsoredShelves />
            </Suspense>
          )}

          {activeSection === 'mostruario' && (
            <Suspense fallback={lazySectionFallback}>
              <MostruarioSection />
            </Suspense>
          )}

          {activeSection === 'recipes' && (
            <Suspense fallback={lazySectionFallback}>
              <RecipesSection />
            </Suspense>
          )}

          {activeSection === 'storeBanners' && (
            <Suspense fallback={lazySectionFallback}>
              <StoreBannersManager />
            </Suspense>
          )}

          {activeSection === 'brandIdentity' && (
            <Suspense fallback={lazySectionFallback}>
              <BrandIdentity />
            </Suspense>
          )}

          {activeSection === 'intelligence' && (
            <Suspense fallback={lazySectionFallback}>
              <IntelligenceSection />
            </Suspense>
          )}

          {activeSection === 'integrations' && (
            <Suspense fallback={lazySectionFallback}>
              <Integrations />
            </Suspense>
          )}

          {activeSection === 'payments' && (
            <Suspense fallback={lazySectionFallback}>
              <PaymentsSection />
            </Suspense>
          )}
      </main>
    </div>
  )
}
