import { Suspense, lazy, useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics'
import { useProductsAdmin, formatClassificationOptionLabel, formatClassificationPath } from '../hooks/useProductsAdmin'
import { useOrdersAdmin, ORDER_STATUS_OPTIONS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, getPaymentStatusClassName } from '../hooks/useOrdersAdmin'
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
  | 'teamPerformance'
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
const CategoriesManager = lazy(() => import('./CategoriesManager'))
const DeliveryZones = lazy(() => import('./DeliveryZones'))
const DeliveryRoutesSection = lazy(() => import('./sections/DeliveryRoutesSection'))
const BusinessHours = lazy(() => import('./BusinessHours'))
const FraudAudit = lazy(() => import('./FraudAudit'))
const NotificationsBroadcast = lazy(() => import('./NotificationsBroadcast'))
const Coupons = lazy(() => import('./Coupons'))
const SponsoredShelves = lazy(() => import('./SponsoredShelves'))
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
const TeamPerformanceSection = lazy(() => import('./sections/TeamPerformanceSection'))

const VALID_SECTIONS: Section[] = [
  'dashboard', 'products', 'orders', 'picking', 'staff', 'teamPerformance',
  'businessAccounts', 'customers', 'layout', 'categories', 'deliveryZones',
  'businessHours', 'fraudAudit', 'notifications', 'coupons', 'sponsoredShelves', 'recipes', 'storeBanners', 'deliveryRoutes',
  'brandIdentity', 'intelligence', 'integrations', 'payments',
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { logout, getAdminData } = useAuth()
  const admin = getAdminData()
  const [searchParams, setSearchParams] = useSearchParams()
  const sectionParam = searchParams.get('section') as Section | null
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

  const { stats, loadStats } = useDashboardStats()
  const analytics = useDashboardAnalytics(activeSection)
  const p = useProductsAdmin(activeSection, loadStats)
  const o = useOrdersAdmin(activeSection)
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
                stats={stats}
                analytics={analytics}
                onAnalyticsChange={analytics.handleAnalyticsChange}
                onNavigate={setActiveSection}
              />
            </Suspense>
          )}

          {activeSection === 'products' && (
            <Suspense fallback={lazySectionFallback}>
              <ProductsSection
                productsSearch={p.productsSearch}
                onProductsSearchChange={p.setProductsSearch}
                onSearch={() => p.loadProducts(1, p.productsSearch, p.productsFilterOutOfStock, p.productsFilterInactive, p.productsFilterUncategorized)}
                productsFilterOutOfStock={p.productsFilterOutOfStock}
                onProductsFilterOutOfStockChange={(value) => {
                  p.setProductsFilterOutOfStock(value)
                  p.setProductsPage(1)
                }}
                productsFilterInactive={p.productsFilterInactive}
                onProductsFilterInactiveChange={(value) => {
                  p.setProductsFilterInactive(value)
                  p.setProductsPage(1)
                }}
                productsFilterUncategorized={p.productsFilterUncategorized}
                onProductsFilterUncategorizedChange={(value) => {
                  p.setProductsFilterUncategorized(value)
                  p.setProductsPage(1)
                }}
                onBulkUpdateStatus={p.handleBulkUpdateStatus}
                onBulkDelete={p.handleBulkDelete}
                onUpdateProductFields={p.handleUpdateProductFields}
                productFeedback={p.productFeedback}
                onDismissProductFeedback={() => p.setProductFeedback(null)}
                onSyncProducts={p.handleSyncProducts}
                syncingProducts={p.syncingProducts}
                onSyncTaxonomy={p.handleSyncTaxonomy}
                syncingTaxonomy={p.syncingTaxonomy}
                onCreateProduct={p.openCreateProductForm}
                classification01Filter={p.classification01Filter}
                classification02Filter={p.classification02Filter}
                classification03Filter={p.classification03Filter}
                classification04Filter={p.classification04Filter}
                onClassification01FilterChange={(value) => {
                  p.setClassification01Filter(value)
                  p.setClassification02Filter('')
                  p.setClassification03Filter('')
                  p.setClassification04Filter('')
                  p.setProductsPage(1)
                }}
                onClassification02FilterChange={(value) => {
                  p.setClassification02Filter(value)
                  p.setClassification03Filter('')
                  p.setClassification04Filter('')
                  p.setProductsPage(1)
                }}
                onClassification03FilterChange={(value) => {
                  p.setClassification03Filter(value)
                  p.setClassification04Filter('')
                  p.setProductsPage(1)
                }}
                onClassification04FilterChange={(value) => {
                  p.setClassification04Filter(value)
                  p.setProductsPage(1)
                }}
                groupedMercadologicalTree={p.groupedMercadologicalTree}
                level2Options={p.level2Options}
                level3Options={p.level3Options}
                level4Options={p.level4Options}
                formatClassificationOptionLabel={formatClassificationOptionLabel}
                isProductFormOpen={p.isProductFormOpen}
                editingProductId={p.editingProductId}
                onSaveProduct={p.handleSaveProduct}
                productForm={p.productForm}
                productFormErrors={p.productFormErrors}
                onProductFormChange={(updates) => p.setProductForm((prev) => ({ ...prev, ...updates }))}
                formLevel2Options={p.formLevel2Options}
                formLevel3Options={p.formLevel3Options}
                formLevel4Options={p.formLevel4Options}
                onResetProductForm={p.resetProductForm}
                savingProduct={p.savingProduct}
                productsLoading={p.productsLoading}
                productsError={p.productsError}
                products={p.products}
                formatClassificationPath={formatClassificationPath}
                onEditProduct={p.openEditProductForm}
                onDeleteProduct={p.handleDeleteProduct}
                productsPage={p.productsPage}
                productsTotalPages={p.productsTotalPages}
                onPreviousPage={() => p.loadProducts(p.productsPage - 1, p.productsSearch)}
                onNextPage={() => p.loadProducts(p.productsPage + 1, p.productsSearch)}
                solidcomStatusLoading={p.solidcomStatusLoading}
                solidcomStatus={p.solidcomStatus}
                onReloadSolidcomStatus={p.loadSolidcomStatus}
                solidcomStatusExpanded={p.solidcomStatusExpanded}
                onToggleSolidcomStatusExpanded={() => p.setSolidcomStatusExpanded(!p.solidcomStatusExpanded)}
                availabilityMetrics={p.availabilityMetrics}
              />
            </Suspense>
          )}

          {activeSection === 'orders' && (
            <Suspense fallback={lazySectionFallback}>
              <OrdersSection
                ordersSearch={o.ordersSearch}
                onOrdersSearchChange={o.setOrdersSearch}
                ordersStatusFilter={o.ordersStatusFilter}
                onOrdersStatusFilterChange={o.setOrdersStatusFilter}
                ordersDateFilter={o.ordersDateFilter}
                onOrdersDateFilterChange={o.setOrdersDateFilter}
                ordersPaymentFilter={o.ordersPaymentFilter}
                onOrdersPaymentFilterChange={o.setOrdersPaymentFilter}
                ordersChangeFilter={o.ordersChangeFilter}
                onOrdersChangeFilterChange={o.setOrdersChangeFilter}
                ordersViewMode={o.ordersViewMode}
                onOrdersViewModeChange={o.setOrdersViewMode}
                onReloadOrders={o.loadOrders}
                autoRefresh={o.ordersAutoRefresh}
                onAutoRefreshChange={o.setOrdersAutoRefresh}
                ordersLoading={o.ordersLoading}
                filteredOrders={o.filteredOrders}
                orderStatusOptions={ORDER_STATUS_OPTIONS}
                orderStatusLabels={ORDER_STATUS_LABELS}
                updatingOrderStatus={o.updatingOrderStatus}
                onUpdateOrderStatus={o.handleUpdateOrderStatus}
                onUpdateOrder={o.handleUpdateOrder}
                orderFeedback={o.orderFeedback}
                onDismissOrderFeedback={() => o.setOrderFeedback(null)}
                onSelectOrder={o.openOrderDetails}
                draggingOrderId={o.draggingOrderId}
                onDraggingOrderIdChange={o.setDraggingOrderId}
                selectedOrder={o.selectedOrder}
                paymentStatusLabels={PAYMENT_STATUS_LABELS}
                getPaymentStatusClassName={getPaymentStatusClassName}
                renderWhatsAppBadge={(phone, compact) => <WhatsAppBadge phone={phone} compact={compact} />}
              />
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

          {activeSection === 'teamPerformance' && (
            <Suspense fallback={lazySectionFallback}>
              <TeamPerformanceSection />
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
              <CategoriesManager />
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
