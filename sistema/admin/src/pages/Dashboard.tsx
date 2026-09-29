import { Suspense, lazy, useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCustomersAdmin } from '../hooks/useCustomersAdmin'
import { MessageCircle, Sparkles } from 'lucide-react'
import { TopMenuBar, SECTION_LABELS } from '@/components/TopMenuBar'
import { ChangelogModal } from '@/components/ChangelogModal'

export type Section =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'picking'
  | 'staff'
  | 'businessAccounts'
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

const normalizePhone = (value?: string) => {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  return `55${digits}`
}

const buildWhatsAppUrl = (whatsapp?: string, text?: string) => {
  const phone = normalizePhone(whatsapp)
  if (!phone) return ''
  if (!text) return `https://wa.me/${phone}`
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

const formatWhatsappDisplay = (value?: string) => {
  const digits = (value || '').replace(/\D/g, '')
  const raw = digits.startsWith('55') ? digits.slice(2) : digits
  if (raw.length === 11) {
    return raw.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (raw.length === 10) {
    return raw.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return value || '-'
}

function WhatsAppBadge({ phone, compact = false }: { phone?: string; compact?: boolean }) {
  if (!phone) {
    return <span className="text-xs text-gray-400">-</span>
  }

  return (
    <a
      href={buildWhatsAppUrl(phone)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#1fae56] bg-[#25D366] text-white font-medium shadow-sm transition hover:bg-[#1fae56] ${compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-xs'}`}
      title="Abrir WhatsApp"
    >
      <MessageCircle size={compact ? 12 : 13} />
      {formatWhatsappDisplay(phone)}
    </a>
  )
}

const LayoutManager = lazy(() => import('../components/LayoutManager'))
const Intelligence = lazy(() => import('./Intelligence'))
const Integrations = lazy(() => import('./Integrations'))
const DepartmentsSection = lazy(() => import('./sections/DepartmentsSection'))
const DeliveryZones = lazy(() => import('./DeliveryZones'))
const DeliveryRoutesSection = lazy(() => import('./sections/DeliveryRoutesSection'))
const BusinessHours = lazy(() => import('./BusinessHours'))
const FraudAudit = lazy(() => import('./FraudAudit'))
const NotificationsBroadcast = lazy(() => import('./NotificationsBroadcast'))
const Coupons = lazy(() => import('./Coupons'))
const SponsoredShelves = lazy(() => import('./SponsoredShelves'))
const Mostruario = lazy(() => import('./Mostruario'))
const Recipes = lazy(() => import('./Recipes'))
const StoreBannersManager = lazy(() => import('./StoreBannersManager'))
const BrandIdentity = lazy(() => import('./BrandIdentity'))
const DashboardSection = lazy(() => import('./sections/DashboardSection').then((module) => ({ default: module.DashboardSection })))
const ProductsSection = lazy(() => import('./sections/ProductsSection'))
const OrdersSection = lazy(() => import('./sections/OrdersSection'))
const PickingSection = lazy(() => import('./sections/PickingSection'))
const BusinessAccountsSection = lazy(() => import('./sections/BusinessAccountsSection'))
const CustomersSection = lazy(() => import('./sections/CustomersSection'))
const PaymentEventsSection = lazy(() => import('./sections/PaymentEventsSection'))
const StaffSection = lazy(() => import('./sections/StaffSection'))

const VALID_SECTIONS: Section[] = [
  'dashboard', 'products', 'orders', 'picking', 'staff',
  'businessAccounts', 'customers', 'layout', 'categories', 'deliveryZones',
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
  const c = useCustomersAdmin(activeSection)

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

          {activeSection === 'businessAccounts' && (
            <Suspense fallback={lazySectionFallback}>
              <BusinessAccountsSection />
            </Suspense>
          )}

          {activeSection === 'customers' && (
            <Suspense fallback={lazySectionFallback}>
              <CustomersSection
                customersSearch={c.customersSearch}
                onCustomersSearchChange={c.setCustomersSearch}
                customersEmailFilter={c.customersEmailFilter}
                onCustomersEmailFilterChange={c.setCustomersEmailFilter}
                customersAddressFilter={c.customersAddressFilter}
                onCustomersAddressFilterChange={c.setCustomersAddressFilter}
                customersOrderFilter={c.customersOrderFilter}
                onCustomersOrderFilterChange={c.setCustomersOrderFilter}
                customersDateFilter={c.customersDateFilter}
                onCustomersDateFilterChange={c.setCustomersDateFilter}
                customersViewMode={c.customersViewMode}
                onCustomersViewModeChange={c.setCustomersViewMode}
                onReloadCustomers={() => c.loadCustomers(c.customersSearch)}
                customersLoading={c.customersLoading}
                filteredCustomers={c.filteredCustomers}
                customerOrderCountMap={c.customerOrderCountMap}
                onOpenCustomerDetails={c.openCustomerDetails}
                selectedCustomer={c.selectedCustomer}
                onSelectCustomer={c.setSelectedCustomer}
                renderWhatsAppBadge={(phone, compact) => <WhatsAppBadge phone={phone} compact={compact} />}
              />
            </Suspense>
          )}

          {activeSection === 'layout' && (
            <Suspense fallback={lazySectionFallback}>
              <LayoutManager />
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
              <NotificationsBroadcast />
            </Suspense>
          )}

          {activeSection === 'coupons' && (
            <Suspense fallback={lazySectionFallback}>
              <Coupons />
            </Suspense>
          )}

          {activeSection === 'sponsoredShelves' && (
            <Suspense fallback={lazySectionFallback}>
              <SponsoredShelves />
            </Suspense>
          )}

          {activeSection === 'mostruario' && (
            <Suspense fallback={lazySectionFallback}>
              <Mostruario />
            </Suspense>
          )}

          {activeSection === 'recipes' && (
            <Suspense fallback={lazySectionFallback}>
              <Recipes />
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
              <Intelligence />
            </Suspense>
          )}

          {activeSection === 'integrations' && (
            <Suspense fallback={lazySectionFallback}>
              <Integrations />
            </Suspense>
          )}

          {activeSection === 'payments' && (
            <Suspense fallback={lazySectionFallback}>
              <PaymentEventsSection />
            </Suspense>
          )}
      </main>
    </div>
  )
}
